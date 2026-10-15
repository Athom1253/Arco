import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, CalendarDays, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  getGetPracticeAchievementsQueryKey,
  getGetPracticeCalendarQueryKey,
  getGetPracticeGoalsQueryKey,
  getGetPracticePlanSummaryQueryKey,
  getGetPracticeSessionsQueryKey,
  getGetPracticeStatisticsQueryKey,
  getGetRepertoireQueryKey,
  getGetViolinDashboardQueryKey,
  useDeletePracticeSession,
  useGetPracticeCalendar,
  useGetPracticeSessions,
  useGetPracticeStatistics,
  useGetRepertoire,
  useUpdatePracticeSession,
} from '@workspace/api-client-react';
import type { PracticeCategory, PracticeSession } from '@workspace/api-client-react';
import {
  Button,
  Card,
  EmptyState,
  Field,
  Modal,
  PageHeading,
  QueryState,
  SubmitButton,
} from '@/components/Primitives';
import { ManualPracticeDialog } from '@/components/ManualPracticeDialog';
import { dateKey, formatDuration, prettyDate, titleCase } from '@/lib/utils';

const categoryList: PracticeCategory[] = [
  'technique',
  'scales',
  'intonation',
  'bowing',
  'sight-reading',
  'repertoire',
  'memorisation',
  'other',
];
type TrendPeriod = 'daily' | 'weekly' | 'monthly';

const monthLabel = (date: Date) =>
  date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

function localDateFromKey(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function getBucketStart(value: string, period: TrendPeriod) {
  if (period === 'daily') return value;
  const date = new Date(`${value}T12:00:00.000Z`);
  if (period === 'monthly') {
    date.setUTCDate(1);
  } else {
    const daysSinceMonday = (date.getUTCDay() + 6) % 7;
    date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  }
  return date.toISOString().slice(0, 10);
}

function bucketLabel(value: string, period: TrendPeriod) {
  const date = localDateFromKey(value);
  if (period === 'monthly') {
    return date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
  }
  if (period === 'weekly') {
    return date.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
  }
  return date.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
}

function SessionRow({
  session,
  onEdit,
  onDelete,
}: {
  session: PracticeSession;
  onEdit: (session: PracticeSession) => void;
  onDelete: (session: PracticeSession) => void;
}) {
  const practiceDay = localDateFromKey(session.practiceDate);
  const timerTime =
    session.source === 'timer'
      ? new Date(session.startedAt).toLocaleTimeString(undefined, {
          hour: 'numeric',
          minute: '2-digit',
        })
      : null;
  const recordName = session.pieceTitle || 'Open practice';

  return (
    <div className="log-row" data-testid={`row-practice-session-${session.id}`}>
      <div className="log-date" aria-label={prettyDate(session.practiceDate)}>
        <strong>{practiceDay.toLocaleDateString(undefined, { day: '2-digit' })}</strong>
        <span>{practiceDay.toLocaleDateString(undefined, { month: 'short' })}</span>
      </div>
      <div className="log-content">
        <strong>{recordName}</strong>
        <span>
          {titleCase(session.category)} · {timerTime ? `Timer · ${timerTime}` : 'Manual entry'}
        </span>
        {session.goal && <p>{session.goal}</p>}
        {session.focusAreas.length > 0 && (
          <p className="log-focus-areas">{session.focusAreas.join(' · ')}</p>
        )}
        {session.notes && <p className="log-note">{session.notes}</p>}
      </div>
      <b className="log-duration">{formatDuration(session.elapsedSeconds)}</b>
      <div className="row-actions">
        <button
          type="button"
          className="icon-button"
          aria-label={`Edit ${recordName} on ${prettyDate(session.practiceDate)}`}
          onClick={() => onEdit(session)}
          data-testid={`button-edit-practice-${session.id}`}
        >
          <Pencil size={16} />
        </button>
        <button
          type="button"
          className="icon-button danger-icon"
          aria-label={`Delete ${recordName} on ${prettyDate(session.practiceDate)}`}
          onClick={() => onDelete(session)}
          data-testid={`button-delete-practice-${session.id}`}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

export default function History() {
  const client = useQueryClient();
  const today = new Date();
  const todayKey = dateKey(today);
  const weekStartDate = new Date(today);
  weekStartDate.setDate(weekStartDate.getDate() - (weekStartDate.getDay() + 6) % 7);
  const weekStartKey = dateKey(weekStartDate);
  const monthStartKey = dateKey(new Date(today.getFullYear(), today.getMonth(), 1));
  const initialAnalyticsDate = new Date(today);
  initialAnalyticsDate.setDate(initialAnalyticsDate.getDate() - 29);

  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [category, setCategory] = useState('');
  const [pieceId, setPieceId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [analyticsFrom, setAnalyticsFrom] = useState(dateKey(initialAnalyticsDate));
  const [analyticsTo, setAnalyticsTo] = useState(todayKey);
  const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>('daily');
  const [manualOpen, setManualOpen] = useState(false);
  const [manualEditing, setManualEditing] = useState<PracticeSession>();
  const [timerEditing, setTimerEditing] = useState<PracticeSession | null>(null);
  const [editGoal, setEditGoal] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editCategory, setEditCategory] = useState<PracticeCategory>('technique');
  const [editMinutes, setEditMinutes] = useState('0');
  const [editPieceId, setEditPieceId] = useState('');
  const [editStartedAt, setEditStartedAt] = useState('');

  const logParams = useMemo(
    () => ({
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      ...(category ? { category: category as PracticeCategory } : {}),
      ...(pieceId ? { pieceId: Number(pieceId) } : {}),
    }),
    [from, to, category, pieceId],
  );
  const logRangeInvalid = Boolean(from && to && from > to);
  const sessionQuery = useGetPracticeSessions(logParams, {
    query: {
      enabled: !logRangeInvalid,
      queryKey: getGetPracticeSessionsQueryKey(logParams),
    },
  });
  const daySessionsQuery = useGetPracticeSessions({
    from: selectedDate,
    to: selectedDate,
  });
  const analyticsParams = useMemo(
    () => ({ from: analyticsFrom, to: analyticsTo }),
    [analyticsFrom, analyticsTo],
  );
  const analyticsRangeInvalid = analyticsFrom > analyticsTo;
  const statsQuery = useGetPracticeStatistics(analyticsParams, {
    query: {
      enabled: !analyticsRangeInvalid,
      queryKey: getGetPracticeStatisticsQueryKey(analyticsParams),
    },
  });
  const todaySummaryQuery = useGetPracticeStatistics({ from: todayKey, to: todayKey });
  const weekSummaryQuery = useGetPracticeStatistics({ from: weekStartKey, to: todayKey });
  const monthSummaryQuery = useGetPracticeStatistics({ from: monthStartKey, to: todayKey });
  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
  const calendarQuery = useGetPracticeCalendar({ month: monthKey });
  const repertoireQuery = useGetRepertoire({ includeArchived: true });
  const update = useUpdatePracticeSession();
  const remove = useDeletePracticeSession();

  const invalidate = () => {
    void client.invalidateQueries({ queryKey: getGetPracticeSessionsQueryKey() });
    void client.invalidateQueries({ queryKey: getGetPracticeStatisticsQueryKey() });
    void client.invalidateQueries({ queryKey: getGetPracticeCalendarQueryKey() });
    void client.invalidateQueries({ queryKey: getGetViolinDashboardQueryKey() });
    void client.invalidateQueries({ queryKey: getGetRepertoireQueryKey() });
    void client.invalidateQueries({ queryKey: getGetPracticeGoalsQueryKey() });
    void client.invalidateQueries({ queryKey: getGetPracticeAchievementsQueryKey() });
    void client.invalidateQueries({ queryKey: getGetPracticePlanSummaryQueryKey() });
  };

  const sessions = sessionQuery.data || [];
  const daySessions = daySessionsQuery.data || [];
  const statistics = statsQuery.data;
  const days = useMemo(() => {
    const start = new Date(month.getFullYear(), month.getMonth(), 1);
    const offset = (start.getDay() + 6) % 7;
    const total = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [
      ...Array.from({ length: offset }, () => null),
      ...Array.from({ length: total }, (_, index) => index + 1),
    ];
  }, [month]);
  const calendarByDate = useMemo(
    () => new Map((calendarQuery.data || []).map((day) => [day.date, day])),
    [calendarQuery.data],
  );
  const chartData = useMemo(() => {
    const buckets = new Map<string, { date: string; seconds: number; sessionCount: number }>();
    for (const day of statistics?.daily || []) {
      const date = getBucketStart(day.date, trendPeriod);
      const current = buckets.get(date) || { date, seconds: 0, sessionCount: 0 };
      current.seconds += day.seconds;
      current.sessionCount += day.sessionCount;
      buckets.set(date, current);
    }
    return [...buckets.values()].sort((left, right) => left.date.localeCompare(right.date));
  }, [statistics?.daily, trendPeriod]);
  const trendMaximum = Math.max(...chartData.map((day) => day.seconds), 1);
  const selectedDaySeconds = daySessions.reduce(
    (total, session) => total + session.elapsedSeconds,
    0,
  );
  const anyLoading =
    sessionQuery.isLoading ||
    statsQuery.isLoading ||
    todaySummaryQuery.isLoading ||
    weekSummaryQuery.isLoading ||
    monthSummaryQuery.isLoading ||
    calendarQuery.isLoading ||
    repertoireQuery.isLoading;
  const anyError =
    sessionQuery.error ||
    statsQuery.error ||
    todaySummaryQuery.error ||
    weekSummaryQuery.error ||
    monthSummaryQuery.error ||
    calendarQuery.error ||
    repertoireQuery.error;

  const chooseDay = (value: string) => {
    setSelectedDate(value);
    const date = localDateFromKey(value);
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  };

  const editSession = (session: PracticeSession) => {
    if (session.source === 'manual') {
      setManualOpen(false);
      setManualEditing(session);
      return;
    }
    setTimerEditing(session);
    setEditGoal(session.goal);
    setEditNotes(session.notes);
    setEditCategory(session.category);
    setEditMinutes(String(Math.round(session.elapsedSeconds / 60)));
    setEditPieceId(session.pieceId ? String(session.pieceId) : '');
    const startedAt = new Date(session.startedAt);
    setEditStartedAt(
      new Date(startedAt.getTime() - startedAt.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16),
    );
  };

  const deleteSession = (session: PracticeSession) => {
    if (
      window.confirm(
        `Delete this practice record from ${prettyDate(session.practiceDate)}? This cannot be undone.`,
      )
    ) {
      remove.mutate({ id: session.id }, { onSuccess: invalidate });
    }
  };

  const openManualDialog = () => {
    setManualEditing(undefined);
    setManualOpen(true);
  };

  const closeManualDialog = () => {
    setManualOpen(false);
    setManualEditing(undefined);
  };

  const retry = () => {
    void sessionQuery.refetch();
    void daySessionsQuery.refetch();
    void statsQuery.refetch();
    void todaySummaryQuery.refetch();
    void weekSummaryQuery.refetch();
    void monthSummaryQuery.refetch();
    void calendarQuery.refetch();
    void repertoireQuery.refetch();
  };

  return (
    <div className="page-enter">
      <PageHeading
        eyebrow="THE LONG VIEW"
        title="Practice history"
        subtitle="Notice the shape of your work, not just the hours."
        action={
          <Button onClick={openManualDialog} data-testid="button-log-practice">
            <Plus size={17} /> Log practice
          </Button>
        }
      />
      <QueryState loading={anyLoading} error={anyError} retry={retry} />
      {!anyLoading && !anyError && (
        <>
          <div className="period-summary-grid">
            <Card className="period-summary">
              <span>TODAY</span>
              <strong>{formatDuration(todaySummaryQuery.data?.totalSeconds || 0)}</strong>
              <small>{todaySummaryQuery.data?.sessionCount || 0} practice records</small>
            </Card>
            <Card className="period-summary">
              <span>THIS WEEK</span>
              <strong>{formatDuration(weekSummaryQuery.data?.totalSeconds || 0)}</strong>
              <small>{weekSummaryQuery.data?.sessionCount || 0} practice records</small>
            </Card>
            <Card className="period-summary">
              <span>THIS MONTH</span>
              <strong>{formatDuration(monthSummaryQuery.data?.totalSeconds || 0)}</strong>
              <small>{monthSummaryQuery.data?.sessionCount || 0} practice records</small>
            </Card>
          </div>

          <div className="history-metrics">
            <Card className="history-metric">
              <span>PRACTICE IN RANGE</span>
              <strong>{formatDuration(statistics?.totalSeconds || 0)}</strong>
            </Card>
            <Card className="history-metric">
              <span>SESSIONS</span>
              <strong>{statistics?.sessionCount || 0}</strong>
            </Card>
            <Card className="history-metric">
              <span>DAILY AVERAGE</span>
              <strong>{formatDuration(statistics?.averageDailySeconds || 0)}</strong>
            </Card>
            <Card className="history-metric">
              <span>BEST DAY</span>
              <strong>
                {statistics?.bestDay ? formatDuration(statistics.bestDay.seconds) : '—'}
              </strong>
              <small>
                {statistics?.bestDay ? prettyDate(statistics.bestDay.date) : 'No records in range'}
              </small>
            </Card>
          </div>

          <Card className="trend-card">
            <div className="section-title">
              <div>
                <span className="eyebrow">TIME IN THE PRACTICE ROOM</span>
                <h2>Practice over time</h2>
              </div>
              <span className="session-count">
                {statistics?.sessionCount || 0} records · {chartData.length} periods
              </span>
            </div>
            <div className="analytics-toolbar">
              <Field label="From">
                <input
                  type="date"
                  value={analyticsFrom}
                  max={analyticsTo}
                  onChange={(event) => setAnalyticsFrom(event.target.value)}
                  data-testid="input-analytics-from"
                />
              </Field>
              <Field label="To">
                <input
                  type="date"
                  value={analyticsTo}
                  min={analyticsFrom}
                  max={todayKey}
                  onChange={(event) => setAnalyticsTo(event.target.value)}
                  data-testid="input-analytics-to"
                />
              </Field>
              <fieldset className="trend-period-control">
                <legend>Group by</legend>
                {(['daily', 'weekly', 'monthly'] as const).map((period) => (
                  <button
                    type="button"
                    key={period}
                    className={trendPeriod === period ? 'is-active' : ''}
                    aria-pressed={trendPeriod === period}
                    onClick={() => setTrendPeriod(period)}
                    data-testid={`button-trend-${period}`}
                  >
                    {titleCase(period)}
                  </button>
                ))}
              </fieldset>
            </div>
            {analyticsRangeInvalid ? (
              <p className="quiet-copy trend-empty" role="alert">
                Choose a start date on or before the end date.
              </p>
            ) : chartData.some((day) => day.seconds > 0) ? (
              <div className="trend-chart-scroll">
                <div
                  className="trend-chart"
                  role="list"
                  aria-label={`${titleCase(trendPeriod)} practice time from ${prettyDate(analyticsFrom)} to ${prettyDate(analyticsTo)}`}
                >
                  {chartData.map((day, index) => {
                    const height = day.seconds
                      ? Math.max(5, (day.seconds / trendMaximum) * 100)
                      : 2;
                    const showLabel =
                      chartData.length <= 14 ||
                      index === 0 ||
                      index === chartData.length - 1 ||
                      index % Math.ceil(chartData.length / 8) === 0;
                    return (
                      <div
                        className="trend-column"
                        key={day.date}
                        role="listitem"
                        aria-label={`${prettyDate(day.date)}: ${formatDuration(day.seconds)}, ${day.sessionCount} records`}
                        title={`${prettyDate(day.date)} · ${formatDuration(day.seconds)} · ${day.sessionCount} records`}
                        data-testid={`chart-period-${day.date}`}
                      >
                        <div className="trend-bar-wrap">
                          <i style={{ height: `${height}%` }} />
                        </div>
                        <small>{showLabel ? bucketLabel(day.date, trendPeriod) : ''}</small>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="quiet-copy trend-empty">
                No practice records in this date range. Choose another range or log a session.
              </p>
            )}
          </Card>

          <div className="history-layout">
            <Card className="calendar-card">
              <div className="section-title">
                <div>
                  <span className="eyebrow">PRACTICE RHYTHM</span>
                  <h2>{monthLabel(month)}</h2>
                </div>
                <div className="calendar-controls">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Previous month"
                    onClick={() =>
                      setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
                    }
                    data-testid="button-calendar-previous-month"
                  >
                    <ArrowLeft size={17} />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Next month"
                    onClick={() =>
                      setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
                    }
                    data-testid="button-calendar-next-month"
                  >
                    <ArrowRight size={17} />
                  </button>
                </div>
              </div>
              <div className="calendar-grid" role="grid" aria-label={`Practice calendar for ${monthLabel(month)}`}>
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((weekday, index) => (
                  <span
                    key={`${weekday}-${index}`}
                    className="calendar-weekday"
                    role="columnheader"
                  >
                    {weekday}
                  </span>
                ))}
                {days.map((day, index) => {
                  const key = day
                    ? dateKey(new Date(month.getFullYear(), month.getMonth(), day))
                    : `empty-${index}`;
                  const data = day ? calendarByDate.get(key) : undefined;
                  if (!day) {
                    return <span key={key} className="calendar-day is-blank" role="gridcell" />;
                  }
                  const hasPractice = Boolean(data?.seconds);
                  return (
                    <div
                      key={key}
                      className="calendar-cell"
                      role="gridcell"
                    >
                      <button
                        type="button"
                        className={[
                          'calendar-day',
                          hasPractice ? 'has-practice' : '',
                          key === todayKey ? 'is-today' : '',
                          key === selectedDate ? 'is-selected' : '',
                        ].filter(Boolean).join(' ')}
                        aria-label={`${prettyDate(key)}: ${data?.seconds ? `${formatDuration(data.seconds)}, ${data.sessionCount} practice records` : 'no practice records'}; select day`}
                        aria-pressed={selectedDate === key}
                        title={
                          data?.seconds
                            ? `${formatDuration(data.seconds)} · ${data.sessionCount} records`
                            : `No practice records · ${prettyDate(key)}`
                        }
                        onClick={() => chooseDay(key)}
                        data-testid={`calendar-day-${key}`}
                      >
                        <span>{day}</span>
                        {hasPractice && (
                          <i
                            style={{
                              opacity: Math.min(1, 0.35 + (data?.seconds || 0) / 7200),
                            }}
                          />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
              {!calendarQuery.data?.some((day) => day.seconds > 0) && (
                <p className="quiet-copy calendar-empty-copy">
                  Your recorded practice days will appear here.
                </p>
              )}
              <div className="calendar-legend">
                <span><i /> Practiced</span>
                <span><CalendarDays size={13} /> Select a day to review its records</span>
              </div>
            </Card>

            <Card className="history-breakdown">
              <div className="eyebrow">WHERE THE TIME WENT</div>
              <h2>By category</h2>
              {statistics?.byCategory.length ? (
                statistics.byCategory.map((item) => (
                  <div className="breakdown-row" key={item.category}>
                    <div className="breakdown-label">
                      <span>{titleCase(item.category)}</span>
                      <b>{formatDuration(item.seconds)}</b>
                    </div>
                    <div
                      className="breakdown-track"
                      role="img"
                      aria-label={`${titleCase(item.category)}: ${formatDuration(item.seconds)}`}
                    >
                      <i
                        style={{
                          width: `${statistics.totalSeconds
                            ? (item.seconds / statistics.totalSeconds) * 100
                            : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="quiet-copy">Category insights will appear for this date range.</p>
              )}
            </Card>
          </div>

          <Card className="history-piece-breakdown">
            <div className="eyebrow">MUSIC ON YOUR STAND</div>
            <h2>Practice time by piece</h2>
            {statistics?.byPiece.length ? (
              statistics.byPiece.map((item) => (
                <div className="breakdown-row" key={item.pieceId ?? 'open-practice'}>
                  <div className="breakdown-label">
                    <span>{item.title}</span>
                    <b>{formatDuration(item.seconds)}</b>
                  </div>
                  <div
                    className="breakdown-track"
                    role="img"
                    aria-label={`${item.title}: ${formatDuration(item.seconds)}`}
                  >
                    <i
                      style={{
                        width: `${statistics.totalSeconds
                          ? (item.seconds / statistics.totalSeconds) * 100
                          : 0}%`,
                      }}
                    />
                  </div>
                  <small>{item.sessionCount} practice records</small>
                </div>
              ))
            ) : (
              <p className="quiet-copy">Piece totals will appear for this date range.</p>
            )}
          </Card>

          <Card className="selected-day-card">
            <div className="section-title">
              <div>
                <span className="eyebrow">DAY VIEW</span>
                <h2>{prettyDate(selectedDate)}</h2>
              </div>
              <div className="selected-day-total">
                <span>{daySessions.length} practice records</span>
                <strong>{formatDuration(selectedDaySeconds)}</strong>
              </div>
            </div>
            <div className="selected-day-controls">
              <Field label="Choose a day">
                <input
                  type="date"
                  value={selectedDate}
                  max={todayKey}
                  onChange={(event) => event.target.value && chooseDay(event.target.value)}
                  data-testid="input-selected-practice-day"
                />
              </Field>
              <Button
                variant="secondary"
                onClick={() => {
                  setManualEditing(undefined);
                  setManualOpen(true);
                }}
                data-testid="button-log-selected-day"
              >
                <Plus size={16} /> Add a session
              </Button>
            </div>
            {daySessionsQuery.error ? (
              <p className="quiet-copy" role="alert">
                This day’s records could not be loaded.{' '}
                <button
                  type="button"
                  className="inline-retry"
                  onClick={() => void daySessionsQuery.refetch()}
                >
                  Try again
                </button>
              </p>
            ) : daySessionsQuery.isLoading ? (
              <p className="quiet-copy">Loading this day’s records…</p>
            ) : daySessions.length ? (
              <div className="log-list">
                {daySessions.map((session) => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    onEdit={editSession}
                    onDelete={deleteSession}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title="No practice records for this day"
                body="Add a session you completed, with or without the timer."
                action={
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setManualEditing(undefined);
                      setManualOpen(true);
                    }}
                  >
                    <Plus size={16} /> Log practice
                  </Button>
                }
              />
            )}
          </Card>

          <Card className="history-log">
            <div className="section-title">
              <div>
                <span className="eyebrow">YOUR JOURNAL</span>
                <h2>Session log</h2>
              </div>
              <span className="session-count">{sessions.length} records</span>
            </div>
            <div className="filter-row">
              <Field label="From">
                <input
                  type="date"
                  value={from}
                  max={to || todayKey}
                  onChange={(event) => setFrom(event.target.value)}
                  data-testid="input-history-from"
                />
              </Field>
              <Field label="To">
                <input
                  type="date"
                  value={to}
                  min={from || undefined}
                  max={todayKey}
                  onChange={(event) => setTo(event.target.value)}
                  data-testid="input-history-to"
                />
              </Field>
              <Field label="Focus">
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  data-testid="select-history-category"
                >
                  <option value="">All categories</option>
                  {categoryList.map((value) => (
                    <option key={value} value={value}>{titleCase(value)}</option>
                  ))}
                </select>
              </Field>
              <Field label="Piece">
                <select
                  value={pieceId}
                  onChange={(event) => setPieceId(event.target.value)}
                  data-testid="select-history-piece"
                >
                  <option value="">All pieces</option>
                  {(repertoireQuery.data || []).map((piece) => (
                    <option key={piece.id} value={piece.id}>{piece.title}</option>
                  ))}
                </select>
              </Field>
              <Button
                variant="ghost"
                onClick={() => {
                  setFrom('');
                  setTo('');
                  setCategory('');
                  setPieceId('');
                }}
                data-testid="button-clear-history-filters"
              >
                Clear filters
              </Button>
            </div>
            {remove.error && (
              <p className="form-inline-error" role="alert">
                This practice record could not be deleted. Please try again.
              </p>
            )}
            {logRangeInvalid ? (
              <p className="quiet-copy" role="alert">Choose a start date on or before the end date.</p>
            ) : sessions.length ? (
              <div className="log-list">
                {sessions.map((session) => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    onEdit={editSession}
                    onDelete={deleteSession}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title="No practice records in this view"
                body="Adjust the filters or add a session to your journal."
                action={
                  <Button variant="secondary" onClick={openManualDialog}>
                    <Plus size={16} /> Log practice
                  </Button>
                }
              />
            )}
          </Card>
        </>
      )}

      {(manualOpen || manualEditing) && (
        <ManualPracticeDialog
          key={manualEditing?.id ?? 'new-manual-session'}
          session={manualEditing}
          defaultDate={selectedDate}
          todayKey={todayKey}
          repertoire={repertoireQuery.data || []}
          onClose={closeManualDialog}
          onSaved={() => {
            invalidate();
            closeManualDialog();
          }}
        />
      )}

      {timerEditing && (
        <Modal
          title="Edit timer session"
          onClose={() => setTimerEditing(null)}
        >
          <p className="modal-intro">
            {prettyDate(timerEditing.practiceDate)} · Adjust the saved timer record.
          </p>
          <Field label="Piece">
            <select
              value={editPieceId}
              onChange={(event) => setEditPieceId(event.target.value)}
            >
              <option value="">Open practice</option>
              {(repertoireQuery.data || []).map((piece) => (
                <option key={piece.id} value={piece.id}>
                  {piece.title} — {piece.composer}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Started at">
            <input
              type="datetime-local"
              value={editStartedAt}
              onChange={(event) => setEditStartedAt(event.target.value)}
            />
          </Field>
          <Field label="Practice focus">
            <select
              value={editCategory}
              onChange={(event) => setEditCategory(event.target.value as PracticeCategory)}
            >
              {categoryList.map((value) => (
                <option key={value} value={value}>{titleCase(value)}</option>
              ))}
            </select>
          </Field>
          <Field label="Intention">
            <input value={editGoal} onChange={(event) => setEditGoal(event.target.value)} />
          </Field>
          <Field label="Notes">
            <textarea rows={4} value={editNotes} onChange={(event) => setEditNotes(event.target.value)} />
          </Field>
          <Field label="Duration in minutes">
            <input
              type="number"
              min="0"
              step="1"
              value={editMinutes}
              onChange={(event) => setEditMinutes(event.target.value)}
            />
          </Field>
          {update.error && (
            <p className="form-inline-error" role="alert">
              This session could not be updated. Please try again.
            </p>
          )}
          <div className="modal-actions">
            <Button variant="ghost" onClick={() => setTimerEditing(null)}>
              Cancel
            </Button>
            <SubmitButton
              busy={update.isPending}
              onClick={() =>
                update.mutate(
                  {
                    id: timerEditing.id,
                    data: {
                      pieceId: editPieceId ? Number(editPieceId) : null,
                      startedAt: editStartedAt
                        ? new Date(editStartedAt).toISOString()
                        : undefined,
                      practiceDate: editStartedAt
                        ? dateKey(new Date(editStartedAt))
                        : timerEditing.practiceDate,
                      category: editCategory,
                      goal: editGoal,
                      notes: editNotes,
                      elapsedSeconds: Math.max(0, Number(editMinutes) || 0) * 60,
                    },
                  },
                  {
                    onSuccess: () => {
                      invalidate();
                      setTimerEditing(null);
                    },
                  },
                )
              }
              data-testid="button-save-timer-session"
            >
              Save changes
            </SubmitButton>
          </div>
        </Modal>
      )}
    </div>
  );
}
