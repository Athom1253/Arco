import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, repertoireTable } from "@workspace/db";
import {
  CreateRepertoirePieceBody,
  CreateRepertoirePieceResponse,
  DeleteRepertoirePieceParams,
  GetRepertoireQueryParams,
  GetRepertoireResponse,
  UpdateRepertoirePieceBody,
  UpdateRepertoirePieceParams,
  UpdateRepertoirePieceResponse,
} from "@workspace/api-zod";
import { asDateString, getPieceRows, toPiece } from "../lib/violin-data";
import { normalizeBooleanQuery } from "../lib/query-utils";

const router: IRouter = Router();

router.get("/violin/repertoire", async (req, res): Promise<void> => {
  const includeArchived = req.query.includeArchived;
  if (
    includeArchived !== undefined &&
    (typeof includeArchived !== "string" ||
      !["true", "false"].includes(includeArchived))
  ) {
    res.status(400).json({ error: "includeArchived must be true or false." });
    return;
  }
  const query = GetRepertoireQueryParams.safeParse(
    normalizeBooleanQuery(req.query, "includeArchived"),
  );
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const rows = await getPieceRows(query.data.includeArchived);
  res.json(GetRepertoireResponse.parse(rows.map(toPiece)));
});

router.post("/violin/repertoire", async (req, res): Promise<void> => {
  const parsed = CreateRepertoirePieceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [created] = await db
    .insert(repertoireTable)
    .values({
      title: parsed.data.title,
      composer: parsed.data.composer,
      status: parsed.data.status,
      difficulty: parsed.data.difficulty,
      focusAreas: parsed.data.focusAreas ?? [],
      notes: parsed.data.notes ?? "",
      targetPerformanceDate: parsed.data.targetPerformanceDate
        ? asDateString(parsed.data.targetPerformanceDate)
        : null,
      progress: parsed.data.progress ?? 0,
      archived: parsed.data.archived ?? false,
    })
    .returning({ id: repertoireTable.id });
  const [row] = await getPieceRows(true).then((rows) =>
    rows.filter((item) => item.piece.id === created.id),
  );

  res.status(201).json(CreateRepertoirePieceResponse.parse(toPiece(row)));
});

router.patch("/violin/repertoire/:id", async (req, res): Promise<void> => {
  const params = UpdateRepertoirePieceParams.safeParse(req.params);
  const parsed = UpdateRepertoirePieceBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const values: Partial<typeof repertoireTable.$inferInsert> = {};
  if (parsed.data.title !== undefined) values.title = parsed.data.title;
  if (parsed.data.composer !== undefined) values.composer = parsed.data.composer;
  if (parsed.data.status !== undefined) values.status = parsed.data.status;
  if (parsed.data.difficulty !== undefined) {
    values.difficulty = parsed.data.difficulty;
  }
  if (parsed.data.focusAreas !== undefined) {
    values.focusAreas = parsed.data.focusAreas;
  }
  if (parsed.data.notes !== undefined) values.notes = parsed.data.notes;
  if ("targetPerformanceDate" in parsed.data) {
    values.targetPerformanceDate = parsed.data.targetPerformanceDate
      ? asDateString(parsed.data.targetPerformanceDate)
      : null;
  }
  if (parsed.data.progress !== undefined) values.progress = parsed.data.progress;
  if (parsed.data.archived !== undefined) values.archived = parsed.data.archived;

  const [updated] = await db
    .update(repertoireTable)
    .set(values)
    .where(eq(repertoireTable.id, params.data.id))
    .returning({ id: repertoireTable.id });
  if (!updated) {
    res.status(404).json({ error: "Repertoire piece not found." });
    return;
  }

  const [row] = await getPieceRows(true).then((rows) =>
    rows.filter((item) => item.piece.id === updated.id),
  );
  res.json(UpdateRepertoirePieceResponse.parse(toPiece(row)));
});

router.delete("/violin/repertoire/:id", async (req, res): Promise<void> => {
  const params = DeleteRepertoirePieceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(repertoireTable)
    .where(eq(repertoireTable.id, params.data.id))
    .returning({ id: repertoireTable.id });
  if (!deleted) {
    res.status(404).json({ error: "Repertoire piece not found." });
    return;
  }

  res.sendStatus(204);
});

export default router;
