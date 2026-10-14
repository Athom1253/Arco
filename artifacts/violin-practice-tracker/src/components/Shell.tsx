import { Link, useLocation } from 'wouter';
import { Activity, CalendarDays, ChartNoAxesColumnIncreasing, CircleDot, Goal, LibraryBig, Menu, Music2, Timer, Wrench, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';

const links = [
  { href: '/', label: 'Overview', icon: ChartNoAxesColumnIncreasing },
  { href: '/practice', label: 'Practice', icon: Timer },
  { href: '/history', label: 'History', icon: Activity },
  { href: '/repertoire', label: 'Repertoire', icon: LibraryBig },
  { href: '/goals', label: 'Goals', icon: Goal },
  { href: '/planner', label: 'Planner', icon: CalendarDays },
  { href: '/toolkit', label: 'Toolkit', icon: Wrench },
];

export function Shell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="brand-mark"><Music2 size={19} strokeWidth={1.8} /></span>
          <span><strong>Arco</strong><small>practice journal</small></span>
        </Link>
        <div className="sidebar-caption">YOUR STUDIO</div>
        <nav className="side-nav" aria-label="Main navigation">
          {links.map(({ href, label, icon: Icon }) => (
            <Link href={href} key={href} className={`nav-link ${location === href ? 'active' : ''}`} data-testid={`link-nav-${label.toLowerCase()}`}>
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
              {href === '/practice' && <span className="nav-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-note">
          <div className="note-mark"><CircleDot size={16} /></div>
          <p>Small, attentive<br />sessions add up.</p>
          <span>Make room for the music.</span>
        </div>
        <div className="sidebar-footer"><span className="status-orb" /> Your private practice space</div>
      </aside>
      <main className="main-area">
        <header className="mobile-header">
          <Link href="/" className="brand compact"><span className="brand-mark"><Music2 size={18} /></span><strong>Arco</strong></Link>
          <button className="icon-button" aria-label="Toggle navigation" onClick={() => setMobileOpen(!mobileOpen)} data-testid="button-mobile-menu">
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </header>
        {mobileOpen && <nav className="mobile-nav">{links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setMobileOpen(false)} className={location === href ? 'active' : ''}><Icon size={17} />{label}</Link>)}</nav>}
        <div className="page-content">{children}</div>
      </main>
    </div>
  );
}
