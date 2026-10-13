import { and, desc, eq, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  db,
  practiceSessionsTable,
  repertoireTable,
} from "@workspace/db";
import {
  DeletePracticeSessionParams,
  FinishPracticeSessionBody,
  FinishPracticeSessionParams,
  FinishPracticeSessionResponse,
  GetActivePracticeSessionResponse,
  GetPracticeSessionsQueryParams,
  GetPracticeSessionsResponse,
  PausePracticeSessionParams,
  PausePracticeSessionResponse,
  ResumePracticeSessionParams,
  ResumePracticeSessionResponse,
  StartPracticeSessionBody,
  StartPracticeSessionResponse,
  UpdatePracticeSessionBody,
  UpdatePracticeSessionParams,
  UpdatePracticeSessionResponse,
} from "@workspace/api-zod";
import {
  asDateString,
  getSessionRows,
  getSessionWithPiece,
  toSession,
} from "../lib/violin-data";

const router: IRouter = Router();

router.get("/violin/sessions/active", async (_req, res): Promise<void> => {
  const [row] = await db
    .select({ id: practiceSessionsTable.id })
    .from(practiceSessionsTable)
    .where(sql`${practiceSessionsTable.status} in ('running', 'paused')`)
    .orderBy(desc(practiceSessionsTable.id))
    .limit(1);

  const session = row ? await getSessionWithPiece(row.id) : null;
  res.json(
    GetActivePracticeSessionResponse.parse({
      session: session ? toSession(session) : null,
    }),
  );
});

router.get("/violin/sessions", async (req, res): Promise<void> => {
  const query = GetPracticeSessionsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const rows = await getSessionRows({
    from: query.data.from ? asDateString(query.data.from) : undefined,
    to: query.data.to ? asDateString(query.data.to) : undefined,
    pieceId: query.data.pieceId,
    category: query.data.category,
  });
  res.json(GetPracticeSessionsResponse.parse(rows.map(toSession)));
});

router.post("/violin/sessions", async (req, res): Promise<void> => {
  const parsed = StartPracticeSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [active] = await db
    .select({ id: practiceSessionsTable.id })
    .from(practiceSessionsTable)
    .where(sql`${practiceSessionsTable.status} in ('running', 'paused')`)
    .limit(1);
  if (active) {
    res.status(409).json({ error: "Finish or discard the active session first." });
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

  const now = new Date();
  const [created] = await db
    .insert(practiceSessionsTable)
    .values({
      status: "running",
      startedAt: now,
      activeSince: now,
      pieceId: parsed.data.pieceId ?? null,
      category: parsed.data.category,
      goal: parsed.data.goal ?? "",
    })
    .returning({ id: practiceSessionsTable.id });
  const session = await getSessionWithPiece(created.id);

  res.status(201).json(StartPracticeSessionResponse.parse(toSession(session!)));
});

router.patch("/violin/sessions/:id", async (req, res): Promise<void> => {
  const params = UpdatePracticeSessionParams.safeParse(req.params);
  const parsed = UpdatePracticeSessionBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const current = await getSessionWithPiece(params.data.id);
  if (!current) {
    res.status(404).json({ error: "Practice session not found." });
    return;
  }
  if (
    parsed.data.pieceId != null &&
    parsed.data.pieceId !== current.session.pieceId
  ) {
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

  const values: Partial<typeof practiceSessionsTable.$inferInsert> = {};
  if ("pieceId" in parsed.data) values.pieceId = parsed.data.pieceId ?? null;
  if (parsed.data.category !== undefined) values.category = parsed.data.category;
  if (parsed.data.notes !== undefined) values.notes = parsed.data.notes;
  if (parsed.data.goal !== undefined) values.goal = parsed.data.goal;
  if (parsed.data.startedAt !== undefined) {
    values.startedAt = new Date(parsed.data.startedAt);
  }
  if (parsed.data.elapsedSeconds !== undefined) {
    values.elapsedSeconds = parsed.data.elapsedSeconds;
  }

  await db
    .update(practiceSessionsTable)
    .set(values)
    .where(eq(practiceSessionsTable.id, params.data.id));
  const updated = await getSessionWithPiece(params.data.id);
  res.json(
    UpdatePracticeSessionResponse.parse(toSession(updated!)),
  );
});

router.delete("/violin/sessions/:id", async (req, res): Promise<void> => {
  const params = DeletePracticeSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(practiceSessionsTable)
    .where(eq(practiceSessionsTable.id, params.data.id))
    .returning({ id: practiceSessionsTable.id });
  if (!deleted) {
    res.status(404).json({ error: "Practice session not found." });
    return;
  }

  res.sendStatus(204);
});

router.post("/violin/sessions/:id/pause", async (req, res): Promise<void> => {
  const params = PausePracticeSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const current = await getSessionWithPiece(params.data.id);
  if (!current) {
    res.status(404).json({ error: "Practice session not found." });
    return;
  }
  if (current.session.status !== "running" || !current.session.activeSince) {
    res.status(409).json({ error: "Only a running session can be paused." });
    return;
  }

  const elapsed =
    current.session.elapsedSeconds +
    Math.max(
      0,
      Math.floor((Date.now() - current.session.activeSince.getTime()) / 1000),
    );
  await db
    .update(practiceSessionsTable)
    .set({ status: "paused", elapsedSeconds: elapsed, activeSince: null })
    .where(
      and(
        eq(practiceSessionsTable.id, params.data.id),
        eq(practiceSessionsTable.status, "running"),
      ),
    );
  const updated = await getSessionWithPiece(params.data.id);
  res.json(PausePracticeSessionResponse.parse(toSession(updated!)));
});

router.post("/violin/sessions/:id/resume", async (req, res): Promise<void> => {
  const params = ResumePracticeSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const current = await getSessionWithPiece(params.data.id);
  if (!current) {
    res.status(404).json({ error: "Practice session not found." });
    return;
  }
  if (current.session.status !== "paused") {
    res.status(409).json({ error: "Only a paused session can be resumed." });
    return;
  }

  await db
    .update(practiceSessionsTable)
    .set({ status: "running", activeSince: new Date() })
    .where(
      and(
        eq(practiceSessionsTable.id, params.data.id),
        eq(practiceSessionsTable.status, "paused"),
      ),
    );
  const updated = await getSessionWithPiece(params.data.id);
  res.json(ResumePracticeSessionResponse.parse(toSession(updated!)));
});

router.post("/violin/sessions/:id/finish", async (req, res): Promise<void> => {
  const params = FinishPracticeSessionParams.safeParse(req.params);
  const parsed = FinishPracticeSessionBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const current = await getSessionWithPiece(params.data.id);
  if (!current) {
    res.status(404).json({ error: "Practice session not found." });
    return;
  }
  if (current.session.status === "completed") {
    res.status(409).json({ error: "This session has already been completed." });
    return;
  }

  const elapsed =
    current.session.elapsedSeconds +
    (current.session.status === "running" && current.session.activeSince
      ? Math.max(
          0,
          Math.floor(
            (Date.now() - current.session.activeSince.getTime()) / 1000,
          ),
        )
      : 0);
  await db
    .update(practiceSessionsTable)
    .set({
      status: "completed",
      finishedAt: new Date(),
      elapsedSeconds: elapsed,
      activeSince: null,
      notes: parsed.data.notes,
    })
    .where(eq(practiceSessionsTable.id, params.data.id));
  const completed = await getSessionWithPiece(params.data.id);
  res.json(FinishPracticeSessionResponse.parse(toSession(completed!)));
});

export default router;
