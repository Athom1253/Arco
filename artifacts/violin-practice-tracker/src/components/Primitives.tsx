import { AlertCircle, LoaderCircle, Plus, X } from 'lucide-react';
import { type ButtonHTMLAttributes, type ReactNode } from 'react';

export function PageHeading({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle?: string; action?: ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{action && <div className="heading-action">{action}</div>}</div>;
}

export function Button({ children, variant = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  return <button className={`button button-${variant} ${className}`} {...props}>{children}</button>;
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>;
}

export function LoadingState() {
  return <div className="loading-grid"><div className="skeleton skeleton-wide" /><div className="skeleton" /><div className="skeleton" /><div className="skeleton skeleton-tall" /></div>;
}

export function QueryState({ loading, error, retry }: { loading: boolean; error: unknown; retry: () => void }) {
  if (loading) return <LoadingState />;
  if (error) return <div className="state-panel"><AlertCircle size={24} /><strong>We couldn't reach your practice journal.</strong><span>Your saved work is safe. Try again in a moment.</span><Button variant="secondary" onClick={retry}>Try again</Button></div>;
  return null;
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon"><Plus size={20} /></div><strong>{title}</strong><p>{body}</p>{action}</div>;
}

export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true"><div className="modal-heading"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={19} /></button></div>{children}</div></div>;
}

export function SubmitButton({ children, busy, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean }) {
  return <Button {...props} disabled={busy || props.disabled}>{busy && <LoaderCircle size={16} className="spin" />}{children}</Button>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}
