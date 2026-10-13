import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, CalendarDays, Pencil, Trash2 } from 'lucide-react';
import { getGetPracticeCalendarQueryKey, getGetPracticeSessionsQueryKey, getGetPracticeStatisticsQueryKey, getGetViolinDashboardQueryKey, getGetRepertoireQueryKey, getGetPracticeGoalsQueryKey, getGetPracticeAchievementsQueryKey, useDeletePracticeSession, useGetPracticeCalendar, useGetPracticeSessions, useGetPracticeStatistics, useGetRepertoire, useUpdatePracticeSession } from '@workspace/api-client-react';
import type { PracticeCategory, PracticeSession } from '@workspace/api-client-react';
import { Button, Card, EmptyState, Field, Modal, PageHeading, QueryState, SubmitButton } from '@/components/Primitives';
import { dateKey, formatDuration, prettyDate, titleCase } from '@/lib/utils';

const categoryList: PracticeCategory[] = ['technique', 'scales', 'intonation', 'bowing', 'sight-reading', 'repertoire', 'memorisation', 'other'];
const monthLabel = (date: Date) => date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

export default function History() {
  const client = useQueryClient();
  const today = new Date();
  const todayKey = dateKey(today);
  const weekStartDate = new Date(today);
  weekStartDate.setDate(weekStartDate.getDate() - (weekStartDate.getDay() + 6) % 7);
  const weekStartKey = dateKey(weekStartDate);
  const monthStartKey = dateKey(new Date(today.getFullYear(), today.getMonth(), 1));
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [category, setCategory] = useState('');
  const [pieceId, setPieceId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [editing, setEditing] = useState<PracticeSession | null>(null);
  const [editGoal, setEditGoal] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editCategory, setEditCategory] = useState<PracticeCategory>('technique');
  const [editSeconds, setEditSeconds] = useState('0');
  const [editPieceId, setEditPieceId] = useState('');
  const [editStartedAt, setEditStartedAt] = useState('');
  const params = useMemo(() => ({ ...(from ? { from } : {}), ...(to ? { to } : {}), ...(category ? { category: category as PracticeCategory } : {}), ...(pieceId ? { pieceId: Number(pieceId) } : {}) }), [from, to, category, pieceId]);
  const sessionQuery = useGetPracticeSessions(params);
  const statsQuery = useGetPracticeStatistics(from || to ? { ...(from ? { from } : {}), ...(to ? { to } : {}) } : undefined);
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
    void client.invalidateQueries({ queryKey: getGetPracticeCalendarQueryKey({ month: monthKey }) });
    void client.invalidateQueries({ queryKey: getGetViolinDashboardQueryKey() });
    void client.invalidateQueries({ queryKey: getGetRepertoireQueryKey() });
    void client.invalidateQueries({ queryKey: getGetPracticeGoalsQueryKey() });
    void client.invalidateQueries({ queryKey: getGetPracticeAchievementsQueryKey() });
  };
  const sessions = sessionQuery.data || [];
  const statistics = statsQuery.data;
  const days = useMemo(() => {
    const start = new Date(month.getFullYear(), month.getMonth(), 1);
    const offset = (start.getDay() + 6) % 7;
    const total = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [...Array.from({ length: offset }, () => null), ...Array.from({ length: total }, (_, index) => index + 1)];
  }, [month]);
  const calendarByDate = new Map((calendarQuery.data || []).map((day) => [day.date, day]));
  const trendMaximum = Math.max(...(statistics?.daily.map((day) => day.seconds) || []), 1);

  const editSession = (session: PracticeSession) => {
    setEditing(session);
    setEditGoal(session.goal);
    setEditNotes(session.notes);
    setEditCategory(session.category);
    setEditSeconds(String(Math.round(session.elapsedSeconds / 60)));
    setEditPieceId(session.pieceId ? String(session.pieceId) : '');
    setEditStartedAt(new Date(new Date(session.startedAt).getTime() - new Date(session.startedAt).getTimezoneOffset() * 60000).toISOString().slice(0, 16));
  };

  const anyLoading = sessionQuery.isLoading || statsQuery.isLoading || todaySummaryQuery.isLoading || weekSummaryQuery.isLoading || monthSummaryQuery.isLoading || calendarQuery.isLoading || repertoireQuery.isLoading;
  const anyError = sessionQuery.error || statsQuery.error || todaySummaryQuery.error || weekSummaryQuery.error || monthSummaryQuery.error || calendarQuery.error || repertoireQuery.error;

  return <div className="page-enter">
    <PageHeading eyebrow="THE LONG VIEW" title="Practice history" subtitle="Notice the shape of your work, not just the hours." />
    <QueryState loading={anyLoading} error={anyError} retry={() => { void sessionQuery.refetch(); void statsQuery.refetch(); void todaySummaryQuery.refetch(); void weekSummaryQuery.refetch(); void monthSummaryQuery.refetch(); void calendarQuery.refetch(); void repertoireQuery.refetch(); }} />
    {!anyLoading && !anyError && <>
      <div className="period-summary-grid">
        <Card className="period-summary"><span>TODAY</span><strong>{formatDuration(todaySummaryQuery.data?.totalSeconds || 0)}</strong><small>{todaySummaryQuery.data?.sessionCount || 0} completed sessions</small></Card>
        <Card className="period-summary"><span>THIS WEEK</span><strong>{formatDuration(weekSummaryQuery.data?.totalSeconds || 0)}</strong><small>{weekSummaryQuery.data?.sessionCount || 0} completed sessions</small></Card>
        <Card className="period-summary"><span>THIS MONTH</span><strong>{formatDuration(monthSummaryQuery.data?.totalSeconds || 0)}</strong><small>{monthSummaryQuery.data?.sessionCount || 0} completed sessions</small></Card>
      </div>
      <div className="history-metrics">
        <Card className="history-metric"><span>TOTAL PRACTICE</span><strong>{formatDuration(statistics?.totalSeconds || 0)}</strong></Card>
        <Card className="history-metric"><span>SESSIONS</span><strong>{statistics?.sessionCount || 0}</strong></Card>
        <Card className="history-metric"><span>DAILY AVERAGE</span><strong>{formatDuration(statistics?.averageDailySeconds || 0)}</strong></Card>
        <Card className="history-metric"><span>BEST DAY</span><strong>{statistics?.bestDay ? formatDuration(statistics.bestDay.seconds) : '—'}</strong><small>{statistics?.bestDay ? prettyDate(statistics.bestDay.date) : 'A day yet to come'}</small></Card>
      </div>
      <Card className="trend-card">
        <div className="section-title"><div><span className="eyebrow">TIME IN THE PRACTICE ROOM</span><h2>Practice over time</h2></div><span className="session-count">Daily minutes · {statistics?.daily.length || 0} days</span></div>
        {statistics?.daily.some((day) => day.seconds > 0) ? <div className="trend-chart" role="img" aria-label="Bar chart of daily practice time">
          {statistics.daily.map((day, index) => {
            const height = day.seconds ? Math.max(5, day.seconds / trendMaximum * 100) : 2;
            const showLabel = index === 0 || index === statistics.daily.length - 1 || index % 5 === 0;
            return <div className="trend-column" key={day.date} title={`${prettyDate(day.date)} · ${formatDuration(day.seconds)}`}>
              <div className="trend-bar-wrap"><i style={{ height: `${height}%` }} /></div>
              <small>{showLabel ? new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }) : ''}</small>
            </div>;
          })}
        </div> : <p className="quiet-copy trend-empty">Practice time will take shape here after your first completed session.</p>}
      </Card>
      <div className="history-layout">
        <Card className="calendar-card"><div className="section-title"><div><span className="eyebrow">PRACTICE RHYTHM</span><h2>{monthLabel(month)}</h2></div><div className="calendar-controls"><button className="icon-button" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ArrowLeft size={17} /></button><button className="icon-button" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ArrowRight size={17} /></button></div></div>
          <div className="calendar-grid">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((weekday, index) => <span key={`${weekday}-${index}`} className="calendar-weekday">{weekday}</span>)}{days.map((day, index) => {
            const key = day ? dateKey(new Date(month.getFullYear(), month.getMonth(), day)) : `empty-${index}`;
            const data = day ? calendarByDate.get(key) : undefined;
            return <div key={key} className={`calendar-day ${day ? '' : 'is-blank'} ${data?.seconds ? 'has-practice' : ''} ${key === dateKey(today) ? 'is-today' : ''}`} title={data ? `${formatDuration(data.seconds)} · ${data.sessionCount} sessions` : ''}>{day && <><span>{day}</span>{data?.seconds ? <i style={{ opacity: Math.min(1, 0.35 + data.seconds / 7200) }} /> : null}</>}</div>;
          })}</div>
          {!calendarQuery.data?.length && <p className="quiet-copy calendar-empty-copy">A fresh page for this month. Your practice days will be marked here.</p>}
          <div className="calendar-legend"><span><i /> Practiced</span><span><CalendarDays size={13} /> Minutes shown in your session log</span></div>
        </Card>
        <Card className="history-breakdown"><div className="eyebrow">WHERE THE TIME WENT</div><h2>By category</h2>{statistics?.byCategory.length ? statistics.byCategory.map((item) => <div className="breakdown-row" key={item.category}><div className="breakdown-label"><span>{titleCase(item.category)}</span><b>{formatDuration(item.seconds)}</b></div><div className="breakdown-track"><i style={{ width: `${statistics.totalSeconds ? item.seconds / statistics.totalSeconds * 100 : 0}%` }} /></div></div>) : <p className="quiet-copy">Category insights will appear with your first completed sessions.</p>}</Card>
      </div>
      <Card className="history-piece-breakdown"><div className="eyebrow">MUSIC ON YOUR STAND</div><h2>Practice time by piece</h2>{statistics?.byPiece.length ? statistics.byPiece.map((item) => <div className="breakdown-row" key={item.pieceId ?? 'open-practice'}><div className="breakdown-label"><span>{item.title}</span><b>{formatDuration(item.seconds)}</b></div><div className="breakdown-track"><i style={{ width: `${statistics.totalSeconds ? item.seconds / statistics.totalSeconds * 100 : 0}%` }} /></div><small>{item.sessionCount} sessions</small></div>) : <p className="quiet-copy">Piece totals will appear here as you complete sessions.</p>}</Card>
      <Card className="history-log"><div className="section-title"><div><span className="eyebrow">YOUR JOURNAL</span><h2>Session log</h2></div><span className="session-count">{sessions.length} sessions</span></div>
        <div className="filter-row"><Field label="From"><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></Field><Field label="To"><input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></Field><Field label="Focus"><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">All categories</option>{categoryList.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></Field><Field label="Piece"><select value={pieceId} onChange={(event) => setPieceId(event.target.value)}><option value="">All pieces</option>{(repertoireQuery.data || []).map((piece) => <option key={piece.id} value={piece.id}>{piece.title}</option>)}</select></Field><Button variant="ghost" onClick={() => { setFrom(''); setTo(''); setCategory(''); setPieceId(''); }}>Clear filters</Button></div>
        {sessions.length ? <div className="log-list">{sessions.map((session) => <div className="log-row" key={session.id}><div className="log-date"><strong>{new Date(session.startedAt).toLocaleDateString(undefined, { day: '2-digit' })}</strong><span>{new Date(session.startedAt).toLocaleDateString(undefined, { month: 'short' })}</span></div><div className="log-content"><strong>{session.pieceTitle || 'Open practice'}</strong><span>{titleCase(session.category)} · {new Date(session.startedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>{session.goal && <p>{session.goal}</p>}{session.notes && <p className="log-note">{session.notes}</p>}</div><b className="log-duration">{formatDuration(session.elapsedSeconds)}</b><div className="row-actions"><button className="icon-button" aria-label="Edit session" onClick={() => editSession(session)}><Pencil size={16} /></button><button className="icon-button danger-icon" aria-label="Delete session" onClick={() => { if (window.confirm('Delete this practice session?')) remove.mutate({ id: session.id }, { onSuccess: invalidate }); }}><Trash2 size={16} /></button></div></div>)}</div> : <EmptyState title="No sessions in this view" body="Try changing your filters, or start a practice session to begin your journal." />}
      </Card>
    </>}
    {editing && <Modal title="Edit session details" onClose={() => setEditing(null)}><p className="modal-intro">{prettyDate(editing.startedAt)} · Adjust the record while keeping the work intact.</p><Field label="Piece"><select value={editPieceId} onChange={(event) => setEditPieceId(event.target.value)}><option value="">Open practice</option>{(repertoireQuery.data || []).map((piece) => <option key={piece.id} value={piece.id}>{piece.title} — {piece.composer}</option>)}</select></Field><Field label="Started at"><input type="datetime-local" value={editStartedAt} onChange={(event) => setEditStartedAt(event.target.value)} /></Field><Field label="Practice focus"><select value={editCategory} onChange={(event) => setEditCategory(event.target.value as PracticeCategory)}>{categoryList.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></Field><Field label="Intention"><input value={editGoal} onChange={(event) => setEditGoal(event.target.value)} /></Field><Field label="Notes"><textarea rows={4} value={editNotes} onChange={(event) => setEditNotes(event.target.value)} /></Field><Field label="Duration in minutes"><input type="number" min="0" value={editSeconds} onChange={(event) => setEditSeconds(event.target.value)} /></Field><div className="modal-actions"><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><SubmitButton busy={update.isPending} onClick={() => update.mutate({ id: editing.id, data: { pieceId: editPieceId ? Number(editPieceId) : null, startedAt: editStartedAt ? new Date(editStartedAt).toISOString() : undefined, category: editCategory, goal: editGoal, notes: editNotes, elapsedSeconds: Math.max(0, Number(editSeconds) || 0) * 60 } }, { onSuccess: () => { invalidate(); setEditing(null); } })}>Save changes</SubmitButton></div></Modal>}
  </div>;
}
