import { useEffect, useMemo, useState } from 'react';
import { r1, totalsOn, uid } from '../lib/calc';
import { today } from '../lib/dates';
import { haptic } from '../lib/native';
import { useStore } from '../lib/store';
import { Food, Meal, MEALS } from '../lib/types';
import { Bar, FullSheet, Icon, Seg, Sheet, Stepper, toast } from '../ui';

const PORTIONS = [0.5, 1, 1.5, 2];
const portionLabel = (m: number) => (m === 0.5 ? '½' : m === 1.5 ? '1½' : String(m));

export function FoodLogger({ open, meal: initialMeal, date = today(), onClose }: { open: boolean; meal: Meal; date?: string; onClose: () => void }) {
  const { data, content, foods, update } = useStore();
  const [meal, setMeal] = useState<Meal>(initialMeal);
  const [q, setQ] = useState('');
  const [pick, setPick] = useState<Food | null>(null);
  const [mult, setMult] = useState(1);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) { setMeal(initialMeal); setQ(''); setPick(null); setCreating(false); }
  }, [open, initialMeal]);

  const t = totalsOn(data, date);
  const left = content.targets.kcal - t.kcal;

  // Recents: foods she logged most in the last 30 days, then her onboarding favourites.
  const recentIds = useMemo(() => {
    const counts: Record<string, number> = {};
    data.food.slice(-200).forEach((f) => (counts[f.foodId] = (counts[f.foodId] || 0) + 1));
    const ranked = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    return [...new Set([...ranked, ...data.profile.favFoods])];
  }, [data.food, data.profile.favFoods]);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) {
      const byId = Object.fromEntries(foods.map((f) => [f.id, f]));
      const rec = recentIds.map((id) => byId[id]).filter(Boolean) as Food[];
      return rec.length ? rec.slice(0, 12) : foods.slice(0, 12);
    }
    const words = s.split(/\s+/);
    return foods
      .map((f) => {
        const hay = `${f.name} ${(f.tags || []).join(' ')}`.toLowerCase();
        if (!words.every((w) => hay.includes(w))) return null;
        const score = (f.name.toLowerCase().startsWith(s) ? 0 : 1) + (recentIds.includes(f.id) ? -0.5 : 0);
        return { f, score };
      })
      .filter((x): x is { f: Food; score: number } => !!x)
      .sort((a, b) => a.score - b.score)
      .map((x) => x.f)
      .slice(0, 40);
  }, [q, foods, recentIds]);

  function add() {
    if (!pick) return;
    const kcal = Math.round(pick.kcal * mult);
    const protein = r1(pick.protein * mult);
    update((d) => ({
      ...d,
      food: [...d.food, { id: uid(), date, meal, foodId: pick.id, name: pick.name, portion: pick.portion, mult, kcal, protein, at: Date.now() }],
    }));
    haptic.success();
    toast(`Added ${pick.name} · ${kcal} kcal`);
    setPick(null);
    onClose();
  }

  const kcalNow = pick ? Math.round(pick.kcal * mult) : 0;
  const after = left - kcalNow;

  return (
    <>
      <FullSheet open={open} onClose={onClose} label="Add food" acc="food">
        <div style={{ padding: 'calc(var(--st) + 12px) 18px 10px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="row">
            <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><Icon name="close" /></button>
            <h1 className="h2" style={{ flex: 1 }}>Add food</h1>
            <span className="small muted"><strong className="acc-t">{Math.max(0, left)}</strong> kcal left</span>
          </div>
          <Seg<Meal> label="Meal" value={meal} onChange={setMeal} options={MEALS.map((m) => ({ v: m.id, l: m.label }))} />
          <label className="search">
            <Icon name="search" size={20} />
            <span className="sr">Search foods</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search roti, dal, paneer…" enterKeyHint="search" />
            {q ? <button type="button" className="icon-btn" style={{ width: 36, height: 36 }} aria-label="Clear search" onClick={() => setQ('')}><Icon name="close" size={16} /></button> : null}
          </label>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 18px calc(var(--sb) + 24px)' }}>
          <p className="eyebrow" style={{ margin: '6px 0 10px' }}>{q ? `${results.length} match${results.length === 1 ? '' : 'es'}` : recentIds.length ? 'Your usuals' : 'Popular'}</p>
          <div className="stack" style={{ gap: 8 }}>
            {results.map((f) => (
              <button key={f.id} type="button" className="list-row" onClick={() => { haptic.tap(); setPick(f); setMult(1); }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>{f.name}{f.protein >= 12 ? <span className="pill">High protein</span> : null}</strong>
                  <span className="small muted">{f.portion} · {f.kcal} kcal · {f.protein} g protein</span>
                </span>
                <span className="icon-btn solid" aria-hidden="true" style={{ width: 40, height: 40 }}><Icon name="plus" size={18} stroke={2.6} /></span>
              </button>
            ))}
            {q && results.length === 0 ? (
              <div className="empty stack" style={{ gap: 10 }}>
                <strong style={{ color: 'var(--text)' }}>"{q}" isn't in your library yet</strong>
                <span>Add it once with calories and protein — it'll show up next time.</span>
                <button type="button" className="btn sm" style={{ alignSelf: 'center' }} onClick={() => setCreating(true)}>Create “{q}”</button>
              </div>
            ) : null}
            {!q ? <button type="button" className="btn quiet" onClick={() => setCreating(true)}>+ Create a custom food</button> : null}
          </div>
        </div>
      </FullSheet>

      <Sheet open={!!pick} onClose={() => setPick(null)} label="Pick portion">
        {pick ? (
          <div className="stack" data-acc="food" style={{ gap: 16 }}>
            <div>
              <p className="eyebrow">Adding to {MEALS.find((m) => m.id === meal)?.label}</p>
              <h2 className="h1" style={{ fontSize: 34, marginTop: 4 }}>{pick.name}</h2>
              <p className="muted">1 = {pick.portion} · {pick.kcal} kcal</p>
            </div>
            <div role="group" aria-label="Portion" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 8 }}>
              {PORTIONS.map((m) => (
                <button key={m} type="button" className="chip" aria-pressed={mult === m} style={{ justifyContent: 'center', borderRadius: 14, minHeight: 50, fontSize: 16 }} onClick={() => { haptic.tap(); setMult(m); }}>{portionLabel(m)}×</button>
              ))}
            </div>
            <Stepper label="portion" value={mult} step={0.25} min={0.25} max={10} decimals={2} unit="×" onChange={setMult} />
            <div className="grid2">
              <div className="card tight"><p className="eyebrow">Calories</p><div className="big" style={{ fontSize: 34 }}>{kcalNow}</div></div>
              <div className="card tight"><p className="eyebrow">Protein</p><div className="big acc-t" style={{ fontSize: 34 }}>{r1(pick.protein * mult)}<span style={{ fontSize: 16 }}> g</span></div></div>
            </div>
            <div className="stack" style={{ gap: 6 }}>
              <div className="between small"><strong>After this</strong><span className={after < 0 ? '' : 'muted'} style={after < 0 ? { color: 'var(--danger)', fontWeight: 700 } : undefined}>{after >= 0 ? `${after} kcal left` : `${-after} kcal over`}</span></div>
              <Bar value={t.kcal + kcalNow} max={content.targets.kcal} label={`Day total after adding: ${t.kcal + kcalNow} of ${content.targets.kcal} kcal`} color={after < 0 ? 'var(--danger)' : undefined} />
            </div>
            <button type="button" className="btn lg block" onClick={add}>Add {portionLabel(mult)}× · {kcalNow} kcal</button>
          </div>
        ) : null}
      </Sheet>

      <CustomFoodSheet open={creating} initialName={q} onClose={() => setCreating(false)} onCreated={(f) => { setCreating(false); setPick(f); setMult(1); }} />
    </>
  );
}

function CustomFoodSheet({ open, initialName, onClose, onCreated }: { open: boolean; initialName: string; onClose: () => void; onCreated: (f: Food) => void }) {
  const { update } = useStore();
  const [name, setName] = useState('');
  const [portion, setPortion] = useState('1 serving');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  useEffect(() => {
    if (open) { setName(initialName); setPortion('1 serving'); setKcal(''); setProtein(''); }
  }, [open, initialName]);
  const k = Number(kcal);
  const p = Number(protein || 0);
  const ok = name.trim() && Number.isFinite(k) && k > 0 && Number.isFinite(p) && p >= 0;
  function save() {
    if (!ok) return;
    const f: Food = { id: 'custom-' + uid(), name: name.trim(), portion: portion.trim() || '1 serving', kcal: Math.round(k), protein: r1(p), custom: true };
    update((d) => ({ ...d, customFoods: [...d.customFoods, f] }));
    toast(`${f.name} saved to your library`);
    onCreated(f);
  }
  return (
    <Sheet open={open} onClose={onClose} label="Create custom food">
      <div className="stack" data-acc="food" style={{ gap: 14 }}>
        <h2 className="h2">New food</h2>
        <label className="field">Name<input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Besan chilla" /></label>
        <label className="field">Portion<input className="input" value={portion} onChange={(e) => setPortion(e.target.value)} placeholder="1 piece / 1 katori" /></label>
        <div className="grid2">
          <label className="field">Calories<input className="input" inputMode="numeric" value={kcal} onChange={(e) => setKcal(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="kcal" /></label>
          <label className="field">Protein (g)<input className="input" inputMode="decimal" value={protein} onChange={(e) => setProtein(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="g" /></label>
        </div>
        <p className="small muted">Tip: check the pack label, "per serving" row.</p>
        <button type="button" className="btn lg block" disabled={!ok} onClick={save}>Save & pick portion</button>
      </div>
    </Sheet>
  );
}
