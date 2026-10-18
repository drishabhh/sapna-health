import { useMemo, useRef, useState } from 'react';
import { addDays, DOW_FULL, DOW_LETTER, today } from '../lib/dates';
import { haptic, readBackupFile, syncReminders } from '../lib/native';
import { useStore } from '../lib/store';
import { Activity, DietType, Goal, Profile, Reminders, ShareCycle } from '../lib/types';
import { Icon, Seg, Stepper, toast, Toggle, useBack } from '../ui';

const FAV_IDS: { id: string; label: string; diet: DietType }[] = [
  { id: 'roti', label: 'Roti', diet: 'veg' },
  { id: 'dal', label: 'Dal', diet: 'veg' },
  { id: 'rice', label: 'Rice', diet: 'veg' },
  { id: 'thatte-idli', label: 'Thatte idli', diet: 'veg' },
  { id: 'idli', label: 'Idli', diet: 'veg' },
  { id: 'dosa', label: 'Dosa', diet: 'veg' },
  { id: 'poha', label: 'Poha', diet: 'veg' },
  { id: 'upma', label: 'Upma', diet: 'veg' },
  { id: 'paneer', label: 'Paneer', diet: 'veg' },
  { id: 'curd', label: 'Curd', diet: 'veg' },
  { id: 'rajma', label: 'Rajma', diet: 'veg' },
  { id: 'sprouts', label: 'Sprouts', diet: 'veg' },
  { id: 'chai', label: 'Chai', diet: 'veg' },
  { id: 'banana', label: 'Banana', diet: 'veg' },
  { id: 'oats', label: 'Oats', diet: 'veg' },
  { id: 'egg', label: 'Eggs', diet: 'egg' },
  { id: 'chicken', label: 'Chicken', diet: 'non' },
  { id: 'fish', label: 'Fish', diet: 'non' },
];

export default function Onboarding() {
  const { data, content, foods, update, replaceAll } = useStore();
  const [step, setStep] = useState(0);
  const [p, setP] = useState<Profile>({ ...data.profile });
  const [rem, setRem] = useState<Reminders>({ ...data.reminders });
  const [lastStart, setLastStart] = useState(addDays(today(), -10));
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP((x) => ({ ...x, [k]: v }));

  useBack(step > 0, () => setStep((s) => Math.max(0, s - 1)));

  // Map her picks to real library foods (fuzzy on name) so they float to the top of search.
  const favMatches = useMemo(() => {
    const out: Record<string, string> = {};
    FAV_IDS.forEach((f) => {
      const want = f.label.toLowerCase().replace(/s$/, '');
      const hit =
        foods.find((x) => x.name.toLowerCase() === want) ||
        foods.find((x) => x.name.toLowerCase().startsWith(want)) ||
        foods.find((x) => x.name.toLowerCase().includes(' ' + want));
      if (hit) out[f.id] = hit.id;
    });
    return out;
  }, [foods]);
  const favList = FAV_IDS.filter((f) => p.diet === 'non' || f.diet === 'veg' || (p.diet === 'egg' && f.diet === 'egg'));

  const next = () => { haptic.tap(); setStep((s) => s + 1); };

  async function finish() {
    haptic.success();
    const favFoods = p.favFoods;
    update((d) => {
      const cycle = { ...d.cycle };
      if (p.cycleEnabled && lastStart && lastStart <= today()) {
        for (let i = 0; i < p.periodLen; i++) {
          const k = addDays(lastStart, i);
          if (k <= today()) cycle[k] = { ...(cycle[k] || {}), flow: cycle[k]?.flow || 'medium' };
        }
      }
      const weighIns = d.weighIns.some((w) => w.date === today()) ? d.weighIns : [...d.weighIns, { date: today(), kg: p.weightKg }];
      return { ...d, onboarded: true, profile: { ...p, favFoods }, reminders: rem, cycle, weighIns };
    });
    const r = await syncReminders(rem, p.gymDays, p.name || 'Sapna');
    if (r === 'denied') toast('Reminders are off — allow notifications in Settings to turn them on.');
  }

  async function onImport(file: File | undefined) {
    if (!file) return;
    const d = readBackupFile(await file.text());
    if (!d) { toast("That file isn't a Sapna Health backup."); return; }
    replaceAll({ ...d, onboarded: true });
    toast('Backup restored — welcome back.');
  }

  const progress = (
    <div className="row" style={{ marginBottom: 6 }}>
      <button type="button" className="icon-btn" aria-label="Back" onClick={() => setStep(step - 1)}><Icon name="back" /></button>
      <div role="img" aria-label={`Step ${step} of 5`} style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 5 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} style={{ height: 5, borderRadius: 99, background: i <= step ? 'var(--acc)' : 'var(--card-2)', boxShadow: i <= step ? '0 0 10px var(--acc)' : 'none' }} />
        ))}
      </div>
      {step === 4 ? <button type="button" className="btn quiet" onClick={() => { set('cycleEnabled', false); next(); }}>Skip</button> : null}
    </div>
  );

  const acc = step === 4 ? 'cycle' : step === 3 ? 'food' : step === 2 ? 'workout' : 'today';

  return (
    <div className="screen no-nav" data-acc={acc} style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="glow" />

      {step === 0 && (
        <div className="stack" style={{ flex: 1, gap: 18 }}>
          <div aria-hidden="true" style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            {[{ r: 120, c: 'var(--coral)', p: 0.42 }, { r: 92, c: 'var(--lime)', p: 0.62 }, { r: 64, c: 'var(--amber)', p: 0.5 }, { r: 38, c: 'var(--pink)', p: 0.78 }].map((x, i) => {
              const circ = 2 * Math.PI * x.r;
              return (
                <svg key={i} width="280" height="280" viewBox="0 0 280 280" style={{ position: 'absolute' }}>
                  <circle cx="140" cy="140" r={x.r} fill="none" stroke="var(--card-2)" strokeWidth="16" />
                  <circle cx="140" cy="140" r={x.r} fill="none" stroke={x.c} strokeWidth="16" strokeLinecap="round" strokeDasharray={`${circ * x.p} ${circ}`} transform="rotate(-90 140 140)" style={{ filter: `drop-shadow(0 0 10px ${x.c})` }} />
                </svg>
              );
            })}
          </div>
          <p className="eyebrow">Made for Sapna, by Rishu</p>
          <h1 className="h1" style={{ fontSize: 44 }}>Food, gym and your cycle. One calm app.</h1>
          <p className="muted" style={{ fontSize: 17 }}>Two minutes of setup. Everything stays on this phone — nothing is shared unless you choose to.</p>
          <span className="spacer" />
          <button type="button" className="btn lg block" onClick={next}>Let's set you up</button>
          <button type="button" className="btn quiet" onClick={() => fileRef.current?.click()}>I have a backup file</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => onImport(e.target.files?.[0])} />
        </div>
      )}

      {step === 1 && (
        <div className="stack" style={{ flex: 1, gap: 18 }}>
          {progress}
          <h1 className="h1" style={{ fontSize: 34 }}>A little about you</h1>
          <p className="muted">Only used to size your day. Stays on this phone.</p>
          <label className="field">What should we call you?
            <input className="input" value={p.name} onChange={(e) => set('name', e.target.value)} autoComplete="given-name" />
          </label>
          <div className="grid2">
            <div className="field">Height<Stepper label="height" value={p.heightCm} unit="cm" min={120} max={210} onChange={(v) => set('heightCm', v)} /></div>
            <div className="field">Weight<Stepper label="weight" value={p.weightKg} unit="kg" step={0.5} decimals={1} min={30} max={200} onChange={(v) => set('weightKg', v)} /></div>
          </div>
          <div className="stack" style={{ gap: 8 }}>
            <span className="h3">How active is a normal day?</span>
            {([
              ['desk', 'Mostly sitting', 'Desk work, little walking'],
              ['light', 'On my feet sometimes', 'Some walking, chores, gym 2–3×/week'],
              ['active', 'Very active', 'On the move most of the day'],
            ] as [Activity, string, string][]).map(([k, l, h]) => (
              <button key={k} type="button" className="option" aria-pressed={p.activity === k} onClick={() => set('activity', k)}><strong>{l}</strong><span>{h}</span></button>
            ))}
          </div>
          <span className="spacer" />
          <button type="button" className="btn lg block" disabled={!p.name.trim()} onClick={next}>Continue</button>
        </div>
      )}

      {step === 2 && (
        <div className="stack" style={{ flex: 1, gap: 18 }}>
          {progress}
          <h1 className="h1" style={{ fontSize: 34 }}>What matters most right now?</h1>
          <div className="grid2">
            {([
              ['lose', 'Lose fat gently', 'Small, steady deficit'],
              ['strong', 'Get stronger', 'Lift more, eat enough'],
              ['energy', 'More energy', 'Steadier days'],
              ['keep', 'Stay where I am', 'Maintain and tone'],
            ] as [Goal, string, string][]).map(([k, l, h]) => (
              <button key={k} type="button" className="option" style={{ minHeight: 84 }} aria-pressed={p.goal === k} onClick={() => set('goal', k)}><strong>{l}</strong><span>{h}</span></button>
            ))}
          </div>
          <div className="stack" style={{ gap: 8 }}>
            <span className="h3">Gym days</span>
            <div role="group" aria-label="Gym days" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0,1fr))', gap: 6 }}>
              {DOW_LETTER.map((l, i) => {
                const on = p.gymDays.includes(i);
                return (
                  <button key={i} type="button" className="chip" aria-label={DOW_FULL[i]} aria-pressed={on} style={{ padding: 0, justifyContent: 'center', borderRadius: 14, minHeight: 46 }}
                    onClick={() => set('gymDays', on ? p.gymDays.filter((x) => x !== i) : [...p.gymDays, i].sort())}>{l}</button>
                );
              })}
            </div>
          </div>
          <div className="card ink" data-acc="food">
            <p className="eyebrow" style={{ color: 'var(--acc-t)' }}>Your daily targets</p>
            <div className="grid3" style={{ marginTop: 10 }}>
              <div><div className="big" style={{ fontSize: 26 }}>{content.targets.kcal.toLocaleString('en-IN')}</div><span className="small muted">kcal</span></div>
              <div><div className="big" style={{ fontSize: 26 }}>{content.targets.protein} g</div><span className="small muted">protein</span></div>
              <div><div className="big" style={{ fontSize: 26 }}>{p.gymDays.length}×</div><span className="small muted">gym / week</span></div>
            </div>
            <p className="small muted" style={{ marginTop: 10 }}>Set by Rishu — he can fine-tune these anytime.</p>
          </div>
          <span className="spacer" />
          <button type="button" className="btn lg block" onClick={next}>Looks good</button>
        </div>
      )}

      {step === 3 && (
        <div className="stack" style={{ flex: 1, gap: 18 }}>
          {progress}
          <h1 className="h1" style={{ fontSize: 34 }}>How do you eat?</h1>
          <p className="muted">Your picks show first when you log — one tap.</p>
          <Seg<DietType> label="Diet type" value={p.diet} onChange={(v) => set('diet', v)} options={[{ v: 'veg', l: 'Veg' }, { v: 'egg', l: 'Eggetarian' }, { v: 'non', l: 'Non-veg' }]} />
          <div className="between"><span className="h3">Foods you have most weeks</span><span className="small muted">{p.favFoods.length} picked</span></div>
          <div className="chips" role="group" aria-label="Usual foods">
            {favList.map((f) => {
              const fid = favMatches[f.id];
              if (!fid) return null;
              const on = p.favFoods.includes(fid);
              return (
                <button key={f.id} type="button" className="chip" aria-pressed={on} onClick={() => set('favFoods', on ? p.favFoods.filter((x) => x !== fid) : [...p.favFoods, fid])}>{f.label}</button>
              );
            })}
          </div>
          <label className="field">Anything you avoid? <span className="small muted" style={{ fontWeight: 500 }}>Optional</span>
            <input className="input" value={p.avoid} placeholder="e.g. mushrooms, very spicy food" onChange={(e) => set('avoid', e.target.value)} />
          </label>
          <span className="spacer" />
          <button type="button" className="btn lg block" onClick={next}>Continue</button>
        </div>
      )}

      {step === 4 && (
        <div className="stack" style={{ flex: 1, gap: 16 }}>
          {progress}
          <h1 className="h1" style={{ fontSize: 34 }}>Track your cycle?</h1>
          <p className="muted">Workout tips adjust to your phase. Private by default.</p>
          <div className="card stack" style={{ gap: 12 }}>
            <label className="between"><span className="h3">Last period started</span>
              <input type="date" className="input" style={{ width: 170, minHeight: 46 }} value={lastStart} max={today()} onChange={(e) => setLastStart(e.target.value)} />
            </label>
            <div className="divider" />
            <div className="between"><span className="h3">Cycle usually lasts</span><div style={{ width: 170 }}><Stepper label="cycle length" value={p.cycleLen} unit="days" min={21} max={40} onChange={(v) => set('cycleLen', v)} /></div></div>
            <div className="divider" />
            <div className="between"><span className="h3">Period lasts</span><div style={{ width: 170 }}><Stepper label="period length" value={p.periodLen} unit="days" min={2} max={10} onChange={(v) => set('periodLen', v)} /></div></div>
          </div>
          <div className="stack" style={{ gap: 8 }}>
            <span className="h3">If you send Rishu your week, include…</span>
            {([
              ['phase', 'Phase only', 'e.g. "Luteal — energy may dip". No dates or symptoms.'],
              ['all', 'Everything', 'Dates, flow and symptoms'],
              ['none', 'Nothing', 'Cycle stays fully private'],
            ] as [ShareCycle, string, string][]).map(([k, l, h]) => (
              <button key={k} type="button" className="option" aria-pressed={p.shareCycle === k} onClick={() => set('shareCycle', k)}><strong>{l}</strong><span>{h}</span></button>
            ))}
          </div>
          <button type="button" className="btn lg block" onClick={() => { set('cycleEnabled', true); next(); }}>Turn on cycle tracking</button>
        </div>
      )}

      {step === 5 && (
        <div className="stack" style={{ flex: 1, gap: 18 }}>
          {progress}
          <h1 className="h1" style={{ fontSize: 34 }}>Gentle reminders</h1>
          <p className="muted">Little nudges, never spam. Change them anytime in Settings.</p>
          <div className="card" style={{ padding: '4px 16px' }}>
            {([
              ['meals', 'Log meals', '1:30 pm and 8:30 pm'],
              ['water', 'Water', 'Every 2 hours, 9 am – 7 pm'],
              ['gym', 'Workout days', `${p.gymDays.map((d) => DOW_FULL[d].slice(0, 3)).join(' · ') || 'No days picked'} at 6:30 pm`],
              ['weigh', 'Weekly weigh-in', 'Sunday 8 am'],
            ] as [keyof Reminders, string, string][]).map(([k, l, w], i, a) => (
              <div key={k} className="between" style={{ padding: '14px 0', borderBottom: i < a.length - 1 ? '1px solid var(--line)' : 'none' }}>
                <div><strong>{l}</strong><p className="small muted">{w}</p></div>
                <Toggle label={l} on={rem[k]} onChange={(v) => setRem((r) => ({ ...r, [k]: v }))} />
              </div>
            ))}
          </div>
          <div className="row small muted" style={{ alignItems: 'flex-start' }}>
            <Icon name="lock" size={18} />
            <p>Your logs never leave this phone. Android backs them up to your Google account, so reinstalling brings everything back.</p>
          </div>
          <span className="spacer" />
          <button type="button" className="btn lg block" onClick={finish}>Go to Today</button>
        </div>
      )}
    </div>
  );
}
