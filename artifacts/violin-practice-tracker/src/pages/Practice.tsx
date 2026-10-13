import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, CirclePause, CirclePlay, Music2, ShieldAlert, Timer, Trash2 } from 'lucide-react';
import { useGetActivePracticeSession, getGetActivePracticeSessionQueryKey, useGetRepertoire, getGetRepertoireQueryKey, useStartPracticeSession, usePausePracticeSession, useResumePracticeSession, useFinishPracticeSession, useDeletePracticeSession, getGetPracticeSessionsQueryKey, getGetViolinDashboardQueryKey, getGetPracticeStatisticsQueryKey, getGetPracticeCalendarQueryKey, getGetPracticeGoalsQueryKey, getGetPracticeAchievementsQueryKey, getGetPracticePlanSummaryQueryKey } from '@workspace/api-client-react';
import { Button, Card, Field, Modal, PageHeading, QueryState, SubmitButton } from '@/components/Primitives';
import { formatClock } from '@/lib/utils';
import type { PracticeCategory } from '@workspace/api-client-react';

const categories: PracticeCategory[] = ['technique', 'scales', 'intonation', 'bowing', 'sight-reading', 'repertoire', 'memorisation', 'other'];

export default function Practice() {
  const client = useQueryClient();
  const activeQuery = useGetActivePracticeSession();
  const repertoireQuery = useGetRepertoire();
  const session = activeQuery.data?.session;
  const [pieceId, setPieceId] = useState('');
  const [category, setCategory] = useState<PracticeCategory>('technique');
  const [goal, setGoal] = useState('');
  const [finishOpen, setFinishOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [tick, setTick] = useState(Date.now());
  const start = useStartPracticeSession();
  const pause = usePausePracticeSession();
  const resume = useResumePracticeSession();
  const finish = useFinishPracticeSession();
  const discard = useDeletePracticeSession();
  const busy = start.isPending || pause.isPending || resume.isPending || finish.isPending || discard.isPending;
  const invalidate = () => {
    void client.invalidateQueries({ queryKey: getGetActivePracticeSessionQueryKey() });
    void client.invalidateQueries({ queryKey: getGetPracticeSessionsQueryKey() });
    void client.invalidateQueries({ queryKey: getGetViolinDashboardQueryKey() });
    void client.invalidateQueries({ queryKey: getGetPracticeStatisticsQueryKey() });
    void client.invalidateQueries({ queryKey: getGetPracticeCalendarQueryKey({ month: new Date().toISOString().slice(0, 7) }) });
    void client.invalidateQueries({ queryKey: getGetRepertoireQueryKey() });
    void client.invalidateQueries({ queryKey: getGetPracticeGoalsQueryKey() });
    void client.invalidateQueries({ queryKey: getGetPracticeAchievementsQueryKey() });
    void client.invalidateQueries({ queryKey: getGetPracticePlanSummaryQueryKey() });
  };
  useEffect(() => {
    if (!session || session.status !== 'running') return;
    const id = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [session?.id, session?.status]);
  const elapsed = session ? session.elapsedSeconds + (session.status === 'running' && session.activeSince ? Math.max(0, Math.floor((tick - new Date(session.activeSince).getTime()) / 1000)) : 0) : 0;

  if (activeQuery.isLoading) return <><PageHeading eyebrow="IN THE MOMENT" title="Practice" /><QueryState loading error={null} retry={() => activeQuery.refetch()} /></>;
  if (activeQuery.error) return <><PageHeading eyebrow="IN THE MOMENT" title="Practice" /><QueryState loading={false} error={activeQuery.error} retry={() => activeQuery.refetch()} /></>;
  const selectedPiece = repertoireQuery.data?.find((piece) => piece.id === Number(pieceId));

  return <div className="page-enter">
    <PageHeading eyebrow="IN THE MOMENT" title={session ? 'Stay with the sound.' : 'Make room for music.'} subtitle={session ? 'Let the clock hold the space while you listen.' : 'Set a small intention. Then give it your attention.'} />
    <div className="practice-layout">
      <Card className="timer-card">
        <div className={`timer-aura ${session?.status === 'running' ? 'is-running' : ''}`}><div className="timer-face"><span className="timer-caption">{session ? session.status === 'paused' ? 'RESTING' : 'IN SESSION' : 'A QUIET BEGINNING'}</span><strong data-testid="text-session-timer">{formatClock(elapsed)}</strong><span className="timer-piece">{session?.pieceTitle || selectedPiece?.title || 'Open practice'}</span></div></div>
        {session ? <div className="active-goal"><span className="status-pip" />{session.status === 'paused' ? 'Session paused' : session.goal || 'Follow the phrase wherever it leads'}</div> : <div className="session-setup">
          <Field label="Piece"><select value={pieceId} onChange={(event) => setPieceId(event.target.value)} data-testid="select-practice-piece"><option value="">Open practice</option>{(repertoireQuery.data || []).filter((piece) => !piece.archived).map((piece) => <option value={piece.id} key={piece.id}>{piece.title} — {piece.composer}</option>)}</select></Field>
          <Field label="Focus"><select value={category} onChange={(event) => setCategory(event.target.value as PracticeCategory)} data-testid="select-practice-category">{categories.map((value) => <option value={value} key={value}>{value.replace('-', ' ')}</option>)}</select></Field>
          <Field label="Intention for this session"><input value={goal} onChange={(event) => setGoal(event.target.value)} maxLength={2000} placeholder="A phrase, a passage, a feeling…" data-testid="input-practice-goal" /></Field>
        </div>}
        {session ? <div className="timer-actions">{session.status === 'running' ? <Button variant="secondary" onClick={() => pause.mutate({ id: session.id }, { onSuccess: invalidate })} disabled={busy}><CirclePause size={18} /> Pause</Button> : <Button variant="secondary" onClick={() => resume.mutate({ id: session.id }, { onSuccess: invalidate })} disabled={busy}><CirclePlay size={18} /> Resume</Button>}<Button onClick={() => setFinishOpen(true)} disabled={busy}><Check size={18} /> Finish session</Button></div> : <Button className="start-button" onClick={() => start.mutate({ data: { pieceId: pieceId ? Number(pieceId) : null, category, goal } }, { onSuccess: invalidate })} disabled={busy}><CirclePlay size={19} /> Begin practice</Button>}
        {session && <button className="discard-link" onClick={() => { if (window.confirm('Discard this unfinished session? It will be removed from your journal.')) discard.mutate({ id: session.id }, { onSuccess: invalidate }); }} disabled={busy}><Trash2 size={14} /> Discard unfinished session</button>}
        {(start.error || pause.error || resume.error || finish.error || discard.error) && <div className="inline-error"><ShieldAlert size={16} /> Something interrupted that action. Your session is still here; please try again.</div>}
        {repertoireQuery.error && <div className="inline-error"><ShieldAlert size={16} /> Repertoire could not be loaded. You can still begin an open practice session.</div>}
      </Card>
      <aside className="practice-aside">
        <Card className="practice-note"><div className="eyebrow">A NOTE TO YOURSELF</div><Music2 size={23} /><h2>Presence before pace.</h2><p>A single attentive passage can teach more than an hour on autopilot. Take a breath before you begin.</p><div className="note-rule" /><span>THE PRACTICE ROOM</span></Card>
        <Card className="session-context"><div className="eyebrow">THIS SESSION</div><div className="context-row"><span>Selected focus</span><strong>{session?.category || category}</strong></div><div className="context-row"><span>Piece</span><strong>{session?.pieceTitle || selectedPiece?.title || 'Open practice'}</strong></div><div className="context-row"><span>State</span><strong className="context-state">{session?.status || 'Ready when you are'}</strong></div></Card>
      </aside>
    </div>
    {finishOpen && <Modal title="Close the music gently" onClose={() => setFinishOpen(false)}><p className="modal-intro">Capture anything you want to remember from this session.</p><Field label="Session notes"><textarea rows={5} maxLength={5000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="What felt clearer? What will you return to?" data-testid="input-session-notes" /></Field><div className="modal-actions"><Button variant="ghost" onClick={() => setFinishOpen(false)}>Keep practicing</Button><SubmitButton busy={finish.isPending} onClick={() => session && finish.mutate({ id: session.id, data: { notes } }, { onSuccess: () => { invalidate(); setFinishOpen(false); setNotes(''); } })}><Check size={16} /> Save session</SubmitButton></div></Modal>}
  </div>;
}
