import { ArrowRight, CalendarDays, Flame, Music2, Target, Timer, Trophy } from 'lucide-react';
import { Link } from 'wouter';
import { useGetViolinDashboard } from '@workspace/api-client-react';
import { Card, EmptyState, PageHeading, QueryState } from '@/components/Primitives';
import { formatDuration, prettyDate } from '@/lib/utils';
import type { CSSProperties } from 'react';

export default function Dashboard() {
  const query = useGetViolinDashboard();
  const dashboard = query.data;
  const retry = () => query.refetch();

  if (query.isLoading || query.error) return <><PageHeading eyebrow="YOUR STUDIO · TODAY" title="A little more music." subtitle="Your practice, gathered in one thoughtful place." /><QueryState loading={query.isLoading} error={query.error} retry={retry} /></>;
  if (!dashboard) return null;
  const weekPercent = dashboard.weeklyGoalSeconds > 0 ? Math.min(100, dashboard.weekSeconds / dashboard.weeklyGoalSeconds * 100) : 0;

  return <div className="page-enter">
    <PageHeading eyebrow="YOUR STUDIO · TODAY" title="A little more music." subtitle={new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} action={<Link className="button button-primary" href="/practice"><Timer size={17} /> Begin a session</Link>} />
    <div className="dashboard-hero">
      <div className="hero-copy"><span className="hero-kicker">THE WEEK IN PRACTICE</span><h2>Let consistency<br />find its own rhythm.</h2><p>Every focused minute is a note in the larger piece.</p><Link href="/history" className="hero-link">See your practice story <ArrowRight size={16} /></Link></div>
      <div className="hero-score"><div className="score-ring" style={{ '--progress': `${weekPercent}%` } as CSSProperties}><div><strong>{formatDuration(dashboard.weekSeconds)}</strong><span>this week</span></div></div><div className="score-caption"><span>{formatDuration(dashboard.weeklyGoalSeconds)} weekly intention</span><div className="progress-track"><i style={{ width: `${weekPercent}%` }} /></div></div></div>
      <div className="hero-ornament"><Music2 size={118} strokeWidth={0.75} /></div>
    </div>
    <div className="metric-grid">
      <Card className="metric-card"><span className="metric-icon gold"><Timer size={18} /></span><span className="metric-label">TODAY'S PRACTICE</span><strong>{formatDuration(dashboard.todaySeconds)}</strong><small>Quiet work, beautifully done</small></Card>
      <Card className="metric-card"><span className="metric-icon coral"><Flame size={18} /></span><span className="metric-label">PRACTICE STREAK</span><strong>{dashboard.streakDays} <em>days</em></strong><small>Showing up is the work</small></Card>
      <Card className="metric-card"><span className="metric-icon sage"><Target size={18} /></span><span className="metric-label">WEEKLY INTENTION</span><strong>{Math.round(weekPercent)}<em>%</em></strong><small>{formatDuration(Math.max(0, dashboard.weeklyGoalSeconds - dashboard.weekSeconds))} to your goal</small></Card>
    </div>
    <div className="dashboard-columns">
      <Card className="section-card"><div className="section-title"><div><span className="eyebrow">THE LAST FEW NOTES</span><h2>Recent sessions</h2></div><Link className="text-link" href="/history">Full history <ArrowRight size={15} /></Link></div>
        {dashboard.recentSessions.length ? <div className="session-list">{dashboard.recentSessions.slice(0, 5).map((session) => <div className="session-row" key={session.id}><span className="session-mark"><Music2 size={15} /></span><div className="session-info"><strong>{session.pieceTitle || 'Open practice'}</strong><span>{session.category.replace('-', ' ')} · {prettyDate(session.startedAt)}</span></div><b>{formatDuration(session.elapsedSeconds)}</b></div>)}</div> : <EmptyState title="The page is still blank" body="Your first session will begin your practice story." action={<Link href="/practice" className="text-link">Start a session <ArrowRight size={15} /></Link>} />}
      </Card>
      <Card className="section-card"><div className="section-title"><div><span className="eyebrow">ON YOUR STAND</span><h2>Repertoire</h2></div><Link className="text-link" href="/repertoire">Explore <ArrowRight size={15} /></Link></div>
        {dashboard.repertoire.length ? <div className="piece-list">{dashboard.repertoire.slice(0, 4).map((piece) => <div className="piece-row" key={piece.id}><div className="piece-monogram">{piece.title.slice(0, 1)}</div><div className="piece-info"><strong>{piece.title}</strong><span>{piece.composer}</span><div className="mini-progress"><i style={{ width: `${piece.progress}%` }} /></div></div><span className="piece-progress">{piece.progress}%</span></div>)}</div> : <EmptyState title="Make a place for a piece" body="Build your repertoire one work at a time." action={<Link href="/repertoire" className="text-link">Add repertoire</Link>} />}
      </Card>
    </div>
    <div className="dashboard-columns lower-columns">
      <Card className="section-card"><div className="section-title"><div><span className="eyebrow">LOOKING AHEAD</span><h2>Coming to the stage</h2></div><CalendarDays size={20} className="muted-icon" /></div>
        {dashboard.upcomingPerformances.length ? dashboard.upcomingPerformances.map((piece) => <div className="performance-row" key={piece.id}><div><strong>{piece.title}</strong><span>{piece.composer}</span></div><span className="date-pill">{piece.targetPerformanceDate ? prettyDate(piece.targetPerformanceDate) : 'Date to be set'}</span></div>) : <p className="quiet-copy">No performance dates on the calendar yet. Add a date to a piece when you have one in mind.</p>}
      </Card>
      <Card className="section-card"><div className="section-title"><div><span className="eyebrow">MILESTONES</span><h2>Practice achievements</h2></div><Trophy size={20} className="muted-icon" /></div>
        {dashboard.achievements.length ? <div className="achievement-list">{dashboard.achievements.slice(0, 3).map((achievement) => <div key={achievement.key} className="achievement-row"><span className="trophy-dot"><Trophy size={15} /></span><div><strong>{achievement.title}</strong><span>{achievement.description}</span><div className="mini-progress"><i style={{ width: `${achievement.target ? Math.min(100, achievement.progress / achievement.target * 100) : 0}%` }} /></div></div><small>{achievement.progress}/{achievement.target}</small></div>)}</div> : <p className="quiet-copy">Your progress will make its own milestones. Keep listening closely.</p>}
      </Card>
    </div>
  </div>;
}
