import { and, asc, eq, gte, lte } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  db,
  practicePlansTable,
  repertoireTable,
} from "@workspace/db";
import {
  CreatePracticePlanBody,
  CreatePracticePlanResponse,
  DeletePracticePlanParams,
  GetPracticePlanSummaryQueryParams,
  GetPracticePlanSummaryResponse,
  GetPracticePlansQueryParams,
  GetPracticePlansResponse,
  UpdatePracticePlanBody,
  UpdatePracticePlanParams,
  UpdatePracticePlanResponse,
} from "@workspace/api-zod";
import {
  asDateString,
  dateOfSession,
  getCompletedSessionRows,
} from "../lib/violin-data";
import { normalizeDateRangeQuery } from "../lib/query-utils";

const router: IRouter = Router();

function toPlan(row: {
  plan: typeof practicePlansTable.$inferSelect;
  pieceTitle: string | null;
}) {
  return {
    id: row.plan.id,
    date: row.plan.date,
    pieceId: row.plan.pieceId,
    pieceTitle: row.pieceTitle,
    category: row.plan.category as
      | "technique"
      | "scales"
      | "intonation"
      | "bowing"
      | "sight-reading"
      | "repertoire"
      | "memorisation"
      | "other",
    plannedMinutes: row.plan.plannedMinutes,
    goal: row.plan.goal,
    completed: row.plan.completed,
    createdAt: row.plan.createdAt.toISOString(),
  };
}

async function getPlanRow(id: number) {
  const [row] = await db
    .select({
      plan: practicePlansTable,
      pieceTitle: repertoireTable.title,
    })
    .from(practicePlansTable)
    .leftJoin(
      repertoireTable,
      eq(practicePlansTable.pieceId, repertoireTable.id),
    )
    .where(eq(practicePlansTable.id, id))
    .limit(1);
  return row ?? null;
}

router.get("/violin/plans", async (req, res): Promise<void> => {
  const query = GetPracticePlansQueryParams.safeParse(
    normalizeDateRangeQuery(req.query),
  );
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const rows = await db
    .select({
      plan: practicePlansTable,
      pieceTitle: repertoireTable.title,
    })
    .from(practicePlansTable)
    .leftJoin(
      repertoireTable,
      eq(practicePlansTable.pieceId, repertoireTable.id),
    )
    .where(
      and(
        gte(practicePlansTable.date, asDateString(query.data.from)),
        lte(practicePlansTable.date, asDateString(query.data.to)),
      ),
    )
    .orderBy(asc(practicePlansTable.date), asc(practicePlansTable.id));
  res.json(GetPracticePlansResponse.parse(rows.map(toPlan)));
});

router.post("/violin/plans", async (req, res): Promise<void> => {
  const parsed = CreatePracticePlanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
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
    .insert(practicePlansTable)
    .values({
      date: asDateString(parsed.data.date),
      pieceId: parsed.data.pieceId ?? null,
      category: parsed.data.category,
      plannedMinutes: parsed.data.plannedMinutes,
      goal: parsed.data.goal ?? "",
      completed: parsed.data.completed ?? false,
    })
    .returning({ id: practicePlansTable.id });
  const plan = await getPlanRow(created.id);
  res
    .status(201)
    .json(CreatePracticePlanResponse.parse(toPlan(plan!)));
});

router.get("/violin/plans/summary", async (req, res): Promise<void> => {
  const query = GetPracticePlanSummaryQueryParams.safeParse(
    normalizeDateRangeQuery(req.query),
  );
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const [plans, sessions] = await Promise.all([
    db
      .select()
      .from(practicePlansTable)
      .where(
        and(
          gte(practicePlansTable.date, asDateString(query.data.from)),
          lte(practicePlansTable.date, asDateString(query.data.to)),
        ),
      ),
    getCompletedSessionRows(),
  ]);
  const actual = sessions.filter((item) => {
    const day = dateOfSession(item);
    return (
      day >= asDateString(query.data.from) &&
      day <= asDateString(query.data.to)
    );
  });
  res.json(
    GetPracticePlanSummaryResponse.parse({
      plannedSeconds: plans.reduce(
        (total, plan) => total + plan.plannedMinutes * 60,
        0,
      ),
      actualSeconds: actual.reduce(
        (total, item) => total + item.session.elapsedSeconds,
        0,
      ),
      blocks: plans.length,
      completedBlocks: plans.filter((plan) => plan.completed).length,
    }),
  );
});

router.patch("/violin/plans/:id", async (req, res): Promise<void> => {
  const params = UpdatePracticePlanParams.safeParse(req.params);
  const parsed = UpdatePracticePlanBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
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

  const values: Partial<typeof practicePlansTable.$inferInsert> = {};
  if (parsed.data.date !== undefined) {
    values.date = asDateString(parsed.data.date);
  }
  if ("pieceId" in parsed.data) values.pieceId = parsed.data.pieceId ?? null;
  if (parsed.data.category !== undefined) values.category = parsed.data.category;
  if (parsed.data.plannedMinutes !== undefined) {
    values.plannedMinutes = parsed.data.plannedMinutes;
  }
  if (parsed.data.goal !== undefined) values.goal = parsed.data.goal;
  if (parsed.data.completed !== undefined) {
    values.completed = parsed.data.completed;
  }

  const [updated] = await db
    .update(practicePlansTable)
    .set(values)
    .where(eq(practicePlansTable.id, params.data.id))
    .returning({ id: practicePlansTable.id });
  if (!updated) {
    res.status(404).json({ error: "Planned practice block not found." });
    return;
  }
  const plan = await getPlanRow(updated.id);
  res.json(UpdatePracticePlanResponse.parse(toPlan(plan!)));
});

router.delete("/violin/plans/:id", async (req, res): Promise<void> => {
  const params = DeletePracticePlanParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db
    .delete(practicePlansTable)
    .where(eq(practicePlansTable.id, params.data.id))
    .returning({ id: practicePlansTable.id });
  if (!deleted) {
    res.status(404).json({ error: "Planned practice block not found." });
    return;
  }
  res.sendStatus(204);
});

export default router;
