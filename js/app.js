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
  };
  const REPO = { owner: "drishabhh", name: "sapna-health", branch: "main" };
  const DIET_DEFAULTS_PATH = "data/diet-defaults.json";
  const PERIODS_PATH = "data/periods.json";
  const WEIGHTS_PATH = "data/weights.json";
  const PROFILE_PATH = "data/profile.json";
  const PROFILE_ASSET_V = "20261011diet1";
  const DIET_TODAY_PATH = "data/diet-today.json";
  const DIET_CHECKS_PATH = "data/diet-checks.json";

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
    if (id === "today") Today.render();
    if (id === "workout") Workout.render();
    if (id === "diet") Diet.render();
    if (id === "periods") Periods.render();
    if (id === "logs") Weights.render();
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
      const diet = Diet.snapshot ? Diet.snapshot() : { kcal: 0, protein: 0, targetKcal: 1800, targetProtein: 100 };
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
      const greet =
        now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";

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
        : `<p class="empty-teach">No lifts logged yet — finish a session and tap <strong>LOG</strong>.</p>`;

      const periodTone = period.isPeriod ? "rose" : "soft";
      const strip = $("today-strip");
      if (strip) {
        strip.innerHTML = `
        <div class="dash-strip" aria-label="Today at a glance">
          <button type="button" class="dash-pill" data-nav="workout">
            <em>Workout</em>
            <strong>${workout.liftsTotal ? `${workout.liftsLogged}/${workout.liftsTotal}` : "—"}</strong>
            <span>${workout.liftsTotal ? "lifts logged" : "plan ready"}</span>
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
            <span class="dash-badge">${liftPct}%</span>
          </div>
          <h2>${escapeHtml(workout.title)}</h2>
          <p>${escapeHtml(workout.detail)}</p>
          ${barHtml("Session lifts", workout.liftsLogged || 0, workout.liftsTotal || 0, "gold")}
          <div class="dash-meta-row">
            <span>${Number(workout.stretchCount) || 0} stretches</span>
            <span>${Number(workout.liftsTotal) || 0} lifts in plan</span>
          </div>
          <span class="today-cta">Open session</span>
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
          <span class="gif-preview-hint">Tap to enlarge</span>
        </button>`;
      }
      const src = absoluteGif(move.gif || "media/bodyweight-squats.gif");
      return `<button type="button" class="gif-preview" data-gif-open data-gif-src="${escapeHtml(src)}" aria-label="Enlarge form demo for ${escapeHtml(name)}">
        <span class="gif-preview-frame">
          <img data-src="${escapeHtml(src)}" alt="" width="320" height="140" decoding="async" />
        </span>
        <span class="gif-preview-hint">Tap to enlarge</span>
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

    function cardHtml(move) {
      const name = move.name || "Move";
      const isStretch = move.kind === "stretch";
      const gif = gifPreviewHtml(move);
      if (isStretch) {
        return `<article class="move-log-card is-stretch" data-move="${escapeHtml(name)}" data-kind="stretch">
          <p class="move-title">${escapeHtml(name)}</p>
          <p class="move-rx">${escapeHtml(move.rx || "Easy and controlled")} · no weight log</p>
          ${remarksHtml(move)}
          ${gif}
        </article>`;
      }
      return `<article class="move-log-card" data-move="${escapeHtml(name)}" data-kind="main">
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
        if (status) status.textContent = "No plan yet — open Admin → Edit current plan.";
        root.innerHTML = `<p class="hint">Admin → <strong>Edit current plan</strong> to add stretches and lifts.</p>`;
        return;
      }
      const { stretch, main } = movesByKind();
      if (status) {
        status.textContent = plan.headline
          ? `${plan.headline} — Stretch (view) → tap LOG on lifts.`
          : "Stretch (view) → tap LOG on lifts.";
      }
      let html = "";
      if (stretch.length) {
        html += `<div class="move-group session-stretch" id="session-stretch"><h2>1 · Stretching <span class="move-group-tag">view only</span></h2>${stretch.map(cardHtml).join("")}</div>`;
      }
      if (main.length) {
        html += `<div class="move-group session-lifts" id="session-lifts"><h2>2 · Exercise <span class="move-group-tag">tap LOG</span></h2>${main.map(cardHtml).join("")}</div>`;
      }
      if (!html) html = `<p class="hint">No moves in today’s plan.</p>`;
      root.innerHTML = html;
      wireGifLightbox();
      wireGifLazyLoad(root);
      refreshCardSummaries();
      updateSessionSteps();
    }

    function updateSessionSteps() {
      const { stretch, main } = movesByKind();
      const logged = main.filter((m) => Weights.lastFor(m.name)).length;
      const anyLog = logged > 0;
      const allDone = main.length > 0 && logged >= main.length;
      document.querySelectorAll(".session-step").forEach((el) => {
        const step = el.getAttribute("data-step");
        el.classList.remove("is-active", "is-done");
        if (step === "stretch") {
          el.classList.add(anyLog || !stretch.length ? "is-done" : "is-active");
        } else if (step === "lift") {
          if (allDone) el.classList.add("is-done");
          else if (anyLog || !stretch.length) el.classList.add("is-active");
        } else if (step === "done" && allDone) {
          el.classList.add("is-active", "is-done");
        }
      });
      const bar = $("session-done-bar");
      if (bar) {
        bar.hidden = !allDone;
        if (allDone) {
          bar.querySelector("p").innerHTML =
            `<strong>Session complete.</strong> ${logged}/${main.length} lifts logged on this phone.`;
        }
      }
    }

    function refreshCardSummaries() {
      document.querySelectorAll(".move-log-card[data-kind='main']").forEach((card) => {
        const name = card.getAttribute("data-move") || card.querySelector(".move-title")?.textContent || "";
        const last = card.querySelector(".last-log");
        if (last) last.textContent = lastLogLine(name.trim());
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
      if (save) save.textContent = editing ? "Update" : "Save entry";
      if (del) del.hidden = !editing;
      if (cancel) cancel.hidden = !editing;
      document.querySelectorAll("#log-sheet-tbody tr").forEach((tr) => {
        tr.classList.toggle("is-selected", String(tr.getAttribute("data-log-id")) === String(sheetEditingId || ""));
      });
    }

    function clearSheetForm() {
      if ($("log-sheet-kg")) $("log-sheet-kg").value = "";
      if ($("log-sheet-sets")) $("log-sheet-sets").value = "";
      if ($("log-sheet-reps")) $("log-sheet-reps").value = "";
      setSheetEditMode(null);
    }

    function blurSheetInputs() {
      ["log-sheet-kg", "log-sheet-sets", "log-sheet-reps"].forEach((id) => {
        try {
          $(id)?.blur();
        } catch (_) {}
      });
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
      if ($("log-sheet-kg")) $("log-sheet-kg").value = String(entry.weight ?? "");
      if ($("log-sheet-sets")) $("log-sheet-sets").value = String(Weights.entrySets(entry) ?? "");
      if ($("log-sheet-reps")) $("log-sheet-reps").value = String(Weights.entryReps(entry) ?? "");
      setSheetEditMode(entry.id);
      fillSheetTable();
      const status = $("log-sheet-status");
      if (status) {
        status.hidden = false;
        status.textContent = "Selected — change values & Update, or Delete.";
        status.className = "log-sheet-status is-ok";
      }
      try {
        $("log-sheet-kg")?.focus({ preventScroll: true });
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
      clearSheetForm();
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
      sheetEditingId = null;
      hideSheetConfirm();
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
          if (sheetEditingId != null) {
            const ok = Weights.updateEntry(sheetEditingId, { weight: kg, sets, reps });
            if (!ok) {
              if (status) {
                status.hidden = false;
                status.textContent = "Could not update that log.";
                status.className = "log-sheet-status is-error";
              }
              return;
            }
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
              date: todayISO(),
            });
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
            $("log-sheet-kg")?.focus({ preventScroll: true });
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
      plan = next || null;
      loaded = true;
      if (plan) {
        const { main } = movesByKind();
        Weights.suggestFromMoves(main.map((m) => ({ name: m.name, kind: "main" })));
      }
      render();
      refreshCardSummaries();
      updateSessionSteps();
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

    function snapshot() {
      if (!loaded) {
        return { title: "Today’s workout", detail: "Loading plan…", liftsTotal: 0, liftsLogged: 0, stretchCount: 0 };
      }
      if (!plan) {
        return {
          title: "Today’s workout",
          detail: "Open Admin → Edit current plan",
          liftsTotal: 0,
          liftsLogged: 0,
          stretchCount: 0,
        };
      }
      const { stretch, main } = movesByKind();
      const liftsLogged = main.filter((m) => Weights.lastFor(m.name)).length;
      const n = main.length;
      return {
        title: plan.headline || "Today’s workout",
        detail: n
          ? `${liftsLogged}/${n} lifts logged · ${stretch.length} stretches`
          : "Open session when ready",
        liftsTotal: n,
        liftsLogged,
        stretchCount: stretch.length,
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
      const kcal = Number(targets?.kcal) || 1800;
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
        el.innerHTML = `<p class="hint">Overnight insights appear after the <strong>4:00 IST</strong> GitHub job — or tap <strong>AI coach</strong> now (Gemini, then Puter Grok if needed).</p>`;
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
    });
    let foods = [];
    let defaults = { targets: { kcal: 1800, protein: 100 } };
    /** @type {null | {planDate?:string,headline?:string,support?:string,targets?:object,meals?:object}} */
    let publishedPlan = null;
    let state = loadJSON(LS.diet, {
      targets: null,
      day: emptyDay(),
      customFoods: [],
      recentFoodIds: [],
      checksByDate: {},
    });
    let pkgPending = null; /* { food, mode: 'grams'|'servings' } */

    function ensureDay() {
      const d = todayISO();
      if (!state.day || state.day.date !== d) {
        const saved = state.checksByDate?.[d];
        state.day = {
          ...emptyDay(),
          date: d,
          done: { ...(saved?.done || {}) },
          extras: Array.isArray(saved?.extras) ? saved.extras.slice() : [],
          /* legacy free-form diary slots still count as extras if present */
          breakfast: saved?.breakfast || [],
          lunch: saved?.lunch || [],
          dinner: saved?.dinner || [],
          snacks: saved?.snacks || [],
        };
        persist();
      }
      if (!state.day.done) state.day.done = {};
      if (!Array.isArray(state.day.extras)) state.day.extras = [];
    }

    function persistChecksSnapshot() {
      ensureDay();
      state.checksByDate = state.checksByDate || {};
      state.checksByDate[state.day.date] = {
        done: { ...(state.day.done || {}) },
        extras: (state.day.extras || []).slice(),
        breakfast: (state.day.breakfast || []).slice(),
        lunch: (state.day.lunch || []).slice(),
        dinner: (state.day.dinner || []).slice(),
        snacks: (state.day.snacks || []).slice(),
      };
    }

    function targets() {
      if (state.targets) return state.targets;
      if (publishedPlan?.targets) return publishedPlan.targets;
      return defaults.targets || { kcal: 1800, protein: 100 };
    }

    function persist() {
      persistChecksSnapshot();
      saveJSON(LS.diet, state);
    }

    function loadPublishedPlan(plan) {
      publishedPlan = plan || null;
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
      persist();
      render();
      if (typeof Progress !== "undefined" && Progress.render) Progress.render();
      maybeAutoSyncChecks();
    }

    function allFoods() {
      return [...foods, ...(state.customFoods || [])];
    }

    function findFood(id) {
      return allFoods().find((f) => f.id === id) || null;
    }

    function isPackaged(food) {
      return !!(food && (food.kind === "packaged" || food.servingGrams || food.servingSize));
    }

    function parseServingGrams(servingSize) {
      const s = String(servingSize || "").trim().toLowerCase();
      if (!s) return null;
      const m = s.match(/(\d+(?:\.\d+)?)\s*(g|gram|grams|kg)\b/);
      if (!m) return null;
      const n = Number(m[1]);
      if (!Number.isFinite(n) || n <= 0) return null;
      return m[2].startsWith("kg") ? n * 1000 : n;
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
      const servingGrams = parseServingGrams(servingSize);
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
        servingSize: String(servingSize || "").trim() || (servingGrams ? `${servingGrams}g` : "1 serving"),
        servingGrams,
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
      if (mode === "grams") {
        const g = Number(food.servingGrams) || parseServingGrams(food.servingSize);
        if (!g) throw new Error("This product has no gram serving — use Servings mode.");
        return a / g;
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

    function savePackagedFood(food) {
      state.customFoods = state.customFoods || [];
      const existing = state.customFoods.findIndex(
        (x) => x.id === food.id || (x.kind === "packaged" && x.name === food.name)
      );
      if (existing >= 0) state.customFoods[existing] = { ...state.customFoods[existing], ...food };
      else state.customFoods.push(food);
      persist();
      return food;
    }

    function extrasInMeal(meal) {
      ensureDay();
      const fromExtras = (state.day.extras || []).filter((x) => (x.meal || "snacks") === meal);
      const legacy = state.day[meal] || [];
      return [...fromExtras, ...legacy];
    }

    function totals() {
      ensureDay();
      let kcal = 0;
      let protein = 0;
      MEALS.forEach(({ id }) => {
        planItems(id).forEach((item) => {
          if (!isDone(item.id)) return;
          kcal += Number(item.kcal) || 0;
          protein += Number(item.protein) || 0;
        });
        extrasInMeal(id).forEach((item) => {
          const s = Number(item.servings) || 1;
          kcal += (Number(item.kcal) || 0) * s;
          protein += (Number(item.protein) || 0) * s;
        });
      });
      return { kcal: Math.round(kcal), protein: Math.round(protein * 10) / 10 };
    }

    function slotKcal(slot) {
      ensureDay();
      let n = 0;
      planItems(slot).forEach((item) => {
        if (isDone(item.id)) n += Number(item.kcal) || 0;
      });
      extrasInMeal(slot).forEach((item) => {
        n += (Number(item.kcal) || 0) * (Number(item.servings) || 1);
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
      const entry = {
        id: "extra-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 5),
        foodId: food.id || "",
        meal: meal || "snacks",
        name: food.name,
        kcal,
        protein: Number(food.protein) || 0,
        servings: s,
      };
      if (food.carbs != null) entry.carbs = Number(food.carbs);
      if (food.fat != null) entry.fat = Number(food.fat);
      if (food.fiber != null) entry.fiber = Number(food.fiber);
      if (food.sugars != null) entry.sugars = Number(food.sugars);
      if (food.sodiumMg != null) entry.sodiumMg = Number(food.sodiumMg);
      if (extras.amountLabel) entry.amountLabel = extras.amountLabel;
      if (food.kind === "packaged" || extras.kind === "packaged") entry.kind = "packaged";
      state.day.extras = state.day.extras || [];
      state.day.extras.push(entry);
      pushRecent(food.id);
      markDietLogged(state.day.date || todayISO());
      persist();
      render();
      if (typeof Progress !== "undefined" && Progress.render) Progress.render();
      maybeAutoSyncChecks();
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
      setStatus($("diet-status"), `Added ${name}`, "ok");
    }

    function removeExtra(extraId) {
      ensureDay();
      state.day.extras = (state.day.extras || []).filter((x) => x.id !== extraId);
      MEALS.forEach(({ id }) => {
        state.day[id] = (state.day[id] || []).filter((x) => x.id !== extraId);
      });
      persist();
      render();
      maybeAutoSyncChecks();
    }

    function addPackagedAmount(food, meal, mode, amount) {
      const factor = scaleFactor(food, mode, amount);
      const a = Number(amount);
      const amountLabel =
        mode === "grams" ? `${roundn(a, 1)} g` : `${roundn(a, 2)} serving${a === 1 ? "" : "s"}`;
      addItem(food, meal, factor, { amountLabel, kind: "packaged" });
      return { factor, amountLabel, macros: scaledMacros(food, factor) };
    }

    function removeItem(meal, index) {
      ensureDay();
      const list = extrasInMeal(meal);
      const item = list[index];
      if (!item) return;
      if (item.id && (state.day.extras || []).some((x) => x.id === item.id)) {
        removeExtra(item.id);
        return;
      }
      state.day[meal] = state.day[meal] || [];
      const li = state.day[meal].findIndex((x) => x === item || x.id === item.id);
      if (li >= 0) state.day[meal].splice(li, 1);
      persist();
      render();
    }

    function localMatches(query) {
      const q = String(query || "").toLowerCase().trim();
      let list = allFoods();
      if (q) {
        list = list.filter((f) => {
          const hay = [
            f.name,
            f.brand,
            f.product,
            ...(f.tags || []),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return hay.includes(q);
        });
      }
      return list.slice(0, 48);
    }

    function recentFoods() {
      const ids = state.recentFoodIds || [];
      return ids.map((id) => findFood(id)).filter(Boolean).slice(0, 8);
    }

    function foodButtonHtml(f) {
      const per = isPackaged(f)
        ? `per ${escapeHtml(f.servingSize || (f.servingGrams ? f.servingGrams + "g" : "serving"))}`
        : "";
      return `<button type="button" class="hf-food-btn${isPackaged(f) ? " is-packaged" : ""}" data-food-id="${escapeHtml(f.id)}">
        <span class="hf-food-name">${escapeHtml(f.name)}</span>
        <em>${f.kcal} kcal · ${f.protein}g P${per ? ` · ${per}` : ""}</em>
      </button>`;
    }

    function renderFoodPick(query) {
      const root = $("diet-food-pick");
      if (!root) return;
      const q = String(query || "").trim();
      const local = localMatches(q);
      const recent = !q ? recentFoods() : [];
      const recentHtml = recent.length
        ? `<div class="food-pick-group">
            <p class="food-pick-label">Recent <span class="food-pick-hint">quick add</span></p>
            <div class="hf-recent-row">${recent.map(foodButtonHtml).join("")}</div>
          </div>`
        : "";
      const localHtml = local.length
        ? local.map(foodButtonHtml).join("")
        : `<p class="food-pick-empty">No library matches${q ? ` for “${escapeHtml(q)}”` : ""}. Try Custom food below.</p>`;
      const mealLabel = MEALS.find((m) => m.id === ($("diet-meal")?.value || "breakfast"))?.label || "meal";
      root.innerHTML = `${recentHtml}<div class="food-pick-group">
        <p class="food-pick-label">Food library <span class="food-pick-hint">→ ${escapeHtml(mealLabel)}</span></p>
        ${localHtml}
      </div>`;
    }

    function focusAddForMeal(meal) {
      const sel = $("diet-meal");
      if (sel) sel.value = meal;
      $("diet-meal-chips")?.querySelectorAll(".meal-chip").forEach((c) => {
        const on = c.getAttribute("data-meal") === meal;
        c.classList.toggle("is-active", on);
        c.setAttribute("aria-selected", on ? "true" : "false");
      });
      const panel = $("diet-add-card");
      if (panel) {
        panel.hidden = false;
        panel.classList.add("is-open");
      }
      const hint = $("diet-add-meal-hint");
      if (hint) {
        const label = MEALS.find((m) => m.id === meal)?.label || meal;
        hint.textContent = `Extra · ${label}`;
      }
      renderFoodPick($("diet-search")?.value || "");
      try {
        $("diet-search")?.focus({ preventScroll: true });
      } catch (_) {}
      panel?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    function render() {
      ensureDay();
      const t = targets();
      const tot = totals();
      const left = Math.max(0, Math.round(t.kcal - tot.kcal));
      const over = tot.kcal > t.kcal;
      const kcalEl = $("diet-target-kcal");
      const proEl = $("diet-target-protein");
      if (kcalEl && document.activeElement !== kcalEl) kcalEl.value = t.kcal;
      if (proEl && document.activeElement !== proEl) proEl.value = t.protein;

      if ($("diet-plan-headline")) {
        $("diet-plan-headline").textContent = publishedPlan?.headline || "Today’s plate";
      }
      if ($("diet-plan-support")) {
        $("diet-plan-support").textContent =
          publishedPlan?.support || "Tap ✓ for what you ate · quick-add anything else.";
      }
      const planSt = $("diet-plan-status");
      if (planSt) {
        if (!publishedPlan) {
          planSt.hidden = false;
          planSt.textContent = "No published meal plan yet — Admin can set today’s diet. You can still quick-add foods.";
        } else {
          planSt.hidden = true;
          planSt.textContent = "";
        }
      }

      const totalsRoot = $("diet-totals");
      if (totalsRoot) {
        const kcalPct = Math.max(0, Math.min(100, Math.round((tot.kcal / (t.kcal || 1)) * 100)));
        const proPct = Math.max(0, Math.min(100, Math.round((tot.protein / (t.protein || 1)) * 100)));
        totalsRoot.innerHTML = `
          <div class="hf-remain-card ${over ? "is-over" : ""}">
            <p class="hf-remain-kicker">${over ? "Over plan" : "Diet taken"}</p>
            <p class="hf-remain-num"><strong>${tot.kcal}</strong>
              <span>/ ${t.kcal} kcal</span></p>
            <div class="hf-remain-meta">
              <span><b>${over ? "+" + (tot.kcal - t.kcal) : left}</b> ${over ? "over" : "left"}</span>
              <span><b>${tot.protein}g</b> / ${t.protein}g protein</span>
              <span>checked + extras</span>
            </div>
            <div class="hf-remain-bars" aria-hidden="true">
              <div class="hf-bar"><i style="width:${kcalPct}%"></i></div>
              <div class="hf-bar hf-bar-pro"><i style="width:${proPct}%"></i></div>
            </div>
          </div>`;
      }

      const mealsRoot = $("diet-meals");
      if (mealsRoot) {
        const active = $("diet-meal")?.value || "breakfast";
        mealsRoot.innerHTML = MEALS.map(({ id, label }) => {
          const planned = planItems(id);
          const extras = extrasInMeal(id);
          const sk = slotKcal(id);
          const checkedN = planned.filter((it) => isDone(it.id)).length;
          const planLis = planned.length
            ? planned
                .map((item) => {
                  const on = isDone(item.id);
                  return `<li class="diet-check-row${on ? " is-done" : ""}">
                    <button type="button" class="diet-check-toggle" data-check-id="${escapeHtml(item.id)}" aria-pressed="${on ? "true" : "false"}" aria-label="${on ? "Unmark" : "Mark eaten"}">
                      <span class="diet-check-box" aria-hidden="true">${on ? "✓" : ""}</span>
                      <span class="diet-check-copy">
                        <strong>${escapeHtml(item.name)}</strong>
                        <em>${item.kcal} kcal · ${item.protein}g P${item.note ? ` · ${escapeHtml(item.note)}` : ""}</em>
                      </span>
                    </button>
                  </li>`;
                })
                .join("")
            : `<li class="hf-meal-empty">No plan items — Admin publishes the day, or quick-add below.</li>`;
          const extraLis = extras
            .map((item, i) => {
              const s = Number(item.servings) || 1;
              const qty = item.amountLabel
                ? ` · ${escapeHtml(item.amountLabel)}`
                : s !== 1
                  ? ` × ${s}`
                  : "";
              return `<li class="diet-extra-row">
                <div>
                  <div>${escapeHtml(item.name)}${qty} <span class="diet-extra-tag">extra</span></div>
                  <div class="meta">${Math.round(item.kcal * s)} kcal · ${Math.round(item.protein * s * 10) / 10}g P</div>
                </div>
                <button type="button" data-remove="${id}:${i}" aria-label="Remove">✕</button>
              </li>`;
            })
            .join("");
          return `<section class="hf-meal-card meal-slot${id === active ? " is-active-meal" : ""}" data-meal-slot="${id}">
            <header class="hf-meal-head">
              <div>
                <h3>${label}</h3>
                <p class="hf-meal-kcal">${sk} kcal · ${checkedN}/${planned.length} checked${extras.length ? ` · ${extras.length} extra` : ""}</p>
              </div>
              <button type="button" class="hf-add-btn" data-add-meal="${id}">+ Extra</button>
            </header>
            <ul class="food-list diet-check-list">${planLis}</ul>
            ${extraLis ? `<ul class="food-list diet-extra-list">${extraLis}</ul>` : ""}
          </section>`;
        }).join("");
      }

      $("diet-meal-chips")?.querySelectorAll(".meal-chip").forEach((c) => {
        const on = c.getAttribute("data-meal") === ($("diet-meal")?.value || "breakfast");
        c.classList.toggle("is-active", on);
        c.setAttribute("aria-selected", on ? "true" : "false");
      });
      const hint = $("diet-add-meal-hint");
      if (hint) {
        const label = MEALS.find((m) => m.id === ($("diet-meal")?.value || "breakfast"))?.label || "meal";
        hint.textContent = `Extra · ${label}`;
      }
      renderFoodPick($("diet-search")?.value || "");
      if (typeof Today !== "undefined" && Today.render && document.body.dataset.section === "today") {
        Today.render();
      }
    }

    let aiProductDraft = null;

    function updatePkgPreview() {
      if (!pkgPending?.food) return;
      const mode = pkgPending.mode || "grams";
      const amount = $("diet-pkg-amount")?.value;
      try {
        const factor = scaleFactor(pkgPending.food, mode, amount);
        const m = scaledMacros(pkgPending.food, factor);
        const el = $("diet-pkg-preview");
        if (el) {
          el.textContent = `→ ${m.kcal} kcal · ${m.protein}g protein` +
            (m.carbs != null ? ` · ${m.carbs}g carbs` : "") +
            (m.fat != null ? ` · ${m.fat}g fat` : "");
        }
      } catch (e) {
        const el = $("diet-pkg-preview");
        if (el) el.textContent = e.message || "Enter amount";
      }
    }

    function openPkgSheet(food) {
      pkgPending = {
        food,
        mode: food.servingGrams || parseServingGrams(food.servingSize) ? "grams" : "servings",
      };
      const sheet = $("diet-pkg-sheet");
      if (sheet) sheet.hidden = false;
      if ($("diet-pkg-name")) $("diet-pkg-name").textContent = food.name;
      if ($("diet-pkg-base")) {
        $("diet-pkg-base").textContent =
          `Label: ${food.servingSize || "1 serving"} = ${food.kcal} kcal · ${food.protein}g protein` +
          (food.carbs != null ? ` · ${food.carbs}g carbs` : "");
      }
      const hasG = !!(food.servingGrams || parseServingGrams(food.servingSize));
      $("diet-pkg-mode-g")?.classList.toggle("is-active", pkgPending.mode === "grams");
      $("diet-pkg-mode-s")?.classList.toggle("is-active", pkgPending.mode === "servings");
      if ($("diet-pkg-mode-g")) $("diet-pkg-mode-g").disabled = !hasG;
      if ($("diet-pkg-amount")) {
        $("diet-pkg-amount").value = pkgPending.mode === "grams" ? String(Math.min(50, food.servingGrams || 50)) : "1";
        $("diet-pkg-amount").step = pkgPending.mode === "grams" ? "1" : "0.25";
      }
      if ($("diet-pkg-amount-label")) {
        $("diet-pkg-amount-label").textContent =
          pkgPending.mode === "grams" ? "Amount (g)" : "Servings";
      }
      if ($("diet-servings-wrap")) $("diet-servings-wrap").hidden = true;
      updatePkgPreview();
      sheet?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    function closePkgSheet() {
      pkgPending = null;
      const sheet = $("diet-pkg-sheet");
      if (sheet) sheet.hidden = true;
      if ($("diet-servings-wrap")) $("diet-servings-wrap").hidden = false;
    }

    function showAiProductPreview(food, rawJson) {
      aiProductDraft = food;
      const box = $("diet-pkg-ai-preview");
      if (box) box.hidden = false;
      if ($("diet-pkg-ai-title")) $("diet-pkg-ai-title").textContent = food.name;
      if ($("diet-pkg-ai-meta")) {
        $("diet-pkg-ai-meta").textContent =
          `Per ${food.servingSize}: ${food.kcal} kcal · ${food.protein}g P` +
          (food.carbs != null ? ` · ${food.carbs}g carbs` : "") +
          (food.fat != null ? ` · ${food.fat}g fat` : "") +
          (food.sodiumMg != null ? ` · ${food.sodiumMg}mg sodium` : "");
      }
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
    }

    function hideAiProductPreview() {
      aiProductDraft = null;
      const box = $("diet-pkg-ai-preview");
      if (box) box.hidden = true;
    }

    function readProductForm() {
      return {
        brand: $("diet-pkg-brand")?.value || "",
        product: $("diet-pkg-product")?.value || "",
        servingHint: $("diet-pkg-serving")?.value || "",
        notes: $("diet-pkg-notes")?.value || "",
      };
    }

    async function fillProductWithAi({ preferPuter } = {}) {
      const st = $("diet-pkg-status");
      if (!isAdminUnlocked()) {
        setStatus(st, "AI product fill is Admin only.", "error");
        return;
      }
      const input = readProductForm();
      try {
        Gemini.preparePackagedProduct(input);
      } catch (e) {
        setStatus(st, e.message || String(e), "error");
        return;
      }
      hideAiProductPreview();
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
        setStatus(
          st,
          `Preview ready via ${provider === "puter-grok" ? "Puter Grok" : "Gemini"} — confirm to save.`,
          "ok"
        );
      } catch (e) {
        setStatus(st, e.message || String(e), "error");
      }
    }

    function wirePackagedProductUi() {
      $("diet-pkg-ai")?.addEventListener("click", () => fillProductWithAi());
      $("diet-pkg-ai-puter")?.addEventListener("click", () => fillProductWithAi({ preferPuter: true }));
      $("diet-pkg-ai-confirm")?.addEventListener("click", () => {
        if (!aiProductDraft) {
          setStatus($("diet-pkg-status"), "Fill with AI first.", "error");
          return;
        }
        savePackagedFood(aiProductDraft);
        setStatus($("diet-pkg-status"), `Saved “${aiProductDraft.name}” to library.`, "ok");
        if ($("diet-search")) $("diet-search").value = aiProductDraft.brand || aiProductDraft.product || "";
        renderFoodPick($("diet-search")?.value || "");
        hideAiProductPreview();
      });
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
      $("diet-pkg-sheet")?.addEventListener("click", (e) => {
        const modeBtn = e.target.closest("[data-pkg-mode]");
        if (modeBtn && pkgPending) {
          if (modeBtn.disabled) return;
          pkgPending.mode = modeBtn.getAttribute("data-pkg-mode");
          $("diet-pkg-mode-g")?.classList.toggle("is-active", pkgPending.mode === "grams");
          $("diet-pkg-mode-s")?.classList.toggle("is-active", pkgPending.mode === "servings");
          if ($("diet-pkg-amount-label")) {
            $("diet-pkg-amount-label").textContent =
              pkgPending.mode === "grams" ? "Amount (g)" : "Servings";
          }
          if ($("diet-pkg-amount")) {
            $("diet-pkg-amount").step = pkgPending.mode === "grams" ? "1" : "0.25";
            if (pkgPending.mode === "servings") $("diet-pkg-amount").value = "1";
          }
          updatePkgPreview();
          return;
        }
      });
      $("diet-pkg-amount")?.addEventListener("input", updatePkgPreview);
      $("diet-pkg-confirm")?.addEventListener("click", () => {
        if (!pkgPending?.food) return;
        try {
          const meal = $("diet-meal")?.value || "breakfast";
          const { amountLabel, macros } = addPackagedAmount(
            pkgPending.food,
            meal,
            pkgPending.mode,
            $("diet-pkg-amount")?.value
          );
          setStatus(
            $("diet-status"),
            `Added ${pkgPending.food.name} (${amountLabel}) → ${macros.kcal} kcal`,
            "ok"
          );
          closePkgSheet();
          if ($("diet-search")) $("diet-search").value = "";
          renderFoodPick("");
        } catch (e) {
          setStatus($("diet-status"), e.message || String(e), "error");
        }
      });
      $("diet-pkg-cancel")?.addEventListener("click", () => closePkgSheet());
    }

    function checksPayload() {
      persistChecksSnapshot();
      return {
        version: 1,
        updatedAt: new Date().toISOString(),
        days: { ...(state.checksByDate || {}) },
      };
    }

    async function publishChecks(statusEl, tokenOverride) {
      const token =
        tokenOverride ||
        localStorage.getItem(LS.token) ||
        ($("admin-token")?.value || "").trim();
      if (!token) {
        setStatus(statusEl, "Save a GitHub PAT first (Connect this phone).", "error");
        return false;
      }
      setStatus(statusEl, "Syncing checkmarks…", "info");
      try {
        const payload = checksPayload();
        await githubPutFile(
          DIET_CHECKS_PATH,
          b64EncodeUnicode(JSON.stringify(payload, null, 2) + "\n"),
          `Sync diet checkmarks (${todayISO()})`,
          token
        );
        setStatus(statusEl, "Checkmarks synced. Pages ~30–60s.", "ok");
        return true;
      } catch (e) {
        setStatus(statusEl, e.message || String(e), "error");
        return false;
      }
    }

    let autoSyncTimer = null;
    function maybeAutoSyncChecks() {
      if (!(localStorage.getItem(LS.token) || "").trim()) return;
      clearTimeout(autoSyncTimer);
      autoSyncTimer = setTimeout(() => {
        publishChecks($("diet-sync-status"));
      }, 2500);
    }

    async function pullChecks() {
      const st = $("diet-sync-status");
      setStatus(st, "Refreshing checkmarks…", "info");
      try {
        const res = await fetch(`./${DIET_CHECKS_PATH}?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) throw new Error("No cloud checkmarks yet.");
        const data = await res.json();
        const days = data.days || {};
        state.checksByDate = { ...(state.checksByDate || {}), ...days };
        const d = todayISO();
        if (days[d]) {
          state.day = {
            ...emptyDay(),
            date: d,
            done: { ...(days[d].done || {}) },
            extras: Array.isArray(days[d].extras) ? days[d].extras.slice() : [],
            breakfast: days[d].breakfast || [],
            lunch: days[d].lunch || [],
            dinner: days[d].dinner || [],
            snacks: days[d].snacks || [],
          };
        }
        persist();
        render();
        setStatus(st, "Pulled checkmarks from cloud.", "ok");
      } catch (e) {
        setStatus(st, e.message || String(e), "error");
      }
    }

    function wire() {
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
      $("diet-pull-checks")?.addEventListener("click", () => pullChecks());
      $("diet-meal-chips")?.addEventListener("click", (e) => {
        const chip = e.target.closest("[data-meal]");
        if (!chip) return;
        focusAddForMeal(chip.getAttribute("data-meal"));
        document.querySelector(`[data-meal-slot="${chip.getAttribute("data-meal")}"]`)?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      });
      $("diet-search")?.addEventListener("input", (e) => {
        renderFoodPick(e.target.value);
      });
      $("diet-food-pick")?.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-food-id]");
        if (!btn) return;
        const food = findFood(btn.getAttribute("data-food-id"));
        if (!food || !Number.isFinite(Number(food.kcal))) {
          setStatus($("diet-status"), "That item has no usable kcal.", "error");
          return;
        }
        if (isPackaged(food)) {
          openPkgSheet(food);
          return;
        }
        const meal = $("diet-meal")?.value || "breakfast";
        const servings = $("diet-servings")?.value || 1;
        addItem(food, meal, servings);
        setStatus($("diet-status"), `Added ${food.name}`, "ok");
        if ($("diet-search")) $("diet-search").value = "";
        renderFoodPick("");
      });
      wirePackagedProductUi();
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
        if (typeof Profile !== "undefined" && Profile.paintSummaries) Profile.paintSummaries();
        setStatus($("diet-status"), "Targets saved on this phone.", "ok");
      });
      $("diet-clear-day")?.addEventListener("click", () => {
        if (!confirm("Clear today’s checkmarks and extras?")) return;
        state.day = emptyDay();
        if (state.checksByDate) delete state.checksByDate[todayISO()];
        persist();
        render();
        setStatus($("diet-status"), "Today’s checkmarks cleared.", "info");
      });
      $("diet-meals")?.addEventListener("click", (e) => {
        const check = e.target.closest("[data-check-id]");
        if (check) {
          toggleDone(check.getAttribute("data-check-id"));
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
    }

    async function init() {
      /* Drop legacy Google CSE keys if present */
      try {
        localStorage.removeItem("sapna_google_cse_key");
        localStorage.removeItem("sapna_google_cse_cx");
      } catch (_) {}
      try {
        const [fRes, dRes, pRes] = await Promise.all([
          fetch(`./data/foods.json?v=${PROFILE_ASSET_V}`),
          fetch(`./data/diet-defaults.json?v=${PROFILE_ASSET_V}`),
          fetch(`./${DIET_TODAY_PATH}?v=${PROFILE_ASSET_V}`, { cache: "no-store" }),
        ]);
        if (fRes.ok) {
          const data = await fRes.json();
          foods = data.foods || [];
        }
        if (dRes.ok) {
          defaults = await dRes.json();
          if (!state.targets && defaults.targets) state.targets = { ...defaults.targets };
        }
        if (pRes.ok) {
          publishedPlan = await pRes.json();
        }
      } catch (e) {
        console.warn(e);
      }
      try {
        const cRes = await fetch(`./${DIET_CHECKS_PATH}?v=${PROFILE_ASSET_V}`, { cache: "no-store" });
        if (cRes.ok) {
          const data = await cRes.json();
          const days = data.days || {};
          state.checksByDate = { ...days, ...(state.checksByDate || {}) };
          const d = todayISO();
          if (days[d] && (!state.day || state.day.date !== d || !Object.keys(state.day.done || {}).length)) {
            state.day = {
              ...emptyDay(),
              date: d,
              done: { ...(days[d].done || {}) },
              extras: Array.isArray(days[d].extras) ? days[d].extras.slice() : [],
              breakfast: days[d].breakfast || [],
              lunch: days[d].lunch || [],
              dinner: days[d].dinner || [],
              snacks: days[d].snacks || [],
            };
          }
        }
      } catch (_) {}
      wire();
      render();
      renderFoodPick($("diet-search")?.value || "");
    }


    function todayPlate() {
      ensureDay();
      const out = [];
      MEALS.forEach(({ id, label }) => {
        planItems(id).forEach((item) => {
          if (!isDone(item.id)) return;
          out.push({
            meal: label,
            name: item.name,
            kcal: Math.round(Number(item.kcal) || 0),
            protein: Math.round((Number(item.protein) || 0) * 10) / 10,
          });
        });
        extrasInMeal(id).forEach((item) => {
          out.push({
            meal: label,
            name: item.name,
            kcal: Math.round((Number(item.kcal) || 0) * (Number(item.servings) || 1)),
            protein: Math.round((Number(item.protein) || 0) * (Number(item.servings) || 1) * 10) / 10,
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
      const tg = targets();
      const tot = totals();
      const left = Math.max(0, Math.round(tg.kcal - tot.kcal));
      ensureDay();
      const mealFill = {};
      MEALS.forEach(({ id }) => {
        const planned = planItems(id);
        const anyChecked = planned.some((it) => isDone(it.id));
        mealFill[id] = anyChecked || extrasInMeal(id).length > 0;
      });
      return {
        kcal: tot.kcal,
        protein: tot.protein,
        targetKcal: tg.kcal,
        targetProtein: tg.protein,
        left,
        over: tot.kcal > tg.kcal,
        mealFill,
        planHeadline: publishedPlan?.headline || "",
      };
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
      syncBasics: false,
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

    function hasBiometrics(s) {
      return numOrNull(s.weightKg) != null && numOrNull(s.heightCm) != null;
    }

    function isComplete(s) {
      return !!(s && (s.completedAt || hasBiometrics(s)));
    }

    function needsNudge() {
      if (isComplete(state)) return false;
      try {
        if (sessionStorage.getItem(SS_SKIP) === "1") return false;
      } catch (_) {}
      return true;
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
      if ($("pf-sync-basics")) $("pf-sync-basics").checked = !!s.syncBasics;
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

    function showStep(n) {
      step = Math.max(0, Math.min(STEPS.length - 1, n));
      document.querySelectorAll(".profile-step").forEach((sec) => {
        const i = Number(sec.getAttribute("data-profile-step"));
        const on = i === step;
        sec.hidden = !on;
        sec.classList.toggle("is-active", on);
      });
      const label = $("profile-step-label");
      if (label) label.textContent = `${STEPS[step]} · ${step + 1}/${STEPS.length}`;
      const prog = $("profile-progress");
      if (prog) {
        prog.innerHTML = STEPS.map((_, i) => `<span class="profile-dot${i === step ? " is-on" : i < step ? " is-done" : ""}"></span>`).join("");
      }
      const back = $("profile-back");
      const next = $("profile-next");
      const save = $("profile-save");
      const skip = $("profile-skip-step");
      if (back) back.hidden = step === 0;
      if (next) next.hidden = step >= STEPS.length - 1;
      if (save) save.hidden = step < STEPS.length - 1;
      if (skip) skip.hidden = step >= STEPS.length - 1;
      if (step === STEPS.length - 1) updateLiveMetrics();
      const sheet = $("profile-sheet")?.querySelector(".profile-sheet");
      if (sheet) sheet.scrollTop = 0;
    }

    function close() {
      const overlay = $("profile-sheet");
      if (!overlay) return;
      overlay.hidden = true;
      overlay.classList.remove("is-open");
      overlay.style.cssText = "";
      document.body.classList.remove("modal-open", "profile-sheet-open");
    }

    function open(opts) {
      const overlay = $("profile-sheet");
      if (!overlay) return;
      fillForm(state);
      showStep(opts?.step != null ? opts.step : isComplete(state) ? 0 : 0);
      overlay.hidden = false;
      overlay.classList.add("is-open");
      overlay.style.cssText = "display:flex !important;";
      document.body.classList.add("modal-open", "profile-sheet-open");
      setStatus($("profile-status"), "");
      updateLiveMetrics();
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

    async function maybePublishBasics() {
      if (!state.syncBasics) return { ok: true, skipped: true };
      const token = (localStorage.getItem(LS.token) || "").trim();
      if (!token) {
        return { ok: false, message: "Saved on phone. Add a GitHub token to sync basics." };
      }
      try {
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
      const showNudge = needsNudge();
      if (nudgeToday) nudgeToday.hidden = !showNudge;
      if (nudgeDiet) nudgeDiet.hidden = !showNudge;

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
      $("profile-close")?.addEventListener("click", () => close());
      $("profile-back")?.addEventListener("click", () => {
        state = readFormInto(state);
        showStep(step - 1);
      });
      $("profile-next")?.addEventListener("click", () => {
        state = readFormInto(state);
        showStep(step + 1);
      });
      $("profile-skip-step")?.addEventListener("click", () => {
        state = readFormInto(state);
        if (step >= STEPS.length - 1) skipSession();
        else showStep(step + 1);
      });
      $("profile-save")?.addEventListener("click", () => {
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
    }

    function tokenSheetOpen() {
      const t = $("token-setup");
      return t && !t.hidden && t.classList.contains("is-open");
    }

    function promptIfNeeded() {
      wire();
      paintSummaries();
      if (!needsNudge()) return;
      const tryOpen = () => {
        if (tokenSheetOpen()) {
          setTimeout(tryOpen, 600);
          return;
        }
        /* Soft nudge banners only — sheet opens on Get started, not forced */
        paintSummaries();
      };
      setTimeout(tryOpen, 400);
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
        return false;
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
        return true;
      } catch (err) {
        setStatus(statusEl, err.message || String(err), "error");
        return false;
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

    return { init, render, publishPeriods, publishPayload, snapshot, coachSnapshot };
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
          progress.innerHTML = `<div class="empty-teach">
            <strong>No lifts logged yet</strong>
            <p>Go to <a href="#workout" data-nav="workout">Workout</a>, open an Exercise move, tap <strong>LOG</strong>, enter kg · sets · reps.</p>
          </div>`;
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
          : `<div class="empty-teach"><strong>History is empty</strong><p>Saved LOG entries show up here, newest first. Start from <a href="#workout" data-nav="workout">Workout</a>.</p></div>`;
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

    async function publishWeights(statusEl, tokenOverride) {
      const token = tokenOverride || localStorage.getItem(LS.token) || $("log-token")?.value.trim() || $("admin-token")?.value.trim();
      if (!token) {
        setStatus(statusEl, "Add a GitHub PAT (repo scope) — same as Periods / Admin.", "error");
        return false;
      }
      if (tokenOverride || $("log-token")?.value.trim()) {
        localStorage.setItem(LS.token, token);
      }
      setStatus(statusEl, "Syncing lift logs…", "info");
      try {
        /* Pull first so we don't clobber other phone's newer entries */
        await pullCloud({ quiet: true });
        const payload = publishPayload();
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
        const res = await fetch(`./${WEIGHTS_PATH}?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) {
          if (!quiet) setStatus($("log-sync-status"), "No cloud logs yet — Sync now from a phone that has entries.", "info");
          return 0;
        }
        const added = mergeCloud(await res.json());
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
      if (!localStorage.getItem(LS.token)) return;
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

    function estimateBurnKcal() {
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
      const dietSnap = Diet.snapshot ? Diet.snapshot() : { kcal: 0, targetKcal: 1800 };
      const eaten = Math.round(dietSnap.kcal || 0);
      const dietGoal = Math.round(dietSnap.targetKcal || 1800);
      const dietPct = Math.max(0, Math.min(100, Math.round((eaten / (dietGoal || 1)) * 100)));

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
              <span>kcal est.${burn ? "" : " · log lifts"}</span>
            </div>
            <div class="prog-metric">
              <em>Diet taken</em>
              <strong>${eaten}</strong>
              <span>/ ${dietGoal} kcal · ${dietPct}%</span>
            </div>
          </div>
          <div class="prog-streak-head">
            <div class="prog-flame" aria-hidden="true">✦</div>
            <div>
              <p class="prog-kicker">Workout streak</p>
              <p class="prog-streak-count"><strong>${streakDays}</strong> <span>day${streakDays === 1 ? "" : "s"}</span></p>
              <p class="prog-streak-sub">${streakWeeks ? `${streakWeeks} week${streakWeeks === 1 ? "" : "s"} with a lift` : "Log a lift to start"} · ${dietN ? `Diet ${dietN}d` : "Diet —"}</p>
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
      setStatus($("admin-status"), result.message + " Saved on this phone.", "ok");
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
          kcal: Number($("admin-kcal").value) || 1800,
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

  /* ───────── First-visit token setup (one PAT for everything) ───────── */
  const TokenSetup = (() => {
    const SS_LATER = "sapna_token_setup_later";

    function hasToken() {
      return !!(localStorage.getItem(LS.token) || "").trim();
    }

    function applyPlaceholders() {
      ["log-token", "period-token", "admin-token"].forEach((id) => {
        const el = $(id);
        if (el && hasToken()) el.placeholder = "Token saved — paste to replace";
      });
    }

    function close() {
      const overlay = $("token-setup");
      if (!overlay) return;
      overlay.hidden = true;
      overlay.classList.remove("is-open");
      overlay.style.cssText = "";
      document.body.classList.remove("modal-open", "token-setup-open");
    }

    function open() {
      const overlay = $("token-setup");
      if (!overlay) return;
      overlay.hidden = false;
      overlay.classList.add("is-open");
      overlay.style.cssText = "display:flex !important;";
      document.body.classList.add("modal-open", "token-setup-open");
      const input = $("token-setup-input");
      if (input) {
        input.value = "";
        setTimeout(() => {
          try {
            input.focus({ preventScroll: true });
          } catch (_) {}
        }, 80);
      }
      setStatus($("token-setup-status"), "");
    }

    function save() {
      const raw = ($("token-setup-input")?.value || "").trim();
      if (!raw) {
        setStatus($("token-setup-status"), "Paste your GitHub token first.", "error");
        return false;
      }
      if (raw.length < 20) {
        setStatus($("token-setup-status"), "That doesn’t look like a GitHub token. Check and try again.", "error");
        return false;
      }
      localStorage.setItem(LS.token, raw);
      try {
        sessionStorage.removeItem(SS_LATER);
      } catch (_) {}
      applyPlaceholders();
      setStatus($("token-setup-status"), "Saved on this phone — sync & publish ready.", "ok");
      setTimeout(close, 450);
      return true;
    }

    function later() {
      try {
        sessionStorage.setItem(SS_LATER, "1");
      } catch (_) {}
      close();
    }

    function wire() {
      $("token-setup-save")?.addEventListener("click", () => save());
      $("token-setup-later")?.addEventListener("click", () => later());
      $("token-setup-input")?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          save();
        }
      });
    }

    function promptIfNeeded() {
      wire();
      applyPlaceholders();
      if (hasToken()) return;
      let skipped = false;
      try {
        skipped = sessionStorage.getItem(SS_LATER) === "1";
      } catch (_) {}
      if (skipped) return;
      open();
    }

    return { promptIfNeeded, applyPlaceholders, hasToken };
  })();

  async function init() {
    syncAdminUi();
    window.Diet = Diet;
    window.Gemini = Gemini;
    window.PuterGrok = PuterGrok;
    window.AiBridge = AiBridge;
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
    /* Ask for PAT first on a fresh phone — powers logs, periods, Admin */
    TokenSetup.promptIfNeeded();
    await Weights.init();
    await Diet.init();
    await Periods.init();
    await Workout.init();
    GeminiKeyUI.wire();
    Coach.wire();
    Profile.init();
    /* Re-apply per-exercise Last: lines after plan + cloud weights are both ready */
    if (Workout.refreshSummaries) Workout.refreshSummaries();
    else Workout.render();
    syncAdminUi();
    showPanel(location.hash.replace(/^#/, "") || "today");
  }

  init();
})();
