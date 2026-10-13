import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  db,
  practiceGoalsTable,
  repertoireTable,
} from "@workspace/db";
import {
  CreatePracticeGoalBody,
  CreatePracticeGoalResponse,
  DeletePracticeGoalParams,
  GetPracticeAchievementsResponse,
  GetPracticeGoalsResponse,
  UpdatePracticeGoalBody,
  UpdatePracticeGoalParams,
  UpdatePracticeGoalResponse,
} from "@workspace/api-zod";
import {
  getCompletedSessionRows,
  todayDateString,
} from "../lib/violin-data";
import { buildAchievements, toGoal } from "../lib/violin-metrics";

const router: IRouter = Router();
const goalLimits: Record<string, number> = {
  "daily-minutes": 120,
  "weekly-minutes": 600,
  "piece-minutes": 10000,
  "session-count": 6,
};

async function getGoalRows() {
  return db
    .select({
      goal: practiceGoalsTable,
      pieceTitle: repertoireTable.title,
    })
    .from(practiceGoalsTable)
    .leftJoin(
      repertoireTable,
      eq(practiceGoalsTable.pieceId, repertoireTable.id),
    )
    .orderBy(practiceGoalsTable.id);
}

router.get("/violin/goals", async (_req, res): Promise<void> => {
  const [goals, sessions] = await Promise.all([
    getGoalRows(),
    getCompletedSessionRows(),
  ]);
  const today = todayDateString();
  res.json(
    GetPracticeGoalsResponse.parse(
      goals.map((goal) => toGoal(goal, sessions, today)),
    ),
  );
});

router.post("/violin/goals", async (req, res): Promise<void> => {
  const parsed = CreatePracticeGoalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (parsed.data.targetValue > goalLimits[parsed.data.type]) {
    res.status(400).json({
      error: `This goal can be at most ${goalLimits[parsed.data.type]} ${parsed.data.type === "session-count" ? "sessions" : "minutes"}.`,
    });
    return;
  }

  if (parsed.data.type === "piece-minutes" && parsed.data.pieceId == null) {
    res.status(400).json({ error: "Choose a piece for a piece practice goal." });
    return;
  }
  if (parsed.data.pieceId != null) {
    const [piece] = await db
      .select({ id: repertoireTable.id })
      .from(repertoireTable)
      .where(eq(repertoireTable.id, parsed.data.pieceId))
      .limit(1);
    if (!piece) {
      res.status(400).json({ error: "The selected repertoire piece does not exist." });
      return;
    }
  }

  const [created] = await db
    .insert(practiceGoalsTable)
    .values({
      type: parsed.data.type,
      targetValue: parsed.data.targetValue,
      pieceId: parsed.data.pieceId ?? null,
      active: parsed.data.active ?? true,
    })
    .returning({ id: practiceGoalsTable.id });
  const [goal] = await getGoalRows().then((rows) =>
    rows.filter((row) => row.goal.id === created.id),
  );
  const sessions = await getCompletedSessionRows();
  res
    .status(201)
    .json(
      CreatePracticeGoalResponse.parse(
        toGoal(goal, sessions, todayDateString()),
      ),
    );
});

router.patch("/violin/goals/:id", async (req, res): Promise<void> => {
  const params = UpdatePracticeGoalParams.safeParse(req.params);
  const parsed = UpdatePracticeGoalBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (parsed.data.type === "piece-minutes" && parsed.data.pieceId == null) {
    res.status(400).json({ error: "Choose a piece for a piece practice goal." });
    return;
  }
  if (parsed.data.pieceId != null) {
    const [piece] = await db
      .select({ id: repertoireTable.id })
      .from(repertoireTable)
      .where(eq(repertoireTable.id, parsed.data.pieceId))
      .limit(1);
    if (!piece) {
      res.status(400).json({ error: "The selected repertoire piece does not exist." });
      return;
    }
  }

  const values: Partial<typeof practiceGoalsTable.$inferInsert> = {};
  if (parsed.data.type !== undefined) values.type = parsed.data.type;
  if (parsed.data.targetValue !== undefined) {
    values.targetValue = parsed.data.targetValue;
  }
  if ("pieceId" in parsed.data) values.pieceId = parsed.data.pieceId ?? null;
  if (parsed.data.active !== undefined) values.active = parsed.data.active;

  const [updated] = await db
    .update(practiceGoalsTable)
    .set(values)
    .where(eq(practiceGoalsTable.id, params.data.id))
    .returning({ id: practiceGoalsTable.id });
  if (!updated) {
    res.status(404).json({ error: "Practice goal not found." });
    return;
  }

  const [goal] = await getGoalRows().then((rows) =>
    rows.filter((row) => row.goal.id === updated.id),
  );
  const sessions = await getCompletedSessionRows();
  res.json(
    UpdatePracticeGoalResponse.parse(
      toGoal(goal, sessions, todayDateString()),
    ),
  );
});

router.delete("/violin/goals/:id", async (req, res): Promise<void> => {
  const params = DeletePracticeGoalParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(practiceGoalsTable)
    .where(eq(practiceGoalsTable.id, params.data.id))
    .returning({ id: practiceGoalsTable.id });
  if (!deleted) {
    res.status(404).json({ error: "Practice goal not found." });
    return;
  }
  res.sendStatus(204);
});

router.get("/violin/achievements", async (_req, res): Promise<void> => {
  const sessions = await getCompletedSessionRows();
  res.json(
    GetPracticeAchievementsResponse.parse(buildAchievements(sessions)),
  );
});

export default router;
