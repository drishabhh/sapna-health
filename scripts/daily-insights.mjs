#!/usr/bin/env node
/**
 * Daily Insights (Gemini Path B) — GitHub Actions / local CLI
 *
 * Reads compact snapshot from repo JSON (weights, periods, today plan, diet defaults).
 * One Gemini call → data/insights/latest.json (+ optional dated copy).
 *
 * Requires env: GEMINI_API_KEY
 * Optional: GEMINI_MODEL (single override). Else tries MODEL_CANDIDATES in order.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = path.resolve(__dirname, "..");
/* Personal logs (weights, periods) + insights output live in the PRIVATE data repo.
   DATA_DIR points at its checkout; defaults to the site repo for local testing. */
const ROOT = path.resolve(process.env.DATA_DIR || SITE_ROOT);
const MODEL_CANDIDATES = [
  process.env.GEMINI_MODEL || "gemini-3.8-flash",
  "gemini-3.1-flash-lite",
  "gemini-flash-latest",
  "gemini-2.0-flash",
].filter((m, i, arr) => m && arr.indexOf(m) === i);

const TZ = "Asia/Kolkata";

function readJson(rel, fallback = null, base = ROOT) {
  const p = path.join(base, rel);
  if (!fs.existsSync(p)) return fallback;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function todayIST() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function isoDaysAgoIST(n) {
  const now = new Date();
  /* Approximate: shift by n days in UTC then format IST — good enough for 30d window */
  const d = new Date(now.getTime() - n * 86400000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function periodStarts(days) {
  const keys = Object.keys(days || {})
    .filter((k) => days[k]?.period)
    .sort();
  if (!keys.length) return [];
  const starts = [keys[0]];
  for (let i = 1; i < keys.length; i++) {
    const prev = new Date(keys[i - 1] + "T12:00:00");
    const cur = new Date(keys[i] + "T12:00:00");
    const gap = (cur - prev) / 86400000;
    if (gap > 2) starts.push(keys[i]);
  }
  return starts;
}

function periodCoach(periods) {
  const days = periods?.days || {};
  const today = todayIST();
  const starts = periodStarts(days);
  let cycleLen = null;
  let next = null;
  if (starts.length >= 2) {
    const gaps = [];
    for (let i = 1; i < starts.length; i++) {
      const a = new Date(starts[i - 1] + "T12:00:00");
      const b = new Date(starts[i] + "T12:00:00");
      gaps.push(Math.round((b - a) / 86400000));
    }
    cycleLen = Math.round(gaps.reduce((s, n) => s + n, 0) / gaps.length);
    const last = new Date(starts[starts.length - 1] + "T12:00:00");
    last.setDate(last.getDate() + cycleLen);
    next = last.toISOString().slice(0, 10);
  }
  const lastStart = starts.length ? starts[starts.length - 1] : null;
  let dayOfCycle = null;
  if (lastStart && cycleLen) {
    const a = new Date(lastStart + "T12:00:00");
    const b = new Date(today + "T12:00:00");
    dayOfCycle = Math.max(1, Math.round((b - a) / 86400000) + 1);
  }
  const isPeriodToday = !!days[today]?.period;
  let phase = "unknown";
  if (isPeriodToday) phase = "menstrual";
  else if (dayOfCycle && cycleLen) {
    if (dayOfCycle <= 5) phase = "menstrual";
    else if (dayOfCycle <= 13) phase = "follicular";
    else if (dayOfCycle <= 16) phase = "ovulatory";
    else phase = "luteal";
  }
  return {
    isPeriodToday,
    lastStart,
    nextEstimate: next,
    cycleLen,
    dayOfCycle,
    phase,
    periodDayCount: Object.values(days).filter((d) => d.period).length,
  };
}

function liftsSummary(weights) {
  const entries = (weights?.entries || []).filter((e) => (e.kind || "main") !== "stretch");
  const since = isoDaysAgoIST(30);
  const recent = entries.filter((e) => String(e.date || "").slice(0, 10) >= since);
  const byEx = {};
  recent.forEach((e) => {
    const k = e.exercise || "unknown";
    if (!byEx[k]) byEx[k] = { exercise: k, sessions: 0, lastWeight: e.weight, lastDate: e.date };
    byEx[k].sessions += 1;
    if (String(e.date) >= String(byEx[k].lastDate)) {
      byEx[k].lastWeight = e.weight;
      byEx[k].lastDate = e.date;
    }
  });
  const daySet = new Set(recent.map((e) => String(e.date).slice(0, 10)));
  return {
    liftDaysLast30: daySet.size,
    entryCountLast30: recent.length,
    topLifts: Object.values(byEx)
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 8),
  };
}

function workoutPlanSummary(plan) {
  if (!plan) return { title: "No plan", liftsLogged: 0, liftsTotal: 0 };
  let liftsTotal = 0;
  (plan.sections || []).forEach((sec) => {
    if (sec.kind === "stretch" || sec.id === "stretching") return;
    liftsTotal += (sec.moves || []).length;
  });
  return {
    title: plan.headline || "Today’s workout",
    planDate: plan.planDate || null,
    liftsLogged: null,
    liftsTotal,
    note: "Lift completion lives on phone; plan structure from today.json",
  };
}

function buildSnapshot() {
  const weights = readJson("data/weights.json", { entries: [] });
  const periods = readJson("data/periods.json", { days: {} });
  const todayPlan = readJson("data/today.json", null, SITE_ROOT);
  const dietDefaults = readJson("data/diet-defaults.json", { targets: { kcal: 1800, protein: 100 } }, SITE_ROOT);
  const targets = dietDefaults.targets || { kcal: 1800, protein: 100 };
  return {
    today: todayIST(),
    timezone: TZ,
    source: "github-actions",
    diet: {
      targetKcal: targets.kcal,
      targetProtein: targets.protein,
      eatenKcal: null,
      eatenProtein: null,
      leftKcal: null,
      mealFill: null,
      loggedDayCount: null,
      todayPlate: [],
      note: "Meal plate is on-phone only; cron uses published diet targets.",
    },
    workoutPlan: workoutPlanSummary(todayPlan),
    lifts: liftsSummary(weights),
    periods: periodCoach(periods),
    streak: { note: "Cron uses lift day counts from weights.json (last 30d)." },
  };
}

const COACH_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    wins: { type: "array", items: { type: "string" } },
    watch: { type: "array", items: { type: "string" } },
    periodTips: { type: "array", items: { type: "string" } },
    eatNext: { type: "array", items: { type: "string" } },
    exerciseIdeas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          why: { type: "string" },
          when: { type: "string" },
        },
        required: ["name", "why", "when"],
      },
    },
  },
  required: ["summary", "wins", "watch", "periodTips", "eatNext", "exerciseIdeas"],
};

function isModelUnavailableError(msg, status) {
  const m = String(msg || "").toLowerCase();
  if (status === 404) return true;
  return /no longer available|not found|is not supported|unsupported|unknown model|invalid model|not available to new users/.test(
    m
  );
}

async function callGemini(snapshot) {
  const key = (process.env.GEMINI_API_KEY || "").trim();
  if (!key) {
    throw new Error("GEMINI_API_KEY missing. Add it as a GitHub Actions secret (Settings → Secrets).");
  }
  const prompt = `You are a gentle health coach for Sapna (private, adult woman).
Use ONLY this snapshot. Do not invent exact medical diagnoses. Be practical and kind.
If period day or late luteal / menstrual phase, include food ideas that may ease cramps (iron, magnesium, hydration, warm meals) and exercise intensity advice.
This run is the overnight 4:00 Asia/Kolkata scheduled briefing.
Snapshot JSON:
${JSON.stringify(snapshot)}
Return JSON matching the schema.`;

  let lastError;
  for (const model of MODEL_CANDIDATES) {
    const api = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const res = await fetch(`${api}?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: "application/json",
          responseSchema: COACH_SCHEMA,
        },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.error?.message || `Gemini ${res.status}`;
      lastError = new Error(msg);
      console.warn(`Model ${model} failed:`, msg);
      if (isModelUnavailableError(msg, res.status)) continue;
      throw lastError;
    }
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
    if (!text.trim()) {
      lastError = new Error("Gemini returned empty content");
      continue;
    }
    try {
      const parsed = JSON.parse(text);
      return { result: parsed, model };
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) return { result: JSON.parse(m[0]), model };
      lastError = new Error("Could not parse Gemini JSON");
    }
  }
  throw lastError || new Error("No Gemini model available");
}

async function main() {
  const snapshot = buildSnapshot();
  console.log("Snapshot for", snapshot.today, TZ);
  console.log(
    JSON.stringify(
      {
        lifts: snapshot.lifts,
        periods: snapshot.periods,
        workoutPlan: snapshot.workoutPlan,
        dietTargets: { kcal: snapshot.diet.targetKcal, protein: snapshot.diet.targetProtein },
      },
      null,
      2
    )
  );

  const { result, model: usedModel } = await callGemini(snapshot);
  const outDir = path.join(ROOT, "data", "insights");
  fs.mkdirSync(outDir, { recursive: true });

  const payload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    forDate: snapshot.today,
    timezone: TZ,
    schedule: "04:00 Asia/Kolkata (cron 30 22 * * * UTC)",
    source: "github-actions",
    model: usedModel,
    snapshotSummary: {
      liftDaysLast30: snapshot.lifts.liftDaysLast30,
      periodPhase: snapshot.periods.phase,
      planTitle: snapshot.workoutPlan.title,
    },
    result,
  };

  const latestPath = path.join(outDir, "latest.json");
  fs.writeFileSync(latestPath, JSON.stringify(payload, null, 2) + "\n");
  const datedPath = path.join(outDir, `${snapshot.today}.json`);
  fs.writeFileSync(datedPath, JSON.stringify(payload, null, 2) + "\n");
  console.log("Wrote", path.relative(ROOT, latestPath), "and", path.relative(ROOT, datedPath));
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
