import { useState } from 'react';
import { cycleInfo, isGymDay, logStreak, mealFor, mealTotals, nextPlan, PHASE_COPY, sessionsOn, totalsOn } from '../lib/calc';
import { gifSrc } from '../lib/content';
import { greeting, longLabel, today } from '../lib/dates';
import { haptic } from '../lib/native';
import { useStore } from '../lib/store';
import { Food, MEALS } from '../lib/types';
import { useNav } from '../nav';
import { Bar, Gif, Icon, Ring, Sheet, toast } from '../ui';

export default function Today() {
  const { data, content, foods, update, exById, contentFresh } = useStore();
  const nav = useNav();
  const d = today();
  const t = totalsOn(data, d);
  const left = content.targets.kcal - t.kcal;
  const protLeft = Math.max(0, Math.round(content.targets.protein - t.protein));
  const water = data.water[d] || 0;
  const steps = data.steps[d] || 0;
  const streak = logStreak(data);
  const plan = nextPlan(data, content);
  const done = sessionsOn(data, d).some((s) => s.endedAt && s.sets.length);
  const gym = isGymDay(data);
  const cyc = data.profile.cycleEnabled ? cycleInfo(data) : null;
  const [stepsOpen, setStepsOpen] = useState(false);
  const [stepsVal, setStepsVal] = useState('');

  const suggestion = suggest(foods, left, protLeft);

  function setWater(n: number) {
    haptic.tap();
    update((x) => ({ ...x, water: { ...x.water, [d]: Math.max(0, Math.min(20, n)) } }));
  }

  return (
    <div className="screen" data-acc="today">
      <div className="glow" />
      <div className="stack" style={{ gap: 16 }}>
        <header className="between" style={{ alignItems: 'flex-start' }}>
          <div className="stack" style={{ gap: 2 }}>
            <p className="eyebrow">{greeting()}, {data.profile.name}</p>
            <h1 className="h1">Today</h1>
            <p className="muted">{longLabel(d)}</p>
          </div>
          <button type="button" className="icon-btn" aria-label="Settings and backup" onClick={nav.openSettings}><Icon name="settings" /></button>
        </header>

        {content.message ? (
          <div className="card tight row" style={{ alignItems: 'flex-start' }}>
            <span className="acc-t"><Icon name="spark" size={20} /></span>
            <p><strong>From Rishu:</strong> {content.message}</p>
          </div>
        ) : contentFresh ? (
          <div className="card tight row"><span className="acc-t"><Icon name="spark" size={20} /></span><p>New plan from Rishu just arrived.</p></div>
        ) : null}

        <section className="card hero" aria-label="Calories and protein">
          <div className="row" style={{ gap: 18 }}>
            <Ring value={t.kcal} max={content.targets.kcal} label={`${t.kcal} of ${content.targets.kcal} kcal eaten`} color={left < 0 ? 'var(--danger)' : 'var(--acc)'}>
              <span className="big" style={{ fontSize: 40 }}>{Math.abs(left)}</span>
              <span className="small muted">{left >= 0 ? 'kcal left' : 'kcal over'}</span>
            </Ring>
            <div className="stack" style={{ gap: 12, minWidth: 0 }}>
              <div><p className="eyebrow">Eaten</p><p className="big" style={{ fontSize: 26 }}>{t.kcal.toLocaleString('en-IN')}</p></div>
              <div><p className="eyebrow">Target</p><p className="big" style={{ fontSize: 26 }}>{content.targets.kcal.toLocaleString('en-IN')}</p></div>
              {streak > 0 ? <div className="pill" style={{ alignSelf: 'flex-start', whiteSpace: 'nowrap' }}><Icon name="flame" size={14} /> {streak}-day streak</div> : null}
            </div>
          </div>
          <div className="stack" style={{ gap: 8, marginTop: 18 }} data-acc="food">
            <div className="between"><strong>Protein</strong><span className="small muted"><strong className="acc-t">{t.protein} g</strong> / {content.targets.protein} g{protLeft > 0 ? ` · ${protLeft} g to go` : ' · done'}</span></div>
            <Bar value={t.protein} max={content.targets.protein} label={`Protein ${t.protein} of ${content.targets.protein} grams`} />
          </div>
        </section>

        {suggestion ? (
          <section className="card ink" aria-label="Suggestion" data-acc="food">
            <p className="eyebrow row" style={{ color: 'var(--acc-t)', gap: 6 }}><Icon name="spark" size={16} /> {suggestion.title}</p>
            <p className="h3" style={{ fontSize: 18, marginTop: 8 }}>{suggestion.food.name} <span className="muted" style={{ fontWeight: 500 }}>({suggestion.food.portion})</span></p>
            <p className="muted" style={{ marginTop: 2 }}>{suggestion.food.kcal} kcal · {suggestion.food.protein} g protein — {suggestion.why}</p>
            <button type="button" className="btn sm" style={{ marginTop: 12 }} onClick={() => nav.openLogger(mealFor())}>Log it</button>
          </section>
        ) : null}

        <section aria-label="Meals" className="stack" style={{ gap: 10 }}>
          <div className="between"><h2 className="h2">Meals</h2><button type="button" className="btn quiet" onClick={() => nav.go('food')}>See day</button></div>
          {MEALS.map((m) => {
            const mt = mealTotals(data, d, m.id);
            const names = mt.entries.map((e) => e.name + (e.mult !== 1 ? ` ×${e.mult}` : '')).join(', ');
            return (
              <div key={m.id} className="list-row">
                <span style={{ flex: 1, minWidth: 0 }}>
                  <strong>{m.label}</strong>
                  <span className="small muted" style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{names || 'Nothing yet'}</span>
                </span>
                {mt.kcal ? <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{mt.kcal} <span className="small muted">kcal</span></span> : null}
                <button type="button" className="icon-btn acc" aria-label={`Add to ${m.label}`} onClick={() => nav.openLogger(m.id)}><Icon name="plus" size={20} stroke={2.4} /></button>
              </div>
            );
          })}
        </section>

        <section className="grid2" aria-label="Water and steps">
          <div className="card tight stack" style={{ gap: 10 }} data-acc="progress">
            <div className="between"><strong className="row" style={{ gap: 6 }}><Icon name="glass" size={18} /> Water</strong></div>
            <p className="big" style={{ fontSize: 30 }}>{water}<span className="small muted" style={{ fontFamily: 'var(--body)', fontWeight: 500 }}> / {content.targets.water}</span></p>
            <div role="img" aria-label={`${water} of ${content.targets.water} glasses`} style={{ display: 'grid', gridTemplateColumns: `repeat(${content.targets.water}, minmax(0,1fr))`, gap: 3 }}>
              {Array.from({ length: content.targets.water }, (_, i) => (
                <span key={i} style={{ height: 16, borderRadius: 4, background: i < water ? 'var(--acc)' : 'var(--card-2)', boxShadow: i < water ? '0 0 8px var(--acc)' : 'none' }} />
              ))}
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button type="button" className="icon-btn" aria-label="Remove a glass" onClick={() => setWater(water - 1)}><Icon name="minus" size={18} /></button>
              <button type="button" className="btn sm" style={{ flex: 1, whiteSpace: 'nowrap', padding: '0 8px' }} aria-label="Add a glass" onClick={() => setWater(water + 1)}><Icon name="plus" size={18} stroke={2.6} /></button>
            </div>
          </div>
          <button type="button" className="card tight stack" style={{ gap: 10, textAlign: 'left', color: 'var(--text)' }} data-acc="today" onClick={() => { setStepsVal(steps ? String(steps) : ''); setStepsOpen(true); }}>
            <strong className="row" style={{ gap: 6 }}><Icon name="steps" size={18} /> Steps</strong>
            <p className="big" style={{ fontSize: 30 }}>{steps.toLocaleString('en-IN')}</p>
            <p className="small muted">{steps ? `≈ ${Math.round(steps * 0.04)} kcal burned` : 'Tap to log from Samsung Health'}</p>
          </button>
        </section>

        <section className="card" data-acc="workout" aria-label="Workout">
          <div className="between"><p className="eyebrow" style={{ color: 'var(--acc-t)' }}>{done ? 'Workout done' : gym ? 'Gym day' : 'Rest day'}</p>{plan ? <span className="pill">{plan.moves.length} moves</span> : null}</div>
          {plan ? (
            <>
              <p className="h2" style={{ marginTop: 6 }}>{plan.title}</p>
              <div className="row" style={{ gap: 6, marginTop: 12, overflow: 'hidden' }}>
                {plan.moves.slice(0, 5).map((m) => (
                  <Gif key={m.exId} src={gifSrc(exById[m.exId])} alt="" style={{ width: 52, height: 52, borderRadius: 12, objectFit: 'cover', background: '#fff', flex: 'none' }} />
                ))}
              </div>
              <button type="button" className="btn block" style={{ marginTop: 14 }} onClick={() => (done ? nav.go('workout') : nav.startWorkout())}>
                {done ? 'See what you lifted' : <><Icon name="play" size={18} /> {gym ? 'Start workout' : 'Train anyway'}</>}
              </button>
            </>
          ) : <p className="muted" style={{ marginTop: 6 }}>No plan yet — Rishu will send one.</p>}
        </section>

        {cyc ? (
          <button type="button" className="card" data-acc="cycle" style={{ textAlign: 'left', color: 'var(--text)' }} onClick={() => nav.go('cycle')}>
            <div className="between"><p className="eyebrow" style={{ color: 'var(--acc-t)' }}>Cycle · day {cyc.day}</p><span className="pill">{PHASE_COPY[cyc.phase].label}</span></div>
            <p style={{ marginTop: 8 }}>{PHASE_COPY[cyc.phase].tip}</p>
          </button>
        ) : null}
      </div>

      <Sheet open={stepsOpen} onClose={() => setStepsOpen(false)} label="Log steps">
        <div className="stack" style={{ gap: 14 }} data-acc="today">
          <h2 className="h2">Steps today</h2>
          <p className="muted small">Copy the number from Samsung Health.</p>
          <input className="input" inputMode="numeric" autoFocus value={stepsVal} onChange={(e) => setStepsVal(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="e.g. 6500" style={{ fontSize: 26, fontFamily: 'var(--display)', fontWeight: 800 }} />
          <button type="button" className="btn lg block" onClick={() => {
            const n = Number(stepsVal || 0);
            update((x) => ({ ...x, steps: { ...x.steps, [d]: n } }));
            setStepsOpen(false);
            toast('Steps saved');
          }}>Save</button>
        </div>
      </Sheet>
    </div>
  );
}

function suggest(foods: Food[], kcalLeft: number, protLeft: number): { title: string; food: Food; why: string } | null {
  if (kcalLeft < 60 || protLeft < 8) return null;
  const fits = foods.filter((f) => f.kcal > 0 && f.kcal <= kcalLeft && f.protein >= 6);
  if (!fits.length) return null;
  const best = fits.sort((a, b) => b.protein / b.kcal - a.protein / a.kcal)[0];
  return { title: 'Fits what’s left', food: best, why: `closes ${Math.min(100, Math.round((best.protein / protLeft) * 100))}% of your protein gap.` };
}
