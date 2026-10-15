import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  db,
  practiceGoalsTable,
} from "@workspace/db";
import {
  GetPracticeCalendarQueryParams,
  GetPracticeCalendarResponse,
  GetViolinDashboardQueryParams,
  GetPracticeStatisticsQueryParams,
  GetPracticeStatisticsResponse,
  GetViolinDashboardResponse,
} from "@workspace/api-zod";
import {
  addDays,
  asDateString,
  dateOfSession,
  getCompletedSessionRows,
  getPieceRows,
  todayDateString,
  toPiece,
  toSession,
  weekStartDate,
} from "../lib/violin-data";
import { buildAchievements, buildStatistics, currentStreak } from "../lib/violin-metrics";
import {
  normalizeDateQuery,
  normalizeDateRangeQuery,
} from "../lib/query-utils";

const router: IRouter = Router();

router.get("/violin/dashboard", async (req, res): Promise<void> => {
  const query = GetViolinDashboardQueryParams.safeParse(
    normalizeDateQuery(req.query, "asOf"),
  );
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const [sessions, pieceRows, weeklyGoals] = await Promise.all([
    getCompletedSessionRows(),
    getPieceRows(false),
    db
      .select({ targetValue: practiceGoalsTable.targetValue })
      .from(practiceGoalsTable)
      .where(
        and(
          eq(practiceGoalsTable.type, "weekly-minutes"),
          eq(practiceGoalsTable.active, true),
        ),
      )
      .orderBy(desc(practiceGoalsTable.id))
      .limit(1),
  ]);

  const today = query.data.asOf
    ? asDateString(query.data.asOf)
    : todayDateString();
  const weekStart = weekStartDate(today);
  const pieces = pieceRows.map(toPiece);
  const recentSessions = sessions.slice(0, 5).map(toSession);
  const upcomingPerformances = pieces
    .filter(
      (piece) =>
        piece.targetPerformanceDate !== null &&
        piece.targetPerformanceDate >= today &&
        piece.targetPerformanceDate <= addDays(today, 90) &&
        piece.status !== "completed",
    )
    .sort((a, b) =>
      (a.targetPerformanceDate ?? "").localeCompare(
        b.targetPerformanceDate ?? "",
      ),
    )
    .slice(0, 4);

  res.json(
    GetViolinDashboardResponse.parse({
      todaySeconds: sessions
        .filter((session) => dateOfSession(session) === today)
        .reduce((total, item) => total + item.session.elapsedSeconds, 0),
      weekSeconds: sessions
        .filter((session) => dateOfSession(session) >= weekStart)
        .reduce((total, item) => total + item.session.elapsedSeconds, 0),
      weeklyGoalSeconds: (weeklyGoals[0]?.targetValue ?? 0) * 60,
      streakDays: currentStreak(sessions, today),
      recentSessions,
      repertoire: pieces.slice(0, 5),
      upcomingPerformances,
      achievements: buildAchievements(sessions),
    }),
  );
});

router.get("/violin/statistics", async (req, res): Promise<void> => {
  const query = GetPracticeStatisticsQueryParams.safeParse(
    normalizeDateRangeQuery(req.query),
  );
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const today = todayDateString();
  const from = query.data.from ? asDateString(query.data.from) : addDays(today, -29);
  const to = query.data.to ? asDateString(query.data.to) : today;
  if (from > to) {
    res.status(400).json({ error: "The start date must not be after the end date." });
    return;
  }

  const sessions = await getCompletedSessionRows();
  res.json(
    GetPracticeStatisticsResponse.parse(
      buildStatistics(sessions, from, to),
    ),
  );
});

router.get("/violin/calendar", async (req, res): Promise<void> => {
  const query = GetPracticeCalendarQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const [yearString, monthString] = query.data.month.split("-");
  const year = Number(yearString);
  const month = Number(monthString);
  if (month < 1 || month > 12) {
    res.status(400).json({ error: "Month must be between 01 and 12." });
    return;
  }
  const from = `${yearString}-${monthString}-01`;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const sessions = await getCompletedSessionRows();
  const stats = buildStatistics(
    sessions,
    from,
    `${yearString}-${monthString}-${String(daysInMonth).padStart(2, "0")}`,
  );
  const byDate = new Map(stats.daily.map((day) => [day.date, day]));
  const calendar = Array.from({ length: daysInMonth }, (_, index) => {
    const date = addDays(from, index);
    const day = byDate.get(date);
    return {
      date,
      seconds: day?.seconds ?? 0,
      sessionCount: day?.sessionCount ?? 0,
    };
  });
  res.json(GetPracticeCalendarResponse.parse(calendar));
});

export default router;
