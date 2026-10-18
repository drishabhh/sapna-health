import { useMemo, useState } from 'react';
import { avgCycleLen, cycleInfo, isPredictedPeriod, monthGrid, periodStarts, PHASE_COPY } from '../lib/calc';
import { addDays, diffDays, DOW_LETTER, MONTHS_FULL, parseKey, shortLabel, today } from '../lib/dates';
import { haptic } from '../lib/native';
import { useStore } from '../lib/store';
import { Flow } from '../lib/types';
import { Icon, Ring, toast } from '../ui';

const SYMPTOMS = ['Cramps', 'Bloating', 'Headache', 'Low energy', 'Mood swings', 'Cravings', 'Acne', 'Back pain', 'Tender breasts'];
const FLOWS: { v: Flow; l: string }[] = [{ v: 'none', l: 'None' }, { v: 'light', l: 'Light' }, { v: 'medium', l: 'Medium' }, { v: 'heavy', l: 'Heavy' }];

export default function CycleScreen() {
  const { data, update } = useStore();
  const t = today();
  const now = parseKey(t);
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [sel, setSel] = useState(t);
  const info = cycleInfo(data);
  const cells = useMemo(() => monthGrid(ym.y, ym.m), [ym]);
  const day = data.cycle[sel] || {};
  const starts = periodStarts(data);

  if (!data.profile.cycleEnabled) {
    return (
      <div className="screen" data-acc="cycle">
        <div className="glow" />
        <div className="stack" style={{ gap: 16 }}>
          <p className="eyebrow">Cycle</p>
          <h1 className="h1">Cycle tracking is off</h1>
          <p className="muted">Turn it on to see your phase, predictions and workout tips that match how you feel.</p>
          <button type="button" className="btn lg block" onClick={() => update((d) => ({ ...d, profile: { ...d.profile, cycleEnabled: true } }))}>Turn on</button>
        </div>
      </div>
    );
  }

  function setFlow(v: Flow) {
    haptic.tap();
    update((d) => ({ ...d, cycle: { ...d.cycle, [sel]: { ...(d.cycle[sel] || {}), flow: v } } }));
  }
  function toggleSym(s: string) {
    haptic.tap();
    const cur = day.symptoms || [];
    const next = cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s];
    update((d) => ({ ...d, cycle: { ...d.cycle, [sel]: { ...(d.cycle[sel] || {}), symptoms: next } } }));
  }
  function periodStartedToday() {
    haptic.success();
    update((d) => ({ ...d, cycle: { ...d.cycle, [t]: { ...(d.cycle[t] || {}), flow: d.cycle[t]?.flow && d.cycle[t].flow !== 'none' ? d.cycle[t].flow : 'medium' } } }));
    setSel(t);
    toast('Logged — predictions updated');
  }

  const late = info && info.daysToNext < 0 && !(data.cycle[t]?.flow && data.cycle[t].flow !== 'none');
  const inPeriodToday = !!data.cycle[t]?.flow && data.cycle[t].flow !== 'none';

  return (
    <div className="screen" data-acc="cycle">
      <div className="glow" />
      <div className="stack" style={{ gap: 16 }}>
        <header className="stack" style={{ gap: 4 }}>
          <p className="eyebrow">Private · on this phone</p>
          <h1 className="h1">Cycle</h1>
        </header>

        {info ? (
          <section className="card hero row" style={{ gap: 18 }} aria-label="Cycle summary">
            <Ring value={info.day} max={info.length} size={124} stroke={11} label={`Day ${info.day} of a ${info.length} day cycle`}>
              <span className="small muted">Day</span>
              <span className="big" style={{ fontSize: 38 }}>{info.day}</span>
            </Ring>
            <div className="stack" style={{ gap: 6, minWidth: 0 }}>
              <span className="pill" style={{ alignSelf: 'flex-start' }}>{PHASE_COPY[info.phase].label} phase</span>
              <p className="h2" style={{ fontSize: 20, lineHeight: 1.2 }}>
                {late ? `Period ${-info.daysToNext} day${info.daysToNext === -1 ? '' : 's'} late` : inPeriodToday ? 'On your period' : info.daysToNext === 0 ? 'Period may start today' : `Period in ${info.daysToNext} day${info.daysToNext === 1 ? '' : 's'}`}
              </p>
              <p className="small muted">Expected {shortLabel(info.nextStart)} · {info.length}-day average</p>
            </div>
          </section>
        ) : (
          <section className="card hero stack" style={{ gap: 8 }}>
            <p className="h2">Log your next period to start predictions</p>
            <p className="muted small">Tap a day below and choose a flow.</p>
          </section>
        )}

        {!inPeriodToday ? <button type="button" className="btn block" onClick={periodStartedToday}><Icon name="drop" size={18} /> My period started today</button> : null}

        {info ? (
          <section className="grid2">
            <div className="card tight"><p className="eyebrow acc-t">How you may feel</p><p className="small" style={{ marginTop: 6 }}>{PHASE_COPY[info.phase].tip}</p></div>
            <div className="card tight" data-acc="workout"><p className="eyebrow acc-t">At the gym</p><p className="small" style={{ marginTop: 6 }}>{PHASE_COPY[info.phase].gym}</p></div>
          </section>
        ) : null}

        <section className="card stack" style={{ gap: 12 }} aria-label="Calendar">
          <div className="between">
            <button type="button" className="icon-btn" aria-label="Previous month" onClick={() => setYm(({ y, m }) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }))}><Icon name="back" /></button>
            <h2 className="h2" style={{ fontSize: 19 }}>{MONTHS_FULL[ym.m]} {ym.y}</h2>
            <button type="button" className="icon-btn" aria-label="Next month" onClick={() => setYm(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }))}><Icon name="next" /></button>
          </div>
          <div className="cal">
            {DOW_LETTER.map((l, i) => <span key={i} className="dow" aria-hidden="true">{l}</span>)}
            {cells.map((k, i) => {
              if (!k) return <span key={i} />;
              const c = data.cycle[k];
              const isP = !!c?.flow && c.flow !== 'none';
              const pred = !isP && isPredictedPeriod(data, k, info);
              const fert = !isP && !pred && info && k >= info.fertile[0] && k <= info.fertile[1] && k >= info.lastStart;
              const cls = [isP ? 'period' : pred ? 'pred' : fert ? 'fertile' : '', k === t ? 'today' : ''].join(' ');
              const n = parseKey(k).getDate();
              return (
                <button key={k} type="button" className={cls} aria-pressed={k === sel} disabled={k > addDays(t, 60)}
                  aria-label={`${n} ${MONTHS_FULL[ym.m]}${isP ? ', period' : pred ? ', predicted period' : fert ? ', fertile window' : ''}${k === t ? ', today' : ''}${c?.symptoms?.length ? ', has notes' : ''}`}
                  onClick={() => { haptic.tap(); setSel(k); }}>
                  {n}{c?.symptoms?.length ? <span aria-hidden="true" style={{ display: 'block', width: 4, height: 4, borderRadius: 4, background: 'currentColor', margin: '1px auto 0' }} /> : null}
                </button>
              );
            })}
          </div>
          <div className="row small muted" style={{ flexWrap: 'wrap', gap: 14 }}>
            <span className="row" style={{ gap: 6 }}><i style={{ width: 12, height: 12, borderRadius: 4, background: 'var(--pink)' }} />Period</span>
            <span className="row" style={{ gap: 6 }}><i style={{ width: 12, height: 12, borderRadius: 4, border: '1.5px dashed var(--pink)' }} />Predicted</span>
            <span className="row" style={{ gap: 6 }}><i style={{ width: 12, height: 12, borderRadius: 4, background: 'color-mix(in srgb, var(--cyan) 35%, transparent)' }} />Fertile window</span>
          </div>
        </section>

        <section className="card stack" style={{ gap: 14 }} aria-label="Log a day">
          <h2 className="h2">{sel === t ? 'Today' : shortLabel(sel)}</h2>
          {sel > t ? <p className="muted small">You can log days up to today.</p> : (
            <>
              <div className="stack" style={{ gap: 8 }}>
                <span className="h3">Flow</span>
                <div role="group" aria-label="Flow" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 6 }}>
                  {FLOWS.map((f) => (
                    <button key={f.v} type="button" className="chip" style={{ justifyContent: 'center', padding: 0 }} aria-pressed={(day.flow || 'none') === f.v} onClick={() => setFlow(f.v)}>{f.l}</button>
                  ))}
                </div>
              </div>
              <div className="stack" style={{ gap: 8 }}>
                <span className="h3">How you feel</span>
                <div className="chips" role="group" aria-label="Symptoms">
                  {SYMPTOMS.map((s) => <button key={s} type="button" className="chip" aria-pressed={(day.symptoms || []).includes(s)} onClick={() => toggleSym(s)}>{s}</button>)}
                </div>
              </div>
              <p className="small muted">Saved automatically.</p>
            </>
          )}
        </section>

        {starts.length > 1 ? (
          <section className="card stack" style={{ gap: 8 }} aria-label="Past cycles">
            <h2 className="h2" style={{ fontSize: 19 }}>Past cycles</h2>
            {starts.slice(-6).reverse().map((s, i, arr) => {
              const prev = arr[i + 1];
              return (
                <div key={s} className="between small" style={{ padding: '6px 0', borderTop: i ? '1px solid var(--line)' : 'none' }}>
                  <span>Started {shortLabel(s)}</span>
                  <span className="muted">{prev ? `${diffDays(s, prev)} days` : `avg ${avgCycleLen(data)} days`}</span>
                </div>
              );
            })}
          </section>
        ) : null}

        <p className="row small muted" style={{ alignItems: 'flex-start' }}><Icon name="lock" size={16} /> Stays on this phone. Rishu only sees {data.profile.shareCycle === 'all' ? 'your cycle details' : data.profile.shareCycle === 'phase' ? 'your phase' : 'nothing'} — and only when you send him your week.</p>
      </div>
    </div>
  );
}
