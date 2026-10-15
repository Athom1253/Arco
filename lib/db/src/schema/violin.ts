import {
  boolean,
  date,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const repertoireTable = pgTable("violin_repertoire", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  composer: text("composer").notNull(),
  status: text("status").notNull(),
  difficulty: integer("difficulty").notNull(),
  focusAreas: text("focus_areas").array().notNull().default([]),
  notes: text("notes").notNull().default(""),
  targetPerformanceDate: date("target_performance_date", { mode: "string" }),
  progress: integer("progress").notNull().default(0),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const practiceSessionsTable = pgTable("violin_practice_sessions", {
  id: serial("id").primaryKey(),
  status: text("status").notNull().default("running"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  practiceDate: date("practice_date", { mode: "string" }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  elapsedSeconds: integer("elapsed_seconds").notNull().default(0),
  activeSince: timestamp("active_since", { withTimezone: true }),
  pieceId: integer("piece_id").references(() => repertoireTable.id, {
    onDelete: "set null",
  }),
  category: text("category").notNull(),
  notes: text("notes").notNull().default(""),
  goal: text("goal").notNull().default(""),
  source: text("source").notNull().default("timer"),
  focusAreas: text("focus_areas").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const practiceGoalsTable = pgTable("violin_practice_goals", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  targetValue: integer("target_value").notNull(),
  pieceId: integer("piece_id").references(() => repertoireTable.id, {
    onDelete: "set null",
  }),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const practicePlansTable = pgTable("violin_practice_plans", {
  id: serial("id").primaryKey(),
  date: date("date", { mode: "string" }).notNull(),
  pieceId: integer("piece_id").references(() => repertoireTable.id, {
    onDelete: "set null",
  }),
  category: text("category").notNull(),
  plannedMinutes: integer("planned_minutes").notNull(),
  goal: text("goal").notNull().default(""),
  completed: boolean("completed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
