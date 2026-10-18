import { useEffect, useMemo, useState } from 'react';
import { exerciseHistory, lastWeight, nextPlan, sessionsPerWeek, uid } from '../lib/calc';
import { gifSrc } from '../lib/content';
import { parseKey, shortLabel, today, DOW_SHORT } from '../lib/dates';
import { haptic } from '../lib/native';
import { useStore } from '../lib/store';
import { Exercise, Plan, PlanMove, Session } from '../lib/types';
import { FullSheet, Gif, Icon, Seg, Sheet, Stepper, toast } from '../ui';

export default function WorkoutScreen({ autoStart, onAutoStartHandled }: { autoStart: boolean; onAutoStartHandled: () => void }) {
  const { data, content, exById } = useStore();
  const suggested = nextPlan(data, content);
  const [planId, setPlanId] = useState<string | null>(null);
  const plan = content.plans.find((p) => p.id === planId) || suggested;
  const [view, setView] = useState<'plan' | 'history'>('plan');
  const [detail, setDetail] = useState<{ ex: Exercise; move: PlanMove } | null>(null);
  const active = data.sessions.find((s) => !s.endedAt && s.date === today());
  const [sessionOpen, setSessionOpen] = useState(false);

  useEffect(() => {
    if (autoStart) {
      setSessionOpen(true);
      onAutoStartHandled();
    }
  }, [autoStart, onAutoStartHandled]);

  const stretches = plan ? plan.moves.filter((m) => exById[m.exId]?.group === 'stretching') : [];
  const lifts = plan ? plan.moves.filter((m) => exById[m.exId]?.group !== 'stretching') : [];

  return (
    <div className="screen" data-acc="workout">
      <div className="glow" />
      <div className="stack" style={{ gap: 16 }}>
        <header className="stack" style={{ gap: 4 }}>
          <p className="eyebrow">Workout</p>
          <h1 className="h1">{view === 'plan' ? plan?.title || 'No plan yet' : 'Your lifts'}</h1>
        </header>
        <Seg<'plan' | 'history'> label="View" value={view} onChange={setView} options={[{ v: 'plan', l: 'Plan' }, { v: 'history', l: 'History' }]} />

        {view === 'plan' ? (
          plan ? (
            <>
              {content.plans.length > 1 ? (
                <div className="chips" role="group" aria-label="Choose plan">
                  {content.plans.map((p) => (
                    <button key={p.id} type="button" className="chip" aria-pressed={p.id === plan.id} onClick={() => setPlanId(p.id)}>{p.title}{p.id === suggested?.id ? ' · up next' : ''}</button>
                  ))}
                </div>
              ) : null}

              <button type="button" className="btn lg block" onClick={() => setSessionOpen(true)}>
                <Icon name="play" size={18} /> {active ? 'Resume session' : 'Start session'}
              </button>

              {stretches.length ? <MoveSection title="Stretching" sub="Warm-up" moves={stretches} onOpen={(ex, move) => setDetail({ ex, move })} /> : null}
              {lifts.length ? <MoveSection title="Exercises" sub={`${lifts.length} moves`} moves={lifts} onOpen={(ex, move) => setDetail({ ex, move })} /> : null}

              {plan.note ? (
                <div className="card tight row" style={{ alignItems: 'flex-start' }}>
                  <span className="acc-t"><Icon name="glass" size={20} /></span><p>{plan.note}</p>
                </div>
              ) : null}
            </>
          ) : <div className="empty">Rishu hasn't published a plan yet.</div>
        ) : (
          <History />
        )}
      </div>

      <Sheet open={!!detail} onClose={() => setDetail(null)} label="Exercise">
        {detail ? (
          <div className="stack" style={{ gap: 14 }} data-acc="workout">
            <Gif src={gifSrc(detail.ex)} alt={`${detail.ex.name} demonstration`} style={{ width: '100%', height: 260, objectFit: 'contain', background: '#fff', borderRadius: 20 }} />
            <h2 className="h1" style={{ fontSize: 30 }}>{detail.ex.name}</h2>
            <p className="pill" style={{ alignSelf: 'flex-start' }}>{detail.move.sets} × {detail.move.reps} {detail.move.unit === 'min' ? 'min' : detail.move.unit === 'sec' ? 'sec' : 'reps'}</p>
            {detail.ex.cue ? <p className="muted" style={{ fontSize: 17 }}>{detail.ex.cue}</p> : null}
          </div>
        ) : null}
      </Sheet>

      {plan ? <SessionView open={sessionOpen} plan={active ? content.plans.find((p) => p.id === active.planId) || plan : plan} onClose={() => setSessionOpen(false)} /> : null}
    </div>
  );
}

function MoveSection({ title, sub, moves, onOpen }: { title: string; sub: string; moves: PlanMove[]; onOpen: (ex: Exercise, m: PlanMove) => void }) {
  const { data, exById } = useStore();
  return (
    <section className="stack" style={{ gap: 10 }} aria-label={title}>
      <div className="between"><h2 className="h2">{title}</h2><span className="small muted">{sub}</span></div>
      {moves.map((m) => {
        const ex = exById[m.exId];
        if (!ex) return null;
        const last = lastWeight(data, m.exId);
        return (
          <button key={m.exId} type="button" className="list-row" style={{ padding: 10 }} onClick={() => onOpen(ex, m)}>
            <Gif className="thumb" src={gifSrc(ex)} alt="" style={{ width: 84, height: 84 }} />
            <span style={{ flex: 1, minWidth: 0 }} className="stack">
              <strong style={{ fontSize: 16, lineHeight: 1.25 }}>{ex.name}</strong>
              <span className="small muted">{m.sets} × {m.reps} {m.unit === 'min' ? 'min' : m.unit === 'sec' ? 'sec' : 'reps'}{m.kg ? ` · ${m.kg} kg` : ''}</span>
              {ex.group !== 'stretching' ? <span className={last ? 'pill' : 'pill neutral'} style={{ alignSelf: 'flex-start', marginTop: 4 }}>{last ? `Last time ${last.kg} kg` : 'First time'}</span> : null}
            </span>
          </button>
        );
      })}
    </section>
  );
}

/* ---------------- Live session ---------------- */

function SessionView({ open, plan, onClose }: { open: boolean; plan: Plan; onClose: () => void }) {
  const { data, update, exById } = useStore();
  const d = today();
  const session = data.sessions.find((s) => !s.endedAt && s.date === d && s.planId === plan.id);
  const [idx, setIdx] = useState(0);
  const [kg, setKg] = useState(0);
  const [reps, setReps] = useState(10);
  const [rest, setRest] = useState(0);
  const [summary, setSummary] = useState<Session | null>(null);
  const moves = plan.moves.filter((m) => exById[m.exId]);
  const move = moves[Math.min(idx, moves.length - 1)];
  const ex = move ? exById[move.exId] : undefined;
  const isStretch = ex?.group === 'stretching';
  const sets = session ? session.sets.filter((x) => x.exId === move?.exId) : [];
  const doneMove = (m: PlanMove) => (session ? session.sets.filter((x) => x.exId === m.exId).length >= m.sets : false);

  // Create (or resume) the session when opened.
  useEffect(() => {
    if (!open) return;
    setSummary(null);
    if (!session) {
      const s: Session = { id: uid(), date: d, planId: plan.id, title: plan.title, startedAt: Date.now(), sets: [] };
      update((x) => ({ ...x, sessions: [...x.sessions, s] }));
      setIdx(0);
    } else {
      const firstOpen = moves.findIndex((m) => !doneMove(m));
      setIdx(firstOpen < 0 ? 0 : firstOpen);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Prefill weight/reps from last time (or the plan) whenever the move changes.
  useEffect(() => {
    if (!move) return;
    const last = lastWeight(data, move.exId, session?.id);
    const mine = sets[sets.length - 1];
    setKg(mine ? mine.kg : last ? last.kg : move.kg || 0);
    setReps(mine ? mine.reps : move.reps);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [move?.exId, open]);

  useEffect(() => {
    if (rest <= 0) return;
    const t = window.setTimeout(() => setRest((r) => r - 1), 1000);
    if (rest === 1) haptic.success();
    return () => window.clearTimeout(t);
  }, [rest]);

  if (!open) return null;

  function logSet() {
    if (!session || !move) return;
    const set = { exId: move.exId, set: sets.length + 1, kg: isStretch ? 0 : kg, reps, at: Date.now() };
    update((x) => ({ ...x, sessions: x.sessions.map((s) => (s.id === session.id ? { ...s, sets: [...s.sets, set] } : s)) }));
    haptic.success();
    const nowDone = sets.length + 1 >= move.sets;
    if (nowDone) {
      if (idx < moves.length - 1) {
        toast(`${ex?.name} done`);
        setTimeout(() => setIdx(idx + 1), 350);
      }
    } else if (!isStretch) setRest(90);
  }
  function undo() {
    if (!session || !sets.length) return;
    const lastAt = sets[sets.length - 1].at;
    update((x) => ({ ...x, sessions: x.sessions.map((s) => (s.id === session.id ? { ...s, sets: s.sets.filter((z) => z.at !== lastAt) } : s)) }));
  }
  function finish() {
    if (!session) return;
    const ended = { ...session, endedAt: Date.now() };
    if (!session.sets.length) {
      update((x) => ({ ...x, sessions: x.sessions.filter((s) => s.id !== session.id) }));
      onClose();
      return;
    }
    update((x) => ({ ...x, sessions: x.sessions.map((s) => (s.id === session.id ? ended : s)) }));
    haptic.success();
    setSummary(ended);
  }

  const allDone = moves.every(doneMove);

  return (
    <FullSheet open={open} onClose={onClose} label="Workout session" acc="workout">
      {summary ? (
        <SessionSummary s={summary} onClose={() => { setSummary(null); onClose(); }} />
      ) : move && ex ? (
        <>
          <div className="row" style={{ padding: 'calc(var(--st) + 12px) 18px 6px' }}>
            <button type="button" className="icon-btn" aria-label="Minimise session" onClick={onClose}><Icon name="back" /></button>
            <div style={{ flex: 1 }} className="stack">
              <span className="small muted" style={{ fontWeight: 700 }}>{plan.title} · {idx + 1} of {moves.length}</span>
              <div role="img" aria-label={`Move ${idx + 1} of ${moves.length}`} style={{ display: 'grid', gridTemplateColumns: `repeat(${moves.length}, minmax(0,1fr))`, gap: 4, marginTop: 6 }}>
                {moves.map((m, i) => (
                  <span key={m.exId} style={{ height: 5, borderRadius: 99, background: doneMove(m) ? 'var(--acc)' : i === idx ? 'color-mix(in srgb, var(--acc) 45%, transparent)' : 'var(--card-2)' }} />
                ))}
              </div>
            </div>
            <button type="button" className="btn sm ghost" onClick={finish}>Finish</button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 18px 12px' }} className="stack">
            <Gif src={gifSrc(ex)} alt={`${ex.name} demonstration`} style={{ width: '100%', height: 250, objectFit: 'contain', background: '#fff', borderRadius: 22 }} />
            <div className="between" style={{ alignItems: 'flex-start' }}>
              <h1 className="h1" style={{ fontSize: 28 }}>{ex.name}</h1>
              <span className="pill" style={{ whiteSpace: 'nowrap' }}>{move.sets} × {move.reps}{move.unit === 'min' ? ' min' : ''}</span>
            </div>
            {ex.cue ? <p className="muted">{ex.cue}</p> : null}
            <div className="stack" style={{ gap: 6 }}>
              {sets.map((s) => (
                <div key={s.at} className="list-row" style={{ padding: '10px 14px' }}>
                  <span className="icon-btn solid" style={{ width: 28, height: 28 }} aria-hidden="true"><Icon name="check" size={14} stroke={3} /></span>
                  <strong>Set {s.set}</strong><span className="spacer" />
                  <span className="muted">{isStretch ? `${s.reps} ${move.unit === 'min' ? 'min' : 'reps'}` : `${s.kg} kg × ${s.reps}`}</span>
                </div>
              ))}
            </div>
            {rest > 0 ? (
              <div className="card tight between" role="timer" aria-live="polite">
                <span className="row" style={{ gap: 8 }}><Icon name="timer" size={20} /><strong>Rest {Math.floor(rest / 60)}:{String(rest % 60).padStart(2, '0')}</strong></span>
                <button type="button" className="btn sm ghost" onClick={() => setRest(0)}>Skip</button>
              </div>
            ) : null}
          </div>

          <div style={{ padding: '14px 18px calc(var(--sb) + 18px)', borderTop: '1px solid var(--line)', background: 'var(--bg-2)' }} className="stack">
            {sets.length < move.sets ? (
              <>
                <div className={isStretch ? '' : 'grid2'}>
                  {!isStretch ? <div className="field">Weight<Stepper label="weight" value={kg} step={2.5} decimals={1} min={0} max={300} unit="kg" onChange={setKg} /></div> : null}
                  <div className="field">{move.unit === 'min' ? 'Minutes' : 'Reps'}<Stepper label="reps" value={reps} min={1} max={200} onChange={setReps} /></div>
                </div>
                <button type="button" className="btn lg block" onClick={logSet}>{isStretch ? `Done · set ${sets.length + 1}` : `Log set ${sets.length + 1}`}</button>
              </>
            ) : (
              <>
                <p className="ok-t" style={{ fontWeight: 700 }}>All {move.sets} sets done.</p>
                {idx < moves.length - 1 ? (
                  <button type="button" className="btn lg block" onClick={() => setIdx(idx + 1)}>Next: {exById[moves[idx + 1].exId]?.name} <Icon name="next" size={18} /></button>
                ) : (
                  <button type="button" className="btn lg block" onClick={finish}>{allDone ? 'Finish workout' : 'Finish anyway'}</button>
                )}
              </>
            )}
            <div className="between">
              <button type="button" className="btn quiet" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>Previous</button>
              {sets.length ? <button type="button" className="btn quiet" onClick={undo}>Undo last set</button> : null}
              <button type="button" className="btn quiet" disabled={idx >= moves.length - 1} onClick={() => setIdx(idx + 1)}>Skip</button>
            </div>
          </div>
        </>
      ) : null}
    </FullSheet>
  );
}

function SessionSummary({ s, onClose }: { s: Session; onClose: () => void }) {
  const { data, exById } = useStore();
  const minutes = s.endedAt ? Math.max(1, Math.round((s.endedAt - s.startedAt) / 60000)) : 0;
  const volume = Math.round(s.sets.reduce((a, x) => a + x.kg * x.reps, 0));
  const prs = useMemo(() => {
    const ids = [...new Set(s.sets.map((x) => x.exId))];
    return ids
      .map((id) => {
        const best = Math.max(...s.sets.filter((x) => x.exId === id).map((x) => x.kg));
        const prev = lastWeight(data, id, s.id);
        return best > 0 && (!prev || best > prev.kg) ? { name: exById[id]?.name || id, kg: best, prev: prev?.kg } : null;
      })
      .filter(Boolean) as { name: string; kg: number; prev?: number }[];
  }, [s, data, exById]);
  return (
    <div className="screen no-nav" data-acc="workout" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="glow" />
      <div className="stack" style={{ gap: 16, flex: 1 }}>
        <p className="eyebrow">Workout done</p>
        <h1 className="h1" style={{ fontSize: 44 }}>Strong work, {data.profile.name}.</h1>
        <div className="grid3">
          <div className="card tight"><p className="eyebrow">Time</p><p className="big" style={{ fontSize: 28 }}>{minutes}<span className="small"> min</span></p></div>
          <div className="card tight"><p className="eyebrow">Sets</p><p className="big" style={{ fontSize: 28 }}>{s.sets.length}</p></div>
          <div className="card tight"><p className="eyebrow">Volume</p><p className="big" style={{ fontSize: 28 }}>{volume.toLocaleString('en-IN')}<span className="small"> kg</span></p></div>
        </div>
        {prs.length ? (
          <div className="card hero stack" style={{ gap: 8 }}>
            <p className="eyebrow acc-t">New personal bests</p>
            {prs.map((p) => <p key={p.name}><strong>{p.name}</strong> — {p.kg} kg{p.prev ? <span className="muted"> (was {p.prev} kg)</span> : null}</p>)}
          </div>
        ) : null}
        <span className="spacer" />
        <button type="button" className="btn lg block" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}

/* ---------------- History ---------------- */

function History() {
  const { data, exById } = useStore();
  const perWeek = sessionsPerWeek(data, 4);
  const max = Math.max(3, ...perWeek);
  const exIds = [...new Set(data.sessions.flatMap((s) => s.sets.map((x) => x.exId)))].filter((id) => exById[id]?.group !== 'stretching');
  const recent = [...data.sessions].filter((s) => s.sets.length).sort((a, b) => b.startedAt - a.startedAt).slice(0, 12);
  const [tab, setTab] = useState<'ex' | 'sessions'>('ex');

  return (
    <div className="stack" style={{ gap: 14 }}>
      <section className="card between" aria-label="Sessions per week">
        <div>
          <p className="eyebrow">Sessions per week</p>
          <p className="big" style={{ fontSize: 34 }}>{perWeek[3]}<span className="small muted" style={{ fontFamily: 'var(--body)', fontWeight: 500 }}> this week</span></p>
          <p className="small muted">{perWeek.reduce((a, b) => a + b, 0)} in the last 4 weeks</p>
        </div>
        <div className="chart" role="img" aria-label={`Sessions per week: ${perWeek.join(', ')}`} style={{ height: 70, width: 120, borderBottom: 'none', gap: 8 }}>
          {perWeek.map((n, i) => <i key={i} className={i === 3 ? '' : 'dim'} style={{ height: `${Math.max(6, (n / max) * 70)}px` }} />)}
        </div>
      </section>
      <Seg<'ex' | 'sessions'> label="History view" value={tab} onChange={setTab} options={[{ v: 'ex', l: 'By exercise' }, { v: 'sessions', l: 'Sessions' }]} />
      {tab === 'ex' ? (
        exIds.length ? exIds.map((id) => {
          const h = exerciseHistory(data, id).slice(-6);
          const best = Math.max(...h.map((x) => x.best));
          const first = h[0]?.best ?? 0;
          const ex = exById[id];
          return (
            <div key={id} className="list-row" style={{ padding: 10 }}>
              <Gif className="thumb" src={gifSrc(ex)} alt="" />
              <span style={{ flex: 1, minWidth: 0 }} className="stack">
                <strong>{ex?.name}</strong>
                <span className="small muted">Best {best} kg · {h.length} session{h.length === 1 ? '' : 's'}</span>
                {best > first ? <span className="small ok-t" style={{ fontWeight: 700 }}>+{Number((best - first).toFixed(1))} kg since {shortLabel(h[0].date)}</span> : null}
              </span>
              <div className="chart" role="img" aria-label={`Recent best weights: ${h.map((x) => x.best).join(', ')} kg`} style={{ height: 44, width: 70, gap: 3, borderBottom: 'none' }}>
                {h.map((x, i) => <i key={i} className={i === h.length - 1 ? '' : 'dim'} style={{ height: `${Math.max(5, (x.best / (best || 1)) * 44)}px`, borderRadius: 3 }} />)}
              </div>
            </div>
          );
        }) : <div className="empty">Log your first set and your progress shows up here.</div>
      ) : recent.length ? recent.map((s) => {
        const dd = parseKey(s.date);
        return (
          <div key={s.id} className="list-row">
            <div style={{ width: 48, textAlign: 'center', flex: 'none' }}>
              <div className="small muted" style={{ fontWeight: 700 }}>{DOW_SHORT[dd.getDay()]}</div>
              <div className="big" style={{ fontSize: 24 }}>{dd.getDate()}</div>
            </div>
            <span style={{ flex: 1 }}><strong>{s.title}</strong><span className="small muted" style={{ display: 'block' }}>{new Set(s.sets.map((x) => x.exId)).size} moves · {s.sets.length} sets{s.endedAt ? ` · ${Math.max(1, Math.round((s.endedAt - s.startedAt) / 60000))} min` : ' · in progress'}</span></span>
          </div>
        );
      }) : <div className="empty">No sessions yet.</div>}
    </div>
  );
}
