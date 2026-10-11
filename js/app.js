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
  };
  const REPO = { owner: "drishabhh", name: "sapna-health", branch: "main" };
  const DIET_DEFAULTS_PATH = "data/diet-defaults.json";
  const PERIODS_PATH = "data/periods.json";
  const WEIGHTS_PATH = "data/weights.json";

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
    const MODEL = "gemini-2.5-flash";
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

    async function generate({ prompt, schema, useSearch }) {
      const key = getKey();
      if (!key) throw new Error("Add a Gemini API key in Admin first.");
      const body = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: "application/json",
        },
      };
      if (schema) body.generationConfig.responseSchema = schema;
      if (useSearch) body.tools = [{ googleSearch: {} }];
      const url = `${BASE}/${MODEL}:generateContent?key=${encodeURIComponent(key)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error?.message || `Gemini ${res.status}`;
        throw new Error(msg);
      }
      const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
      if (!text.trim()) throw new Error("Gemini returned an empty answer.");
      try {
        return JSON.parse(text);
      } catch {
        const m = text.match(/\{[\s\S]*\}/);
        if (m) return JSON.parse(m[0]);
        throw new Error("Could not parse Gemini JSON.");
      }
    }

    async function enrichFoods(rawList) {
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
      /* One request for the whole list — local library after that. (No per-food calls.) */
      return generate({ prompt, schema, useSearch: false });
    }

    async function coach(snapshot) {
      const prompt = `You are a gentle health coach for Sapna (private, adult woman).
Use ONLY this snapshot. Do not invent exact medical diagnoses. Be practical and kind.
If period day or late luteal / menstrual phase, include food ideas that may ease cramps (iron, magnesium, hydration, warm meals) and exercise intensity advice.
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
      return generate({ prompt, schema, useSearch: false });
    }

    async function testKey() {
      const key = getKey();
      if (!key) return { ok: false, message: "Paste a Gemini API key first." };
      try {
        const url = `${BASE}/${MODEL}:generateContent?key=${encodeURIComponent(key)}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: 'Reply with JSON {"ok":true}' }] }],
            generationConfig: { responseMimeType: "application/json", temperature: 0 },
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { ok: false, message: data?.error?.message || `Gemini ${res.status}` };
        return { ok: true, message: "Gemini key works (2.5 Flash)." };
      } catch (e) {
        return { ok: false, message: e.message || "Could not reach Gemini." };
      }
    }

    return { getKey, saveKey, hasKey, enrichFoods, coach, testKey, MODEL };
  })();

  /* ───────── Coach UI (Path B — on-demand insights) ───────── */
  const Coach = (() => {
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
      };
    }

    function renderInto(el, data, meta) {
      if (!el) return;
      if (!data) {
        el.innerHTML = `<p class="hint">Tap <strong>Get insights</strong> once — uses 1 Gemini call. Daily logging stays offline.</p>`;
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

    function paint() {
      const cached = loadCached();
      renderInto($("coach-body"), cached?.result, cached?.at ? `Saved ${cached.at} · re-run when you want a fresh take` : "");
      renderInto($("admin-coach-body"), cached?.result, cached?.at ? `From ${cached.at}` : "");
      const adminEx = $("admin-coach-exercises");
      if (adminEx) {
        const ideas = cached?.result?.exerciseIdeas || [];
        adminEx.innerHTML = ideas.length
          ? `<ul class="coach-list coach-ex">${ideas
              .map(
                (ex) =>
                  `<li><strong>${escapeHtml(ex.name)}</strong><span class="meta">${escapeHtml(ex.when)} — ${escapeHtml(ex.why)}</span></li>`
              )
              .join("")}</ul>`
          : `<p class="hint">Run Insights on Today first — ideas appear here for planning.</p>`;
      }
    }

    async function run({ statusEl } = {}) {
      if (!Gemini.hasKey()) {
        setStatus(statusEl, "Add Gemini API key in Admin (one key, phone-only).", "error");
        return null;
      }
      setStatus(statusEl, "Asking Gemini once (compact snapshot)…", "info");
      try {
        const snap = buildSnapshot();
        const result = await Gemini.coach(snap);
        const payload = { at: new Date().toISOString(), result };
        saveCached(payload);
        paint();
        setStatus(statusEl, "Insights updated — 1 Gemini call used.", "ok");
        return result;
      } catch (e) {
        setStatus(statusEl, e.message || String(e), "error");
        return null;
      }
    }

    function wire() {
      $("coach-run")?.addEventListener("click", () => run({ statusEl: $("coach-status") }));
      $("admin-coach-run")?.addEventListener("click", () => run({ statusEl: $("admin-coach-status") }));
      paint();
    }

    return { wire, paint, run, loadCached, buildSnapshot };
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
    });
    let foods = [];
    let defaults = { targets: { kcal: 1800, protein: 100 } };
    let state = loadJSON(LS.diet, { targets: null, day: emptyDay(), customFoods: [], recentFoodIds: [] });

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

    function totals() {
      ensureDay();
      let kcal = 0;
      let protein = 0;
      MEALS.forEach(({ id }) => {
        (state.day[id] || []).forEach((item) => {
          const s = Number(item.servings) || 1;
          kcal += (Number(item.kcal) || 0) * s;
          protein += (Number(item.protein) || 0) * s;
        });
      });
      return { kcal: Math.round(kcal), protein: Math.round(protein * 10) / 10 };
    }

    function slotKcal(slot) {
      return Math.round(
        (state.day[slot] || []).reduce(
          (a, item) => a + (Number(item.kcal) || 0) * (Number(item.servings) || 1),
          0
        )
      );
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
      pushRecent(food.id);
      markDietLogged(state.day.date || todayISO());
      persist();
      render();
      if (typeof Progress !== "undefined" && Progress.render) Progress.render();
    }

    function removeItem(meal, index) {
      ensureDay();
      state.day[meal].splice(index, 1);
      persist();
      render();
    }

    function localMatches(query) {
      const q = String(query || "").toLowerCase().trim();
      let list = allFoods();
      if (q) {
        list = list.filter(
          (f) =>
            f.name.toLowerCase().includes(q) ||
            (f.tags || []).some((t) => String(t).toLowerCase().includes(q))
        );
      }
      return list.slice(0, 48);
    }

    function recentFoods() {
      const ids = state.recentFoodIds || [];
      return ids.map((id) => findFood(id)).filter(Boolean).slice(0, 8);
    }

    function foodButtonHtml(f) {
      return `<button type="button" class="hf-food-btn" data-food-id="${escapeHtml(f.id)}">
        <span class="hf-food-name">${escapeHtml(f.name)}</span>
        <em>${f.kcal} kcal · ${f.protein}g P</em>
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
        hint.textContent = `Adding to ${label}`;
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

      const totalsRoot = $("diet-totals");
      if (totalsRoot) {
        const kcalPct = Math.max(0, Math.min(100, Math.round((tot.kcal / (t.kcal || 1)) * 100)));
        const proPct = Math.max(0, Math.min(100, Math.round((tot.protein / (t.protein || 1)) * 100)));
        totalsRoot.innerHTML = `
          <div class="hf-remain-card ${over ? "is-over" : ""}">
            <p class="hf-remain-kicker">${over ? "Over target" : "Calories left"}</p>
            <p class="hf-remain-num"><strong>${over ? tot.kcal - t.kcal : left}</strong>
              <span>${over ? "kcal over" : "kcal"}</span></p>
            <div class="hf-remain-meta">
              <span><b>${tot.kcal}</b> eaten</span>
              <span><b>${t.kcal}</b> goal</span>
              <span><b>${tot.protein}g</b> / ${t.protein}g protein</span>
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
          const items = state.day[id] || [];
          const sk = slotKcal(id);
          const lis = items.length
            ? items
                .map((item, i) => {
                  const s = Number(item.servings) || 1;
                  return `<li>
                    <div>
                      <div>${escapeHtml(item.name)}${s !== 1 ? ` × ${s}` : ""}</div>
                      <div class="meta">${Math.round(item.kcal * s)} kcal · ${Math.round(item.protein * s * 10) / 10}g</div>
                    </div>
                    <button type="button" data-remove="${id}:${i}" aria-label="Remove">✕</button>
                  </li>`;
                })
                .join("")
            : `<li class="hf-meal-empty">Nothing logged — tap <strong>+ Add</strong></li>`;
          return `<section class="hf-meal-card meal-slot${id === active ? " is-active-meal" : ""}" data-meal-slot="${id}">
            <header class="hf-meal-head">
              <div>
                <h3>${label}</h3>
                <p class="hf-meal-kcal">${sk} kcal · ${items.length} item${items.length === 1 ? "" : "s"}</p>
              </div>
              <button type="button" class="hf-add-btn" data-add-meal="${id}">+ Add</button>
            </header>
            <ul class="food-list">${lis}</ul>
          </section>`;
        }).join("");
      }

      $("diet-meal-chips")?.querySelectorAll(".meal-chip").forEach((c) => {
        const on = c.getAttribute("data-meal") === ($("diet-meal")?.value || "breakfast");
        c.classList.toggle("is-active", on);
        c.setAttribute("aria-selected", on ? "true" : "false");
      });
      renderFoodPick($("diet-search")?.value || "");
      if (typeof Today !== "undefined" && Today.render && document.body.dataset.section === "today") {
        Today.render();
      }
    }

    function wire() {
      $("diet-regular-run")?.addEventListener("click", () => bootstrapRegularFoods());
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
        const meal = $("diet-meal")?.value || "breakfast";
        const servings = $("diet-servings")?.value || 1;
        addItem(food, meal, servings);
        setStatus($("diet-status"), `Added ${food.name}`, "ok");
        if ($("diet-search")) $("diet-search").value = "";
        renderFoodPick("");
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
        const [fRes, dRes] = await Promise.all([
          fetch("./data/foods.json?v=20261011hf"),
          fetch("./data/diet-defaults.json?v=20261011hf"),
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
      renderFoodPick($("diet-search")?.value || "");
    }


    function todayPlate() {
      ensureDay();
      const out = [];
      MEALS.forEach(({ id, label }) => {
        (state.day[id] || []).forEach((item) => {
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

    function importGeminiFoods(foods) {
      const rows = Array.isArray(foods) ? foods : [];
      let n = 0;
      state.customFoods = state.customFoods || [];
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
          tags: ["regular", "gemini"],
        };
        if (existing >= 0) state.customFoods[existing] = row;
        else state.customFoods.push(row);
        n += 1;
      });
      persist();
      render();
      return n;
    }

    async function bootstrapRegularFoods() {
      const raw = $("diet-regular-list")?.value || "";
      const st = $("diet-regular-status");
      if (!Gemini.hasKey()) {
        setStatus(st, "Add Gemini API key in Admin first.", "error");
        return;
      }
      setStatus(st, "One Gemini call for your whole list…", "info");
      try {
        const data = await Gemini.enrichFoods(raw);
        const n = importGeminiFoods(data.foods || []);
        setStatus(st, `Added/updated ${n} foods in your library. Log meals offline from now.`, "ok");
        renderFoodPick($("diet-search")?.value || "");
      } catch (e) {
        setStatus(st, e.message || String(e), "error");
      }
    }

    function getTargetsForAdmin() {
      return targets();
    }

    function snapshot() {
      const tg = targets();
      const tot = totals();
      const left = Math.max(0, Math.round(tg.kcal - tot.kcal));
      ensureDay();
      const mealFill = {};
      MEALS.forEach(({ id }) => {
        mealFill[id] = (state.day[id] || []).length > 0;
      });
      return {
        kcal: tot.kcal,
        protein: tot.protein,
        targetKcal: tg.kcal,
        targetProtein: tg.protein,
        left,
        over: tot.kcal > tg.kcal,
        mealFill,
      };
    }

    return {
      init,
      render,
      getTargetsForAdmin,
      snapshot,
      dietLoggedDates,
      focusAddForMeal,
      todayPlate,
      importGeminiFoods,
      bootstrapRegularFoods,
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

      if (streakRoot) {
        streakRoot.innerHTML = `
        <section class="prog-card prog-streak-card">
          <div class="prog-streak-head">
            <div class="prog-flame" aria-hidden="true">✦</div>
            <div>
              <p class="prog-kicker">Workout streak</p>
              <p class="prog-streak-count"><strong>${streakDays}</strong> <span>day${streakDays === 1 ? "" : "s"}</span></p>
              <p class="prog-streak-sub">${streakWeeks ? `${streakWeeks} week${streakWeeks === 1 ? "" : "s"} with a lift` : "Log a lift to start"} · ${dietN ? `Diet ${dietN}d` : "Diet —"}</p>
            </div>
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


    $("admin-save-gemini")?.addEventListener("click", async () => {
      const btn = $("admin-save-gemini");
      let key = ($("admin-gemini-key")?.value || "").trim();
      if ((!key || key.startsWith("••")) && Gemini.getKey()) key = Gemini.getKey();
      if (!key) {
        setKeyBadge("admin-gemini-badge", "error", "Missing");
        setStatus($("admin-status"), "Paste a Gemini API key from Google AI Studio.", "error");
        return;
      }
      Gemini.saveKey(key);
      if (btn) btn.disabled = true;
      setKeyBadge("admin-gemini-badge", "info", "Checking…");
      setStatus($("admin-status"), "Testing Gemini…", "info");
      const result = await Gemini.testKey();
      if (btn) btn.disabled = false;
      if (!result.ok) {
        setKeyBadge("admin-gemini-badge", "error", "Invalid");
        setStatus($("admin-status"), result.message, "error");
        return;
      }
      if ($("admin-gemini-key")) {
        $("admin-gemini-key").value = "";
        $("admin-gemini-key").placeholder = "Key saved — paste to replace";
      }
      setKeyBadge("admin-gemini-badge", "ok", "✓ Working");
      setStatus($("admin-status"), result.message + " Saved on this phone.", "ok");
    });
    $("admin-clear-gemini")?.addEventListener("click", () => {
      Gemini.saveKey("");
      if ($("admin-gemini-key")) {
        $("admin-gemini-key").value = "";
        $("admin-gemini-key").placeholder = "AIza…";
      }
      setKeyBadge("admin-gemini-badge", null);
      setStatus($("admin-status"), "Gemini key cleared.", "info");
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
      forceAdminOverlay($("admin-editor"));
      const t = Diet.getTargetsForAdmin();
      if ($("admin-kcal")) $("admin-kcal").value = t.kcal;
      if ($("admin-protein")) $("admin-protein").value = t.protein;
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
      if (Gemini.hasKey()) {
        setKeyBadge("admin-gemini-badge", "info", "Saved");
        if ($("admin-gemini-key")) $("admin-gemini-key").placeholder = "Key saved — paste to replace";
      } else {
        setKeyBadge("admin-gemini-badge", null);
      }
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
    wireNav();
    wireAdmin();
    try {
      if (window.SapnaPlanAdmin?.wire) window.SapnaPlanAdmin.wire();
      if (window.SapnaPlanAdmin?.boot) await window.SapnaPlanAdmin.boot();
    } catch (err) {
      console.error("Plan admin failed to wire", err);
    }
    /* Ask for PAT first on a fresh phone — powers logs, periods, Admin */
    TokenSetup.promptIfNeeded();
    await Weights.init();
    await Diet.init();
    await Periods.init();
    await Workout.init();
    Coach.wire();
    /* Re-apply per-exercise Last: lines after plan + cloud weights are both ready */
    if (Workout.refreshSummaries) Workout.refreshSummaries();
    else Workout.render();
    showPanel(location.hash.replace(/^#/, "") || "today");
  }

  init();
})();
