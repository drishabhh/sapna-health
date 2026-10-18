import React, { ReactNode, useEffect, useRef, useState } from 'react';
import { haptic } from './lib/native';

/* ---------- Android back button: last opened layer closes first ---------- */
const backStack: { id: number; fn: () => void }[] = [];
let nextId = 1;
export function useBack(active: boolean, fn: () => void) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    if (!active) return;
    const id = nextId++;
    backStack.push({ id, fn: () => fnRef.current() });
    return () => {
      const i = backStack.findIndex((b) => b.id === id);
      if (i >= 0) backStack.splice(i, 1);
    };
  }, [active]);
}
export function popBack(): boolean {
  const top = backStack[backStack.length - 1];
  if (!top) return false;
  top.fn();
  return true;
}

/* ---------- Icons (stroke, currentColor) ---------- */
const P: Record<string, ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  food: <path d="M3 11h18a9 9 0 0 1-18 0zM8 7c0-1.5 1-2 1-3M12 7c0-1.5 1-2 1-3M16 7c0-1.5 1-2 1-3" />,
  dumbbell: <path d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12" />,
  drop: <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  back: <path d="M15 18l-6-6 6-6" />,
  next: <path d="M9 6l6 6-6 6" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="M16.5 16.5 21 21" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>,
  spark: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />,
  play: <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor" stroke="none" />,
  glass: <><path d="M7 3h10l-1.5 17a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1z" /><path d="M7.5 8h9" /></>,
  steps: <path d="M5 16c0-3 1-6 3-6s2 3 2 5-1 3-2.5 3S5 17 5 16zM14 10c0-3 1-6 3-6s2 3 2 5-1 3-2.5 3S14 11 14 10z" />,
  share: <><path d="M12 15V3M7 8l5-5 5 5" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></>,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>,
  scale: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M8 9a5 5 0 0 1 8 0l-3 3" /></>,
  history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M9 7V4h6v3" />,
  edit: <path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" />,
  flame: <path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-5.5 1-8.5z" />,
  timer: <><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2M9 2h6" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>,
};

export function Icon({ name, size = 22, stroke = 2 }: { name: keyof typeof P | string; size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {P[name]}
    </svg>
  );
}

/* ---------- Ring ---------- */
export function Ring({ value, max, size = 168, stroke = 14, color = 'var(--acc)', track = 'var(--card-2)', label, children }: {
  value: number; max: number; size?: number; stroke?: number; color?: string; track?: string; label: string; children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        {pct > 0 ? <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray 0.6s cubic-bezier(.2,.9,.3,1)', filter: `drop-shadow(0 0 8px ${color})` }}
        /> : null}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        {children}
      </div>
    </div>
  );
}

export function Bar({ value, max, label, color }: { value: number; max: number; label: string; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="bar" role="img" aria-label={label}>
      <i style={{ width: `${pct}%`, ...(color ? { background: color } : {}) }} />
    </div>
  );
}

/* ---------- Sheet ---------- */
export function Sheet({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: ReactNode; label: string }) {
  useBack(open, onClose);
  if (!open) return null;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}>
        <div className="handle" />
        {children}
      </div>
    </div>
  );
}

export function FullSheet({ open, onClose, children, label, acc }: { open: boolean; onClose: () => void; children: ReactNode; label: string; acc?: string }) {
  useBack(open, onClose);
  if (!open) return null;
  return (
    <div className="fullsheet" role="dialog" aria-modal="true" aria-label={label} data-acc={acc}>
      {children}
    </div>
  );
}

/* ---------- Inputs ---------- */
export function Stepper({ value, onChange, step = 1, min = 0, max = 9999, unit, label, decimals = 0 }: {
  value: number; onChange: (n: number) => void; step?: number; min?: number; max?: number; unit?: string; label: string; decimals?: number;
}) {
  const fix = (n: number) => Number(n.toFixed(decimals));
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" aria-label={`Decrease ${label}`} onClick={() => { haptic.tap(); onChange(fix(Math.max(min, value - step))); }}>−</button>
      <span className="val" aria-live="polite">{value}{unit ? <small> {unit}</small> : null}</span>
      <button type="button" aria-label={`Increase ${label}`} onClick={() => { haptic.tap(); onChange(fix(Math.min(max, value + step))); }}>+</button>
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className="switch" onClick={() => { haptic.tap(); onChange(!on); }}>
      <span />
    </button>
  );
}

export function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.v} type="button" aria-pressed={o.v === value} onClick={() => { haptic.tap(); onChange(o.v); }}>{o.l}</button>
      ))}
    </div>
  );
}

/* ---------- Exercise GIF with offline fallback ---------- */
export function Gif({ src, alt, style, className }: { src: string; alt: string; style?: React.CSSProperties; className?: string }) {
  const [bad, setBad] = useState(false);
  useEffect(() => setBad(false), [src]);
  if (bad || !src) {
    return (
      <div className={className} role="img" aria-label={alt || 'Exercise demo unavailable offline'} style={{ ...style, background: 'var(--card-2)', color: 'var(--faint)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="dumbbell" size={26} />
      </div>
    );
  }
  return <img className={className} src={src} alt={alt} loading="lazy" decoding="async" style={style} onError={() => setBad(true)} />;
}

/* ---------- Toast ---------- */
let showToastImpl: (msg: string) => void = () => {};
export function toast(msg: string) {
  showToastImpl(msg);
}
export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null);
  const t = useRef<number | undefined>(undefined);
  useEffect(() => {
    showToastImpl = (m: string) => {
      setMsg(m);
      if (t.current) window.clearTimeout(t.current);
      t.current = window.setTimeout(() => setMsg(null), 2400);
    };
  }, []);
  if (!msg) return null;
  return <div className="toast" role="status">{msg}</div>;
}

export function Header({ eyebrow, title, right }: { eyebrow?: string; title: string; right?: ReactNode }) {
  return (
    <header className="between" style={{ alignItems: 'flex-start', marginBottom: 6 }}>
      <div className="stack" style={{ gap: 4 }}>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 className="h1">{title}</h1>
      </div>
      {right}
    </header>
  );
}

export function TopBar({ onBack, title, right }: { onBack: () => void; title?: string; right?: ReactNode }) {
  return (
    <div className="row" style={{ padding: 'calc(var(--st) + 12px) 18px 8px' }}>
      <button type="button" className="icon-btn" aria-label="Back" onClick={onBack}><Icon name="back" /></button>
      {title ? <h1 className="h2" style={{ flex: 1, minWidth: 0 }}>{title}</h1> : <span className="spacer" />}
      {right}
    </div>
  );
}
