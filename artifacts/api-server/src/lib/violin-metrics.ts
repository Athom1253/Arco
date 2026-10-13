import {
  addDays,
  dateOfSession,
  type SessionWithPiece,
  todayDateString,
  weekStartDate,
} from "./violin-data";

type GoalWithPiece = {
  goal: {
    id: number;
    type: string;
    targetValue: number;
    pieceId: number | null;
    active: boolean;
    createdAt: Date;
  };
  pieceTitle: string | null;
};

export function toGoal(
  row: GoalWithPiece,
  sessions: SessionWithPiece[],
  today = todayDateString(),
) {
  let periodStart = today;
  let periodEnd = today;

  if (row.goal.type === "weekly-minutes") {
    periodStart = weekStartDate(today);
    periodEnd = addDays(periodStart, 6);
  } else if (row.goal.type === "piece-minutes") {
    periodStart = row.goal.createdAt.toISOString().slice(0, 10);
  }

  const filtered = sessions.filter((item) => {
    const date = dateOfSession(item);
    return (
      date >= periodStart &&
      date <= periodEnd &&
      (row.goal.type !== "piece-minutes" ||
        item.session.pieceId === row.goal.pieceId)
    );
  });
  const currentValue =
    row.goal.type === "session-count"
      ? filtered.length
      : Math.floor(
          filtered.reduce(
            (total, item) => total + item.session.elapsedSeconds,
            0,
          ) / 60,
        );

  return {
    id: row.goal.id,
    type: row.goal.type as
      | "daily-minutes"
      | "weekly-minutes"
      | "piece-minutes"
      | "session-count",
    targetValue: row.goal.targetValue,
    pieceId: row.goal.pieceId,
    pieceTitle: row.pieceTitle,
    active: row.goal.active,
    currentValue,
    periodStart,
    periodEnd,
  };
}

function firstSessionAtCount(sessions: SessionWithPiece[], target: number) {
  return sessions[target - 1]?.session.finishedAt?.toISOString() ?? null;
}

function firstTimeAtSeconds(sessions: SessionWithPiece[], target: number) {
  let accumulated = 0;
  for (const item of sessions) {
    accumulated += item.session.elapsedSeconds;
    if (accumulated >= target) {
      return (
        item.session.finishedAt?.toISOString() ??
        item.session.startedAt.toISOString()
      );
    }
  }
  return null;
}

function streakMilestones(sessions: SessionWithPiece[]) {
  const days = [
    ...new Set(sessions.map((item) => dateOfSession(item))),
  ].sort();
  const earned: Record<number, string | null> = { 3: null, 7: null };
  const earnedAtByDay = new Map<string, string>();
  for (const item of sessions) {
    const day = dateOfSession(item);
    const earnedAt =
      item.session.finishedAt?.toISOString() ??
      item.session.startedAt.toISOString();
    const current = earnedAtByDay.get(day);
    if (!current || earnedAt < current) earnedAtByDay.set(day, earnedAt);
  }
  let run = 0;
  let previous: string | undefined;

  for (const day of days) {
    run = previous && addDays(previous, 1) === day ? run + 1 : 1;
    if (run >= 3 && !earned[3]) earned[3] = earnedAtByDay.get(day) ?? null;
    if (run >= 7 && !earned[7]) earned[7] = earnedAtByDay.get(day) ?? null;
    previous = day;
  }

  return {
    bestStreak: longestStreak(days),
    earned,
  };
}

function longestStreak(days: string[]) {
  let longest = 0;
  let run = 0;
  let previous: string | undefined;
  for (const day of days) {
    run = previous && addDays(previous, 1) === day ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = day;
  }
  return longest;
}

export function buildAchievements(sessions: SessionWithPiece[]) {
  const ordered = [...sessions].sort(
    (a, b) =>
      a.session.startedAt.getTime() - b.session.startedAt.getTime(),
  );
  const totalSeconds = ordered.reduce(
    (total, item) => total + item.session.elapsedSeconds,
    0,
  );
  const streaks = streakMilestones(ordered);

  return [
    {
      key: "first-session",
      title: "First notes",
      description: "Complete your first practice session.",
      progress: Math.min(ordered.length, 1),
      target: 1,
      earnedAt: firstSessionAtCount(ordered, 1),
    },
    {
      key: "ten-sessions",
      title: "Finding your rhythm",
      description: "Complete 10 practice sessions.",
      progress: Math.min(ordered.length, 10),
      target: 10,
      earnedAt: firstSessionAtCount(ordered, 10),
    },
    {
      key: "twenty-hours",
      title: "Twenty focused hours",
      description: "Spend 20 hours in completed practice sessions.",
      progress: Math.min(Math.floor(totalSeconds / 3600), 20),
      target: 20,
      earnedAt: firstTimeAtSeconds(ordered, 20 * 60 * 60),
    },
    {
      key: "three-day-streak",
      title: "Three-day thread",
      description: "Practice on three consecutive days.",
      progress: Math.min(streaks.bestStreak, 3),
      target: 3,
      earnedAt: streaks.earned[3],
    },
    {
      key: "seven-day-streak",
      title: "A week of music",
      description: "Practice on seven consecutive days.",
      progress: Math.min(streaks.bestStreak, 7),
      target: 7,
      earnedAt: streaks.earned[7],
    },
  ];
}

export function currentStreak(sessions: SessionWithPiece[], today = todayDateString()) {
  const practiceDays = new Set(sessions.map(dateOfSession));
  let cursor = practiceDays.has(today) ? today : addDays(today, -1);
  let streak = 0;

  while (practiceDays.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return streak;
}

export function buildStatistics(
  sessions: SessionWithPiece[],
  from: string,
  to: string,
) {
  const inRange = sessions.filter((item) => {
    const day = dateOfSession(item);
    return day >= from && day <= to;
  });
  const totalsByDay = new Map<string, { seconds: number; sessionCount: number }>();
  const totalsByPiece = new Map<
    string,
    { pieceId: number | null; title: string; seconds: number; sessionCount: number }
  >();
  const totalsByCategory = new Map<
    string,
    { category: string; seconds: number; sessionCount: number }
  >();

  for (const item of inRange) {
    const day = dateOfSession(item);
    const seconds = item.session.elapsedSeconds;
    const dayTotals = totalsByDay.get(day) ?? { seconds: 0, sessionCount: 0 };
    dayTotals.seconds += seconds;
    dayTotals.sessionCount += 1;
    totalsByDay.set(day, dayTotals);

    const pieceKey = item.session.pieceId == null
      ? "none"
      : String(item.session.pieceId);
    const pieceTotals = totalsByPiece.get(pieceKey) ?? {
      pieceId: item.session.pieceId,
      title: item.pieceTitle ?? "No piece selected",
      seconds: 0,
      sessionCount: 0,
    };
    pieceTotals.seconds += seconds;
    pieceTotals.sessionCount += 1;
    totalsByPiece.set(pieceKey, pieceTotals);

    const categoryTotals = totalsByCategory.get(item.session.category) ?? {
      category: item.session.category,
      seconds: 0,
      sessionCount: 0,
    };
    categoryTotals.seconds += seconds;
    categoryTotals.sessionCount += 1;
    totalsByCategory.set(item.session.category, categoryTotals);
  }

  const daily = [];
  let date = from;
  while (date <= to) {
    const totals = totalsByDay.get(date);
    daily.push({
      date,
      seconds: totals?.seconds ?? 0,
      sessionCount: totals?.sessionCount ?? 0,
    });
    date = addDays(date, 1);
  }

  const totalSeconds = inRange.reduce(
    (total, item) => total + item.session.elapsedSeconds,
    0,
  );
  const dayCount = Math.max(
    1,
    Math.floor(
      (new Date(`${to}T00:00:00.000Z`).getTime() -
        new Date(`${from}T00:00:00.000Z`).getTime()) /
        86_400_000,
    ) + 1,
  );
  const bestDay = daily.reduce<(typeof daily)[number] | null>(
    (best, current) =>
      current.seconds > 0 && (!best || current.seconds > best.seconds)
        ? current
        : best,
    null,
  );

  return {
    totalSeconds,
    sessionCount: inRange.length,
    averageDailySeconds: Math.floor(totalSeconds / dayCount),
    bestDay,
    daily,
    byPiece: [...totalsByPiece.values()].sort(
      (a, b) => b.seconds - a.seconds,
    ),
    byCategory: [...totalsByCategory.values()].sort(
      (a, b) => b.seconds - a.seconds,
    ),
  };
}

export function dateInRange(date: string, from: string, to: string) {
  return date >= from && date <= to;
}
