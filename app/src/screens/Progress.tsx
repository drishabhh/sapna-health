import { useState } from 'react';
import { logStreak, totalsOn } from '../lib/calc';
import { addDays, DOW_SHORT, keyOf, parseKey, shortLabel, today, weekOf } from '../lib/dates';
import { haptic, shareReport } from '../lib/native';
import { useStore } from '../lib/store';
import { Icon, Seg, Sheet, Stepper, toast } from '../ui';

export default function ProgressScreen() {
  const { data, content, update } = useStore();
  const [metric, setMetric] = useState<'kcal' | 'protein'>('kcal');
  const [anchor, setAnchor] = useState(today());
  const [weighOpen, setWeighOpen] = useState(false);
  const lastW = data.weighIns[data.weighIns.length - 1];
  const [kg, setKg] = useState(lastW?.kg || data.profile.weightKg);

  const week = weekOf(anchor);
  const t = today();
  const vals = week.map((k) => ({ k, ...totalsOn(data, k), future: k > t }));
  const logged = vals.filter((v) => v.count > 0 && v.k < t);
  const target = metric === 'kcal' ? content.targets.kcal : content.targets.protein;
  const max = Math.max(target * 1.25, ...vals.map((v) => (metric === 'kcal' ? v.kcal : v.protein)));
  const H = 170;
  const avg = logged.length ? logged.reduce((s, v) => s + (metric === 'kcal' ? v.kcal : v.protein), 0) / logged.length : 0;
  const onTarget = logged.filter((v) => Math.abs(v.kcal - content.targets.kcal) <= content.targets.kcal * 0.1).length;
  const proteinHit = logged.filter((v) => v.protein >= content.targets.protein * 0.9).length;
  const isThisWeek = week.includes(t);

  // Weight trend
  const ws = data.weighIns.slice(-12);
  const wMin = Math.min(...ws.map((w) => w.kg)) - 1;
  const wMax = Math.max(...ws.map((w) => w.kg)) + 1;
  const pts = ws.map((w, i) => {
    const x = ws.length === 1 ? 150 : (i / (ws.length - 1)) * 300;
    const y = 100 - ((w.kg - wMin) / (wMax - wMin || 1)) * 100;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const change = ws.length > 1 ? Number((ws[ws.length - 1].kg - ws[0].kg).toFixed(1)) : 0;

  async function send() {
    haptic.tap();
    const ok = await shareReport(data, content);
    if (ok) update((d) => ({ ...d, lastReportAt: Date.now() }));
  }

  return (
    <div className="screen" data-acc="progress">
      <div className="glow" />
      <div className="stack" style={{ gap: 16 }}>
        <header className="stack" style={{ gap: 4 }}>
          <p className="eyebrow">{shortLabel(week[0])} – {shortLabel(week[6])}</p>
          <h1 className="h1">{isThisWeek ? 'This week' : 'That week'}</h1>
        </header>

        <section className="card hero stack" style={{ gap: 14 }} aria-label="Daily chart">
          <div className="between">
            <button type="button" className="icon-btn" aria-label="Previous week" onClick={() => setAnchor(addDays(anchor, -7))}><Icon name="back" /></button>
            <div style={{ flex: 1, maxWidth: 230 }}><Seg<'kcal' | 'protein'> label="Metric" value={metric} onChange={setMetric} options={[{ v: 'kcal', l: 'Calories' }, { v: 'protein', l: 'Protein' }]} /></div>
            <button type="button" className="icon-btn" aria-label="Next week" disabled={isThisWeek} style={isThisWeek ? { opacity: 0.35 } : undefined} onClick={() => setAnchor(addDays(anchor, 7))}><Icon name="next" /></button>
          </div>
          <div className="between" style={{ alignItems: 'baseline' }}>
            <span className="big" style={{ fontSize: 30 }}>{logged.length ? (metric === 'kcal' ? Math.round(avg).toLocaleString('en-IN') + ' kcal' : Math.round(avg) + ' g') : '—'}</span>
            <span className="small muted">daily average</span>
          </div>
          <div className="chart" role="img" aria-label={`${metric === 'kcal' ? 'Calories' : 'Protein'} per day: ${vals.map((v) => `${DOW_SHORT[parseKey(v.k).getDay()]} ${metric === 'kcal' ? v.kcal : v.protein}`).join(', ')}`} style={{ height: H }}>
            <span className="target" style={{ bottom: (target / max) * H }} />
            {vals.map((v) => {
              const n = metric === 'kcal' ? v.kcal : v.protein;
              return <i key={v.k} className={v.k === t || v.future ? 'dim' : ''} style={{ height: Math.max(3, (n / max) * H) }} />;
            })}
          </div>
          <div className="chart-labels">{vals.map((v) => <span key={v.k} style={v.k === t ? { color: 'var(--text)' } : undefined}>{DOW_SHORT[parseKey(v.k).getDay()]}</span>)}</div>
          <p className="small muted">Dashed line = {metric === 'kcal' ? `${content.targets.kcal.toLocaleString('en-IN')} kcal target` : `${content.targets.protein} g protein goal`}{isThisWeek ? ' · today still in progress' : ''}</p>
        </section>

        <section className="grid3" aria-label="Week summary">
          <div className="card tight"><p className="eyebrow">On target</p><p className="big" style={{ fontSize: 28 }}>{onTarget}<span className="small muted">/{logged.length || 0}</span></p><p className="small muted">kcal ±10%</p></div>
          <div className="card tight"><p className="eyebrow">Protein</p><p className="big" style={{ fontSize: 28 }}>{proteinHit}<span className="small muted">/{logged.length || 0}</span></p><p className="small muted">days 90%+</p></div>
          <div className="card tight"><p className="eyebrow">Streak</p><p className="big" style={{ fontSize: 28 }}>{logStreak(data)}</p><p className="small muted">days logged</p></div>
        </section>

        <section className="card stack" style={{ gap: 12 }} aria-label="Body weight" data-acc="today">
          <div className="between">
            <div><p className="eyebrow">Body weight</p><p className="big" style={{ fontSize: 30 }}>{lastW ? `${lastW.kg} kg` : '—'}</p>{ws.length > 1 ? <p className="small muted">{change > 0 ? '+' : ''}{change} kg since {shortLabel(ws[0].date)}</p> : null}</div>
            <button type="button" className="btn sm" onClick={() => { setKg(lastW?.kg || data.profile.weightKg); setWeighOpen(true); }}><Icon name="plus" size={16} /> Weigh-in</button>
          </div>
          {ws.length > 1 ? (
            <svg viewBox="-8 -8 316 116" style={{ width: '100%', height: 120 }} role="img" aria-label={`Weight trend: ${ws.map((w) => `${shortLabel(w.date)} ${w.kg} kg`).join(', ')}`}>
              <polyline points={pts.join(' ')} fill="none" stroke="var(--acc)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 6px var(--acc))' }} />
              {pts.map((p, i) => { const [x, y] = p.split(',').map(Number); return <circle key={i} cx={x} cy={y} r={i === pts.length - 1 ? 5 : 3} fill="var(--acc)" />; })}
            </svg>
          ) : <p className="small muted">Weigh in once a week, same morning — the trend line appears after two entries.</p>}
        </section>

        <section className="card ink stack" style={{ gap: 10 }} aria-label="Send report" data-acc="cycle">
          <p className="h2" style={{ fontSize: 20 }}>Send Rishu your week</p>
          <p className="small muted">Shares a summary file (food, workouts, weight{data.profile.shareCycle !== 'none' && data.profile.cycleEnabled ? data.profile.shareCycle === 'phase' ? ', cycle phase' : ', cycle details' : ''}) via WhatsApp or anywhere you choose. Nothing is sent automatically.</p>
          <button type="button" className="btn" onClick={send}><Icon name="share" size={18} /> Share my week</button>
          {data.lastReportAt ? <p className="small muted">Last shared {keyOf(new Date(data.lastReportAt)) === today() ? 'today' : shortLabel(keyOf(new Date(data.lastReportAt)))}</p> : null}
        </section>
      </div>

      <Sheet open={weighOpen} onClose={() => setWeighOpen(false)} label="Log weigh-in">
        <div className="stack" style={{ gap: 14 }} data-acc="today">
          <h2 className="h2">Weigh-in · today</h2>
          <Stepper label="weight" value={kg} step={0.1} decimals={1} min={30} max={200} unit="kg" onChange={setKg} />
          <button type="button" className="btn lg block" onClick={() => {
            update((d) => ({ ...d, weighIns: [...d.weighIns.filter((w) => w.date !== today()), { date: today(), kg }].sort((a, b) => a.date.localeCompare(b.date)), profile: { ...d.profile, weightKg: kg } }));
            haptic.success();
            setWeighOpen(false);
            toast('Weigh-in saved');
          }}>Save</button>
        </div>
      </Sheet>
    </div>
  );
}
