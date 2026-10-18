import { useRef, useState } from 'react';
import { BUNDLED, refreshContent } from '../lib/content';
import { DOW_FULL, DOW_LETTER, keyOf, shortLabel } from '../lib/dates';
import { exportBackup, haptic, readBackupFile, shareReport, syncReminders } from '../lib/native';
import { useStore } from '../lib/store';
import { emptyData, Reminders, ShareCycle } from '../lib/types';
import { FullSheet, Icon, Sheet, Stepper, toast, Toggle, TopBar } from '../ui';

export const APP_VERSION = '1.0.0';

export default function Settings({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, content, update, replaceAll } = useStore();
  const p = data.profile;
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<ReturnType<typeof readBackupFile>>(null);
  const [resetStep, setResetStep] = useState(0);
  const [checking, setChecking] = useState(false);

  const setProfile = (patch: Partial<typeof p>) => update((d) => ({ ...d, profile: { ...d.profile, ...patch } }));

  async function setRem(k: keyof Reminders, v: boolean) {
    const rem = { ...data.reminders, [k]: v };
    update((d) => ({ ...d, reminders: rem }));
    const r = await syncReminders(rem, p.gymDays, p.name);
    if (r === 'denied') toast('Allow notifications for Sapna Health in phone Settings.');
  }
  async function setGymDays(days: number[]) {
    setProfile({ gymDays: days });
    await syncReminders(data.reminders, days, p.name);
  }
  async function backup() {
    const ok = await exportBackup(data);
    if (ok) {
      update((d) => ({ ...d, lastBackupAt: Date.now() }));
      toast('Backup ready — save it to Drive or send it to yourself.');
    }
  }
  async function onFile(f: File | undefined) {
    if (!f) return;
    const parsed = readBackupFile(await f.text());
    if (!parsed) { toast("That file isn't a Sapna Health backup."); return; }
    setPending(parsed);
  }
  async function check() {
    setChecking(true);
    const fresh = await refreshContent(content);
    setChecking(false);
    toast(fresh ? 'New plan downloaded — reopen the app to see it.' : 'You already have the latest plan.');
  }

  return (
    <FullSheet open={open} onClose={onClose} label="Settings" acc="today">
      <TopBar onBack={onClose} title="Settings" />
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 18px calc(var(--sb) + 30px)' }} className="stack">

        <section className="card stack" style={{ gap: 14 }} aria-label="Backup">
          <div className="row"><span className="acc-t"><Icon name="lock" /></span><h2 className="h2" style={{ fontSize: 19 }}>Your data</h2></div>
          <p className="small muted">Everything is stored only on this phone. Android's backup (Settings › Google › Backup) copies it to your Google account automatically, so reinstalling restores it. For extra safety, save a file now and then.</p>
          <div className="grid2">
            <button type="button" className="btn" onClick={backup}><Icon name="share" size={18} /> Export</button>
            <button type="button" className="btn ghost" onClick={() => fileRef.current?.click()}>Restore</button>
          </div>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
          <p className="small faint">{data.lastBackupAt ? `Last exported ${shortLabel(keyOf(new Date(data.lastBackupAt)))}` : 'Never exported'} · {data.food.length} food logs · {data.sessions.length} workout{data.sessions.length === 1 ? '' : 's'}</p>
        </section>

        <section className="card stack" style={{ gap: 10 }} aria-label="Share with Rishu" data-acc="cycle">
          <h2 className="h2" style={{ fontSize: 19 }}>Send Rishu my week</h2>
          <p className="small muted">A summary file you choose to share — never automatic.</p>
          <button type="button" className="btn" onClick={async () => { const ok = await shareReport(data, content); if (ok) update((d) => ({ ...d, lastReportAt: Date.now() })); }}><Icon name="share" size={18} /> Share my week</button>
          <span className="h3" style={{ marginTop: 6 }}>Cycle in the report</span>
          <div className="chips" role="group" aria-label="Cycle sharing">
            {([['phase', 'Phase only'], ['all', 'Everything'], ['none', 'Nothing']] as [ShareCycle, string][]).map(([k, l]) => (
              <button key={k} type="button" className="chip" aria-pressed={p.shareCycle === k} onClick={() => setProfile({ shareCycle: k })}>{l}</button>
            ))}
          </div>
        </section>

        <section className="card" style={{ padding: '6px 16px' }} aria-label="Reminders">
          <h2 className="h2" style={{ fontSize: 19, padding: '10px 0 4px' }}>Reminders</h2>
          {([
            ['meals', 'Log meals', '1:30 pm and 8:30 pm'],
            ['water', 'Water', 'Every 2 hours, 9 am – 7 pm'],
            ['gym', 'Workout days', '6:30 pm on gym days'],
            ['weigh', 'Weekly weigh-in', 'Sunday 8 am'],
          ] as [keyof Reminders, string, string][]).map(([k, l, w], i, a) => (
            <div key={k} className="between" style={{ padding: '13px 0', borderBottom: i < a.length - 1 ? '1px solid var(--line)' : 'none' }}>
              <div><strong>{l}</strong><p className="small muted">{w}</p></div>
              <Toggle label={l} on={data.reminders[k]} onChange={(v) => setRem(k, v)} />
            </div>
          ))}
        </section>

        <section className="card stack" style={{ gap: 14 }} aria-label="Profile" data-acc="workout">
          <h2 className="h2" style={{ fontSize: 19 }}>Profile</h2>
          <label className="field">Name<input className="input" value={p.name} onChange={(e) => setProfile({ name: e.target.value })} /></label>
          <div className="field">Height<Stepper label="height" value={p.heightCm} unit="cm" min={120} max={210} onChange={(v) => setProfile({ heightCm: v })} /></div>
          <div className="stack" style={{ gap: 8 }}>
            <span className="h3">Gym days</span>
            <div role="group" aria-label="Gym days" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0,1fr))', gap: 6 }}>
              {DOW_LETTER.map((l, i) => {
                const on = p.gymDays.includes(i);
                return <button key={i} type="button" className="chip" aria-label={DOW_FULL[i]} aria-pressed={on} style={{ padding: 0, justifyContent: 'center', borderRadius: 14 }} onClick={() => setGymDays(on ? p.gymDays.filter((x) => x !== i) : [...p.gymDays, i].sort())}>{l}</button>;
              })}
            </div>
          </div>
        </section>

        <section className="card stack" style={{ gap: 14 }} aria-label="Cycle settings" data-acc="cycle">
          <div className="between"><h2 className="h2" style={{ fontSize: 19 }}>Cycle tracking</h2><Toggle label="Cycle tracking" on={p.cycleEnabled} onChange={(v) => setProfile({ cycleEnabled: v })} /></div>
          {p.cycleEnabled ? (
            <>
              <div className="between"><span>Usual cycle</span><div style={{ width: 170 }}><Stepper label="cycle length" value={p.cycleLen} unit="days" min={21} max={40} onChange={(v) => setProfile({ cycleLen: v })} /></div></div>
              <div className="between"><span>Period length</span><div style={{ width: 170 }}><Stepper label="period length" value={p.periodLen} unit="days" min={2} max={10} onChange={(v) => setProfile({ periodLen: v })} /></div></div>
            </>
          ) : null}
        </section>

        <section className="card stack" style={{ gap: 10 }} aria-label="Plans from Rishu" data-acc="food">
          <h2 className="h2" style={{ fontSize: 19 }}>Plans from Rishu</h2>
          <p className="small muted">Targets {content.targets.kcal} kcal · {content.targets.protein} g protein · {content.plans.length} workout plans · {content.foods.length} foods. Updated {shortLabel(keyOf(new Date(content.updatedAt || BUNDLED.updatedAt)))}.</p>
          <button type="button" className="btn ghost" disabled={checking} onClick={check}>{checking ? 'Checking…' : 'Check for new plans'}</button>
        </section>

        <section className="stack" style={{ gap: 8, padding: '6px 2px' }}>
          <p className="small faint">Sapna Health {APP_VERSION} · made with love by Rishu for Suppu</p>
          <button type="button" className="btn quiet" style={{ color: 'var(--danger)', alignSelf: 'flex-start' }} onClick={() => setResetStep(1)}>Erase all data on this phone…</button>
        </section>
      </div>

      <Sheet open={!!pending} onClose={() => setPending(null)} label="Restore backup">
        {pending ? (
          <div className="stack" style={{ gap: 14 }}>
            <h2 className="h2">Restore this backup?</h2>
            <p className="muted">It has {pending.food?.length || 0} food logs and {pending.sessions?.length || 0} workouts. It replaces what's on this phone now ({data.food.length} food logs).</p>
            <button type="button" className="btn lg block" onClick={() => { replaceAll({ ...pending, onboarded: true }); setPending(null); haptic.success(); toast('Backup restored'); }}>Replace with backup</button>
            <button type="button" className="btn ghost block" onClick={() => setPending(null)}>Cancel</button>
          </div>
        ) : null}
      </Sheet>

      <Sheet open={resetStep > 0} onClose={() => setResetStep(0)} label="Erase data">
        <div className="stack" style={{ gap: 14 }}>
          <h2 className="h2">Erase everything?</h2>
          <p className="muted">All food logs, workouts, weigh-ins and cycle history on this phone are deleted. Export a backup first if you might want them back.</p>
          {resetStep === 1 ? (
            <button type="button" className="btn lg block" style={{ background: 'var(--danger)' }} onClick={() => setResetStep(2)}>Yes, erase</button>
          ) : (
            <button type="button" className="btn lg block" style={{ background: 'var(--danger)' }} onClick={() => { replaceAll(emptyData()); setResetStep(0); onClose(); }}>Tap again to confirm</button>
          )}
          <button type="button" className="btn ghost block" onClick={() => setResetStep(0)}>Keep my data</button>
        </div>
      </Sheet>
    </FullSheet>
  );
}
