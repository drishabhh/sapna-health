window.SapnaPlanAdmin = (() => {
  const REPO = { owner: "drishabhh", name: "sapna-health", branch: "main" };
  const PLAN_PATH = "data/today.json";
  const LS_TOKEN = "sapna_gh_token";
  const SS_UNLOCKED = "sapna_admin_unlocked";

  const LIBRARY_PATH = "data/gif-library.json";
  const FALLBACK_GIFS = [
    { id: "local-arm-circles", name: "Arm circles", path: "media/arm-circles.gif", thumb: "media/arm-circles.gif", group: "stretching", bodyPart: "arms", aliases: ["arm circle"] },
    { id: "local-lat-pulldown", name: "Lat pulldown", path: "media/lat-pulldown.gif", thumb: "media/lat-pulldown.gif", group: "exercises", bodyPart: "back", aliases: ["lat pull down", "lat pull-down"] },
    { id: "local-chest-press", name: "Chest press", path: "media/chest-press.gif", thumb: "media/chest-press.gif", group: "exercises", bodyPart: "chest", aliases: [] },
  ];

  /** @type {any} */
  let gifLibrary = {
    groups: [
      { id: "stretching", label: "Stretching" },
      { id: "exercises", label: "Exercises" },
    ],
    bodyParts: [
      { id: "dumbbell", label: "Dumbbell", kind: "equipment" },
      { id: "back", label: "Back" },
      { id: "chest", label: "Chest" },
      { id: "shoulders", label: "Shoulders" },
      { id: "arms", label: "Arms" },
      { id: "legs", label: "Legs" },
      { id: "core", label: "Core" },
      { id: "cardio", label: "Cardio" },
      { id: "full-body", label: "Full body" },
    ],
    gifs: FALLBACK_GIFS,
  };

  /** @type {{moveIndex:number, level:string, group:string, bodyPart:string, query:string, mode:string}} */
  let gifBrowser = { moveIndex: -1, level: "root", group: "", bodyPart: "", equipment: "", query: "", mode: "edit" };

  /** @type {{step:string, kind:string, group:string, name:string, gif:string, rx:string}} */
  let addWizard = { step: "type", kind: "main", group: "exercises", name: "", gif: "", rx: "" };

  const DEFAULT_PLAN = {
    updatedAt: null,
    headline: "Aaj ka workout",
    support: "Stretch · move · lift — every demo ready when she is.",
    restNote: {
      title: "Rest & water",
      body: "Rest 1–1.5 min between sets. Drink water — not cold; warm or room temp, sip by sip.",
      bodyHtml:
        "<strong>Rest 1–1.5 min</strong> between sets. Drink water — <em>not cold</em>; warm or room temp, sip by sip.",
    },
    sections: [
      {
        id: "stretching",
        eyebrow: "Warm-up",
        title: "Stretching",
        subtitle: "10 reps each — easy and controlled",
        kind: "stretch",
        moves: [
          { id: "arm-circles", name: "Arm circles", rx: "10 reps each direction", gif: "media/arm-circles.gif", demo: "img" },
          { id: "torso-rotations", name: "Torso rotations", rx: "10 reps each side", gif: "media/torso-rotations.gif", demo: "img" },
          { id: "leg-swings", name: "Leg swings", rx: "10 reps each leg — hold a wall if needed", gif: "", demo: "svg-leg-swing" },
          { id: "bodyweight-squats", name: "Bodyweight squats", rx: "10 reps — warm-up pace", gif: "media/bodyweight-squats.gif", demo: "img" },
        ],
      },
      {
        id: "exercise",
        eyebrow: "Main session",
        title: "Exercise",
        subtitle: "Cardio pehle, phir strength — follow the prescriptions",
        kind: "main",
        moves: [
          { id: "cycle-walk", name: "Cycle / treadmill walk", rx: "3 min cycle (normal pace) ya 5 min walk", gif: "media/cycle-walk.gif", demo: "img" },
          { id: "chest-press", name: "Chest press flat bench", rx: "5 kg · 2 sets × 12", gif: "media/chest-press.gif", demo: "img" },
          { id: "shoulder-press", name: "Shoulder press", rx: "2.5 kg · 2 sets × 12", gif: "media/shoulder-press.gif", demo: "img" },
          { id: "lat-pulldown", name: "Lat pull down", rx: "20 kg · 2 sets × 12", gif: "media/lat-pulldown.gif", demo: "img" },
          { id: "cable-row", name: "Seated Cable Row", rx: "20 kg · 2 sets × 12", gif: "media/cable-row.gif", demo: "img" },
          { id: "leg-curl", name: "Seated Leg Curl", rx: "15–20 kg · 2 sets × 12", gif: "media/leg-curl.gif", demo: "img" },
          { id: "db-squats", name: "Dumbbell squats", rx: "7.5 kg · 2 sets × 12", gif: "media/db-squats.gif", demo: "img" },
        ],
      },
    ],
  };

  function clone(value) {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  /** @type {any} */
  let currentPlan = clone(DEFAULT_PLAN);
  /** @type {Array<{id:string,name:string,rx:string,gif:string,demo:string,kind:string,pendingFile?:File|null}>} */
  let draftMoves = [];

  const $ = (id) => document.getElementById(id);

  function slugify(text) {
    return String(text || "move")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "move";
  }

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  }

  function formatRx(rx) {
    return escapeHtml(rx || "").replace(/\bya\b/gi, '<span class="or">ya</span>');
  }

  function legSwingSvg() {
    return `<figure class="demo demo-svg" aria-label="Animated demo of forward and back leg swings">
      <svg class="leg-swing" viewBox="0 0 240 280" role="img" aria-labelledby="legSwingTitle">
        <title id="legSwingTitle">Leg swings demo</title>
        <rect width="240" height="280" fill="#0f2f2c" rx="12"/>
        <line x1="40" y1="230" x2="200" y2="230" stroke="#3d6b64" stroke-width="4"/>
        <g transform="translate(110,70)">
          <circle cx="0" cy="0" r="14" fill="#f3e6d0"/>
          <rect x="-10" y="12" width="20" height="48" rx="8" fill="#7ec8b8"/>
          <rect x="-8" y="58" width="12" height="70" rx="6" fill="#f3e6d0"/>
          <rect x="-18" y="122" width="28" height="10" rx="4" fill="#e8a838"/>
          <g class="swing-leg">
            <rect x="2" y="58" width="12" height="72" rx="6" fill="#f3e6d0"/>
            <rect x="-2" y="124" width="28" height="10" rx="4" fill="#e8a838"/>
          </g>
          <rect x="-28" y="28" width="18" height="10" rx="4" fill="#f3e6d0" transform="rotate(-25 -19 33)"/>
          <rect x="10" y="28" width="18" height="10" rx="4" fill="#f3e6d0" transform="rotate(25 19 33)"/>
        </g>
      </svg>
    </figure>`;
  }

  function resolveGifSrc(move) {
    if (move?.gif) return move.gif;
    if (move?.demo === "svg-leg-swing") return "media/leg-swings.gif";
    return "media/bodyweight-squats.gif";
  }

  /** Compact preview above LOG — lazy via data-src + IntersectionObserver */
  function moveGifPreviewHtml(move) {
    const name = move.name || "Move";
    if (move.demo === "svg-leg-swing" && !move.gif) {
      /* Prefer real GIF when available; SVG kept as admin/offline fallback via lightbox kind */
      const src = "media/leg-swings.gif";
      return `<button type="button" class="gif-preview" data-gif-open data-gif-src="${escapeAttr(src)}" aria-label="Enlarge form demo for ${escapeAttr(name)}">
        <span class="gif-preview-frame">
          <img data-src="${escapeAttr(src)}" alt="" width="320" height="140" decoding="async" />
        </span>
        <span class="gif-preview-hint">Tap to enlarge</span>
      </button>`;
    }
    const src = resolveGifSrc(move);
    return `<button type="button" class="gif-preview" data-gif-open data-gif-src="${escapeAttr(src)}" aria-label="Enlarge form demo for ${escapeAttr(name)}">
      <span class="gif-preview-frame">
        <img data-src="${escapeAttr(src)}" alt="" width="320" height="140" decoding="async" />
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
    const svgHost = $("gif-lightbox-svg");
    const label = $("gif-lightbox-title");
    if (!overlay) return;
    if (label) label.textContent = title || "Form demo";
    if (kind === "svg") {
      if (img) {
        img.hidden = true;
        img.removeAttribute("src");
      }
      if (svgHost) {
        svgHost.hidden = false;
        svgHost.innerHTML = legSwingSvg();
      }
    } else {
      if (svgHost) {
        svgHost.hidden = true;
        svgHost.innerHTML = "";
      }
      if (img) {
        img.hidden = false;
        img.alt = title ? `Form demo: ${title}` : "Form demo";
        img.src = src || "";
      }
    }
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
      const svgHost = $("gif-lightbox-svg");
      if (svgHost) svgHost.innerHTML = "";
    }, 220);
  }

  function wireGifLightbox() {
    const root = $("sections");
    if (root && root.dataset.gifWired !== "1") {
      root.dataset.gifWired = "1";
      root.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-gif-open]");
        if (!btn) return;
        e.preventDefault();
        const card = btn.closest(".move");
        const title = card?.querySelector("h3")?.textContent?.trim() || "Form demo";
        const kind = btn.getAttribute("data-gif-kind") || "img";
        const src = btn.getAttribute("data-gif-src") || btn.querySelector("img")?.getAttribute("data-src") || btn.querySelector("img")?.src || "";
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

  function escapeAttr(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }


  function htmlToPlainText(html) {
    if (!html) return "";
    const tmp = document.createElement("div");
    // normalize br/p to newlines before textContent
    const normalized = String(html)
      .replace(/<\s*br\s*\/?\s*>/gi, "\n")
      .replace(/<\s*\/\s*p\s*>/gi, "\n")
      .replace(/<\s*p[^>]*>/gi, "");
    tmp.innerHTML = normalized;
    return (tmp.textContent || "").replace(/\u00a0/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  }

  function plainTextToRestHtml(text) {
    const plain = String(text || "").replace(/\r\n/g, "\n").trim();
    if (!plain) return DEFAULT_PLAN.restNote.bodyHtml;
    return escapeHtml(plain).replace(/\n/g, "<br>");
  }

  function applyOrderNumber(fromIndex, requestedOrder) {
    syncDraftFromDom();
    const n = draftMoves.length;
    if (!n) return;
    let target = Number(requestedOrder);
    if (!Number.isFinite(target)) target = fromIndex + 1;
    target = Math.max(1, Math.min(n, Math.round(target)));
    const item = draftMoves[fromIndex];
    if (!item) return;
    const without = draftMoves.filter((_, i) => i !== fromIndex);
    without.splice(target - 1, 0, item);
    draftMoves = without;
    renderAdminMoves();
  }



  /* ── Exercise weight logs (device + cloud sync via sapna-health) ── */
  const WEIGHTS_LS = "sapna_health_weights_v1";
  const WEIGHTS_CLOUD_URL = "https://drishabhh.github.io/sapna-health/data/weights.json";
  const WEIGHTS_REPO = { owner: "drishabhh", name: "sapna-health", branch: "main" };
  const WEIGHTS_PATH = "data/weights.json";
  let logSheetExercise = "";
  let logSheetEditingId = null;
  let logSheetScrollY = 0;
  let weightsAutoSyncTimer = 0;

  function loadWeightLogs() {
    try {
      const raw = localStorage.getItem(WEIGHTS_LS);
      if (!raw) return { entries: [], deletedIds: [] };
      const data = JSON.parse(raw);
      return {
        entries: Array.isArray(data.entries) ? data.entries : [],
        deletedIds: Array.isArray(data.deletedIds) ? data.deletedIds.map(String) : [],
      };
    } catch {
      return { entries: [], deletedIds: [] };
    }
  }

  function saveWeightLogs(data) {
    localStorage.setItem(
      WEIGHTS_LS,
      JSON.stringify({
        entries: Array.isArray(data.entries) ? data.entries : [],
        deletedIds: Array.isArray(data.deletedIds) ? data.deletedIds.map(String) : [],
      })
    );
  }

  function mergeWeightCloud(cloud) {
    if (!cloud || !Array.isArray(cloud.entries)) return 0;
    const data = loadWeightLogs();
    const deleted = new Set([
      ...(data.deletedIds || []).map(String),
      ...(Array.isArray(cloud.deletedIds) ? cloud.deletedIds.map(String) : []),
    ]);
    const byId = new Map(
      data.entries
        .filter((e) => e && e.id != null && !deleted.has(String(e.id)))
        .map((e) => [String(e.id), e])
    );
    let added = 0;
    cloud.entries.forEach((e) => {
      if (!e || e.id == null) return;
      if ((e.kind || "main") === "stretch") return;
      const key = String(e.id);
      if (deleted.has(key) || byId.has(key)) return;
      byId.set(key, { ...e, kind: "main" });
      added += 1;
    });
    const next = { entries: [...byId.values()], deletedIds: [...deleted] };
    if (added || next.deletedIds.length !== (data.deletedIds || []).length || next.entries.length !== data.entries.length) {
      saveWeightLogs(next);
    }
    return added;
  }

  async function pullWeightCloud() {
    try {
      const res = await fetch(`${WEIGHTS_CLOUD_URL}?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) return 0;
      const added = mergeWeightCloud(await res.json());
      /* Always refresh per-exercise Last: lines (not only when new ids arrive) */
      refreshMoveLogSummaries();
      updateSessionSteps();
      return added;
    } catch {
      return 0;
    }
  }

  async function githubPutHealthFile(path, contentBase64, message, token) {
    const api = `https://api.github.com/repos/${WEIGHTS_REPO.owner}/${WEIGHTS_REPO.name}/contents/${path}`;
    let sha;
    const getRes = await fetch(api, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
    });
    if (getRes.ok) {
      const cur = await getRes.json();
      sha = cur.sha;
    }
    const body = { message, content: contentBase64, branch: WEIGHTS_REPO.branch };
    if (sha) body.sha = sha;
    const putRes = await fetch(api, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!putRes.ok) {
      const err = await putRes.json().catch(() => ({}));
      throw new Error(err.message || `GitHub ${putRes.status}`);
    }
  }

  function b64EncodeUnicodeWeights(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  async function publishWeightCloud() {
    const token = localStorage.getItem(LS_TOKEN) || "";
    if (!token) return false;
    await pullWeightCloud();
    const data = loadWeightLogs();
    const deleted = new Set((data.deletedIds || []).map(String));
    const entries = (data.entries || []).filter(
      (e) => (e.kind || "main") === "main" && e && e.id != null && !deleted.has(String(e.id))
    );
    const payload = {
      version: 1,
      updatedAt: new Date().toISOString(),
      label: "Sapna lift logs — synced across her phones via Pages.",
      entries,
      deletedIds: [...deleted],
    };
    await githubPutHealthFile(
      WEIGHTS_PATH,
      b64EncodeUnicodeWeights(JSON.stringify(payload, null, 2) + "\n"),
      `Update lift logs (${todayISO()})`,
      token
    );
    return true;
  }

  function scheduleWeightAutoSync() {
    if (!localStorage.getItem(LS_TOKEN)) return;
    if (weightsAutoSyncTimer) clearTimeout(weightsAutoSyncTimer);
    weightsAutoSyncTimer = setTimeout(() => {
      weightsAutoSyncTimer = 0;
      publishWeightCloud().catch(() => {});
    }, 1400);
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
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

  function entriesForExercise(name) {
    const n = normExercise(name);
    return loadWeightLogs()
      .entries.filter((e) => (e.kind || "main") === "main" && normExercise(e.exercise) === n)
      .sort((a, b) => a.date.localeCompare(b.date) || Number(a.id) - Number(b.id));
  }

  function lastWeightFor(name) {
    const entries = entriesForExercise(name);
    return entries[entries.length - 1] || null;
  }

  function addWeightLog({ exercise, weight, sets, reps }) {
    const data = loadWeightLogs();
    const s = Number(sets);
    const r = Number(reps);
    data.entries.push({
      id: Date.now() + Math.floor(Math.random() * 999),
      exercise,
      weight: Number(weight),
      date: todayISO(),
      sets: Number.isFinite(s) ? s : null,
      reps: Number.isFinite(r) ? r : null,
      rx: Number.isFinite(s) && Number.isFinite(r) ? `${s} × ${r}` : "",
      note: "",
      kind: "main",
    });
    saveWeightLogs(data);
    scheduleWeightAutoSync();
  }

  function getWeightLog(id) {
    const key = String(id);
    return loadWeightLogs().entries.find((e) => String(e.id) === key) || null;
  }

  function updateWeightLog(id, { weight, sets, reps } = {}) {
    const data = loadWeightLogs();
    const key = String(id);
    const idx = data.entries.findIndex((e) => String(e.id) === key);
    if (idx < 0) return false;
    const cur = data.entries[idx];
    const s = sets != null && sets !== "" ? Number(sets) : entrySets(cur);
    const r = reps != null && reps !== "" ? Number(reps) : entryReps(cur);
    const w = weight != null && weight !== "" ? Number(weight) : Number(cur.weight);
    if (!Number.isFinite(w) || !Number.isFinite(s) || !Number.isFinite(r)) return false;
    data.entries[idx] = {
      ...cur,
      weight: w,
      sets: s,
      reps: r,
      rx: `${s} × ${r}`,
      kind: "main",
    };
    saveWeightLogs(data);
    scheduleWeightAutoSync();
    return true;
  }

  function removeWeightLog(id) {
    const data = loadWeightLogs();
    const key = String(id);
    const before = data.entries.length;
    data.entries = data.entries.filter((e) => String(e.id) !== key);
    if (data.entries.length === before) return false;
    const deleted = new Set((data.deletedIds || []).map(String));
    deleted.add(key);
    data.deletedIds = [...deleted];
    saveWeightLogs(data);
    scheduleWeightAutoSync();
    return true;
  }

  function lastLogSummary(name) {
    const last = lastWeightFor(name);
    if (!last) return "Tap LOG to record";
    const s = entrySets(last);
    const r = entryReps(last);
    const sr = Number.isFinite(s) && Number.isFinite(r) ? ` · ${s}×${r}` : "";
    return `Last: ${last.weight} kg · ${last.date}${sr}`;
  }

  function moveLogHtml(move, sectionKind) {
    if (sectionKind === "stretch") return "";
    const name = move.name || "Move";
    return `<div class="move-log" data-move-name="${escapeAttr(name)}">
      <p class="move-log-last">${escapeHtml(lastLogSummary(name))}</p>
      <button type="button" class="btn-log-weight" data-log-open>LOG</button>
    </div>`;
  }

  function refreshMoveLogSummaries() {
    document.querySelectorAll(".move-log[data-move-name]").forEach((box) => {
      const name = box.getAttribute("data-move-name") || "";
      const last = box.querySelector(".move-log-last");
      if (last) last.textContent = lastLogSummary(name);
    });
  }

  function setLogSheetEditMode(id) {
    logSheetEditingId = id == null ? null : id;
    const banner = $("log-sheet-edit-banner");
    const save = $("log-sheet-save");
    const del = $("log-sheet-delete");
    const cancel = $("log-sheet-cancel");
    const editing = logSheetEditingId != null;
    if (banner) banner.hidden = !editing;
    if (save) save.textContent = editing ? "Update" : "Save entry";
    if (del) del.hidden = !editing;
    if (cancel) cancel.hidden = !editing;
    document.querySelectorAll("#log-sheet-tbody tr").forEach((tr) => {
      tr.classList.toggle("is-selected", String(tr.getAttribute("data-log-id")) === String(logSheetEditingId || ""));
    });
  }

  function clearLogSheetForm() {
    if ($("log-sheet-kg")) $("log-sheet-kg").value = "";
    if ($("log-sheet-sets")) $("log-sheet-sets").value = "";
    if ($("log-sheet-reps")) $("log-sheet-reps").value = "";
    setLogSheetEditMode(null);
  }

  function blurLogSheetInputs() {
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

  function hideLogSheetConfirm() {
    const panel = $("log-sheet-confirm");
    if (!panel) return;
    panel.hidden = true;
    panel.setAttribute("hidden", "");
  }

  function showLogSheetConfirm() {
    const panel = $("log-sheet-confirm");
    if (!panel) return;
    blurLogSheetInputs();
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

  function performLogSheetDelete() {
    if (logSheetEditingId == null) return;
    const id = logSheetEditingId;
    hideLogSheetConfirm();
    removeWeightLog(id);
    clearLogSheetForm();
    fillLogSheetTable();
    refreshMoveLogSummaries();
    updateSessionSteps();
    const status = $("log-sheet-status");
    if (status) {
      status.hidden = false;
      status.textContent = "Log deleted.";
      status.className = "log-sheet-status is-ok";
    }
  }

  function selectLogSheetRow(id) {
    const entry = getWeightLog(id);
    if (!entry) return;
    if ($("log-sheet-kg")) $("log-sheet-kg").value = String(entry.weight ?? "");
    if ($("log-sheet-sets")) $("log-sheet-sets").value = String(entrySets(entry) ?? "");
    if ($("log-sheet-reps")) $("log-sheet-reps").value = String(entryReps(entry) ?? "");
    setLogSheetEditMode(entry.id);
    fillLogSheetTable();
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

  function fillLogSheetTable() {
    const tbody = $("log-sheet-tbody");
    const empty = $("log-sheet-empty");
    if (!tbody) return;
    const rows = entriesForExercise(logSheetExercise);
    tbody.innerHTML = rows
      .map((e) => {
        const s = entrySets(e);
        const r = entryReps(e);
        const selected = logSheetEditingId != null && String(logSheetEditingId) === String(e.id);
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

  function syncLogSheetViewport() {
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

  function openLogSheet(name) {
    const overlay = $("log-sheet");
    const title = $("log-sheet-title");
    if (!overlay || !name) return;
    logSheetExercise = name;
    if (title) title.textContent = name;
    fillLogSheetTable();
    const status = $("log-sheet-status");
    if (status) {
      status.hidden = true;
      status.textContent = "";
    }
    clearLogSheetForm();
    logSheetScrollY = window.scrollY || 0;
    overlay.hidden = false;
    overlay.classList.add("is-open");
    document.body.classList.add("log-sheet-open");
    document.body.style.top = `-${logSheetScrollY}px`;
    syncLogSheetViewport();
    /* Focus after paint; avoid remounting — inputs are static in index.html */
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

  function closeLogSheet() {
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
    window.scrollTo(0, logSheetScrollY);
    logSheetExercise = "";
    logSheetEditingId = null;
    hideLogSheetConfirm();
    refreshMoveLogSummaries();
  }

  function wireMoveLogs() {
    const root = $("sections");
    if (root && root.dataset.logWired !== "1") {
      root.dataset.logWired = "1";
      root.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-log-open]");
        if (!btn) return;
        const box = btn.closest(".move-log");
        const name = box?.getAttribute("data-move-name") || "";
        if (name) openLogSheet(name);
      });
    }

    const overlay = $("log-sheet");
    if (!overlay || overlay.dataset.logWired === "1") return;
    overlay.dataset.logWired = "1";

    $("log-sheet-close")?.addEventListener("click", (e) => {
      e.preventDefault();
      closeLogSheet();
    });
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeLogSheet();
    });
    $("log-sheet-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const kg = Number($("log-sheet-kg")?.value);
      const sets = Number($("log-sheet-sets")?.value);
      const reps = Number($("log-sheet-reps")?.value);
      const status = $("log-sheet-status");
      if (!logSheetExercise || !Number.isFinite(kg)) {
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
      if (logSheetEditingId != null) {
        const ok = updateWeightLog(logSheetEditingId, { weight: kg, sets, reps });
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
          status.textContent = localStorage.getItem(LS_TOKEN)
            ? `Updated · ${kg} kg · ${sets}×${reps}. Syncing…`
            : `Updated · ${kg} kg · ${sets}×${reps}.`;
          status.className = "log-sheet-status is-ok";
        }
      } else {
        addWeightLog({ exercise: logSheetExercise, weight: kg, sets, reps });
        if (status) {
          status.hidden = false;
          status.textContent = localStorage.getItem(LS_TOKEN)
            ? `Saved ${kg} kg · ${sets}×${reps}. Syncing to other phones…`
            : `Saved ${kg} kg · ${sets}×${reps}. Save Admin PAT to sync phones.`;
          status.className = "log-sheet-status is-ok";
        }
      }
      clearLogSheetForm();
      fillLogSheetTable();
      refreshMoveLogSummaries();
      updateSessionSteps();
      try {
        $("log-sheet-kg")?.focus({ preventScroll: true });
      } catch (_) {}
    });
    $("log-sheet-cancel")?.addEventListener("click", (e) => {
      e.preventDefault();
      clearLogSheetForm();
      fillLogSheetTable();
      const status = $("log-sheet-status");
      if (status) {
        status.hidden = false;
        status.textContent = "Ready for a new entry.";
        status.className = "log-sheet-status is-ok";
      }
    });
    $("log-sheet-delete")?.addEventListener("click", (e) => {
      e.preventDefault();
      if (logSheetEditingId == null) return;
      showLogSheetConfirm();
    });
    $("log-sheet-confirm-cancel")?.addEventListener("click", (e) => {
      e.preventDefault();
      hideLogSheetConfirm();
    });
    $("log-sheet-confirm-ok")?.addEventListener("click", (e) => {
      e.preventDefault();
      performLogSheetDelete();
    });
    $("log-sheet-confirm")?.addEventListener("click", (e) => {
      if (e.target === $("log-sheet-confirm")) hideLogSheetConfirm();
    });
    $("log-sheet-tbody")?.addEventListener("click", (e) => {
      const row = e.target.closest("tr[data-log-id]");
      if (!row) return;
      selectLogSheetRow(row.getAttribute("data-log-id"));
    });
    $("log-sheet-tbody")?.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const row = e.target.closest("tr[data-log-id]");
      if (!row) return;
      e.preventDefault();
      selectLogSheetRow(row.getAttribute("data-log-id"));
    });

    const onVv = () => syncLogSheetViewport();
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", onVv);
      window.visualViewport.addEventListener("scroll", onVv);
    }
    window.addEventListener("resize", onVv);
  }


  function updateSessionSteps() {
    const plan = currentPlan || DEFAULT_PLAN;
    const sections = plan.sections || [];
    const stretch = sections.find((s) => s.kind === "stretch" || s.id === "stretching");
    const mains = sections
      .filter((s) => s.kind !== "stretch" && s.id !== "stretching")
      .flatMap((s) => s.moves || []);
    const logged = mains.filter((m) => lastWeightFor(m.name)).length;
    const anyLog = logged > 0;
    const allDone = mains.length > 0 && logged >= mains.length;
    const hasStretch = !!(stretch && (stretch.moves || []).length);

    document.querySelectorAll(".session-step").forEach((el) => {
      const step = el.getAttribute("data-step");
      el.classList.remove("is-active", "is-done");
      if (step === "stretch") {
        el.classList.add(anyLog || !hasStretch ? "is-done" : "is-active");
      } else if (step === "lift") {
        if (allDone) el.classList.add("is-done");
        else if (anyLog || !hasStretch) el.classList.add("is-active");
      } else if (step === "done" && allDone) {
        el.classList.add("is-active", "is-done");
      }
    });

    const bar = $("session-done-bar");
    if (bar) {
      bar.hidden = !allDone;
      if (allDone) {
        const p = bar.querySelector("p");
        if (p) {
          p.innerHTML = `<strong>Session complete.</strong> ${logged}/${mains.length} lifts logged on this phone.`;
        }
      }
    }

    const start = $("start-session");
    if (start) {
      start.setAttribute("href", hasStretch && !anyLog ? "#session-stretch" : "#session-lifts");
      start.textContent = allDone ? "Review session" : anyLog ? "Continue lifts" : "Start session";
    }
  }

  function renderPlan(plan) {
    try {
      if (window.Workout && typeof window.Workout.loadLocalPlan === 'function') {
        window.Workout.loadLocalPlan(plan);
      }
    } catch (_) {}
    /* original continues */
    currentPlan = plan;
    $("hero-headline").textContent = plan.headline || DEFAULT_PLAN.headline;
    /* Keep flow-oriented support; admin support still shown as secondary if present */
    const supportEl = $("hero-support");
    if (supportEl) {
      supportEl.textContent =
        plan.support || "Start → Stretch (view) → Lift & LOG — big targets, clear history.";
    }
    $("rest-title").textContent = plan.restNote?.title || DEFAULT_PLAN.restNote.title;
    const restPlain = plan.restNote?.body;
    $("rest-body").innerHTML = restPlain
      ? plainTextToRestHtml(restPlain)
      : (plan.restNote?.bodyHtml || DEFAULT_PLAN.restNote.bodyHtml);

    const root = $("sections");
    root.innerHTML = (plan.sections || [])
      .map((section) => {
        const sectionKind = section.kind === "stretch" || section.id === "stretching" ? "stretch" : "main";
        const sessionId = sectionKind === "stretch" ? "session-stretch" : "session-lifts";
        const stepLabel =
          sectionKind === "stretch"
            ? `<span class="block-step">1 · Stretch · view only</span>`
            : `<span class="block-step">2 · Lift · tap LOG</span>`;
        const moves = (section.moves || [])
          .map(
            (move) => `<li class="move" data-kind="${sectionKind}">
            <div class="move-copy">
              <h3>${escapeHtml(move.name)}</h3>
              <p class="rx">${formatRx(move.rx)}</p>
            </div>
            ${moveGifPreviewHtml(move)}
            ${moveLogHtml(move, sectionKind)}
          </li>`
          )
          .join("");
        return `<section class="block" id="${escapeAttr(section.id || sessionId)}" data-session="${sessionId}">
          <header class="block-head">
            ${stepLabel}
            <p class="eyebrow">${escapeHtml(section.eyebrow || "")}</p>
            <h2 id="${sessionId}">${escapeHtml(section.title || "")}</h2>
            <p class="block-sub">${escapeHtml(
              sectionKind === "stretch"
                ? "Warm up here — no weight logs on stretches."
                : section.subtitle || "Open LOG for kg · sets · reps."
            )}</p>
          </header>
          <ul class="moves">${moves}</ul>
        </section>`;
      })
      .join("");

    observeMoves();
    wireMoveLogs();
    wireGifLightbox();
    wireGifLazyLoad($("sections"));
    updateSessionSteps();
  }

  function observeMoves() {
    const moves = document.querySelectorAll(".move");
    moves.forEach((el) => el.classList.remove("is-visible"));
    if (!("IntersectionObserver" in window)) {
      moves.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
    );
    moves.forEach((el) => observer.observe(el));
  }

  async function loadPublishedPlan() {
    try {
      const res = await fetch(`${PLAN_PATH}?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const plan = await res.json();
      if (!plan?.sections?.length) throw new Error("empty plan");
      return plan;
    } catch {
      return clone(DEFAULT_PLAN);
    }
  }

  function flattenMoves(plan) {
    const out = [];
    for (const section of plan.sections || []) {
      for (const move of section.moves || []) {
        out.push({
          id: move.id || uid("move"),
          name: move.name || "",
          rx: move.rx || "",
          gif: move.gif || "",
          demo: move.demo || "img",
          kind: section.kind === "stretch" ? "stretch" : "main",
          pendingFile: null,
        });
      }
    }
    return out;
  }

  function buildPlanFromDraft() {
    const stretchMoves = draftMoves
      .filter((m) => m.kind === "stretch")
      .map(({ id, name, rx, gif, demo }) => ({
        id,
        name,
        rx,
        gif: demo === "svg-leg-swing" && !gif ? "" : gif,
        demo: gif ? "img" : demo || "img",
      }));
    const mainMoves = draftMoves
      .filter((m) => m.kind !== "stretch")
      .map(({ id, name, rx, gif, demo }) => ({
        id,
        name,
        rx,
        gif: demo === "svg-leg-swing" && !gif ? "" : gif,
        demo: gif ? "img" : demo || "img",
      }));

    return {
      updatedAt: new Date().toISOString(),
      headline: $("edit-headline").value.trim() || DEFAULT_PLAN.headline,
      support: $("edit-support").value.trim() || DEFAULT_PLAN.support,
      restNote: (() => {
        const title = $("edit-rest-title").value.trim() || DEFAULT_PLAN.restNote.title;
        const body = $("edit-rest-body").value.trim() || DEFAULT_PLAN.restNote.body || htmlToPlainText(DEFAULT_PLAN.restNote.bodyHtml);
        return { title, body, bodyHtml: plainTextToRestHtml(body) };
      })(),
      sections: [
        {
          id: "stretching",
          eyebrow: "Warm-up",
          title: "Stretching",
          subtitle: stretchMoves.length ? "Easy and controlled" : "No stretches today",
          kind: "stretch",
          moves: stretchMoves,
        },
        {
          id: "exercise",
          eyebrow: "Main session",
          title: "Exercise",
          subtitle: mainMoves.length ? "Follow the prescriptions" : "No main moves today",
          kind: "main",
          moves: mainMoves,
        },
      ].filter((s) => s.moves.length > 0),
    };
  }

  function fillEditorFromPlan(plan) {
    $("edit-headline").value = plan.headline || "";
    $("edit-support").value = plan.support || "";
    $("edit-rest-title").value = plan.restNote?.title || "";
    $("edit-rest-body").value =
      plan.restNote?.body ||
      htmlToPlainText(plan.restNote?.bodyHtml || DEFAULT_PLAN.restNote.bodyHtml) ||
      DEFAULT_PLAN.restNote.body ||
      "";
    draftMoves = flattenMoves(plan);
    renderAdminMoves();
  }

  function setStatus(el, message, kind = "info") {
    const targets = [el, el && el.id === "publish-status" ? document.getElementById("admin-status") : null].filter(Boolean);
    const unique = [...new Set(targets)];
    unique.forEach((node) => {
      if (!message) {
        node.hidden = true;
        node.textContent = "";
        node.className = node.id === "admin-status" ? "status admin-status-sticky" : "admin-status";
        return;
      }
      node.hidden = false;
      node.textContent = message;
      if (node.id === "admin-status") node.className = "status admin-status-sticky is-" + kind;
      else node.className = `admin-status is-${kind}`;
    });
  }

  function previewSrcForMove(move) {
    if (move.pendingFile) {
      if (!move._objectUrl) move._objectUrl = URL.createObjectURL(move.pendingFile);
      return move._objectUrl;
    }
    if (move.gif) return move.gif;
    if (move.demo === "svg-leg-swing") return "";
    return "";
  }

  async function loadGifLibrary() {
    try {
      const res = await fetch(`${LIBRARY_PATH}?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      if (data?.gifs?.length) {
        gifLibrary = {
          groups: data.groups || gifLibrary.groups,
          bodyParts: data.bodyParts || gifLibrary.bodyParts,
          gifs: data.gifs,
        };
      }
    } catch (err) {
      console.warn("GIF library load failed, using fallback", err);
    }
  }

  function normalizeQuery(q) {
    return String(q || "")
      .toLowerCase()
      .replace(/[-_]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function gifMatchesQuery(g, q) {
    if (!q) return true;
    const hay = normalizeQuery(
      [g.name, g.id, g.muscle, g.equipment, g.bodyPart, g.group, ...(g.aliases || [])].join(" ")
    );
    const compact = hay.replace(/\s+/g, "");
    const qCompact = q.replace(/\s+/g, "");
    if (hay.includes(q) || compact.includes(qCompact)) return true;
    // all tokens must appear
    return q.split(" ").filter(Boolean).every((tok) => hay.includes(tok) || compact.includes(tok));
  }

  function isDumbbellGif(g) {
    if (g?.isDumbbell) return true;
    const eq = String(g?.equipment || "").toLowerCase();
    if (eq === "dumbbell") return true;
    const hay = normalizeQuery([g?.name, g?.id, ...(g?.aliases || [])].join(" "));
    return hay.includes("dumbbell") || /(^|\s)db(\s|$)/.test(hay);
  }

  function filterLibrary({ group, bodyPart, query, equipment } = {}) {
    const q = normalizeQuery(query);
    let list = gifLibrary.gifs || [];
    if (group) list = list.filter((g) => g.group === group || (!g.group && group === "exercises"));
    const equip = equipment || (bodyPart === "dumbbell" ? "dumbbell" : "");
    if (equip === "dumbbell") {
      list = list.filter((g) => isDumbbellGif(g));
    }
    if (bodyPart && bodyPart !== "dumbbell") {
      list = list.filter((g) => (g.bodyPart || "full-body") === bodyPart);
    }
    if (q) list = list.filter((g) => gifMatchesQuery(g, q));
    return list;
  }

  function anatomicalBodyParts() {
    return (gifLibrary.bodyParts || []).filter((p) => p.kind !== "equipment" && p.id !== "dumbbell");
  }

  function openOverlayEl(el) {
    if (!el) return;
    el.hidden = false;
    el.removeAttribute("hidden");
    el.classList.add("is-open");
    el.style.cssText =
      "display:flex !important; position:fixed !important; inset:0 !important; z-index:100070 !important; opacity:1 !important; visibility:visible !important; pointer-events:auto !important; background:rgba(12,22,20,0.72);";
    document.body.classList.add("modal-open","plan-admin-open");
  }

  function closeOverlayEl(el) {
    if (!el) return;
    el.hidden = true;
    el.setAttribute("hidden", "");
    el.classList.remove("is-open");
    el.style.cssText = "";
  }

  function openGifBrowser(moveIndex, opts = {}) {
    const mode = opts.mode || "edit";
    const group = opts.group || "";
    const level = opts.level || (group ? "body" : "root");
    gifBrowser = { moveIndex, level, group, bodyPart: "", equipment: "", query: "", mode };
    openOverlayEl($("gif-browser"));
    renderGifBrowser();
  }

  function closeGifBrowser() {
    closeOverlayEl($("gif-browser"));
    gifBrowser.moveIndex = -1;
    gifBrowser.mode = "edit";
  }

  function gifBrowserBack() {
    if (gifBrowser.level === "gifs") {
      if (gifBrowser.equipment) {
        gifBrowser.level = "equip-body";
        gifBrowser.bodyPart = "";
        gifBrowser.query = "";
      } else {
        gifBrowser.level = "body";
        gifBrowser.bodyPart = "";
        gifBrowser.query = "";
      }
    } else if (gifBrowser.level === "equip-body") {
      gifBrowser.level = "body";
      gifBrowser.equipment = "";
      gifBrowser.bodyPart = "";
      gifBrowser.query = "";
    } else if (gifBrowser.level === "body") {
      if (gifBrowser.mode === "wizard") {
        // Return to type step of add wizard
        closeGifBrowser();
        addWizard.step = "type";
        openAddWizard();
        return;
      }
      gifBrowser.level = "root";
      gifBrowser.group = "";
      gifBrowser.equipment = "";
    } else {
      closeGifBrowser();
      return;
    }
    renderGifBrowser();
  }

  function renderGifBrowser() {
    const title = $("gif-browser-title");
    const back = $("gif-browser-back");
    const body = $("gif-browser-body");
    if (!body) return;
    const move = draftMoves[gifBrowser.moveIndex];
    const selected = move?.gif || "";

    if (gifBrowser.level === "root") {
      title.textContent = gifBrowser.mode === "wizard" ? "Pick a move" : "Choose GIF";
      back.hidden = gifBrowser.mode === "wizard";
      const groups = gifLibrary.groups || [];
      body.innerHTML = `<p class="admin-hint">${(gifLibrary.gifs || []).length} demos · pick a category</p>
        <div class="gif-menu-list">
          ${groups
            .map((g) => {
              const count = filterLibrary({ group: g.id }).length;
              return `<button type="button" class="gif-menu-item" data-gif-group="${escapeAttr(g.id)}">
                <strong>${escapeHtml(g.label)}</strong>
                <span>${count} GIFs</span>
              </button>`;
            })
            .join("")}
        </div>`;
      return;
    }

    if (gifBrowser.level === "body") {
      const groupLabel = (gifLibrary.groups || []).find((g) => g.id === gifBrowser.group)?.label || gifBrowser.group;
      title.textContent = groupLabel;
      back.hidden = false;
      const parts = gifLibrary.bodyParts || [];
      const available = parts.filter((p) => filterLibrary({ group: gifBrowser.group, bodyPart: p.id }).length);
      const hint =
        gifBrowser.group === "exercises"
          ? "Pick Dumbbell (by body part) or browse a body part"
          : "Pick a body part";
      body.innerHTML = `<p class="admin-hint">${hint}</p>
        <div class="gif-menu-list">
          ${available
            .map((p) => {
              const count = filterLibrary({ group: gifBrowser.group, bodyPart: p.id }).length;
              const equip = p.kind === "equipment" || p.id === "dumbbell";
              return `<button type="button" class="gif-menu-item ${equip ? "is-equipment" : ""}" data-gif-body="${escapeAttr(p.id)}" ${equip ? 'data-equip="1"' : ""}>
                <strong>${escapeHtml(p.label)}</strong>
                <span>${count}${equip ? " · by body part" : ""}</span>
              </button>`;
            })
            .join("")}
        </div>`;
      return;
    }

    if (gifBrowser.level === "equip-body") {
      const equipLabel =
        (gifLibrary.bodyParts || []).find((p) => p.id === (gifBrowser.equipment || "dumbbell"))?.label || "Dumbbell";
      title.textContent = equipLabel;
      back.hidden = false;
      const parts = anatomicalBodyParts().filter(
        (p) =>
          filterLibrary({
            group: gifBrowser.group,
            equipment: gifBrowser.equipment || "dumbbell",
            bodyPart: p.id,
          }).length
      );
      const totalDb = filterLibrary({
        group: gifBrowser.group,
        equipment: gifBrowser.equipment || "dumbbell",
        query: gifBrowser.query,
      }).length;
      const q = gifBrowser.query.trim();
      if (q) {
        // Search across all dumbbell moves from this hub
        renderGifGridLevel({
          titleText: `${equipLabel} · search`,
          filterOpts: {
            group: gifBrowser.group,
            equipment: gifBrowser.equipment || "dumbbell",
            query: gifBrowser.query,
          },
          searchPh: "Search all dumbbell moves…",
          max: 120,
          selected,
        });
        return;
      }
      body.innerHTML = `
        <input type="search" class="gif-search" id="gif-browser-search" placeholder="Search all dumbbell moves…" value="${escapeAttr(gifBrowser.query)}" enterkeyhint="search" />
        <p class="admin-hint">${totalDb} dumbbell GIFs · pick a body part</p>
        <div class="gif-menu-list">
          ${parts
            .map((p) => {
              const count = filterLibrary({
                group: gifBrowser.group,
                equipment: gifBrowser.equipment || "dumbbell",
                bodyPart: p.id,
              }).length;
              return `<button type="button" class="gif-menu-item" data-gif-body="${escapeAttr(p.id)}">
                <strong>${escapeHtml(p.label)}</strong>
                <span>${count}</span>
              </button>`;
            })
            .join("")}
        </div>`;
      bindGifBrowserSearch(() => {
        renderGifBrowser();
      });
      return;
    }

    // gifs level
    const groupLabel = (gifLibrary.groups || []).find((g) => g.id === gifBrowser.group)?.label || "";
    const partLabel = (gifLibrary.bodyParts || []).find((p) => p.id === gifBrowser.bodyPart)?.label || "";
    const equipLabel = gifBrowser.equipment
      ? (gifLibrary.bodyParts || []).find((p) => p.id === gifBrowser.equipment)?.label || "Dumbbell"
      : "";
    const titleText = equipLabel ? `${equipLabel} · ${partLabel}` : `${groupLabel} · ${partLabel}`;
    renderGifGridLevel({
      titleText,
      filterOpts: {
        group: gifBrowser.group,
        bodyPart: gifBrowser.bodyPart,
        equipment: gifBrowser.equipment || "",
        query: gifBrowser.query,
      },
      searchPh: gifBrowser.equipment ? "Search dumbbell moves…" : "Search (try “lat pull down”)…",
      max: gifBrowser.equipment ? 120 : 60,
      selected,
    });
  }

  function gifPickButtonsHtml(list, selected, max) {
    return list
      .slice(0, max)
      .map((g) => {
        const sel = selected === g.path ? "is-selected" : "";
        return `<button type="button" class="gif-pick ${sel}" data-pick-gif="${escapeAttr(g.path)}" title="${escapeAttr(g.name)}">
          <img src="${escapeAttr(g.path)}" alt="" loading="lazy" decoding="async" />
          <span>${escapeHtml(g.name)}</span>
        </button>`;
      })
      .join("");
  }

  function bindGifBrowserSearch(onInput) {
    const search = $("gif-browser-search");
    if (!search || search.__bound) return;
    search.__bound = true;
    search.addEventListener("input", () => {
      gifBrowser.query = search.value;
      onInput();
    });
  }

  function renderGifGridLevel({ titleText, filterOpts, searchPh, max, selected }) {
    const title = $("gif-browser-title");
    const back = $("gif-browser-back");
    const body = $("gif-browser-body");
    if (title) title.textContent = titleText;
    if (back) back.hidden = false;
    const filtered = filterLibrary(filterOpts);
    const grid = gifPickButtonsHtml(filtered, selected, max);
    body.innerHTML = `
      <input type="search" class="gif-search" id="gif-browser-search" placeholder="${escapeAttr(searchPh)}" value="${escapeAttr(gifBrowser.query)}" enterkeyhint="search" />
      <p class="gif-picker-more">${filtered.length} result${filtered.length === 1 ? "" : "s"}${filtered.length > max ? ` · showing ${max}` : ""}</p>
      <div class="gif-picker">${grid || `<p class="admin-hint">No matches — try another search</p>`}</div>`;
    bindGifBrowserSearch(() => {
      const move = draftMoves[gifBrowser.moveIndex];
      const sel = move?.gif || "";
      // Re-enter current level so equip-body can flip between menu and results
      if (gifBrowser.level === "equip-body") {
        renderGifBrowser();
        return;
      }
      const next = filterLibrary({
        group: gifBrowser.group,
        bodyPart: gifBrowser.bodyPart,
        equipment: gifBrowser.equipment || "",
        query: gifBrowser.query,
      });
      const more = body.querySelector(".gif-picker-more");
      const gridEl = body.querySelector(".gif-picker");
      if (more) more.textContent = `${next.length} result${next.length === 1 ? "" : "s"}${next.length > max ? ` · showing ${max}` : ""}`;
      if (gridEl) gridEl.innerHTML = gifPickButtonsHtml(next, sel, max) || `<p class="admin-hint">No matches — try another search</p>`;
    });
  }

  function libraryEntryByPath(path) {
    return (gifLibrary.gifs || []).find((g) => g.path === path) || null;
  }

  function selectGifForMove(path) {
    if (gifBrowser.mode === "wizard") {
      const entry = libraryEntryByPath(path);
      addWizard.gif = path;
      addWizard.name = entry?.name || "New move";
      closeGifBrowser();
      addWizard.step = "rx";
      openAddWizard();
      return;
    }
    const idx = gifBrowser.moveIndex;
    if (idx < 0 || !draftMoves[idx]) return;
    const move = draftMoves[idx];
    if (move._objectUrl) {
      URL.revokeObjectURL(move._objectUrl);
      move._objectUrl = null;
    }
    move.pendingFile = null;
    move.gif = path;
    move.demo = "img";
    const entry = libraryEntryByPath(path);
    if (entry?.name && (!move.name || move.name === "New move")) move.name = entry.name;
    closeGifBrowser();
    renderAdminMoves();
  }

  function openAddWizard() {
    openOverlayEl($("add-wizard"));
    renderAddWizard();
  }

  function closeAddWizard() {
    closeOverlayEl($("add-wizard"));
    addWizard = { step: "type", kind: "main", group: "exercises", name: "", gif: "", rx: "" };
  }

  function renderAddWizard() {
    const title = $("add-wizard-title");
    const back = $("add-wizard-back");
    const body = $("add-wizard-body");
    if (!body) return;

    if (addWizard.step === "type") {
      title.textContent = "Add move";
      back.hidden = true;
      body.innerHTML = `<p class="admin-hint">Step 1 of 3 — what kind of move?</p>
        <div class="gif-menu-list">
          <button type="button" class="gif-menu-item" data-wizard-type="stretch" data-wizard-group="stretching">
            <strong>Stretching</strong>
            <span>Warm-up / mobility</span>
          </button>
          <button type="button" class="gif-menu-item" data-wizard-type="main" data-wizard-group="exercises">
            <strong>Exercise</strong>
            <span>Strength / cardio</span>
          </button>
        </div>`;
      return;
    }

    if (addWizard.step === "rx") {
      title.textContent = "Prescription";
      back.hidden = false;
      const preview = addWizard.gif
        ? `<div class="admin-preview" style="pointer-events:none"><img src="${escapeAttr(addWizard.gif)}" alt="" /></div>`
        : "";
      body.innerHTML = `${preview}
        <p class="admin-hint">Step 3 of 3 — sets / reps / weight for <strong>${escapeHtml(addWizard.name)}</strong></p>
        <label class="field">
          <span>Shown on the plan as written</span>
          <input type="text" id="wizard-rx" value="${escapeAttr(addWizard.rx || (addWizard.kind === "stretch" ? "10 reps" : "2 sets × 12"))}" placeholder="e.g. 5 kg · 2 sets × 12" />
        </label>
        <div class="admin-actions">
          <button type="button" class="btn-primary" id="wizard-confirm">Add to plan</button>
        </div>`;
      $("wizard-rx")?.focus();
      return;
    }
  }

  function startAddWizardPick(kind, group) {
    addWizard.kind = kind;
    addWizard.group = group;
    addWizard.step = "pick";
    closeOverlayEl($("add-wizard"));
    // Hierarchical picker locked to chosen group
    openGifBrowser(-1, { mode: "wizard", group, level: "body" });
  }

  function confirmAddWizard() {
    const rxInput = $("wizard-rx");
    const rx = (rxInput?.value || addWizard.rx || "").trim() || (addWizard.kind === "stretch" ? "10 reps" : "2 sets × 12");
    if (!addWizard.gif) {
      addWizard.step = "type";
      renderAddWizard();
      return;
    }
    syncDraftFromDom();
    draftMoves.push({
      id: uid(slugify(addWizard.name || "move")),
      name: addWizard.name || "New move",
      rx,
      gif: addWizard.gif,
      demo: "img",
      kind: addWizard.kind === "stretch" ? "stretch" : "main",
      pendingFile: null,
    });
    const addedName = addWizard.name || "move";
    closeAddWizard();
    renderAdminMoves();
    setStatus($("publish-status"), "Added “" + addedName + "”. Tap + Add move for another, or Post plan.", "ok");
    setStatus($("admin-status"), "Move added. Add another or Post / Publish the plan.", "ok");
    const again = document.getElementById('plan-add-another');
    if (again) again.hidden = false;
  }


  function renderAdminMoves() {
    const root = $("admin-moves");
    if (!draftMoves.length) {
      root.innerHTML = `<p class="admin-hint">No moves yet — click “+ Add move”.</p>`;
      return;
    }
    root.innerHTML = draftMoves
      .map((move, index) => {
        const pending = move.pendingFile ? ` · pending upload: ${escapeHtml(move.pendingFile.name)}` : "";
        const preview = previewSrcForMove(move);
        const useSvg = move.demo === "svg-leg-swing" && !move.gif && !move.pendingFile;
        const previewInner = useSvg
          ? legSwingSvg()
          : preview
            ? `<img src="${escapeAttr(preview)}" alt="Preview: ${escapeAttr(move.name)}" />`
            : `<span>No GIF selected — tap to choose</span>`;
        const previewBlock = `<button type="button" class="admin-preview ${useSvg ? "admin-preview-svg" : preview ? "" : "admin-preview-empty"}" data-preview data-open-gif title="Choose GIF">${previewInner}</button>`;
        return `<article class="admin-move" data-index="${index}">
          <div class="admin-move-top">
            <label class="order-field">
              <span>Order</span>
              <input type="number" inputmode="numeric" min="1" max="${draftMoves.length}" step="1" data-field="order" value="${index + 1}" aria-label="Order number" />
            </label>
            <div class="admin-move-tools">
              <button type="button" class="btn-icon danger" data-act="remove" title="Remove">✕</button>
            </div>
          </div>
          ${previewBlock}
          <div class="admin-actions" style="margin-bottom:0.75rem">
            <button type="button" class="btn-ghost" data-open-gif>Choose GIF</button>
          </div>
          <label class="field">
            <span>Name</span>
            <input type="text" data-field="name" value="${escapeAttr(move.name)}" />
          </label>
          <label class="field">
            <span>Type</span>
            <select data-field="kind">
              <option value="stretch" ${move.kind === "stretch" ? "selected" : ""}>Stretch</option>
              <option value="main" ${move.kind !== "stretch" ? "selected" : ""}>Main</option>
            </select>
          </label>
          <label class="field">
            <span>Sets / reps / weight (shown as written)</span>
            <input type="text" data-field="rx" value="${escapeAttr(move.rx)}" placeholder="e.g. 5 kg · 2 sets × 12" />
          </label>
          <label class="field">
            <span>GIF path (set via Choose GIF, or paste URL)</span>
            <input type="text" data-field="gif" value="${escapeAttr(move.gif)}" placeholder="media/… or https://…" />
          </label>
          <label class="field">
            <span>Upload GIF (optional)${pending}</span>
            <input type="file" data-field="file" accept="image/gif,image/*,.gif" />
          </label>
          <label class="field check">
            <input type="checkbox" data-field="svg" ${useSvg ? "checked" : ""} />
            <span>Use built-in leg-swing SVG (only if no GIF)</span>
          </label>
        </article>`;
      })
      .join("");
  }

  function updateCardPreview(card, move) {
    const box = card.querySelector("[data-preview]");
    if (!box) return;
    const useSvg = move.demo === "svg-leg-swing" && !move.gif && !move.pendingFile;
    const preview = previewSrcForMove(move);
    const base = "admin-preview";
    if (useSvg) {
      box.className = `${base} admin-preview-svg`;
      box.innerHTML = legSwingSvg();
      return;
    }
    if (preview) {
      box.className = base;
      box.innerHTML = `<img src="${escapeAttr(preview)}" alt="Preview: ${escapeAttr(move.name || "move")}" />`;
      return;
    }
    box.className = `${base} admin-preview-empty`;
    box.innerHTML = `<span>No GIF selected — tap to choose</span>`;
  }

  function syncDraftFromDom() {
    const cards = $("admin-moves").querySelectorAll(".admin-move");
    cards.forEach((card) => {
      const i = Number(card.dataset.index);
      const move = draftMoves[i];
      if (!move) return;
      move.name = card.querySelector('[data-field="name"]').value.trim();
      move.kind = card.querySelector('[data-field="kind"]').value;
      move.rx = card.querySelector('[data-field="rx"]').value.trim();
      move.gif = card.querySelector('[data-field="gif"]').value.trim();
      const fileInput = card.querySelector('[data-field="file"]');
      if (fileInput?.files?.[0]) {
        if (move._objectUrl) URL.revokeObjectURL(move._objectUrl);
        move.pendingFile = fileInput.files[0];
        move._objectUrl = URL.createObjectURL(move.pendingFile);
      }
      const useSvg = card.querySelector('[data-field="svg"]').checked;
      move.demo = useSvg && !move.gif && !move.pendingFile ? "svg-leg-swing" : "img";
      if (!move.id) move.id = uid(slugify(move.name));
    });
  }

  function getToken() {
    return localStorage.getItem(LS_TOKEN) || "";
  }

  function b64EncodeUnicode(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  function arrayBufferToBase64(buffer) {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  async function githubGetSha(path, token) {
    const url = `https://api.github.com/repos/${REPO.owner}/${REPO.name}/contents/${path}?ref=${REPO.branch}`;
    const res = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
      },
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Could not read ${path}: ${res.status} ${text}`);
    }
    const data = await res.json();
    return data.sha;
  }

  async function githubPutFile(path, contentBase64, message, token) {
    const sha = await githubGetSha(path, token);
    const body = {
      message,
      content: contentBase64,
      branch: REPO.branch,
    };
    if (sha) body.sha = sha;
    const res = await fetch(
      `https://api.github.com/repos/${REPO.owner}/${REPO.name}/contents/${path}`,
      {
        method: "PUT",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Publish failed for ${path}: ${res.status} ${text}`);
    }
    return res.json();
  }

  async function uploadPendingFiles(token) {
    for (const move of draftMoves) {
      if (!move.pendingFile) continue;
      const ext = (move.pendingFile.name.split(".").pop() || "gif").toLowerCase().replace(/[^a-z0-9]/g, "") || "gif";
      const path = `media/${slugify(move.name || move.id)}-${Date.now().toString(36)}.${ext}`;
      const buf = await move.pendingFile.arrayBuffer();
      await githubPutFile(
        path,
        arrayBufferToBase64(buf),
        `Upload GIF for ${move.name || move.id}`,
        token
      );
      move.gif = path;
      move.demo = "img";
      move.pendingFile = null;
    }
  }

  async function publishPlan() {
    const token = getToken() || $("admin-token").value.trim();
    if (!token) {
      setStatus($("publish-status"), "Save a GitHub token first (repo scope).", "error");
      return;
    }
    syncDraftFromDom();
    if (!draftMoves.length) {
      setStatus($("publish-status"), "Add at least one exercise before publishing.", "error");
      return;
    }
    setStatus($("publish-status"), "Publishing… uploading media if needed…", "info");
    $("publish-plan").disabled = true;
    try {
      await uploadPendingFiles(token);
      const plan = buildPlanFromDraft();
      await githubPutFile(
        PLAN_PATH,
        b64EncodeUnicode(JSON.stringify(plan, null, 2) + "\n"),
        `Update today's Sapna workout (${new Date().toISOString().slice(0, 10)})`,
        token
      );
      renderPlan(plan);
      renderAdminMoves();
      setStatus(
        $("publish-status"),
        "Posted. GitHub Pages usually updates in ~30–60 seconds — Sapna can refresh on any device.",
        "ok"
      );
      setStatus($("admin-status"), "Workout plan posted. Refresh Workout tab in ~30–60s.", "ok");
    } catch (err) {
      setStatus($("publish-status"), err.message || String(err), "error");
    } finally {
      $("publish-plan").disabled = false;
    }
  }

  function openOverlay(el) {
    if (!el) return;
    try {
      if (typeof window.sapnaAdminDismissTokenSetup === "function") window.sapnaAdminDismissTokenSetup();
    } catch (_) {}
    el.hidden = false;
    el.removeAttribute("hidden");
    el.classList.add("is-open");
    el.style.cssText = "display:flex !important; position:fixed !important; inset:0 !important; z-index:100070 !important; opacity:1 !important; visibility:visible !important; pointer-events:auto !important; background:rgba(12,22,20,0.72);";
    document.body.classList.add("modal-open","plan-admin-open");
  }

  function closeOverlay(el) {
    if (!el) return;
    el.hidden = true;
    el.setAttribute("hidden", "");
    el.classList.remove("is-open");
    el.style.cssText = "";
    const gate = $("admin-gate");
    const editor = $("admin-editor");
    const browser = $("gif-browser");
    const wizard = $("add-wizard");
    const gateOpen = gate && !gate.hidden;
    const editorOpen = editor && !editor.hidden;
    const browserOpen = browser && !browser.hidden;
    const wizardOpen = wizard && !wizard.hidden;
    if (!gateOpen && !editorOpen && !browserOpen && !wizardOpen) document.body.classList.remove("modal-open","plan-admin-open");
  }

  function openGate() {
    if (typeof window.sapnaAdminOpen === "function") {
      window.sapnaAdminOpen();
      return;
    }
    setStatus($("gate-status"), "");
    if ($("gate-password")) $("gate-password").value = "";
    const lock = window.__sapnaAdminAuth?.getLockStatus?.();
    if (lock?.locked) {
      setStatus($("gate-status"), `Too many attempts. Try again in ${lock.secs}s.`, "error");
    }
    closeOverlay($("admin-editor"));
    openOverlay($("admin-gate"));
    setTimeout(() => $("gate-password") && $("gate-password").focus(), 50);
  }

  function openEditor() {
    try {
      if (typeof window.sapnaAdminDismissTokenSetup === "function") window.sapnaAdminDismissTokenSetup();
    } catch (_) {}
    if ($("admin-token")) $("admin-token").value = getToken() ? "••••••••••••" : "";
    fillEditorFromPlan(currentPlan || DEFAULT_PLAN);
    setStatus($("publish-status"), "");
    setStatus(
      $("token-status"),
      getToken()
        ? "Token saved in this browser."
        : "Token optional — only needed to Post / Publish online.",
      getToken() ? "ok" : "info"
    );
    closeOverlay($("admin-gate"));
    openOverlay($("admin-editor"));
    const sheet = $("admin-editor") && $("admin-editor").querySelector(".admin-sheet");
    if (sheet) sheet.scrollTop = 0;
  }

  function requestAdmin(e) {
    // onclick= already handles open; keep as backup only (do not stopPropagation)
    if (typeof window.sapnaAdminOpen === "function") {
      window.sapnaAdminOpen(e);
      return;
    }
    try {
      if (sessionStorage.getItem(SS_UNLOCKED) === "1") openEditor();
      else openGate();
    } catch (err) {
      console.error(err);
    }
  }

  // Used by head unlock helper after password success
  window.__sapnaOpenEditor = openEditor;

  function on(el, evt, fn) {
    if (!el) return;
    el.addEventListener(evt, fn);
  }

  function wireAdmin() {
    /* #admin-trigger uses head onclick=sapnaAdminOpen — only bind extra data-admin-open controls */
    document.querySelectorAll("[data-admin-open]").forEach((btn) => {
      on(btn, "click", requestAdmin);
    });

    /* Health owns admin-gate / admin-editor / admin-close — do not bind here */


    on($("save-token"), "click", () => {
      const raw = $("admin-token").value.trim();
      if (!raw || raw.startsWith("••")) {
        setStatus($("token-status"), "Paste a new token to save.", "error");
        return;
      }
      localStorage.setItem(LS_TOKEN, raw);
      $("admin-token").value = "••••••••••••";
      setStatus($("token-status"), "Token saved in this browser only.", "ok");
    });

    on($("clear-token"), "click", () => {
      localStorage.removeItem(LS_TOKEN);
      $("admin-token").value = "";
      setStatus($("token-status"), "Token cleared.", "info");
    });

    on($("add-move"), "click", () => {
      syncDraftFromDom();
      addWizard = { step: "type", kind: "main", group: "exercises", name: "", gif: "", rx: "" };
      openAddWizard();
    });

    on($("admin-moves"), "click", (e) => {
      const openGif = e.target.closest("[data-open-gif]");
      if (openGif) {
        const card = openGif.closest(".admin-move");
        const index = Number(card?.dataset.index);
        if (Number.isNaN(index)) return;
        syncDraftFromDom();
        openGifBrowser(index);
        return;
      }

      const btn = e.target.closest("[data-act]");
      if (!btn) return;
      const card = btn.closest(".admin-move");
      const index = Number(card?.dataset.index);
      if (Number.isNaN(index)) return;
      syncDraftFromDom();
      const act = btn.dataset.act;
      if (act === "remove") {
        draftMoves.splice(index, 1);
        renderAdminMoves();
      }
    });

    on($("admin-moves"), "input", (e) => {
      const field = e.target.getAttribute("data-field");
      if (!field) return;
      const card = e.target.closest(".admin-move");
      const index = Number(card?.dataset.index);
      if (Number.isNaN(index) || !draftMoves[index]) return;
      if (field === "gif") {
        draftMoves[index].gif = e.target.value.trim();
        draftMoves[index].demo = draftMoves[index].gif ? "img" : draftMoves[index].demo;
        card.querySelectorAll(".gif-pick").forEach((el) => {
          el.classList.toggle("is-selected", el.getAttribute("data-pick-gif") === draftMoves[index].gif);
        });
        updateCardPreview(card, draftMoves[index]);
      }
      if (field === "name") {
        draftMoves[index].name = e.target.value;
      }
    });

    on($("admin-moves"), "change", (e) => {
      const field = e.target.getAttribute("data-field");
      if (!field) return;
      const card = e.target.closest(".admin-move");
      const index = Number(card?.dataset.index);
      if (Number.isNaN(index) || !draftMoves[index]) return;
      if (field === "order") {
        applyOrderNumber(index, e.target.value);
        return;
      }
      syncDraftFromDom();
      if (field === "file" || field === "svg" || field === "gif") {
        updateCardPreview(card, draftMoves[index]);
      }
    });

    on($("admin-moves"), "keydown", (e) => {
      if (e.key !== "Enter") return;
      const field = e.target.getAttribute("data-field");
      if (field !== "order") return;
      e.preventDefault();
      e.target.blur();
    });

    on($("preview-plan"), "click", () => {
      syncDraftFromDom();
      const plan = buildPlanFromDraft();
      renderPlan(plan);
      setStatus($("publish-status"), "Preview applied on this page only (not posted yet).", "info");
      try {
        if (typeof window.showPanel === 'function') window.showPanel('workout');
        else location.hash = 'workout';
        document.getElementById('panel-workout')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (_) {}
    });

    on($("publish-plan"), "click", () => publishPlan());

    on($("gif-browser-close"), "click", () => closeGifBrowser());
    on($("gif-browser-back"), "click", () => gifBrowserBack());
    on($("gif-browser"), "click", (e) => {
      if (e.target === $("gif-browser")) closeGifBrowser();
      const group = e.target.closest("[data-gif-group]");
      if (group) {
        gifBrowser.group = group.getAttribute("data-gif-group") || "";
        gifBrowser.level = "body";
        gifBrowser.bodyPart = "";
        gifBrowser.equipment = "";
        gifBrowser.query = "";
        renderGifBrowser();
        return;
      }
      const bodyPart = e.target.closest("[data-gif-body]");
      if (bodyPart) {
        const id = bodyPart.getAttribute("data-gif-body") || "";
        const isEquip = bodyPart.getAttribute("data-equip") === "1" || id === "dumbbell";
        gifBrowser.query = "";
        if (isEquip && gifBrowser.level === "body") {
          gifBrowser.equipment = id;
          gifBrowser.bodyPart = "";
          gifBrowser.level = "equip-body";
        } else {
          gifBrowser.bodyPart = id;
          gifBrowser.level = "gifs";
        }
        renderGifBrowser();
        return;
      }
      const pick = e.target.closest("[data-pick-gif]");
      if (pick) {
        selectGifForMove(pick.getAttribute("data-pick-gif") || "");
      }
    });


    on($("add-wizard-close"), "click", () => closeAddWizard());
    on($("add-wizard-back"), "click", () => {
      if (addWizard.step === "rx") {
        // Back to picker for same group
        closeOverlayEl($("add-wizard"));
        openGifBrowser(-1, { mode: "wizard", group: addWizard.group, level: "body" });
        return;
      }
      addWizard.step = "type";
      renderAddWizard();
    });
    on($("add-wizard"), "click", (e) => {
      if (e.target === $("add-wizard")) closeAddWizard();
      const typeBtn = e.target.closest("[data-wizard-type]");
      if (typeBtn) {
        startAddWizardPick(
          typeBtn.getAttribute("data-wizard-type") || "main",
          typeBtn.getAttribute("data-wizard-group") || "exercises"
        );
        return;
      }
      if (e.target.id === "wizard-confirm" || e.target.closest("#wizard-confirm")) {
        confirmAddWizard();
      }
    });

    window.__sapnaAdminReady = true;
  }

  function pinInitialLanding() {
    try {
      if (location.hash && location.hash !== "#top") {
        history.replaceState(null, "", location.pathname + location.search);
      }
    } catch (_) {}
    window.scrollTo(0, 0);
  }

  function wireLandingCta() {
    const cta = $("start-session") || document.querySelector("a.cta[href^='#']");
    if (!cta || cta.dataset.wired === "1") return;
    cta.dataset.wired = "1";
    cta.addEventListener("click", (e) => {
      const href = cta.getAttribute("href") || "#session-stretch";
      const id = href.replace(/^#/, "") || "session-stretch";
      const target = document.getElementById(id) || document.getElementById("workout");
      if (!target) return;
      e.preventDefault();
      window.__sapnaAllowScroll = true;
      history.replaceState(null, "", "#" + (target.id || "workout"));
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  /* ── First-visit token setup (shared key with sapna-health) ── */
  function promptTokenSetupIfNeeded() {
    const SS_LATER = "sapna_token_setup_later";
    const overlay = $("token-setup");
    if (!overlay) return;
    const has = !!(localStorage.getItem(LS_TOKEN) || "").trim();
    if (has) {
      if ($("admin-token")) $("admin-token").placeholder = "Token saved — paste to replace";
      return;
    }
    try {
      if (sessionStorage.getItem(SS_LATER) === "1") return;
    } catch (_) {}

    const status = $("token-setup-status");
    const setSt = (msg, kind) => {
      if (!status) return;
      if (!msg) {
        status.hidden = true;
        status.textContent = "";
        return;
      }
      status.hidden = false;
      status.textContent = msg;
      status.className = "admin-status is-" + (kind || "info");
    };

    const close = () => {
      overlay.hidden = true;
      overlay.classList.remove("is-open");
      overlay.style.cssText = "";
      document.body.classList.remove("admin-open", "token-setup-open");
    };

    const open = () => {
      overlay.hidden = false;
      overlay.removeAttribute("hidden");
      overlay.classList.add("is-open");
      overlay.style.cssText =
        "display:flex !important; position:fixed !important; inset:0 !important; z-index:100071 !important;";
      document.body.classList.add("admin-open", "token-setup-open");
      const input = $("token-setup-input");
      if (input) {
        input.value = "";
        setTimeout(() => {
          try {
            input.focus({ preventScroll: true });
          } catch (_) {}
        }, 80);
      }
      setSt("");
    };

    if (overlay.dataset.wired !== "1") {
      overlay.dataset.wired = "1";
      $("token-setup-save")?.addEventListener("click", () => {
        const raw = ($("token-setup-input")?.value || "").trim();
        if (!raw) {
          setSt("Paste your GitHub token first.", "error");
          return;
        }
        if (raw.length < 20) {
          setSt("That doesn’t look like a GitHub token.", "error");
          return;
        }
        localStorage.setItem(LS_TOKEN, raw);
        try {
          sessionStorage.removeItem(SS_LATER);
        } catch (_) {}
        if ($("admin-token")) {
          $("admin-token").value = "••••••••••••";
          $("admin-token").placeholder = "Token saved — paste to replace";
        }
        setSt("Saved — lift sync & Admin publish ready.", "info");
        setTimeout(close, 450);
      });
      $("token-setup-later")?.addEventListener("click", () => {
        try {
          sessionStorage.setItem(SS_LATER, "1");
        } catch (_) {}
        close();
      });
      $("token-setup-input")?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          $("token-setup-save")?.click();
        }
      });
    }

    open();
  }

  function openAdminFromQuery() {
    try {
      const params = new URLSearchParams(location.search || "");
      if (params.get("admin") !== "1") return;
      /* Strip flag so refresh doesn't keep reopening after unlock */
      params.delete("admin");
      const q = params.toString();
      history.replaceState(null, "", location.pathname + (q ? "?" + q : "") + (location.hash || ""));
    } catch (_) {
      return;
    }
    setTimeout(() => {
      try {
        if (typeof window.sapnaAdminOpen === "function") window.sapnaAdminOpen();
        else requestAdmin();
      } catch (err) {
        console.warn(err);
      }
    }, 350);
  }

  async function init() {
    pinInitialLanding();
    wireLandingCta();
    /* Ask for PAT first on a fresh phone — skip when deep-linking into Admin */
    let openAdmin = false;
    try {
      openAdmin = new URLSearchParams(location.search || "").get("admin") === "1";
    } catch (_) {}
    if (!openAdmin) promptTokenSetupIfNeeded();
    try {
      wireAdmin();
    } catch (err) {
      console.error("Admin wiring failed", err);
    }
    if (openAdmin) openAdminFromQuery();
    try {
      await loadGifLibrary();
    } catch (err) {
      console.warn(err);
    }
    /* Pull shared lift logs BEFORE rendering moves so each exercise shows Last: */
    try {
      await pullWeightCloud();
    } catch (_) {}
    try {
      const plan = await loadPublishedPlan();
      renderPlan(plan);
    } catch (err) {
      console.error("Plan render failed", err);
      renderPlan(clone(DEFAULT_PLAN));
    }
    try {
      await pullWeightCloud();
      refreshMoveLogSummaries();
      updateSessionSteps();
    } catch (_) {}
    /* Layout can shift after plan/GIF load — keep first paint at hero top */
    pinInitialLanding();
    requestAnimationFrame(pinInitialLanding);
    setTimeout(pinInitialLanding, 50);
    setTimeout(pinInitialLanding, 200);
  }

  function startCreatePlan({ fresh } = {}) {
    return loadGifLibrary().then(async () => {
      let plan = clone(DEFAULT_PLAN);
      if (!fresh) {
        try {
          const res = await fetch('./' + PLAN_PATH + '?t=' + Date.now(), { cache: 'no-store' });
          if (res.ok) plan = await res.json();
        } catch (_) {}
      } else {
        plan = {
          ...clone(DEFAULT_PLAN),
          sections: [
            { id: 'stretching', eyebrow: 'Warm-up', title: 'Stretching', subtitle: 'Easy and controlled', kind: 'stretch', moves: [] },
            { id: 'exercise', eyebrow: 'Main session', title: 'Exercise', subtitle: 'Follow the prescriptions', kind: 'main', moves: [] },
          ],
        };
      }
      currentPlan = plan;
      fillEditorFromPlan(plan);
      showPlanBuilder(true);
      openAddWizard();
    });
  }

  function showPlanBuilder(show) {
    const builder = document.getElementById('plan-builder');
    if (builder) builder.hidden = !show;
  }

  function wirePlanAdmin() {
    try { wireAdmin(); } catch (e) { console.error(e); }
    // Remap publish status into health admin-status when present
    const pub = document.getElementById('publish-plan');
    if (pub && !pub.__healthBound) {
      pub.__healthBound = true;
    }
    document.getElementById('plan-create-today')?.addEventListener('click', () => startCreatePlan({ fresh: false }));
    document.getElementById('plan-create-new')?.addEventListener('click', () => startCreatePlan({ fresh: true }));
    document.getElementById('plan-add-another')?.addEventListener('click', () => openAddWizard());
  }

  async function boot() {
    await loadGifLibrary();
    try {
      const res = await fetch('./' + PLAN_PATH + '?t=' + Date.now(), { cache: 'no-store' });
      if (res.ok) {
        currentPlan = await res.json();
        fillEditorFromPlan(currentPlan);
      }
    } catch (_) {}
  }

  return {
    wire: wirePlanAdmin,
    boot,
    startCreatePlan,
    openAddWizard,
    publishPlan,
    fillEditorFromPlan,
    getDraftMoves: () => draftMoves.slice(),
  };
})();
