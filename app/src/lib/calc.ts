import { addDays, diffDays, dow, keyOf, parseKey, today } from './dates';
import { AppData, Content, FoodEntry, Meal, Plan, Session } from './types';

export const r1 = (n: number) => Math.round(n * 10) / 10;

export function entriesOn(d: AppData, date: string): FoodEntry[] {
  return d.food.filter((f) => f.date === date);
}

export function totalsOn(d: AppData, date: string) {
  const es = entriesOn(d, date);
  return {
    kcal: Math.round(es.reduce((s, e) => s + e.kcal, 0)),
    protein: r1(es.reduce((s, e) => s + e.protein, 0)),
    count: es.length,
  };
}

export function mealTotals(d: AppData, date: string, meal: Meal) {
  const es = d.food.filter((f) => f.date === date && f.meal === meal);
  return { kcal: Math.round(es.reduce((s, e) => s + e.kcal, 0)), protein: r1(es.reduce((s, e) => s + e.protein, 0)), entries: es };
}

/** Consecutive days (ending today, or yesterday if today has nothing yet) with at least one food log. */
export function logStreak(d: AppData): number {
  const days = new Set(d.food.map((f) => f.date));
  let k = today();
  if (!days.has(k)) k = addDays(k, -1);
  let n = 0;
  while (days.has(k)) {
    n++;
    k = addDays(k, -1);
  }
  return n;
}

export function mealFor(hour = new Date().getHours()): Meal {
  if (hour < 11) return 'breakfast';
  if (hour < 16) return 'lunch';
  if (hour < 19) return 'snacks';
  return 'dinner';
}

/* ---------- Workouts ---------- */

export function sessionsOn(d: AppData, date: string): Session[] {
  return d.sessions.filter((s) => s.date === date);
}

/** Next plan in rotation after her most recent finished session. */
export function nextPlan(d: AppData, c: Content): Plan | null {
  if (!c.plans.length) return null;
  const last = [...d.sessions].filter((s) => s.sets.length > 0).sort((a, b) => b.startedAt - a.startedAt)[0];
  if (!last) return c.plans[0];
  const i = c.plans.findIndex((p) => p.id === last.planId);
  if (last.date === today()) return c.plans[Math.max(0, i)] || c.plans[0];
  return c.plans[(i + 1) % c.plans.length] || c.plans[0];
}

export function isGymDay(d: AppData, date = today()): boolean {
  return d.profile.gymDays.includes(dow(date));
}

/** Most recent weight she lifted for an exercise (before the given session). */
export function lastWeight(d: AppData, exId: string, excludeSessionId?: string): { kg: number; reps: number; date: string } | null {
  const ss = [...d.sessions].filter((s) => s.id !== excludeSessionId).sort((a, b) => b.startedAt - a.startedAt);
  for (const s of ss) {
    const sets = s.sets.filter((x) => x.exId === exId);
    if (sets.length) {
      const best = sets.reduce((a, b) => (b.kg > a.kg ? b : a));
      return { kg: best.kg, reps: best.reps, date: s.date };
    }
  }
  return null;
}

export function exerciseHistory(d: AppData, exId: string) {
  return [...d.sessions]
    .sort((a, b) => a.startedAt - b.startedAt)
    .map((s) => {
      const sets = s.sets.filter((x) => x.exId === exId);
      if (!sets.length) return null;
      return { date: s.date, best: Math.max(...sets.map((x) => x.kg)), sets: sets.length };
    })
    .filter((x): x is { date: string; best: number; sets: number } => !!x);
}

export function sessionsPerWeek(d: AppData, weeks = 4): number[] {
  const t = today();
  const out: number[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const end = addDays(t, -7 * w);
    const start = addDays(end, -6);
    out.push(new Set(d.sessions.filter((s) => s.sets.length && s.date >= start && s.date <= end).map((s) => s.date)).size);
  }
  return out;
}

/* ---------- Cycle ---------- */

export type Phase = 'period' | 'follicular' | 'ovulation' | 'luteal';

export function periodStarts(d: AppData): string[] {
  const days = Object.keys(d.cycle)
    .filter((k) => d.cycle[k]?.flow && d.cycle[k].flow !== 'none')
    .sort();
  const set = new Set(days);
  return days.filter((k) => !set.has(addDays(k, -1)));
}

export function avgCycleLen(d: AppData): number {
  const s = periodStarts(d);
  const gaps: number[] = [];
  for (let i = 1; i < s.length; i++) {
    const g = diffDays(s[i], s[i - 1]);
    if (g >= 18 && g <= 45) gaps.push(g);
  }
  if (!gaps.length) return d.profile.cycleLen;
  const recent = gaps.slice(-4);
  return Math.round(recent.reduce((a, b) => a + b, 0) / recent.length);
}

export interface CycleInfo {
  hasData: boolean;
  day: number;
  length: number;
  phase: Phase;
  nextStart: string;
  daysToNext: number;
  fertile: [string, string];
  lastStart: string;
}

export function cycleInfo(d: AppData, on = today()): CycleInfo | null {
  const starts = periodStarts(d).filter((s) => s <= on);
  if (!starts.length) return null;
  const lastStart = starts[starts.length - 1];
  const length = avgCycleLen(d);
  let day = diffDays(on, lastStart) + 1;
  const nextStart = addDays(lastStart, length); // may be in the past when late
  if (day < 1) day = 1;
  const ovu = addDays(nextStart, -14);
  const fertile: [string, string] = [addDays(ovu, -4), addDays(ovu, 1)];
  const inPeriod = !!d.cycle[on]?.flow && d.cycle[on].flow !== 'none';
  let phase: Phase;
  if (inPeriod || day <= d.profile.periodLen) phase = 'period';
  else if (on >= addDays(ovu, -2) && on <= addDays(ovu, 1)) phase = 'ovulation';
  else if (on < ovu) phase = 'follicular';
  else phase = 'luteal';
  return { hasData: true, day, length, phase, nextStart, daysToNext: diffDays(nextStart, on), fertile, lastStart };
}

export function isPredictedPeriod(d: AppData, k: string, info: CycleInfo | null): boolean {
  if (!info) return false;
  if (k < today()) return false;
  const off = diffDays(k, info.nextStart);
  return off >= 0 && off < d.profile.periodLen;
}

export const PHASE_COPY: Record<Phase, { label: string; tip: string; gym: string }> = {
  period: {
    label: 'Period',
    tip: 'Go gentle. Warm water, iron-rich food like dal, spinach and chana help.',
    gym: 'Lighter weights or just stretching and a walk are perfectly fine today.',
  },
  follicular: {
    label: 'Follicular',
    tip: 'Energy usually climbs this week — a good time to push a little.',
    gym: 'Try adding 2.5 kg on a move that felt easy last time.',
  },
  ovulation: {
    label: 'Ovulation',
    tip: 'Often your strongest days. Stay hydrated.',
    gym: 'Great days for your best sets — keep form tight.',
  },
  luteal: {
    label: 'Luteal',
    tip: 'Energy and mood can dip before your period. Cravings are normal.',
    gym: "Keep weights where they are and add an extra stretch.",
  },
};

/* ---------- Misc ---------- */

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function last7(): string[] {
  const t = today();
  return Array.from({ length: 7 }, (_, i) => addDays(t, i - 6));
}

export function monthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1, 12);
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array(first.getDay()).fill(null);
  for (let i = 1; i <= days; i++) cells.push(keyOf(new Date(year, month, i, 12)));
  while (cells.length % 7) cells.push(null);
  return cells;
}

export function weekdayOf(k: string) {
  return parseKey(k).getDay();
}
