(() => {
  const WORKOUT_PLAN_URL = "https://drishabhh.github.io/sapna-workout/data/today.json";
  const LS = {
    diet: "sapna_health_diet_v1",
    periods: "sapna_health_periods_v1",
    weights: "sapna_health_weights_v1",
    token: "sapna_gh_token",
  };
  const REPO = { owner: "drishabhh", name: "sapna-health", branch: "main" };
  const DIET_DEFAULTS_PATH = "data/diet-defaults.json";

  const $ = (id) => document.getElementById(id);
  const todayISO = () => new Date().toISOString().slice(0, 10);

  function setStatus(el, msg, kind) {
    if (!el) return;
    if (!msg) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    el.hidden = false;
    el.textContent = msg;
    el.className = "status is-" + (kind || "info");
  }

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return structuredClone(fallback);
      return { ...structuredClone(fallback), ...JSON.parse(raw) };
    } catch {
      return structuredClone(fallback);
    }
  }

  function saveJSON(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  function downloadJSON(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2) + "\n"], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function readFileJSON(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          resolve(JSON.parse(String(reader.result || "{}")));
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  /* ───────── Navigation ───────── */
  const PANELS = ["workout", "diet", "periods", "logs"];

  function showPanel(name) {
    const id = PANELS.includes(name) ? name : "workout";
    document.querySelectorAll(".panel").forEach((p) => {
      p.classList.toggle("is-active", p.dataset.panel === id);
    });
    document.querySelectorAll("[data-nav]").forEach((a) => {
      a.classList.toggle("is-active", a.getAttribute("data-nav") === id);
    });
    if (location.hash.replace(/^#/, "") !== id) {
      history.replaceState(null, "", "#" + id);
    }
    window.scrollTo(0, 0);
    if (id === "diet") Diet.render();
    if (id === "periods") Periods.render();
    if (id === "logs") Weights.render();
  }

  function wireNav() {
    document.querySelectorAll("[data-nav]").forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        showPanel(a.getAttribute("data-nav"));
      });
    });
    window.addEventListener("hashchange", () => {
      showPanel(location.hash.replace(/^#/, "") || "workout");
    });
  }

  /* ───────── Workout preview ───────── */
  async function loadWorkoutPreview() {
    const box = $("workout-preview");
    const list = $("workout-preview-list");
    if (!box || !list) return;
    try {
      const res = await fetch(WORKOUT_PLAN_URL + "?t=" + Date.now(), { cache: "no-store" });
      if (!res.ok) throw new Error("no plan");
      const plan = await res.json();
      const moves = (plan.sections || []).flatMap((s) => s.moves || []);
      if (!moves.length) return;
      list.innerHTML = moves
        .slice(0, 6)
        .map((m) => `<li>${escapeHtml(m.name)}${m.rx ? ` — ${escapeHtml(m.rx)}` : ""}</li>`)
        .join("");
      box.hidden = false;
      Weights.suggestFromMoves(moves.map((m) => m.name).filter(Boolean));
    } catch {
      /* optional */
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* ───────── Diet ───────── */
  const Diet = (() => {
    const emptyDay = () => ({
      date: todayISO(),
      breakfast: [],
      lunch: [],
      dinner: [],
      snacks: [],
    });
    let foods = [];
    let defaults = { targets: { kcal: 1800, protein: 100 } };
    let state = loadJSON(LS.diet, { targets: null, day: emptyDay(), customFoods: [] });

    function ensureDay() {
      if (!state.day || state.day.date !== todayISO()) {
        state.day = emptyDay();
        persist();
      }
    }

    function targets() {
      return state.targets || defaults.targets || { kcal: 1800, protein: 100 };
    }

    function persist() {
      saveJSON(LS.diet, state);
    }

    function allFoods() {
      return [...foods, ...(state.customFoods || [])];
    }

    function totals() {
      ensureDay();
      const slots = ["breakfast", "lunch", "dinner", "snacks"];
      let kcal = 0;
      let protein = 0;
      slots.forEach((slot) => {
        (state.day[slot] || []).forEach((item) => {
          const s = Number(item.servings) || 1;
          kcal += (Number(item.kcal) || 0) * s;
          protein += (Number(item.protein) || 0) * s;
        });
      });
      return { kcal: Math.round(kcal), protein: Math.round(protein * 10) / 10 };
    }

    function addItem(food, meal, servings) {
      ensureDay();
      const s = Number(servings) || 1;
      state.day[meal] = state.day[meal] || [];
      state.day[meal].push({
        id: food.id || "custom-" + Date.now(),
        name: food.name,
        kcal: Number(food.kcal) || 0,
        protein: Number(food.protein) || 0,
        servings: s,
      });
      persist();
      render();
    }

    function removeItem(meal, index) {
      ensureDay();
      state.day[meal].splice(index, 1);
      persist();
      render();
    }

    function renderFoodPick(query) {
      const root = $("diet-food-pick");
      if (!root) return;
      const q = String(query || "")
        .toLowerCase()
        .trim();
      let list = allFoods();
      if (q) list = list.filter((f) => f.name.toLowerCase().includes(q) || (f.tags || []).some((t) => t.includes(q)));
      root.innerHTML = list
        .slice(0, 40)
        .map(
          (f) => `<button type="button" data-food-id="${escapeHtml(f.id)}">
          ${escapeHtml(f.name)}
          <em>${f.kcal} kcal · ${f.protein}g protein</em>
        </button>`
        )
        .join("");
    }

    function render() {
      ensureDay();
      const t = targets();
      const tot = totals();
      const kcalEl = $("diet-target-kcal");
      const proEl = $("diet-target-protein");
      if (kcalEl && document.activeElement !== kcalEl) kcalEl.value = t.kcal;
      if (proEl && document.activeElement !== proEl) proEl.value = t.protein;

      const totalsRoot = $("diet-totals");
      if (totalsRoot) {
        const kcalCls = tot.kcal > t.kcal ? "is-over" : "is-ok";
        const proCls = tot.protein >= t.protein * 0.9 ? "is-ok" : "";
        totalsRoot.innerHTML = `
          <div class="total-card ${kcalCls}"><strong>${tot.kcal}</strong><span>of ${t.kcal} kcal</span></div>
          <div class="total-card ${proCls}"><strong>${tot.protein}g</strong><span>of ${t.protein}g protein</span></div>`;
      }

      const mealsRoot = $("diet-meals");
      if (mealsRoot) {
        const labels = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snacks: "Snacks" };
        mealsRoot.innerHTML = Object.keys(labels)
          .map((slot) => {
            const items = state.day[slot] || [];
            const lis = items.length
              ? items
                  .map((item, i) => {
                    const s = Number(item.servings) || 1;
                    return `<li>
                    <div>
                      <div>${escapeHtml(item.name)}${s !== 1 ? ` × ${s}` : ""}</div>
                      <div class="meta">${Math.round(item.kcal * s)} kcal · ${Math.round(item.protein * s * 10) / 10}g</div>
                    </div>
                    <button type="button" data-remove="${slot}:${i}" aria-label="Remove">✕</button>
                  </li>`;
                  })
                  .join("")
              : `<li><span class="meta">Nothing logged yet</span></li>`;
            return `<div class="meal-slot"><h3>${labels[slot]}</h3><ul class="food-list">${lis}</ul></div>`;
          })
          .join("");
      }
      renderFoodPick($("diet-search")?.value || "");
    }

    function wire() {
      $("diet-search")?.addEventListener("input", (e) => renderFoodPick(e.target.value));
      $("diet-food-pick")?.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-food-id]");
        if (!btn) return;
        const food = allFoods().find((f) => f.id === btn.getAttribute("data-food-id"));
        if (!food) return;
        const meal = $("diet-meal")?.value || "breakfast";
        const servings = $("diet-servings")?.value || 1;
        addItem(food, meal, servings);
        setStatus($("diet-status"), `Added ${food.name}`, "ok");
      });
      $("diet-add-custom")?.addEventListener("click", () => {
        const name = $("diet-custom-name")?.value.trim();
        const kcal = Number($("diet-custom-kcal")?.value);
        const protein = Number($("diet-custom-protein")?.value);
        if (!name || !Number.isFinite(kcal)) {
          setStatus($("diet-status"), "Name and kcal required.", "error");
          return;
        }
        const food = {
          id: "custom-" + Date.now(),
          name,
          kcal,
          protein: Number.isFinite(protein) ? protein : 0,
          tags: ["custom"],
        };
        state.customFoods = state.customFoods || [];
        state.customFoods.push(food);
        persist();
        addItem(food, $("diet-meal")?.value || "snacks", $("diet-servings")?.value || 1);
        $("diet-custom-name").value = "";
        setStatus($("diet-status"), "Custom food added.", "ok");
      });
      $("diet-save-targets")?.addEventListener("click", () => {
        state.targets = {
          kcal: Number($("diet-target-kcal").value) || 1800,
          protein: Number($("diet-target-protein").value) || 100,
        };
        persist();
        render();
        setStatus($("diet-status"), "Targets saved on this phone.", "ok");
      });
      $("diet-clear-day")?.addEventListener("click", () => {
        if (!confirm("Clear today’s meals?")) return;
        state.day = emptyDay();
        persist();
        render();
        setStatus($("diet-status"), "Today cleared.", "info");
      });
      $("diet-meals")?.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-remove]");
        if (!btn) return;
        const [meal, idx] = btn.getAttribute("data-remove").split(":");
        removeItem(meal, Number(idx));
      });
    }

    async function init() {
      try {
        const [fRes, dRes] = await Promise.all([
          fetch("./data/foods.json?v=20261007health1"),
          fetch("./data/diet-defaults.json?v=20261007health1"),
        ]);
        if (fRes.ok) {
          const data = await fRes.json();
          foods = data.foods || [];
        }
        if (dRes.ok) {
          defaults = await dRes.json();
          if (!state.targets && defaults.targets) state.targets = { ...defaults.targets };
        }
      } catch (e) {
        console.warn(e);
      }
      wire();
      render();
    }

    function getTargetsForAdmin() {
      return targets();
    }

    return { init, render, getTargetsForAdmin };
  })();

  /* ───────── Periods (device-only) ───────── */
  const Periods = (() => {
    let state = loadJSON(LS.periods, { days: {}, /* ISO -> { period: bool, note: string } */ });
    let view = new Date();
    view.setDate(1);
    let selected = todayISO();

    function persist() {
      saveJSON(LS.periods, state);
    }

    function dayKey(y, m, d) {
      return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }

    function periodStarts() {
      const keys = Object.keys(state.days)
        .filter((k) => state.days[k]?.period)
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

    function estimates() {
      const starts = periodStarts();
      if (starts.length < 2) {
        return { cycleLen: null, next: null, label: "Log at least two cycles for estimates" };
      }
      const gaps = [];
      for (let i = 1; i < starts.length; i++) {
        const a = new Date(starts[i - 1] + "T12:00:00");
        const b = new Date(starts[i] + "T12:00:00");
        gaps.push(Math.round((b - a) / 86400000));
      }
      const cycleLen = Math.round(gaps.reduce((s, n) => s + n, 0) / gaps.length);
      const last = new Date(starts[starts.length - 1] + "T12:00:00");
      const next = new Date(last);
      next.setDate(next.getDate() + cycleLen);
      return {
        cycleLen,
        next: next.toISOString().slice(0, 10),
        label: `~${cycleLen}-day cycle (from ${starts.length} starts)`,
      };
    }

    function predictedSet() {
      const est = estimates();
      const set = new Set();
      if (!est.next || !est.cycleLen) return set;
      // predict next start ±1 day + typical 4-day window as soft hint for start only
      set.add(est.next);
      return set;
    }

    function renderCal() {
      const root = $("period-cal");
      const label = $("period-month-label");
      if (!root || !label) return;
      const y = view.getFullYear();
      const m = view.getMonth();
      label.textContent = view.toLocaleString(undefined, { month: "long", year: "numeric" });
      const firstDow = new Date(y, m, 1).getDay();
      const daysInMonth = new Date(y, m + 1, 0).getDate();
      const predicted = predictedSet();
      const today = todayISO();
      let html = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => `<div class="cal-dow">${d}</div>`).join("");
      for (let i = 0; i < firstDow; i++) html += `<div></div>`;
      for (let d = 1; d <= daysInMonth; d++) {
        const key = dayKey(y, m, d);
        const info = state.days[key] || {};
        const cls = [
          "cal-day",
          key === today ? "is-today" : "",
          info.period ? "is-period" : "",
          !info.period && predicted.has(key) ? "is-predicted" : "",
        ]
          .filter(Boolean)
          .join(" ");
        html += `<button type="button" class="${cls}" data-day="${key}">${d}</button>`;
      }
      root.innerHTML = html;
    }

    function renderStats() {
      const root = $("period-stats");
      if (!root) return;
      const est = estimates();
      const periodDays = Object.values(state.days).filter((d) => d.period).length;
      root.innerHTML = `
        <div class="stat"><label>Period days logged</label><strong>${periodDays}</strong></div>
        <div class="stat"><label>Cycle / next</label><strong>${
          est.cycleLen ? `${est.cycleLen}d · ${est.next}` : "—"
        }</strong></div>`;
    }

    function renderSelected() {
      const info = state.days[selected] || {};
      const label = $("period-selected-label");
      const note = $("period-note");
      const toggle = $("period-toggle");
      if (label) label.textContent = `Selected: ${selected}${info.period ? " · period day" : ""}`;
      if (note && document.activeElement !== note) note.value = info.note || "";
      if (toggle) toggle.textContent = info.period ? "Unmark period day" : "Mark as period day";
    }

    function render() {
      renderCal();
      renderStats();
      renderSelected();
    }

    function wire() {
      $("period-prev")?.addEventListener("click", () => {
        view.setMonth(view.getMonth() - 1);
        render();
      });
      $("period-next")?.addEventListener("click", () => {
        view.setMonth(view.getMonth() + 1);
        render();
      });
      $("period-cal")?.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-day]");
        if (!btn) return;
        selected = btn.getAttribute("data-day");
        renderSelected();
      });
      $("period-toggle")?.addEventListener("click", () => {
        const cur = state.days[selected] || {};
        state.days[selected] = { ...cur, period: !cur.period, note: cur.note || "" };
        if (!state.days[selected].period && !state.days[selected].note) delete state.days[selected];
        persist();
        render();
        setStatus($("period-status"), "Saved on this phone only.", "ok");
      });
      $("period-save-note")?.addEventListener("click", () => {
        const note = $("period-note")?.value.trim() || "";
        const cur = state.days[selected] || { period: false };
        state.days[selected] = { ...cur, note };
        if (!state.days[selected].period && !note) delete state.days[selected];
        persist();
        render();
        setStatus($("period-status"), "Note saved on this phone.", "ok");
      });
      $("period-export")?.addEventListener("click", () => {
        downloadJSON(`sapna-periods-backup-${todayISO()}.json`, {
          kind: "sapna-periods-private",
          exportedAt: new Date().toISOString(),
          warning: "Private — do not commit or share publicly.",
          ...state,
        });
        setStatus($("period-status"), "Exported. Keep the file private.", "ok");
      });
      $("period-import")?.addEventListener("change", async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          const data = await readFileJSON(file);
          if (!data.days || typeof data.days !== "object") throw new Error("Invalid file");
          state = { days: data.days };
          persist();
          render();
          setStatus($("period-status"), "Import complete (device only).", "ok");
        } catch {
          setStatus($("period-status"), "Could not import that file.", "error");
        }
        e.target.value = "";
      });
    }

    function init() {
      wire();
      render();
    }

    return { init, render };
  })();

  /* ───────── Weight logs ───────── */
  const Weights = (() => {
    let state = loadJSON(LS.weights, { entries: [] });
    let suggestions = [
      "Chest press",
      "Shoulder press",
      "Lat pull down",
      "Seated Cable Row",
      "Dumbbell squats",
      "Dumbbell Goblet Squat",
    ];

    function persist() {
      saveJSON(LS.weights, state);
    }

    function suggestFromMoves(names) {
      suggestions = [...new Set([...names, ...suggestions])];
      fillDatalist();
    }

    function fillDatalist() {
      const dl = $("log-exercise-list");
      if (!dl) return;
      const fromLogs = state.entries.map((e) => e.exercise);
      const all = [...new Set([...suggestions, ...fromLogs])].filter(Boolean).sort();
      dl.innerHTML = all.map((n) => `<option value="${escapeHtml(n)}"></option>`).join("");
    }

    function byExercise() {
      const map = new Map();
      state.entries.forEach((e) => {
        const k = e.exercise;
        if (!map.has(k)) map.set(k, []);
        map.get(k).push(e);
      });
      map.forEach((arr) => arr.sort((a, b) => a.date.localeCompare(b.date)));
      return map;
    }

    function render() {
      fillDatalist();
      if ($("log-date") && !$("log-date").value) $("log-date").value = todayISO();

      const filter = $("log-filter");
      const map = byExercise();
      if (filter) {
        const cur = filter.value;
        filter.innerHTML =
          `<option value="">All</option>` +
          [...map.keys()]
            .sort()
            .map((n) => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`)
            .join("");
        if ([...map.keys()].includes(cur)) filter.value = cur;
      }

      const selected = filter?.value || "";
      const progress = $("log-progress");
      if (progress) {
        const keys = selected ? [selected] : [...map.keys()].sort();
        if (!keys.length) {
          progress.innerHTML = `<p class="hint">No logs yet — add your first weight above.</p>`;
        } else {
          progress.innerHTML = keys
            .map((name) => {
              const arr = map.get(name) || [];
              const first = arr[0]?.weight ?? 0;
              const last = arr[arr.length - 1]?.weight ?? 0;
              const delta = Math.round((last - first) * 10) / 10;
              const pct = first > 0 ? Math.min(100, Math.max(8, (last / (first * 1.5)) * 100)) : 40;
              return `<div class="log-entry">
                <strong>${escapeHtml(name)}</strong>
                <div class="meta">${arr.length} logs · ${first} → ${last} kg ${
                  delta > 0 ? `(+${delta})` : delta < 0 ? `(${delta})` : ""
                }</div>
                <div class="progress-bar" aria-hidden="true"><i style="width:${pct}%"></i></div>
              </div>`;
            })
            .join("");
        }
      }

      const history = $("log-history");
      if (history) {
        let entries = [...state.entries].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
        if (selected) entries = entries.filter((e) => e.exercise === selected);
        history.innerHTML = entries.length
          ? `<ul class="food-list">${entries
              .slice(0, 40)
              .map(
                (e) => `<li>
                <div>
                  <div><strong style="font-weight:600">${escapeHtml(e.exercise)}</strong> · ${e.weight} kg</div>
                  <div class="meta">${escapeHtml(e.date)}${e.rx ? " · " + escapeHtml(e.rx) : ""}${
                    e.note ? " · " + escapeHtml(e.note) : ""
                  }</div>
                </div>
                <button type="button" data-del-log="${e.id}" aria-label="Delete">✕</button>
              </li>`
              )
              .join("")}</ul>`
          : `<p class="hint">No history yet.</p>`;
      }
    }

    function wire() {
      $("log-add")?.addEventListener("click", () => {
        const exercise = $("log-exercise")?.value.trim();
        const weight = Number($("log-weight")?.value);
        const date = $("log-date")?.value || todayISO();
        if (!exercise || !Number.isFinite(weight)) {
          setStatus($("log-status"), "Exercise and weight required.", "error");
          return;
        }
        state.entries.push({
          id: Date.now(),
          exercise,
          weight,
          date,
          rx: $("log-rx")?.value.trim() || "",
          note: $("log-note")?.value.trim() || "",
        });
        persist();
        $("log-weight").value = "";
        $("log-rx").value = "";
        $("log-note").value = "";
        render();
        setStatus($("log-status"), "Logged on this phone.", "ok");
      });
      $("log-filter")?.addEventListener("change", render);
      $("log-history")?.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-del-log]");
        if (!btn) return;
        const id = Number(btn.getAttribute("data-del-log"));
        state.entries = state.entries.filter((x) => x.id !== id);
        persist();
        render();
      });
      $("log-export")?.addEventListener("click", () => {
        downloadJSON(`sapna-weight-logs-${todayISO()}.json`, {
          kind: "sapna-weights",
          exportedAt: new Date().toISOString(),
          ...state,
        });
        setStatus($("log-status"), "Exported.", "ok");
      });
      $("log-import")?.addEventListener("change", async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          const data = await readFileJSON(file);
          if (!Array.isArray(data.entries)) throw new Error("bad");
          state = { entries: data.entries };
          persist();
          render();
          setStatus($("log-status"), "Import complete.", "ok");
        } catch {
          setStatus($("log-status"), "Could not import.", "error");
        }
        e.target.value = "";
      });
    }

    function init() {
      wire();
      render();
    }

    return { init, render, suggestFromMoves };
  })();

  /* ───────── Admin publish diet defaults ───────── */
  function b64EncodeUnicode(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  async function githubPutFile(path, contentB64, message, token) {
    const api = `https://api.github.com/repos/${REPO.owner}/${REPO.name}/contents/${path}`;
    let sha;
    const getRes = await fetch(api, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
    });
    if (getRes.ok) {
      const cur = await getRes.json();
      sha = cur.sha;
    }
    const putRes = await fetch(api, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message, content: contentB64, branch: REPO.branch, sha }),
    });
    if (!putRes.ok) {
      const err = await putRes.json().catch(() => ({}));
      throw new Error(err.message || `GitHub ${putRes.status}`);
    }
  }

  function wireAdmin() {
    $("admin-close")?.addEventListener("click", () => {
      const ed = $("admin-editor");
      if (ed) {
        ed.hidden = true;
        ed.classList.remove("is-open");
        ed.style.cssText = "";
      }
      document.body.classList.remove("modal-open");
    });
    $("admin-save-token")?.addEventListener("click", () => {
      const raw = $("admin-token")?.value.trim();
      if (!raw) {
        setStatus($("admin-status"), "Paste a token first.", "error");
        return;
      }
      localStorage.setItem(LS.token, raw);
      setStatus($("admin-status"), "Token saved in this browser only.", "ok");
    });
    $("admin-publish")?.addEventListener("click", async () => {
      const token = localStorage.getItem(LS.token) || $("admin-token")?.value.trim();
      if (!token) {
        setStatus($("admin-status"), "Save a GitHub token first (repo scope).", "error");
        return;
      }
      const payload = {
        version: 1,
        updatedAt: todayISO(),
        targets: {
          kcal: Number($("admin-kcal").value) || 1800,
          protein: Number($("admin-protein").value) || 100,
        },
        note: "Published defaults for Sapna Health. Period/weight logs are never included.",
      };
      setStatus($("admin-status"), "Publishing…", "info");
      try {
        await githubPutFile(
          DIET_DEFAULTS_PATH,
          b64EncodeUnicode(JSON.stringify(payload, null, 2) + "\n"),
          `Update diet defaults (${todayISO()})`,
          token
        );
        setStatus($("admin-status"), "Posted. Pages updates in ~30–60s.", "ok");
      } catch (err) {
        setStatus($("admin-status"), err.message || String(err), "error");
      }
    });
    window.__sapnaOpenHealthAdmin = () => {
      const t = Diet.getTargetsForAdmin();
      if ($("admin-kcal")) $("admin-kcal").value = t.kcal;
      if ($("admin-protein")) $("admin-protein").value = t.protein;
      if ($("admin-token") && localStorage.getItem(LS.token)) {
        $("admin-token").placeholder = "Token saved — paste to replace";
      }
      setStatus($("admin-status"), "");
    };
  }

  async function init() {
    wireNav();
    wireAdmin();
    await Diet.init();
    Periods.init();
    Weights.init();
    showPanel(location.hash.replace(/^#/, "") || "workout");
    loadWorkoutPreview();
  }

  init();
})();
