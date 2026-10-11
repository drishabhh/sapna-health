window.SapnaPlanAdmin = (() => {
  const REPO = { owner: "drishabhh", name: "sapna-health", branch: "main" };
  const PLAN_PATH = "data/today.json";
  const PLANS_DIR = "data/plans";
  const PLANS_INDEX = "data/plans/index.json";
  const LIBRARY_PATH = "data/gif-library.json";
  const LS_TOKEN = "sapna_gh_token";

  const FALLBACK_GIFS = [
    { id: "local-arm-circles", name: "Arm circles", path: "media/arm-circles.gif", thumb: "media/arm-circles.gif", group: "stretching", bodyPart: "arms" },
    { id: "local-chest-press", name: "Chest press", path: "media/chest-press.gif", thumb: "media/chest-press.gif", group: "exercises", bodyPart: "chest" },
    { id: "local-lat-pulldown", name: "Lat pulldown", path: "media/lat-pulldown.gif", thumb: "media/lat-pulldown.gif", group: "exercises", bodyPart: "back" },
  ];

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

  /** @type {Array<{id:string,name:string,rx:string,remarks:string,gif:string,demo:string,kind:string}>} */
  let cart = [];

  /** library | past */
  let browse = { source: "library", group: "exercises", bodyPart: "", equipment: "", query: "", pastDate: "", pastMoves: [] };
  /** edit | create */
  let planMode = "edit";
  let targetDate = "";
  let headline = "Aaj ka workout";
  let support = "Stretch · lift · log";
  let restTitle = "Rest & water";
  let restBody = "Rest 1–1.5 min between sets. Drink water — not cold; warm or room temp, sip by sip.";
  /** @type {Array<{date:string,headline:string,moveCount:number,path:string}>} */
  let historyIndex = [];
  /** @type {File|null} */
  let customPendingFile = null;

  const $ = (id) => document.getElementById(id);

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, "&#39;");
  }

  function todayISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function tomorrowISO() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function slugify(text) {
    return (
      String(text || "move")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40) || "move"
    );
  }

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  }

  function getToken() {
    const typed = ($("admin-token")?.value || "").trim();
    if (typed && !typed.startsWith("••")) return typed;
    return (localStorage.getItem(LS_TOKEN) || "").trim();
  }

  function setAdminStatus(msg, kind) {
    const el = $("admin-status");
    const pub = $("publish-status");
    [el, pub].forEach((node) => {
      if (!node) return;
      if (!msg) {
        node.hidden = true;
        node.textContent = "";
        return;
      }
      node.hidden = false;
      node.textContent = msg;
      if (node.id === "admin-status") node.className = "status admin-status-sticky is-" + (kind || "info");
      else node.className = "admin-status is-" + (kind || "info");
    });
  }

  function setCustomStatus(msg, kind) {
    const node = $("custom-status");
    if (!node) return;
    if (!msg) {
      node.hidden = true;
      node.textContent = "";
      return;
    }
    node.hidden = false;
    node.textContent = msg;
    node.className = "admin-status is-" + (kind || "info");
  }

  function b64EncodeUnicode(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  function arrayBufferToBase64(buf) {
    const bytes = new Uint8Array(buf);
    const chunk = 0x8000;
    let binary = "";
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  async function githubGetSha(path, token) {
    const res = await fetch(`https://api.github.com/repos/${REPO.owner}/${REPO.name}/contents/${path}?ref=${REPO.branch}`, {
      headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}` },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Could not read ${path}: ${res.status}`);
    const data = await res.json();
    return data.sha || null;
  }

  async function githubPutFile(path, contentBase64, message, token) {
    const sha = await githubGetSha(path, token);
    const body = { message, content: contentBase64, branch: REPO.branch };
    if (sha) body.sha = sha;
    const res = await fetch(`https://api.github.com/repos/${REPO.owner}/${REPO.name}/contents/${path}`, {
      method: "PUT",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Publish failed for ${path}: ${res.status}`);
    }
    return res.json();
  }

  async function loadGifLibrary() {
    try {
      const res = await fetch(`${LIBRARY_PATH}?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      if (data?.gifs?.length) {
        gifLibrary = {
          version: data.version,
          updatedAt: data.updatedAt,
          sources: data.sources,
          groups: data.groups || gifLibrary.groups,
          bodyParts: data.bodyParts || gifLibrary.bodyParts,
          gifs: data.gifs,
          count: data.count,
          dumbbellCount: data.dumbbellCount,
        };
      }
    } catch (err) {
      console.warn("GIF library load failed", err);
    }
  }

  function normalizeQuery(q) {
    return String(q || "")
      .toLowerCase()
      .replace(/[-_]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
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
    if (equip === "dumbbell") list = list.filter((g) => isDumbbellGif(g));
    if (bodyPart && bodyPart !== "dumbbell") {
      list = list.filter((g) => (g.bodyPart || "full-body") === bodyPart);
    }
    if (q) {
      list = list.filter((g) => {
        const hay = normalizeQuery([g.name, g.id, ...(g.aliases || [])].join(" "));
        return q.split(" ").every((tok) => !tok || hay.includes(tok));
      });
    }
    return list;
  }

  function anatomicalBodyParts() {
    return (gifLibrary.bodyParts || []).filter((p) => p.kind !== "equipment" && p.id !== "dumbbell");
  }

  function shortName(name) {
    return String(name || "Move").replace(/\s+/g, " ").trim().slice(0, 28);
  }

  function defaultRx(kind) {
    return kind === "stretch" ? "10 reps" : "2 × 12";
  }

  function openOverlay(el) {
    if (!el) return;
    el.hidden = false;
    el.removeAttribute("hidden");
    el.classList.add("is-open");
    el.style.cssText =
      "display:flex !important; position:fixed !important; inset:0 !important; z-index:100070 !important; opacity:1 !important; visibility:visible !important; pointer-events:auto !important; background:rgba(12,22,20,0.72) !important;";
    document.body.classList.add("modal-open", "plan-admin-open");
  }

  function closeOverlay(el) {
    if (!el) return;
    el.hidden = true;
    el.setAttribute("hidden", "");
    el.classList.remove("is-open");
    el.style.cssText = "";
    const still =
      ($("plan-browse") && !$("plan-browse").hidden) ||
      ($("plan-meta") && !$("plan-meta").hidden) ||
      ($("plan-custom") && !$("plan-custom").hidden);
    if (!still) document.body.classList.remove("plan-admin-open");
  }

  function showBuilder(show) {
    const builder = $("plan-builder");
    if (builder) builder.hidden = !show;
    updateBuilderMeta();
  }

  function updateBuilderMeta() {
    const el = $("plan-builder-meta");
    if (!el) return;
    if (!targetDate && planMode !== "create") {
      el.hidden = true;
      return;
    }
    const date = targetDate || todayISO();
    const label = planMode === "edit" ? "Editing current" : "New plan";
    el.hidden = false;
    el.textContent = `${label} · ${headline || "Plan"} · ${date}`;
  }

  function cartCount() {
    return cart.length;
  }

  function updateCartBadges() {
    const n = cartCount();
    document.querySelectorAll("[data-cart-count]").forEach((el) => {
      el.textContent = String(n);
    });
    const empty = $("plan-cart-empty");
    const list = $("plan-cart-list");
    if (empty) empty.hidden = n > 0;
    if (list) list.hidden = n === 0;
    const publish = $("publish-plan");
    if (publish) publish.disabled = n === 0;
  }

  function renderCart() {
    const list = $("plan-cart-list");
    if (!list) return;
    list.innerHTML = cart
      .map((item, index) => {
        const thumb = item.gif
          ? `<img src="${escapeAttr(item.gif)}" alt="" loading="lazy" />`
          : `<span class="plan-cart-thumb-empty">—</span>`;
        const kindLabel = item.kind === "stretch" ? "Stretch" : "Lift";
        return `<article class="plan-cart-item" data-cart-index="${index}">
          <div class="plan-cart-thumb">${thumb}</div>
          <div class="plan-cart-meta">
            <p class="plan-cart-name">${escapeHtml(shortName(item.name))} <em>${kindLabel}</em></p>
            <input class="plan-cart-rx" data-cart-rx type="text" value="${escapeAttr(item.rx || defaultRx(item.kind))}" placeholder="sets × reps" enterkeyhint="done" />
          </div>
          <div class="plan-cart-tools">
            <button type="button" class="btn-icon" data-cart-up title="Move up" ${index === 0 ? "disabled" : ""}>↑</button>
            <button type="button" class="btn-icon" data-cart-down title="Move down" ${index === cart.length - 1 ? "disabled" : ""}>↓</button>
            <button type="button" class="btn-icon danger" data-cart-remove title="Remove">✕</button>
          </div>
          <label class="plan-cart-remarks-label">Remarks
            <textarea class="plan-cart-remarks" data-cart-remarks rows="2" placeholder="Cue, tempo, rest… (shows on Workout)">${escapeHtml(item.remarks || "")}</textarea>
          </label>
        </article>`;
      })
      .join("");
    updateCartBadges();
    updateBuilderMeta();
  }

  function addToCart(entry, kind) {
    const k = kind === "stretch" ? "stretch" : "main";
    cart.push({
      id: uid(slugify(entry.name || "move")),
      name: entry.name || "Move",
      rx: entry.rx || defaultRx(k),
      remarks: entry.remarks || "",
      gif: entry.path || entry.gif || "",
      demo: "img",
      kind: k,
    });
    renderCart();
    setAdminStatus(`Added ${shortName(entry.name)}. Cart: ${cartCount()}.`, "ok");
  }

  function syncRxFromDom() {
    document.querySelectorAll("#plan-cart-list [data-cart-index]").forEach((card) => {
      const idx = Number(card.getAttribute("data-cart-index"));
      if (!Number.isFinite(idx) || !cart[idx]) return;
      const rx = card.querySelector("[data-cart-rx]");
      const remarks = card.querySelector("[data-cart-remarks]");
      if (rx) cart[idx].rx = (rx.value || "").trim() || defaultRx(cart[idx].kind);
      if (remarks) cart[idx].remarks = (remarks.value || "").trim();
    });
  }

  function buildPlanFromCart() {
    syncRxFromDom();
    const stretchMoves = cart
      .filter((m) => m.kind === "stretch")
      .map(({ id, name, rx, remarks, gif, demo }) => ({
        id,
        name,
        rx,
        remarks: remarks || "",
        gif,
        demo: gif ? "img" : demo || "img",
      }));
    const mainMoves = cart
      .filter((m) => m.kind !== "stretch")
      .map(({ id, name, rx, remarks, gif, demo }) => ({
        id,
        name,
        rx,
        remarks: remarks || "",
        gif,
        demo: gif ? "img" : demo || "img",
      }));
    const h = ($("edit-headline")?.value || "").trim() || headline;
    const s = ($("edit-support")?.value || "").trim() || support;
    const rt = ($("edit-rest-title")?.value || "").trim() || restTitle;
    const rb = ($("edit-rest-body")?.value || "").trim() || restBody;
    return {
      updatedAt: new Date().toISOString(),
      planDate: targetDate || todayISO(),
      headline: h,
      support: s,
      restNote: {
        title: rt,
        body: rb,
        bodyHtml: `<strong>${escapeHtml(rb.split(".")[0] || rb)}</strong>${rb.includes(".") ? "." + escapeHtml(rb.slice(rb.indexOf(".") + 1)) : ""}`,
      },
      sections: [
        {
          id: "stretching",
          eyebrow: "Warm-up",
          title: "Stretching",
          subtitle: stretchMoves.length ? "Easy and controlled" : "No stretches",
          kind: "stretch",
          moves: stretchMoves,
        },
        {
          id: "exercise",
          eyebrow: "Main session",
          title: "Exercise",
          subtitle: mainMoves.length ? "Follow the prescriptions" : "No lifts",
          kind: "main",
          moves: mainMoves,
        },
      ].filter((sec) => sec.moves.length > 0),
    };
  }

  function cartFromPlan(plan) {
    const next = [];
    (plan?.sections || []).forEach((sec) => {
      const kind = sec.kind === "stretch" || sec.id === "stretching" ? "stretch" : "main";
      (sec.moves || []).forEach((m) => {
        next.push({
          id: m.id || uid(slugify(m.name)),
          name: m.name || "Move",
          rx: m.rx || defaultRx(kind),
          remarks: m.remarks || "",
          gif: m.gif || "",
          demo: m.demo || "img",
          kind,
        });
      });
    });
    return next;
  }

  function fillCopyFields(plan) {
    headline = plan?.headline || headline;
    support = plan?.support || support;
    restTitle = plan?.restNote?.title || restTitle;
    restBody = plan?.restNote?.body || restBody;
    if ($("edit-headline")) $("edit-headline").value = headline;
    if ($("edit-support")) $("edit-support").value = support;
    if ($("edit-rest-title")) $("edit-rest-title").value = restTitle;
    if ($("edit-rest-body")) $("edit-rest-body").value = restBody;
  }

  function sourceTabsHtml() {
    return `<div class="plan-browse-tabs plan-source-tabs" role="tablist">
      <button type="button" class="plan-tab ${browse.source === "library" ? "is-active" : ""}" data-browse-source="library">Library</button>
      <button type="button" class="plan-tab ${browse.source === "past" ? "is-active" : ""}" data-browse-source="past">Past plans</button>
    </div>`;
  }

  function groupTabsHtml() {
    return `<div class="plan-browse-tabs" role="tablist">
      <button type="button" class="plan-tab ${browse.group === "stretching" ? "is-active" : ""}" data-browse-group="stretching">Stretching</button>
      <button type="button" class="plan-tab ${browse.group === "exercises" ? "is-active" : ""}" data-browse-group="exercises">Exercise</button>
    </div>`;
  }

  function customTileHtml() {
    return `<button type="button" class="plan-tile plan-tile-custom" data-open-custom>
      <span class="plan-tile-plus">+</span>
      <span>Add custom</span>
    </button>`;
  }

  function renderBrowse() {
    const title = $("plan-browse-title");
    const body = $("plan-browse-body");
    const back = $("plan-browse-back");
    if (!body) return;

    if (browse.source === "past") {
      renderPastBrowse(title, body, back);
      return;
    }

    const kind = browse.group === "stretching" ? "stretch" : "main";
    const tabs = `${sourceTabsHtml()}${groupTabsHtml()}`;

    if (!browse.bodyPart && !browse.equipment) {
      if (title) title.textContent = "Add moves";
      if (back) back.hidden = true;
      const show = (gifLibrary.bodyParts || []).filter((p) => {
        if (p.id === "dumbbell" || p.kind === "equipment") return browse.group === "exercises";
        return true;
      });
      body.innerHTML = `${tabs}
        <div class="plan-chip-row">
          ${show
            .map((p) => {
              const equip = p.kind === "equipment" || p.id === "dumbbell";
              return `<button type="button" class="plan-chip ${equip ? "is-equip" : ""}" data-browse-body="${escapeAttr(p.id)}" ${equip ? 'data-equip="1"' : ""}>${escapeHtml(p.label)}</button>`;
            })
            .join("")}
        </div>`;
      renderBrowseFooter();
      return;
    }

    if (browse.equipment && !browse.bodyPart) {
      if (title) title.textContent = "Dumbbell";
      if (back) back.hidden = false;
      const parts = anatomicalBodyParts();
      body.innerHTML = `${tabs}
        <div class="plan-chip-row">
          ${parts
            .map(
              (p) =>
                `<button type="button" class="plan-chip" data-browse-body="${escapeAttr(p.id)}">${escapeHtml(p.label)}</button>`
            )
            .join("")}
        </div>`;
      renderBrowseFooter();
      return;
    }

    const partLabel =
      (gifLibrary.bodyParts || []).find((p) => p.id === browse.bodyPart)?.label || browse.bodyPart;
    if (title) title.textContent = partLabel;
    if (back) back.hidden = false;
    const list = filterLibrary({
      group: browse.group,
      bodyPart: browse.bodyPart,
      equipment: browse.equipment || "",
      query: browse.query,
    }).slice(0, 80);
    body.innerHTML = `${tabs}
      <input type="search" class="plan-tile-search" id="plan-tile-search" placeholder="Search" value="${escapeAttr(browse.query)}" enterkeyhint="search" />
      <div class="plan-tile-grid">
        ${customTileHtml()}
        ${
          list
            .map((g) => {
              const src = g.thumb || g.path;
              return `<button type="button" class="plan-tile" data-add-gif="${escapeAttr(g.path)}" data-add-name="${escapeAttr(g.name)}" data-add-kind="${kind}">
                <img src="${escapeAttr(src)}" alt="" loading="lazy" decoding="async" />
                <span>${escapeHtml(shortName(g.name))}</span>
              </button>`;
            })
            .join("") || ""
        }
      </div>`;
    const search = $("plan-tile-search");
    if (search && !search.__bound) {
      search.__bound = true;
      search.addEventListener("input", () => {
        browse.query = search.value;
        renderBrowse();
        const again = $("plan-tile-search");
        if (again) {
          again.focus();
          const v = again.value;
          again.setSelectionRange(v.length, v.length);
        }
      });
    }
    fillCustomBodySelect(browse.bodyPart, browse.group);
    renderBrowseFooter();
  }

  function renderPastBrowse(title, body, back) {
    const tabs = sourceTabsHtml();
    if (!browse.pastDate) {
      if (title) title.textContent = "From past plans";
      if (back) back.hidden = true;
      if (!historyIndex.length) {
        body.innerHTML = `${tabs}<p class="hint">No previous plans yet — Publish one first.</p>`;
        renderBrowseFooter();
        return;
      }
      const sorted = [...historyIndex].sort((a, b) => String(b.date).localeCompare(String(a.date)));
      body.innerHTML = `${tabs}
        <div class="plan-history-pick">
          ${sorted
            .map(
              (p) => `<button type="button" class="plan-chip" data-past-date="${escapeAttr(p.date)}" data-past-path="${escapeAttr(p.path)}">
                ${escapeHtml(p.date)} · ${escapeHtml(shortName(p.headline || "Plan"))}
              </button>`
            )
            .join("")}
        </div>
        <p class="hint">Tap a day, then tap moves to add them to this cart.</p>`;
      renderBrowseFooter();
      return;
    }

    if (title) title.textContent = browse.pastDate;
    if (back) back.hidden = false;
    const moves = browse.pastMoves || [];
    body.innerHTML = `${tabs}
      <div class="plan-tile-grid">
        ${
          moves
            .map((m) => {
              const kind = m.kind === "stretch" ? "stretch" : "main";
              const src = m.gif || "";
              return `<button type="button" class="plan-tile" data-add-gif="${escapeAttr(src)}" data-add-name="${escapeAttr(m.name)}" data-add-kind="${kind}" data-add-rx="${escapeAttr(m.rx || "")}" data-add-remarks="${escapeAttr(m.remarks || "")}">
                ${src ? `<img src="${escapeAttr(src)}" alt="" loading="lazy" />` : `<span class="plan-tile-plus">·</span>`}
                <span>${escapeHtml(shortName(m.name))}</span>
              </button>`;
            })
            .join("") || `<p class="hint">No moves in that plan.</p>`
        }
      </div>`;
    renderBrowseFooter();
  }

  function renderBrowseFooter() {
    const foot = $("plan-browse-footer");
    if (!foot) return;
    foot.innerHTML = `<button type="button" class="btn-primary" id="plan-browse-done">Cart (<span data-cart-count>${cartCount()}</span>) · Done</button>`;
  }

  function openBrowse() {
    browse = { source: "library", group: "exercises", bodyPart: "", equipment: "", query: "", pastDate: "", pastMoves: [] };
    openOverlay($("plan-browse"));
    renderBrowse();
  }

  function browseBack() {
    if (browse.source === "past") {
      if (browse.pastDate) {
        browse.pastDate = "";
        browse.pastMoves = [];
        renderBrowse();
        return;
      }
      closeOverlay($("plan-browse"));
      return;
    }
    if (browse.bodyPart) {
      browse.bodyPart = "";
      browse.query = "";
      renderBrowse();
      return;
    }
    if (browse.equipment) {
      browse.equipment = "";
      renderBrowse();
      return;
    }
    closeOverlay($("plan-browse"));
  }

  function afterTileAdd() {
    if (browse.source === "past") {
      browse.pastDate = "";
      browse.pastMoves = [];
      renderBrowse();
      return;
    }
    browse.bodyPart = "";
    browse.equipment = "";
    browse.query = "";
    renderBrowse();
  }

  async function loadPastPlanMoves(path) {
    const res = await fetch(`./${path}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Could not load that plan.");
    const plan = await res.json();
    return cartFromPlan(plan);
  }

  async function loadHistoryIndex() {
    try {
      const res = await fetch(`./${PLANS_INDEX}?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) {
        historyIndex = [];
        renderHistory();
        return;
      }
      const data = await res.json();
      historyIndex = Array.isArray(data.plans) ? data.plans : [];
      renderHistory();
    } catch {
      historyIndex = [];
      renderHistory();
    }
  }

  function renderHistory() {
    const root = $("plan-history-list");
    if (!root) return;
    if (!historyIndex.length) {
      root.innerHTML = `<p class="hint">No saved plans yet — Publish to keep a plan in history.</p>`;
      return;
    }
    const sorted = [...historyIndex].sort((a, b) => String(b.date).localeCompare(String(a.date)));
    root.innerHTML = sorted
      .map((p) => {
        return `<article class="plan-history-item" data-plan-path="${escapeAttr(p.path)}" data-plan-date="${escapeAttr(p.date)}">
          <div>
            <strong>${escapeHtml(p.date)}</strong>
            <span>${escapeHtml(p.headline || "Plan")} · ${Number(p.moveCount) || 0} moves</span>
          </div>
          <button type="button" class="btn-ghost" data-use-plan>Use as today</button>
        </article>`;
      })
      .join("");
  }

  async function publishPlan() {
    const token = getToken();
    if (!token) {
      setAdminStatus("Save a GitHub PAT first (repo scope).", "error");
      return;
    }
    syncRxFromDom();
    if (!cart.length) {
      setAdminStatus("Cart is empty — tap Browse moves.", "error");
      return;
    }
    const plan = buildPlanFromCart();
    const date = targetDate || plan.planDate || todayISO();
    plan.planDate = date;
    const histPath = `${PLANS_DIR}/${date}.json`;
    const histEntry = {
      date,
      headline: plan.headline,
      moveCount: cart.length,
      path: histPath,
      updatedAt: plan.updatedAt,
    };
    const nextIndex = {
      version: 1,
      updatedAt: plan.updatedAt,
      plans: [histEntry, ...historyIndex.filter((p) => p.date !== date)].sort((a, b) =>
        String(b.date).localeCompare(String(a.date))
      ),
    };

    const btn = $("publish-plan");
    if (btn) btn.disabled = true;
    setAdminStatus("Publishing plan…", "info");
    try {
      const writeToday = planMode === "edit" || date === todayISO();
      if (writeToday) {
        await githubPutFile(
          PLAN_PATH,
          b64EncodeUnicode(JSON.stringify(plan, null, 2) + "\n"),
          `Update today's workout (${date})`,
          token
        );
      }
      await githubPutFile(
        histPath,
        b64EncodeUnicode(JSON.stringify(plan, null, 2) + "\n"),
        `Save plan history ${date}`,
        token
      );
      await githubPutFile(
        PLANS_INDEX,
        b64EncodeUnicode(JSON.stringify(nextIndex, null, 2) + "\n"),
        `Update plan history index (${date})`,
        token
      );
      historyIndex = nextIndex.plans;
      renderHistory();
      if (writeToday) {
        try {
          if (window.Workout?.loadLocalPlan) window.Workout.loadLocalPlan(plan);
        } catch (_) {}
      }
      setAdminStatus(
        writeToday
          ? "Published. Today updated + saved in Previous plans. Pages ~30–60s."
          : `Published plan for ${date} in Previous plans. Pages ~30–60s.`,
        "ok"
      );
    } catch (err) {
      setAdminStatus(err.message || String(err), "error");
    } finally {
      if (btn) btn.disabled = cart.length === 0;
    }
  }

  async function useHistoryPlan(path) {
    setAdminStatus("Loading past plan…", "info");
    try {
      const res = await fetch(`./${path}?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Could not load that plan.");
      const plan = await res.json();
      planMode = "edit";
      targetDate = todayISO();
      cart = cartFromPlan(plan);
      fillCopyFields(plan);
      showBuilder(true);
      renderCart();
      setAdminStatus("Loaded into cart — edit if needed, then Publish.", "ok");
      $("plan-builder")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      setAdminStatus(err.message || String(err), "error");
    }
  }

  async function startEditCurrent() {
    await loadGifLibrary();
    planMode = "edit";
    targetDate = todayISO();
    try {
      const res = await fetch(`./${PLAN_PATH}?t=${Date.now()}`, { cache: "no-store" });
      if (res.ok) {
        const plan = await res.json();
        cart = cartFromPlan(plan);
        fillCopyFields(plan);
      } else {
        cart = [];
        fillCopyFields({});
      }
    } catch {
      cart = [];
      fillCopyFields({});
    }
    showBuilder(true);
    renderCart();
    setAdminStatus("Editing current plan — browse to add or change moves, then Publish.", "info");
    openBrowse();
  }

  function openCreateMeta() {
    const name = $("plan-meta-name");
    const date = $("plan-meta-date");
    if (name) name.value = "";
    if (date) date.value = tomorrowISO();
    openOverlay($("plan-meta"));
  }

  async function continueCreateFromMeta() {
    await loadGifLibrary();
    const name = ($("plan-meta-name")?.value || "").trim() || "New plan";
    const date = ($("plan-meta-date")?.value || "").trim() || tomorrowISO();
    planMode = "create";
    targetDate = date;
    cart = [];
    headline = name;
    fillCopyFields({
      headline: name,
      support: "Stretch · lift · log",
      restNote: { title: "Rest & water", body: restBody },
    });
    closeOverlay($("plan-meta"));
    showBuilder(true);
    renderCart();
    setAdminStatus(`New plan “${name}” for ${date} — add moves (library or Past plans).`, "info");
    openBrowse();
  }

  function fillCustomBodySelect(preferredBody, preferredGroup) {
    const sel = $("custom-body");
    if (!sel) return;
    const parts = anatomicalBodyParts();
    sel.innerHTML = parts
      .map((p) => `<option value="${escapeAttr(p.id)}">${escapeHtml(p.label)}</option>`)
      .join("");
    if (preferredBody && parts.some((p) => p.id === preferredBody)) sel.value = preferredBody;
    const kind = $("custom-kind");
    if (kind && preferredGroup) kind.value = preferredGroup === "stretching" ? "stretching" : "exercises";
  }

  function openCustomSheet() {
    fillCustomBodySelect(browse.bodyPart || "full-body", browse.group);
    if ($("custom-name")) $("custom-name").value = "";
    if ($("custom-url")) $("custom-url").value = "";
    if ($("custom-file")) $("custom-file").value = "";
    customPendingFile = null;
    setCustomStatus("");
    openOverlay($("plan-custom"));
  }

  async function saveCustomMove() {
    const name = ($("custom-name")?.value || "").trim();
    const group = ($("custom-kind")?.value || "exercises") === "stretching" ? "stretching" : "exercises";
    const bodyPart = ($("custom-body")?.value || "full-body").trim() || "full-body";
    const url = ($("custom-url")?.value || "").trim();
    if (!name) {
      setCustomStatus("Enter a name.", "error");
      return;
    }
    if (!url && !customPendingFile) {
      setCustomStatus("Paste a GIF link or upload a GIF.", "error");
      return;
    }
    const token = getToken();
    if (!token) {
      setCustomStatus("Save a GitHub PAT first so the move stays in the library.", "error");
      return;
    }

    const btn = $("custom-save");
    if (btn) btn.disabled = true;
    setCustomStatus("Saving to library…", "info");
    try {
      let path = url;
      if (customPendingFile) {
        const ext =
          (customPendingFile.name.split(".").pop() || "gif").toLowerCase().replace(/[^a-z0-9]/g, "") || "gif";
        path = `media/custom-${slugify(name)}-${Date.now().toString(36)}.${ext}`;
        const buf = await customPendingFile.arrayBuffer();
        if (buf.byteLength > 4.5 * 1024 * 1024) throw new Error("GIF too large (keep under ~4.5 MB).");
        await githubPutFile(path, arrayBufferToBase64(buf), `Upload custom GIF: ${name}`, token);
      }

      const entry = {
        id: uid(`custom-${slugify(name)}`),
        name,
        path,
        thumb: path,
        group,
        bodyPart,
        category: group === "stretching" ? "stretch-custom" : "strength-custom",
        equipment: "custom",
        muscle: bodyPart,
        aliases: [],
        source: customPendingFile ? "upload" : "link",
      };

      const gifs = [...(gifLibrary.gifs || []).filter((g) => g.id !== entry.id), entry];
      const nextLib = {
        ...gifLibrary,
        updatedAt: new Date().toISOString(),
        count: gifs.length,
        gifs,
      };
      await githubPutFile(
        LIBRARY_PATH,
        b64EncodeUnicode(JSON.stringify(nextLib) + "\n"),
        `Add custom move: ${name}`,
        token
      );
      gifLibrary = nextLib;

      addToCart(entry, group === "stretching" ? "stretch" : "main");
      closeOverlay($("plan-custom"));
      browse.source = "library";
      browse.group = group;
      browse.bodyPart = "";
      browse.equipment = "";
      browse.query = "";
      renderBrowse();
      setAdminStatus(`Saved “${shortName(name)}” to library + cart.`, "ok");
    } catch (err) {
      setCustomStatus(err.message || String(err), "error");
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function wire() {
    $("plan-edit-current")?.addEventListener("click", () => startEditCurrent());
    $("plan-create-new")?.addEventListener("click", () => openCreateMeta());
    $("plan-meta-close")?.addEventListener("click", () => closeOverlay($("plan-meta")));
    $("plan-meta-continue")?.addEventListener("click", () => continueCreateFromMeta());
    $("plan-meta")?.addEventListener("click", (e) => {
      if (e.target === $("plan-meta")) closeOverlay($("plan-meta"));
    });

    $("plan-browse-open")?.addEventListener("click", () => openBrowse());
    $("plan-browse-close")?.addEventListener("click", () => closeOverlay($("plan-browse")));
    $("plan-browse-back")?.addEventListener("click", () => browseBack());
    $("plan-browse")?.addEventListener("click", (e) => {
      if (e.target === $("plan-browse")) closeOverlay($("plan-browse"));

      const source = e.target.closest("[data-browse-source]");
      if (source) {
        browse.source = source.getAttribute("data-browse-source") || "library";
        browse.bodyPart = "";
        browse.equipment = "";
        browse.query = "";
        browse.pastDate = "";
        browse.pastMoves = [];
        renderBrowse();
        return;
      }

      const group = e.target.closest("[data-browse-group]");
      if (group) {
        browse.source = "library";
        browse.group = group.getAttribute("data-browse-group") || "exercises";
        browse.bodyPart = "";
        browse.equipment = "";
        browse.query = "";
        renderBrowse();
        return;
      }

      const past = e.target.closest("[data-past-path]");
      if (past) {
        const path = past.getAttribute("data-past-path") || "";
        const date = past.getAttribute("data-past-date") || "";
        setAdminStatus("Loading past moves…", "info");
        loadPastPlanMoves(path)
          .then((moves) => {
            browse.pastDate = date;
            browse.pastMoves = moves;
            renderBrowse();
            setAdminStatus("");
          })
          .catch((err) => setAdminStatus(err.message || String(err), "error"));
        return;
      }

      const bodyBtn = e.target.closest("[data-browse-body]");
      if (bodyBtn) {
        const id = bodyBtn.getAttribute("data-browse-body") || "";
        const isEquip = bodyBtn.getAttribute("data-equip") === "1" || id === "dumbbell";
        browse.query = "";
        if (isEquip && !browse.equipment) {
          browse.equipment = id;
          browse.bodyPart = "";
        } else {
          browse.bodyPart = id;
        }
        renderBrowse();
        return;
      }

      if (e.target.closest("[data-open-custom]")) {
        openCustomSheet();
        return;
      }

      const tile = e.target.closest("[data-add-gif]");
      if (tile) {
        addToCart(
          {
            name: tile.getAttribute("data-add-name"),
            path: tile.getAttribute("data-add-gif"),
            rx: tile.getAttribute("data-add-rx") || "",
            remarks: tile.getAttribute("data-add-remarks") || "",
          },
          tile.getAttribute("data-add-kind")
        );
        afterTileAdd();
        return;
      }

      if (e.target.id === "plan-browse-done" || e.target.closest("#plan-browse-done")) {
        closeOverlay($("plan-browse"));
        renderCart();
      }
    });

    $("plan-custom-close")?.addEventListener("click", () => closeOverlay($("plan-custom")));
    $("plan-custom")?.addEventListener("click", (e) => {
      if (e.target === $("plan-custom")) closeOverlay($("plan-custom"));
    });
    $("custom-file")?.addEventListener("change", (e) => {
      customPendingFile = e.target.files?.[0] || null;
    });
    $("custom-save")?.addEventListener("click", () => saveCustomMove());

    $("plan-cart-list")?.addEventListener("click", (e) => {
      const card = e.target.closest("[data-cart-index]");
      if (!card) return;
      const idx = Number(card.getAttribute("data-cart-index"));
      if (!Number.isFinite(idx) || !cart[idx]) return;
      syncRxFromDom();
      if (e.target.closest("[data-cart-remove]")) {
        cart.splice(idx, 1);
        renderCart();
        return;
      }
      if (e.target.closest("[data-cart-up]") && idx > 0) {
        const tmp = cart[idx - 1];
        cart[idx - 1] = cart[idx];
        cart[idx] = tmp;
        renderCart();
        return;
      }
      if (e.target.closest("[data-cart-down]") && idx < cart.length - 1) {
        const tmp = cart[idx + 1];
        cart[idx + 1] = cart[idx];
        cart[idx] = tmp;
        renderCart();
      }
    });

    $("plan-cart-list")?.addEventListener("change", (e) => {
      if (e.target.matches("[data-cart-rx], [data-cart-remarks]")) syncRxFromDom();
    });
    $("plan-cart-list")?.addEventListener("input", (e) => {
      if (e.target.matches("[data-cart-remarks]")) syncRxFromDom();
    });

    $("preview-plan")?.addEventListener("click", () => {
      const plan = buildPlanFromCart();
      try {
        if (window.Workout?.loadLocalPlan) window.Workout.loadLocalPlan(plan);
        if (typeof window.showPanel === "function") window.showPanel("workout");
      } catch (_) {}
      setAdminStatus("Preview on Workout tab (not published yet).", "info");
    });

    $("publish-plan")?.addEventListener("click", () => publishPlan());

    $("plan-history-list")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-use-plan]");
      if (!btn) return;
      const item = btn.closest("[data-plan-path]");
      const path = item?.getAttribute("data-plan-path");
      if (path) useHistoryPlan(path);
    });

    $("plan-history-refresh")?.addEventListener("click", () => loadHistoryIndex());
  }

  async function boot() {
    await loadGifLibrary();
    await loadHistoryIndex();
    fillCustomBodySelect("full-body", "exercises");
  }

  return {
    wire,
    boot,
    startEditCurrent,
    publishPlan,
    getDraftMoves: () => cart.slice(),
  };
})();
