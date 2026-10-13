import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, Clock3, Pencil, Plus, Trash2 } from 'lucide-react';
import { getGetPracticePlanSummaryQueryKey, getGetPracticePlansQueryKey, getGetViolinDashboardQueryKey, useCreatePracticePlan, useDeletePracticePlan, useGetPracticePlanSummary, useGetPracticePlans, useGetRepertoire, useUpdatePracticePlan } from '@workspace/api-client-react';
import type { PracticeCategory, PracticePlan, PracticePlanInput } from '@workspace/api-client-react';
import { Button, Card, EmptyState, Field, Modal, PageHeading, QueryState, SubmitButton } from '@/components/Primitives';
import { dateKey, formatDuration, titleCase } from '@/lib/utils';

const categories: PracticeCategory[] = ['technique', 'scales', 'intonation', 'bowing', 'sight-reading', 'repertoire', 'memorisation', 'other'];
const weekStart = (source: Date) => {
  const date = new Date(source);
  date.setDate(date.getDate() - (date.getDay() + 6) % 7);
  return date;
};

export default function Planner() {
  const client = useQueryClient();
  const [anchor, setAnchor] = useState(weekStart(new Date()));
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PracticePlan | null>(null);
  const [form, setForm] = useState<PracticePlanInput>({ date: dateKey(new Date()), pieceId: null, category: 'technique', plannedMinutes: 30, goal: '', completed: false });
  const from = dateKey(anchor);
  const end = new Date(anchor);
  end.setDate(end.getDate() + 6);
  const to = dateKey(end);
  const params = useMemo(() => ({ from, to }), [from, to]);
  const plansQuery = useGetPracticePlans(params);
  const summaryQuery = useGetPracticePlanSummary(params);
  const repertoireQuery = useGetRepertoire();
  const create = useCreatePracticePlan();
  const update = useUpdatePracticePlan();
  const remove = useDeletePracticePlan();
  const invalidate = () => {
    void client.invalidateQueries({ queryKey: getGetPracticePlansQueryKey() });
    void client.invalidateQueries({ queryKey: getGetPracticePlanSummaryQueryKey() });
    void client.invalidateQueries({ queryKey: getGetViolinDashboardQueryKey() });
  };
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(anchor);
    date.setDate(date.getDate() + index);
    return date;
  });
  const plans = plansQuery.data || [];
  const openNew = (date: string) => {
    setEditing(null);
    setForm({ date, pieceId: null, category: 'technique', plannedMinutes: 30, goal: '', completed: false });
    setOpen(true);
  };
  const editBlock = (plan: PracticePlan) => {
    setEditing(plan);
    setForm({ date: plan.date, pieceId: plan.pieceId, category: plan.category, plannedMinutes: plan.plannedMinutes, goal: plan.goal, completed: plan.completed });
    setOpen(true);
  };
  const save = () => {
    const data = { ...form, plannedMinutes: Math.min(240, Math.max(1, Number(form.plannedMinutes) || 1)), pieceId: form.pieceId || null };
    if (editing) update.mutate({ id: editing.id, data }, { onSuccess: () => { invalidate(); setOpen(false); } });
    else create.mutate({ data }, { onSuccess: () => { invalidate(); setOpen(false); } });
  };
  const loading = plansQuery.isLoading || summaryQuery.isLoading || repertoireQuery.isLoading;
  const error = plansQuery.error || summaryQuery.error || repertoireQuery.error;
  const summary = summaryQuery.data;
  const dateHeading = `${anchor.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })} — ${end.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}`;

  return <div className="page-enter">
    <PageHeading eyebrow="A PLAN WITH ROOM TO BREATHE" title="Practice planner" subtitle="Give the week a shape. Let the music fill it in." action={<Button onClick={() => openNew(dateKey(new Date()))}><Plus size={17} /> Plan a block</Button>} />
    <QueryState loading={loading} error={error} retry={() => { void plansQuery.refetch(); void summaryQuery.refetch(); void repertoireQuery.refetch(); }} />
    {!loading && !error && <>
      <div className="planner-toolbar"><div className="week-nav"><button className="icon-button" aria-label="Previous week" onClick={() => { const next = new Date(anchor); next.setDate(next.getDate() - 7); setAnchor(next); }}><ArrowLeft size={17} /></button><div><span className="eyebrow">YOUR WEEK</span><strong>{dateHeading}</strong></div><button className="icon-button" aria-label="Next week" onClick={() => { const next = new Date(anchor); next.setDate(next.getDate() + 7); setAnchor(next); }}><ArrowRight size={17} /></button></div><button className="subtle-action" onClick={() => setAnchor(weekStart(new Date()))}>This week</button></div>
      <div className="plan-summary-grid"><Card className="summary-stat"><span>PLANNED</span><strong>{formatDuration(summary?.plannedSeconds || 0)}</strong><small>{summary?.blocks || 0} practice blocks</small></Card><Card className="summary-stat"><span>ACTUAL PRACTICE</span><strong>{formatDuration(summary?.actualSeconds || 0)}</strong><small>Completed practice time</small></Card><Card className="summary-stat summary-accent"><span>BLOCKS COMPLETED</span><strong>{summary?.completedBlocks || 0}<em> / {summary?.blocks || 0}</em></strong><small>Intentions met, one at a time</small></Card></div>
      <div className="week-grid">{days.map((day) => {
        const key = dateKey(day);
        const dayPlans = plans.filter((plan) => plan.date.slice(0, 10) === key);
        const today = key === dateKey(new Date());
        return <Card className={`day-column ${today ? 'today-column' : ''}`} key={key}><div className="day-heading"><span>{day.toLocaleDateString(undefined, { weekday: 'short' })}</span><strong>{day.getDate()}</strong>{today && <i>Today</i>}</div><div className="day-blocks">{dayPlans.length ? dayPlans.map((plan) => <div className={`plan-block ${plan.completed ? 'block-complete' : ''}`} key={plan.id}><div className="plan-block-top"><span className="plan-category">{titleCase(plan.category)}</span><div className="row-actions"><button className="tiny-action" aria-label="Edit planned block" onClick={() => editBlock(plan)}><Pencil size={13} /></button><button className="tiny-action" aria-label="Delete planned block" onClick={() => { if (window.confirm('Delete this planned practice block?')) remove.mutate({ id: plan.id }, { onSuccess: invalidate }); }}><Trash2 size={13} /></button></div></div><strong>{plan.pieceTitle || 'Open practice'}</strong>{plan.goal && <p>{plan.goal}</p>}<div className="plan-block-foot"><span><Clock3 size={13} /> {plan.plannedMinutes} min</span><button className={`complete-toggle ${plan.completed ? 'is-complete' : ''}`} aria-label={plan.completed ? 'Mark block not done' : 'Mark block done'} onClick={() => update.mutate({ id: plan.id, data: { completed: !plan.completed } }, { onSuccess: invalidate })}>{plan.completed ? <Check size={13} /> : <span />}</button></div></div>) : <div className="day-empty">A little room<br />for music</div>}</div><button className="add-block" onClick={() => openNew(key)}><Plus size={14} /> Add block</button></Card>;
      })}</div>
      {!plans.length && <Card className="planner-empty"><EmptyState title="An open week" body="Start by adding one small practice block to any day." action={<Button onClick={() => openNew(dateKey(new Date()))}><Plus size={16} /> Plan your first block</Button>} /></Card>}
    </>}
    {open && <Modal title={editing ? 'Adjust this block' : 'Plan a practice block'} onClose={() => setOpen(false)}><p className="modal-intro">A thoughtful plan is an invitation, never a demand.</p><Field label="Day"><input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></Field><Field label="Piece"><select value={form.pieceId || ''} onChange={(event) => setForm({ ...form, pieceId: event.target.value ? Number(event.target.value) : null })}><option value="">Open practice</option>{(repertoireQuery.data || []).filter((piece) => !piece.archived).map((piece) => <option key={piece.id} value={piece.id}>{piece.title}</option>)}</select></Field><Field label="Practice focus"><select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as PracticeCategory })}>{categories.map((category) => <option key={category} value={category}>{titleCase(category)}</option>)}</select></Field><Field label="Time to set aside · minutes"><input type="number" min="1" max="240" value={form.plannedMinutes} onChange={(event) => setForm({ ...form, plannedMinutes: Number(event.target.value) })} /></Field><Field label="Intention"><input maxLength={2000} value={form.goal} onChange={(event) => setForm({ ...form, goal: event.target.value })} placeholder="A passage, a technique, a phrase…" /></Field><div className="modal-actions"><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><SubmitButton busy={create.isPending || update.isPending} onClick={save}>{editing ? 'Save block' : 'Add to plan'}</SubmitButton></div></Modal>}
  </div>;
}
