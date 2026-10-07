(() => {
  const WORKOUT_PLAN_URL = "https://drishabhh.github.io/sapna-workout/data/today.json";
  const LS = {
    diet: "sapna_health_diet_v1",
    periods: "sapna_health_periods_v1",
    weights: "sapna_health_weights_v1",
    token: "sapna_gh_token",
    googleKey: "sapna_google_cse_key",
    googleCx: "sapna_google_cse_cx",
  };
  const REPO = { owner: "drishabhh", name: "sapna-health", branch: "main" };
  const DIET_DEFAULTS_PATH = "data/diet-defaults.json";
  const PERIODS_PATH = "data/periods.json";

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
    document.body.dataset.section = id;
    window.scrollTo(0, 0);
    if (id === "workout") Workout.render();
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

  /* ───────── Workout + LOG sheet (static panel; no remount while typing) ───────── */
  const Workout = (() => {
    let plan = null;
    let loaded = false;
    let sheetExercise = "";
    let sheetScrollY = 0;

    function sectionKind(section) {
      if (section?.kind === "stretch" || section?.id === "stretching") return "stretch";
      return "main";
    }

    function movesByKind() {
      const stretch = [];
      const main = [];
      (plan?.sections || []).forEach((sec) => {
        const kind = sectionKind(sec);
        (sec.moves || []).forEach((m) => {
          const row = { ...m, kind: m.kind === "stretch" ? "stretch" : kind };
          if (row.kind === "stretch") stretch.push(row);
          else main.push(row);
        });
      });
      return { stretch, main };
    }

    function lastLogLine(name) {
      const last = Weights.lastFor(name);
      if (!last) return "Tap LOG to record";
      const s = Weights.entrySets(last);
      const r = Weights.entryReps(last);
      const sr = Number.isFinite(s) && Number.isFinite(r) ? ` · ${s}×${r}` : "";
      return `Last: ${last.weight} kg · ${last.date}${sr}`;
    }

    function cardHtml(move) {
      const name = move.name || "Move";
      const isStretch = move.kind === "stretch";
      if (isStretch) {
        return `<article class="move-log-card is-stretch" data-move="${escapeHtml(name)}" data-kind="stretch">
          <p class="move-title">${escapeHtml(name)}</p>
          <p class="move-rx">${escapeHtml(move.rx || "Easy and controlled")} · no weight log</p>
        </article>`;
      }
      return `<article class="move-log-card" data-move="${escapeHtml(name)}" data-kind="main">
        <p class="move-title">${escapeHtml(name)}</p>
        <p class="move-rx">${escapeHtml(move.rx || "As prescribed")}</p>
        <div class="move-log-actions">
          <p class="last-log">${escapeHtml(lastLogLine(name))}</p>
          <button type="button" class="btn-log-open" data-w-log-open>LOG</button>
        </div>
      </article>`;
    }

    function render() {
      const root = $("workout-groups");
      const status = $("workout-plan-status");
      if (!root) return;
      /* Never rebuild the list while the log sheet is open — protects focus & keyboard */
      if ($("log-sheet") && !$("log-sheet").hidden) {
        refreshCardSummaries();
        return;
      }
      if (!loaded) {
        if (status) status.textContent = "Loading today’s plan…";
        return;
      }
      if (!plan) {
        if (status) status.textContent = "Couldn’t load today’s plan — open the full workout site, or log from Logs.";
        root.innerHTML = "";
        return;
      }
      const { stretch, main } = movesByKind();
      if (status) {
        status.textContent = plan.headline
          ? `${plan.headline} — tap LOG on Exercise moves (saved on this phone).`
          : "Tap LOG on Exercise moves (saved on this phone).";
      }
      let html = "";
      if (stretch.length) {
        html += `<div class="move-group"><h2>Stretching</h2>${stretch.map(cardHtml).join("")}</div>`;
      }
      if (main.length) {
        html += `<div class="move-group"><h2>Exercise</h2>${main.map(cardHtml).join("")}</div>`;
      }
      if (!html) html = `<p class="hint">No moves in today’s plan.</p>`;
      root.innerHTML = html;
    }

    function refreshCardSummaries() {
      document.querySelectorAll(".move-log-card[data-kind='main']").forEach((card) => {
        const name = card.getAttribute("data-move") || "";
        const last = card.querySelector(".last-log");
        if (last) last.textContent = lastLogLine(name);
      });
    }

    function fillSheetTable() {
      const tbody = $("log-sheet-tbody");
      const empty = $("log-sheet-empty");
      if (!tbody) return;
      const rows = Weights.entriesFor(sheetExercise);
      tbody.innerHTML = rows
        .map((e) => {
          const s = Weights.entrySets(e);
          const r = Weights.entryReps(e);
          return `<tr>
            <td>${escapeHtml(e.date)}</td>
            <td>${escapeHtml(String(e.weight))}</td>
            <td>${Number.isFinite(s) ? s : "—"}</td>
            <td>${Number.isFinite(r) ? r : "—"}</td>
          </tr>`;
        })
        .join("");
      if (empty) empty.hidden = rows.length > 0;
    }

    function syncSheetViewport() {
      const overlay = $("log-sheet");
      if (!overlay || overlay.hidden) return;
      const vv = window.visualViewport;
      if (!vv) {
        overlay.style.cssText = "";
        return;
      }
      overlay.style.position = "fixed";
      overlay.style.top = vv.offsetTop + "px";
      overlay.style.left = vv.offsetLeft + "px";
      overlay.style.width = vv.width + "px";
      overlay.style.height = vv.height + "px";
      overlay.style.right = "auto";
      overlay.style.bottom = "auto";
    }

    function openSheet(name) {
      const overlay = $("log-sheet");
      const title = $("log-sheet-title");
      if (!overlay || !name) return;
      sheetExercise = name;
      if (title) title.textContent = name;
      fillSheetTable();
      const status = $("log-sheet-status");
      if (status) {
        status.hidden = true;
        status.textContent = "";
      }
      if ($("log-sheet-kg")) $("log-sheet-kg").value = "";
      if ($("log-sheet-sets")) $("log-sheet-sets").value = "";
      if ($("log-sheet-reps")) $("log-sheet-reps").value = "";
      sheetScrollY = window.scrollY || 0;
      overlay.hidden = false;
      overlay.classList.add("is-open");
      document.body.classList.add("log-sheet-open");
      document.body.style.top = `-${sheetScrollY}px`;
      syncSheetViewport();
      setTimeout(() => {
        try {
          $("log-sheet-kg")?.focus({ preventScroll: true });
        } catch {
          try {
            $("log-sheet-kg")?.focus();
          } catch (_) {}
        }
      }, 80);
    }

    function closeSheet() {
      const overlay = $("log-sheet");
      if (!overlay) return;
      const active = document.activeElement;
      if (active && overlay.contains(active)) {
        try {
          active.blur();
        } catch (_) {}
      }
      overlay.hidden = true;
      overlay.classList.remove("is-open");
      overlay.style.cssText = "";
      document.body.classList.remove("log-sheet-open");
      document.body.style.top = "";
      window.scrollTo(0, sheetScrollY);
      sheetExercise = "";
      refreshCardSummaries();
    }

    function wire() {
      $("workout-groups")?.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-w-log-open]");
        if (!btn) return;
        const card = btn.closest(".move-log-card");
        if (!card || card.getAttribute("data-kind") === "stretch") return;
        const name = card.getAttribute("data-move");
        if (name) openSheet(name);
      });

      const overlay = $("log-sheet");
      if (overlay && overlay.dataset.logWired !== "1") {
        overlay.dataset.logWired = "1";
        $("log-sheet-close")?.addEventListener("click", (e) => {
          e.preventDefault();
          closeSheet();
        });
        overlay.addEventListener("click", (e) => {
          if (e.target === overlay) closeSheet();
        });
        $("log-sheet-form")?.addEventListener("submit", (e) => {
          e.preventDefault();
          const kg = Number($("log-sheet-kg")?.value);
          const sets = Number($("log-sheet-sets")?.value);
          const reps = Number($("log-sheet-reps")?.value);
          const status = $("log-sheet-status");
          if (!sheetExercise || !Number.isFinite(kg)) {
            if (status) {
              status.hidden = false;
              status.textContent = "Enter kg.";
              status.className = "log-sheet-status is-error";
            }
            return;
          }
          if (!Number.isFinite(sets) || !Number.isFinite(reps)) {
            if (status) {
              status.hidden = false;
              status.textContent = "Enter sets and reps.";
              status.className = "log-sheet-status is-error";
            }
            return;
          }
          Weights.addEntry({
            exercise: sheetExercise,
            weight: kg,
            sets,
            reps,
            kind: "main",
            date: todayISO(),
          });
          fillSheetTable();
          if ($("log-sheet-kg")) $("log-sheet-kg").value = "";
          if ($("log-sheet-sets")) $("log-sheet-sets").value = "";
          if ($("log-sheet-reps")) $("log-sheet-reps").value = "";
          if (status) {
            status.hidden = false;
            status.textContent = `Saved ${kg} kg · ${sets}×${reps}.`;
            status.className = "log-sheet-status is-ok";
          }
          refreshCardSummaries();
          try {
            $("log-sheet-kg")?.focus({ preventScroll: true });
          } catch (_) {}
        });
        const onVv = () => syncSheetViewport();
        if (window.visualViewport) {
          window.visualViewport.addEventListener("resize", onVv);
          window.visualViewport.addEventListener("scroll", onVv);
        }
        window.addEventListener("resize", onVv);
      }
    }

    async function init() {
      wire();
      try {
        const res = await fetch(WORKOUT_PLAN_URL + "?t=" + Date.now(), { cache: "no-store" });
        if (!res.ok) throw new Error("no plan");
        plan = await res.json();
        const { main } = movesByKind();
        Weights.suggestFromMoves(main.map((m) => ({ name: m.name, kind: "main" })));
      } catch {
        plan = null;
      }
      loaded = true;
      render();
    }

    return { init, render };
  })();

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* ───────── Diet ───────── */
  const Diet = (() => {
    const GSEARCH_URL = "https://www.googleapis.com/customsearch/v1";
    const G_DEBOUNCE_MS = 400;
    const G_MIN_CHARS = 2;
    const SETUP_CSE = "https://programmablesearchengine.google.com/controlpanel/create";
    const SETUP_KEY = "https://developers.google.com/custom-search/v1/introduction";

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
    /** @type {Map<string, object>} */
    const googleItems = new Map();
    let googleResults = [];
    let googleStatus = ""; // "" | needkeys | loading | ok | empty | error
    let googleError = "";
    let gTimer = null;
    let gAbort = null;
    let gReqSeq = 0;
    let lastGQuery = "";
    let pendingGoogle = null;

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

    function findFood(id) {
      return allFoods().find((f) => f.id === id) || null;
    }

    function getGoogleCreds() {
      return {
        key: (localStorage.getItem(LS.googleKey) || "").trim(),
        cx: (localStorage.getItem(LS.googleCx) || "").trim(),
      };
    }

    function saveGoogleCreds(key, cx) {
      if (key) localStorage.setItem(LS.googleKey, key.trim());
      else localStorage.removeItem(LS.googleKey);
      if (cx) localStorage.setItem(LS.googleCx, cx.trim());
      else localStorage.removeItem(LS.googleCx);
    }

    function fillGoogleCredInputs() {
      const { key, cx } = getGoogleCreds();
      ["diet-google-key", "admin-google-key"].forEach((id) => {
        const el = $(id);
        if (el && document.activeElement !== el) el.value = key;
      });
      ["diet-google-cx", "admin-google-cx"].forEach((id) => {
        const el = $(id);
        if (el && document.activeElement !== el) el.value = cx;
      });
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
      const kcal = Number(food.kcal);
      if (!Number.isFinite(kcal)) return;
      state.day[meal] = state.day[meal] || [];
      state.day[meal].push({
        id: food.id || "custom-" + Date.now(),
        name: food.name,
        kcal,
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

    function localMatches(query) {
      const q = String(query || "")
        .toLowerCase()
        .trim();
      let list = allFoods();
      if (q) {
        list = list.filter(
          (f) => f.name.toLowerCase().includes(q) || (f.tags || []).some((t) => String(t).toLowerCase().includes(q))
        );
      }
      return list.slice(0, 40);
    }

    function parseNutrition(text) {
      const s = String(text || "");
      let kcal = null;
      let protein = null;
      const kcalM =
        s.match(/(\d+(?:\.\d+)?)\s*(?:kcal|calories?|cal)\b/i) ||
        s.match(/\b(?:kcal|calories?)\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
      if (kcalM) kcal = Number(kcalM[1]);
      const proM =
        s.match(/(\d+(?:\.\d+)?)\s*g(?:rams?)?\s*(?:of\s+)?protein\b/i) ||
        s.match(/\bprotein\s*[:=]?\s*(\d+(?:\.\d+)?)\s*g?\b/i);
      if (proM) protein = Number(proM[1]);
      return {
        kcal: Number.isFinite(kcal) && kcal > 0 ? Math.round(kcal) : null,
        protein: Number.isFinite(protein) && protein >= 0 ? Math.round(protein * 10) / 10 : null,
      };
    }

    function mapGoogleItem(item, idx) {
      if (!item?.title || !item?.link) return null;
      const blob = `${item.title} ${item.snippet || ""}`;
      const nut = parseNutrition(blob);
      const id = "gcs-" + idx + "-" + String(item.link).slice(-48);
      return {
        id,
        title: item.title,
        snippet: item.snippet || "",
        link: item.link,
        displayLink: item.displayLink || "",
        kcal: nut.kcal,
        protein: nut.protein,
        source: "google",
      };
    }

    function foodButtonHtml(f) {
      return `<button type="button" data-food-id="${escapeHtml(f.id)}" data-food-source="local">
        ${escapeHtml(f.name)}
        <em>${f.kcal} kcal · ${f.protein}g protein</em>
      </button>`;
    }

    function googleCardHtml(item) {
      const nutBits = [];
      if (item.kcal != null) nutBits.push(`${item.kcal} kcal`);
      if (item.protein != null) nutBits.push(`${item.protein}g protein`);
      const nutLine = nutBits.length ? nutBits.join(" · ") + " (from snippet)" : "kcal/protein not found — you’ll enter them";
      return `<article class="gsearch-card" data-gsearch-id="${escapeHtml(item.id)}">
        <p class="gsearch-title">${escapeHtml(item.title)}</p>
        <p class="gsearch-snippet">${escapeHtml(item.snippet || "No preview.")}</p>
        <p class="gsearch-meta">${escapeHtml(item.displayLink || "")} · ${escapeHtml(nutLine)}</p>
        <div class="gsearch-actions">
          <a class="btn-diet-ghost gsearch-link" href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer">Open</a>
          <button type="button" class="btn-diet" data-gsearch-add="${escapeHtml(item.id)}">Add to plate</button>
        </div>
      </article>`;
    }

    function setupKeysHtml() {
      return `<div class="gsearch-setup">
        <p>Google search needs a free <strong>API key</strong> + <strong>Search engine ID (cx)</strong> — saved only on this phone.</p>
        <p class="gsearch-setup-note"><strong>“Search the entire web” is deprecated</strong> — Google no longer lets new engines enable it. Instead, add nutrition/food sites to the engine’s <em>include</em> list (see sites below).</p>
        <ol>
          <li>Create a Programmable Search Engine → <a href="${SETUP_CSE}" target="_blank" rel="noopener">control panel</a>.</li>
          <li>Under Sites to search, <strong>add nutrition/food sites</strong> (use <code>site.com/*</code> patterns), e.g. nutritionix.com, fatsecret.com, nutritionvalue.org, indianhealthyrecipes.com, tarladalal.com, wikipedia.org, openfoodfacts.org.</li>
          <li>Open the engine → copy <strong>Search engine ID (cx)</strong>.</li>
          <li>Enable Custom Search API &amp; create an API key → <a href="${SETUP_KEY}" target="_blank" rel="noopener">Google docs</a> (100 free queries/day).</li>
          <li>Paste key + cx below (or in Admin) and tap Save.</li>
        </ol>
        <label class="field">Google API key
          <input type="password" id="diet-google-key" autocomplete="off" placeholder="AIza…" />
        </label>
        <label class="field">Search engine ID (cx)
          <input type="text" id="diet-google-cx" autocomplete="off" placeholder="abc123:…" />
        </label>
        <button type="button" class="btn-diet" id="diet-google-save">Save Google search keys</button>
        <p class="status" id="diet-google-status" hidden></p>
      </div>`;
    }

    function renderFoodPick(query) {
      const root = $("diet-food-pick");
      if (!root) return;
      const q = String(query || "").trim();
      const local = localMatches(q);
      const localHtml = local.length
        ? local.map((f) => foodButtonHtml(f)).join("")
        : `<p class="food-pick-empty">No library matches${q ? ` for “${escapeHtml(q)}”` : ""}.</p>`;

      const { key, cx } = getGoogleCreds();
      const hasKeys = !!(key && cx);
      let gBlock = "";
      if (!hasKeys) {
        gBlock = `<div class="food-pick-group is-google">
          <p class="food-pick-label">Google search <span class="food-pick-hint">setup</span></p>
          ${setupKeysHtml()}
        </div>`;
      } else if (q.length >= G_MIN_CHARS) {
        let body = "";
        if (googleStatus === "loading") {
          body = `<p class="food-pick-empty">Searching Google…</p>`;
        } else if (googleStatus === "error") {
          body = `<p class="food-pick-empty">${escapeHtml(googleError || "Google search failed. Check keys / daily quota.")}</p>`;
        } else if (googleStatus === "empty" || (googleStatus === "ok" && !googleResults.length)) {
          body = `<p class="food-pick-empty">No Google results for “${escapeHtml(q)}”.</p>`;
        } else if (googleResults.length) {
          body = googleResults.map(googleCardHtml).join("");
        } else {
          body = `<p class="food-pick-empty">Keep typing to search Google…</p>`;
        }
        gBlock = `<div class="food-pick-group is-google">
          <p class="food-pick-label">Google <span class="food-pick-hint">web results</span></p>
          ${body}
        </div>`;
      } else {
        gBlock = `<div class="food-pick-group is-google">
          <p class="food-pick-label">Google <span class="food-pick-hint">web results</span></p>
          <p class="food-pick-empty">Type 2+ letters to search Google (keys saved on this phone).</p>
        </div>`;
      }

      root.innerHTML = `<div class="food-pick-group">
        <p class="food-pick-label">Your library <span class="food-pick-hint">Indian / home</span></p>
        ${localHtml}
      </div>${gBlock}`;
      if (!hasKeys) fillGoogleCredInputs();
    }

    async function runGoogleSearch(query) {
      const q = String(query || "").trim();
      if (q.length < G_MIN_CHARS) return;
      const { key, cx } = getGoogleCreds();
      if (!key || !cx) {
        googleStatus = "needkeys";
        renderFoodPick(q);
        return;
      }
      if (gAbort) {
        try {
          gAbort.abort();
        } catch (_) {}
      }
      const seq = ++gReqSeq;
      gAbort = new AbortController();
      googleStatus = "loading";
      googleError = "";
      renderFoodPick(q);
      try {
        const params = new URLSearchParams({
          key,
          cx,
          q,
          num: "8",
        });
        const res = await fetch(`${GSEARCH_URL}?${params}`, {
          signal: gAbort.signal,
          headers: { Accept: "application/json" },
        });
        const data = await res.json().catch(() => ({}));
        if (seq !== gReqSeq) return;
        if (!res.ok) {
          const msg = data?.error?.message || `Google API ${res.status}`;
          throw new Error(msg);
        }
        const mapped = [];
        googleItems.clear();
        (data.items || []).forEach((raw, i) => {
          const item = mapGoogleItem(raw, i);
          if (!item) return;
          mapped.push(item);
          googleItems.set(item.id, item);
        });
        googleResults = mapped;
        lastGQuery = q;
        googleStatus = googleResults.length ? "ok" : "empty";
        renderFoodPick(q);
      } catch (e) {
        if (e?.name === "AbortError") return;
        if (seq !== gReqSeq) return;
        googleResults = [];
        googleStatus = "error";
        googleError = e?.message || "Google search failed.";
        renderFoodPick(q);
      }
    }

    function scheduleGoogleSearch(query) {
      const q = String(query || "").trim();
      if (gTimer) clearTimeout(gTimer);
      if (q.length < G_MIN_CHARS) {
        if (gAbort) {
          try {
            gAbort.abort();
          } catch (_) {}
        }
        googleResults = [];
        googleStatus = "";
        lastGQuery = "";
        renderFoodPick(q);
        return;
      }
      const { key, cx } = getGoogleCreds();
      if (!key || !cx) {
        googleStatus = "needkeys";
        renderFoodPick(q);
        return;
      }
      if (q === lastGQuery && (googleStatus === "ok" || googleStatus === "empty" || googleStatus === "error")) {
        renderFoodPick(q);
        return;
      }
      googleStatus = "loading";
      renderFoodPick(q);
      gTimer = setTimeout(() => runGoogleSearch(q), G_DEBOUNCE_MS);
    }

    function openGoogleAddSheet(item) {
      pendingGoogle = item;
      const sheet = $("gsearch-add-sheet");
      if (!sheet) return;
      $("gsearch-add-title").textContent = item.title || "Add from Google";
      $("gsearch-add-snippet").textContent = item.snippet || "";
      $("gsearch-add-link").href = item.link || "#";
      $("gsearch-add-name").value = item.title || "";
      $("gsearch-add-kcal").value = item.kcal != null ? String(item.kcal) : "";
      $("gsearch-add-protein").value = item.protein != null ? String(item.protein) : "";
      const st = $("gsearch-add-status");
      if (st) {
        st.hidden = true;
        st.textContent = "";
      }
      sheet.hidden = false;
      sheet.classList.add("is-open");
      document.body.classList.add("modal-open");
      setTimeout(() => {
        try {
          (item.kcal != null ? $("gsearch-add-protein") : $("gsearch-add-kcal"))?.focus({ preventScroll: true });
        } catch (_) {}
      }, 60);
    }

    function closeGoogleAddSheet() {
      const sheet = $("gsearch-add-sheet");
      if (!sheet) return;
      sheet.hidden = true;
      sheet.classList.remove("is-open");
      document.body.classList.remove("modal-open");
      pendingGoogle = null;
    }

    function addGoogleToPlate() {
      const name = ($("gsearch-add-name")?.value || "").trim();
      const kcal = Number($("gsearch-add-kcal")?.value);
      const protein = Number($("gsearch-add-protein")?.value);
      const st = $("gsearch-add-status");
      if (!name || !Number.isFinite(kcal)) {
        if (st) {
          st.hidden = false;
          st.textContent = "Name and kcal are required.";
          st.className = "status is-error";
        }
        return;
      }
      const food = {
        id: "gweb-" + Date.now(),
        name,
        kcal,
        protein: Number.isFinite(protein) ? protein : 0,
        tags: ["google"],
        source: "google",
      };
      const meal = $("diet-meal")?.value || "breakfast";
      const servings = $("diet-servings")?.value || 1;
      addItem(food, meal, servings);
      setStatus($("diet-status"), `Added ${name} from Google`, "ok");
      closeGoogleAddSheet();
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
          <div class="total-card ${kcalCls}"><strong>${tot.kcal}</strong><span>of ${t.kcal} kcal today</span></div>
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
              : `<li><span class="meta">Plate is empty — add something above</span></li>`;
            return `<div class="meal-slot"><h3>${labels[slot]}</h3><ul class="food-list">${lis}</ul></div>`;
          })
          .join("");
      }
      renderFoodPick($("diet-search")?.value || "");
    }

    function wire() {
      $("diet-meal-chips")?.addEventListener("click", (e) => {
        const chip = e.target.closest("[data-meal]");
        if (!chip) return;
        const meal = chip.getAttribute("data-meal");
        const sel = $("diet-meal");
        if (sel) sel.value = meal;
        $("diet-meal-chips").querySelectorAll(".meal-chip").forEach((c) => {
          c.classList.toggle("is-active", c === chip);
        });
      });
      $("diet-search")?.addEventListener("input", (e) => {
        const q = e.target.value;
        renderFoodPick(q);
        scheduleGoogleSearch(q);
      });
      $("diet-food-pick")?.addEventListener("click", (e) => {
        if (e.target.closest("a.gsearch-link")) return;
        const saveKeys = e.target.closest("#diet-google-save");
        if (saveKeys) {
          const key = $("diet-google-key")?.value.trim() || "";
          const cx = $("diet-google-cx")?.value.trim() || "";
          if (!key || !cx) {
            setStatus($("diet-google-status"), "Paste both API key and Search engine ID (cx).", "error");
            return;
          }
          saveGoogleCreds(key, cx);
          fillGoogleCredInputs();
          setStatus($("diet-google-status"), "Saved on this phone.", "ok");
          const q = $("diet-search")?.value || "";
          scheduleGoogleSearch(q);
          return;
        }
        const gAdd = e.target.closest("[data-gsearch-add]");
        if (gAdd) {
          const item = googleItems.get(gAdd.getAttribute("data-gsearch-add"));
          if (item) openGoogleAddSheet(item);
          return;
        }
        const btn = e.target.closest("[data-food-id]");
        if (!btn) return;
        const food = findFood(btn.getAttribute("data-food-id"));
        if (!food || !Number.isFinite(Number(food.kcal))) {
          setStatus($("diet-status"), "That item has no usable kcal.", "error");
          return;
        }
        const meal = $("diet-meal")?.value || "breakfast";
        const servings = $("diet-servings")?.value || 1;
        addItem(food, meal, servings);
        setStatus($("diet-status"), `Added ${food.name}`, "ok");
      });
      $("gsearch-add-close")?.addEventListener("click", (e) => {
        e.preventDefault();
        closeGoogleAddSheet();
      });
      $("gsearch-add-sheet")?.addEventListener("click", (e) => {
        if (e.target.id === "gsearch-add-sheet") closeGoogleAddSheet();
      });
      $("gsearch-add-form")?.addEventListener("submit", (e) => {
        e.preventDefault();
        addGoogleToPlate();
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
          fetch("./data/foods.json?v=20261007cse-sites"),
          fetch("./data/diet-defaults.json?v=20261007cse-sites"),
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
      fillGoogleCredInputs();
      render();
      renderFoodPick($("diet-search")?.value || "");
    }

    function getTargetsForAdmin() {
      return targets();
    }

    return { init, render, getTargetsForAdmin, fillGoogleCredInputs, getGoogleCreds, saveGoogleCreds };
  })();

  /* ───────── Periods (local + syncable dates) ───────── */
  const Periods = (() => {
    let state = loadJSON(LS.periods, { days: {} });
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
        setStatus($("period-status"), "Saved here — Sync dates to share across devices.", "ok");
      });
      $("period-save-note")?.addEventListener("click", () => {
        const note = $("period-note")?.value.trim() || "";
        const cur = state.days[selected] || { period: false };
        state.days[selected] = { ...cur, note };
        if (!state.days[selected].period && !note) delete state.days[selected];
        persist();
        render();
        setStatus($("period-status"), "Note saved. Sync dates to publish.", "ok");
      });
      $("period-sync")?.addEventListener("click", () => publishPeriods($("period-status"), $("period-token")?.value.trim()));
      $("period-export")?.addEventListener("click", () => {
        downloadJSON(`sapna-periods-backup-${todayISO()}.json`, {
          kind: "sapna-periods",
          exportedAt: new Date().toISOString(),
          label: "Personal wellness dates",
          ...state,
        });
        setStatus($("period-status"), "Backup downloaded.", "ok");
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
          setStatus($("period-status"), "Import complete.", "ok");
        } catch {
          setStatus($("period-status"), "Could not import that file.", "error");
        }
        e.target.value = "";
      });
    }

    function mergeCloud(cloud) {
      if (!cloud?.days || typeof cloud.days !== "object") return;
      Object.entries(cloud.days).forEach(([key, info]) => {
        const local = state.days[key] || {};
        state.days[key] = {
          period: !!(info.period || local.period),
          note: local.note || info.note || "",
        };
        if (!state.days[key].period && !state.days[key].note) delete state.days[key];
      });
      persist();
    }

    function publishPayload() {
      // Prefer dates; keep short notes if present
      const days = {};
      Object.entries(state.days || {}).forEach(([k, v]) => {
        if (!v?.period && !v?.note) return;
        days[k] = { period: !!v.period };
        if (v.note) days[k].note = String(v.note).slice(0, 200);
      });
      return {
        version: 1,
        updatedAt: todayISO(),
        label: "Personal wellness dates for Sapna — period calendar dates (and optional short notes).",
        days,
      };
    }

    async function publishPeriods(statusEl, tokenOverride) {
      const token = tokenOverride || localStorage.getItem(LS.token) || $("admin-token")?.value.trim();
      if (!token) {
        setStatus(statusEl, "Add a GitHub PAT (repo scope) — or save one in Admin.", "error");
        return;
      }
      if (tokenOverride) localStorage.setItem(LS.token, tokenOverride);
      setStatus(statusEl, "Syncing period dates…", "info");
      try {
        const payload = publishPayload();
        await githubPutFile(
          PERIODS_PATH,
          b64EncodeUnicode(JSON.stringify(payload, null, 2) + "\n"),
          `Update period dates (${todayISO()})`,
          token
        );
        setStatus(statusEl, "Synced. Other devices see dates after Pages refresh (~30–60s).", "ok");
      } catch (err) {
        setStatus(statusEl, err.message || String(err), "error");
      }
    }

    async function init() {
      wire();
      try {
        const res = await fetch(`./${PERIODS_PATH}?t=${Date.now()}`, { cache: "no-store" });
        if (res.ok) mergeCloud(await res.json());
      } catch (_) {}
      if ($("period-token") && localStorage.getItem(LS.token)) {
        $("period-token").placeholder = "Token saved — paste to replace";
      }
      render();
    }

    return { init, render, publishPeriods, publishPayload };
  })();

  /* ───────── Weight logs ───────── */
  const Weights = (() => {
    let state = loadJSON(LS.weights, { entries: [] });
    /** @type {{name:string, kind:string}[]} */
    let suggestions = [];
    let tab = "main"; // exercise logs only

    function persist() {
      saveJSON(LS.weights, state);
    }

    function inferKind(name, explicit) {
      return "main";
    }

    function suggestFromMoves(items) {
      const norm = (items || [])
        .map((x) => (typeof x === "string" ? { name: x, kind: "main" } : { name: x.name, kind: "main" }))
        .filter((s) => s.name && s.kind !== "stretch");
      const map = new Map(suggestions.map((s) => [s.name, s]));
      norm.forEach((s) => map.set(s.name, s));
      state.entries.forEach((e) => {
        if (e.exercise && (e.kind || "main") === "main" && !map.has(e.exercise)) {
          map.set(e.exercise, { name: e.exercise, kind: "main" });
        }
      });
      suggestions = [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
      fillDatalist();
    }

    function fillDatalist() {
      const dl = $("log-exercise-list");
      if (!dl) return;
      dl.innerHTML = suggestions.map((s) => `<option value="${escapeHtml(s.name)}"></option>`).join("");
    }

    function parseSetsReps(rx) {
      const s = String(rx || "");
      let m = s.match(/(\d+)\s*(?:sets?|×|x)\s*[×x]?\s*(\d+)/i);
      if (m) return { sets: Number(m[1]), reps: Number(m[2]) };
      m = s.match(/(\d+)\s*[×x]\s*(\d+)/);
      if (m) return { sets: Number(m[1]), reps: Number(m[2]) };
      return { sets: null, reps: null };
    }

    function entrySets(e) {
      if (e.sets != null && e.sets !== "") return Number(e.sets);
      return parseSetsReps(e.rx).sets;
    }

    function entryReps(e) {
      if (e.reps != null && e.reps !== "") return Number(e.reps);
      return parseSetsReps(e.rx).reps;
    }

    function entriesFor(name) {
      return state.entries
        .filter((e) => e.exercise === name && (e.kind || "main") === "main")
        .sort((a, b) => a.date.localeCompare(b.date) || Number(a.id) - Number(b.id));
    }

    function lastFor(name) {
      const arr = entriesFor(name);
      return arr[arr.length - 1] || null;
    }

    function addEntry({ exercise, weight, rx = "", sets, reps, note = "", kind, date }) {
      const s = sets != null && sets !== "" ? Number(sets) : parseSetsReps(rx).sets;
      const r = reps != null && reps !== "" ? Number(reps) : parseSetsReps(rx).reps;
      const rxOut =
        Number.isFinite(s) && Number.isFinite(r) ? `${s} × ${r}` : rx || "";
      state.entries.push({
        id: Date.now() + Math.floor(Math.random() * 1000),
        exercise,
        weight: Number(weight),
        date: date || todayISO(),
        sets: Number.isFinite(s) ? s : null,
        reps: Number.isFinite(r) ? r : null,
        rx: rxOut,
        note,
        kind: "main",
      });
      persist();
      /* Prefer soft card refresh; Workout.render skips remount while sheet is open */
      if (typeof Workout !== "undefined" && Workout.render) Workout.render();
    }

    function exerciseEntries() {
      return state.entries.filter((e) => (e.kind || "main") === "main");
    }

    function filteredEntries() {
      let entries = exerciseEntries();
      const selected = $("log-filter")?.value || "";
      if (selected) entries = entries.filter((e) => e.exercise === selected);
      return entries.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
    }

    function byExercise(entries) {
      const map = new Map();
      entries.forEach((e) => {
        if (!map.has(e.exercise)) map.set(e.exercise, []);
        map.get(e.exercise).push(e);
      });
      map.forEach((arr) => arr.sort((a, b) => a.date.localeCompare(b.date)));
      return map;
    }

    function render() {
      fillDatalist();
      if ($("log-date") && !$("log-date").value) $("log-date").value = todayISO();

      const pool = exerciseEntries();
      const names = [...new Set(pool.map((e) => e.exercise))].sort();
      const filter = $("log-filter");
      if (filter) {
        const cur = filter.value;
        filter.innerHTML =
          `<option value="">All moves</option>` +
          names.map((n) => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join("");
        if (names.includes(cur)) filter.value = cur;
      }

      const map = byExercise(pool.filter((e) => !$("log-filter")?.value || e.exercise === $("log-filter").value));
      const progress = $("log-progress");
      if (progress) {
        const keys = [...map.keys()].sort();
        if (!keys.length) {
          progress.innerHTML = `<p class="hint">No exercise logs yet — log kg under Exercise moves on Workout.</p>`;
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
        const entries = filteredEntries();
        history.innerHTML = entries.length
          ? `<ul class="food-list">${entries
              .slice(0, 50)
              .map((e) => {
                const s = entrySets(e);
                const r = entryReps(e);
                const sr =
                  Number.isFinite(s) && Number.isFinite(r)
                    ? ` · ${s} sets × ${r} reps`
                    : e.rx
                      ? " · " + escapeHtml(e.rx)
                      : "";
                return `<li>
                <div>
                  <div><strong style="font-weight:600">${escapeHtml(e.exercise)}</strong>
                    · ${e.weight} kg</div>
                  <div class="meta">${escapeHtml(e.date)}${sr}${
                    e.note ? " · " + escapeHtml(e.note) : ""
                  }</div>
                </div>
                <button type="button" data-del-log="${e.id}" aria-label="Delete">✕</button>
              </li>`;
              })
              .join("")}</ul>`
          : `<p class="hint">No history in this group.</p>`;
      }
    }

    function wire() {
      $("log-add")?.addEventListener("click", () => {
        const exercise = $("log-exercise")?.value.trim();
        const weight = Number($("log-weight")?.value);
        const sets = Number($("log-sets")?.value);
        const reps = Number($("log-reps")?.value);
        const date = $("log-date")?.value || todayISO();
        if (!exercise || !Number.isFinite(weight)) {
          setStatus($("log-status"), "Move and weight required.", "error");
          return;
        }
        if (!Number.isFinite(sets) || !Number.isFinite(reps)) {
          setStatus($("log-status"), "Sets and reps required.", "error");
          return;
        }
        addEntry({
          exercise,
          weight,
          date,
          sets,
          reps,
          note: $("log-note")?.value.trim() || "",
          kind: "main",
        });
        $("log-weight").value = "";
        if ($("log-sets")) $("log-sets").value = "";
        if ($("log-reps")) $("log-reps").value = "";
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
        Workout.render();
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
          Workout.render();
          setStatus($("log-status"), "Import complete.", "ok");
        } catch {
          setStatus($("log-status"), "Could not import.", "error");
        }
        e.target.value = "";
      });
    }

    function init() {
      // Keep exercise logs only (drop legacy stretch weight logs)
      state.entries = (state.entries || [])
        .map((e) => ({ ...e, kind: "main" }))
        .filter((e) => e.kind === "main");
      // Filter out known stretch names from suggestions path later; strip stretch-like legacy if flagged
      state.entries = state.entries.filter((e) => e.kind !== "stretch");
      persist();
      wire();
      render();
    }

    return { init, render, suggestFromMoves, addEntry, lastFor, entriesFor, entrySets, entryReps };
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
    $("admin-save-google")?.addEventListener("click", () => {
      const key = $("admin-google-key")?.value.trim() || "";
      const cx = $("admin-google-cx")?.value.trim() || "";
      if (!key || !cx) {
        setStatus($("admin-status"), "Paste both Google API key and Search engine ID (cx).", "error");
        return;
      }
      Diet.saveGoogleCreds(key, cx);
      Diet.fillGoogleCredInputs();
      setStatus($("admin-status"), "Google search keys saved on this phone.", "ok");
    });
    $("admin-clear-google")?.addEventListener("click", () => {
      Diet.saveGoogleCreds("", "");
      Diet.fillGoogleCredInputs();
      setStatus($("admin-status"), "Google keys cleared.", "info");
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
      Diet.fillGoogleCredInputs();
      setStatus($("admin-status"), "");
    };
  }

  async function init() {
    wireNav();
    wireAdmin();
    Weights.init();
    await Diet.init();
    await Periods.init();
    await Workout.init();
    showPanel(location.hash.replace(/^#/, "") || "workout");
  }

  init();
})();
