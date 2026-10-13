import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import {
  db,
  practiceSessionsTable,
  repertoireTable,
} from "@workspace/db";

export type SessionWithPiece = {
  session: typeof practiceSessionsTable.$inferSelect;
  pieceTitle: string | null;
};

export type PieceWithTotals = {
  piece: typeof repertoireTable.$inferSelect;
  totalPracticeSeconds: number;
  sessionCount: number;
};

export function toSession(row: SessionWithPiece) {
  const currentElapsed =
    row.session.status === "running" && row.session.activeSince
      ? Math.max(
          0,
          Math.floor(
            (Date.now() - row.session.activeSince.getTime()) / 1000,
          ),
        )
      : 0;

  return {
    id: row.session.id,
    status: row.session.status as "running" | "paused" | "completed",
    startedAt: row.session.startedAt.toISOString(),
    finishedAt: row.session.finishedAt?.toISOString() ?? null,
    elapsedSeconds: row.session.elapsedSeconds + currentElapsed,
    activeSince: row.session.activeSince?.toISOString() ?? null,
    pieceId: row.session.pieceId,
    pieceTitle: row.pieceTitle,
    category: row.session.category as
      | "technique"
      | "scales"
      | "intonation"
      | "bowing"
      | "sight-reading"
      | "repertoire"
      | "memorisation"
      | "other",
    notes: row.session.notes,
    goal: row.session.goal,
    createdAt: row.session.createdAt.toISOString(),
  };
}

export function toPiece(row: PieceWithTotals) {
  return {
    id: row.piece.id,
    title: row.piece.title,
    composer: row.piece.composer,
    status: row.piece.status as
      | "learning"
      | "polishing"
      | "performance-ready"
      | "completed",
    difficulty: row.piece.difficulty,
    focusAreas: row.piece.focusAreas,
    notes: row.piece.notes,
    targetPerformanceDate: row.piece.targetPerformanceDate,
    totalPracticeSeconds: Number(row.totalPracticeSeconds ?? 0),
    sessionCount: Number(row.sessionCount ?? 0),
    progress: row.piece.progress,
    archived: row.piece.archived,
    createdAt: row.piece.createdAt.toISOString(),
  };
}

export async function getSessionWithPiece(id: number) {
  const [row] = await db
    .select({
      session: practiceSessionsTable,
      pieceTitle: repertoireTable.title,
    })
    .from(practiceSessionsTable)
    .leftJoin(
      repertoireTable,
      eq(practiceSessionsTable.pieceId, repertoireTable.id),
    )
    .where(eq(practiceSessionsTable.id, id))
    .limit(1);

  return row ?? null;
}

export async function getSessionRows(options?: {
  from?: string;
  to?: string;
  pieceId?: number;
  category?: string;
  includeActive?: boolean;
}) {
  const conditions = [];

  if (!options?.includeActive) {
    conditions.push(eq(practiceSessionsTable.status, "completed"));
  }
  if (options?.from) {
    conditions.push(
      gte(
        practiceSessionsTable.startedAt,
        new Date(`${options.from}T00:00:00.000Z`),
      ),
    );
  }
  if (options?.to) {
    const exclusiveEnd = new Date(`${options.to}T00:00:00.000Z`);
    exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);
    conditions.push(lt(practiceSessionsTable.startedAt, exclusiveEnd));
  }
  if (options?.pieceId !== undefined) {
    conditions.push(eq(practiceSessionsTable.pieceId, options.pieceId));
  }
  if (options?.category) {
    conditions.push(eq(practiceSessionsTable.category, options.category));
  }

  return db
    .select({
      session: practiceSessionsTable,
      pieceTitle: repertoireTable.title,
    })
    .from(practiceSessionsTable)
    .leftJoin(
      repertoireTable,
      eq(practiceSessionsTable.pieceId, repertoireTable.id),
    )
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(practiceSessionsTable.startedAt));
}

export async function getCompletedSessionRows() {
  return db
    .select({
      session: practiceSessionsTable,
      pieceTitle: repertoireTable.title,
    })
    .from(practiceSessionsTable)
    .leftJoin(
      repertoireTable,
      eq(practiceSessionsTable.pieceId, repertoireTable.id),
    )
    .where(eq(practiceSessionsTable.status, "completed"))
    .orderBy(desc(practiceSessionsTable.startedAt));
}

export async function getPieceRows(includeArchived = false) {
  const conditions = includeArchived ? undefined : eq(repertoireTable.archived, false);

  return db
    .select({
      piece: repertoireTable,
      totalPracticeSeconds:
        sql<number>`coalesce(sum(${practiceSessionsTable.elapsedSeconds}), 0)`.mapWith(
          Number,
        ),
      sessionCount: sql<number>`count(${practiceSessionsTable.id})`.mapWith(
        Number,
      ),
    })
    .from(repertoireTable)
    .leftJoin(
      practiceSessionsTable,
      and(
        eq(practiceSessionsTable.pieceId, repertoireTable.id),
        eq(practiceSessionsTable.status, "completed"),
      ),
    )
    .where(conditions)
    .groupBy(repertoireTable.id)
    .orderBy(desc(repertoireTable.createdAt));
}

export function todayDateString(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export function asDateString(value: string | Date) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}

export function weekStartDate(dateString: string) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  const day = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - (day === 0 ? 6 : day - 1));
  return date.toISOString().slice(0, 10);
}

export function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function dateOfSession(row: SessionWithPiece) {
  return row.session.startedAt.toISOString().slice(0, 10);
}
