import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Archive, ArrowUpRight, CalendarDays, Music2, Pencil, Plus, Trash2 } from 'lucide-react';
import { getGetRepertoireQueryKey, getGetViolinDashboardQueryKey, getGetActivePracticeSessionQueryKey, getGetPracticeGoalsQueryKey, useCreateRepertoirePiece, useDeleteRepertoirePiece, useGetRepertoire, useUpdateRepertoirePiece } from '@workspace/api-client-react';
import type { RepertoirePiece, RepertoirePieceInput, RepertoireStatus } from '@workspace/api-client-react';
import { Button, Card, EmptyState, Field, Modal, PageHeading, QueryState, SubmitButton } from '@/components/Primitives';
import { formatDuration, prettyDate, titleCase } from '@/lib/utils';

const statusList: RepertoireStatus[] = ['learning', 'polishing', 'performance-ready', 'completed'];
const blankPiece = (): RepertoirePieceInput => ({ title: '', composer: '', status: 'learning', difficulty: 3, focusAreas: [], notes: '', targetPerformanceDate: null, progress: 0, archived: false });

export default function Repertoire() {
  const client = useQueryClient();
  const [includeArchived, setIncludeArchived] = useState(false);
  const [editing, setEditing] = useState<RepertoirePiece | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<RepertoirePieceInput>(blankPiece());
  const [focusText, setFocusText] = useState('');
  const query = useGetRepertoire({ includeArchived });
  const create = useCreateRepertoirePiece();
  const update = useUpdateRepertoirePiece();
  const remove = useDeleteRepertoirePiece();
  const invalidate = () => {
    void client.invalidateQueries({ queryKey: getGetRepertoireQueryKey() });
    void client.invalidateQueries({ queryKey: getGetViolinDashboardQueryKey() });
    void client.invalidateQueries({ queryKey: getGetActivePracticeSessionQueryKey() });
    void client.invalidateQueries({ queryKey: getGetPracticeGoalsQueryKey() });
  };
  const openNew = () => {
    setEditing(null);
    setForm(blankPiece());
    setFocusText('');
    setCreating(true);
  };
  const openEdit = (piece: RepertoirePiece) => {
    setEditing(piece);
    setForm({ title: piece.title, composer: piece.composer, status: piece.status, difficulty: piece.difficulty, focusAreas: piece.focusAreas, notes: piece.notes, targetPerformanceDate: piece.targetPerformanceDate, progress: piece.progress, archived: piece.archived });
    setFocusText(piece.focusAreas.join(', '));
    setCreating(false);
  };
  const save = () => {
    const body = { ...form, title: form.title.trim(), composer: form.composer.trim(), focusAreas: focusText.split(',').map((part) => part.trim()).filter(Boolean) };
    if (!body.title || !body.composer) return;
    if (editing) update.mutate({ id: editing.id, data: body }, { onSuccess: () => { invalidate(); setEditing(null); } });
    else create.mutate({ data: body }, { onSuccess: () => { invalidate(); setCreating(false); } });
  };
  const archivePiece = (piece: RepertoirePiece) => update.mutate({ id: piece.id, data: { archived: !piece.archived } }, { onSuccess: invalidate });
  const busy = create.isPending || update.isPending;
  const data = query.data || [];

  return <div className="page-enter">
    <PageHeading eyebrow="WORKS IN PROGRESS" title="Your repertoire" subtitle="A living shelf of music you are learning, shaping, and carrying forward." action={<Button onClick={openNew}><Plus size={17} /> Add a piece</Button>} />
    <QueryState loading={query.isLoading} error={query.error} retry={() => query.refetch()} />
    {!query.isLoading && !query.error && <>
      <div className="collection-bar"><div><span className="eyebrow">THE MUSIC ON YOUR STAND</span><p>{data.length} {data.length === 1 ? 'piece' : 'pieces'}{includeArchived ? ' including archived' : ''}</p></div><button className={`archive-toggle ${includeArchived ? 'selected' : ''}`} onClick={() => setIncludeArchived(!includeArchived)}><Archive size={15} />{includeArchived ? 'Hide archived' : 'Show archived'}</button></div>
      {data.length ? <div className="repertoire-grid">{data.map((piece) => <Card className="repertoire-card" key={piece.id}><div className="piece-card-top"><span className={`status-label status-${piece.status}`}>{titleCase(piece.status)}</span><div className="row-actions"><button className="icon-button" aria-label={`Edit ${piece.title}`} onClick={() => openEdit(piece)}><Pencil size={16} /></button><button className="icon-button" aria-label={`${piece.archived ? 'Restore' : 'Archive'} ${piece.title}`} onClick={() => archivePiece(piece)}><Archive size={16} /></button><button className="icon-button danger-icon" aria-label={`Delete ${piece.title}`} onClick={() => { if (window.confirm(`Delete ${piece.title} from your repertoire?`)) remove.mutate({ id: piece.id }, { onSuccess: invalidate }); }}><Trash2 size={16} /></button></div></div><div className="piece-title-art"><div className="piece-initial"><Music2 size={22} /></div><div><h2>{piece.title}</h2><span>{piece.composer}</span></div></div><div className="piece-meter"><div className="meter-heading"><span>Piece progress</span><strong>{piece.progress}%</strong></div><div className="progress-track"><i style={{ width: `${piece.progress}%` }} /></div></div><div className="piece-foci">{piece.focusAreas.length ? piece.focusAreas.map((focus) => <span key={focus}>{focus}</span>) : <span className="no-focus">Focus areas not set</span>}</div><div className="piece-meta"><span><Music2 size={14} /> Level {piece.difficulty} / 5</span><span>{formatDuration(piece.totalPracticeSeconds)} played</span></div>{piece.targetPerformanceDate && <div className="piece-deadline"><CalendarDays size={14} /> Stage date · {prettyDate(piece.targetPerformanceDate)}</div>}<div className="piece-card-foot"><span>{piece.sessionCount} sessions</span><button className="subtle-action" onClick={() => openEdit(piece)}>Refine piece <ArrowUpRight size={14} /></button></div></Card>)}</div> : <Card className="empty-card"><EmptyState title="A clear stand, a new beginning" body="Add the first piece you are working on. Your repertoire will grow with every session." action={<Button onClick={openNew}><Plus size={16} /> Add your first piece</Button>} /></Card>}
    </>}
    {(creating || editing) && <Modal title={editing ? 'Shape this piece' : 'Add to your repertoire'} onClose={() => { setCreating(false); setEditing(null); }} wide><div className="form-grid"><Field label="Piece title"><input autoFocus required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} maxLength={200} placeholder="Violin Concerto in D major" /></Field><Field label="Composer"><input required value={form.composer} onChange={(event) => setForm({ ...form, composer: event.target.value })} maxLength={200} placeholder="Composer name" /></Field><Field label="Current stage"><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as RepertoireStatus })}>{statusList.map((status) => <option value={status} key={status}>{titleCase(status)}</option>)}</select></Field><Field label="Difficulty"><select value={form.difficulty} onChange={(event) => setForm({ ...form, difficulty: Number(event.target.value) })}>{[1, 2, 3, 4, 5].map((level) => <option value={level} key={level}>{level} / 5</option>)}</select></Field><Field label={`Progress · ${form.progress}%`}><input type="range" min="0" max="100" value={form.progress} onChange={(event) => setForm({ ...form, progress: Number(event.target.value) })} /></Field><Field label="Performance date"><input type="date" value={form.targetPerformanceDate || ''} onChange={(event) => setForm({ ...form, targetPerformanceDate: event.target.value || null })} /></Field><Field label="Focus areas · comma separated"><input value={focusText} onChange={(event) => setFocusText(event.target.value)} placeholder="intonation, shifting, phrasing" /></Field><Field label="Notes"><textarea rows={3} maxLength={5000} value={form.notes || ''} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Passages to revisit, performance notes…" /></Field></div>{editing && <label className="checkbox-field"><input type="checkbox" checked={Boolean(form.archived)} onChange={(event) => setForm({ ...form, archived: event.target.checked })} /> Keep this piece in the archive</label>}<div className="modal-actions"><Button variant="ghost" onClick={() => { setCreating(false); setEditing(null); }}>Cancel</Button><SubmitButton busy={busy} onClick={save}>{editing ? 'Save piece' : 'Add piece'}</SubmitButton></div></Modal>}
  </div>;
}
