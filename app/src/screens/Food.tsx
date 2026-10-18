import { useState } from 'react';
import { mealTotals, r1, totalsOn } from '../lib/calc';
import { addDays, longLabel, today } from '../lib/dates';
import { haptic } from '../lib/native';
import { useStore } from '../lib/store';
import { FoodEntry, MEALS } from '../lib/types';
import { useNav } from '../nav';
import { Bar, Icon, Sheet, Stepper, toast } from '../ui';

export default function FoodScreen() {
  const { data, content, update } = useStore();
  const nav = useNav();
  const [day, setDay] = useState(today());
  const [edit, setEdit] = useState<FoodEntry | null>(null);
  const [mult, setMult] = useState(1);
  const t = totalsOn(data, day);
  const isToday = day === today();

  function saveEdit() {
    if (!edit) return;
    const per = { kcal: edit.kcal / edit.mult, protein: edit.protein / edit.mult };
    update((d) => ({
      ...d,
      food: d.food.map((f) => (f.id === edit.id ? { ...f, mult, kcal: Math.round(per.kcal * mult), protein: r1(per.protein * mult) } : f)),
    }));
    haptic.tap();
    setEdit(null);
  }
  function remove() {
    if (!edit) return;
    const gone = edit;
    update((d) => ({ ...d, food: d.food.filter((f) => f.id !== gone.id) }));
    toast(`Removed ${gone.name}`);
    setEdit(null);
  }

  return (
    <div className="screen" data-acc="food">
      <div className="glow" />
      <div className="stack" style={{ gap: 16 }}>
        <header className="stack" style={{ gap: 4 }}>
          <p className="eyebrow">Food log</p>
          <h1 className="h1">{isToday ? 'Today’s plate' : 'Your plate'}</h1>
        </header>

        <div className="row">
          <button type="button" className="icon-btn" aria-label="Previous day" onClick={() => setDay(addDays(day, -1))}><Icon name="back" /></button>
          <strong style={{ flex: 1, textAlign: 'center' }}>{isToday ? 'Today' : longLabel(day)}</strong>
          <button type="button" className="icon-btn" aria-label="Next day" disabled={isToday} style={isToday ? { opacity: 0.35 } : undefined} onClick={() => setDay(addDays(day, 1))}><Icon name="next" /></button>
        </div>

        <section className="card hero grid2" aria-label="Day totals">
          <div className="stack" style={{ gap: 6 }}>
            <p className="eyebrow">Calories</p>
            <p className="big" style={{ fontSize: 32 }}>{t.kcal.toLocaleString('en-IN')}</p>
            <Bar value={t.kcal} max={content.targets.kcal} label={`${t.kcal} of ${content.targets.kcal} kcal`} color={t.kcal > content.targets.kcal ? 'var(--danger)' : 'var(--coral)'} />
            <p className="small muted">of {content.targets.kcal.toLocaleString('en-IN')}</p>
          </div>
          <div className="stack" style={{ gap: 6 }}>
            <p className="eyebrow">Protein</p>
            <p className="big acc-t" style={{ fontSize: 32 }}>{t.protein}<span style={{ fontSize: 16 }}> g</span></p>
            <Bar value={t.protein} max={content.targets.protein} label={`${t.protein} of ${content.targets.protein} grams protein`} />
            <p className="small muted">of {content.targets.protein} g</p>
          </div>
        </section>

        {MEALS.map((m) => {
          const mt = mealTotals(data, day, m.id);
          return (
            <section key={m.id} className="card" aria-label={m.label} style={{ padding: 14 }}>
              <div className="between">
                <div><h2 className="h3" style={{ fontSize: 17 }}>{m.label}</h2><p className="small muted">{mt.kcal} kcal · {mt.protein} g protein</p></div>
                <button type="button" className="icon-btn solid" aria-label={`Add to ${m.label}`} onClick={() => nav.openLogger(m.id, day)}><Icon name="plus" size={20} stroke={2.6} /></button>
              </div>
              {mt.entries.length ? (
                <div className="stack" style={{ gap: 0, marginTop: 8 }}>
                  {mt.entries.map((e) => (
                    <button key={e.id} type="button" className="between" style={{ border: 'none', background: 'transparent', color: 'var(--text)', padding: '11px 2px', borderTop: '1px solid var(--line)', textAlign: 'left', minHeight: 48 }}
                      onClick={() => { setEdit(e); setMult(e.mult); }}>
                      <span style={{ minWidth: 0 }}><strong style={{ fontWeight: 600 }}>{e.name}</strong> <span className="small muted">{e.mult !== 1 ? `${e.mult}× ` : ''}{e.portion}</span></span>
                      <span className="small" style={{ whiteSpace: 'nowrap' }}>{e.kcal} kcal</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      <Sheet open={!!edit} onClose={() => setEdit(null)} label="Edit food">
        {edit ? (
          <div className="stack" style={{ gap: 14 }} data-acc="food">
            <h2 className="h1" style={{ fontSize: 30 }}>{edit.name}</h2>
            <p className="muted">1× = {edit.portion}</p>
            <Stepper label="portion" value={mult} step={0.25} min={0.25} max={10} decimals={2} unit="×" onChange={setMult} />
            <p className="muted">{Math.round((edit.kcal / edit.mult) * mult)} kcal · {r1((edit.protein / edit.mult) * mult)} g protein</p>
            <button type="button" className="btn lg block" onClick={saveEdit}>Save</button>
            <button type="button" className="btn ghost block" style={{ color: 'var(--danger)' }} onClick={remove}><Icon name="trash" size={18} /> Remove from log</button>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
