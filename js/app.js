(() => {
  const WORKOUT_PLAN_URL = "./data/today.json";
  const WORKOUT_ORIGIN = "./";
  const LS = {
    diet: "sapna_health_diet_v1",
    periods: "sapna_health_periods_v1",
    weights: "sapna_health_weights_v1",
    token: "sapna_gh_token",
    gemini: "sapna_gemini_key",
    coach: "sapna_coach_last_v1",
    profile: "sapna_profile",
    guided: "sapna_guided_session_v1",
  };
  const REPO = { owner: "drishabhh", name: "sapna-health", branch: "main" };
  const DIET_DEFAULTS_PATH = "data/diet-defaults.json";
  const PERIODS_PATH = "data/periods.json";
  const WEIGHTS_PATH = "data/weights.json";
  const PROFILE_PATH = "data/profile.json";
  const PROFILE_ASSET_V = "20261014onelink1";
  const DIET_TODAY_PATH = "data/diet-today.json";
  const DIET_CHECKS_PATH = "data/diet-checks.json";
  /** All sapna_* / sapna-* localStorage keys this app may set (for Start fresh). */
  const LS_FRESH_PREFIXES = ["sapna_", "sapna-"];

  function isAdminUnlocked() {
    try {
      return sessionStorage.getItem("sapna_admin_unlocked") === "1";
    } catch {
      return false;
    }
  }

  function syncAdminUi() {
    document.body.classList.toggle("is-admin", isAdminUnlocked());
  }

  const $ = (id) => document.getElementById(id);
  const todayISO = () => new Date().toISOString().slice(0, 10);

  /* Light haptics — no-op when vibrate unsupported (common on iOS Safari) */
  const Haptics = (() => {
    let lastTickAt = 0;
    function pulse(pattern) {
      try {
        if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
          navigator.vibrate(pattern);
        }
      } catch (_) {}
    }
    function light() {
      pulse(12);
    }
    function ok() {
      pulse([14, 28, 14]);
    }
    function tick() {
      const now = Date.now();
      if (now - lastTickAt < 48) return;
      lastTickAt = now;
      pulse(8);
    }
    return { pulse, light, ok, tick };
  })();
  window.sapnaHaptic = Haptics;

  /**
   * Site-wide mobile keyboard safety: keep focused inputs (and their
   * placeholder/label) visible above the soft keyboard. Shared by Diet sheets,
   * Workout LOG, Admin overlays, profile, token/AI key fields, etc.
   */
  const SapnaKeyboard = (() => {
    const FIELD_SEL =
      'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="image"]), textarea, select';
    const OVERLAY_SEL = ".overlay.is-open, .log-sheet-overlay.is-open";
    let installed = false;
    let raf = 0;
    let activeField = null;

    function isField(el) {
      try {
        return !!(el && el.nodeType === 1 && el.matches?.(FIELD_SEL));
      } catch (_) {
        return false;
      }
    }

    /** Pixels occluded at the bottom of the layout viewport (≈ keyboard). */
    function keyboardInset() {
      const vv = window.visualViewport;
      if (!vv) return 0;
      const gap = Math.round(window.innerHeight - (vv.offsetTop + vv.height));
      return Math.max(0, gap);
    }

    function setKbCss(kb) {
      const open = kb > 36;
      document.documentElement.style.setProperty("--kb-inset", kb + "px");
      document.body.classList.toggle("kb-open", open);
      document.body.classList.toggle("kb-field-focus", !!activeField);
    }

    /** Map a bottom sheet / overlay to the visual viewport (above keyboard). */
    function pinOverlayToVv(overlay) {
      if (!overlay || overlay.hidden) return;
      const vv = window.visualViewport;
      if (!vv) return;
      overlay.dataset.kbPinned = "1";
      overlay.style.position = "fixed";
      overlay.style.top = vv.offsetTop + "px";
      overlay.style.left = vv.offsetLeft + "px";
      overlay.style.width = vv.width + "px";
      overlay.style.height = vv.height + "px";
      overlay.style.right = "auto";
      overlay.style.bottom = "auto";
      overlay.style.maxHeight = vv.height + "px";
    }

    function clearOverlayPin(overlay) {
      if (!overlay || overlay.dataset.kbPinned !== "1") return;
      delete overlay.dataset.kbPinned;
      /* Leave geometry to the open/close owners — they reset cssText on close. */
    }

    function openOverlays() {
      return Array.from(document.querySelectorAll(OVERLAY_SEL)).filter((el) => !el.hidden);
    }

    function scrollParent(el) {
      let node = el?.parentElement;
      while (node && node !== document.body) {
        const st = window.getComputedStyle(node);
        const oy = st.overflowY;
        if ((oy === "auto" || oy === "scroll" || oy === "overlay") && node.scrollHeight > node.clientHeight + 4) {
          return node;
        }
        node = node.parentElement;
      }
      return document.scrollingElement || document.documentElement;
    }

    function visibilityTarget(el) {
      return (
        el.closest(
          ".field, .diet-grams-sheet, .diet-pkg-sheet, .diet-quick-oneoff, .diet-add-search-wrap, .diet-export-sheet, .hf-product-tile, .gemini-key-panel, .token-setup-sheet label, label"
        ) || el
      );
    }

    /**
     * Scroll / pad so `el` (and its label/placeholder) stay in the visible
     * visualViewport — above the keyboard and below sticky chrome.
     */
    function ensureInputVisible(el, opts) {
      if (!isField(el)) return;
      activeField = el;
      const kb = keyboardInset();
      setKbCss(kb);
      const overlay = el.closest(".overlay, .log-sheet-overlay");
      if (overlay && !overlay.hidden) pinOverlayToVv(overlay);
      else openOverlays().forEach(pinOverlayToVv);

      const target = visibilityTarget(el);
      const margin = opts?.margin ?? 16;
      const behavior = opts?.smooth ? "smooth" : "auto";

      const run = () => {
        const vv = window.visualViewport;
        const scroller = scrollParent(el);
        if (scroller && scroller !== document.documentElement && scroller !== document.body) {
          const pad = Math.max(kb + 96, 120);
          scroller.style.setProperty("--kb-scroll-pad", pad + "px");
          scroller.classList.add("kb-scroll-pad");
        }
        try {
          target.scrollIntoView({ block: "center", inline: "nearest", behavior });
        } catch (_) {
          try {
            el.scrollIntoView({ block: "center", inline: "nearest" });
          } catch (__) {}
        }
        if (!vv) return;
        const rect = target.getBoundingClientRect();
        const topBound = vv.offsetTop + margin + 8;
        const botBound = vv.offsetTop + vv.height - margin - 8;
        let dy = 0;
        if (rect.top < topBound) dy = rect.top - topBound;
        else if (rect.bottom > botBound) dy = rect.bottom - botBound;
        if (!dy) return;
        if (scroller && scroller !== document.documentElement && scroller !== document.body) {
          scroller.scrollTop += dy;
        } else {
          window.scrollBy(0, dy);
        }
      };

      if (opts?.immediate) run();
      else {
        requestAnimationFrame(() => requestAnimationFrame(run));
      }
    }

    function clearFieldChrome() {
      activeField = null;
      document.querySelectorAll(".kb-scroll-pad").forEach((el) => {
        el.classList.remove("kb-scroll-pad");
        el.style.removeProperty("--kb-scroll-pad");
      });
      const kb = keyboardInset();
      setKbCss(kb);
      if (kb <= 36) {
        openOverlays().forEach((ov) => {
          /* Keep diet-add / export / log-sheet pinned while open — owners sync on vv. */
          if (ov.id === "diet-add-overlay" || ov.id === "diet-export-overlay" || ov.id === "log-sheet") return;
          if (ov.dataset.kbPinned === "1" && kb <= 36) {
            /* Admin overlays restore inset:0 via their own open style; skip clear. */
          }
        });
      }
    }

    function refresh() {
      const kb = keyboardInset();
      setKbCss(kb);
      openOverlays().forEach((ov) => {
        if (
          kb > 36 ||
          ov.id === "diet-add-overlay" ||
          ov.id === "diet-export-overlay" ||
          ov.id === "log-sheet" ||
          ov.dataset.kbPinned === "1"
        ) {
          pinOverlayToVv(ov);
        }
      });
      if (activeField && document.activeElement === activeField) {
        ensureInputVisible(activeField, { immediate: true });
      }
      try {
        if (typeof window.__sapnaOnKeyboardRefresh === "function") window.__sapnaOnKeyboardRefresh();
      } catch (_) {}
    }

    function scheduleRefresh() {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        raf = 0;
        refresh();
      });
    }

    function install() {
      if (installed) return;
      installed = true;
      document.addEventListener(
        "focusin",
        (e) => {
          if (!isField(e.target)) return;
          ensureInputVisible(e.target);
        },
        true
      );
      document.addEventListener(
        "focusout",
        (e) => {
          if (!isField(e.target)) return;
          setTimeout(() => {
            if (!isField(document.activeElement)) clearFieldChrome();
          }, 0);
        },
        true
      );
      const onVv = () => scheduleRefresh();
      if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", onVv);
        window.visualViewport.addEventListener("scroll", onVv);
      }
      window.addEventListener("resize", onVv);
      window.addEventListener("orientationchange", onVv);
    }

    return {
      install,
      ensureInputVisible,
      pinOverlayToVv,
      clearOverlayPin,
      keyboardInset,
      refresh: scheduleRefresh,
      isField,
    };
  })();
  window.SapnaKeyboard = SapnaKeyboard;

  function setStatus(el, msg, kind) {
    if (!el) return;
    if (!msg) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    el.hidden = false;
    el.textContent = msg;
    const sticky = el.id === "admin-status" ? " admin-status-sticky" : "";
    el.className = "status" + sticky + " is-" + (kind || "info");
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
  const PANELS = ["today", "workout", "diet", "periods", "logs"];

  function showPanel(name) {
    const id = PANELS.includes(name || "today") ? (name || "today") : "today";
    const prev = document.body.dataset.section;
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
    if (prev && prev !== id) Haptics.light();
    if (id === "today") Today.render();
    if (id === "workout") Workout.render();
    if (id === "diet") Diet.render();
    if (id === "periods") Periods.render();
    if (id === "logs") Weights.render();
    try {
      if (typeof TokenSetup !== "undefined" && TokenSetup.promptOnSection) TokenSetup.promptOnSection(id);
    } catch (_) {}
  }
  window.showPanel = showPanel;

  function wireNav() {
    document.querySelectorAll("[data-nav]").forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        showPanel(a.getAttribute("data-nav"));
      });
    });
    window.addEventListener("hashchange", () => {
      showPanel(location.hash.replace(/^#/, "") || "today");
    });
  }


  /* ───────── Today hub (home) ───────── */
  const Today = (() => {
    function ringHtml(label, value, target, unit) {
      const tg = Number(target) || 1;
      const v = Number(value) || 0;
      const pct = Math.max(0, Math.min(100, Math.round((v / tg) * 100)));
      const radius = 34;
      const circ = 2 * Math.PI * radius;
      const dash = (pct / 100) * circ;
      const unitLabel = unit === "g" ? "g" : unit === "kcal" ? " kcal" : "";
      return `<div class="today-ring">
        <svg viewBox="0 0 80 80" aria-hidden="true">
          <circle class="ring-bg" cx="40" cy="40" r="${radius}"></circle>
          <circle class="ring-fg" cx="40" cy="40" r="${radius}"
            stroke-dasharray="${dash.toFixed(2)} ${circ.toFixed(2)}" transform="rotate(-90 40 40)"></circle>
        </svg>
        <div class="ring-copy">
          <strong>${escapeHtml(String(v))}${unit === "g" ? "g" : ""}</strong>
          <span>${escapeHtml(label)}</span>
          <em>of ${escapeHtml(String(target))}${unitLabel}</em>
        </div>
      </div>`;
    }

    function pct(n, d) {
      if (!d) return 0;
      return Math.max(0, Math.min(100, Math.round((Number(n) / Number(d)) * 100)));
    }

    function barHtml(label, value, max, tone) {
      const p = pct(value, max);
      return `<div class="dash-bar" data-tone="${escapeHtml(tone || "warm")}">
        <div class="dash-bar-head"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}${max ? ` / ${escapeHtml(String(max))}` : ""}</strong></div>
        <div class="dash-bar-track"><i style="width:${p}%"></i></div>
      </div>`;
    }

    function render() {
      const root = $("today-overview");
      if (!root) return;
      const diet = Diet.snapshot ? Diet.snapshot() : { kcal: 0, protein: 0, targetKcal: 1300, targetProtein: 100 };
      const period = Periods.snapshot ? Periods.snapshot() : { label: "Open calendar", detail: "Mark days privately", isPeriod: false };
      const lifts = Weights.snapshot ? Weights.snapshot() : { recent: [], count: 0 };
      const workout = Workout.snapshot
        ? Workout.snapshot()
        : { title: "Today’s workout", detail: "Open session", liftsTotal: 0, liftsLogged: 0, stretchCount: 0 };

      const now = new Date();
      const dateLabel = now.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
      const kcalPct = pct(diet.kcal, diet.targetKcal);
      const proPct = pct(diet.protein, diet.targetProtein);
      const liftPct = workout.liftsTotal ? pct(workout.liftsLogged, workout.liftsTotal) : 0;
      const greetBase =
        now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";
      const greet = `${greetBase}, Sapna Singh`;

      const heroDate = $("today-date-line");
      if (heroDate) heroDate.textContent = dateLabel;
      const heroGreet = $("today-greet-line");
      if (heroGreet) heroGreet.textContent = greet;

      const recentHtml = lifts.recent.length
        ? `<ul class="today-lifts dash-lifts">${lifts.recent
            .map((e) => {
              const sr = e.sets != null && e.reps != null ? `${e.sets}×${e.reps}` : "";
              return `<li>
                <div class="dash-lift-main">
                  <strong>${escapeHtml(e.exercise)}</strong>
                  <em>${escapeHtml(e.date || "")}</em>
                </div>
                <div class="dash-lift-stats">
                  <span class="dash-lift-kg">${escapeHtml(String(e.weight))} kg</span>
                  ${sr ? `<span class="dash-lift-sr">${escapeHtml(sr)}</span>` : ""}
                </div>
              </li>`;
            })
            .join("")}</ul>`
        : `<p class="empty-teach">No lifts yet</p>`;

      const periodTone = period.isPeriod ? "rose" : "soft";
      const strip = $("today-strip");
      if (strip) {
        strip.innerHTML = `
        <div class="dash-strip" aria-label="Today at a glance">
          <button type="button" class="dash-pill" data-nav="workout">
            <em>Workout</em>
            <strong>${workout.liftsTotal ? `${workout.liftsLogged}/${workout.liftsTotal}` : "—"}</strong>
            <span>${workout.liftsTotal ? "lifts logged" : workout.waitingAdmin ? "no plan yet" : "plan ready"}</span>
          </button>
          <button type="button" class="dash-pill" data-nav="diet">
            <em>Diet</em>
            <strong>${diet.over ? `+${Math.round(diet.kcal - diet.targetKcal)}` : diet.left != null ? diet.left : Math.max(0, Math.round((diet.targetKcal || 0) - (diet.kcal || 0)))}</strong>
            <span>${diet.over ? "kcal over" : "kcal left"}</span>
          </button>
          <button type="button" class="dash-pill" data-nav="periods">
            <em>Cycle</em>
            <strong>${period.isPeriod ? "Day" : period.short || "—"}</strong>
            <span>${escapeHtml(period.label)}</span>
          </button>
        </div>`;
        strip.querySelectorAll("[data-nav]").forEach((a) => {
          a.addEventListener("click", (e) => {
            e.preventDefault();
            showPanel(a.getAttribute("data-nav"));
          });
        });
      }
      root.innerHTML = `
        <a class="today-card today-card-workout dash-card" href="#workout" data-nav="workout">
          <div class="dash-card-top">
            <p class="today-kicker">Workout tracker</p>
            <span class="dash-badge">${workout.waitingAdmin ? "—" : `${liftPct}%`}</span>
          </div>
          <h2>${escapeHtml(workout.title)}</h2>
          <p>${escapeHtml(workout.detail)}</p>
          ${
            workout.waitingAdmin
              ? `<p class="empty-teach">No plan yet — Admin publishes the first exercise plan.</p>`
              : `${barHtml("Session lifts", workout.liftsLogged || 0, workout.liftsTotal || 0, "gold")}
          <div class="dash-meta-row">
            <span>${Number(workout.stretchCount) || 0} stretches</span>
            <span>${Number(workout.liftsTotal) || 0} lifts in plan</span>
          </div>`
          }
          <span class="today-cta">${workout.waitingAdmin ? "See Workout" : "Open session"}</span>
        </a>

        <div class="dash-split">
          <div class="today-card today-card-diet dash-card">
            <div class="dash-card-top">
              <p class="today-kicker">Diet tracker</p>
              <span class="dash-badge">${kcalPct}%</span>
            </div>
            <p class="hf-today-left"><strong>${diet.over ? Math.round(diet.kcal - diet.targetKcal) : diet.left != null ? diet.left : Math.max(0, Math.round((diet.targetKcal || 0) - (diet.kcal || 0)))}</strong>
              <span>${diet.over ? "kcal over" : "kcal left"}</span></p>
            <p class="hf-today-meals">${["breakfast","lunch","dinner","snacks"].map((m) => {
              const on = diet.mealFill && diet.mealFill[m];
              const lab = m[0].toUpperCase();
              return `<span class="${on ? "is-on" : ""}">${lab}</span>`;
            }).join("")}</p>
            ${barHtml("Eaten", Math.round(diet.kcal), diet.targetKcal, "jade")}
            ${barHtml("Protein g", Math.round(diet.protein), diet.targetProtein, "jade")}
            <a class="today-cta" href="#diet" data-nav="diet">Log food</a>
          </div>

          <a class="today-card today-card-periods dash-card dash-card-${periodTone}" href="#periods" data-nav="periods">
            <div class="dash-card-top">
              <p class="today-kicker">Periods</p>
              <span class="dash-badge">${period.isPeriod ? "Active" : "Calm"}</span>
            </div>
            <h2>${escapeHtml(period.label)}</h2>
            <p>${escapeHtml(period.detail)}</p>
            <span class="today-cta">Open calendar</span>
          </a>
        </div>

        <div class="today-card today-card-logs dash-card">
          <div class="dash-card-top">
            <p class="today-kicker">Lift pulse</p>
            <span class="dash-badge">${Number(lifts.count) || 0} total</span>
          </div>
          ${recentHtml}
          <a class="today-cta" href="#logs" data-nav="logs">All logs</a>
        </div>`;

      root.querySelectorAll("[data-nav]").forEach((a) => {
        a.addEventListener("click", (e) => {
          e.preventDefault();
          showPanel(a.getAttribute("data-nav"));
        });
      });
      if (typeof Progress !== "undefined" && Progress.render) Progress.render();
    }

    return { render };
  })();

  /* ───────── Workout + LOG sheet (static panel; no remount while typing) ───────── */
  const Workout = (() => {
    let plan = null;
    let loaded = false;
    let sheetExercise = "";
    let sheetEditingId = null;
    let sheetScrollY = 0;
    /* UI-only: peek next exercise without completing current */
    let peekingNext = false;
    let wheelsBuilt = false;
    /* Guided session: idle | stretch | exercise | done */
    let session = {
      date: "",
      planHash: "",
      phase: "idle",
      exerciseIndex: 0,
      completedIds: [],
    };

    function sectionKind(section) {
      if (section?.kind === "stretch" || section?.id === "stretching") return "stretch";
      return "main";
    }

    function moveKey(m) {
      return String(m?.id || m?.name || "").trim();
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

    function planHasMoves(p) {
      if (!p || p.empty === true) return false;
      return (p.sections || []).some((sec) => Array.isArray(sec.moves) && sec.moves.length > 0);
    }

    function normalizeLoadedPlan(raw) {
      if (!raw || !planHasMoves(raw)) return null;
      return raw;
    }

    function planFingerprint(p) {
      if (!p) return "";
      const ids = [];
      (p.sections || []).forEach((sec) => {
        (sec.moves || []).forEach((m) => ids.push(moveKey(m)));
      });
      return [p.planDate || "", p.updatedAt || "", ids.join("|")].join("::");
    }

    function defaultSession() {
      return {
        date: todayISO(),
        planHash: planFingerprint(plan),
        phase: "idle",
        exerciseIndex: 0,
        completedIds: [],
      };
    }

    function readStoredSession() {
      try {
        const raw = localStorage.getItem(LS.guided);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") return null;
        return {
          date: String(parsed.date || ""),
          planHash: String(parsed.planHash || ""),
          phase: ["idle", "stretch", "exercise", "done"].includes(parsed.phase)
            ? parsed.phase
            : "idle",
          exerciseIndex: Math.max(0, Number(parsed.exerciseIndex) || 0),
          completedIds: Array.isArray(parsed.completedIds)
            ? parsed.completedIds.map((x) => String(x))
            : [],
        };
      } catch {
        return null;
      }
    }

    function persistSession() {
      try {
        localStorage.setItem(LS.guided, JSON.stringify(session));
      } catch (_) {}
    }

    function reconcileSession(saved) {
      if (!saved || saved.date !== todayISO()) return defaultSession();
      const { stretch, main } = movesByKind();
      const mainIds = main.map(moveKey).filter(Boolean);
      const hash = planFingerprint(plan);
      let phase = saved.phase;
      let exerciseIndex = saved.exerciseIndex;
      let completedIds = (saved.completedIds || []).filter((id) => mainIds.includes(id));

      if (saved.planHash !== hash) {
        /* Plan republished — remap, never soft-lock */
        if (phase === "stretch") {
          if (!stretch.length) phase = mainIds.length ? "exercise" : "idle";
          exerciseIndex = 0;
        } else if (phase === "exercise" || phase === "done") {
          const next = mainIds.findIndex((id) => !completedIds.includes(id));
          if (next < 0) {
            phase = mainIds.length ? "done" : "idle";
            exerciseIndex = Math.max(0, mainIds.length - 1);
          } else {
            phase = "exercise";
            exerciseIndex = next;
          }
        } else {
          phase = "idle";
          exerciseIndex = 0;
          completedIds = [];
        }
      }

      if (phase === "stretch" && !stretch.length) {
        phase = mainIds.length ? "exercise" : "idle";
        exerciseIndex = 0;
      }
      if (phase === "exercise") {
        if (!mainIds.length) {
          phase = "done";
          exerciseIndex = 0;
        } else {
          const frontier = mainIds.findIndex((id) => !completedIds.includes(id));
          if (frontier < 0) {
            /* All marked done — session complete */
            phase = "done";
            exerciseIndex = Math.max(0, mainIds.length - 1);
          } else {
            /* Allow resume on a past (completed) step or the frontier — never past frontier */
            exerciseIndex = Math.min(Math.max(0, exerciseIndex), frontier);
          }
        }
      }
      if (phase === "done" && !mainIds.length && !stretch.length) phase = "idle";

      return {
        date: todayISO(),
        planHash: hash,
        phase,
        exerciseIndex,
        completedIds,
      };
    }

    function adoptSessionFromStorage() {
      session = reconcileSession(readStoredSession());
      peekingNext = false;
      persistSession();
    }

    function setSession(partial) {
      session = {
        ...session,
        ...partial,
        date: todayISO(),
        planHash: planFingerprint(plan),
      };
      persistSession();
    }

    function startGuidedSession() {
      const { stretch, main } = movesByKind();
      if (!stretch.length && !main.length) return;
      Haptics.light();
      peekingNext = false;
      if (stretch.length) {
        setSession({ phase: "stretch", exerciseIndex: 0, completedIds: [] });
      } else {
        setSession({ phase: "exercise", exerciseIndex: 0, completedIds: [] });
      }
      render();
      $("session-stretch")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function restartGuidedSession() {
      if (!window.confirm("Restart today’s session from stretching? Progress on this phone for this session will reset.")) {
        return;
      }
      peekingNext = false;
      setSession({ phase: "idle", exerciseIndex: 0, completedIds: [] });
      render();
    }

    function completeStretching() {
      const { main } = movesByKind();
      Haptics.ok();
      peekingNext = false;
      if (!main.length) {
        setSession({ phase: "done", exerciseIndex: 0 });
      } else {
        setSession({ phase: "exercise", exerciseIndex: 0 });
      }
      render();
      $("session-active")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function frontierIndex(main) {
      const ids = (main || []).map(moveKey);
      const next = ids.findIndex((id) => id && !session.completedIds.includes(id));
      return next < 0 ? Math.max(0, ids.length - 1) : next;
    }

    function openPeekNext() {
      const { main } = movesByKind();
      const idx = Math.min(session.exerciseIndex, Math.max(0, main.length - 1));
      if (session.phase !== "exercise" || idx + 1 >= main.length) return;
      Haptics.light();
      peekingNext = true;
      render();
      $("guided-peek")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    function closePeekNext() {
      if (!peekingNext) return;
      peekingNext = false;
      render();
      $("session-active")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function goToExercise(index) {
      const { main } = movesByKind();
      if (session.phase !== "exercise" || !main.length) return;
      const frontier = frontierIndex(main);
      const i = Math.min(Math.max(0, Number(index) || 0), frontier);
      if (i !== session.exerciseIndex) Haptics.light();
      peekingNext = false;
      setSession({ phase: "exercise", exerciseIndex: i });
      render();
      $("session-active")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function goToPreviousExercise() {
      const idx = session.exerciseIndex;
      if (idx <= 0) return;
      goToExercise(idx - 1);
    }

    function completeCurrentExercise() {
      const { main } = movesByKind();
      Haptics.ok();
      peekingNext = false;
      if (!main.length) {
        setSession({ phase: "done", exerciseIndex: 0 });
        render();
        return;
      }
      const idx = Math.min(session.exerciseIndex, main.length - 1);
      const key = moveKey(main[idx]);
      const completedIds = session.completedIds.slice();
      const alreadyDone = key && completedIds.includes(key);
      if (key && !alreadyDone) completedIds.push(key);

      /* If she reopened a past done step, Completed returns her to the frontier */
      if (alreadyDone) {
        const next = main.findIndex((m) => {
          const id = moveKey(m);
          return id && !completedIds.includes(id);
        });
        if (next < 0) {
          setSession({ phase: "done", exerciseIndex: main.length - 1, completedIds });
        } else {
          setSession({ phase: "exercise", exerciseIndex: next, completedIds });
        }
      } else {
        const next = idx + 1;
        if (next >= main.length) {
          setSession({ phase: "done", exerciseIndex: main.length - 1, completedIds });
        } else {
          /* Advance only on explicit Completed — never from peek */
          setSession({ phase: "exercise", exerciseIndex: next, completedIds });
        }
      }
      render();
      if (session.phase === "exercise") {
        $("session-active")?.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        $("session-done-bar")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }

    function exerciseRailHtml(main, idx) {
      if (!main.length) return "";
      const frontier = frontierIndex(main);
      return `<ol class="guided-ex-rail" aria-label="Exercises — tap a past step to reopen">
        ${main
          .map((m, i) => {
            const key = moveKey(m);
            const done = session.completedIds.includes(key);
            const current = i === idx;
            const upcoming = i > frontier;
            const canOpen = i <= frontier;
            let cls = "guided-ex-rail-item";
            if (current) cls += " is-current";
            if (done) cls += " is-done";
            if (upcoming) cls += " is-upcoming";
            if (canOpen) cls += " is-tappable";
            const label = current ? "Now" : done ? "Done" : upcoming ? "Up next" : String(i + 1);
            const check = done ? `<span class="guided-ex-rail-check" aria-hidden="true">✓</span>` : "";
            if (canOpen) {
              return `<li class="${cls}" aria-current="${current ? "step" : "false"}">
                <button type="button" class="guided-ex-rail-btn" data-ex-goto="${i}" aria-label="${escapeHtml(label + ": " + (m.name || "Move"))}" ${current ? 'aria-pressed="true"' : ""}>
                  ${check}
                  <span class="guided-ex-rail-num">${i + 1}</span>
                  <span class="guided-ex-rail-name">${escapeHtml(m.name || "Move")}</span>
                </button>
              </li>`;
            }
            return `<li class="${cls}" aria-current="false" aria-label="${escapeHtml(label + ": " + (m.name || "Move"))}">
              <span class="guided-ex-rail-num">${i + 1}</span>
              <span class="guided-ex-rail-name">${escapeHtml(m.name || "Move")}</span>
            </li>`;
          })
          .join("")}
      </ol>`;
    }

    function peekCardHtml(move, n, nextIdx) {
      return `<aside class="guided-peek" id="guided-peek" aria-label="Next exercise preview">
        <p class="guided-peek-kicker">Next</p>
        <h3 class="guided-peek-title">${escapeHtml(move.name || "Exercise")} <span class="move-group-tag">${nextIdx + 1}/${n}</span></h3>
        <p class="move-rx">${escapeHtml(move.rx || "As prescribed")}</p>
        ${remarksHtml(move)}
        ${gifPreviewHtml(move)}
        <button type="button" class="btn-ghost btn-peek-close" data-peek-close>Back</button>
      </aside>`;
    }

    function restNoteHtml() {
      const note = plan?.restNote;
      if (!note || (!note.title && !note.body)) return "";
      const title = escapeHtml(note.title || "Rest");
      let body = String(note.body || "").trim();
      /* One short line — split on sentence end, not decimal points */
      const cut = (body.match(/^[\s\S]*?[.!?](?=\s|$)/) || [body])[0].trim();
      body = cut.length > 72 ? cut.slice(0, 69).trim() + "…" : cut;
      body = escapeHtml(body);
      return `<aside class="guided-rest-note" aria-label="Rest and water">
        <p class="guided-rest-title">${title}</p>
        ${body ? `<p class="guided-rest-body">${body}</p>` : ""}
      </aside>`;
    }

    function idlePreviewHtml(stretch, main) {
      const stretchNames = stretch.map((m) => escapeHtml(m.name || "Stretch")).join(" · ");
      const liftRows = main
        .map((m, i) => `<li><span>${i + 1}.</span> ${escapeHtml(m.name || "Move")}</li>`)
        .join("");
      return `<div class="guided-idle" id="session-idle">
        ${
          stretch.length
            ? `<div class="guided-idle-block"><h2>Stretching <span class="move-group-tag">${stretch.length}</span></h2><p class="guided-idle-names">${stretchNames}</p></div>`
            : ""
        }
        ${
          main.length
            ? `<div class="guided-idle-block"><h2>Exercises <span class="move-group-tag">${main.length}</span></h2><ol class="guided-idle-list">${liftRows}</ol></div>`
            : ""
        }
      </div>`;
    }

    function lastLogLine(name) {
      const last = Weights.lastFor(name);
      if (!last) return "";
      const s = Weights.entrySets(last);
      const r = Weights.entryReps(last);
      const sr = Number.isFinite(s) && Number.isFinite(r) ? ` · ${s}×${r}` : "";
      return `${last.weight} kg${sr}`;
    }

    function absoluteGif(src) {
      if (!src) return "";
      if (/^https?:\/\//i.test(src)) return src;
      return WORKOUT_ORIGIN + String(src).replace(/^\.\//, "");
    }

    function gifPreviewHtml(move) {
      const name = move.name || "Move";
      if (move.demo === "svg-leg-swing" && !move.gif) {
        const fallback = absoluteGif("media/leg-swings.gif");
        return `<button type="button" class="gif-preview" data-gif-open data-gif-src="${escapeHtml(fallback)}" aria-label="Enlarge form demo for ${escapeHtml(name)}">
          <span class="gif-preview-frame">
            <img data-src="${escapeHtml(fallback)}" alt="" width="320" height="140" decoding="async" />
          </span>
        </button>`;
      }
      const src = absoluteGif(move.gif || "media/bodyweight-squats.gif");
      return `<button type="button" class="gif-preview" data-gif-open data-gif-src="${escapeHtml(src)}" aria-label="Enlarge form demo for ${escapeHtml(name)}">
        <span class="gif-preview-frame">
          <img data-src="${escapeHtml(src)}" alt="" width="320" height="140" decoding="async" />
        </span>
      </button>`;
    }

    function wireGifLazyLoad(root) {
      const imgs = (root || document).querySelectorAll(".gif-preview img[data-src]");
      const load = (img) => {
        const src = img.getAttribute("data-src");
        if (!src || img.dataset.loaded === "1") return;
        img.src = src;
        img.dataset.loaded = "1";
      };
      if (!("IntersectionObserver" in window)) {
        imgs.forEach(load);
        return;
      }
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            load(entry.target);
            io.unobserve(entry.target);
          });
        },
        { rootMargin: "120px 0px", threshold: 0.01 }
      );
      imgs.forEach((img) => io.observe(img));
    }

    let lightboxCloseTimer = 0;

    function openGifLightbox({ src, kind, title }) {
      const overlay = $("gif-lightbox");
      if (lightboxCloseTimer) { clearTimeout(lightboxCloseTimer); lightboxCloseTimer = 0; }
      const img = $("gif-lightbox-img");
      const label = $("gif-lightbox-title");
      if (!overlay) return;
      if (label) label.textContent = title || "Form demo";
      if (img) {
        if (kind === "svg" || !src) {
          img.hidden = true;
          img.removeAttribute("src");
        } else {
          img.hidden = false;
          img.alt = title ? `Form demo: ${title}` : "Form demo";
          img.src = src;
        }
      }
      const note = $("gif-lightbox-note");
      if (note) note.hidden = kind !== "svg";
      overlay.hidden = false;
      document.body.classList.add("gif-lightbox-open");
      requestAnimationFrame(() => overlay.classList.add("is-open"));
      try {
        $("gif-lightbox-close")?.focus({ preventScroll: true });
      } catch (_) {}
    }

    function closeGifLightbox() {
      const overlay = $("gif-lightbox");
      if (!overlay || overlay.hidden) return;
      overlay.classList.remove("is-open");
      document.body.classList.remove("gif-lightbox-open");
      if (lightboxCloseTimer) clearTimeout(lightboxCloseTimer);
      lightboxCloseTimer = setTimeout(() => {
        lightboxCloseTimer = 0;
        overlay.hidden = true;
        const img = $("gif-lightbox-img");
        if (img) {
          img.removeAttribute("src");
          img.alt = "";
        }
      }, 220);
    }

    function wireGifLightbox() {
      const root = $("workout-groups");
      if (root && root.dataset.gifWired !== "1") {
        root.dataset.gifWired = "1";
        root.addEventListener("click", (e) => {
          const btn = e.target.closest("[data-gif-open]");
          if (!btn) return;
          e.preventDefault();
          const card = btn.closest(".move-log-card");
          const title = card?.querySelector(".move-title")?.textContent?.trim() || "Form demo";
          const kind = btn.getAttribute("data-gif-kind") || "img";
          const src =
            btn.getAttribute("data-gif-src") ||
            btn.querySelector("img")?.getAttribute("data-src") ||
            btn.querySelector("img")?.src ||
            "";
          openGifLightbox({ src, kind, title });
        });
      }
      const overlay = $("gif-lightbox");
      if (!overlay || overlay.dataset.gifWired === "1") return;
      overlay.dataset.gifWired = "1";
      $("gif-lightbox-close")?.addEventListener("click", (e) => {
        e.preventDefault();
        closeGifLightbox();
      });
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeGifLightbox();
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeGifLightbox();
      });
    }

    function remarksHtml(move) {
      const note = String(move.remarks || "").trim();
      if (!note) return "";
      return `<p class="move-remarks">${escapeHtml(note)}</p>`;
    }

    function cardHtml(move, opts = {}) {
      const name = move.name || "Move";
      const isStretch = move.kind === "stretch";
      const gif = gifPreviewHtml(move);
      const key = moveKey(move);
      const activeClass = opts.active ? " is-guided-active" : "";
      if (isStretch) {
        return `<article class="move-log-card is-stretch${activeClass}" data-move="${escapeHtml(name)}" data-move-id="${escapeHtml(key)}" data-kind="stretch">
          <p class="move-title">${escapeHtml(name)}</p>
          <p class="move-rx">${escapeHtml(move.rx || "Easy and controlled")} · no weight log</p>
          ${remarksHtml(move)}
          ${gif}
        </article>`;
      }
      return `<article class="move-log-card${activeClass}" data-move="${escapeHtml(name)}" data-move-id="${escapeHtml(key)}" data-kind="main">
        <p class="move-title">${escapeHtml(name)}</p>
        <p class="move-rx">${escapeHtml(move.rx || "As prescribed")}</p>
        ${remarksHtml(move)}
        ${gif}
        <div class="move-log-actions">
          <p class="last-log">${escapeHtml(lastLogLine(name))}</p>
          <button type="button" class="btn-log-open" data-w-log-open>LOG</button>
        </div>
      </article>`;
    }

    function updateHeroCtas() {
      const start = $("start-session");
      const restart = $("restart-session");
      const support = $("workout-hero-support");
      const phase = session.phase;
      const active = phase === "stretch" || phase === "exercise" || phase === "done";
      if (start) {
        start.hidden = active;
        start.textContent = phase === "idle" ? "Start session" : "Start session";
      }
      if (restart) restart.hidden = !active;
      if (support) {
        support.hidden = true;
        support.textContent = "";
      }
    }

    function updateGuidedProgress(stretch, main) {
      const el = $("guided-progress");
      if (!el) return;
      const phase = session.phase;
      if (phase === "idle" || !plan) {
        el.hidden = true;
        el.innerHTML = "";
        return;
      }
      el.hidden = false;
      if (phase === "stretch") {
        el.innerHTML = `<p class="guided-progress-label">Stretching</p><p class="guided-progress-meta">${stretch.length}</p>`;
      } else if (phase === "exercise") {
        const n = main.length;
        const i = Math.min(session.exerciseIndex, Math.max(0, n - 1)) + 1;
        el.innerHTML = `<p class="guided-progress-label">${i} / ${n}</p><p class="guided-progress-meta">${session.completedIds.length} done</p>`;
      } else if (phase === "done") {
        el.innerHTML = `<p class="guided-progress-label">Done</p><p class="guided-progress-meta">${main.length}</p>`;
      }
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
        if (status) {
          status.hidden = false;
          status.textContent = "No plan yet — waiting for Admin.";
        }
        root.innerHTML = `<div class="empty-teach empty-plan-block">
          <p><strong>No workout plan yet.</strong></p>
          <p class="hint">Admin unlocks → <strong>Edit current plan</strong> or <strong>Create new plan</strong> → browse moves → Publish. Then refresh here.</p>
        </div>`;
        const start = $("start-session");
        const restart = $("restart-session");
        const cta = $("workout-cta-row");
        const doneBar = $("session-done-bar");
        if (start) {
          start.hidden = true;
          start.setAttribute("hidden", "");
        }
        if (restart) {
          restart.hidden = true;
          restart.setAttribute("hidden", "");
        }
        if (cta) {
          cta.hidden = true;
          cta.setAttribute("hidden", "");
        }
        if (doneBar) {
          doneBar.hidden = true;
          doneBar.setAttribute("hidden", "");
        }
        document.body.classList.remove("guided-session-active");
        updateGuidedProgress([], []);
        updateSessionSteps();
        return;
      }
      const ctaRow = $("workout-cta-row");
      if (ctaRow) {
        ctaRow.hidden = false;
        ctaRow.removeAttribute("hidden");
      }
      const { stretch, main } = movesByKind();
      const phase = session.phase;
      if (status) {
        status.textContent = plan.headline || "";
        status.hidden = !plan.headline;
      }

      let html = "";
      if (phase === "idle") {
        html = idlePreviewHtml(stretch, main);
        if (!stretch.length && !main.length) html = `<p class="hint">No plan today.</p>`;
      } else if (phase === "stretch") {
        html = `<div class="move-group session-stretch guided-phase" id="session-stretch">
          <h2>Stretching</h2>
          ${stretch.map((m) => cardHtml(m, { active: true })).join("")}
          <button type="button" class="btn-guided-done" id="stretch-completed" data-stretch-done>Stretching done</button>
        </div>`;
      } else if (phase === "exercise") {
        const idx = Math.min(session.exerciseIndex, Math.max(0, main.length - 1));
        const move = main[idx];
        if (!move) {
          html = `<p class="hint">No exercises left.</p>`;
        } else {
          const n = main.length;
          const frontier = frontierIndex(main);
          const reviewing = idx < frontier;
          const moveDone = session.completedIds.includes(moveKey(move));
          const hasNext = idx + 1 < n;
          const nextMove = hasNext ? main[idx + 1] : null;
          if (peekingNext && !hasNext) peekingNext = false;
          const peekBlock =
            peekingNext && nextMove ? peekCardHtml(nextMove, n, idx + 1) : "";
          let actions;
          if (peekingNext) {
            actions = `<div class="guided-ex-actions">
                <button type="button" class="btn-ghost btn-peek-close" data-peek-close>Back</button>
              </div>`;
          } else if (reviewing || moveDone) {
            actions = `<div class="guided-ex-actions guided-ex-actions-review">
                ${idx > 0 ? `<button type="button" class="btn-ghost btn-ex-back" data-ex-back>Previous</button>` : ""}
                <button type="button" class="btn-ghost btn-ex-latest" data-ex-latest>Latest</button>
                <button type="button" class="btn-guided-done" id="exercise-done" data-exercise-done>Continue</button>
              </div>`;
          } else {
            actions = `<div class="guided-ex-actions">
                ${idx > 0 ? `<button type="button" class="btn-ghost btn-ex-back" data-ex-back>Previous</button>` : ""}
                ${
                  hasNext
                    ? `<button type="button" class="btn-ghost btn-peek-next" id="peek-next" data-peek-next>See next</button>`
                    : ""
                }
                <button type="button" class="btn-guided-done" id="exercise-done" data-exercise-done>Completed</button>
              </div>`;
          }
          html = `<div class="move-group session-active guided-phase" id="session-active">
            <h2>${escapeHtml(move.name || "Exercise")} <span class="move-group-tag">${idx + 1}/${n}</span></h2>
            ${exerciseRailHtml(main, idx)}
            ${peekBlock}
            <div class="guided-current-block${peekingNext ? " is-dimmed-by-peek" : ""}" id="guided-current-block">
              ${cardHtml(move, { active: true })}
              ${restNoteHtml()}
            </div>
            ${actions}
          </div>`;
        }
      } else if (phase === "done") {
        html = `<div class="guided-complete" id="session-complete">
          <p class="guided-complete-title">Done</p>
        </div>`;
      }

      if (!html) html = `<p class="hint">No plan today.</p>`;
      root.innerHTML = html;
      document.body.classList.toggle("guided-session-active", phase === "stretch" || phase === "exercise");
      wireGifLightbox();
      wireGifLazyLoad(root);
      refreshCardSummaries();
      updateHeroCtas();
      updateGuidedProgress(stretch, main);
      updateSessionSteps();
    }

    function updateSessionSteps() {
      const { stretch, main } = movesByKind();
      const phase = session.phase;
      const logged = main.filter((m) => Weights.lastFor(m.name)).length;
      document.querySelectorAll(".session-step").forEach((el) => {
        const step = el.getAttribute("data-step");
        el.classList.remove("is-active", "is-done");
        if (step === "stretch") {
          if (phase === "stretch") el.classList.add("is-active");
          else if (phase === "exercise" || phase === "done" || (!stretch.length && phase !== "idle")) {
            el.classList.add("is-done");
          }
        } else if (step === "lift") {
          if (phase === "exercise") el.classList.add("is-active");
          else if (phase === "done") el.classList.add("is-done");
        } else if (step === "done") {
          if (phase === "done") el.classList.add("is-active", "is-done");
        }
      });
      const bar = $("session-done-bar");
      if (bar) {
        const show = phase === "done";
        bar.hidden = !show;
        if (show) {
          const p = bar.querySelector("p");
          if (p) {
            p.innerHTML = `<strong>Done.</strong> ${logged}/${main.length} logged`;
          }
        }
      }
    }

    function refreshCardSummaries() {
      document.querySelectorAll(".move-log-card[data-kind='main']").forEach((card) => {
        const name = card.getAttribute("data-move") || card.querySelector(".move-title")?.textContent || "";
        const last = card.querySelector(".last-log");
        if (last) {
          const line = lastLogLine(name.trim());
          last.textContent = line;
          last.hidden = !line;
        }
      });
    }

    function setSheetEditMode(id) {
      sheetEditingId = id == null ? null : id;
      const banner = $("log-sheet-edit-banner");
      const save = $("log-sheet-save");
      const del = $("log-sheet-delete");
      const cancel = $("log-sheet-cancel");
      const editing = sheetEditingId != null;
      if (banner) banner.hidden = !editing;
      if (save) save.textContent = editing ? "Update" : "Save";
      if (del) del.hidden = !editing;
      if (cancel) cancel.hidden = !editing;
      document.querySelectorAll("#log-sheet-tbody tr").forEach((tr) => {
        tr.classList.toggle("is-selected", String(tr.getAttribute("data-log-id")) === String(sheetEditingId || ""));
      });
    }

    function labelForISODate(iso) {
      const today = todayISO();
      if (iso === today) return "Today";
      const d = new Date(iso + "T12:00:00");
      const y = new Date();
      y.setHours(12, 0, 0, 0);
      y.setDate(y.getDate() - 1);
      if (iso === y.toISOString().slice(0, 10)) return "Yest";
      if (Number.isNaN(d.getTime())) return iso;
      return d.toLocaleDateString(undefined, { month: "numeric", day: "numeric" });
    }

    function dateWheelOptions(extraIso) {
      const seen = new Set();
      const out = [];
      const push = (iso) => {
        if (!iso || seen.has(iso)) return;
        seen.add(iso);
        out.push({ value: iso, label: labelForISODate(iso) });
      };
      if (extraIso) push(extraIso);
      for (let i = 21; i >= 0; i--) {
        const d = new Date();
        d.setHours(12, 0, 0, 0);
        d.setDate(d.getDate() - i);
        push(d.toISOString().slice(0, 10));
      }
      out.sort((a, b) => a.value.localeCompare(b.value));
      return out;
    }

    function ensureWheelsBuilt() {
      if (wheelsBuilt) return;
      const kgList = $("log-wheel-kg");
      const repsList = $("log-wheel-reps");
      const setsList = $("log-wheel-sets");
      const dateList = $("log-wheel-date");
      if (!kgList || !repsList || !setsList || !dateList) return;

      const kgItems = [];
      for (let k = 0; k <= 200; k += 0.5) {
        const v = Math.round(k * 10) / 10;
        kgItems.push({ value: String(v), label: Number.isInteger(v) ? String(v) : v.toFixed(1) });
      }
      const fill = (ul, items) => {
        ul.innerHTML = items
          .map(
            (it) =>
              `<li class="log-wheel-item" role="option" data-value="${escapeHtml(it.value)}">${escapeHtml(it.label)}</li>`
          )
          .join("");
      };
      fill(kgList, kgItems);
      fill(
        repsList,
        Array.from({ length: 40 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))
      );
      fill(
        setsList,
        Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))
      );
      fill(dateList, dateWheelOptions());

      ["log-wheel-kg", "log-wheel-reps", "log-wheel-sets", "log-wheel-date"].forEach((id) => {
        const ul = $(id);
        const vp = ul?.closest(".log-wheel-viewport");
        if (!vp || vp.dataset.wheelWired === "1") return;
        vp.dataset.wheelWired = "1";
        let timer = 0;
        const sync = () => syncWheelFromScroll(vp);
        vp.addEventListener(
          "scroll",
          () => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(sync, 80);
          },
          { passive: true }
        );
        vp.addEventListener("scrollend", sync);
      });
      wheelsBuilt = true;
    }

    function wheelKeyForViewport(vp) {
      const col = vp?.closest("[data-wheel]");
      return col?.getAttribute("data-wheel") || "";
    }

    function hiddenIdForWheel(key) {
      if (key === "kg") return "log-sheet-kg";
      if (key === "reps") return "log-sheet-reps";
      if (key === "sets") return "log-sheet-sets";
      if (key === "date") return "log-sheet-date";
      return "";
    }

    function syncWheelFromScroll(vp, opts = {}) {
      if (!vp) return;
      const items = [...vp.querySelectorAll(".log-wheel-item")];
      if (!items.length) return;
      const mid = vp.scrollTop + vp.clientHeight / 2;
      let best = items[0];
      let bestDist = Infinity;
      items.forEach((li) => {
        const center = li.offsetTop + li.offsetHeight / 2;
        const dist = Math.abs(center - mid);
        if (dist < bestDist) {
          bestDist = dist;
          best = li;
        }
      });
      items.forEach((li) => li.classList.toggle("is-selected", li === best));
      const key = wheelKeyForViewport(vp);
      const hid = hiddenIdForWheel(key);
      const next = best.getAttribute("data-value") || "";
      const prev = vp.dataset.wheelValue;
      if (hid && $(hid)) $(hid).value = next;
      if (opts.haptic !== false && prev != null && prev !== "" && prev !== next) {
        Haptics.tick();
      }
      vp.dataset.wheelValue = next;
    }

    function setWheelValue(key, value) {
      ensureWheelsBuilt();
      const hid = hiddenIdForWheel(key);
      const listId =
        key === "kg" ? "log-wheel-kg" : key === "reps" ? "log-wheel-reps" : key === "sets" ? "log-wheel-sets" : "log-wheel-date";
      const ul = $(listId);
      const vp = ul?.closest(".log-wheel-viewport");
      if (!ul || !vp) return;
      let target = String(value);
      if (key === "kg") {
        const n = Number(value);
        if (Number.isFinite(n)) target = String(Math.round(n * 2) / 2);
      }
      if (key === "date") {
        /* Rebuild date labels so Today stays correct; include edit date if older */
        const dateList = $("log-wheel-date");
        if (dateList) {
          dateList.innerHTML = dateWheelOptions(target)
            .map(
              (it) =>
                `<li class="log-wheel-item" role="option" data-value="${escapeHtml(it.value)}">${escapeHtml(it.label)}</li>`
            )
            .join("");
        }
      }
      const esc = (s) =>
        typeof CSS !== "undefined" && CSS.escape ? CSS.escape(s) : String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      let li = ul.querySelector(`.log-wheel-item[data-value="${esc(target)}"]`);
      if (!li && key === "kg") {
        /* snap to nearest 0.5 */
        const n = Number(target);
        if (Number.isFinite(n)) {
          const snap = String(Math.round(n * 2) / 2);
          li = ul.querySelector(`.log-wheel-item[data-value="${esc(snap)}"]`);
          target = snap;
        }
      }
      if (!li && key === "date") {
        target = todayISO();
        li = ul.querySelector(`.log-wheel-item[data-value="${esc(target)}"]`);
      }
      if (!li) li = ul.querySelector(".log-wheel-item");
      if (!li) return;
      const top = Math.max(0, li.offsetTop - (vp.clientHeight - li.offsetHeight) / 2);
      vp.scrollTop = top;
      ul.querySelectorAll(".log-wheel-item").forEach((el) => el.classList.toggle("is-selected", el === li));
      const val = li.getAttribute("data-value") || target;
      if (hid && $(hid)) $(hid).value = val;
      vp.dataset.wheelValue = val;
    }

    function defaultWheelValues() {
      const today = todayISO();
      const todayRows = sheetExercise
        ? Weights.entriesFor(sheetExercise).filter((e) => String(e.date || "") === today)
        : [];
      /* New log: 5 kg · 12 reps · set N where N = today’s entries + 1 (1st → 1, 2nd → 2, …) */
      const nextSet = Math.min(12, Math.max(1, todayRows.length + 1));
      const lastToday = todayRows[todayRows.length - 1] || null;
      const kg =
        lastToday && Number.isFinite(Number(lastToday.weight)) ? Number(lastToday.weight) : 5;
      const reps =
        lastToday && Number.isFinite(Weights.entryReps(lastToday))
          ? Weights.entryReps(lastToday)
          : 12;
      return {
        kg,
        reps,
        sets: nextSet,
        date: today,
      };
    }

    function applyWheels(values) {
      ensureWheelsBuilt();
      const v = values || defaultWheelValues();
      setWheelValue("kg", v.kg);
      setWheelValue("reps", v.reps);
      setWheelValue("sets", v.sets);
      setWheelValue("date", v.date || todayISO());
    }

    function readWheels() {
      ensureWheelsBuilt();
      ["log-wheel-kg", "log-wheel-reps", "log-wheel-sets", "log-wheel-date"].forEach((id) => {
        const vp = $(id)?.closest(".log-wheel-viewport");
        if (vp) syncWheelFromScroll(vp);
      });
      return {
        kg: Number($("log-sheet-kg")?.value),
        reps: Number($("log-sheet-reps")?.value),
        sets: Number($("log-sheet-sets")?.value),
        date: String($("log-sheet-date")?.value || todayISO()),
      };
    }

    function clearSheetForm() {
      setSheetEditMode(null);
      applyWheels(defaultWheelValues());
    }

    function blurSheetInputs() {
      try {
        const active = document.activeElement;
        if (active && typeof active.blur === "function" && $("log-sheet")?.contains(active)) active.blur();
      } catch (_) {}
    }

    function hideSheetConfirm() {
      const panel = $("log-sheet-confirm");
      if (!panel) return;
      panel.hidden = true;
      panel.setAttribute("hidden", "");
    }

    function showSheetConfirm() {
      const panel = $("log-sheet-confirm");
      if (!panel) return;
      blurSheetInputs();
      panel.hidden = false;
      panel.removeAttribute("hidden");
      setTimeout(() => {
        try {
          $("log-sheet-confirm-ok")?.focus({ preventScroll: true });
        } catch (_) {
          try {
            $("log-sheet-confirm-ok")?.focus();
          } catch (__) {}
        }
      }, 80);
    }

    function performSheetDelete() {
      if (sheetEditingId == null) return;
      hideSheetConfirm();
      Weights.removeEntry(sheetEditingId);
      clearSheetForm();
      fillSheetTable();
      refreshCardSummaries();
      updateSessionSteps();
      const status = $("log-sheet-status");
      if (status) {
        status.hidden = false;
        status.textContent = "Log deleted.";
        status.className = "log-sheet-status is-ok";
      }
    }

    function selectSheetRow(id) {
      const entry = Weights.getEntry(id);
      if (!entry) return;
      applyWheels({
        kg: entry.weight ?? 20,
        sets: Weights.entrySets(entry) ?? 3,
        reps: Weights.entryReps(entry) ?? 10,
        date: entry.date || todayISO(),
      });
      setSheetEditMode(entry.id);
      fillSheetTable();
      const status = $("log-sheet-status");
      if (status) {
        status.hidden = false;
        status.textContent = "Selected — spin the wheels & Update, or Delete.";
        status.className = "log-sheet-status is-ok";
      }
      try {
        $("log-sheet-save")?.focus({ preventScroll: true });
      } catch (_) {}
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
          const selected = sheetEditingId != null && String(sheetEditingId) === String(e.id);
          return `<tr data-log-id="${escapeHtml(String(e.id))}" class="log-sheet-row${selected ? " is-selected" : ""}" role="button" tabindex="0" aria-label="Edit log ${escapeHtml(e.date)}">
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
      if (window.SapnaKeyboard?.pinOverlayToVv) {
        window.SapnaKeyboard.pinOverlayToVv(overlay);
        return;
      }
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
      ensureWheelsBuilt();
      fillSheetTable();
      const status = $("log-sheet-status");
      if (status) {
        status.hidden = true;
        status.textContent = "";
      }
      clearSheetForm();
      sheetScrollY = window.scrollY || 0;
      overlay.hidden = false;
      overlay.classList.add("is-open");
      document.body.classList.add("log-sheet-open");
      document.body.style.top = `-${sheetScrollY}px`;
      syncSheetViewport();
      setTimeout(() => {
        applyWheels(defaultWheelValues());
        try {
          $("log-sheet-save")?.focus({ preventScroll: true });
        } catch {
          try {
            $("log-sheet-save")?.focus();
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
      sheetEditingId = null;
      hideSheetConfirm();
      refreshCardSummaries();
    }

    function wire() {
      $("start-session")?.addEventListener("click", (e) => {
        e.preventDefault();
        startGuidedSession();
      });
      $("restart-session")?.addEventListener("click", (e) => {
        e.preventDefault();
        restartGuidedSession();
      });

      $("workout-groups")?.addEventListener("click", (e) => {
        const stretchDone = e.target.closest("[data-stretch-done]");
        if (stretchDone) {
          e.preventDefault();
          completeStretching();
          return;
        }
        const peekOpen = e.target.closest("[data-peek-next]");
        if (peekOpen) {
          e.preventDefault();
          openPeekNext();
          return;
        }
        const peekClose = e.target.closest("[data-peek-close]");
        if (peekClose) {
          e.preventDefault();
          closePeekNext();
          return;
        }
        const gotoBtn = e.target.closest("[data-ex-goto]");
        if (gotoBtn) {
          e.preventDefault();
          goToExercise(Number(gotoBtn.getAttribute("data-ex-goto")));
          return;
        }
        const backBtn = e.target.closest("[data-ex-back]");
        if (backBtn) {
          e.preventDefault();
          goToPreviousExercise();
          return;
        }
        const latestBtn = e.target.closest("[data-ex-latest]");
        if (latestBtn) {
          e.preventDefault();
          const { main } = movesByKind();
          goToExercise(frontierIndex(main));
          return;
        }
        const exDone = e.target.closest("[data-exercise-done]");
        if (exDone) {
          e.preventDefault();
          completeCurrentExercise();
          return;
        }
        const btn = e.target.closest("[data-w-log-open]");
        if (!btn) return;
        /* LOG on peek preview uses that move's name; current card still works */
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
          const { kg, sets, reps, date } = readWheels();
          const status = $("log-sheet-status");
          if (!sheetExercise || !Number.isFinite(kg)) {
            if (status) {
              status.hidden = false;
              status.textContent = "Spin Kg to a value.";
              status.className = "log-sheet-status is-error";
            }
            return;
          }
          if (!Number.isFinite(sets) || !Number.isFinite(reps)) {
            if (status) {
              status.hidden = false;
              status.textContent = "Spin Sets and Reps.";
              status.className = "log-sheet-status is-error";
            }
            return;
          }
          const logDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayISO();
          if (sheetEditingId != null) {
            const ok = Weights.updateEntry(sheetEditingId, { weight: kg, sets, reps, date: logDate });
            if (!ok) {
              if (status) {
                status.hidden = false;
                status.textContent = "Could not update that log.";
                status.className = "log-sheet-status is-error";
              }
              return;
            }
            Haptics.ok();
            if (status) {
              status.hidden = false;
              status.textContent = `Updated · ${kg} kg · ${sets}×${reps}`;
              status.className = "log-sheet-status is-ok";
            }
          } else {
            Weights.addEntry({
              exercise: sheetExercise,
              weight: kg,
              sets,
              reps,
              kind: "main",
              date: logDate,
            });
            Haptics.ok();
            if (status) {
              status.hidden = false;
              status.textContent = `Saved ${kg} kg · ${sets}×${reps}.`;
              status.className = "log-sheet-status is-ok";
            }
          }
          clearSheetForm();
          fillSheetTable();
          refreshCardSummaries();
          updateSessionSteps();
          try {
            $("log-sheet-save")?.focus({ preventScroll: true });
          } catch (_) {}
        });
        $("log-sheet-cancel")?.addEventListener("click", (e) => {
          e.preventDefault();
          clearSheetForm();
          fillSheetTable();
          const status = $("log-sheet-status");
          if (status) {
            status.hidden = false;
            status.textContent = "Ready for a new entry.";
            status.className = "log-sheet-status is-ok";
          }
        });
        $("log-sheet-delete")?.addEventListener("click", (e) => {
          e.preventDefault();
          if (sheetEditingId == null) return;
          showSheetConfirm();
        });
        $("log-sheet-confirm-cancel")?.addEventListener("click", (e) => {
          e.preventDefault();
          hideSheetConfirm();
        });
        $("log-sheet-confirm-ok")?.addEventListener("click", (e) => {
          e.preventDefault();
          performSheetDelete();
        });
        $("log-sheet-confirm")?.addEventListener("click", (e) => {
          if (e.target === $("log-sheet-confirm")) hideSheetConfirm();
        });
        $("log-sheet-tbody")?.addEventListener("click", (e) => {
          const row = e.target.closest("tr[data-log-id]");
          if (!row) return;
          selectSheetRow(row.getAttribute("data-log-id"));
        });
        $("log-sheet-tbody")?.addEventListener("keydown", (e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          const row = e.target.closest("tr[data-log-id]");
          if (!row) return;
          e.preventDefault();
          selectSheetRow(row.getAttribute("data-log-id"));
        });
        const onVv = () => syncSheetViewport();
        if (window.visualViewport) {
          window.visualViewport.addEventListener("resize", onVv);
          window.visualViewport.addEventListener("scroll", onVv);
        }
        window.addEventListener("resize", onVv);
      }
    }

    function loadLocalPlan(next) {
      plan = normalizeLoadedPlan(next);
      loaded = true;
      if (plan) {
        const { main } = movesByKind();
        Weights.suggestFromMoves(main.map((m) => ({ name: m.name, kind: "main" })));
      }
      adoptSessionFromStorage();
      render();
      refreshCardSummaries();
      updateSessionSteps();
    }

    async function init() {
      wire();
      try {
        const res = await fetch(WORKOUT_PLAN_URL + "?t=" + Date.now(), { cache: "no-store" });
        if (!res.ok) throw new Error("no plan");
        plan = normalizeLoadedPlan(await res.json());
        if (plan) {
          const { main } = movesByKind();
          Weights.suggestFromMoves(main.map((m) => ({ name: m.name, kind: "main" })));
        }
      } catch {
        plan = null;
      }
      loaded = true;
      adoptSessionFromStorage();
      render();
    }

    function snapshot() {
      if (!loaded) {
        return { title: "Today’s workout", detail: "Loading plan…", liftsTotal: 0, liftsLogged: 0, stretchCount: 0, waitingAdmin: false };
      }
      if (!plan) {
        return {
          title: "No plan yet",
          detail: "Waiting for Admin to publish the first exercise plan",
          liftsTotal: 0,
          liftsLogged: 0,
          stretchCount: 0,
          waitingAdmin: true,
        };
      }
      const { stretch, main } = movesByKind();
      const liftsLogged = main.filter((m) => Weights.lastFor(m.name)).length;
      const n = main.length;
      let detail = "Open session when ready";
      if (session.phase === "stretch") detail = "In session · stretching";
      else if (session.phase === "exercise") {
        detail = `In session · ${Math.min(session.exerciseIndex + 1, n)}/${n}`;
      } else if (session.phase === "done") detail = "Session complete today";
      else if (n) detail = `${liftsLogged}/${n} lifts logged · ${stretch.length} stretches`;
      return {
        title: plan.headline || "Today’s workout",
        detail,
        liftsTotal: n,
        liftsLogged,
        stretchCount: stretch.length,
        waitingAdmin: false,
      };
    }

    const api = { init, render, snapshot, refreshSummaries: refreshCardSummaries, loadLocalPlan };
    window.Workout = api;
    return api;
  })();

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* ───────── Gemini (only 2 call types — food bootstrap + coach) ───────── */
  const Gemini = (() => {
    /* Prefer current free Flash; walk chain if a model is retired (resume-builder style try-next). */
    const MODEL_CANDIDATES = [
      "gemini-3.8-flash",
      "gemini-3.1-flash-lite",
      "gemini-flash-latest",
      "gemini-2.0-flash",
    ];
    const LS_MODEL = "sapna_gemini_model";
    const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

    function getKey() {
      return (localStorage.getItem(LS.gemini) || "").trim();
    }
    function saveKey(key) {
      const k = String(key || "").trim();
      if (k) localStorage.setItem(LS.gemini, k);
      else localStorage.removeItem(LS.gemini);
    }
    function hasKey() {
      return !!getKey();
    }

    function preferredModels() {
      const saved = (localStorage.getItem(LS_MODEL) || "").trim();
      const list = [...MODEL_CANDIDATES];
      if (saved && !list.includes(saved)) list.unshift(saved);
      else if (saved) {
        return [saved, ...list.filter((m) => m !== saved)];
      }
      return list;
    }

    function rememberModel(model) {
      try {
        if (model) localStorage.setItem(LS_MODEL, model);
      } catch (_) {}
    }

    function isModelUnavailableError(msg, status) {
      const m = String(msg || "").toLowerCase();
      if (status === 404) return true;
      return /no longer available|not found|is not supported|unsupported|unknown model|invalid model|not available to new users/.test(
        m
      );
    }

    async function generateWithModel(model, { prompt, schema, useSearch, key }) {
      const body = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: "application/json",
        },
      };
      if (schema) body.generationConfig.responseSchema = schema;
      if (useSearch) body.tools = [{ googleSearch: {} }];
      const url = `${BASE}/${model}:generateContent?key=${encodeURIComponent(key)}`;
      const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timer = ctrl ? setTimeout(() => ctrl.abort(), 14000) : null;
      let res;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: ctrl?.signal,
        });
      } catch (e) {
        const err = new Error(
          e?.name === "AbortError" ? `Gemini timed out (${model}).` : e?.message || "Gemini network error."
        );
        err.status = 0;
        err.model = model;
        throw err;
      } finally {
        if (timer) clearTimeout(timer);
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error?.message || `Gemini ${res.status}`;
        const err = new Error(msg);
        err.status = res.status;
        err.model = model;
        throw err;
      }
      const textOut = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
      if (!textOut.trim()) {
        const err = new Error("Gemini returned an empty answer.");
        err.model = model;
        throw err;
      }
      try {
        return { json: JSON.parse(textOut), model };
      } catch {
        const m = textOut.match(/\{[\s\S]*\}/);
        if (m) return { json: JSON.parse(m[0]), model };
        const err = new Error("Could not parse Gemini JSON.");
        err.model = model;
        throw err;
      }
    }

    async function generate({ prompt, schema, useSearch }) {
      const key = getKey();
      if (!key) throw new Error("Add a Gemini API key in Admin first.");
      const models = preferredModels();
      let lastError;
      for (const model of models) {
        try {
          const { json, model: used } = await generateWithModel(model, { prompt, schema, useSearch, key });
          rememberModel(used);
          return json;
        } catch (e) {
          lastError = e;
          /* Walk model list on unavailable; any other failure → exit so Puter can run. */
          if (isModelUnavailableError(e?.message, e?.status)) continue;
          throw e;
        }
      }
      throw lastError instanceof Error ? lastError : new Error(String(lastError));
    }

    function prepareEnrichFoods(rawList) {
      const list = String(rawList || "")
        .split(/\n|,/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 40);
      if (!list.length) throw new Error("List at least one food (one per line).");
      const prompt = `You estimate nutrition for Sapna's regular Indian / home foods.
For each food name, return typical per-serving values an adult woman might log.
Prefer common Indian serving sizes when unclear (e.g. 1 medium roti, 1 bowl dal, 100g paneer).
Foods:
${list.map((f, i) => `${i + 1}. ${f}`).join("\n")}
Return JSON only matching the schema.`;
      const schema = {
        type: "object",
        properties: {
          foods: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                serving: { type: "string" },
                kcal: { type: "number" },
                protein: { type: "number" },
                carbs: { type: "number" },
                fat: { type: "number" },
              },
              required: ["name", "serving", "kcal", "protein"],
            },
          },
        },
        required: ["foods"],
      };
      const example = {
        foods: [
          { name: "Roti", serving: "1 medium", kcal: 120, protein: 3, carbs: 20, fat: 3 },
        ],
      };
      return { prompt, schema, example };
    }

    async function enrichFoods(rawList) {
      const { prompt, schema } = prepareEnrichFoods(rawList);
      /* One request for the whole list — local library after that. (No per-food calls.) */
      return generate({ prompt, schema, useSearch: false });
    }

    function preparePackagedProduct({ brand, product, servingHint, notes }) {
      const b = String(brand || "").trim();
      const p = String(product || "").trim();
      if (!b && !p) throw new Error("Enter a brand and/or product name.");
      if (!p) throw new Error("Enter the product name.");
      const hint = String(servingHint || "").trim();
      const note = String(notes || "").trim();
      const prompt = `You look up typical packaged-food nutrition for an adult woman logging meals in India.
Return one product object with realistic label-style nutrition_facts for the stated serving_size.
Prefer official / common Indian retail packs when the brand is known. If uncertain, use a clear best-estimate per 100g and set serving_size to "100g".
Do not invent medical claims. Numbers must be plausible for that food type.
Brand: ${b || "(unknown)"}
Product: ${p}
Serving hint from user: ${hint || "(none — prefer 100g if unsure)"}
Notes: ${note || "(none)"}
Return JSON only matching the schema.`;
      const schema = {
        type: "object",
        properties: {
          brand: { type: "string" },
          product: { type: "string" },
          serving_size: { type: "string" },
          nutrition_facts: {
            type: "object",
            properties: {
              energy_kcal: { type: "number" },
              protein_g: { type: "number" },
              total_carbohydrates_g: { type: "number" },
              dietary_fibre_g: { type: "number" },
              total_sugars_g: { type: "number" },
              added_sugars_g: { type: "number" },
              total_fat_g: { type: "number" },
              saturated_fat_g: { type: "number" },
              trans_fat_g: { type: "number" },
              cholesterol_mg: { type: "number" },
              sodium_mg: { type: "number" },
            },
            required: ["energy_kcal", "protein_g"],
          },
        },
        required: ["brand", "product", "serving_size", "nutrition_facts"],
      };
      const example = {
        brand: b || "Brand",
        product: p,
        serving_size: hint || "100g",
        nutrition_facts: {
          energy_kcal: 241.4,
          protein_g: 13.41,
          total_carbohydrates_g: 43.97,
          dietary_fibre_g: 6.31,
          total_sugars_g: 4.1,
          added_sugars_g: 2.01,
          total_fat_g: 1.32,
          saturated_fat_g: 0.2,
          trans_fat_g: 0,
          cholesterol_mg: 0,
          sodium_mg: 340,
        },
      };
      return { prompt, schema, example };
    }

    async function enrichPackagedProduct(input) {
      const { prompt, schema } = preparePackagedProduct(input);
      return generate({ prompt, schema, useSearch: false });
    }

    function prepareCoach(snapshot) {
      const prompt = `You are a gentle health coach for Sapna (private, adult woman).
Use ONLY this snapshot. Do not invent exact medical diagnoses. Be practical and kind.
If period day or late luteal / menstrual phase, include food ideas that may ease cramps (iron, magnesium, hydration, warm meals) and exercise intensity advice.
Respect diet styles, allergies, calorie/protein targets, and any safety notes in snapshot.profile (injuries, pregnancy, conditions) when suggesting food and exercise — keep intensity conservative if safety flags exist.
Snapshot JSON:
${JSON.stringify(snapshot)}
Return JSON matching the schema.`;
      const schema = {
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
      const example = {
        summary: "Short kind summary.",
        wins: ["One win"],
        watch: ["One watch item"],
        periodTips: ["One period tip"],
        eatNext: ["Food idea"],
        exerciseIdeas: [{ name: "Walk", why: "Gentle", when: "Today" }],
      };
      return { prompt, schema, example };
    }

    async function coach(snapshot) {
      const { prompt, schema } = prepareCoach(snapshot);
      return generate({ prompt, schema, useSearch: false });
    }

    function prepareDietPlan(targets) {
      const kcal = Number(targets?.kcal) || 1300;
      const pro = Number(targets?.protein) || 100;
      const prompt = `You build a simple one-day Indian / home meal plan for Sapna.
Target about ${kcal} kcal and ${pro}g protein total across breakfast, lunch, dinner, snacks.
Return JSON only with:
- headline (short)
- meals: { breakfast, lunch, dinner, snacks } — each an array of { name, kcal, protein, note }
Use 2–4 items per meal slot. Realistic home portions. Prefer roti, dal, sabzi, eggs, paneer, curd, fruit, oats.`;
      const schema = {
        type: "object",
        properties: {
          headline: { type: "string" },
          meals: {
            type: "object",
            properties: {
              breakfast: { type: "array", items: { type: "object" } },
              lunch: { type: "array", items: { type: "object" } },
              dinner: { type: "array", items: { type: "object" } },
              snacks: { type: "array", items: { type: "object" } },
            },
          },
        },
        required: ["meals"],
      };
      const example = {
        headline: "Balanced plate",
        meals: {
          breakfast: [{ name: "Oats with milk", kcal: 280, protein: 12, note: "1 bowl" }],
          lunch: [{ name: "Roti + dal + sabzi", kcal: 550, protein: 22, note: "" }],
          dinner: [{ name: "Paneer + salad", kcal: 400, protein: 28, note: "" }],
          snacks: [{ name: "Curd", kcal: 90, protein: 6, note: "1 katori" }],
        },
      };
      return { prompt, schema, example };
    }

    async function suggestDietPlan(targets) {
      const { prompt, schema } = prepareDietPlan(targets);
      return generate({ prompt, schema, useSearch: false });
    }

    async function testKey() {
      const key = getKey();
      if (!key) return { ok: false, message: "Paste a Gemini API key first." };
      const models = preferredModels();
      let lastMsg = "";
      for (const model of models) {
        try {
          const url = `${BASE}/${model}:generateContent?key=${encodeURIComponent(key)}`;
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: 'Reply with JSON {"ok":true}' }] }],
              generationConfig: { responseMimeType: "application/json", temperature: 0 },
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            const msg = data?.error?.message || `Gemini ${res.status}`;
            lastMsg = msg;
            if (isModelUnavailableError(msg, res.status)) continue;
            return { ok: false, message: msg };
          }
          rememberModel(model);
          return { ok: true, message: `Gemini key works (${model}).` };
        } catch (e) {
          lastMsg = e.message || "Could not reach Gemini.";
          if (isModelUnavailableError(lastMsg, e?.status)) continue;
          return { ok: false, message: lastMsg };
        }
      }
      return { ok: false, message: lastMsg || "No Gemini model available for this key." };
    }

    return {
      getKey,
      saveKey,
      hasKey,
      enrichFoods,
      enrichPackagedProduct,
      prepareDietPlan,
      suggestDietPlan,
      coach,
      testKey,
      preferredModels,
      prepareEnrichFoods,
      preparePackagedProduct,
      prepareCoach,
    };
  })();

  /* ───────── Puter.js Grok (browser fallback — User-Pays, no API key) ───────── */
  const PuterGrok = (() => {
    /* Fast non-reasoning is enough for JSON shapes; 4.7 as second try. */
    const MODELS = ["x-ai/grok-4-1-fast-non-reasoning", "x-ai/grok-4.7"];

    function available() {
      return typeof puter !== "undefined" && puter && typeof puter.ai?.chat === "function";
    }

    async function waitUntilReady(ms = 10000) {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) {
        if (available()) return true;
        await new Promise((r) => setTimeout(r, 120));
      }
      return available();
    }

    function formatError(e) {
      if (e == null) return "Puter Grok failed.";
      if (typeof e === "string") return e;
      if (e.error || e.msg) {
        const code = e.error || e.code || "";
        const msg = e.msg || e.message || "";
        return [code, msg].filter(Boolean).join(": ") || "Puter auth/chat failed.";
      }
      return e.message || String(e);
    }

    function isPopupBlocked(e) {
      const code = e?.error || e?.code || "";
      const msg = formatError(e).toLowerCase();
      return code === "popup_blocked" || /popup.?blocked|blocked.*popup/.test(msg);
    }

    async function isSignedIn() {
      try {
        if (!available() || typeof puter.auth?.isSignedIn !== "function") return false;
        return !!(await puter.auth.isSignedIn());
      } catch {
        return false;
      }
    }

    /**
     * Sign-in popup MUST run from a user click (not after await Gemini).
     * Call this first on "Use Puter Grok now"; on auto-fallback it may be popup_blocked.
     * @param {{ timeoutMs?: number }} [opts] — short timeout after Gemini so UI is not stuck.
     */
    async function ensureSignedIn(opts = {}) {
      const timeoutMs = opts.timeoutMs;
      if (!(await waitUntilReady())) {
        throw new Error("Puter.js is not loaded. Check network / ad blockers, then retry.");
      }
      if (await isSignedIn()) return { already: true };
      if (typeof puter.auth?.signIn !== "function") {
        throw new Error("Puter auth.signIn is missing — update Puter.js.");
      }
      try {
        const signInPromise = puter.auth.signIn();
        if (timeoutMs && timeoutMs > 0) {
          await Promise.race([
            signInPromise,
            new Promise((_, reject) => {
              setTimeout(() => {
                const err = new Error(
                  "Puter sign-in did not finish (popup blocked or closed). Tap “Use Puter Grok now”."
                );
                err.popupBlocked = true;
                reject(err);
              }, timeoutMs);
            }),
          ]);
        } else {
          await signInPromise;
        }
        return { already: false };
      } catch (e) {
        const err = new Error(formatError(e));
        err.puter = e;
        err.popupBlocked = !!(e?.popupBlocked || isPopupBlocked(e));
        throw err;
      }
    }

    function extractText(response) {
      if (response == null) return "";
      if (typeof response === "string") return response;
      const content = response?.message?.content;
      if (typeof content === "string") return content;
      if (Array.isArray(content)) {
        return content
          .map((p) => (typeof p === "string" ? p : p?.text || p?.content || ""))
          .join("");
      }
      if (typeof response.text === "string") return response.text;
      if (typeof response?.message === "string") return response.message;
      try {
        return JSON.stringify(response);
      } catch {
        return String(response);
      }
    }

    function parseJson(text) {
      const raw = String(text || "").trim();
      if (!raw) throw new Error("Puter Grok returned an empty answer.");
      const unfenced = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
      try {
        return JSON.parse(unfenced);
      } catch {
        const m = unfenced.match(/\{[\s\S]*\}/);
        if (m) return JSON.parse(m[0]);
        throw new Error("Could not parse Puter Grok JSON.");
      }
    }

    async function chatJson(prompt, example, { skipAuth } = {}) {
      if (!(await waitUntilReady())) {
        throw new Error("Puter.js is not loaded. Check network / ad blockers, then retry.");
      }
      if (!skipAuth) {
        await ensureSignedIn();
      } else if (!(await isSignedIn())) {
        await ensureSignedIn();
      }
      const full = `${prompt}

Return ONLY valid JSON (no markdown fences) matching this example shape:
${JSON.stringify(example, null, 2)}`;
      let lastError;
      for (const model of MODELS) {
        try {
          const response = await puter.ai.chat(full, {
            model,
            temperature: 0.2,
          });
          return parseJson(extractText(response));
        } catch (e) {
          lastError = new Error(formatError(e));
          lastError.puter = e;
          lastError.popupBlocked = isPopupBlocked(e);
          /* Auth issues: don't spin models */
          if (lastError.popupBlocked || /auth|sign.?in|not.?signed/i.test(lastError.message)) break;
        }
      }
      throw lastError || new Error("Puter Grok failed.");
    }

    async function enrichFoods(rawList, opts) {
      const { prompt, example } = Gemini.prepareEnrichFoods(rawList);
      return chatJson(prompt, example, opts);
    }

    async function enrichPackagedProduct(input, opts) {
      const { prompt, example } = Gemini.preparePackagedProduct(input);
      return chatJson(prompt, example, opts);
    }

    async function coach(snapshot, opts) {
      const { prompt, example } = Gemini.prepareCoach(snapshot);
      return chatJson(prompt, example, opts);
    }

    async function suggestDietPlan(targets, opts) {
      const { prompt, example } = Gemini.prepareDietPlan(targets);
      return chatJson(prompt, example, opts);
    }

    return {
      available,
      waitUntilReady,
      ensureSignedIn,
      isSignedIn,
      enrichFoods,
      enrichPackagedProduct,
      suggestDietPlan,
      coach,
      formatError,
      isPopupBlocked,
      MODELS,
    };
  })();

  /* Gemini first (phone key), then Puter Grok — browser paths only */
  const AiBridge = (() => {
    function puterHintAfterGemini(geminiMsg) {
      return (
        `Gemini failed: ${geminiMsg}. Opening Puter / Using Grok… ` +
        `(if no popup appears, tap “Use Puter Grok now” — browsers block popups after waiting.)`
      );
    }

    async function runPuter({ statusEl, puterCall, geminiErr, fromUserGesture }) {
      setStatus(
        statusEl,
        geminiErr
          ? puterHintAfterGemini(geminiErr.message)
          : "Opening Puter / Using Grok… (sign-in popup uses your free Puter allowance)",
        "info"
      );

      /* From a fresh button tap: signIn immediately — do not await delays first (popup needs user gesture). */
      if (fromUserGesture) {
        if (!PuterGrok.available()) {
          setStatus(statusEl, "Waiting for Puter.js to load…", "info");
          const ready = await PuterGrok.waitUntilReady(8000);
          if (!ready) throw new Error("Puter.js did not load (network or blocker).");
          throw new Error(
            "Puter.js just loaded. Tap “Use Puter Grok now” again to open the sign-in popup."
          );
        }
      } else {
        const ready = await PuterGrok.waitUntilReady(8000);
        if (!ready) {
          const base = "Puter.js did not load (network or blocker).";
          if (geminiErr) throw new Error(`Gemini failed (${geminiErr.message}). ${base}`);
          throw new Error(base);
        }
      }

      try {
        /* After Gemini, gesture is gone — don't hang forever on a blocked popup. */
        await PuterGrok.ensureSignedIn(
          fromUserGesture ? {} : { timeoutMs: 8000 }
        );
        setStatus(statusEl, "Using Puter Grok…", "info");
        const result = await puterCall({ skipAuth: true });
        return { result, provider: "puter-grok" };
      } catch (e) {
        const puterMsg = PuterGrok.formatError(e);
        if (PuterGrok.isPopupBlocked(e) || e?.popupBlocked) {
          const tip =
            "Tap “Use Puter Grok now” so Puter can open its sign-in popup from your tap.";
          if (geminiErr) {
            throw new Error(`Gemini failed (${geminiErr.message}). Puter popup blocked. ${tip}`);
          }
          throw new Error(`Puter popup blocked. ${tip}`);
        }
        if (geminiErr) {
          throw new Error(`Gemini failed (${geminiErr.message}). Puter Grok: ${puterMsg}`);
        }
        throw new Error(puterMsg);
      }
    }

    async function withFallback({ statusEl, geminiCall, puterCall }) {
      let geminiErr = null;
      if (Gemini.hasKey()) {
        setStatus(statusEl, "Trying Gemini…", "info");
        try {
          const result = await geminiCall();
          return { result, provider: "gemini" };
        } catch (e) {
          geminiErr = e instanceof Error ? e : new Error(String(e));
          setStatus(statusEl, puterHintAfterGemini(geminiErr.message), "info");
        }
      } else {
        /* No key: still lost gesture if we wait — prefer already-signed-in Puter, else ask for force tap. */
        setStatus(statusEl, "Opening Puter / Using Grok…", "info");
      }
      return runPuter({ statusEl, puterCall, geminiErr, fromUserGesture: false });
    }

    /** Force Puter from a fresh click — call signIn while the tap gesture is still valid. */
    async function puterOnly({ statusEl, puterCall }) {
      return runPuter({ statusEl, puterCall, geminiErr: null, fromUserGesture: true });
    }

    return { withFallback, puterOnly };
  })();

  /* ───────── Gemini key panels (Admin + Insights + Diet — same phone LS) ───────── */
  const GeminiKeyUI = (() => {
    const TESTED = "sapna_gemini_tested";

    function panels() {
      return [...document.querySelectorAll("[data-gemini-panel]")];
    }

    function setBadgeOn(el, kind, label) {
      if (!el) return;
      if (!kind) {
        el.hidden = true;
        el.textContent = "";
        el.className = "key-badge";
        return;
      }
      el.hidden = false;
      el.textContent = label || "";
      el.className = "key-badge is-" + kind;
    }

    function syncPanels({ keepFocus } = {}) {
      const has = Gemini.hasKey();
      const tested = sessionStorage.getItem(TESTED) === "1" || localStorage.getItem(TESTED) === "1";
      panels().forEach((panel) => {
        const input = panel.querySelector("[data-gemini-input]");
        const badge = panel.querySelector("[data-gemini-badge]");
        if (input && document.activeElement !== input) {
          input.value = "";
          input.placeholder = has ? "Key saved — paste to replace" : "AIza… or AQ.…";
        }
        if (has && tested) setBadgeOn(badge, "ok", "✓ Working");
        else if (has) setBadgeOn(badge, "info", "Saved");
        else setBadgeOn(badge, null);
        if (panel.tagName === "DETAILS") {
          if (!has && !keepFocus) panel.open = true;
          else if (has && panel.id === "coach-gemini-panel") panel.open = false;
        }
      });
    }

    function keyLooksPlausible(key) {
      const k = String(key || "").trim();
      if (!k || k.length < 16) {
        return { ok: false, message: "Paste a full Gemini API key from Google AI Studio." };
      }
      /* Known AI Studio formats: classic AIza… and newer AQ.… — API ping is the real check */
      if (/^(AIza|AQ\.)/i.test(k)) return { ok: true };
      if (/^[A-Za-z0-9._\-]{16,}$/.test(k)) {
        return { ok: true, note: "Unusual key prefix — testing with Gemini anyway…" };
      }
      return { ok: false, message: "That doesn’t look like an API key. Paste the value from AI Studio (often starts with AIza or AQ.)." };
    }

    async function saveFrom(panel) {
      const input = panel?.querySelector("[data-gemini-input]");
      const status = panel?.querySelector("[data-gemini-status]");
      const badge = panel?.querySelector("[data-gemini-badge]");
      const btn = panel?.querySelector("[data-gemini-save]");
      let key = (input?.value || "").trim();
      if ((!key || key.startsWith("••")) && Gemini.getKey()) key = Gemini.getKey();
      if (!key) {
        setBadgeOn(badge, "error", "Missing");
        setStatus(status, "Paste a Gemini API key from Google AI Studio.", "error");
        if ($("admin-status") && panel?.id === "admin-gemini-panel") {
          setStatus($("admin-status"), "Paste a Gemini API key from Google AI Studio.", "error");
        }
        return false;
      }
      const shape = keyLooksPlausible(key);
      if (!shape.ok) {
        setBadgeOn(badge, "error", "Check key");
        setStatus(status, shape.message, "error");
        return false;
      }
      Gemini.saveKey(key);
      if (btn) btn.disabled = true;
      setBadgeOn(badge, "info", "Checking…");
      setStatus(status, shape.note || "Testing Gemini with this key…", "info");
      const result = await Gemini.testKey();
      if (btn) btn.disabled = false;
      if (!result.ok) {
        try {
          localStorage.removeItem(TESTED);
          sessionStorage.removeItem(TESTED);
        } catch (_) {}
        setBadgeOn(badge, "error", "Invalid");
        setStatus(status, result.message, "error");
        if ($("admin-status") && panel?.id === "admin-gemini-panel") {
          setStatus($("admin-status"), result.message, "error");
        }
        return false;
      }
      try {
        localStorage.setItem(TESTED, "1");
        sessionStorage.setItem(TESTED, "1");
      } catch (_) {}
      syncPanels();
      setStatus(status, result.message + " Saved on this phone only.", "ok");
      if ($("admin-status")) {
        setStatus($("admin-status"), result.message + " Saved on this phone only.", "ok");
      }
      return true;
    }

    function clearFrom(panel) {
      Gemini.saveKey("");
      try {
        localStorage.removeItem(TESTED);
        sessionStorage.removeItem(TESTED);
      } catch (_) {}
      const status = panel?.querySelector("[data-gemini-status]");
      syncPanels();
      setStatus(status, "Gemini key cleared from this phone.", "info");
      if ($("admin-status") && panel?.id === "admin-gemini-panel") {
        setStatus($("admin-status"), "Gemini key cleared from this phone.", "info");
      }
    }

    function wire() {
      document.addEventListener("click", (e) => {
        const saveBtn = e.target.closest("[data-gemini-save]");
        if (saveBtn) {
          e.preventDefault();
          const panel = saveBtn.closest("[data-gemini-panel]");
          saveFrom(panel);
          return;
        }
        const clearBtn = e.target.closest("[data-gemini-clear]");
        if (clearBtn) {
          e.preventDefault();
          const panel = clearBtn.closest("[data-gemini-panel]");
          clearFrom(panel);
        }
      });
      syncPanels();
    }

    return { wire, syncPanels, saveFrom, clearFrom };
  })();

  /* ───────── Coach UI (Path B — overnight file + on-demand) ───────── */
  const Coach = (() => {
    const INSIGHTS_URL = "./data/insights/latest.json";
    let remote = null;

    function loadCached() {
      try {
        return JSON.parse(localStorage.getItem(LS.coach) || "null");
      } catch {
        return null;
      }
    }
    function saveCached(payload) {
      localStorage.setItem(LS.coach, JSON.stringify(payload));
    }

    function buildSnapshot() {
      const diet = Diet.snapshot ? Diet.snapshot() : {};
      const dietDays = Diet.dietLoggedDates ? Object.keys(Diet.dietLoggedDates()).length : 0;
      const period = Periods.coachSnapshot ? Periods.coachSnapshot() : Periods.snapshot?.() || {};
      const lifts = Weights.coachSummary ? Weights.coachSummary() : Weights.snapshot?.() || {};
      const workout = Workout.snapshot ? Workout.snapshot() : {};
      const streak = {
        note: "Workout streak lives on Today Progress card; coach uses lift day counts below.",
      };
      /* Compact — never send full raw logs */
      const profile = typeof Profile !== "undefined" && Profile.coachSnippet ? Profile.coachSnippet() : null;
      return {
        today: todayISO(),
        diet: {
          targetKcal: diet.targetKcal,
          targetProtein: diet.targetProtein,
          eatenKcal: diet.kcal,
          eatenProtein: diet.protein,
          leftKcal: diet.left,
          mealFill: diet.mealFill,
          loggedDayCount: dietDays,
          todayPlate: Diet.todayPlate ? Diet.todayPlate() : [],
        },
        workoutPlan: {
          title: workout.title,
          liftsLogged: workout.liftsLogged,
          liftsTotal: workout.liftsTotal,
        },
        lifts,
        periods: period,
        streak,
        profile,
      };
    }

    function renderInto(el, data, meta) {
      if (!el) return;
      if (!data) {
        el.innerHTML = `<p class="hint">Updates at 4:00 IST.</p>`;
        return;
      }
      const list = (arr, empty) =>
        (arr || []).length
          ? `<ul class="coach-list">${arr.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>`
          : `<p class="hint">${escapeHtml(empty)}</p>`;
      const ideas = (data.exerciseIdeas || [])
        .map(
          (ex) => `<li><strong>${escapeHtml(ex.name)}</strong>
            <span class="meta">${escapeHtml(ex.when || "")} · ${escapeHtml(ex.why || "")}</span></li>`
        )
        .join("");
      el.innerHTML = `
        <p class="coach-summary">${escapeHtml(data.summary || "")}</p>
        <div class="coach-cols">
          <div><h3>Doing great</h3>${list(data.wins, "—")}</div>
          <div><h3>Watch</h3>${list(data.watch, "—")}</div>
        </div>
        <h3>Period comfort foods</h3>
        ${list(data.periodTips, "Mark cycle days for sharper tips.")}
        <h3>Eat next</h3>
        ${list(data.eatNext, "—")}
        <h3>Exercise ideas <span class="hint-inline">for Admin plan</span></h3>
        <ul class="coach-list coach-ex">${ideas || "<li class='hint'>—</li>"}</ul>
        ${meta ? `<p class="coach-meta">${escapeHtml(meta)}</p>` : ""}`;
    }

    function activePayload() {
      const local = loadCached();
      const remoteAt = remote?.generatedAt ? Date.parse(remote.generatedAt) : 0;
      const localAt = local?.at ? Date.parse(local.at) : 0;
      /* Prefer newer of overnight file vs manual phone refresh */
      if (local && localAt > remoteAt) {
        return {
          result: local.result,
          meta: `Manual refresh ${local.at}${local.source ? " · " + local.source : ""} · overnight still at 4:00 IST`,
          badge: "Manual",
          source: "manual",
        };
      }
      if (remote?.result) {
        const src = remote.source === "placeholder" ? "Setup" : "Overnight · 4:00 IST";
        return {
          result: remote.result,
          meta: remote.forDate
            ? `For ${remote.forDate} (${remote.timezone || "Asia/Kolkata"}) · ${remote.schedule || "4:00 IST"}`
            : remote.generatedAt || "",
          badge: src,
          source: remote.source || "scheduled",
        };
      }
      if (local?.result) {
        return {
          result: local.result,
          meta: local.at ? `Saved ${local.at}` : "",
          badge: "Manual",
          source: "manual",
        };
      }
      return null;
    }

    function paint() {
      const active = activePayload();
      const badge = $("coach-badge");
      if (badge) badge.textContent = active?.badge || "Overnight · 4:00 IST";
      renderInto($("coach-body"), active?.result || null, active?.meta || "");
      renderInto($("admin-coach-body"), active?.result || null, active?.meta || "");
      const adminEx = $("admin-coach-exercises");
      if (adminEx) {
        const ideas = active?.result?.exerciseIdeas || [];
        adminEx.innerHTML = ideas.length
          ? `<ul class="coach-list coach-ex">${ideas
              .map(
                (ex) =>
                  `<li><strong>${escapeHtml(ex.name)}</strong><span class="meta">${escapeHtml(ex.when)} — ${escapeHtml(ex.why)}</span></li>`
              )
              .join("")}</ul>`
          : `<p class="hint">Overnight job or AI coach fills ideas here for her plan.</p>`;
      }
    }

    async function loadOvernight() {
      try {
        const res = await fetch(`${INSIGHTS_URL}?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return null;
        remote = await res.json();
        return remote;
      } catch {
        return null;
      }
    }

    async function run({ statusEl, preferPuter } = {}) {
      if (!isAdminUnlocked()) {
        setStatus(statusEl, "AI coach regenerate is Admin only. Overnight insights still show here.", "error");
        return null;
      }
      const snap = buildSnapshot();
      const puterCall = (opts) => PuterGrok.coach(snap, opts);
      try {
        const { result, provider } = preferPuter
          ? await AiBridge.puterOnly({ statusEl, puterCall })
          : await AiBridge.withFallback({
              statusEl,
              geminiCall: () => Gemini.coach(snap),
              puterCall,
            });
        const payload = {
          at: new Date().toISOString(),
          result,
          source: "manual",
          provider,
        };
        saveCached(payload);
        paint();
        const via =
          provider === "puter-grok"
            ? "Puter Grok"
            : "Gemini";
        setStatus(
          statusEl,
          `Manual insights updated via ${via}. Overnight 4:00 IST stays Gemini-only (Actions secret).`,
          "ok"
        );
        return result;
      } catch (e) {
        setStatus(statusEl, e.message || String(e), "error");
        return null;
      }
    }

    async function wire() {
      $("coach-run")?.addEventListener("click", () => run({ statusEl: $("coach-status") }));
      $("coach-puter-run")?.addEventListener("click", () =>
        run({ statusEl: $("coach-status"), preferPuter: true })
      );
      $("admin-coach-run")?.addEventListener("click", () => run({ statusEl: $("admin-coach-status") }));
      $("admin-coach-puter")?.addEventListener("click", () =>
        run({ statusEl: $("admin-coach-status"), preferPuter: true })
      );
      paint();
      await loadOvernight();
      paint();
    }

    return { wire, paint, run, loadCached, buildSnapshot, loadOvernight };
  })();

  /* ───────── Diet (Healthify-inspired: remaining + meal slots + library) ───────── */
  const Diet = (() => {
    const MEALS = [
      { id: "breakfast", label: "Breakfast" },
      { id: "lunch", label: "Lunch" },
      { id: "dinner", label: "Dinner" },
      { id: "snacks", label: "Snacks" },
    ];

    const emptyDay = () => ({
      date: todayISO(),
      breakfast: [],
      lunch: [],
      dinner: [],
      snacks: [],
      extras: [],
      done: {},
      /** Personal eaten grams overlays — keyed by plan item id or extra id */
      amounts: {},
      /** Tombstones so sync merge never resurrects deleted meal items */
      deletedIds: [],
      /** Manual steps for the day (syncs with diet-checks) */
      steps: null,
    });
    let foods = [];
    let defaults = { targets: { kcal: 1300, protein: 100 } };
    /** @type {null | {planDate?:string,headline?:string,support?:string,targets?:object,meals?:object}} */
    let publishedPlan = null;
    let state = loadJSON(LS.diet, {
      targets: null,
      day: emptyDay(),
      customFoods: [],
      recentFoodIds: [],
      checksByDate: {},
    });
    let pkgPending = null; /* { food, mode, macrosLocked, baseMacros } */
    /** @type {null | { kind:'plan'|'extra', id:string, meal?:string }} */
    let gramsPending = null;

    function normalizeDeletedIds(list) {
      const out = [];
      const seen = new Set();
      (Array.isArray(list) ? list : []).forEach((id) => {
        const key = String(id || "").trim();
        if (!key || seen.has(key)) return;
        seen.add(key);
        out.push(key);
      });
      return out;
    }

    function filterDeadItems(list, deleted) {
      const dead = deleted instanceof Set ? deleted : new Set(normalizeDeletedIds(deleted));
      return (Array.isArray(list) ? list : []).filter((item) => {
        if (!item) return false;
        if (item.id != null && dead.has(String(item.id))) return false;
        return true;
      });
    }

    function ensureDay() {
      const d = todayISO();
      if (!state.day || state.day.date !== d) {
        const saved = state.checksByDate?.[d];
        const deletedIds = normalizeDeletedIds(saved?.deletedIds);
        const dead = new Set(deletedIds);
        const savedSteps = Number(saved?.steps);
        state.day = {
          ...emptyDay(),
          date: d,
          done: { ...(saved?.done || {}) },
          amounts: { ...(saved?.amounts || {}) },
          deletedIds,
          updatedAt: saved?.updatedAt || null,
          extras: filterDeadItems(saved?.extras, dead),
          /* legacy free-form diary slots still count as extras if present */
          breakfast: filterDeadItems(saved?.breakfast, dead),
          lunch: filterDeadItems(saved?.lunch, dead),
          dinner: filterDeadItems(saved?.dinner, dead),
          snacks: filterDeadItems(saved?.snacks, dead),
          steps: Number.isFinite(savedSteps) && savedSteps >= 0 ? Math.round(savedSteps) : null,
        };
        /* Drop amount overlays for tombstoned ids */
        Object.keys(state.day.amounts || {}).forEach((k) => {
          if (dead.has(String(k))) delete state.day.amounts[k];
        });
        persist();
      }
      if (!state.day.done) state.day.done = {};
      if (!state.day.amounts || typeof state.day.amounts !== "object") state.day.amounts = {};
      if (!Array.isArray(state.day.extras)) state.day.extras = [];
      if (!Array.isArray(state.day.deletedIds)) state.day.deletedIds = [];
      if (state.day.steps == null && state.checksByDate?.[state.day.date]?.steps != null) {
        const s = Number(state.checksByDate[state.day.date].steps);
        if (Number.isFinite(s) && s >= 0) state.day.steps = Math.round(s);
      }
    }

    function touchDay(ts) {
      ensureDay();
      state.day.updatedAt = ts || new Date().toISOString();
    }

    function persistChecksSnapshot({ touch } = {}) {
      ensureDay();
      if (touch) touchDay();
      const dead = new Set(normalizeDeletedIds(state.day.deletedIds));
      const amounts = { ...(state.day.amounts || {}) };
      Object.keys(amounts).forEach((k) => {
        if (dead.has(String(k))) delete amounts[k];
      });
      state.checksByDate = state.checksByDate || {};
      const stepsN = Number(state.day.steps);
      state.checksByDate[state.day.date] = {
        done: { ...(state.day.done || {}) },
        amounts,
        deletedIds: normalizeDeletedIds(state.day.deletedIds),
        updatedAt: state.day.updatedAt || null,
        extras: filterDeadItems(state.day.extras, dead),
        breakfast: filterDeadItems(state.day.breakfast, dead),
        lunch: filterDeadItems(state.day.lunch, dead),
        dinner: filterDeadItems(state.day.dinner, dead),
        snacks: filterDeadItems(state.day.snacks, dead),
        steps: Number.isFinite(stepsN) && stepsN >= 0 ? Math.round(stepsN) : null,
      };
    }

    function targets() {
      if (state.targets) return state.targets;
      if (publishedPlan?.targets) return publishedPlan.targets;
      return defaults.targets || { kcal: 1300, protein: 100 };
    }

    function getTodaySteps() {
      ensureDay();
      const n = Number(state.day.steps);
      return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
    }

    function setTodaySteps(raw) {
      ensureDay();
      const n = Number(raw);
      state.day.steps = Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
      persistLocal();
      maybeAutoSyncChecks();
      return getTodaySteps();
    }

    /** Body weight kg from profile when available. */
    function profileWeightKg() {
      try {
        const w = Number(typeof Profile !== "undefined" && Profile.getState ? Profile.getState()?.weightKg : null);
        return Number.isFinite(w) && w > 0 ? w : null;
      } catch (_) {
        return null;
      }
    }

    /**
     * Step burn: ~0.0005 kcal × kg × steps (≈0.04 kcal/step at 80 kg).
     * Falls back to 0.04 kcal/step without weight.
     */
    function estimateStepBurnKcal(stepsOverride) {
      const steps = stepsOverride != null ? Number(stepsOverride) : getTodaySteps();
      if (!Number.isFinite(steps) || steps <= 0) return 0;
      const kg = profileWeightKg();
      const per = kg != null ? kg * 0.0005 : 0.04;
      return Math.round(Math.max(0, Math.min(steps * per, 1500)));
    }

    /** Base diet target + step burn (walking raises daily need). */
    function adjustedTargets() {
      const base = targets();
      const stepBurn = estimateStepBurnKcal();
      return {
        ...base,
        kcal: Math.round(Number(base.kcal) || 0) + stepBurn,
        baseKcal: Math.round(Number(base.kcal) || 0),
        stepBurn,
        steps: getTodaySteps(),
      };
    }

    function persist(opts = {}) {
      persistChecksSnapshot({ touch: !!opts.touch });
      saveJSON(LS.diet, state);
    }

    function persistLocal() {
      persist({ touch: true });
    }

    function dietPlanHasItems(plan) {
      if (!plan || plan.empty === true) return false;
      const meals = plan.meals || {};
      return ["breakfast", "lunch", "dinner", "snacks"].some((k) => Array.isArray(meals[k]) && meals[k].length > 0);
    }

    function normalizePublishedPlan(plan) {
      if (!dietPlanHasItems(plan)) return null;
      return plan;
    }

    function loadPublishedPlan(plan) {
      publishedPlan = normalizePublishedPlan(plan);
      if (plan?.targets && !state.targets) {
        /* Prefer published plan targets until she overrides */
      }
      render();
      if (typeof Progress !== "undefined" && Progress.render) Progress.render();
      if (typeof Today !== "undefined" && Today.render) Today.render();
    }

    function planItems(meal) {
      return (publishedPlan?.meals && publishedPlan.meals[meal]) || [];
    }

    function isDone(itemId) {
      ensureDay();
      return !!(state.day.done && state.day.done[itemId]);
    }

    function toggleDone(itemId) {
      ensureDay();
      state.day.done = state.day.done || {};
      state.day.done[itemId] = !state.day.done[itemId];
      if (state.day.done[itemId]) markDietLogged(state.day.date);
      Haptics.light();
      persistLocal();
      render();
      if (typeof Progress !== "undefined" && Progress.render) Progress.render();
      maybeAutoSyncChecks();
    }

    function allFoods() {
      /* Custom / saved-from-add overrides published foods.json by id */
      const custom = state.customFoods || [];
      const customIds = new Set(custom.map((f) => f.id).filter(Boolean));
      return [...custom, ...foods.filter((f) => !customIds.has(f.id))];
    }

    function findFood(id) {
      return allFoods().find((f) => f.id === id) || null;
    }

    function isPackaged(food) {
      return !!(food && (food.kind === "packaged" || food.servingGrams || food.servingSize));
    }

    function normalizeMeasureUnit(u) {
      const s = String(u || "").toLowerCase().trim();
      if (s === "ml" || s.startsWith("millil")) return "ml";
      return "g";
    }

    /** Parse "250 ml" / "150g" / "1 kg" → { amount, unit } */
    function parseServingAmount(servingSize) {
      const s = String(servingSize || "").trim().toLowerCase();
      if (!s) return null;
      const m = s.match(/(\d+(?:\.\d+)?)\s*(ml|milliliters?|millilitres?|g|grams?|kg)\b/);
      if (!m) return null;
      const n = Number(m[1]);
      if (!Number.isFinite(n) || n <= 0) return null;
      const raw = m[2];
      if (raw.startsWith("kg")) return { amount: n * 1000, unit: "g" };
      if (raw.startsWith("ml") || raw.startsWith("millil")) return { amount: n, unit: "ml" };
      return { amount: n, unit: "g" };
    }

    function parseServingGrams(servingSize) {
      const parsed = parseServingAmount(servingSize);
      return parsed ? parsed.amount : null;
    }

    function foodMeasureUnit(foodOrItem) {
      if (!foodOrItem) return "g";
      if (foodOrItem.servingUnit) return normalizeMeasureUnit(foodOrItem.servingUnit);
      if (foodOrItem.unit) return normalizeMeasureUnit(foodOrItem.unit);
      const fromLabel =
        parseServingAmount(foodOrItem.servingSize) ||
        parseServingAmount(foodOrItem.amountLabel) ||
        parseServingAmount(foodOrItem.name);
      if (fromLabel?.unit) return fromLabel.unit;
      if (foodOrItem.foodId) {
        const linked = findFood(foodOrItem.foodId);
        if (linked && linked !== foodOrItem) return foodMeasureUnit(linked);
      }
      return "g";
    }

    function foodServingAmount(foodOrItem) {
      if (!foodOrItem) return 100;
      const direct =
        Number(foodOrItem.servingAmount) ||
        Number(foodOrItem.servingGrams) ||
        Number(foodOrItem.baseGrams);
      if (Number.isFinite(direct) && direct > 0) return direct;
      const parsed =
        parseServingAmount(foodOrItem.servingSize) ||
        parseServingAmount(foodOrItem.note) ||
        parseServingAmount(foodOrItem.name);
      if (parsed?.amount) return parsed.amount;
      if (foodOrItem.foodId) {
        const linked = findFood(foodOrItem.foodId);
        if (linked && linked !== foodOrItem) {
          const a = foodServingAmount(linked);
          if (a) return a;
        }
      }
      return 100;
    }

    function formatAmountLabel(amount, unit) {
      const a = Number(amount);
      const u = normalizeMeasureUnit(unit);
      if (!Number.isFinite(a)) return "";
      return `${roundn(a, 1)} ${u}`;
    }

    function roundn(n, d = 2) {
      const f = 10 ** d;
      return Math.round(Number(n) * f) / f;
    }

    function displayProductName(brand, product) {
      const b = String(brand || "").trim();
      const p = String(product || "").trim();
      if (b && p) return `${b} — ${p}`;
      return p || b || "Packaged product";
    }

    function productFromParts({
      brand,
      product,
      servingSize,
      kcal,
      protein,
      carbs,
      fiber,
      sugars,
      addedSugars,
      fat,
      saturatedFat,
      transFat,
      cholesterolMg,
      sodiumMg,
      id,
    }) {
      const name = displayProductName(brand, product);
      const parsedServing = parseServingAmount(servingSize);
      const servingGrams = parsedServing?.amount ?? parseServingGrams(servingSize);
      const servingUnit = parsedServing?.unit || "g";
      const energy = Number(kcal);
      if (!name || !Number.isFinite(energy)) {
        throw new Error("Need brand/product and energy_kcal (or kcal).");
      }
      const slug =
        (brand + "-" + product)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 48) || "product";
      return {
        id: id || "pkg-" + slug + "-" + Math.round(energy),
        name,
        brand: String(brand || "").trim(),
        product: String(product || "").trim(),
        servingSize:
          String(servingSize || "").trim() ||
          (servingGrams ? formatAmountLabel(servingGrams, servingUnit) : "1 serving"),
        servingGrams,
        servingUnit,
        kcal: roundn(energy, 2),
        protein: roundn(Number(protein) || 0, 2),
        carbs: Number.isFinite(Number(carbs)) ? roundn(carbs, 2) : null,
        fiber: Number.isFinite(Number(fiber)) ? roundn(fiber, 2) : null,
        sugars: Number.isFinite(Number(sugars)) ? roundn(sugars, 2) : null,
        addedSugars: Number.isFinite(Number(addedSugars)) ? roundn(addedSugars, 2) : null,
        fat: Number.isFinite(Number(fat)) ? roundn(fat, 2) : null,
        saturatedFat: Number.isFinite(Number(saturatedFat)) ? roundn(saturatedFat, 2) : null,
        transFat: Number.isFinite(Number(transFat)) ? roundn(transFat, 2) : null,
        cholesterolMg: Number.isFinite(Number(cholesterolMg)) ? roundn(cholesterolMg, 2) : null,
        sodiumMg: Number.isFinite(Number(sodiumMg)) ? roundn(sodiumMg, 2) : null,
        kind: "packaged",
        tags: ["packaged", "brand", String(brand || "").toLowerCase()].filter(Boolean),
      };
    }

    function productFromJson(raw) {
      let obj = raw;
      if (typeof raw === "string") {
        const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
        obj = JSON.parse(text);
      }
      if (!obj || typeof obj !== "object") throw new Error("JSON must be an object.");
      const nf = obj.nutrition_facts || obj.nutritionFacts || obj.nutrition || {};
      return productFromParts({
        brand: obj.brand,
        product: obj.product || obj.name,
        servingSize: obj.serving_size || obj.servingSize || obj.serving,
        kcal: nf.energy_kcal ?? nf.energyKcal ?? nf.kcal ?? obj.energy_kcal ?? obj.kcal,
        protein: nf.protein_g ?? nf.protein ?? obj.protein_g ?? obj.protein,
        carbs: nf.total_carbohydrates_g ?? nf.carbohydrates_g ?? nf.carbs ?? obj.carbs,
        fiber: nf.dietary_fibre_g ?? nf.dietary_fiber_g ?? nf.fiber_g ?? nf.fiber,
        sugars: nf.total_sugars_g ?? nf.sugars_g ?? nf.sugars,
        addedSugars: nf.added_sugars_g ?? nf.addedSugars,
        fat: nf.total_fat_g ?? nf.fat_g ?? nf.fat,
        saturatedFat: nf.saturated_fat_g ?? nf.saturatedFat,
        transFat: nf.trans_fat_g ?? nf.transFat,
        cholesterolMg: nf.cholesterol_mg ?? nf.cholesterolMg,
        sodiumMg: nf.sodium_mg ?? nf.sodiumMg ?? nf.sodium,
        id: obj.id,
      });
    }

    function scaleFactor(food, mode, amount) {
      const a = Number(amount);
      if (!Number.isFinite(a) || a <= 0) throw new Error("Enter a positive amount.");
      if (mode === "grams" || mode === "amount" || mode === "ml") {
        const base = foodServingAmount(food);
        if (!base) {
          const u = foodMeasureUnit(food);
          throw new Error(`This product has no ${u} serving — use Servings mode.`);
        }
        return a / base;
      }
      return a;
    }

    function scaledMacros(food, factor) {
      const mul = (v) => (v == null || !Number.isFinite(Number(v)) ? null : roundn(Number(v) * factor, 2));
      return {
        kcal: roundn((Number(food.kcal) || 0) * factor, 1),
        protein: roundn((Number(food.protein) || 0) * factor, 2),
        carbs: mul(food.carbs),
        fat: mul(food.fat),
        fiber: mul(food.fiber),
        sugars: mul(food.sugars),
        sodiumMg: mul(food.sodiumMg),
      };
    }

    /** Base serving amount (g or ml) for a plan item. */
    function baseServingGrams(item) {
      return foodServingAmount(item);
    }

    function getAmountOverlay(id) {
      ensureDay();
      const g = Number(state.day.amounts?.[id]);
      return Number.isFinite(g) && g > 0 ? g : null;
    }

    function eatenGramsForPlanItem(item) {
      const overlay = getAmountOverlay(item.id);
      if (overlay != null) return overlay;
      return baseServingGrams(item);
    }

    function planItemFactor(item) {
      const base = baseServingGrams(item);
      if (!base) return 1;
      return eatenGramsForPlanItem(item) / base;
    }

    function scaleIngredients(ingredients, factor) {
      if (!Array.isArray(ingredients) || !ingredients.length) return [];
      return ingredients
        .map((ing) => {
          if (!ing || typeof ing !== "object") return null;
          const name = String(ing.name || "").trim();
          if (!name) return null;
          const g = Number(ing.grams != null ? ing.grams : ing.amount);
          const row = { name };
          if (Number.isFinite(g)) {
            row.grams = roundn(g * factor, 1);
            row.unit = ing.unit || "g";
          } else if (ing.unit) row.unit = String(ing.unit);
          return row;
        })
        .filter(Boolean);
    }

    function scaledPlanItem(item) {
      const factor = planItemFactor(item);
      const macros = scaledMacros(item, factor);
      return {
        ...item,
        factor,
        grams: eatenGramsForPlanItem(item),
        baseGrams: baseServingGrams(item),
        kcal: macros.kcal,
        protein: macros.protein,
        carbs: macros.carbs,
        fat: macros.fat,
        fiber: macros.fiber,
        sugars: macros.sugars,
        ingredients: scaleIngredients(item.ingredients, factor),
      };
    }

    function extraBaseGrams(item) {
      if (!item) return 100;
      const direct = Number(item.servingAmount) || Number(item.servingGrams) || Number(item.baseGrams);
      if (Number.isFinite(direct) && direct > 0) return direct;
      const linked = item.foodId ? findFood(item.foodId) : null;
      if (linked) {
        const a = foodServingAmount(linked);
        if (a) return a;
      }
      /* Legacy packaged extras: amountLabel is eaten amount, servings is factor */
      const eaten = parseServingAmount(item.amountLabel)?.amount || parseServingGrams(item.amountLabel);
      const s = Number(item.servings);
      if (eaten && Number.isFinite(s) && s > 0) return roundn(eaten / s, 1);
      return foodServingAmount(item);
    }

    function eatenGramsForExtra(item) {
      if (!item) return 100;
      const overlay = item.id ? getAmountOverlay(item.id) : null;
      if (overlay != null) return overlay;
      const stored = Number(item.amount != null ? item.amount : item.grams);
      if (Number.isFinite(stored) && stored > 0) return stored;
      const fromLabel = parseServingAmount(item.amountLabel)?.amount || parseServingGrams(item.amountLabel);
      if (fromLabel) return fromLabel;
      /* servings-as-factor × base */
      const base = extraBaseGrams(item);
      const s = Number(item.servings);
      if (Number.isFinite(s) && s > 0 && Math.abs(s - 1) > 0.001) return roundn(base * s, 1);
      return base;
    }

    function scaledExtra(item) {
      const base = extraBaseGrams(item);
      const grams = eatenGramsForExtra(item);
      const factor = base > 0 ? grams / base : Number(item.servings) || 1;
      const unit = foodMeasureUnit(item);
      const macros = scaledMacros(item, factor);
      return {
        ...item,
        factor,
        grams,
        amount: grams,
        unit,
        baseGrams: base,
        kcal: macros.kcal,
        protein: macros.protein,
        carbs: macros.carbs != null ? macros.carbs : item.carbs != null ? roundn(Number(item.carbs) * factor, 2) : null,
        fat: macros.fat != null ? macros.fat : item.fat != null ? roundn(Number(item.fat) * factor, 2) : null,
        fiber: macros.fiber != null ? macros.fiber : item.fiber != null ? roundn(Number(item.fiber) * factor, 2) : null,
        ingredients: scaleIngredients(item.ingredients, factor),
      };
    }

    function setGramsOverlay(id, grams) {
      ensureDay();
      const g = Math.max(1, Math.round(Number(grams)));
      if (!Number.isFinite(g) || !id) return false;
      state.day.amounts = state.day.amounts || {};
      state.day.amounts[id] = g;
      return true;
    }

    function applyExtraGrams(item, grams) {
      if (!item?.id) return;
      const g = Math.max(1, Math.round(Number(grams)));
      if (!Number.isFinite(g)) return;
      setGramsOverlay(item.id, g);
      const base = extraBaseGrams(item);
      const factor = base > 0 ? g / base : 1;
      const unit = foodMeasureUnit(item);
      const patch = {
        grams: g,
        amount: g,
        unit,
        servingGrams: base,
        servingUnit: unit,
        servings: factor,
        amountLabel: formatAmountLabel(g, unit),
      };
      state.day.extras = (state.day.extras || []).map((x) => (x.id === item.id ? { ...x, ...patch } : x));
      MEALS.forEach(({ id: meal }) => {
        state.day[meal] = (state.day[meal] || []).map((x) => (x.id === item.id ? { ...x, ...patch } : x));
      });
    }

    function macroLine(m, note) {
      let line = `${Math.round(m.kcal)} kcal · ${roundn(m.protein, 1)}g P`;
      if (m.carbs != null) line += ` · ${roundn(m.carbs, 1)}g C`;
      if (m.fat != null) line += ` · ${roundn(m.fat, 1)}g F`;
      if (m.fiber != null) line += ` · ${roundn(m.fiber, 1)}g fi`;
      if (note) line += ` · ${note}`;
      return line;
    }

    /** Row meta: calories emphasized; other macros quiet */
    function macroRowHtml(m, note) {
      let rest = `${roundn(m.protein, 1)}g P`;
      if (m.carbs != null) rest += ` · ${roundn(m.carbs, 1)}g C`;
      if (m.fat != null) rest += ` · ${roundn(m.fat, 1)}g F`;
      if (m.fiber != null) rest += ` · ${roundn(m.fiber, 1)}g fi`;
      if (note) rest += ` · ${note}`;
      return `<span class="diet-kcal-hl">${Math.round(m.kcal)} kcal</span>` +
        `<span class="diet-macro-rest"> · ${rest}</span>`;
    }

    function ingredientsHtml(ings) {
      if (!ings?.length) return "";
      const bits = ings
        .map((ing) => {
          if (ing.grams != null) return `${escapeHtml(ing.name)} ${ing.grams}${ing.unit || "g"}`;
          return escapeHtml(ing.name);
        })
        .join(" · ");
      return `<span class="diet-ing-line">${bits}</span>`;
    }

    function savePackagedFood(food) {
      state.customFoods = state.customFoods || [];
      const existing = state.customFoods.findIndex(
        (x) => x.id === food.id || (x.kind === "packaged" && x.name === food.name) || x.name === food.name
      );
      if (existing >= 0) state.customFoods[existing] = { ...state.customFoods[existing], ...food };
      else state.customFoods.push(food);
      /* Keep in-memory published list in sync when same id */
      const fi = foods.findIndex((f) => f.id === food.id);
      if (fi >= 0) foods[fi] = { ...foods[fi], ...food };
      persist();
      return food;
    }

    /** Publish upsert into data/foods.json when PAT is available (merge-safe). */
    async function publishFoodLibraryItem(food, statusEl) {
      savePackagedFood(food);
      const token = getSavedToken();
      if (!token) {
        if (statusEl) setStatus(statusEl, `Saved “${food.name}” on this phone (no sync token).`, "ok");
        return { local: true, published: false };
      }
      try {
        if (statusEl) setStatus(statusEl, "Saving to library…", "info");
        const remote = (await githubGetJson("data/foods.json", token)) || {
          version: 2,
          updatedAt: todayISO(),
          foods: [],
        };
        const list = Array.isArray(remote.foods) ? remote.foods.slice() : [];
        const idx = list.findIndex((f) => f.id === food.id || f.name === food.name);
        const row = { ...food };
        if (idx >= 0) list[idx] = { ...list[idx], ...row };
        else list.push(row);
        remote.foods = list;
        remote.updatedAt = todayISO();
        await githubPutFile(
          "data/foods.json",
          b64EncodeUnicode(JSON.stringify(remote, null, 2) + "\n"),
          `Update food library: ${food.name}`,
          token
        );
        foods = list;
        if (statusEl) setStatus(statusEl, `Saved “${food.name}” to library.`, "ok");
        return { local: true, published: true };
      } catch (e) {
        if (statusEl) setStatus(statusEl, e.message || "Library publish failed — kept on this phone.", "error");
        return { local: true, published: false, error: e };
      }
    }

    function buildEditedEntryFromPkg() {
      if (!pkgPending?.food) throw new Error("Pick a food first.");
      const mode = pkgPending.mode || "grams";
      const amountRaw = $("diet-pkg-amount")?.value;
      const factor = scaleFactor(pkgPending.food, mode, amountRaw);
      const a = Number(amountRaw);
      const unit = foodMeasureUnit(pkgPending.food);
      const baseG = foodServingAmount(pkgPending.food);
      const grams = mode === "grams" || mode === "amount" || mode === "ml" ? a : roundn(baseG * a, 1);
      const macros = readPkgMacroFields();
      if (macros.kcal == null || !Number.isFinite(macros.kcal)) throw new Error("Enter calories.");
      const amountLabel =
        mode === "grams" || mode === "amount" || mode === "ml"
          ? formatAmountLabel(a, unit)
          : `${roundn(a, 2)} serving${a === 1 ? "" : "s"}`;
      const food = {
        ...pkgPending.food,
        kcal: roundn(macros.kcal, 1),
        protein: roundn(macros.protein || 0, 2),
      };
      if (macros.carbs != null) food.carbs = roundn(macros.carbs, 2);
      if (macros.fat != null) food.fat = roundn(macros.fat, 2);
      return { food, meal: $("diet-meal")?.value || "breakfast", factor, grams, unit, amountLabel, macros };
    }

    function libraryFoodFromEdit(edit) {
      const unit = edit.unit || "g";
      const serving = Math.max(1, Math.round(Number(edit.grams) || foodServingAmount(edit.food)));
      return {
        ...edit.food,
        servingGrams: serving,
        servingAmount: serving,
        servingUnit: unit,
        servingSize: formatAmountLabel(serving, unit),
        kcal: edit.macros.kcal,
        protein: edit.macros.protein || 0,
        carbs: edit.macros.carbs,
        fat: edit.macros.fat,
        tags: Array.from(new Set([...(edit.food.tags || []), "library-edit"])),
      };
    }

    async function confirmPkgAdd({ saveToLibrary } = {}) {
      const st = $("diet-status");
      try {
        const edit = buildEditedEntryFromPkg();
        let libraryFood = edit.food;
        if (saveToLibrary) {
          libraryFood = libraryFoodFromEdit(edit);
          await publishFoodLibraryItem(libraryFood, st);
        }
        /* Log uses her edited macros as the baseline for this amount (factor 1) */
        const logFood = {
          ...libraryFood,
          kcal: edit.macros.kcal,
          protein: edit.macros.protein || 0,
          carbs: edit.macros.carbs,
          fat: edit.macros.fat,
          servingGrams: edit.grams,
          servingAmount: edit.grams,
          servingUnit: edit.unit,
        };
        addItem(logFood, edit.meal, 1, {
          amountLabel: edit.amountLabel,
          kind: libraryFood.kind || edit.food.kind,
          grams: edit.grams,
          amount: edit.grams,
          unit: edit.unit,
        });
        Haptics.ok();
        if (!saveToLibrary) {
          setStatus(st, `Added ${edit.food.name} (${edit.amountLabel}) → ${edit.macros.kcal} kcal`, "ok");
        } else {
          setStatus(st, `Saved & added ${edit.food.name} (${edit.amountLabel})`, "ok");
        }
        closePkgSheet();
        if ($("diet-search")) $("diet-search").value = "";
        closeAddSheet();
        renderFoodPick("");
      } catch (e) {
        setStatus(st, e.message || String(e), "error");
      }
    }

    function extrasInMeal(meal) {
      ensureDay();
      const dead = new Set(normalizeDeletedIds(state.day.deletedIds));
      const fromExtras = filterDeadItems(state.day.extras, dead).filter((x) => (x.meal || "snacks") === meal);
      const legacy = filterDeadItems(state.day[meal], dead);
      return [...fromExtras, ...legacy];
    }

    function dietAddDays(iso, n) {
      const d = new Date(String(iso).slice(0, 10) + "T12:00:00");
      d.setDate(d.getDate() + n);
      return d.toISOString().slice(0, 10);
    }

    /** Snapshot of one logged day (tombstone-filtered lists + amount overlays). Read-only — does not persist. */
    function resolveDayRecord(dateISO) {
      const d = String(dateISO || todayISO()).slice(0, 10);
      /* Prefer live today only when amounts haven’t been swapped for export */
      if (state.day && state.day.date === d) {
        const dead = new Set(normalizeDeletedIds(state.day.deletedIds));
        /* Live day is source of truth for today after persistChecksSnapshot */
        return {
          date: d,
          amounts: { ...(state.day.amounts || {}) },
          deletedIds: normalizeDeletedIds(state.day.deletedIds),
          extras: filterDeadItems(state.day.extras, dead),
          breakfast: filterDeadItems(state.day.breakfast, dead),
          lunch: filterDeadItems(state.day.lunch, dead),
          dinner: filterDeadItems(state.day.dinner, dead),
          snacks: filterDeadItems(state.day.snacks, dead),
        };
      }
      const saved = state.checksByDate?.[d];
      if (!saved) {
        return {
          date: d,
          amounts: {},
          deletedIds: [],
          extras: [],
          breakfast: [],
          lunch: [],
          dinner: [],
          snacks: [],
        };
      }
      const dead = new Set(normalizeDeletedIds(saved.deletedIds));
      return {
        date: d,
        amounts: { ...(saved.amounts || {}) },
        deletedIds: normalizeDeletedIds(saved.deletedIds),
        extras: filterDeadItems(saved.extras, dead),
        breakfast: filterDeadItems(saved.breakfast, dead),
        lunch: filterDeadItems(saved.lunch, dead),
        dinner: filterDeadItems(saved.dinner, dead),
        snacks: filterDeadItems(saved.snacks, dead),
      };
    }

    function extrasInMealOnDay(rec, meal) {
      const dead = new Set(normalizeDeletedIds(rec?.deletedIds));
      const fromExtras = filterDeadItems(rec?.extras, dead).filter((x) => (x.meal || "snacks") === meal);
      const legacy = filterDeadItems(rec?.[meal], dead);
      return [...fromExtras, ...legacy];
    }

    function exportRangeDates() {
      const active = document.querySelector("[data-export-range].is-active");
      const mode = active?.getAttribute("data-export-range") || "today";
      const today = todayISO();
      if (mode === "7") {
        const out = [];
        for (let i = 6; i >= 0; i -= 1) out.push(dietAddDays(today, -i));
        return out;
      }
      if (mode === "date") {
        const picked = ($("diet-export-date")?.value || "").slice(0, 10);
        return [/^\d{4}-\d{2}-\d{2}$/.test(picked) ? picked : today];
      }
      return [today];
    }

    /**
     * Scale one extra against a day’s amount overlays without mutating persisted state.
     * Avoids ensureDay/persist while amounts are temporarily swapped.
     */
    function scaledExtraForExport(item, amountsMap) {
      if (!item) return { kcal: 0, protein: 0, grams: 0, amount: 0, unit: "g" };
      const base = extraBaseGrams(item);
      const overlay = Number(amountsMap?.[item.id]);
      let grams;
      if (Number.isFinite(overlay) && overlay > 0) grams = overlay;
      else {
        const stored = Number(item.amount != null ? item.amount : item.grams);
        if (Number.isFinite(stored) && stored > 0) grams = stored;
        else {
          const fromLabel = parseServingAmount(item.amountLabel)?.amount || parseServingGrams(item.amountLabel);
          if (fromLabel) grams = fromLabel;
          else {
            const s = Number(item.servings);
            if (Number.isFinite(s) && s > 0 && Math.abs(s - 1) > 0.001) grams = roundn(base * s, 1);
            else grams = base;
          }
        }
      }
      const factor = base > 0 ? grams / base : Number(item.servings) || 1;
      const unit = foodMeasureUnit(item);
      const macros = scaledMacros(item, factor);
      return {
        ...item,
        factor,
        grams,
        amount: grams,
        unit,
        baseGrams: base,
        kcal: macros.kcal,
        protein: macros.protein,
        carbs: macros.carbs != null ? macros.carbs : item.carbs != null ? roundn(Number(item.carbs) * factor, 2) : null,
        fat: macros.fat != null ? macros.fat : item.fat != null ? roundn(Number(item.fat) * factor, 2) : null,
        fiber: macros.fiber != null ? macros.fiber : item.fiber != null ? roundn(Number(item.fiber) * factor, 2) : null,
      };
    }

    /** Rows match what Diet shows: scaled amounts, tombstones applied. Never writes storage. */
    function collectExportRows(dates) {
      ensureDay();
      persistChecksSnapshot();
      const rows = [];
      /* Snapshot today’s live record once, then read past days from checksByDate only */
      const todayRec =
        state.day?.date === todayISO()
          ? {
              date: state.day.date,
              amounts: { ...(state.day.amounts || {}) },
              deletedIds: normalizeDeletedIds(state.day.deletedIds),
              extras: [...(state.day.extras || [])],
              breakfast: [...(state.day.breakfast || [])],
              lunch: [...(state.day.lunch || [])],
              dinner: [...(state.day.dinner || [])],
              snacks: [...(state.day.snacks || [])],
            }
          : null;
      (dates || []).forEach((date) => {
        const d = String(date || "").slice(0, 10);
        const rec =
          todayRec && todayRec.date === d
            ? todayRec
            : resolveDayRecord(d);
        const amounts = { ...(rec.amounts || {}) };
        MEALS.forEach(({ id, label }) => {
          extrasInMealOnDay(rec, id).forEach((item) => {
            const s = scaledExtraForExport(item, amounts);
            const amount = roundn(s.amount != null ? s.amount : s.grams, 1);
            rows.push({
              date: rec.date,
              meal: label,
              name: String(item.name || "").trim(),
              amount: Number.isFinite(amount) ? amount : "",
              unit: s.unit || "g",
              kcal: roundn(Number(s.kcal) || 0, 1),
              protein: roundn(Number(s.protein) || 0, 2),
              carbs: s.carbs != null && Number.isFinite(Number(s.carbs)) ? roundn(Number(s.carbs), 2) : "",
              fat: s.fat != null && Number.isFinite(Number(s.fat)) ? roundn(Number(s.fat), 2) : "",
              fiber: s.fiber != null && Number.isFinite(Number(s.fiber)) ? roundn(Number(s.fiber), 2) : "",
            });
          });
        });
      });
      return rows;
    }

    function csvEscape(v) {
      const s = String(v ?? "");
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    }

    function rowsToCsv(rows) {
      const header = [
        "date",
        "meal",
        "food",
        "amount",
        "unit",
        "kcal",
        "protein_g",
        "carbs_g",
        "fat_g",
        "fibre_g",
      ];
      const lines = [header.join(",")];
      rows.forEach((r) => {
        lines.push(
          [
            r.date,
            r.meal,
            r.name,
            r.amount,
            r.unit,
            r.kcal,
            r.protein,
            r.carbs,
            r.fat,
            r.fiber,
          ]
            .map(csvEscape)
            .join(",")
        );
      });
      return lines.join("\n") + "\n";
    }

    function rowsToSummary(rows, dates) {
      if (!rows.length) {
        const span = dates?.length === 1 ? dates[0] : `${dates?.[0] || "?"} → ${dates?.[dates.length - 1] || "?"}`;
        return `Sapna diet log (${span}): nothing logged.`;
      }
      const byDate = {};
      rows.forEach((r) => {
        byDate[r.date] = byDate[r.date] || { kcal: 0, protein: 0, n: 0 };
        byDate[r.date].kcal += Number(r.kcal) || 0;
        byDate[r.date].protein += Number(r.protein) || 0;
        byDate[r.date].n += 1;
      });
      const dayLines = Object.keys(byDate)
        .sort()
        .map((d) => {
          const t = byDate[d];
          return `${d}: ${Math.round(t.kcal)} kcal · ${roundn(t.protein, 1)}g P · ${t.n} item${t.n === 1 ? "" : "s"}`;
        });
      const itemLines = rows.map(
        (r) =>
          `${r.date} · ${r.meal} · ${r.name} · ${r.amount}${r.unit} · ${r.kcal} kcal · ${r.protein}g P` +
          (r.carbs !== "" ? ` · ${r.carbs}g C` : "") +
          (r.fat !== "" ? ` · ${r.fat}g F` : "") +
          (r.fiber !== "" ? ` · ${r.fiber}g fi` : "")
      );
      return ["Sapna diet log", ...dayLines, "", ...itemLines].join("\n");
    }

    function downloadCsv(filename, csvText) {
      const blob = new Blob(["\uFEFF" + csvText], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      return blob;
    }

    function exportFilename(dates) {
      if (!dates?.length) return `sapna-diet-${todayISO()}.csv`;
      if (dates.length === 1) return `sapna-diet-${dates[0]}.csv`;
      return `sapna-diet-${dates[0]}_to_${dates[dates.length - 1]}.csv`;
    }

    function setExportRange(mode) {
      document.querySelectorAll("[data-export-range]").forEach((btn) => {
        btn.classList.toggle("is-active", btn.getAttribute("data-export-range") === mode);
      });
      const dateEl = $("diet-export-date");
      if (mode === "today" && dateEl) dateEl.value = todayISO();
      if (mode === "date" && dateEl && !dateEl.value) dateEl.value = todayISO();
    }

    function syncDietExportViewport() {
      const overlay = $("diet-export-overlay");
      if (!overlay || overlay.hidden) return;
      if (window.SapnaKeyboard?.pinOverlayToVv) {
        window.SapnaKeyboard.pinOverlayToVv(overlay);
      } else {
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
    }

    function openExportSheet() {
      const overlay = $("diet-export-overlay");
      if (!overlay) return;
      setExportRange("today");
      const dateEl = $("diet-export-date");
      if (dateEl) dateEl.value = todayISO();
      if ($("diet-export-share")) {
        $("diet-export-share").hidden = !(typeof navigator !== "undefined" && typeof navigator.share === "function");
      }
      const st = $("diet-export-status");
      if (st) {
        st.hidden = true;
        st.textContent = "";
      }
      overlay.hidden = false;
      overlay.classList.add("is-open");
      document.body.classList.add("modal-open");
      syncDietExportViewport();
      try {
        const ae = document.activeElement;
        if (ae && typeof ae.blur === "function" && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA")) ae.blur();
      } catch (_) {}
      setTimeout(() => syncDietExportViewport(), 80);
    }

    function closeExportSheet() {
      const overlay = $("diet-export-overlay");
      if (overlay) {
        overlay.classList.remove("is-open");
        overlay.hidden = true;
        overlay.style.cssText = "";
      }
      /* Only clear modal-open if add sheet isn't also open */
      const addOpen = $("diet-add-overlay") && !$("diet-add-overlay").hidden;
      if (!addOpen) document.body.classList.remove("modal-open");
      try {
        const ae = document.activeElement;
        if (ae && typeof ae.blur === "function" && (ae.id === "diet-export-date")) ae.blur();
      } catch (_) {}
    }

    function runDietExport(kind) {
      const st = $("diet-export-status");
      const dates = exportRangeDates();
      const rows = collectExportRows(dates);
      if (!rows.length) {
        setStatus(st, "Nothing to export for that range.", "info");
        return;
      }
      const csv = rowsToCsv(rows);
      const filename = exportFilename(dates);
      if (kind === "csv") {
        downloadCsv(filename, csv);
        setStatus(st, `Downloaded ${rows.length} row${rows.length === 1 ? "" : "s"}.`, "ok");
        Haptics.ok?.();
        return;
      }
      if (kind === "copy") {
        const text = rowsToSummary(rows, dates);
        const done = () => {
          setStatus(st, "Summary copied.", "ok");
          Haptics.ok?.();
        };
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(text).then(done).catch(() => {
            setStatus(st, "Couldn’t copy — try Download CSV.", "error");
          });
        } else {
          setStatus(st, "Clipboard unavailable — try Download CSV.", "error");
        }
        return;
      }
      if (kind === "share") {
        const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
        const summary = rowsToSummary(rows, dates);
        const tryShare = async () => {
          try {
            if (navigator.canShare) {
              const file = new File([blob], filename, { type: "text/csv" });
              if (navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: "Sapna diet log", text: summary.split("\n").slice(0, 4).join("\n") });
                setStatus(st, "Shared.", "ok");
                return;
              }
            }
            if (navigator.share) {
              await navigator.share({ title: "Sapna diet log", text: summary });
              setStatus(st, "Shared.", "ok");
              return;
            }
          } catch (e) {
            if (e && e.name === "AbortError") {
              setStatus(st, "Share cancelled.", "info");
              return;
            }
          }
          downloadCsv(filename, csv);
          setStatus(st, "Share unavailable — CSV downloaded instead.", "info");
        };
        tryShare();
      }
    }

    /** Full site backup JSON — never includes GitHub token or API keys. */
    function exportAllSiteData() {
      const st = $("diet-export-status");
      try {
        persistChecksSnapshot();
        let profileBasics = null;
        try {
          const p = typeof Profile !== "undefined" && Profile.getState ? Profile.getState() : null;
          if (p) {
            profileBasics = {
              weightKg: p.weightKg ?? null,
              heightCm: p.heightCm ?? null,
              age: p.age ?? null,
              sex: p.sex ?? null,
              goal: p.goal ?? null,
              activity: p.activity ?? null,
              workoutDays: p.workoutDays ?? null,
              workoutType: p.workoutType ?? null,
              dietStyles: p.dietStyles || [],
              mealsPerDay: p.mealsPerDay ?? null,
              paceKgPerWeek: p.paceKgPerWeek ?? null,
              targetWeightKg: p.targetWeightKg ?? null,
              completedAt: p.completedAt ?? null,
            };
          }
        } catch (_) {}
        let weights = null;
        let periods = null;
        let guided = null;
        let coach = null;
        try {
          weights = loadJSON(LS.weights, null);
        } catch (_) {}
        try {
          periods = loadJSON(LS.periods, null);
        } catch (_) {}
        try {
          guided = loadJSON(LS.guided, null);
        } catch (_) {}
        try {
          coach = loadJSON(LS.coach, null);
        } catch (_) {}
        const payload = {
          exportedAt: new Date().toISOString(),
          app: "sapna-health",
          version: typeof window !== "undefined" ? window.SAPNA_APP_V || PROFILE_ASSET_V : PROFILE_ASSET_V,
          diet: {
            targets: state.targets,
            day: state.day,
            checksByDate: state.checksByDate || {},
            customFoods: state.customFoods || [],
            recentFoodIds: state.recentFoodIds || [],
            loggedDates: state.loggedDates || {},
          },
          weights,
          periods,
          profile: profileBasics,
          guidedSession: guided,
          coachLast: coach
            ? {
                at: coach.at || coach.updatedAt || null,
                source: coach.source || null,
                /* omit any accidental key fields */
                summary: coach.summary || coach.text || coach.body || null,
              }
            : null,
          notes: "Tokens and API keys are never exported.",
        };
        const json = JSON.stringify(payload, null, 2);
        const blob = new Blob([json], { type: "application/json;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `sapna-health-backup-${todayISO()}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1500);
        setStatus(st, "Downloaded full site data (no tokens).", "ok");
        Haptics.ok?.();
      } catch (e) {
        setStatus(st, e.message || "Export failed.", "error");
      }
    }

    function totals() {
      ensureDay();
      let kcal = 0;
      let protein = 0;
      /* Sapna self-log only — no admin pre-built plan in totals */
      MEALS.forEach(({ id }) => {
        extrasInMeal(id).forEach((item) => {
          const s = scaledExtra(item);
          kcal += Number(s.kcal) || 0;
          protein += Number(s.protein) || 0;
        });
      });
      return { kcal: Math.round(kcal), protein: Math.round(protein * 10) / 10 };
    }

    function slotKcal(slot) {
      ensureDay();
      let n = 0;
      extrasInMeal(slot).forEach((item) => {
        n += Number(scaledExtra(item).kcal) || 0;
      });
      return Math.round(n);
    }

    function markDietLogged(date) {
      const key = date || todayISO();
      state.loggedDates = state.loggedDates || {};
      state.loggedDates[key] = true;
    }

    function dietLoggedDates() {
      const map = { ...(state.loggedDates || {}) };
      ensureDay();
      const tot = totals();
      if ((tot.kcal || 0) > 0 || (tot.protein || 0) > 0) map[state.day.date || todayISO()] = true;
      return map;
    }

    function pushRecent(foodId) {
      if (!foodId) return;
      const prev = (state.recentFoodIds || []).filter((id) => id !== foodId);
      state.recentFoodIds = [foodId, ...prev].slice(0, 8);
    }

    function addItem(food, meal, servings, extras = {}) {
      ensureDay();
      const s = Number(servings) || 1;
      const kcal = Number(food.kcal);
      if (!Number.isFinite(kcal)) return;
      const unit = normalizeMeasureUnit(extras.unit || food.servingUnit || foodMeasureUnit(food));
      const baseG =
        Number(extras.servingAmount) ||
        Number(food.servingAmount) ||
        Number(food.servingGrams) ||
        parseServingGrams(food.servingSize) ||
        parseServingGrams(food.name) ||
        100;
      const entry = {
        id: "extra-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 5),
        foodId: food.id || "",
        meal: meal || "snacks",
        name: food.name,
        kcal,
        protein: Number(food.protein) || 0,
        servings: s,
        servingGrams: baseG,
        servingUnit: unit,
        unit,
      };
      const eatenAmt =
        extras.amount != null && Number.isFinite(Number(extras.amount))
          ? Number(extras.amount)
          : extras.grams != null && Number.isFinite(Number(extras.grams))
            ? Number(extras.grams)
            : Math.abs(s - 1) > 0.001
              ? roundn(baseG * s, 1)
              : baseG;
      entry.grams = eatenAmt;
      entry.amount = eatenAmt;
      if (food.carbs != null) entry.carbs = Number(food.carbs);
      if (food.fat != null) entry.fat = Number(food.fat);
      if (food.fiber != null) entry.fiber = Number(food.fiber);
      if (food.sugars != null) entry.sugars = Number(food.sugars);
      if (food.sodiumMg != null) entry.sodiumMg = Number(food.sodiumMg);
      if (Array.isArray(food.ingredients)) entry.ingredients = food.ingredients;
      if (extras.amountLabel) entry.amountLabel = extras.amountLabel;
      else entry.amountLabel = formatAmountLabel(entry.amount, unit);
      if (food.kind === "packaged" || extras.kind === "packaged") entry.kind = "packaged";
      state.day.extras = state.day.extras || [];
      state.day.extras.push(entry);
      state.day.amounts = state.day.amounts || {};
      state.day.amounts[entry.id] = entry.amount;
      /* Re-adding a food always uses a new id; still clear any stale tombstone match */
      state.day.deletedIds = normalizeDeletedIds(state.day.deletedIds).filter((id) => id !== entry.id);
      pushRecent(food.id);
      markDietLogged(state.day.date || todayISO());
      persistLocal();
      render();
      if (typeof Progress !== "undefined" && Progress.render) Progress.render();
      maybeAutoSyncChecks();
      return entry;
    }

    function addQuickExtra() {
      const name = ($("diet-quick-name")?.value || "").trim();
      const kcal = Number($("diet-quick-kcal")?.value);
      const protein = Number($("diet-quick-protein")?.value);
      if (!name || !Number.isFinite(kcal)) {
        setStatus($("diet-status"), "Name + kcal needed.", "error");
        return;
      }
      addItem(
        { id: "quick-" + Date.now(), name, kcal, protein: Number.isFinite(protein) ? protein : 0 },
        $("diet-meal")?.value || "snacks",
        1
      );
      if ($("diet-quick-name")) $("diet-quick-name").value = "";
      if ($("diet-quick-kcal")) $("diet-quick-kcal").value = "";
      if ($("diet-quick-protein")) $("diet-quick-protein").value = "";
      Haptics.ok();
      setStatus($("diet-status"), `Added ${name}`, "ok");
      closeAddSheet();
    }

    function tombstoneMealId(extraId) {
      ensureDay();
      const key = String(extraId || "").trim();
      if (!key) return false;
      state.day.deletedIds = normalizeDeletedIds([...(state.day.deletedIds || []), key]);
      state.day.extras = (state.day.extras || []).filter((x) => String(x.id) !== key);
      MEALS.forEach(({ id }) => {
        state.day[id] = (state.day[id] || []).filter((x) => String(x?.id) !== key);
      });
      if (state.day.amounts && state.day.amounts[key] != null) delete state.day.amounts[key];
      if (state.day.done && state.day.done[key] != null) delete state.day.done[key];
      return true;
    }

    function removeExtra(extraId) {
      if (!tombstoneMealId(extraId)) return;
      persistLocal();
      render();
      if (typeof Progress !== "undefined" && Progress.render) Progress.render();
      if (typeof Today !== "undefined" && Today.render) Today.render();
      maybeAutoSyncChecks({ urgent: true });
    }

    function addPackagedAmount(food, meal, mode, amount) {
      const factor = scaleFactor(food, mode, amount);
      const a = Number(amount);
      const unit = foodMeasureUnit(food);
      const baseG = foodServingAmount(food);
      const grams = mode === "grams" || mode === "amount" || mode === "ml" ? a : roundn(baseG * a, 1);
      const amountLabel =
        mode === "grams" || mode === "amount" || mode === "ml"
          ? formatAmountLabel(a, unit)
          : `${roundn(a, 2)} serving${a === 1 ? "" : "s"}`;
      addItem(food, meal, factor, { amountLabel, kind: "packaged", grams, amount: grams, unit });
      return { factor, amountLabel, macros: scaledMacros(food, factor) };
    }

    function removeItem(meal, index) {
      ensureDay();
      const list = extrasInMeal(meal);
      const item = list[index];
      if (!item) return;
      if (item.id) {
        removeExtra(item.id);
        return;
      }
      /* Legacy rows without id — drop from meal slot and sync */
      state.day[meal] = state.day[meal] || [];
      const li = state.day[meal].findIndex((x) => x === item);
      if (li >= 0) state.day[meal].splice(li, 1);
      persistLocal();
      render();
      if (typeof Progress !== "undefined" && Progress.render) Progress.render();
      if (typeof Today !== "undefined" && Today.render) Today.render();
      maybeAutoSyncChecks({ urgent: true });
    }

    function foodHaystack(f) {
      return [f.name, f.brand, f.product, ...(f.tags || [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
    }

    function localMatches(query) {
      const q = String(query || "").toLowerCase().trim();
      let list = allFoods();
      if (!q) return list.slice(0, 48);
      /* Token match so “Cold co” hits “Cold coffee” (not full-string includes only) */
      const tokens = q.split(/\s+/).filter(Boolean);
      list = list.filter((f) => {
        const hay = foodHaystack(f);
        const words = hay.split(/[^a-z0-9]+/).filter(Boolean);
        return tokens.every(
          (t) => hay.includes(t) || words.some((w) => w.startsWith(t))
        );
      });
      list.sort((a, b) => {
        const an = String(a.name || "").toLowerCase();
        const bn = String(b.name || "").toLowerCase();
        const aStarts = an.startsWith(tokens[0]) ? 0 : 1;
        const bStarts = bn.startsWith(tokens[0]) ? 0 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;
        return an.localeCompare(bn);
      });
      return list.slice(0, 48);
    }

    function recentFoods() {
      const ids = state.recentFoodIds || [];
      return ids.map((id) => findFood(id)).filter(Boolean).slice(0, 8);
    }

    function foodButtonHtml(f) {
      const unit = foodMeasureUnit(f);
      const amt = foodServingAmount(f);
      const per = isPackaged(f)
        ? `per ${escapeHtml(f.servingSize || formatAmountLabel(amt, unit) || "serving")}`
        : Number.isFinite(Number(f.servingGrams)) || Number.isFinite(Number(f.servingAmount))
          ? `per ${formatAmountLabel(amt, unit)}`
          : "";
      return `<button type="button" class="hf-food-btn${isPackaged(f) ? " is-packaged" : ""}" data-food-id="${escapeHtml(f.id)}" role="option">
        <span class="hf-food-name">${escapeHtml(f.name)}</span>
        <em><span class="diet-kcal-hl">${f.kcal} kcal</span> · ${f.protein}g P${per ? ` · ${per}` : ""}</em>
      </button>`;
    }

    function setSearchDropdownOpen(open) {
      const root = $("diet-food-pick");
      const input = $("diet-search");
      if (!root) return;
      root.hidden = !open;
      root.classList.toggle("is-open", !!open);
      if (input) input.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) syncDietAddDropdownHeight();
    }

    /** Fit sheet + autocomplete into visual viewport (above mobile keyboard). */
    function syncDietAddViewport() {
      const overlay = $("diet-add-overlay");
      if (!overlay || overlay.hidden) return;
      if (window.SapnaKeyboard?.pinOverlayToVv) {
        window.SapnaKeyboard.pinOverlayToVv(overlay);
      } else {
        const vv = window.visualViewport;
        if (!vv) {
          overlay.style.cssText = "";
          syncDietAddDropdownHeight();
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
      syncDietAddDropdownHeight();
    }

    function syncDietAddDropdownHeight() {
      const root = $("diet-food-pick");
      const wrap = root?.closest(".diet-add-search-wrap");
      const sheet = $("diet-add-overlay")?.querySelector(".diet-add-sheet");
      if (!root || !wrap || !sheet || root.hidden) return;
      const sheetRect = sheet.getBoundingClientRect();
      const wrapRect = wrap.getBoundingClientRect();
      const pad = 12;
      const available = Math.max(96, sheetRect.bottom - wrapRect.bottom - pad);
      const cap = Math.min(available, Math.round(window.innerHeight * 0.42), 260);
      root.style.maxHeight = cap + "px";
    }

    function renderFoodPick(query) {
      const root = $("diet-food-pick");
      if (!root) return;
      const q = String(query || "").trim();
      /* Empty query → hide dropdown (classic autocomplete) */
      if (!q) {
        root.innerHTML = "";
        setSearchDropdownOpen(false);
        return;
      }
      const local = localMatches(q);
      if (!local.length) {
        root.innerHTML = `<p class="food-pick-empty diet-add-dd-empty">No matches</p>`;
        setSearchDropdownOpen(true);
        root.scrollTop = 0;
        return;
      }
      root.innerHTML = local.map(foodButtonHtml).join("");
      setSearchDropdownOpen(true);
      root.scrollTop = 0;
    }

    function openAddSheet(meal) {
      const sel = $("diet-meal");
      if (sel) sel.value = meal || sel.value || "breakfast";
      const overlay = $("diet-add-overlay");
      if (!overlay) return;
      overlay.hidden = false;
      overlay.classList.add("is-open");
      document.body.classList.add("modal-open");
      const hint = $("diet-add-meal-hint");
      if (hint) {
        const label = MEALS.find((m) => m.id === (sel?.value || meal))?.label || meal || "Meal";
        hint.textContent = label;
      }
      if ($("diet-search")) $("diet-search").value = "";
      if ($("diet-servings-wrap")) $("diet-servings-wrap").hidden = true;
      closePkgSheet();
      renderFoodPick("");
      syncDietAddViewport();
      /* No autofocus — keyboard only when Sapna taps search (keeps placeholders intentional). */
      try {
        const ae = document.activeElement;
        if (ae && typeof ae.blur === "function" && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA")) ae.blur();
      } catch (_) {}
      setTimeout(() => syncDietAddViewport(), 80);
    }

    function closeAddSheet() {
      const overlay = $("diet-add-overlay");
      if (overlay) {
        overlay.classList.remove("is-open");
        overlay.hidden = true;
        overlay.style.cssText = "";
      }
      document.body.classList.remove("modal-open");
      setSearchDropdownOpen(false);
      const dd = $("diet-food-pick");
      if (dd) dd.style.maxHeight = "";
      try {
        $("diet-search")?.blur();
      } catch (_) {}
    }

    function focusAddForMeal(meal) {
      openAddSheet(meal);
    }

    function render() {
      ensureDay();
      const baseT = targets();
      const t = adjustedTargets();
      const tot = totals();
      const left = Math.max(0, Math.round(t.kcal - tot.kcal));
      const over = tot.kcal > t.kcal;
      const kcalEl = $("diet-target-kcal");
      const proEl = $("diet-target-protein");
      if (kcalEl && document.activeElement !== kcalEl) kcalEl.value = baseT.kcal;
      if (proEl && document.activeElement !== proEl) proEl.value = baseT.protein;

      if ($("diet-plan-headline")) {
        $("diet-plan-headline").textContent = "Today’s plate";
      }
      if ($("diet-plan-support")) {
        $("diet-plan-support").textContent = "Add breakfast · lunch · dinner · snacks";
        $("diet-plan-support").hidden = false;
      }
      const planSt = $("diet-plan-status");
      if (planSt) {
        const anyLogged = MEALS.some(({ id }) => extrasInMeal(id).length > 0);
        planSt.hidden = anyLogged;
        planSt.textContent = anyLogged
          ? ""
          : "Tap + Add on a meal · pick from the library · edit amount + macros · Save & add if you want it in the library.";
      }

      const totalsRoot = $("diet-totals");
      if (totalsRoot) {
        const kcalPct = Math.max(0, Math.min(100, Math.round((tot.kcal / (t.kcal || 1)) * 100)));
        const proPct = Math.max(0, Math.min(100, Math.round((tot.protein / (t.protein || 1)) * 100)));
        const stepNote =
          t.stepBurn > 0
            ? `<span>need <b>${t.kcal}</b> <em>(${t.baseKcal}+${t.stepBurn} walk)</em></span>`
            : `<span>your log</span>`;
        totalsRoot.innerHTML = `
          <div class="hf-remain-card ${over ? "is-over" : ""}">
            <p class="hf-remain-kicker">${over ? "Over target" : "Diet taken"}</p>
            <p class="hf-remain-num"><strong>${tot.kcal}</strong>
              <span>/ ${t.kcal} kcal</span></p>
            <div class="hf-remain-meta">
              <span><b>${over ? "+" + (tot.kcal - t.kcal) : left}</b> ${over ? "over" : "left"}</span>
              <span><b>${tot.protein}g</b> / ${t.protein}g protein</span>
              ${stepNote}
            </div>
            <div class="hf-remain-bars" aria-hidden="true">
              <div class="hf-bar"><i style="width:${kcalPct}%"></i></div>
              <div class="hf-bar hf-bar-pro"><i style="width:${proPct}%"></i></div>
            </div>
          </div>`;
      }
      paintStepsInputs();

      const mealsRoot = $("diet-meals");
      if (mealsRoot) {
        mealsRoot.innerHTML = MEALS.map(({ id, label }) => {
          const items = extrasInMeal(id);
          const sk = slotKcal(id);
          const rows = items.length
            ? items
                .map((item, i) => {
                  const s = scaledExtra(item);
                  const gid = item.id || `legacy-${id}-${i}`;
                  return `<li class="diet-extra-row diet-log-row">
                <div class="diet-extra-main">
                  <div><strong>${escapeHtml(item.name)}</strong></div>
                  <div class="meta diet-macro-meta">${macroRowHtml(s)}</div>
                  ${ingredientsHtml(s.ingredients)}
                </div>
                <button type="button" class="diet-grams-chip" data-edit-grams="${escapeHtml(gid)}" data-grams-kind="extra" data-extra-meal="${id}" data-extra-idx="${i}" aria-label="Edit amount">
                  ${roundn(s.amount != null ? s.amount : s.grams, 0)}&nbsp;${escapeHtml(s.unit || "g")}
                </button>
                <button type="button" class="diet-remove-btn" data-remove="${id}:${i}" aria-label="Remove">✕</button>
              </li>`;
                })
                .join("")
            : `<li class="hf-meal-empty">Nothing yet — tap + Add</li>`;
          return `<section class="hf-meal-card meal-slot" data-meal-slot="${id}">
            <header class="hf-meal-head">
              <div>
                <h3>${label}</h3>
                <p class="hf-meal-kcal">${sk} kcal · ${items.length} item${items.length === 1 ? "" : "s"}</p>
              </div>
              <button type="button" class="hf-add-btn" data-add-meal="${id}">+ Add</button>
            </header>
            <ul class="food-list diet-extra-list">${rows}</ul>
          </section>`;
        }).join("");
      }

      const hint = $("diet-add-meal-hint");
      if (hint) {
        const label = MEALS.find((m) => m.id === ($("diet-meal")?.value || "breakfast"))?.label || "meal";
        hint.textContent = `Add · ${label}`;
      }
      renderFoodPick($("diet-search")?.value || "");
      if (typeof Today !== "undefined" && Today.render && document.body.dataset.section === "today") {
        Today.render();
      }
    }

    let aiProductDraft = null;

    function readPkgMacroFields() {
      const num = (id) => {
        const raw = String($(id)?.value ?? "").trim();
        if (raw === "") return null;
        const v = Number(raw);
        return Number.isFinite(v) ? v : null;
      };
      return {
        kcal: num("diet-pkg-kcal"),
        protein: num("diet-pkg-protein"),
        carbs: num("diet-pkg-carbs"),
        fat: num("diet-pkg-fat"),
      };
    }

    function writePkgMacroFields(m) {
      if ($("diet-pkg-kcal") && m.kcal != null) $("diet-pkg-kcal").value = String(roundn(m.kcal, 1));
      if ($("diet-pkg-protein") && m.protein != null) $("diet-pkg-protein").value = String(roundn(m.protein, 2));
      if ($("diet-pkg-carbs")) $("diet-pkg-carbs").value = m.carbs != null ? String(roundn(m.carbs, 2)) : "";
      if ($("diet-pkg-fat")) $("diet-pkg-fat").value = m.fat != null ? String(roundn(m.fat, 2)) : "";
    }

    function updatePkgPreview() {
      if (!pkgPending?.food) return;
      const mode = pkgPending.mode || "grams";
      const amount = $("diet-pkg-amount")?.value;
      const el = $("diet-pkg-preview");
      try {
        const factor = scaleFactor(pkgPending.food, mode, amount);
        if (!pkgPending.macrosLocked) {
          writePkgMacroFields(scaledMacros(pkgPending.food, factor));
        }
        const cur = readPkgMacroFields();
        if (el) {
          const note = pkgPending.macrosLocked ? " · custom macros" : " · scaled";
          el.textContent =
            `→ ${cur.kcal != null ? cur.kcal : "—"} kcal · ${cur.protein != null ? cur.protein : "—"}g P` +
            (cur.carbs != null ? ` · ${cur.carbs}g C` : "") +
            (cur.fat != null ? ` · ${cur.fat}g F` : "") +
            note;
        }
      } catch (e) {
        if (el) el.textContent = e.message || "Enter amount";
      }
    }

    function openPkgSheet(food) {
      const unit = foodMeasureUnit(food);
      const baseAmt = foodServingAmount(food);
      const hasG = !!(food.servingGrams || food.servingAmount || parseServingGrams(food.servingSize) || baseAmt);
      pkgPending = {
        food,
        mode: hasG ? "grams" : "servings",
        macrosLocked: false,
      };
      const sheet = $("diet-pkg-sheet");
      if (sheet) sheet.hidden = false;
      if ($("diet-pkg-name")) $("diet-pkg-name").textContent = food.name;
      if ($("diet-pkg-base")) {
        $("diet-pkg-base").textContent =
          `Library: ${food.servingSize || formatAmountLabel(baseAmt, unit) || "1 serving"} = ${food.kcal} kcal · ${food.protein}g protein` +
          (food.carbs != null ? ` · ${food.carbs}g carbs` : "") +
          (food.fat != null ? ` · ${food.fat}g fat` : "");
      }
      $("diet-pkg-mode-g")?.classList.toggle("is-active", pkgPending.mode === "grams");
      $("diet-pkg-mode-s")?.classList.toggle("is-active", pkgPending.mode === "servings");
      if ($("diet-pkg-mode-g")) {
        $("diet-pkg-mode-g").disabled = !hasG;
        $("diet-pkg-mode-g").textContent = unit === "ml" ? "ml" : "Grams";
      }
      if ($("diet-pkg-amount")) {
        /* Default to library serving so she can bump 50→100 easily */
        $("diet-pkg-amount").value =
          pkgPending.mode === "grams" ? String(Math.round(baseAmt || (unit === "ml" ? 250 : 100))) : "1";
        $("diet-pkg-amount").step = pkgPending.mode === "grams" ? "1" : "0.25";
      }
      if ($("diet-pkg-amount-label")) {
        $("diet-pkg-amount-label").textContent =
          pkgPending.mode === "grams" ? `Amount (${unit})` : "Servings";
      }
      if ($("diet-servings-wrap")) $("diet-servings-wrap").hidden = true;
      writePkgMacroFields({
        kcal: food.kcal,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
      });
      updatePkgPreview();
      /* Don’t autofocus amount — keyboard only on user tap */
      try {
        const ae = document.activeElement;
        if (ae && typeof ae.blur === "function" && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA")) ae.blur();
      } catch (_) {}
      sheet?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    function closePkgSheet() {
      pkgPending = null;
      const sheet = $("diet-pkg-sheet");
      if (sheet) sheet.hidden = true;
      /* Servings field stays hidden — grams/amount sheets handle quantity */
      if ($("diet-servings-wrap")) $("diet-servings-wrap").hidden = true;
    }

    function findPlanItemById(id) {
      for (const { id: meal } of MEALS) {
        const hit = planItems(meal).find((it) => it.id === id);
        if (hit) return hit;
      }
      return null;
    }

    function findExtraByEditId(editId, meal, idx) {
      if (meal != null && Number.isFinite(Number(idx))) {
        const list = extrasInMeal(meal);
        const item = list[Number(idx)];
        if (item) return item;
      }
      ensureDay();
      const fromExtras = (state.day.extras || []).find((x) => x.id === editId);
      if (fromExtras) return fromExtras;
      for (const { id: m } of MEALS) {
        const hit = (state.day[m] || []).find((x) => x.id === editId);
        if (hit) return hit;
      }
      return null;
    }

    function updateGramsPreview() {
      if (!gramsPending) return;
      const raw = Number($("diet-grams-input")?.value);
      const el = $("diet-grams-preview");
      if (!el) return;
      if (!Number.isFinite(raw) || raw <= 0) {
        el.textContent = "";
        return;
      }
      try {
        if (gramsPending.kind === "plan") {
          const item = findPlanItemById(gramsPending.id);
          if (!item) {
            el.textContent = "";
            return;
          }
          const factor = raw / baseServingGrams(item);
          const m = scaledMacros(item, factor);
          const ings = scaleIngredients(item.ingredients, factor);
          el.textContent =
            macroLine(m) +
            (ings.length
              ? " · " + ings.map((i) => (i.grams != null ? `${i.name} ${i.grams}g` : i.name)).join(", ")
              : "");
        } else {
          const item = findExtraByEditId(gramsPending.id, gramsPending.meal, gramsPending.idx);
          if (!item) {
            el.textContent = "";
            return;
          }
          const base = extraBaseGrams(item);
          const factor = base > 0 ? raw / base : 1;
          const m = scaledMacros(item, factor);
          el.textContent = macroLine(m);
        }
      } catch (_) {
        el.textContent = "";
      }
    }

    function openGramsSheet({ kind, id, meal, idx }) {
      ensureDay();
      gramsPending = { kind, id, meal, idx };
      let name = "Food";
      let grams = 100;
      let unit = "g";
      let itemRef = null;
      if (kind === "plan") {
        const item = findPlanItemById(id);
        if (!item) return;
        itemRef = item;
        name = item.name;
        grams = eatenGramsForPlanItem(item);
        unit = foodMeasureUnit(item);
      } else {
        const item = findExtraByEditId(id, meal, idx);
        if (!item) return;
        itemRef = item;
        name = item.name;
        grams = eatenGramsForExtra(item);
        unit = foodMeasureUnit(item);
      }
      gramsPending.unit = unit;
      const sheet = $("diet-grams-sheet");
      if (sheet) sheet.hidden = false;
      if ($("diet-grams-name")) $("diet-grams-name").textContent = name;
      if ($("diet-grams-input")) {
        $("diet-grams-input").value = String(Math.round(grams));
        $("diet-grams-input").setAttribute("aria-label", `Amount (${unit})`);
      }
      const stepper = sheet?.querySelector(".diet-grams-stepper");
      if (stepper) stepper.setAttribute("aria-label", unit === "ml" ? "Millilitres" : "Grams");
      const unitHint = $("diet-grams-unit-hint");
      if (unitHint) unitHint.textContent = unit;
      updateGramsPreview();
      try {
        const ae = document.activeElement;
        if (ae && typeof ae.blur === "function" && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA")) ae.blur();
      } catch (_) {}
      sheet?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    function closeGramsSheet() {
      gramsPending = null;
      const sheet = $("diet-grams-sheet");
      if (sheet) sheet.hidden = true;
    }

    function commitGramsSheet() {
      if (!gramsPending) return;
      const raw = Number($("diet-grams-input")?.value);
      if (!Number.isFinite(raw) || raw <= 0) return;
      const g = Math.max(1, Math.round(raw));
      if (gramsPending.kind === "plan") {
        setGramsOverlay(gramsPending.id, g);
      } else {
        const item = findExtraByEditId(gramsPending.id, gramsPending.meal, gramsPending.idx);
        if (item?.id) applyExtraGrams(item, g);
        else setGramsOverlay(gramsPending.id, g);
      }
      Haptics.light();
      persistLocal();
      closeGramsSheet();
      render();
      if (typeof Progress !== "undefined" && Progress.render) Progress.render();
      if (typeof Today !== "undefined" && Today.render) Today.render();
      maybeAutoSyncChecks();
    }

    function nudgeGrams(delta) {
      const input = $("diet-grams-input");
      if (!input) return;
      const cur = Number(input.value) || 0;
      input.value = String(Math.max(1, Math.round(cur + delta)));
      updateGramsPreview();
    }

    function wireGramsSheet() {
      $("diet-grams-done")?.addEventListener("click", () => commitGramsSheet());
      $("diet-grams-cancel")?.addEventListener("click", () => closeGramsSheet());
      $("diet-grams-input")?.addEventListener("input", () => updateGramsPreview());
      $("diet-grams-sheet")?.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-grams-delta]");
        if (!btn) return;
        nudgeGrams(Number(btn.getAttribute("data-grams-delta")) || 0);
      });
    }

    function productPreviewMeta(food) {
      const unit = foodMeasureUnit(food);
      return (
        `Per ${food.servingSize || formatAmountLabel(foodServingAmount(food), unit)}: ${food.kcal} kcal · ${food.protein}g P` +
        (food.carbs != null ? ` · ${food.carbs}g carbs` : "") +
        (food.fat != null ? ` · ${food.fat}g fat` : "") +
        (food.sodiumMg != null ? ` · ${food.sodiumMg}mg sodium` : "") +
        ` · ${unit}`
      );
    }

    function showAiProductPreview(food, rawJson) {
      aiProductDraft = food;
      const box = $("diet-pkg-ai-preview");
      if (box) box.hidden = false;
      if ($("diet-pkg-ai-title")) $("diet-pkg-ai-title").textContent = food.name;
      if ($("diet-pkg-ai-meta")) $("diet-pkg-ai-meta").textContent = productPreviewMeta(food);
      if ($("diet-pkg-ai-json")) {
        $("diet-pkg-ai-json").textContent = JSON.stringify(
          rawJson || {
            brand: food.brand,
            product: food.product,
            serving_size: food.servingSize,
            nutrition_facts: {
              energy_kcal: food.kcal,
              protein_g: food.protein,
              total_carbohydrates_g: food.carbs,
              dietary_fibre_g: food.fiber,
              total_sugars_g: food.sugars,
              added_sugars_g: food.addedSugars,
              total_fat_g: food.fat,
              saturated_fat_g: food.saturatedFat,
              trans_fat_g: food.transFat,
              cholesterol_mg: food.cholesterolMg,
              sodium_mg: food.sodiumMg,
            },
          },
          null,
          2
        );
      }
      /* Diet-tab companion: open quiet preview sheet (keeps card tiny) */
      openDietTilePreview(food);
    }

    function openDietTilePreview(food) {
      if ($("diet-tile-pkg-preview-title")) $("diet-tile-pkg-preview-title").textContent = food.name;
      if ($("diet-tile-pkg-preview-meta")) $("diet-tile-pkg-preview-meta").textContent = productPreviewMeta(food);
      const ov = $("diet-tile-preview-overlay");
      if (!ov) return;
      ov.hidden = false;
      ov.classList.add("is-open");
      document.body.classList.add("modal-open");
      setDietTilePuterRetry(false);
    }

    function closeDietTilePreview() {
      const ov = $("diet-tile-preview-overlay");
      if (ov) {
        ov.classList.remove("is-open");
        ov.hidden = true;
      }
      const addOpen = $("diet-add-overlay") && !$("diet-add-overlay").hidden;
      const exportOpen = $("diet-export-overlay") && !$("diet-export-overlay").hidden;
      if (!addOpen && !exportOpen) document.body.classList.remove("modal-open");
    }

    function setDietTilePuterRetry(show) {
      const btn = $("diet-tile-pkg-puter");
      if (!btn) return;
      btn.hidden = !show;
    }

    function hideAiProductPreview() {
      aiProductDraft = null;
      const box = $("diet-pkg-ai-preview");
      if (box) box.hidden = true;
      closeDietTilePreview();
      setDietTilePuterRetry(false);
    }

    function readProductForm() {
      return {
        brand: $("diet-pkg-brand")?.value || "",
        product: $("diet-pkg-product")?.value || "",
        servingHint: $("diet-pkg-serving")?.value || "",
        notes: $("diet-pkg-notes")?.value || "",
      };
    }

    /** Diet-tab tile: one paste area — JSON or free-text label. */
    function readDietTileProductInput() {
      const raw = String($("diet-tile-pkg-json")?.value || "").trim();
      let brand = "";
      let product = "";
      let servingHint = "";
      let notes = "";
      let parsedJson = null;
      if (raw) {
        try {
          const obj = JSON.parse(raw);
          if (obj && typeof obj === "object") {
            parsedJson = obj;
            brand = String(obj.brand || "").trim();
            product = String(obj.product || obj.name || "").trim();
            servingHint = String(obj.serving_size || obj.servingSize || obj.serving || "").trim();
          }
        } catch (_) {
          const lines = raw.split(/\n+/).map((s) => s.trim()).filter(Boolean);
          if (lines[0]) {
            const m = lines[0].match(/^(.+?)\s*[—\-:|]\s*(.+)$/);
            if (m) {
              brand = m[1].trim();
              product = m[2].trim();
              notes = lines.slice(1).join(" ").trim();
            } else {
              product = lines[0];
              notes = lines.slice(1).join(" ").trim() || raw;
            }
          }
        }
      }
      return { brand, product, servingHint, notes, parsedJson, raw };
    }

    function needsPuterGesture(err) {
      const msg = String(err?.message || err || "");
      return /popup blocked|Use Puter|Tap “Use Puter|just loaded/i.test(msg);
    }

    async function fillProductWithAi({ preferPuter, fromTile } = {}) {
      const st = fromTile ? $("diet-tile-pkg-status") : $("diet-pkg-status");
      if (!isAdminUnlocked()) {
        setStatus(st, "AI product fill is Admin only.", "error");
        return;
      }
      if (fromTile) setDietTilePuterRetry(false);
      const tile = fromTile ? readDietTileProductInput() : null;
      /* Full nutrition JSON → preview sheet, no AI */
      if (fromTile && tile?.parsedJson && (tile.parsedJson.nutrition_facts || tile.parsedJson.kcal != null)) {
        try {
          const food = productFromJson(tile.parsedJson);
          showAiProductPreview(food, tile.parsedJson);
          setStatus(st, "Ready — Save to library.", "ok");
          return;
        } catch (e) {
          /* fall through to AI with brand/product from paste */
        }
      }
      const input = fromTile
        ? {
            brand: tile.brand,
            product: tile.product,
            servingHint: tile.servingHint,
            notes: tile.notes || (tile.raw && !tile.parsedJson ? tile.raw : ""),
          }
        : readProductForm();
      try {
        Gemini.preparePackagedProduct(input);
      } catch (e) {
        setStatus(st, e.message || String(e), "error");
        return;
      }
      if (!fromTile) hideAiProductPreview();
      else closeDietTilePreview();
      const puterCall = (opts) => PuterGrok.enrichPackagedProduct(input, opts);
      try {
        const { result, provider } = preferPuter
          ? await AiBridge.puterOnly({ statusEl: st, puterCall })
          : await AiBridge.withFallback({
              statusEl: st,
              geminiCall: () => Gemini.enrichPackagedProduct(input),
              puterCall,
            });
        const food = productFromJson({
          brand: result.brand || input.brand,
          product: result.product || input.product,
          serving_size: result.serving_size || input.servingHint || "100g",
          nutrition_facts: result.nutrition_facts || result,
        });
        food.source = provider === "puter-grok" ? "puter-grok" : "gemini";
        showAiProductPreview(food, result);
        setStatus(st, "Ready — Save to library.", "ok");
        if (fromTile) setDietTilePuterRetry(false);
      } catch (e) {
        setStatus(st, e.message || String(e), "error");
        if (fromTile && needsPuterGesture(e)) setDietTilePuterRetry(true);
      }
    }

    async function saveAiProductDraft(statusEl) {
      const st = statusEl || $("diet-pkg-status");
      if (!isAdminUnlocked()) {
        setStatus(st, "Admin only.", "error");
        return;
      }
      if (!aiProductDraft) {
        setStatus(st, "Fill with AI or Parse JSON first.", "error");
        return;
      }
      await publishFoodLibraryItem(aiProductDraft, st);
      if ($("diet-search")) $("diet-search").value = aiProductDraft.brand || aiProductDraft.product || "";
      renderFoodPick($("diet-search")?.value || "");
      hideAiProductPreview();
      Haptics.ok?.();
    }

    function wireDietTileProductUi() {
      /* One primary: JSON → preview, else Gemini→Puter smart path */
      $("diet-tile-pkg-go")?.addEventListener("click", () => fillProductWithAi({ fromTile: true }));
      /* Shown only when popup/gesture is required */
      $("diet-tile-pkg-puter")?.addEventListener("click", () =>
        fillProductWithAi({ preferPuter: true, fromTile: true })
      );
      $("diet-tile-pkg-save")?.addEventListener("click", () => saveAiProductDraft($("diet-tile-pkg-status")));
      $("diet-tile-pkg-discard")?.addEventListener("click", () => {
        hideAiProductPreview();
        setStatus($("diet-tile-pkg-status"), "", "info");
      });
      $("diet-tile-preview-overlay")?.addEventListener("click", (e) => {
        if (e.target === $("diet-tile-preview-overlay")) {
          hideAiProductPreview();
        }
      });
    }

    function wirePackagedProductUi() {
      $("diet-pkg-ai")?.addEventListener("click", () => fillProductWithAi());
      $("diet-pkg-ai-puter")?.addEventListener("click", () => fillProductWithAi({ preferPuter: true }));
      $("diet-pkg-ai-confirm")?.addEventListener("click", () => saveAiProductDraft($("diet-pkg-status")));
      $("diet-pkg-ai-discard")?.addEventListener("click", () => {
        hideAiProductPreview();
        setStatus($("diet-pkg-status"), "Discarded AI preview.", "info");
      });
      $("diet-pkg-parse")?.addEventListener("click", () => {
        const st = $("diet-pkg-status");
        try {
          const food = productFromJson($("diet-pkg-json")?.value || "");
          savePackagedFood(food);
          showAiProductPreview(food);
          setStatus(st, `Parsed & saved “${food.name}”.`, "ok");
          if ($("diet-search")) $("diet-search").value = food.brand || food.product || "";
          renderFoodPick($("diet-search")?.value || "");
        } catch (e) {
          setStatus(st, e.message || "Could not parse JSON.", "error");
        }
      });
      wireDietTileProductUi();
      $("diet-pkg-sheet")?.addEventListener("click", (e) => {
        const modeBtn = e.target.closest("[data-pkg-mode]");
        if (modeBtn && pkgPending) {
          if (modeBtn.disabled) return;
          pkgPending.mode = modeBtn.getAttribute("data-pkg-mode");
          pkgPending.macrosLocked = false; /* mode switch → rescale from library facts */
          $("diet-pkg-mode-g")?.classList.toggle("is-active", pkgPending.mode === "grams");
          $("diet-pkg-mode-s")?.classList.toggle("is-active", pkgPending.mode === "servings");
          if ($("diet-pkg-amount-label")) {
            const u = foodMeasureUnit(pkgPending.food);
            $("diet-pkg-amount-label").textContent =
              pkgPending.mode === "grams" ? `Amount (${u})` : "Servings";
          }
          if ($("diet-pkg-amount")) {
            $("diet-pkg-amount").step = pkgPending.mode === "grams" ? "1" : "0.25";
            if (pkgPending.mode === "servings") $("diet-pkg-amount").value = "1";
          }
          updatePkgPreview();
          return;
        }
      });
      $("diet-pkg-amount")?.addEventListener("input", () => {
        /* Amount change re-scales unless she overrode macros by hand */
        updatePkgPreview();
      });
      ["diet-pkg-kcal", "diet-pkg-protein", "diet-pkg-carbs", "diet-pkg-fat"].forEach((id) => {
        $(id)?.addEventListener("input", () => {
          if (!pkgPending) return;
          pkgPending.macrosLocked = true;
          updatePkgPreview();
        });
      });
      $("diet-pkg-confirm")?.addEventListener("click", () => confirmPkgAdd({ saveToLibrary: false }));
      $("diet-pkg-save-add")?.addEventListener("click", () => confirmPkgAdd({ saveToLibrary: true }));
      $("diet-pkg-cancel")?.addEventListener("click", () => closePkgSheet());
    }

    function mergeExtras(a, b, deleted) {
      const dead = deleted instanceof Set ? deleted : new Set(normalizeDeletedIds(deleted));
      const out = [];
      const seen = new Set();
      const push = (item) => {
        if (!item) return;
        if (item.id != null && dead.has(String(item.id))) return;
        const key =
          item.id != null
            ? `id:${item.id}`
            : `n:${item.name || ""}|k:${item.kcal || 0}|m:${item.meal || ""}|t:${item.at || item.addedAt || ""}`;
        if (seen.has(key)) return;
        seen.add(key);
        out.push(item);
      };
      (Array.isArray(a) ? a : []).forEach(push);
      (Array.isArray(b) ? b : []).forEach(push);
      return out;
    }

    function mergeAmounts(a, b, deleted) {
      /* Union of overlays; later arg wins on conflict. Drop tombstoned ids. */
      const dead = deleted instanceof Set ? deleted : new Set(normalizeDeletedIds(deleted));
      const out = { ...(a && typeof a === "object" ? a : {}), ...(b && typeof b === "object" ? b : {}) };
      const clean = {};
      Object.keys(out).forEach((k) => {
        if (dead.has(String(k))) return;
        const g = Number(out[k]);
        if (Number.isFinite(g) && g > 0) clean[k] = Math.round(g);
      });
      return clean;
    }

    function dayHasMealContent(day) {
      if (!day || typeof day !== "object") return false;
      if ((day.extras || []).length) return true;
      if ((day.breakfast || []).length || (day.lunch || []).length || (day.dinner || []).length || (day.snacks || []).length)
        return true;
      const done = day.done || {};
      if (Object.keys(done).some((id) => done[id])) return true;
      const amounts = day.amounts || {};
      if (Object.keys(amounts).some((id) => Number(amounts[id]) > 0)) return true;
      if ((day.deletedIds || []).length) return true;
      return false;
    }

    function dayUpdatedAtMs(day) {
      if (!day || typeof day !== "object") return 0;
      const t = Date.parse(day.updatedAt || "");
      return Number.isFinite(t) ? t : 0;
    }

    function extrasIdSet(day) {
      const ids = new Set();
      const push = (list) => {
        (Array.isArray(list) ? list : []).forEach((item) => {
          if (item?.id != null) ids.add(String(item.id));
        });
      };
      push(day?.extras);
      push(day?.breakfast);
      push(day?.lunch);
      push(day?.dinner);
      push(day?.snacks);
      return ids;
    }

    function isIdSubset(small, large) {
      for (const id of small) {
        if (!large.has(id)) return false;
      }
      return true;
    }

    function snapshotDayFrom(src, deletedIds) {
      const dead = new Set(deletedIds);
      const done = {};
      Object.keys(src.done || {}).forEach((k) => {
        if (dead.has(String(k))) return;
        done[k] = !!src.done[k];
      });
      const stepsN = Number(src.steps);
      return {
        done,
        deletedIds,
        updatedAt: src.updatedAt || null,
        amounts: mergeAmounts({}, src.amounts, dead),
        extras: filterDeadItems(src.extras, dead),
        breakfast: filterDeadItems(src.breakfast, dead),
        lunch: filterDeadItems(src.lunch, dead),
        dinner: filterDeadItems(src.dinner, dead),
        snacks: filterDeadItems(src.snacks, dead),
        steps: Number.isFinite(stepsN) && stepsN >= 0 ? Math.round(stepsN) : null,
      };
    }

    function mergeSteps(a, b) {
      const na = Number(a);
      const nb = Number(b);
      const aOk = Number.isFinite(na) && na >= 0;
      const bOk = Number.isFinite(nb) && nb >= 0;
      if (aOk && bOk) return Math.max(Math.round(na), Math.round(nb));
      if (aOk) return Math.round(na);
      if (bOk) return Math.round(nb);
      return null;
    }

    function mergeOneDay(localDay, remoteDay) {
      const L = localDay || {};
      const R = remoteDay || {};
      const deletedIds = normalizeDeletedIds([...(R.deletedIds || []), ...(L.deletedIds || [])]);
      const lHas = dayHasMealContent(L);
      const rHas = dayHasMealContent(R);
      const withMergedSteps = (snap) => {
        snap.steps = mergeSteps(L.steps, R.steps);
        return snap;
      };
      /* Never let an empty side overwrite a full one */
      if (lHas && !rHas) return withMergedSteps(snapshotDayFrom(L, deletedIds));
      if (rHas && !lHas) return withMergedSteps(snapshotDayFrom(R, deletedIds));
      const lTs = dayUpdatedAtMs(L);
      const rTs = dayUpdatedAtMs(R);
      /* Newer day wins wholesale (combined tombstones still apply) — steps still merge */
      if (lTs > rTs) return withMergedSteps(snapshotDayFrom(L, deletedIds));
      if (rTs > lTs) return withMergedSteps(snapshotDayFrom(R, deletedIds));
      /* Same/missing timestamps: prefer strict subset (phone ~1200 vs inflated 1650) */
      const lIds = extrasIdSet(L);
      const rIds = extrasIdSet(R);
      if (lIds.size && rIds.size && lIds.size < rIds.size && isIdSubset(lIds, rIds)) {
        return withMergedSteps(snapshotDayFrom(L, deletedIds));
      }
      if (lIds.size && rIds.size && rIds.size < lIds.size && isIdSubset(rIds, lIds)) {
        return withMergedSteps(snapshotDayFrom(R, deletedIds));
      }
      const dead = new Set(deletedIds);
      const done = { ...(R.done || {}), ...(L.done || {}) };
      Object.keys({ ...(R.done || {}), ...(L.done || {}) }).forEach((k) => {
        if (dead.has(String(k))) {
          delete done[k];
          return;
        }
        done[k] = !!(L.done?.[k] || R.done?.[k]);
      });
      return {
        done,
        deletedIds,
        updatedAt: L.updatedAt || R.updatedAt || null,
        amounts: mergeAmounts(R.amounts, L.amounts, dead),
        extras: mergeExtras(L.extras, R.extras, dead),
        breakfast: mergeExtras(L.breakfast, R.breakfast, dead),
        lunch: mergeExtras(L.lunch, R.lunch, dead),
        dinner: mergeExtras(L.dinner, R.dinner, dead),
        snacks: mergeExtras(L.snacks, R.snacks, dead),
        steps: mergeSteps(L.steps, R.steps),
      };
    }

    function mergeChecksCloud(cloud) {
      if (!cloud || typeof cloud !== "object") return 0;
      const remoteDays = cloud.days && typeof cloud.days === "object" ? cloud.days : {};
      const localDays = state.checksByDate || {};
      const keys = new Set([...Object.keys(remoteDays), ...Object.keys(localDays)]);
      const next = {};
      let changed = 0;
      keys.forEach((k) => {
        next[k] = mergeOneDay(localDays[k], remoteDays[k]);
        const before = JSON.stringify(localDays[k] || {});
        const after = JSON.stringify(next[k] || {});
        if (before !== after) changed += 1;
      });
      state.checksByDate = next;
      const d = todayISO();
      if (next[d]) {
        const dead = new Set(normalizeDeletedIds(next[d].deletedIds));
        const stepsN = Number(next[d].steps);
        state.day = {
          ...emptyDay(),
          date: d,
          done: { ...(next[d].done || {}) },
          amounts: { ...(next[d].amounts || {}) },
          deletedIds: normalizeDeletedIds(next[d].deletedIds),
          updatedAt: next[d].updatedAt || null,
          extras: filterDeadItems(next[d].extras, dead),
          breakfast: filterDeadItems(next[d].breakfast, dead),
          lunch: filterDeadItems(next[d].lunch, dead),
          dinner: filterDeadItems(next[d].dinner, dead),
          snacks: filterDeadItems(next[d].snacks, dead),
          steps: Number.isFinite(stepsN) && stepsN >= 0 ? Math.round(stepsN) : null,
        };
      }
      persist();
      return changed;
    }

    function checksPayload() {
      persistChecksSnapshot();
      return {
        version: 1,
        updatedAt: new Date().toISOString(),
        days: { ...(state.checksByDate || {}) },
      };
    }

    function hasLocalChecks() {
      persistChecksSnapshot();
      const days = state.checksByDate || {};
      return Object.keys(days).some((k) => {
        const day = days[k] || {};
        const done = day.done || {};
        if (Object.keys(done).some((id) => done[id])) return true;
        const amounts = day.amounts || {};
        if (Object.keys(amounts).some((id) => Number(amounts[id]) > 0)) return true;
        if ((day.deletedIds || []).length) return true;
        if ((day.extras || []).length) return true;
        if ((day.breakfast || []).length || (day.lunch || []).length || (day.dinner || []).length || (day.snacks || []).length)
          return true;
        if (Number(day.steps) > 0) return true;
        return false;
      });
    }

    async function publishChecks(statusEl, tokenOverride) {
      const token =
        tokenOverride ||
        getSavedToken() ||
        ($("admin-token")?.value || "").trim();
      if (!token) {
        setStatus(statusEl, "Save a GitHub PAT first (Connect this phone).", "error");
        return false;
      }
      setStatus(statusEl, "Syncing meals…", "info");
      try {
        persistChecksSnapshot();
        /* Merge remote (API) first so an empty phone never wipes the other.
           Tombstones + newer updatedAt / subset rule keep phone truth from ballooning. */
        try {
          const remote = await githubGetJson(DIET_CHECKS_PATH, token);
          if (remote) mergeChecksCloud(remote);
        } catch (_) {
          await pullChecks({ quiet: true });
        }
        const payload = checksPayload();
        /* Never overwrite non-empty remote with a truly empty local payload —
           but DO push when we only have tombstones (deletes must propagate). */
        if (!hasLocalChecks() && payload.days && Object.keys(payload.days).length === 0) {
          setStatus(statusEl, "Nothing to upload yet — log a meal first.", "info");
          return true;
        }
        await githubPutFile(
          DIET_CHECKS_PATH,
          b64EncodeUnicode(JSON.stringify(payload, null, 2) + "\n"),
          `Sync diet meals (${todayISO()})`,
          token
        );
        setStatus(statusEl, "Meals synced. Pages ~30–60s.", "ok");
        return true;
      } catch (e) {
        setStatus(statusEl, e.message || String(e), "error");
        return false;
      }
    }

    let autoSyncTimer = null;
    let autoSyncInFlight = null;
    function maybeAutoSyncChecks({ urgent } = {}) {
      if (!getSavedToken()) return;
      clearTimeout(autoSyncTimer);
      /* ~300ms debounce — deletes/adds/grams all flush; never drop a delete */
      autoSyncTimer = setTimeout(() => {
        const run = () => {
          autoSyncInFlight = publishChecks($("diet-sync-status")).finally(() => {
            autoSyncInFlight = null;
          });
          return autoSyncInFlight;
        };
        if (autoSyncInFlight) {
          autoSyncInFlight.finally(run);
        } else {
          run();
        }
      }, urgent ? 300 : 300);
    }

    async function pullChecks({ quiet } = {}) {
      const st = $("diet-sync-status");
      if (!quiet) setStatus(st, "Refreshing checkmarks…", "info");
      try {
        const token = getSavedToken();
        let data = null;
        if (token) {
          try {
            data = await githubGetJson(DIET_CHECKS_PATH, token);
          } catch (_) {
            data = null;
          }
        }
        if (!data) {
          const res = await fetch(`./${DIET_CHECKS_PATH}?t=${Date.now()}`, { cache: "no-store" });
          if (!res.ok) throw new Error("No cloud checkmarks yet.");
          data = await res.json();
        }
        const changed = mergeChecksCloud(data);
        render();
        if (typeof Today !== "undefined" && Today.render) Today.render();
        if (!quiet) {
          setStatus(st, changed ? "Pulled checkmarks from cloud." : "Already up to date with cloud.", "ok");
        }
        return changed;
      } catch (e) {
        if (!quiet) setStatus(st, e.message || String(e), "error");
        return 0;
      }
    }

    function wire() {
      $("diet-export-toggle")?.addEventListener("click", () => openExportSheet());
      $("diet-export-close")?.addEventListener("click", () => closeExportSheet());
      $("diet-export-overlay")?.addEventListener("click", (e) => {
        if (e.target === $("diet-export-overlay")) closeExportSheet();
      });
      document.querySelectorAll("[data-export-range]").forEach((btn) => {
        btn.addEventListener("click", () => {
          setExportRange(btn.getAttribute("data-export-range") || "today");
        });
      });
      $("diet-export-date")?.addEventListener("change", () => {
        setExportRange("date");
      });
      $("diet-export-date")?.addEventListener("focus", (e) => {
        syncDietExportViewport();
        window.SapnaKeyboard?.ensureInputVisible?.(e.target);
      });
      $("diet-export-csv")?.addEventListener("click", () => runDietExport("csv"));
      $("diet-export-copy")?.addEventListener("click", () => runDietExport("copy"));
      $("diet-export-share")?.addEventListener("click", () => runDietExport("share"));
      $("diet-export-all-data")?.addEventListener("click", () => exportAllSiteData());
      wireStepsInputs();
      $("diet-regular-run")?.addEventListener("click", () => {
        if (!isAdminUnlocked()) {
          setStatus($("diet-regular-status"), "Admin only.", "error");
          return;
        }
        bootstrapRegularFoods();
      });
      $("diet-regular-puter")?.addEventListener("click", () => {
        if (!isAdminUnlocked()) {
          setStatus($("diet-regular-status"), "Admin only.", "error");
          return;
        }
        bootstrapRegularFoods({ preferPuter: true });
      });
      $("diet-quick-add")?.addEventListener("click", () => addQuickExtra());
      $("diet-sync-checks")?.addEventListener("click", () => publishChecks($("diet-sync-status")));
      $("diet-pull-checks")?.addEventListener("click", () => pullChecks({ quiet: false }));
      $("diet-search")?.addEventListener("input", (e) => {
        renderFoodPick(e.target.value);
      });
      $("diet-search")?.addEventListener("focus", (e) => {
        if (String(e.target.value || "").trim()) renderFoodPick(e.target.value);
        syncDietAddViewport();
        window.SapnaKeyboard?.ensureInputVisible?.(e.target);
      });
      $("diet-add-close")?.addEventListener("click", () => closeAddSheet());
      $("diet-add-overlay")?.addEventListener("click", (e) => {
        if (e.target === $("diet-add-overlay")) closeAddSheet();
      });
      const onDietAddVv = () => {
        const overlay = $("diet-add-overlay");
        if (!overlay || overlay.hidden) return;
        syncDietAddViewport();
      };
      const onDietExportVv = () => {
        const overlay = $("diet-export-overlay");
        if (!overlay || overlay.hidden) return;
        syncDietExportViewport();
      };
      window.__sapnaOnKeyboardRefresh = () => {
        onDietAddVv();
        onDietExportVv();
      };
      if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", onDietAddVv);
        window.visualViewport.addEventListener("scroll", onDietAddVv);
        window.visualViewport.addEventListener("resize", onDietExportVv);
        window.visualViewport.addEventListener("scroll", onDietExportVv);
      }
      window.addEventListener("resize", onDietAddVv);
      window.addEventListener("resize", onDietExportVv);
      document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        const exportOv = $("diet-export-overlay");
        if (exportOv && !exportOv.hidden) {
          e.preventDefault();
          closeExportSheet();
          return;
        }
        const overlay = $("diet-add-overlay");
        if (!overlay || overlay.hidden) return;
        const dd = $("diet-food-pick");
        if (dd && !dd.hidden) {
          e.preventDefault();
          setSearchDropdownOpen(false);
          return;
        }
        e.preventDefault();
        closeAddSheet();
      });
      $("diet-food-pick")?.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-food-id]");
        if (!btn) return;
        const food = findFood(btn.getAttribute("data-food-id"));
        if (!food || !Number.isFinite(Number(food.kcal))) {
          setStatus($("diet-status"), "That item has no usable kcal.", "error");
          return;
        }
        setSearchDropdownOpen(false);
        /* Always open edit sheet — amount + kcal/protein, then Add / Save & add */
        if ($("diet-search")) $("diet-search").value = food.name || "";
        openPkgSheet(food);
      });
      wirePackagedProductUi();
      $("diet-add-custom")?.addEventListener("click", () => {
        const st = $("diet-library-status") || $("diet-status");
        if (!isAdminUnlocked()) {
          setStatus(st, "Admin only.", "error");
          return;
        }
        const name = $("diet-custom-name")?.value.trim();
        const kcal = Number($("diet-custom-kcal")?.value);
        const protein = Number($("diet-custom-protein")?.value);
        const grams = Number($("diet-custom-grams")?.value);
        const unit = normalizeMeasureUnit($("diet-custom-unit")?.value || "g");
        if (!name || !Number.isFinite(kcal)) {
          setStatus(st, "Name and kcal required.", "error");
          return;
        }
        const food = {
          id: "custom-" + Date.now(),
          name,
          kcal,
          protein: Number.isFinite(protein) ? protein : 0,
          tags: ["custom", "admin-library"],
          servingUnit: unit,
        };
        if (unit === "ml" && !food.tags.includes("drink")) food.tags.push("drink");
        if (Number.isFinite(grams) && grams > 0) {
          food.servingGrams = grams;
          food.servingAmount = grams;
          food.servingSize = formatAmountLabel(grams, unit);
        } else {
          const parsed = parseServingAmount(name) || { amount: parseServingGrams(name), unit };
          if (parsed?.amount) {
            food.servingGrams = parsed.amount;
            food.servingAmount = parsed.amount;
            food.servingUnit = parsed.unit || unit;
          }
        }
        state.customFoods = state.customFoods || [];
        state.customFoods.push(food);
        persist();
        if ($("diet-custom-name")) $("diet-custom-name").value = "";
        if ($("diet-custom-kcal")) $("diet-custom-kcal").value = "";
        if ($("diet-custom-protein")) $("diet-custom-protein").value = "";
        if ($("diet-custom-grams")) $("diet-custom-grams").value = "";
        if ($("diet-custom-unit")) $("diet-custom-unit").value = "g";
        setStatus(st, `Added “${name}” to library on this phone.`, "ok");
        renderFoodPick($("diet-search")?.value || "");
      });
      $("diet-save-targets")?.addEventListener("click", () => {
        state.targets = {
          kcal: Number($("diet-target-kcal").value) || 1300,
          protein: Number($("diet-target-protein").value) || 100,
        };
        persist();
        render();
        if (typeof Profile !== "undefined" && Profile.paintSummaries) Profile.paintSummaries();
        setStatus($("diet-status"), "Targets saved on this phone.", "ok");
      });
      $("diet-clear-day")?.addEventListener("click", () => {
        if (!confirm("Clear today’s food log?")) return;
        ensureDay();
        const ids = new Set(normalizeDeletedIds(state.day.deletedIds));
        (state.day.extras || []).forEach((x) => {
          if (x?.id != null) ids.add(String(x.id));
        });
        MEALS.forEach(({ id }) => {
          (state.day[id] || []).forEach((x) => {
            if (x?.id != null) ids.add(String(x.id));
          });
        });
        state.day = {
          ...emptyDay(),
          date: todayISO(),
          deletedIds: [...ids],
        };
        persistLocal();
        render();
        maybeAutoSyncChecks({ urgent: true });
        setStatus($("diet-status"), "Today’s log cleared.", "info");
      });
      $("diet-meals")?.addEventListener("click", (e) => {
        const gramsBtn = e.target.closest("[data-edit-grams]");
        if (gramsBtn) {
          e.preventDefault();
          e.stopPropagation();
          openGramsSheet({
            kind: "extra",
            id: gramsBtn.getAttribute("data-edit-grams"),
            meal: gramsBtn.getAttribute("data-extra-meal") || undefined,
            idx: gramsBtn.getAttribute("data-extra-idx"),
          });
          return;
        }
        const add = e.target.closest("[data-add-meal]");
        if (add) {
          focusAddForMeal(add.getAttribute("data-add-meal"));
          return;
        }
        const btn = e.target.closest("[data-remove]");
        if (!btn) return;
        const [meal, idx] = btn.getAttribute("data-remove").split(":");
        removeItem(meal, Number(idx));
      });
      wireGramsSheet();
    }

    async function init() {
      /* Drop legacy Google CSE keys if present */
      try {
        localStorage.removeItem("sapna_google_cse_key");
        localStorage.removeItem("sapna_google_cse_cx");
      } catch (_) {}
      try {
        const [fRes, dRes, pRes] = await Promise.all([
          fetch(`./data/foods.json?v=${PROFILE_ASSET_V}`, { cache: "no-store" }),
          fetch(`./data/diet-defaults.json?v=${PROFILE_ASSET_V}`, { cache: "no-store" }),
          fetch(`./${DIET_TODAY_PATH}?v=${PROFILE_ASSET_V}`, { cache: "no-store" }),
        ]);
        if (fRes.ok) {
          const data = await fRes.json();
          foods = data.foods || [];
        }
        if (dRes.ok) {
          defaults = await dRes.json();
          const pub = defaults.targets;
          if (pub && Number.isFinite(Number(pub.kcal))) {
            const pubK = Math.round(Number(pub.kcal));
            const pubP = Math.round(Number(pub.protein) || 100);
            /* Prior published sticky goals — adopt newest cloud goal so all phones match */
            const STALE_GOALS = new Set([1800, 1200]);
            const localK = Math.round(Number(state.targets?.kcal) || 0);
            if (!state.targets || (localK !== pubK && (STALE_GOALS.has(localK) || !localK))) {
              state.targets = { ...(state.targets || {}), kcal: pubK, protein: pubP };
              saveJSON(LS.diet, state);
            }
          }
        }
        if (pRes.ok) {
          const rawPlan = await pRes.json();
          publishedPlan = normalizePublishedPlan(rawPlan);
          /* Empty plan still carries calorie goal — apply when local is missing/stale published */
          const planT = rawPlan?.targets;
          if (planT && Number.isFinite(Number(planT.kcal))) {
            const pk = Math.round(Number(planT.kcal));
            const pp = Math.round(Number(planT.protein) || 100);
            const STALE_GOALS = new Set([1800, 1200]);
            const localK = Math.round(Number(state.targets?.kcal) || 0);
            if (!state.targets || (localK !== pk && (STALE_GOALS.has(localK) || !localK))) {
              state.targets = { kcal: pk, protein: pp };
              saveJSON(LS.diet, state);
            }
          }
        }
      } catch (e) {
        console.warn(e);
      }
      try {
        await pullChecks({ quiet: true });
      } catch (_) {}
      wire();
      render();
      renderFoodPick($("diet-search")?.value || "");
    }


    function todayPlate() {
      ensureDay();
      const out = [];
      MEALS.forEach(({ id, label }) => {
        extrasInMeal(id).forEach((item) => {
          const s = scaledExtra(item);
          out.push({
            meal: label,
            name: item.name,
            kcal: Math.round(Number(s.kcal) || 0),
            protein: Math.round((Number(s.protein) || 0) * 10) / 10,
            grams: s.grams,
          });
        });
      });
      return out;
    }

    function listFoods() {
      return allFoods();
    }

    function importGeminiFoods(foods, provider) {
      const rows = Array.isArray(foods) ? foods : [];
      let n = 0;
      state.customFoods = state.customFoods || [];
      const tag = provider === "puter-grok" ? "puter-grok" : "gemini";
      rows.forEach((f) => {
        const name = String(f.name || "").trim();
        const kcal = Number(f.kcal);
        if (!name || !Number.isFinite(kcal)) return;
        const serving = String(f.serving || "").trim();
        const display = serving && !name.toLowerCase().includes(serving.toLowerCase())
          ? `${name} (${serving})`
          : name;
        const id = "gfood-" + display.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 48) + "-" + Math.round(kcal);
        const existing = state.customFoods.findIndex((x) => x.id === id || x.name === display);
        const row = {
          id,
          name: display,
          kcal: Math.round(kcal),
          protein: Number.isFinite(Number(f.protein)) ? Math.round(Number(f.protein) * 10) / 10 : 0,
          carbs: Number.isFinite(Number(f.carbs)) ? Math.round(Number(f.carbs) * 10) / 10 : null,
          fat: Number.isFinite(Number(f.fat)) ? Math.round(Number(f.fat) * 10) / 10 : null,
          tags: ["regular", "ai", tag],
        };
        if (existing >= 0) state.customFoods[existing] = row;
        else state.customFoods.push(row);
        n += 1;
      });
      persist();
      render();
      return n;
    }

    async function bootstrapRegularFoods({ preferPuter } = {}) {
      const raw = $("diet-regular-list")?.value || "";
      const st = $("diet-regular-status");
      const puterCall = (opts) => PuterGrok.enrichFoods(raw, opts);
      try {
        const { result: data, provider } = preferPuter
          ? await AiBridge.puterOnly({ statusEl: st, puterCall })
          : await AiBridge.withFallback({
              statusEl: st,
              geminiCall: () => Gemini.enrichFoods(raw),
              puterCall,
            });
        const n = importGeminiFoods(data.foods || [], provider);
        const via = provider === "puter-grok" ? "Puter Grok" : "Gemini";
        setStatus(st, `Added/updated ${n} foods via ${via}. Log meals offline from now.`, "ok");
        renderFoodPick($("diet-search")?.value || "");
      } catch (e) {
        setStatus(st, e.message || String(e), "error");
      }
    }

    function getTargetsForAdmin() {
      return targets();
    }

    function applyTargets(next) {
      if (!next || !Number.isFinite(Number(next.kcal))) return targets();
      state.targets = {
        kcal: Math.round(Number(next.kcal)),
        protein: Math.round(Number(next.protein) || 100),
      };
      persist();
      render();
      return state.targets;
    }

    function snapshot() {
      const tg = adjustedTargets();
      const tot = totals();
      const left = Math.max(0, Math.round(tg.kcal - tot.kcal));
      ensureDay();
      const mealFill = {};
      MEALS.forEach(({ id }) => {
        mealFill[id] = extrasInMeal(id).length > 0;
      });
      return {
        kcal: tot.kcal,
        protein: tot.protein,
        targetKcal: tg.kcal,
        targetProtein: tg.protein,
        baseTargetKcal: tg.baseKcal,
        stepBurn: tg.stepBurn,
        steps: tg.steps,
        left,
        over: tot.kcal > tg.kcal,
        mealFill,
        planHeadline: "Today’s plate",
        waitingAdmin: false,
      };
    }

    function paintStepsInputs() {
      const steps = getTodaySteps();
      const burn = estimateStepBurnKcal(steps);
      const hint = steps
        ? `${steps.toLocaleString()} steps · ~${burn} kcal walk`
        : "Manual — syncs with meals";
      ["today-steps-input", "diet-steps-input"].forEach((id) => {
        const el = $(id);
        if (!el) return;
        if (document.activeElement === el) return;
        el.value = steps ? String(steps) : "";
      });
      ["today-steps-hint", "diet-steps-hint"].forEach((id) => {
        const el = $(id);
        if (el) el.textContent = hint;
      });
    }

    function wireStepsInputs() {
      const onCommit = (el) => {
        setTodaySteps(el.value);
        paintStepsInputs();
        render();
        if (typeof Progress !== "undefined" && Progress.render) Progress.render();
        if (typeof Today !== "undefined" && Today.render) Today.render();
      };
      ["today-steps-input", "diet-steps-input"].forEach((id) => {
        const el = $(id);
        if (!el || el.dataset.stepsWired === "1") return;
        el.dataset.stepsWired = "1";
        el.addEventListener("change", () => onCommit(el));
        el.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            el.blur();
            onCommit(el);
          }
        });
      });
    }

    return {
      init,
      render,
      getTargetsForAdmin,
      applyTargets,
      snapshot,
      dietLoggedDates,
      focusAddForMeal,
      todayPlate,
      importGeminiFoods,
      bootstrapRegularFoods,
      loadPublishedPlan,
      listFoods,
      publishChecks,
      pullChecks,
      hasLocalChecks,
      getTodaySteps,
      setTodaySteps,
      estimateStepBurnKcal,
      adjustedTargets,
      paintStepsInputs,
      wireStepsInputs,
    };
  })();

  /* ───────── Profile / onboarding (device-first) ───────── */
  const Profile = (() => {
    const SS_SKIP = "sapna_profile_skip_session";
    const STEPS = ["About you", "Goals", "Activity", "Diet prefs", "Health notes", "Your targets"];
    const ACTIVITY_MUL = { sedentary: 1.2, light: 1.375, active: 1.55, very: 1.725 };
    const empty = () => ({
      version: 1,
      completedAt: null,
      skippedAt: null,
      age: null,
      dob: null,
      sex: null,
      weightKg: null,
      heightCm: null,
      goal: null,
      targetWeightKg: null,
      paceKgPerWeek: null,
      activity: null,
      workoutDays: null,
      workoutType: null,
      dietStyles: [],
      allergies: [],
      allergiesNote: "",
      mealsPerDay: null,
      ifNote: "",
      conditions: [],
      conditionsOther: "",
      injuries: "",
      pregnancy: null,
      syncBasics: true,
      derived: null,
    });

    let state = loadJSON(LS.profile, empty());
    let step = 0;
    let wired = false;

    function persist() {
      saveJSON(LS.profile, state);
    }

    function numOrNull(v) {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }

    function ageFromState(s) {
      if (s.dob) {
        const d = new Date(s.dob + "T12:00:00");
        if (!Number.isNaN(d.getTime())) {
          const now = new Date();
          let age = now.getFullYear() - d.getFullYear();
          const m = now.getMonth() - d.getMonth();
          if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
          if (age >= 13 && age <= 100) return age;
        }
      }
      return numOrNull(s.age);
    }

    function bmiLabel(bmi) {
      if (bmi == null) return "";
      if (bmi < 18.5) return "Underweight range (info only)";
      if (bmi < 25) return "Healthy range (info only)";
      if (bmi < 30) return "Overweight range (info only)";
      return "Higher BMI range (info only)";
    }

    function derive(s) {
      const weight = numOrNull(s.weightKg);
      const height = numOrNull(s.heightCm);
      const age = ageFromState(s);
      if (weight == null || height == null || height <= 0) {
        return { bmi: null, bmr: null, tdee: null, targetKcal: null, targetProtein: null, bmiLabel: "", ready: false };
      }
      const hM = height / 100;
      const bmi = Math.round((weight / (hM * hM)) * 10) / 10;
      let bmr = null;
      if (age != null) {
        /* Mifflin–St Jeor; default female curve for Sapna when sex unknown */
        const base = 10 * weight + 6.25 * height - 5 * age;
        if (s.sex === "male") bmr = base + 5;
        else bmr = base - 161;
        bmr = Math.round(bmr);
      }
      const mul = ACTIVITY_MUL[s.activity] || 1.375;
      const tdee = bmr != null ? Math.round(bmr * mul) : null;
      let delta = 0;
      const pace = numOrNull(s.paceKgPerWeek);
      if (pace != null && pace !== 0) {
        /* ~7700 kcal per kg body mass */
        delta = Math.round((pace * 7700) / 7);
        if (s.goal === "lose" && pace > 0) delta = -Math.abs(delta);
        else if (s.goal === "muscle" && pace > 0) delta = Math.abs(delta);
        else if (s.goal === "lose") delta = -Math.abs(delta);
        else if (s.goal === "muscle") delta = Math.abs(delta);
      } else if (s.goal === "lose") {
        delta = -385; /* ~0.35 kg/week gentle */
      } else if (s.goal === "muscle") {
        delta = 200;
      }
      let targetKcal = tdee != null ? tdee + delta : null;
      if (targetKcal != null) targetKcal = Math.max(1200, Math.min(4000, Math.round(targetKcal / 10) * 10));
      let proMul = 1.4;
      if (s.goal === "lose") proMul = 1.6;
      if (s.goal === "muscle") proMul = 1.8;
      if (s.goal === "fitness") proMul = 1.5;
      const targetProtein = Math.max(50, Math.min(220, Math.round(weight * proMul)));
      return {
        bmi,
        bmr,
        tdee,
        targetKcal,
        targetProtein,
        bmiLabel: bmiLabel(bmi),
        ready: targetKcal != null,
      };
    }

    function isComplete(s) {
      /* Full save only — biometrics alone must not skip the rest of onboarding */
      return !!(s && s.completedAt);
    }

    function needsNudge() {
      /* Profile onboarding suppressed — GitHub sync token is the only first-run prompt. */
      return false;
    }

    function chipValues(group) {
      return [...document.querySelectorAll(`.profile-chips[data-chip-group="${group}"] .profile-chip.is-active`)].map(
        (b) => b.getAttribute("data-value")
      );
    }

    function setChips(group, values, single) {
      const set = new Set(Array.isArray(values) ? values : values ? [values] : []);
      document.querySelectorAll(`.profile-chips[data-chip-group="${group}"] .profile-chip`).forEach((btn) => {
        const v = btn.getAttribute("data-value");
        btn.classList.toggle("is-active", set.has(v));
        btn.setAttribute("aria-pressed", set.has(v) ? "true" : "false");
      });
      if (single && set.size > 1) {
        /* keep first only — should not happen */
      }
    }

    function readFormInto(s) {
      const next = { ...s };
      next.age = numOrNull($("pf-age")?.value);
      next.dob = ($("pf-dob")?.value || "").trim() || null;
      next.sex = chipValues("sex")[0] || null;
      next.weightKg = numOrNull($("pf-weight")?.value);
      next.heightCm = numOrNull($("pf-height")?.value);
      next.goal = chipValues("goal")[0] || null;
      next.targetWeightKg = numOrNull($("pf-target-weight")?.value);
      const paceRaw = ($("pf-pace")?.value || "").trim();
      next.paceKgPerWeek = paceRaw === "" ? null : numOrNull(paceRaw);
      next.activity = chipValues("activity")[0] || null;
      next.workoutDays = numOrNull($("pf-workout-days")?.value);
      next.workoutType = chipValues("workoutType")[0] || null;
      let styles = chipValues("dietStyles");
      if (styles.includes("none") && styles.length > 1) styles = styles.filter((x) => x !== "none");
      next.dietStyles = styles;
      next.allergies = chipValues("allergies");
      next.allergiesNote = ($("pf-allergies-note")?.value || "").trim();
      next.mealsPerDay = numOrNull($("pf-meals")?.value);
      next.ifNote = ($("pf-if-note")?.value || "").trim();
      let conditions = chipValues("conditions");
      if (conditions.includes("none") && conditions.length > 1) conditions = conditions.filter((x) => x !== "none");
      next.conditions = conditions;
      next.conditionsOther = ($("pf-conditions-other")?.value || "").trim();
      next.injuries = ($("pf-injuries")?.value || "").trim();
      next.pregnancy = chipValues("pregnancy")[0] || null;
      next.syncBasics = !!$("pf-sync-basics")?.checked;
      next.derived = derive(next);
      return next;
    }

    function fillForm(s) {
      if ($("pf-age")) $("pf-age").value = s.age != null ? s.age : "";
      if ($("pf-dob")) $("pf-dob").value = s.dob || "";
      if ($("pf-weight")) $("pf-weight").value = s.weightKg != null ? s.weightKg : "";
      if ($("pf-height")) $("pf-height").value = s.heightCm != null ? s.heightCm : "";
      if ($("pf-target-weight")) $("pf-target-weight").value = s.targetWeightKg != null ? s.targetWeightKg : "";
      if ($("pf-pace")) $("pf-pace").value = s.paceKgPerWeek != null ? String(s.paceKgPerWeek) : "";
      if ($("pf-workout-days")) $("pf-workout-days").value = s.workoutDays != null ? s.workoutDays : "";
      if ($("pf-allergies-note")) $("pf-allergies-note").value = s.allergiesNote || "";
      if ($("pf-meals")) $("pf-meals").value = s.mealsPerDay != null ? s.mealsPerDay : "";
      if ($("pf-if-note")) $("pf-if-note").value = s.ifNote || "";
      if ($("pf-conditions-other")) $("pf-conditions-other").value = s.conditionsOther || "";
      if ($("pf-injuries")) $("pf-injuries").value = s.injuries || "";
      if ($("pf-sync-basics")) $("pf-sync-basics").checked = s.syncBasics !== false;
      setChips("sex", s.sex, true);
      setChips("goal", s.goal, true);
      setChips("activity", s.activity, true);
      setChips("workoutType", s.workoutType, true);
      setChips("dietStyles", s.dietStyles || []);
      setChips("allergies", s.allergies || []);
      setChips("conditions", s.conditions || []);
      setChips("pregnancy", s.pregnancy, true);
      updateLiveMetrics();
    }

    function updateLiveMetrics() {
      const draft = readFormInto(state);
      const d = draft.derived || {};
      const el = $("profile-live-metrics");
      if (el) {
        if (d.bmi != null) {
          el.innerHTML = `<strong>BMI ${d.bmi}</strong> · ${escapeHtml(d.bmiLabel || "info only")}${
            d.bmr != null ? ` · BMR ~${d.bmr} kcal` : " · add age for BMR"
          }`;
        } else {
          el.textContent = "Add weight & height to preview BMI.";
        }
      }
      const card = $("profile-summary-card");
      if (card) {
        if (d.ready) {
          card.innerHTML = `
            <p class="profile-summary-kicker">Suggested daily targets</p>
            <p class="profile-summary-nums"><strong>${d.targetKcal}</strong> kcal · <strong>${d.targetProtein}g</strong> protein</p>
            <ul class="profile-summary-list">
              <li>BMI ${d.bmi} — ${escapeHtml(d.bmiLabel)}</li>
              <li>BMR ~${d.bmr} · TDEE ~${d.tdee} kcal</li>
              <li>Goal: ${escapeHtml(draft.goal || "not set")} · Activity: ${escapeHtml(draft.activity || "light default")}</li>
            </ul>
            <p class="hint">Saving applies these to Diet rings. You can tweak numbers anytime.</p>`;
        } else if (d.bmi != null) {
          card.innerHTML = `<p class="hint">BMI ${d.bmi}. Add <strong>age</strong> (or birthday) so we can estimate BMR → calories.</p>`;
        } else {
          card.innerHTML = `<p class="hint">Fill height &amp; weight (and age/sex if you can) to see targets.</p>`;
        }
      }
    }

    function isOpen() {
      const overlay = $("profile-sheet");
      return !!(overlay && !overlay.hidden && overlay.classList.contains("is-open"));
    }

    function setCtrlVisible(el, on) {
      if (!el) return;
      if (on) {
        el.hidden = false;
        el.removeAttribute("hidden");
      } else {
        el.hidden = true;
        el.setAttribute("hidden", "");
      }
    }

    function showStep(n) {
      const nextStep = Math.max(0, Math.min(STEPS.length - 1, Number(n) || 0));
      step = nextStep;
      /* Class-only panes — do NOT toggle [hidden] (fights CSS) or run fadeUp (iOS opacity:0 trap) */
      document.querySelectorAll(".profile-step").forEach((sec) => {
        const i = Number(sec.getAttribute("data-profile-step"));
        const on = i === step;
        sec.classList.toggle("is-active", on);
        sec.removeAttribute("hidden");
        sec.setAttribute("aria-hidden", on ? "false" : "true");
      });
      const label = $("profile-step-label");
      if (label) label.textContent = `${STEPS[step]} · ${step + 1}/${STEPS.length}`;
      const prog = $("profile-progress");
      if (prog) {
        prog.innerHTML = STEPS.map((_, i) => `<span class="profile-dot${i === step ? " is-on" : i < step ? " is-done" : ""}"></span>`).join("");
      }
      setCtrlVisible($("profile-back"), step > 0);
      setCtrlVisible($("profile-head-back"), step > 0);
      setCtrlVisible($("profile-next"), step < STEPS.length - 1);
      setCtrlVisible($("profile-save"), step >= STEPS.length - 1);
      setCtrlVisible($("profile-skip-step"), step < STEPS.length - 1);
      if (step === STEPS.length - 1) updateLiveMetrics();
      const sheet = $("profile-sheet")?.querySelector(".profile-sheet");
      if (sheet) {
        try {
          sheet.scrollTop = 0;
        } catch (_) {}
      }
    }

    function goBackStep() {
      if (!isOpen()) return false;
      try {
        state = readFormInto(state);
      } catch (_) {}
      if (step > 0) {
        showStep(step - 1);
        return true;
      }
      close();
      return false;
    }

    function close() {
      const overlay = $("profile-sheet");
      if (!overlay) return;
      overlay.hidden = true;
      overlay.setAttribute("hidden", "");
      overlay.classList.remove("is-open");
      overlay.style.cssText = "";
      document.body.classList.remove("modal-open", "profile-sheet-open");
    }

    function open(opts) {
      const overlay = $("profile-sheet");
      if (!overlay) return;
      fillForm(state);
      showStep(opts?.step != null ? opts.step : 0);
      overlay.hidden = false;
      overlay.removeAttribute("hidden");
      overlay.classList.add("is-open");
      overlay.style.cssText = "display:flex !important; pointer-events:auto !important;";
      document.body.classList.add("modal-open", "profile-sheet-open");
      setStatus($("profile-status"), "");
      updateLiveMetrics();
      if (window.SapnaKeyboard?.pinOverlayToVv) window.SapnaKeyboard.pinOverlayToVv(overlay);
    }

    function applyToDiet() {
      const d = state.derived || derive(state);
      state.derived = d;
      if (d.ready && Diet.applyTargets) {
        Diet.applyTargets({ kcal: d.targetKcal, protein: d.targetProtein });
      }
    }

    function publicBasics(s) {
      return {
        version: 1,
        updatedAt: new Date().toISOString(),
        age: ageFromState(s),
        sex: s.sex === "prefer_not" ? null : s.sex,
        weightKg: s.weightKg,
        heightCm: s.heightCm,
        goal: s.goal,
        targetWeightKg: s.targetWeightKg,
        paceKgPerWeek: s.paceKgPerWeek,
        activity: s.activity,
        workoutDays: s.workoutDays,
        workoutType: s.workoutType,
        dietStyles: s.dietStyles || [],
        allergies: s.allergies || [],
        allergiesNote: s.allergiesNote || "",
        mealsPerDay: s.mealsPerDay,
        ifNote: s.ifNote || "",
        derived: s.derived,
        /* medical intentionally omitted */
      };
    }

    function mergeBasicsFromCloud(cloud) {
      if (!cloud || typeof cloud !== "object") return false;
      /* Never overwrite medical/local-only fields; fill gaps from public basics */
      const before = JSON.stringify(state);
      const take = (key) => {
        if (cloud[key] == null || cloud[key] === "") return;
        if (state[key] == null || state[key] === "" || (Array.isArray(state[key]) && !state[key].length)) {
          state[key] = cloud[key];
        }
      };
      [
        "age",
        "sex",
        "weightKg",
        "heightCm",
        "goal",
        "targetWeightKg",
        "paceKgPerWeek",
        "activity",
        "workoutDays",
        "workoutType",
        "mealsPerDay",
        "allergiesNote",
        "ifNote",
      ].forEach(take);
      if (Array.isArray(cloud.dietStyles) && cloud.dietStyles.length && !(state.dietStyles || []).length) {
        state.dietStyles = cloud.dietStyles.slice();
      }
      if (Array.isArray(cloud.allergies) && cloud.allergies.length && !(state.allergies || []).length) {
        state.allergies = cloud.allergies.slice();
      }
      if (cloud.derived && typeof cloud.derived === "object" && !state.derived) {
        state.derived = cloud.derived;
      }
      /* If cloud has a complete-looking basics set and local never finished onboarding, mark complete */
      if (!state.completedAt && (cloud.weightKg != null || cloud.heightCm != null) && cloud.goal) {
        state.completedAt = cloud.updatedAt || new Date().toISOString();
      }
      state.derived = derive(state);
      const after = JSON.stringify(state);
      if (before !== after) {
        persist();
        applyToDiet();
        paintSummaries();
        return true;
      }
      return false;
    }

    async function pullBasics({ quiet } = {}) {
      try {
        const token = getSavedToken();
        let data = null;
        if (token) {
          try {
            data = await githubGetJson(PROFILE_PATH, token);
          } catch (_) {
            data = null;
          }
        }
        if (!data) {
          const res = await fetch(`./${PROFILE_PATH}?t=${Date.now()}`, { cache: "no-store" });
          if (!res.ok) return false;
          data = await res.json();
        }
        return mergeBasicsFromCloud(data);
      } catch (_) {
        if (!quiet) {
          /* silent on boot */
        }
        return false;
      }
    }

    function shouldPublishBasics() {
      if (!state.syncBasics) return false;
      if (!getSavedToken()) return false;
      return !!(state.completedAt || state.weightKg != null || state.heightCm != null || state.goal);
    }

    async function maybePublishBasics() {
      if (!state.syncBasics) return { ok: true, skipped: true };
      const token = getSavedToken();
      if (!token) {
        return { ok: false, message: "Saved on phone. Add a GitHub token to sync basics." };
      }
      if (!shouldPublishBasics()) return { ok: true, skipped: true };
      try {
        /* Prefer local completed profile — do not upload empty shell over remote */
        const remote = await githubGetJson(PROFILE_PATH, token).catch(() => null);
        if (remote) mergeBasicsFromCloud(remote);
        if (!state.weightKg && !state.heightCm && !state.goal && !state.completedAt) {
          return { ok: true, skipped: true };
        }
        const payload = publicBasics(state);
        await githubPutFile(
          PROFILE_PATH,
          b64EncodeUnicode(JSON.stringify(payload, null, 2) + "\n"),
          `Update profile basics (${todayISO()})`,
          token
        );
        return { ok: true };
      } catch (e) {
        return { ok: false, message: e.message || "Could not sync basics." };
      }
    }

    async function save() {
      state = readFormInto(state);
      state.derived = derive(state);
      state.completedAt = new Date().toISOString();
      state.skippedAt = null;
      /* With a PAT saved, keep syncing basics across phones by default */
      if (getSavedToken()) state.syncBasics = true;
      persist();
      applyToDiet();
      paintSummaries();
      try {
        sessionStorage.removeItem(SS_SKIP);
      } catch (_) {}
      const pub = await maybePublishBasics();
      if (pub.ok && !pub.skipped) {
        setStatus($("profile-status"), "Saved — Diet targets updated · basics synced.", "ok");
      } else if (!pub.ok) {
        setStatus($("profile-status"), `Saved on this phone. Sync: ${pub.message}`, "info");
      } else {
        setStatus($("profile-status"), "Saved on this phone — Diet targets updated.", "ok");
      }
      setTimeout(close, 700);
    }

    function skipSession() {
      try {
        sessionStorage.setItem(SS_SKIP, "1");
      } catch (_) {}
      state.skippedAt = new Date().toISOString();
      persist();
      paintSummaries();
      close();
    }

    function paintSummaries() {
      const nudgeToday = $("today-profile-nudge");
      const nudgeDiet = $("diet-profile-nudge");
      if (nudgeToday) {
        nudgeToday.hidden = true;
        nudgeToday.setAttribute("aria-hidden", "true");
      }
      if (nudgeDiet) {
        nudgeDiet.hidden = true;
        nudgeDiet.setAttribute("aria-hidden", "true");
      }

      const d = state.derived || derive(state);
      const sum = $("diet-profile-summary");
      if (sum) {
        if (d.bmi != null || d.targetKcal != null) {
          sum.hidden = false;
          sum.innerHTML = `
            <div class="diet-profile-summary-inner">
              <p class="hf-diet-eyebrow">From your profile</p>
              <p class="diet-profile-summary-line">
                ${d.bmi != null ? `<span><strong>BMI ${d.bmi}</strong></span>` : ""}
                ${d.tdee != null ? `<span>TDEE ~${d.tdee}</span>` : ""}
                ${d.targetKcal != null ? `<span><strong>${d.targetKcal}</strong> kcal goal</span>` : ""}
                ${d.targetProtein != null ? `<span><strong>${d.targetProtein}g</strong> protein</span>` : ""}
              </p>
              <button type="button" class="btn-diet-ghost" data-profile-open>Edit profile</button>
            </div>`;
        } else {
          sum.hidden = true;
          sum.innerHTML = "";
        }
      }
      const hint = $("diet-targets-from-profile");
      if (hint && d.ready) {
        hint.innerHTML = `Suggested from profile (BMI ${d.bmi}, TDEE ~${d.tdee}). Override below anytime.`;
      }
    }

    function coachSnippet() {
      const d = state.derived || derive(state);
      const safety = [];
      (state.conditions || []).forEach((c) => {
        if (c && c !== "none") safety.push(c);
      });
      if (state.conditionsOther) safety.push(state.conditionsOther);
      return {
        goal: state.goal,
        activity: state.activity,
        workoutDays: state.workoutDays,
        workoutType: state.workoutType,
        dietStyles: state.dietStyles || [],
        allergies: [...(state.allergies || []), state.allergiesNote].filter(Boolean),
        mealsPerDay: state.mealsPerDay,
        ifNote: state.ifNote || "",
        targets: d.ready ? { kcal: d.targetKcal, protein: d.targetProtein, bmi: d.bmi, tdee: d.tdee } : null,
        /* Safety for coach intensity — device-local only, never published */
        safety: {
          conditions: safety,
          injuries: state.injuries || "",
          pregnancy: state.pregnancy && state.pregnancy !== "prefer_not" ? state.pregnancy : null,
        },
      };
    }

    function wireChips() {
      document.querySelectorAll(".profile-chips").forEach((group) => {
        group.addEventListener("click", (e) => {
          const btn = e.target.closest(".profile-chip");
          if (!btn || !group.contains(btn)) return;
          const single = group.getAttribute("data-single") === "1";
          const v = btn.getAttribute("data-value");
          if (single) {
            group.querySelectorAll(".profile-chip").forEach((b) => {
              const on = b === btn;
              b.classList.toggle("is-active", on);
              b.setAttribute("aria-pressed", on ? "true" : "false");
            });
          } else {
            if (v === "none" || v === "prefer_not") {
              group.querySelectorAll(".profile-chip").forEach((b) => {
                const on = b === btn;
                b.classList.toggle("is-active", on);
                b.setAttribute("aria-pressed", on ? "true" : "false");
              });
            } else {
              group.querySelector(`.profile-chip[data-value="none"]`)?.classList.remove("is-active");
              btn.classList.toggle("is-active");
              btn.setAttribute("aria-pressed", btn.classList.contains("is-active") ? "true" : "false");
            }
          }
          updateLiveMetrics();
        });
      });
    }

    function wire() {
      if (wired) return;
      wired = true;
      wireChips();
      ["pf-age", "pf-dob", "pf-weight", "pf-height", "pf-pace", "pf-target-weight"].forEach((id) => {
        $(id)?.addEventListener("input", () => updateLiveMetrics());
        $(id)?.addEventListener("change", () => updateLiveMetrics());
      });
      $("profile-close")?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        close();
      });
      let backLockUntil = 0;
      const onBackClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const now = Date.now();
        if (now < backLockUntil) return;
        backLockUntil = now + 450; /* avoid touchend+click double-step on iOS */
        Haptics.light();
        goBackStep();
      };
      /* click + touchend — iOS sometimes drops click on sticky footer controls */
      ["profile-back", "profile-head-back"].forEach((id) => {
        const el = $(id);
        if (!el) return;
        el.addEventListener("click", onBackClick);
        el.addEventListener("touchend", onBackClick, { passive: false });
      });
      $("profile-next")?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        Haptics.light();
        state = readFormInto(state);
        showStep(step + 1);
      });
      $("profile-skip-step")?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        Haptics.light();
        state = readFormInto(state);
        if (step >= STEPS.length - 1) skipSession();
        else showStep(step + 1);
      });
      $("profile-save")?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        Haptics.ok();
        save();
      });
      document.addEventListener("click", (e) => {
        const openBtn = e.target.closest("[data-profile-open]");
        if (openBtn) {
          e.preventDefault();
          open();
          return;
        }
        const skipBtn = e.target.closest("[data-profile-skip]");
        if (skipBtn) {
          e.preventDefault();
          skipSession();
        }
      });
      $("profile-sheet")?.addEventListener("click", (e) => {
        if (e.target === $("profile-sheet")) close();
      });
      document.addEventListener("keydown", (e) => {
        if (!isOpen()) return;
        if (e.key === "Escape") {
          e.preventDefault();
          goBackStep();
        }
      });
    }

    function tokenSheetOpen() {
      const t = $("token-setup");
      return t && !t.hidden && t.classList.contains("is-open");
    }

    function promptIfNeeded() {
      wire();
      paintSummaries();
      /* Do not auto-open profile onboarding — GitHub sync token sheet owns first-run UX */
    }

    function resetLocal() {
      state = empty();
      persist();
      try {
        sessionStorage.removeItem(SS_SKIP);
      } catch (_) {}
      paintSummaries();
    }

    async function bootSync() {
      await pullBasics({ quiet: true });
      if (shouldPublishBasics()) {
        await maybePublishBasics();
      }
    }

    return {
      init: promptIfNeeded,
      open,
      close,
      paintSummaries,
      coachSnippet,
      derive,
      getState: () => state,
      isComplete: () => isComplete(state),
      resetLocal,
      pullBasics,
      maybePublishBasics,
      shouldPublishBasics,
      bootSync,
    };
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
        <div class="stat"><label>Period days</label><strong>${periodDays}</strong></div>
        <div class="stat"><label>Cycle / next</label><strong>${
          est.cycleLen ? `${est.cycleLen}d · ${est.next}` : "Learn cycle"
        }</strong></div>
        <div class="stat"><label>Today</label><strong>${
          (state.days[todayISO()] || {}).period ? "Period day" : "—"
        }</strong></div>`;
    }


    function coachSnapshot() {
      const est = estimates();
      const today = state.days[todayISO()] || {};
      const starts = periodStarts();
      const lastStart = starts.length ? starts[starts.length - 1] : null;
      let dayOfCycle = null;
      if (lastStart && est.cycleLen) {
        const a = new Date(lastStart + "T12:00:00");
        const b = new Date(todayISO() + "T12:00:00");
        dayOfCycle = Math.max(1, Math.round((b - a) / 86400000) + 1);
      }
      let phase = "unknown";
      if (today.period) phase = "menstrual";
      else if (dayOfCycle && est.cycleLen) {
        const d = dayOfCycle;
        const cl = est.cycleLen;
        if (d <= 5) phase = "menstrual";
        else if (d <= 13) phase = "follicular";
        else if (d <= 16) phase = "ovulatory";
        else phase = "luteal";
      }
      return {
        isPeriodToday: !!today.period,
        lastStart,
        nextEstimate: est.next,
        cycleLen: est.cycleLen,
        dayOfCycle,
        phase,
        periodDayCount: Object.values(state.days || {}).filter((d) => d.period).length,
      };
    }

    function snapshot() {
      const est = estimates();
      const today = state.days[todayISO()] || {};
      if (today.period) {
        return {
          label: "Period day",
          detail: "Marked for today · private on this phone",
          isPeriod: true,
          short: "Now",
        };
      }
      if (est.next) {
        const short = String(est.next).slice(5) || est.next;
        return {
          label: `Next ~ ${est.next}`,
          detail: est.cycleLen ? `Cycle ~ ${est.cycleLen} days` : "Keep marking to learn your cycle",
          isPeriod: false,
          short,
        };
      }
      return { label: "Track your cycle", detail: "Tap days on the calm calendar", isPeriod: false, short: "—" };
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
      if (typeof Today !== "undefined" && Today.render && document.body.dataset.section === "today") {
        Today.render();
      }
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
        if (getSavedToken()) {
          setStatus($("period-status"), "Saved — syncing to other phones…", "ok");
          scheduleAutoSync();
        } else {
          setStatus($("period-status"), "Saved here — add a PAT under Sync to share across phones.", "ok");
        }
      });
      $("period-save-note")?.addEventListener("click", () => {
        const note = $("period-note")?.value.trim() || "";
        const cur = state.days[selected] || { period: false };
        state.days[selected] = { ...cur, note };
        if (!state.days[selected].period && !note) delete state.days[selected];
        persist();
        render();
        if (getSavedToken()) {
          setStatus($("period-status"), "Note saved — syncing…", "ok");
          scheduleAutoSync();
        } else {
          setStatus($("period-status"), "Note saved. Add a PAT under Sync to publish.", "ok");
        }
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
      if (!cloud?.days || typeof cloud.days !== "object") return 0;
      let changed = 0;
      Object.entries(cloud.days).forEach(([key, info]) => {
        const local = state.days[key] || {};
        const next = {
          period: !!(info.period || local.period),
          note: local.note || info.note || "",
        };
        if (!next.period && !next.note) {
          if (state.days[key]) {
            delete state.days[key];
            changed += 1;
          }
          return;
        }
        const prev = JSON.stringify(local);
        const after = JSON.stringify(next);
        if (prev !== after) changed += 1;
        state.days[key] = next;
      });
      if (changed) persist();
      return changed;
    }

    function hasLocalDays() {
      return Object.keys(state.days || {}).some((k) => {
        const v = state.days[k];
        return !!(v && (v.period || v.note));
      });
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

    async function pullCloud({ quiet } = {}) {
      try {
        const token = getSavedToken();
        let data = null;
        if (token) {
          try {
            data = await githubGetJson(PERIODS_PATH, token);
          } catch (_) {
            data = null;
          }
        }
        if (!data) {
          const res = await fetch(`./${PERIODS_PATH}?t=${Date.now()}`, { cache: "no-store" });
          if (!res.ok) return 0;
          data = await res.json();
        }
        const changed = mergeCloud(data);
        render();
        return changed;
      } catch (_) {
        return 0;
      }
    }

    async function publishPeriods(statusEl, tokenOverride) {
      const token = tokenOverride || getSavedToken() || $("admin-token")?.value.trim();
      if (!token) {
        setStatus(statusEl, "Add a GitHub PAT (repo scope) — or save one in Admin.", "error");
        return false;
      }
      if (tokenOverride) localStorage.setItem(LS.token, tokenOverride);
      setStatus(statusEl, "Syncing period dates…", "info");
      try {
        try {
          const remote = await githubGetJson(PERIODS_PATH, token);
          if (remote) mergeCloud(remote);
        } catch (_) {
          await pullCloud({ quiet: true });
        }
        const payload = publishPayload();
        if (!Object.keys(payload.days || {}).length && !hasLocalDays()) {
          setStatus(statusEl, "No period dates to upload yet.", "info");
          return true;
        }
        await githubPutFile(
          PERIODS_PATH,
          b64EncodeUnicode(JSON.stringify(payload, null, 2) + "\n"),
          `Update period dates (${todayISO()})`,
          token
        );
        setStatus(statusEl, "Synced. Other devices see dates after Pages refresh (~30–60s).", "ok");
        return true;
      } catch (err) {
        setStatus(statusEl, err.message || String(err), "error");
        return false;
      }
    }

    let autoSyncTimer = 0;
    function scheduleAutoSync() {
      if (!getSavedToken()) return;
      if (autoSyncTimer) clearTimeout(autoSyncTimer);
      autoSyncTimer = setTimeout(() => {
        autoSyncTimer = 0;
        publishPeriods($("period-status"));
      }, 1600);
    }

    async function init() {
      wire();
      await pullCloud({ quiet: true });
      if ($("period-token") && getSavedToken()) {
        $("period-token").placeholder = "Token saved — paste to replace";
      }
      render();
    }

    return {
      init,
      render,
      publishPeriods,
      publishPayload,
      snapshot,
      coachSnapshot,
      pullCloud,
      hasLocalDays,
      scheduleAutoSync,
    };
  })();

  /* ───────── Weight logs ───────── */
  const Weights = (() => {
    let state = loadJSON(LS.weights, { entries: [], deletedIds: [] });
    if (!Array.isArray(state.entries)) state.entries = [];
    if (!Array.isArray(state.deletedIds)) state.deletedIds = [];
    /** @type {{name:string, kind:string}[]} */
    let suggestions = [];
    let tab = "main"; // exercise logs only

    function persist() {
      state.deletedIds = Array.isArray(state.deletedIds) ? state.deletedIds.map(String) : [];
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

    function normExercise(name) {
      return String(name || "")
        .toLowerCase()
        .replace(/[–—]/g, "-")
        .replace(/\s+/g, " ")
        .trim();
    }

    function entriesFor(name) {
      const n = normExercise(name);
      return state.entries
        .filter((e) => (e.kind || "main") === "main" && normExercise(e.exercise) === n)
        .sort((a, b) => a.date.localeCompare(b.date) || Number(a.id) - Number(b.id));
    }

    function lastFor(name) {
      const arr = entriesFor(name);
      return arr[arr.length - 1] || null;
    }

    function refreshWorkoutUi() {
      if (typeof Workout === "undefined") return;
      if (Workout.render) Workout.render();
      if (Workout.refreshSummaries) Workout.refreshSummaries();
      if (typeof Progress !== "undefined" && Progress.render && document.body.dataset.section === "today") {
        Progress.render();
      }
      if (typeof Today !== "undefined" && Today.render && document.body.dataset.section === "today") {
        /* Today.render also refreshes Progress — avoid double heavy DOM if only lifts changed */
      }
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
      refreshWorkoutUi();
      scheduleAutoSync();
    }

    function getEntry(id) {
      const key = String(id);
      return state.entries.find((e) => String(e.id) === key) || null;
    }

    function updateEntry(id, { weight, sets, reps, note, date } = {}) {
      const key = String(id);
      const idx = state.entries.findIndex((e) => String(e.id) === key);
      if (idx < 0) return false;
      const cur = state.entries[idx];
      const s = sets != null && sets !== "" ? Number(sets) : entrySets(cur);
      const r = reps != null && reps !== "" ? Number(reps) : entryReps(cur);
      const w = weight != null && weight !== "" ? Number(weight) : Number(cur.weight);
      if (!Number.isFinite(w) || !Number.isFinite(s) || !Number.isFinite(r)) return false;
      state.entries[idx] = {
        ...cur,
        weight: w,
        sets: s,
        reps: r,
        rx: `${s} × ${r}`,
        note: note != null ? note : cur.note || "",
        date: date || cur.date || todayISO(),
        kind: "main",
      };
      persist();
      refreshWorkoutUi();
      scheduleAutoSync();
      return true;
    }

    function removeEntry(id) {
      const key = String(id);
      const before = state.entries.length;
      state.entries = state.entries.filter((e) => String(e.id) !== key);
      if (state.entries.length === before) return false;
      const deleted = new Set((state.deletedIds || []).map(String));
      deleted.add(key);
      state.deletedIds = [...deleted];
      persist();
      refreshWorkoutUi();
      scheduleAutoSync();
      return true;
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
          progress.innerHTML = `<div class="empty-teach"><strong>No lifts yet</strong></div>`;
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
          : `<div class="empty-teach"><strong>No history</strong></div>`;
      }
      if (typeof Today !== "undefined" && Today.render && document.body.dataset.section === "today") {
        Today.render();
      }
    }

    function wire() {
      document.querySelectorAll("[data-logs-view]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const view = btn.getAttribute("data-logs-view");
          document.querySelectorAll("[data-logs-view]").forEach((b) => b.classList.toggle("is-active", b === btn));
          document.querySelectorAll("[data-logs-pane]").forEach((pane) => {
            pane.hidden = pane.getAttribute("data-logs-pane") !== view;
          });
        });
      });
      const goNav = (e) => {
        const a = e.target.closest("[data-nav]");
        if (!a) return;
        e.preventDefault();
        showPanel(a.getAttribute("data-nav"));
      };
      $("log-progress")?.addEventListener("click", goNav);
      $("log-history")?.addEventListener("click", goNav);
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
        setStatus($("log-status"), localStorage.getItem(LS.token) ? "Logged — syncing to other phones…" : "Logged on this phone. Add PAT under Sync to upload.", "ok");
      });
      $("log-filter")?.addEventListener("change", render);
      $("log-history")?.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-del-log]");
        if (!btn) return;
        const id = btn.getAttribute("data-del-log");
        if (!id) return;
        removeEntry(id);
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
          refreshWorkoutUi();
          setStatus($("log-status"), "Import complete.", "ok");
          scheduleAutoSync();
        } catch {
          setStatus($("log-status"), "Could not import.", "error");
        }
        e.target.value = "";
      });
      $("log-sync")?.addEventListener("click", () => {
        const raw = $("log-token")?.value.trim();
        publishWeights($("log-sync-status"), raw || undefined);
      });
      $("log-pull")?.addEventListener("click", () => pullCloud({ quiet: false }));
    }


    function coachSummary() {
      const pool = exerciseEntries()
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date) || Number(b.id) - Number(a.id));
      const since = (() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().slice(0, 10);
      })();
      const recent = pool.filter((e) => String(e.date).slice(0, 10) >= since);
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
      const days = new Set(recent.map((e) => String(e.date).slice(0, 10)));
      return {
        liftDaysLast30: days.size,
        entryCountLast30: recent.length,
        topLifts: Object.values(byEx)
          .sort((a, b) => b.sessions - a.sessions)
          .slice(0, 8),
      };
    }

    function snapshot() {
      const pool = exerciseEntries()
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date) || Number(b.id) - Number(a.id));
      return {
        count: pool.length,
        recent: pool.slice(0, 4).map((e) => ({
          exercise: e.exercise,
          weight: e.weight,
          sets: entrySets(e),
          reps: entryReps(e),
          date: e.date,
        })),
      };
    }

    function mergeCloud(cloud) {
      if (!cloud || !Array.isArray(cloud.entries)) return 0;
      const deleted = new Set([
        ...(state.deletedIds || []).map(String),
        ...(Array.isArray(cloud.deletedIds) ? cloud.deletedIds.map(String) : []),
      ]);
      const byId = new Map(
        (state.entries || [])
          .filter((e) => e && e.id != null && !deleted.has(String(e.id)))
          .map((e) => [String(e.id), e])
      );
      let added = 0;
      cloud.entries.forEach((e) => {
        if (!e || e.id == null) return;
        if ((e.kind || "main") === "stretch") return;
        const key = String(e.id);
        if (deleted.has(key) || byId.has(key)) return;
        byId.set(key, {
          id: e.id,
          exercise: e.exercise || "Move",
          weight: Number(e.weight),
          date: e.date || todayISO(),
          sets: e.sets != null ? Number(e.sets) : null,
          reps: e.reps != null ? Number(e.reps) : null,
          rx: e.rx || "",
          note: e.note || "",
          kind: "main",
        });
        added += 1;
      });
      const nextEntries = [...byId.values()];
      const nextDeleted = [...deleted];
      if (
        added ||
        nextEntries.length !== (state.entries || []).length ||
        nextDeleted.length !== (state.deletedIds || []).length
      ) {
        state.entries = nextEntries;
        state.deletedIds = nextDeleted;
        persist();
      }
      return added;
    }

    function publishPayload() {
      const deleted = new Set((state.deletedIds || []).map(String));
      return {
        version: 1,
        updatedAt: new Date().toISOString(),
        label: "Sapna lift logs — synced across her phones via Pages.",
        entries: exerciseEntries()
          .filter((e) => e && e.id != null && !deleted.has(String(e.id)))
          .map((e) => ({
            id: e.id,
            exercise: e.exercise,
            weight: e.weight,
            date: e.date,
            sets: e.sets ?? null,
            reps: e.reps ?? null,
            rx: e.rx || "",
            note: e.note || "",
            kind: "main",
          })),
        deletedIds: [...deleted],
      };
    }

    function hasLocalEntries() {
      const deleted = new Set((state.deletedIds || []).map(String));
      return (state.entries || []).some((e) => e && e.id != null && !deleted.has(String(e.id)));
    }

    async function publishWeights(statusEl, tokenOverride) {
      const token = tokenOverride || getSavedToken() || $("log-token")?.value.trim() || $("admin-token")?.value.trim();
      if (!token) {
        setStatus(statusEl, "Add a GitHub PAT (repo scope) — same as Periods / Admin.", "error");
        return false;
      }
      if (tokenOverride || $("log-token")?.value.trim()) {
        localStorage.setItem(LS.token, token);
      }
      setStatus(statusEl, "Syncing lift logs…", "info");
      try {
        /* Pull via Contents API first (fresher than Pages) so we never clobber */
        try {
          const remote = await githubGetJson(WEIGHTS_PATH, token);
          if (remote) mergeCloud(remote);
        } catch (_) {
          await pullCloud({ quiet: true });
        }
        const payload = publishPayload();
        if (!payload.entries.length && !hasLocalEntries()) {
          setStatus(statusEl, "No lift logs to upload yet.", "info");
          return true;
        }
        await githubPutFile(
          WEIGHTS_PATH,
          b64EncodeUnicode(JSON.stringify(payload, null, 2) + "\n"),
          `Update lift logs (${todayISO()})`,
          token
        );
        setStatus(
          statusEl,
          `Synced ${payload.entries.length} logs. Other phones see them after Pages refresh (~30–60s) or Refresh from cloud.`,
          "ok"
        );
        render();
        refreshWorkoutUi();
        if (typeof Today !== "undefined" && Today.render) Today.render();
        return true;
      } catch (err) {
        setStatus(statusEl, err.message || String(err), "error");
        return false;
      }
    }

    async function pullCloud({ quiet } = {}) {
      try {
        let data = null;
        const token = getSavedToken();
        if (token) {
          try {
            data = await githubGetJson(WEIGHTS_PATH, token);
          } catch (_) {
            data = null;
          }
        }
        if (!data) {
          const res = await fetch(`./${WEIGHTS_PATH}?t=${Date.now()}`, { cache: "no-store" });
          if (!res.ok) {
            if (!quiet) setStatus($("log-sync-status"), "No cloud logs yet — Sync now from a phone that has entries.", "info");
            return 0;
          }
          data = await res.json();
        }
        const added = mergeCloud(data);
        /* Always refresh Workout cards + Today — quiet pull used to skip this, so
           Recent lifts updated later while per-exercise “Last:” stayed empty. */
        render();
        refreshWorkoutUi();
        if (typeof Today !== "undefined" && Today.render) Today.render();
        if (!quiet) {
          setStatus(
            $("log-sync-status"),
            added ? `Pulled ${added} new log${added === 1 ? "" : "s"} from cloud.` : "Already up to date with cloud.",
            "ok"
          );
        }
        return added;
      } catch (err) {
        if (!quiet) setStatus($("log-sync-status"), err.message || String(err), "error");
        return 0;
      }
    }

    let autoSyncTimer = 0;
    function scheduleAutoSync() {
      if (!getSavedToken()) return;
      if (autoSyncTimer) clearTimeout(autoSyncTimer);
      autoSyncTimer = setTimeout(() => {
        autoSyncTimer = 0;
        publishWeights($("log-sync-status") || $("log-status"));
      }, 1400);
    }

    async function init() {
      // Keep exercise logs only (drop legacy stretch weight logs)
      state.entries = (state.entries || [])
        .map((e) => ({ ...e, kind: e.kind === "stretch" ? "stretch" : "main" }))
        .filter((e) => e.kind !== "stretch");
      persist();
      wire();
      if ($("log-token") && localStorage.getItem(LS.token)) {
        $("log-token").placeholder = "Token saved — paste to replace";
      }
      await pullCloud({ quiet: true });
      render();
    }

    return {
      init,
      render,
      suggestFromMoves,
      addEntry,
      getEntry,
      updateEntry,
      removeEntry,
      lastFor,
      entriesFor,
      entrySets,
      entryReps,
      allMainEntries: () => exerciseEntries(),
      snapshot,
      coachSummary,
      publishWeights,
      pullCloud,
      scheduleAutoSync,
      hasLocalEntries,
    };
  })();

  /* ───────── Progress (streak + week graph on Today) ───────── */
  const Progress = (() => {
    let selectedWeekKey = "";
    let wired = false;

    function localDayISO(d = new Date()) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    }

    function parseDay(iso) {
      const [y, m, d] = String(iso).split("-").map(Number);
      return new Date(y, (m || 1) - 1, d || 1);
    }

    function addDays(iso, n) {
      const d = parseDay(iso);
      d.setDate(d.getDate() + n);
      return localDayISO(d);
    }

    function mondayOf(iso) {
      const d = parseDay(iso);
      const day = d.getDay(); // 0 Sun
      const diff = day === 0 ? -6 : 1 - day;
      d.setDate(d.getDate() + diff);
      return localDayISO(d);
    }

    function liftEntries() {
      try {
        return Weights.allMainEntries ? Weights.allMainEntries() : [];
      } catch {
        return [];
      }
    }

    function liftDaySet() {
      const set = new Set();
      liftEntries().forEach((e) => {
        if (e?.date) set.add(String(e.date).slice(0, 10));
      });
      return set;
    }

    function dailyStreak(daySet) {
      let cursor = localDayISO();
      if (!daySet.has(cursor)) {
        const yday = addDays(cursor, -1);
        if (!daySet.has(yday)) return 0;
        cursor = yday;
      }
      let n = 0;
      while (daySet.has(cursor)) {
        n += 1;
        cursor = addDays(cursor, -1);
      }
      return n;
    }

    function weekKeyStreak(daySet) {
      /* consecutive Mon–Sun weeks with ≥1 lift day */
      let weekStart = mondayOf(localDayISO());
      const thisWeekHas = [...daySet].some((d) => mondayOf(d) === weekStart);
      if (!thisWeekHas) {
        const prev = addDays(weekStart, -7);
        const prevHas = [...daySet].some((d) => mondayOf(d) === prev);
        if (!prevHas) return 0;
        weekStart = prev;
      }
      let n = 0;
      while (true) {
        const has = [...daySet].some((d) => mondayOf(d) === weekStart);
        if (!has) break;
        n += 1;
        weekStart = addDays(weekStart, -7);
      }
      return n;
    }

    function monthCells(daySet) {
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth();
      const first = new Date(y, m, 1);
      const startPad = (first.getDay() + 6) % 7; // Mon-first
      const daysInMonth = new Date(y, m + 1, 0).getDate();
      const cells = [];
      for (let i = 0; i < startPad; i++) cells.push({ empty: true });
      for (let d = 1; d <= daysInMonth; d++) {
        const iso = localDayISO(new Date(y, m, d));
        const count = liftEntries().filter((e) => String(e.date).slice(0, 10) === iso).length;
        cells.push({
          empty: false,
          date: iso,
          day: d,
          active: daySet.has(iso),
          multi: count >= 2,
          isToday: iso === localDayISO(),
        });
      }
      return {
        label: now.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
        cells,
      };
    }

    function weekSeries(weeks = 12) {
      const entries = liftEntries();
      const endMonday = mondayOf(localDayISO());
      const series = [];
      for (let i = weeks - 1; i >= 0; i--) {
        const start = addDays(endMonday, -7 * i);
        const end = addDays(start, 6);
        const inWeek = entries.filter((e) => {
          const d = String(e.date || "").slice(0, 10);
          return d >= start && d <= end;
        });
        const days = new Set(inWeek.map((e) => String(e.date).slice(0, 10)));
        let sets = 0;
        let volume = 0;
        inWeek.forEach((e) => {
          const s = Weights.entrySets(e);
          const r = Weights.entryReps(e);
          const w = Number(e.weight) || 0;
          if (Number.isFinite(s)) sets += s;
          if (Number.isFinite(s) && Number.isFinite(r)) volume += w * s * r;
        });
        series.push({
          key: start,
          start,
          end,
          label: parseDay(start).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          sessions: days.size,
          lifts: inWeek.length,
          sets,
          volume: Math.round(volume),
        });
      }
      return series;
    }

    function dietStreak() {
      const map = Diet.dietLoggedDates ? Diet.dietLoggedDates() : {};
      const set = new Set(Object.keys(map).filter((k) => map[k]));
      return dailyStreak(set);
    }

    function estimateLiftBurnKcal() {
      const today = localDayISO();
      const entries = liftEntries().filter((e) => String(e.date || "").slice(0, 10) === today);
      let kcal = 0;
      entries.forEach((e) => {
        const s = Weights.entrySets(e);
        const r = Weights.entryReps(e);
        const w = Number(e.weight) || 0;
        const sets = Number.isFinite(s) && s > 0 ? s : 1;
        const reps = Number.isFinite(r) && r > 0 ? r : 10;
        if (w > 0) kcal += sets * reps * w * 0.05;
        else kcal += sets * 8;
      });
      if (!entries.length) {
        try {
          const snap = Workout.snapshot ? Workout.snapshot() : null;
          if (snap?.liftsLogged) kcal = snap.liftsLogged * 40;
        } catch (_) {}
      } else {
        kcal += 25; /* session overhead */
      }
      return Math.round(Math.max(0, Math.min(kcal, 1200)));
    }

    function estimateBurnKcal() {
      const lifts = estimateLiftBurnKcal();
      const steps =
        typeof Diet !== "undefined" && Diet.estimateStepBurnKcal ? Diet.estimateStepBurnKcal() : 0;
      return Math.round(Math.max(0, Math.min(lifts + steps, 2500)));
    }

    function chartSvg(series, selectedKey) {
      const w = 320;
      const h = 96;
      const pad = { t: 10, r: 8, b: 22, l: 8 };
      const maxV = Math.max(1, ...series.map((s) => s.sessions));
      const bw = (w - pad.l - pad.r) / series.length;
      const bars = series
        .map((s, i) => {
          const bh = ((s.sessions / maxV) * (h - pad.t - pad.b)) || 0;
          const x = pad.l + i * bw + bw * 0.18;
          const y = h - pad.b - bh;
          const barW = bw * 0.64;
          const on = s.key === selectedKey;
          return `<g class="prog-bar ${on ? "is-on" : ""}" data-week="${escapeHtml(s.key)}">
            <rect class="prog-bar-hit" x="${(pad.l + i * bw).toFixed(1)}" y="${pad.t}" width="${bw.toFixed(1)}" height="${(h - pad.t - pad.b).toFixed(1)}" />
            <rect class="prog-bar-fill" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(bh, s.sessions ? 3 : 0).toFixed(1)}" rx="4" />
            <text class="prog-bar-label" x="${(pad.l + i * bw + bw / 2).toFixed(1)}" y="${h - 8}" text-anchor="middle">${escapeHtml(String(parseDay(s.start).getDate()))}</text>
          </g>`;
        })
        .join("");
      const linePts = series
        .map((s, i) => {
          const bh = (s.sessions / maxV) * (h - pad.t - pad.b);
          const x = pad.l + i * bw + bw / 2;
          const y = h - pad.b - bh;
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ");
      return `<svg class="prog-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Sessions logged per week">
        <polyline class="prog-line" points="${linePts}" fill="none" />
        ${bars}
      </svg>`;
    }

    function summaryHtml(week) {
      if (!week) return `<p class="hint">Tap a week on the graph.</p>`;
      const range = `${week.label} – ${parseDay(week.end).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
      return `<div class="prog-week-summary">
        <p class="prog-week-range">${escapeHtml(range)}</p>
        <div class="prog-week-metrics">
          <div><em>Sessions</em><strong>${week.sessions}</strong></div>
          <div><em>Lifts logged</em><strong>${week.lifts}</strong></div>
          <div><em>Sets</em><strong>${week.sets}</strong></div>
          <div><em>Volume</em><strong>${week.volume ? week.volume + " kg·rep" : "—"}</strong></div>
        </div>
      </div>`;
    }

    function render() {
      const streakRoot = $("progress-root");
      const graphRoot = $("progress-graph-root");
      if (!streakRoot && !graphRoot) return;
      const daySet = liftDaySet();
      const streakDays = dailyStreak(daySet);
      const streakWeeks = weekKeyStreak(daySet);
      const month = monthCells(daySet);
      const series = weekSeries(12);
      if (!selectedWeekKey || !series.some((s) => s.key === selectedWeekKey)) {
        selectedWeekKey = series[series.length - 1]?.key || "";
      }
      const selected = series.find((s) => s.key === selectedWeekKey) || series[series.length - 1];
      const dietN = dietStreak();
      const burn = estimateBurnKcal();
      const liftBurn = estimateLiftBurnKcal();
      const dietSnap = Diet.snapshot
        ? Diet.snapshot()
        : { kcal: 0, targetKcal: 1300, left: 0, stepBurn: 0, steps: 0 };
      const eaten = Math.round(dietSnap.kcal || 0);
      const dietGoal = Math.round(dietSnap.targetKcal || 1300);
      const left = dietSnap.left != null ? dietSnap.left : Math.max(0, dietGoal - eaten);
      const stepBurn = Math.round(dietSnap.stepBurn || 0);
      const dietPct = Math.max(0, Math.min(100, Math.round((eaten / (dietGoal || 1)) * 100)));
      const burnHint = stepBurn
        ? `lifts ${liftBurn || 0} + walk ${stepBurn}`
        : burn
          ? "kcal est."
          : "log lifts / steps";

      if (streakRoot) {
        streakRoot.innerHTML = `
        <section class="prog-card prog-streak-card prog-summary-card">
          <div class="prog-summary-metrics" aria-label="Today summary">
            <div class="prog-metric">
              <em>Streak</em>
              <strong>${streakDays}</strong>
              <span>day${streakDays === 1 ? "" : "s"} · ${streakWeeks ? `${streakWeeks}w` : "start"}</span>
            </div>
            <div class="prog-metric">
              <em>Burned</em>
              <strong>${burn || "—"}</strong>
              <span>${escapeHtml(burnHint)}</span>
            </div>
            <div class="prog-metric">
              <em>Diet taken</em>
              <strong>${eaten}</strong>
              <span>/ ${dietGoal} kcal · ${dietPct}%</span>
            </div>
            <div class="prog-metric">
              <em>${dietSnap.over ? "Over" : "Left"}</em>
              <strong>${dietSnap.over ? Math.round(eaten - dietGoal) : left}</strong>
              <span>kcal · need ${dietGoal}</span>
            </div>
          </div>
          <div class="prog-streak-head">
            <div class="prog-flame" aria-hidden="true">✦</div>
            <div>
              <p class="prog-kicker">Workout streak</p>
              <p class="prog-streak-count"><strong>${streakDays}</strong> <span>day${streakDays === 1 ? "" : "s"}</span></p>
              <p class="prog-streak-sub">${streakWeeks ? `${streakWeeks} week${streakWeeks === 1 ? "" : "s"} with a lift` : "Log a lift to start"}</p>
              <p class="prog-streak-diet">${dietN ? `Diet logged ${dietN} day${dietN === 1 ? "" : "s"}` : "No diet log streak yet"}</p>
            </div>
          </div>
          <div class="prog-diet-mini" aria-hidden="true">
            <div class="hf-bar"><i style="width:${dietPct}%"></i></div>
          </div>
          <p class="prog-month-label">${escapeHtml(month.label)}</p>
          <div class="prog-dow" aria-hidden="true"><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span></div>
          <div class="prog-month-grid">
            ${month.cells
              .map((c) => {
                if (c.empty) return `<span class="prog-day is-empty"></span>`;
                return `<span class="prog-day ${c.active ? "is-active" : ""} ${c.multi ? "is-multi" : ""} ${c.isToday ? "is-today" : ""}" title="${escapeHtml(c.date)}">${c.day}</span>`;
              })
              .join("")}
          </div>
        </section>`;
      }

      if (graphRoot) {
        graphRoot.innerHTML = `
        <section class="prog-card prog-graph-card" id="prog-graph-details">
          <div class="prog-graph-head">
            <div>
              <p class="prog-kicker">Progress</p>
              <h2 class="prog-graph-title">Sessions · 12 weeks</h2>
            </div>
            <p class="prog-graph-hint">Tap a week</p>
          </div>
          <div class="prog-graph-body">
            ${chartSvg(series, selectedWeekKey)}
            <div id="prog-week-detail">${summaryHtml(selected)}</div>
          </div>
        </section>`;
      }
      wire();
    }

    function wire() {
      const graphRoot = $("progress-graph-root");
      if (!graphRoot) return;
      graphRoot.querySelectorAll("[data-week]").forEach((g) => {
        g.addEventListener("click", () => {
          selectedWeekKey = g.getAttribute("data-week") || "";
          render();
          $("prog-week-detail")?.scrollIntoView({ block: "end", behavior: "smooth" });
        });
      });
    }

    return { render };
  })();

  /* ───────── GitHub Contents helpers ───────── */
  function b64EncodeUnicode(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  function b64DecodeUnicode(b64) {
    return decodeURIComponent(escape(atob(String(b64 || "").replace(/\n/g, ""))));
  }

  async function githubGetJson(path, token) {
    const api = `https://api.github.com/repos/${REPO.owner}/${REPO.name}/contents/${path}?ref=${REPO.branch}`;
    const headers = { Accept: "application/vnd.github+json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(api, { headers, cache: "no-store" });
    if (res.status === 404) return null;
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `GitHub ${res.status}`);
    }
    const meta = await res.json();
    if (!meta.content) return null;
    try {
      return JSON.parse(b64DecodeUnicode(meta.content));
    } catch {
      return null;
    }
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

  function getSavedToken() {
    return (localStorage.getItem(LS.token) || "").trim();
  }

  function setKeyBadge(id, kind, label) {
    const el = $(id);
    if (!el) return;
    if (!kind) {
      el.hidden = true;
      el.textContent = "";
      el.className = "key-badge";
      return;
    }
    el.hidden = false;
    el.textContent = label || (kind === "ok" ? "✓ Working" : kind === "error" ? "Invalid" : "Checking…");
    el.className = "key-badge is-" + kind;
  }

  function resolveAdminToken() {
    const typed = ($("admin-token")?.value || "").trim();
    if (typed && !typed.startsWith("••")) return typed;
    return (localStorage.getItem(LS.token) || "").trim();
  }

  async function validateGithubToken(token) {
    if (!token || token.length < 20) {
      return { ok: false, message: "Token looks too short." };
    }
    try {
      const res = await fetch(`https://api.github.com/repos/${REPO.owner}/${REPO.name}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
      });
      if (res.status === 401 || res.status === 403) {
        return { ok: false, message: "GitHub rejected this token (check repo scope)." };
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { ok: false, message: err.message || `GitHub ${res.status}` };
      }
      return { ok: true, message: "Token works for sapna-health." };
    } catch (err) {
      return { ok: false, message: err.message || "Could not reach GitHub." };
    }
  }

  function forceAdminOverlay(el) {
    if (!el) return;
    el.hidden = false;
    el.removeAttribute("hidden");
    el.classList.add("is-open");
    el.style.cssText =
      "display:flex !important; position:fixed !important; inset:0 !important; z-index:100060 !important; opacity:1 !important; visibility:visible !important; pointer-events:auto !important; background:rgba(12,22,20,0.72) !important;";
    if (window.SapnaKeyboard?.pinOverlayToVv) window.SapnaKeyboard.pinOverlayToVv(el);
    document.body.classList.add("modal-open");
    /* Keep page content from receiving taps under the sheet */
    document.querySelectorAll(".panel, .site-nav, .atmosphere").forEach((node) => {
      if (node) node.style.pointerEvents = "none";
    });
  }

  function releaseAdminOverlayLocks() {
    document.querySelectorAll(".panel, .site-nav, .atmosphere").forEach((node) => {
      if (node) node.style.pointerEvents = "";
    });
  }

  function wireAdmin() {
    /* Admin FAB uses head onclick=sapnaAdminOpen — do not double-bind here */
    $("admin-close")?.addEventListener("click", () => {
      const ed = $("admin-editor");
      if (ed) {
        ed.hidden = true;
        ed.setAttribute("hidden", "");
        ed.classList.remove("is-open");
        ed.style.cssText = "";
      }
      document.body.classList.remove("modal-open");
      releaseAdminOverlayLocks();
    });

    $("admin-editor")?.addEventListener("click", (e) => {
      if (e.target === $("admin-editor")) {
        $("admin-close")?.click();
      }
    });


    $("admin-save-token")?.addEventListener("click", async () => {
      const btn = $("admin-save-token");
      let token = ($("admin-token")?.value || "").trim();
      if (!token || token.startsWith("••")) {
        token = (localStorage.getItem(LS.token) || "").trim();
      }
      if (!token) {
        setKeyBadge("admin-token-badge", "error", "Missing");
        setStatus($("admin-status"), "Paste a GitHub PAT first (repo scope).", "error");
        return;
      }
      if (btn) btn.disabled = true;
      setKeyBadge("admin-token-badge", "info", "Checking…");
      setStatus($("admin-status"), "Testing GitHub token…", "info");
      const result = await validateGithubToken(token);
      if (btn) btn.disabled = false;
      if (!result.ok) {
        setKeyBadge("admin-token-badge", "error", "Invalid");
        setStatus($("admin-status"), result.message, "error");
        return;
      }
      localStorage.setItem(LS.token, token);
      if ($("admin-token")) {
        $("admin-token").value = "";
        $("admin-token").placeholder = "Token saved — paste to replace";
      }
      TokenSetup.applyPlaceholders();
      setKeyBadge("admin-token-badge", "ok", "✓ Working");
      setStatus($("admin-status"), result.message + " Syncing this phone…", "info");
      await CloudSync.afterTokenSaved($("admin-status"));
    });

    $("admin-start-fresh")?.addEventListener("click", () => {
      const ok = window.confirm(
        "Start fresh on this phone?\n\nClears local profile, diet checks, lift/period caches, guided session, and admin unlock on this device only. GitHub data is unchanged. The page will reload."
      );
      if (!ok) return;
      try {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k) continue;
          if (LS_FRESH_PREFIXES.some((p) => k.startsWith(p))) keys.push(k);
        }
        keys.forEach((k) => localStorage.removeItem(k));
      } catch (_) {}
      try {
        [
          "sapna_admin_unlocked",
          "sapna_profile_skip_session",
          "sapna_token_setup_later",
          "sapna_gemini_tested",
        ].forEach((k) => sessionStorage.removeItem(k));
      } catch (_) {}
      setStatus($("admin-fresh-status"), "Cleared — reloading…", "ok");
      setTimeout(() => {
        try {
          location.reload();
        } catch (_) {
          location.href = location.pathname + location.search + "#today";
        }
      }, 350);
    });


    $("admin-publish")?.addEventListener("click", async () => {
      const token = resolveAdminToken();
      if (!token) {
        setStatus($("admin-status"), "Save a GitHub token first (repo scope).", "error");
        setKeyBadge("admin-token-badge", "warn", "Needed");
        return;
      }
      const payload = {
        version: 1,
        updatedAt: todayISO(),
        targets: {
          kcal: Number($("admin-kcal").value) || 1300,
          protein: Number($("admin-protein").value) || 100,
        },
        note: "Published defaults for Sapna Health. Period/weight logs are synced separately.",
      };
      setStatus($("admin-status"), "Posting diet defaults…", "info");
      try {
        await githubPutFile(
          DIET_DEFAULTS_PATH,
          b64EncodeUnicode(JSON.stringify(payload, null, 2) + "\n"),
          `Update diet defaults (${todayISO()})`,
          token
        );
        setKeyBadge("admin-token-badge", "ok", "✓ Working");
        setStatus($("admin-status"), "Diet defaults posted. Pages updates in ~30–60s.", "ok");
      } catch (err) {
        setKeyBadge("admin-token-badge", "error", "Failed");
        setStatus($("admin-status"), err.message || String(err), "error");
      }
    });

    $("admin-publish-periods")?.addEventListener("click", async () => {
      const token = resolveAdminToken();
      if (!token) {
        setStatus($("admin-status"), "Save a GitHub token first (repo scope).", "error");
        setKeyBadge("admin-token-badge", "warn", "Needed");
        return;
      }
      setStatus($("admin-status"), "Posting period dates…", "info");
      const ok = await Periods.publishPeriods($("admin-status"), token);
      if (ok) setKeyBadge("admin-token-badge", "ok", "✓ Working");
      else setKeyBadge("admin-token-badge", "error", "Failed");
    });

    $("admin-publish-weights")?.addEventListener("click", async () => {
      const token = resolveAdminToken();
      if (!token) {
        setStatus($("admin-status"), "Save a GitHub token first (repo scope).", "error");
        setKeyBadge("admin-token-badge", "warn", "Needed");
        return;
      }
      setStatus($("admin-status"), "Posting lift logs…", "info");
      const ok = await Weights.publishWeights($("admin-status"), token);
      if (ok) setKeyBadge("admin-token-badge", "ok", "✓ Working");
      else setKeyBadge("admin-token-badge", "error", "Failed");
    });

    window.__sapnaOpenHealthAdmin = () => {
      syncAdminUi();
      forceAdminOverlay($("admin-editor"));
      const t = Diet.getTargetsForAdmin();
      if ($("admin-kcal")) $("admin-kcal").value = t.kcal;
      if ($("admin-protein")) $("admin-protein").value = t.protein;
      if ($("diet-edit-kcal") && !$("diet-edit-kcal").value) $("diet-edit-kcal").value = t.kcal;
      if ($("diet-edit-protein") && !$("diet-edit-protein").value) $("diet-edit-protein").value = t.protein;
      if ($("admin-token")) {
        $("admin-token").value = "";
        if (localStorage.getItem(LS.token)) {
          $("admin-token").placeholder = "Token saved — paste to replace";
          setKeyBadge("admin-token-badge", "info", "Saved");
        } else {
          $("admin-token").placeholder = "ghp_…";
          setKeyBadge("admin-token-badge", null);
        }
      }
      if (typeof GeminiKeyUI !== "undefined") GeminiKeyUI.syncPanels();
      Coach.paint();
      setStatus($("admin-status"), "Admin ready — test token / Gemini or post to Pages.", "info");
      const sheet = $("admin-editor")?.querySelector(".admin-sheet");
      if (sheet) sheet.scrollTop = 0;
    };

    /* Patch head open helpers to use opaque force overlay */
    const prevShow = window.sapnaAdminShowEditor;
    window.sapnaAdminShowEditor = function () {
      window.sapnaAdminDismissTokenSetup();
      window.sapnaAdminCloseGate();
      forceAdminOverlay($("admin-editor"));
      if (typeof window.__sapnaOpenHealthAdmin === "function") {
        try {
          window.__sapnaOpenHealthAdmin();
        } catch (e) {}
      } else if (typeof prevShow === "function") {
        try {
          prevShow();
        } catch (e) {}
      }
      return false;
    };
  }

  /* ───────── Cross-device sync orchestrator ───────── */
  const CloudSync = (() => {
    async function pullAll() {
      await Promise.all([
        Weights.pullCloud({ quiet: true }).catch(() => 0),
        Diet.pullChecks({ quiet: true }).catch(() => 0),
        Periods.pullCloud({ quiet: true }).catch(() => 0),
        Profile.pullBasics({ quiet: true }).catch(() => false),
      ]);
    }

    async function pushLocals(statusEl) {
      const token = getSavedToken();
      if (!token) return { ok: false, message: "No PAT saved." };
      const results = [];
      if (Weights.hasLocalEntries()) {
        results.push(["weights", await Weights.publishWeights(statusEl, token)]);
      }
      if (Diet.hasLocalChecks()) {
        results.push(["diet", await Diet.publishChecks(statusEl, token)]);
      }
      if (Periods.hasLocalDays()) {
        results.push(["periods", await Periods.publishPeriods(statusEl, token)]);
      }
      if (Profile.shouldPublishBasics()) {
        const pub = await Profile.maybePublishBasics();
        results.push(["profile", !!(pub && pub.ok)]);
      }
      return { ok: results.every(([, v]) => v), results };
    }

    /** After PAT save: merge remote, then upload anything this phone already has. */
    async function afterTokenSaved(statusEl) {
      setStatus(statusEl, "Connecting — pulling then uploading this phone’s data…", "info");
      try {
        await pullAll();
        const pushed = await pushLocals(statusEl);
        const n = (pushed.results || []).filter(([, ok]) => ok).length;
        if (n) {
          setStatus(
            statusEl,
            `Synced ${n} data set${n === 1 ? "" : "s"} to GitHub. Other phones: open the plain link + paste the same PAT once.`,
            "ok"
          );
        } else {
          setStatus(
            statusEl,
            "Token saved. No local logs yet — future saves sync automatically. Published plans load without a token.",
            "ok"
          );
        }
        if (typeof Today !== "undefined" && Today.render) Today.render();
        if (typeof Workout !== "undefined" && Workout.render) Workout.render();
        if (typeof Diet !== "undefined" && Diet.render) Diet.render();
        if (typeof Periods !== "undefined" && Periods.render) Periods.render();
        if (typeof Weights !== "undefined" && Weights.render) Weights.render();
        if (typeof Profile !== "undefined" && Profile.paintSummaries) Profile.paintSummaries();
        try {
          if (typeof TokenSetup !== "undefined" && TokenSetup.markSynced) TokenSetup.markSynced();
        } catch (_) {}
        return true;
      } catch (e) {
        setStatus(statusEl, e.message || String(e), "error");
        return false;
      }
    }

    /** Boot: always pull public/API JSON; if PAT present, upload local-only data. */
    async function boot() {
      await pullAll();
      if (!getSavedToken()) {
        try {
          if (typeof TokenSetup !== "undefined" && TokenSetup.paintStatus) TokenSetup.paintStatus();
        } catch (_) {}
        return;
      }
      await pushLocals(null);
      try {
        if (typeof TokenSetup !== "undefined" && TokenSetup.markSynced) TokenSetup.markSynced();
      } catch (_) {}
    }

    return { pullAll, pushLocals, afterTokenSaved, boot };
  })();

  /* ───────── GitHub sync token setup (required for same data across phones) ───────── */
  const TokenSetup = (() => {
    const LS_LAST_SYNC = "sapna_last_sync_at";
    const SS_SNOOZE = "sapna_token_setup_snooze_until";
    const SNOOZE_MS = 3 * 60 * 1000; /* Browse offline only pauses the modal briefly */

    function hasToken() {
      return !!getSavedToken();
    }

    function snoozed() {
      try {
        const until = Number(sessionStorage.getItem(SS_SNOOZE) || 0);
        return Number.isFinite(until) && Date.now() < until;
      } catch (_) {
        return false;
      }
    }

    function clearSnooze() {
      try {
        sessionStorage.removeItem(SS_SNOOZE);
        sessionStorage.removeItem("sapna_token_setup_later");
      } catch (_) {}
    }

    function markSynced() {
      try {
        localStorage.setItem(LS_LAST_SYNC, new Date().toISOString());
      } catch (_) {}
      paintStatus();
    }

    function lastSyncedLabel() {
      try {
        const raw = localStorage.getItem(LS_LAST_SYNC);
        if (!raw) return null;
        const t = Date.parse(raw);
        if (!Number.isFinite(t)) return null;
        return new Date(t).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });
      } catch (_) {
        return null;
      }
    }

    function paintStatus() {
      const connected = hasToken();
      const last = lastSyncedLabel();
      ["sync-connect-banner", "diet-sync-connect-banner"].forEach((id) => {
        const el = $(id);
        if (!el) return;
        el.hidden = connected;
      });
      ["sync-status-line", "diet-sync-status-line"].forEach((id) => {
        const el = $(id);
        if (!el) return;
        if (!connected) {
          el.hidden = true;
          el.textContent = "";
          return;
        }
        el.hidden = false;
        el.textContent = last
          ? `GitHub sync connected · last synced ${last}`
          : "GitHub sync connected · waiting for first sync…";
      });
    }

    function applyPlaceholders() {
      ["log-token", "period-token", "admin-token"].forEach((id) => {
        const el = $(id);
        if (el && hasToken()) el.placeholder = "Token saved — paste to replace";
      });
      paintStatus();
    }

    function close() {
      const overlay = $("token-setup");
      if (!overlay) return;
      overlay.hidden = true;
      overlay.classList.remove("is-open");
      overlay.style.cssText = "";
      document.body.classList.remove("modal-open", "token-setup-open");
      paintStatus();
    }

    function open(opts = {}) {
      if (hasToken() && !opts.force) {
        paintStatus();
        return;
      }
      const overlay = $("token-setup");
      if (!overlay) return;
      overlay.hidden = false;
      overlay.classList.add("is-open");
      overlay.style.cssText = "display:flex !important;";
      document.body.classList.add("modal-open", "token-setup-open");
      const input = $("token-setup-input");
      if (input) input.value = "";
      setStatus($("token-setup-status"), "");
      if (window.SapnaKeyboard?.pinOverlayToVv) window.SapnaKeyboard.pinOverlayToVv(overlay);
    }

    async function save() {
      const raw = ($("token-setup-input")?.value || "").trim();
      if (!raw) {
        setStatus($("token-setup-status"), "Paste your GitHub sync token first.", "error");
        return false;
      }
      if (raw.length < 20) {
        setStatus(
          $("token-setup-status"),
          "That doesn’t look like a GitHub token. Use a GitHub PAT (ghp_…), not a GPT key.",
          "error"
        );
        return false;
      }
      const result = await validateGithubToken(raw);
      if (!result.ok) {
        setStatus($("token-setup-status"), result.message || "GitHub rejected that token.", "error");
        return false;
      }
      localStorage.setItem(LS.token, raw);
      clearSnooze();
      applyPlaceholders();
      setStatus($("token-setup-status"), "GitHub token OK — pulling then uploading…", "info");
      const ok = await CloudSync.afterTokenSaved($("token-setup-status"));
      if (ok) markSynced();
      else paintStatus();
      setTimeout(close, ok ? 900 : 1600);
      return ok;
    }

    function later() {
      try {
        sessionStorage.setItem(SS_SNOOZE, String(Date.now() + SNOOZE_MS));
      } catch (_) {}
      close();
      paintStatus();
      setTimeout(() => {
        if (!hasToken()) open();
      }, SNOOZE_MS + 500);
    }

    function promptIfNeeded() {
      wire();
      applyPlaceholders();
      if (hasToken()) return;
      if (snoozed()) {
        paintStatus();
        return;
      }
      open();
    }

    function promptOnSection(section) {
      paintStatus();
      if (hasToken()) return;
      if (section === "today" || section === "diet") {
        if (!snoozed()) open();
      }
    }

    let wired = false;
    function wire() {
      if (wired) return;
      wired = true;
      $("token-setup-save")?.addEventListener("click", () => save());
      $("token-setup-later")?.addEventListener("click", () => later());
      $("token-setup-input")?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          save();
        }
      });
      ["sync-connect-open", "diet-sync-connect-open"].forEach((id) => {
        $(id)?.addEventListener("click", () => {
          clearSnooze();
          open({ force: true });
        });
      });
    }

    return {
      promptIfNeeded,
      promptOnSection,
      applyPlaceholders,
      hasToken,
      paintStatus,
      markSynced,
      open,
      close,
    };
  })();

  async function init() {
    syncAdminUi();
    window.Diet = Diet;
    window.Gemini = Gemini;
    window.PuterGrok = PuterGrok;
    window.AiBridge = AiBridge;
    SapnaKeyboard.install();
    wireNav();
    wireAdmin();
    try {
      if (window.SapnaPlanAdmin?.wire) window.SapnaPlanAdmin.wire();
      if (window.SapnaPlanAdmin?.boot) await window.SapnaPlanAdmin.boot();
    } catch (err) {
      console.error("Plan admin failed to wire", err);
    }
    try {
      if (window.SapnaDietAdmin?.wire) window.SapnaDietAdmin.wire();
      if (window.SapnaDietAdmin?.boot) await window.SapnaDietAdmin.boot();
    } catch (err) {
      console.error("Diet admin failed to wire", err);
    }
    /* Require GitHub sync token on a fresh phone — same data everywhere */
    TokenSetup.promptIfNeeded();
    await Weights.init();
    await Diet.init();
    await Periods.init();
    await Workout.init();
    GeminiKeyUI.wire();
    Coach.wire();
    Profile.init();
    try {
      await Profile.bootSync();
    } catch (_) {}
    /* If PAT already saved: upload any local-only data that never reached the repo */
    try {
      await CloudSync.boot();
    } catch (err) {
      console.warn("CloudSync boot", err);
    }
    /* Re-apply per-exercise Last: lines after plan + cloud weights are both ready */
    if (Workout.refreshSummaries) Workout.refreshSummaries();
    else Workout.render();
    syncAdminUi();
    showPanel(location.hash.replace(/^#/, "") || "today");
  }

  init();
})();
