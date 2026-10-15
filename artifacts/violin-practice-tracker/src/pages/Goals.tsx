import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Pencil, Plus, Target, Trash2, Trophy } from 'lucide-react';
import { getGetPracticeAchievementsQueryKey, getGetPracticeGoalsQueryKey, getGetViolinDashboardQueryKey, getGetRepertoireQueryKey, useCreatePracticeGoal, useDeletePracticeGoal, useGetPracticeAchievements, useGetPracticeGoals, useGetRepertoire, useUpdatePracticeGoal } from '@workspace/api-client-react';
import type { PracticeGoal, GoalType } from '@workspace/api-client-react';
import { Button, Card, EmptyState, Field, Modal, PageHeading, QueryState, SubmitButton } from '@/components/Primitives';
import { dateKey, titleCase } from '@/lib/utils';

const types: GoalType[] = ['daily-minutes', 'weekly-minutes', 'piece-minutes', 'session-count'];

export default function Goals() {
  const client = useQueryClient();
  const [editing, setEditing] = useState<PracticeGoal | null>(null);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<GoalType>('daily-minutes');
  const [target, setTarget] = useState('30');
  const [pieceId, setPieceId] = useState('');
  const maxTarget = type === 'daily-minutes' ? 120 : type === 'weekly-minutes' ? 600 : type === 'session-count' ? 6 : 10000;
  const targetValue = Number(target);
  const invalidTarget = !Number.isInteger(targetValue) || targetValue < 1 || targetValue > maxTarget || (type === 'piece-minutes' && !pieceId);
  const goalsQuery = useGetPracticeGoals({ asOf: dateKey(new Date()) });
  const achievementsQuery = useGetPracticeAchievements();
  const repertoireQuery = useGetRepertoire();
  const create = useCreatePracticeGoal();
  const update = useUpdatePracticeGoal();
  const remove = useDeletePracticeGoal();
  const invalidate = () => {
    void client.invalidateQueries({ queryKey: getGetPracticeGoalsQueryKey() });
    void client.invalidateQueries({ queryKey: getGetPracticeAchievementsQueryKey() });
    void client.invalidateQueries({ queryKey: getGetViolinDashboardQueryKey() });
  };
  const openCreate = () => {
    setEditing(null);
    setType('daily-minutes');
    setTarget('30');
    setPieceId('');
    setOpen(true);
  };
  const openEdit = (goal: PracticeGoal) => {
    setEditing(goal);
    setType(goal.type);
    setTarget(String(goal.targetValue));
    setPieceId(goal.pieceId ? String(goal.pieceId) : '');
    setOpen(true);
  };
  const save = () => {
    if (invalidTarget) return;
    const body = { type, targetValue, pieceId: type === 'piece-minutes' && pieceId ? Number(pieceId) : null, active: editing ? editing.active : true };
    if (editing) update.mutate({ id: editing.id, data: body }, { onSuccess: () => { invalidate(); setOpen(false); } });
    else create.mutate({ data: body }, { onSuccess: () => { invalidate(); setOpen(false); } });
  };
  const loading = goalsQuery.isLoading || achievementsQuery.isLoading || repertoireQuery.isLoading;
  const error = goalsQuery.error || achievementsQuery.error || repertoireQuery.error;
  const goals = goalsQuery.data || [];
  const achievements = achievementsQuery.data || [];

  return <div className="page-enter">
    <PageHeading eyebrow="INTENTION, THEN ATTENTION" title="Goals & milestones" subtitle="Give your practice direction without making it a race." action={<Button onClick={openCreate}><Plus size={17} /> Set a goal</Button>} />
    <QueryState loading={loading} error={error} retry={() => { void goalsQuery.refetch(); void achievementsQuery.refetch(); void repertoireQuery.refetch(); }} />
    {!loading && !error && <div className="goals-layout">
      <section className="goal-main"><div className="section-title"><div><span className="eyebrow">YOUR PRACTICE INTENTIONS</span><h2>Goals that fit the music</h2></div><span className="session-count">{goals.filter((goal) => goal.active).length} active</span></div>
        {goals.length ? <div className="goal-list">{goals.map((goal) => {
          const percent = goal.targetValue ? Math.min(100, goal.currentValue / goal.targetValue * 100) : 0;
          const unit = goal.type === 'session-count' ? 'sessions' : 'minutes';
          return <Card className={`goal-card ${goal.active ? '' : 'goal-inactive'}`} key={goal.id}><div className="goal-card-top"><span className="goal-icon"><Target size={18} /></span><div className="goal-head"><span>{titleCase(goal.type)}{goal.pieceTitle ? ` · ${goal.pieceTitle}` : ''}</span><h3>{goal.targetValue} <small>{unit}</small></h3></div><div className="row-actions"><button className="icon-button" aria-label="Edit goal" onClick={() => openEdit(goal)}><Pencil size={15} /></button><button className="icon-button danger-icon" aria-label="Delete goal" onClick={() => { if (window.confirm('Remove this practice goal?')) remove.mutate({ id: goal.id }, { onSuccess: invalidate }); }}><Trash2 size={15} /></button></div></div><div className="goal-progress-copy"><span>{goal.currentValue} of {goal.targetValue} {unit}</span><b>{Math.round(percent)}%</b></div><div className="progress-track"><i style={{ width: `${percent}%` }} /></div><div className="goal-bottom"><span>{goal.active ? `Ends ${new Date(goal.periodEnd).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : 'Paused'}</span><button className="subtle-action" onClick={() => update.mutate({ id: goal.id, data: { active: !goal.active } }, { onSuccess: invalidate })}>{goal.active ? 'Pause goal' : 'Resume goal'}</button></div></Card>;
        })}</div> : <Card className="empty-card"><EmptyState title="Choose a gentle direction" body="Set a daily or weekly practice intention, or make space for a particular piece." action={<Button onClick={openCreate}><Plus size={16} /> Create a goal</Button>} /></Card>}
      </section>
      <aside className="achievement-panel"><div className="achievement-heading"><div className="eyebrow">MILESTONES, EARNED</div><Trophy size={23} /><h2>Progress worth keeping</h2><p>These marks come from your real practice, not a checklist.</p></div>
        {achievements.length ? <div className="milestone-list">{achievements.map((achievement) => {
          const percent = achievement.target ? Math.min(100, achievement.progress / achievement.target * 100) : 0;
          return <div className={`milestone ${achievement.earnedAt ? 'earned' : ''}`} key={achievement.key}><div className="milestone-top"><span className="milestone-mark">{achievement.earnedAt ? <Check size={15} /> : <Trophy size={15} />}</span><span className="milestone-status">{achievement.earnedAt ? 'Earned' : `${achievement.progress} / ${achievement.target}`}</span></div><strong>{achievement.title}</strong><p>{achievement.description}</p><div className="progress-track"><i style={{ width: `${percent}%` }} /></div>{achievement.earnedAt && <small>Reached {new Date(achievement.earnedAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</small>}</div>;
        })}</div> : <div className="achievement-empty"><Trophy size={28} /><strong>Your milestones begin with practice.</strong><span>Achievements will appear here as your real progress adds up.</span></div>}
      </aside>
    </div>}
    {open && <Modal title={editing ? 'Refine your goal' : 'Set a practice goal'} onClose={() => setOpen(false)}><p className="modal-intro">Make the intention clear and kind. You can change it any time.</p><Field label="Goal rhythm"><select value={type} onChange={(event) => setType(event.target.value as GoalType)}>{types.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></Field><Field label={type === 'session-count' ? 'Sessions to complete' : 'Minutes to practice'}><input type="number" min="1" max={maxTarget} value={target} onChange={(event) => setTarget(event.target.value)} /><small className="goal-limit-note">A sustainable target is capped at {maxTarget} {type === 'session-count' ? 'sessions' : 'minutes'} per goal period.</small></Field>{type === 'piece-minutes' && <Field label="Piece"><select value={pieceId} onChange={(event) => setPieceId(event.target.value)}><option value="">Choose a piece</option>{(repertoireQuery.data || []).filter((piece) => !piece.archived).map((piece) => <option key={piece.id} value={piece.id}>{piece.title}</option>)}</select></Field>}<div className="modal-actions"><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><SubmitButton busy={create.isPending || update.isPending} disabled={invalidTarget} onClick={save}>{editing ? 'Save goal' : 'Set goal'}</SubmitButton></div></Modal>}
  </div>;
}
