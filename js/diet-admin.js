window.SapnaDietAdmin = (() => {
  const REPO = { owner: "drishabhh", name: "sapna-health", branch: "main" };
  const TODAY_PATH = "data/diet-today.json";
  const PLANS_DIR = "data/diet-plans";
  const PLANS_INDEX = "data/diet-plans/index.json";
  const FOODS_PATH = "data/foods.json";
  const LS_TOKEN = "sapna_gh_token";
  const MEALS = [
    { id: "breakfast", label: "Breakfast" },
    { id: "lunch", label: "Lunch" },
    { id: "dinner", label: "Dinner" },
    { id: "snacks", label: "Snacks" },
  ];

  let foods = [];
  /** @type {Array<{id:string,meal:string,name:string,kcal:number,protein:number,note:string}>} */
  let cart = [];
  let planMode = "edit";
  let targetDate = "";
  let headline = "Today’s plate";
  let support = "Check what you ate · add extras if needed";
  let targetKcal = 1800;
  let targetProtein = 100;
  /** @type {Array<{date:string,headline:string,itemCount:number,path:string}>} */
  let historyIndex = [];
  let browseMeal = "breakfast";
  let browseQuery = "";

  const $ = (id) => document.getElementById(id);

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function tomorrowISO() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

  function roundn(n, d = 1) {
    const f = 10 ** d;
    return Math.round(Number(n) * f) / f;
  }

  /** Carry base serving + macros so Sapna can scale by grams later. */
  function nutritionFields(src = {}) {
    const servingGrams =
      Number(src.servingGrams) ||
      parseServingGrams(src.servingSize) ||
      parseServingGrams(src.note) ||
      parseServingGrams(src.name) ||
      null;
    const out = {};
    if (Number.isFinite(servingGrams) && servingGrams > 0) out.servingGrams = roundn(servingGrams, 1);
    if (src.servingSize) out.servingSize = String(src.servingSize);
    if (src.foodId || src.id) out.foodId = src.foodId || src.id;
    ["carbs", "fat", "fiber", "sugars", "sodiumMg"].forEach((k) => {
      if (src[k] != null && Number.isFinite(Number(src[k]))) out[k] = roundn(src[k], 2);
    });
    if (Array.isArray(src.ingredients) && src.ingredients.length) {
      out.ingredients = src.ingredients
        .map((ing) => {
          if (!ing || typeof ing !== "object") return null;
          const name = String(ing.name || "").trim();
          if (!name) return null;
          const row = { name };
          if (ing.grams != null && Number.isFinite(Number(ing.grams))) row.grams = roundn(ing.grams, 1);
          else if (ing.amount != null && Number.isFinite(Number(ing.amount))) row.grams = roundn(ing.amount, 1);
          if (ing.unit) row.unit = String(ing.unit);
          return row;
        })
        .filter(Boolean);
      if (!out.ingredients.length) delete out.ingredients;
    }
    return out;
  }

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  }

  function getToken() {
    const typed = ($("admin-token")?.value || "").trim();
    if (typed && !typed.startsWith("••")) return typed;
    return (localStorage.getItem(LS_TOKEN) || "").trim();
  }

  function setStatus(msg, kind) {
    const el = $("admin-status");
    const pub = $("diet-publish-status");
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

  function b64EncodeUnicode(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  async function githubGetSha(path, token) {
    const res = await fetch(
      `https://api.github.com/repos/${REPO.owner}/${REPO.name}/contents/${path}?ref=${REPO.branch}`,
      { headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}` } }
    );
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
      throw new Error(err.message || `GitHub ${res.status}`);
    }
  }

  function cartTotals() {
    return cart.reduce(
      (a, it) => {
        a.kcal += Number(it.kcal) || 0;
        a.protein += Number(it.protein) || 0;
        return a;
      },
      { kcal: 0, protein: 0 }
    );
  }

  function showBuilder(show) {
    const el = $("diet-plan-builder");
    if (el) el.hidden = !show;
  }

  function fillMetaFields() {
    if ($("diet-edit-headline")) $("diet-edit-headline").value = headline;
    if ($("diet-edit-support")) $("diet-edit-support").value = support;
    if ($("diet-edit-kcal")) $("diet-edit-kcal").value = String(targetKcal);
    if ($("diet-edit-protein")) $("diet-edit-protein").value = String(targetProtein);
  }

  function syncMetaFromDom() {
    headline = ($("diet-edit-headline")?.value || "").trim() || "Today’s plate";
    support = ($("diet-edit-support")?.value || "").trim() || "Check what you ate";
    targetKcal = Number($("diet-edit-kcal")?.value) || 1800;
    targetProtein = Number($("diet-edit-protein")?.value) || 100;
  }

  function cartFromPlan(plan) {
    const meals = plan?.meals || {};
    const out = [];
    MEALS.forEach(({ id }) => {
      (meals[id] || []).forEach((it) => {
        out.push({
          id: it.id || uid(id.slice(0, 2)),
          meal: id,
          name: it.name || "Food",
          kcal: Math.round(Number(it.kcal) || 0),
          protein: Math.round((Number(it.protein) || 0) * 10) / 10,
          note: it.note || "",
          ...nutritionFields(it),
        });
      });
    });
    return out;
  }

  function buildPlanFromCart() {
    syncMetaFromDom();
    const meals = { breakfast: [], lunch: [], dinner: [], snacks: [] };
    cart.forEach((it) => {
      const slot = meals[it.meal] ? it.meal : "snacks";
      meals[slot].push({
        id: it.id,
        name: it.name,
        kcal: Math.round(Number(it.kcal) || 0),
        protein: Math.round((Number(it.protein) || 0) * 10) / 10,
        note: it.note || "",
        ...nutritionFields(it),
      });
    });
    const date = targetDate || todayISO();
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      planDate: date,
      headline,
      support,
      targets: { kcal: targetKcal, protein: targetProtein },
      meals,
    };
  }

  function renderCart() {
    const list = $("diet-plan-cart-list");
    const empty = $("diet-plan-cart-empty");
    const countEls = document.querySelectorAll("[data-diet-cart-count]");
    const n = cart.length;
    countEls.forEach((el) => {
      el.textContent = String(n);
    });
    const pub = $("publish-diet-plan");
    if (pub) pub.disabled = n === 0;
    const tot = cartTotals();
    const meta = $("diet-plan-builder-meta");
    if (meta) {
      meta.hidden = false;
      meta.textContent =
        (planMode === "create" ? `New · ${targetDate}` : `Editing · ${targetDate || todayISO()}`) +
        ` · cart ${Math.round(tot.kcal)} kcal / ${Math.round(tot.protein)}g P` +
        ` · goal ${targetKcal} kcal`;
    }
    if (!list) return;
    if (!n) {
      list.hidden = true;
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;
    list.hidden = false;
    list.innerHTML = MEALS.map(({ id, label }) => {
      const items = cart.filter((c) => c.meal === id);
      if (!items.length) {
        return `<div class="diet-cart-meal">
          <header class="diet-cart-meal-head">
            <h4>${label}</h4>
            <button type="button" class="btn-ghost" data-diet-browse-meal="${id}">+ Add</button>
          </header>
          <p class="hint">Empty — tap + Add</p>
        </div>`;
      }
      const rows = items
        .map((it) => {
          const idx = cart.indexOf(it);
          return `<li class="diet-cart-item" data-diet-cart-idx="${idx}">
            <div class="diet-cart-item-main">
              <strong>${escapeHtml(it.name)}</strong>
              <span>${it.kcal} kcal · ${it.protein}g P${it.servingGrams ? ` · ${it.servingGrams}g` : ""}${it.note ? ` · ${escapeHtml(it.note)}` : ""}</span>
            </div>
            <div class="diet-cart-item-actions">
              <button type="button" class="btn-ghost" data-diet-cart-up aria-label="Move up">↑</button>
              <button type="button" class="btn-ghost" data-diet-cart-down aria-label="Move down">↓</button>
              <button type="button" class="btn-ghost" data-diet-cart-remove aria-label="Remove">✕</button>
            </div>
          </li>`;
        })
        .join("");
      const slotK = items.reduce((a, it) => a + (Number(it.kcal) || 0), 0);
      return `<div class="diet-cart-meal">
        <header class="diet-cart-meal-head">
          <div>
            <h4>${label}</h4>
            <p class="hint">${items.length} · ${slotK} kcal</p>
          </div>
          <button type="button" class="btn-ghost" data-diet-browse-meal="${id}">+ Add</button>
        </header>
        <ul class="diet-cart-list-ul">${rows}</ul>
      </div>`;
    }).join("");
  }

  function addToCart(item) {
    cart.push({
      id: item.id || uid("d"),
      meal: item.meal || browseMeal || "snacks",
      name: item.name || "Food",
      kcal: Math.round(Number(item.kcal) || 0),
      protein: Math.round((Number(item.protein) || 0) * 10) / 10,
      note: item.note || "",
      ...nutritionFields(item),
    });
    renderCart();
  }

  function openBrowse(meal) {
    if (meal) browseMeal = meal;
    browseQuery = "";
    const overlay = $("diet-plan-browse");
    if (overlay) {
      overlay.hidden = false;
      overlay.removeAttribute("hidden");
      overlay.classList.add("is-open");
      overlay.style.cssText =
        "display:flex !important; position:fixed !important; inset:0 !important; z-index:100070 !important; opacity:1 !important; visibility:visible !important; pointer-events:auto !important; background:rgba(12,22,20,0.72) !important;";
      if (window.SapnaKeyboard?.pinOverlayToVv) window.SapnaKeyboard.pinOverlayToVv(overlay);
    }
    if ($("diet-browse-search")) $("diet-browse-search").value = "";
    renderBrowse();
  }

  function closeBrowse() {
    const overlay = $("diet-plan-browse");
    if (overlay) {
      overlay.hidden = true;
      overlay.setAttribute("hidden", "");
      overlay.classList.remove("is-open");
      overlay.style.cssText = "";
    }
  }

  function openMeta() {
    const overlay = $("diet-plan-meta");
    if ($("diet-meta-name")) $("diet-meta-name").value = "";
    if ($("diet-meta-date")) $("diet-meta-date").value = tomorrowISO();
    if (overlay) {
      overlay.hidden = false;
      overlay.removeAttribute("hidden");
      overlay.classList.add("is-open");
      overlay.style.cssText =
        "display:flex !important; position:fixed !important; inset:0 !important; z-index:100070 !important;";
      if (window.SapnaKeyboard?.pinOverlayToVv) window.SapnaKeyboard.pinOverlayToVv(overlay);
    }
  }

  function closeMeta() {
    const overlay = $("diet-plan-meta");
    if (overlay) {
      overlay.hidden = true;
      overlay.setAttribute("hidden", "");
      overlay.classList.remove("is-open");
      overlay.style.cssText = "";
    }
  }

  function libraryMatches(q) {
    const query = String(q || "").toLowerCase().trim();
    let list = foods.slice();
    try {
      const custom = window.Diet?.listFoods?.() || [];
      list = [...list, ...custom];
    } catch (_) {}
    if (query) {
      list = list.filter((f) => {
        const hay = [f.name, f.brand, f.product, ...(f.tags || [])].filter(Boolean).join(" ").toLowerCase();
        return hay.includes(query);
      });
    }
    return list.slice(0, 60);
  }

  function renderBrowse() {
    const body = $("diet-browse-body");
    const footer = $("diet-browse-footer");
    if (!body) return;
    const mealLabel = MEALS.find((m) => m.id === browseMeal)?.label || browseMeal;
    const chips = MEALS.map(
      ({ id, label }) =>
        `<button type="button" class="meal-chip${id === browseMeal ? " is-active" : ""}" data-diet-browse-set="${id}">${label}</button>`
    ).join("");
    const matches = libraryMatches(browseQuery);
    const tiles = matches.length
      ? matches
          .map(
            (f) => `<button type="button" class="diet-browse-tile" data-diet-add-food="${escapeHtml(f.id)}">
              <strong>${escapeHtml(f.name)}</strong>
              <em>${f.kcal} kcal · ${f.protein}g P</em>
            </button>`
          )
          .join("")
      : `<p class="hint">No library match — use Quick item below.</p>`;
    body.innerHTML = `
      <p class="hint">Adding to <strong>${escapeHtml(mealLabel)}</strong> — tap a food into the cart.</p>
      <div class="diet-browse-meal-chips" role="tablist">${chips}</div>
      <label class="field">Search library
        <input type="search" id="diet-browse-search-live" value="${escapeHtml(browseQuery)}" placeholder="Roti, paneer, curd…" autocomplete="off" />
      </label>
      <div class="diet-browse-grid">${tiles}</div>
      <details class="diet-browse-quick" open>
        <summary>Quick item (not in library)</summary>
        <div class="field-row">
          <label class="field">Name
            <input type="text" id="diet-browse-quick-name" placeholder="e.g. Homemade khichdi" />
          </label>
          <label class="field">kcal
            <input type="number" id="diet-browse-quick-kcal" min="0" step="10" />
          </label>
        </div>
        <div class="field-row">
          <label class="field">Protein g
            <input type="number" id="diet-browse-quick-protein" min="0" step="0.5" />
          </label>
          <label class="field">Note
            <input type="text" id="diet-browse-quick-note" placeholder="1 bowl" />
          </label>
        </div>
        <button type="button" class="btn-primary" id="diet-browse-quick-add">Add to ${escapeHtml(mealLabel)}</button>
      </details>`;
    if (footer) {
      footer.innerHTML = `<button type="button" class="btn-primary" id="diet-browse-done">Done · cart (${cart.length})</button>`;
      $("diet-browse-done")?.addEventListener("click", () => closeBrowse());
    }
    $("diet-browse-search-live")?.addEventListener("input", (e) => {
      browseQuery = e.target.value || "";
      renderBrowse();
      const live = $("diet-browse-search-live");
      if (live) {
        live.focus();
        try {
          const len = live.value.length;
          live.setSelectionRange(len, len);
        } catch (_) {}
      }
    });
    body.querySelectorAll("[data-diet-browse-set]").forEach((btn) => {
      btn.addEventListener("click", () => {
        browseMeal = btn.getAttribute("data-diet-browse-set") || "breakfast";
        renderBrowse();
      });
    });
    body.querySelectorAll("[data-diet-add-food]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-diet-add-food");
        const food =
          foods.find((f) => f.id === id) ||
          (window.Diet?.listFoods?.() || []).find((f) => f.id === id);
        if (!food) return;
        addToCart({
          id: uid("pl"),
          meal: browseMeal,
          name: food.name,
          kcal: food.kcal,
          protein: food.protein,
          note: food.servingSize || "",
          ...nutritionFields(food),
        });
        setStatus(`Added ${food.name} → ${MEALS.find((m) => m.id === browseMeal)?.label}`, "ok");
        if (footer) footer.innerHTML = `<button type="button" class="btn-primary" id="diet-browse-done">Done · cart (${cart.length})</button>`;
        $("diet-browse-done")?.addEventListener("click", () => closeBrowse());
      });
    });
    $("diet-browse-quick-add")?.addEventListener("click", () => {
      const name = ($("diet-browse-quick-name")?.value || "").trim();
      const kcal = Number($("diet-browse-quick-kcal")?.value);
      const protein = Number($("diet-browse-quick-protein")?.value);
      const note = ($("diet-browse-quick-note")?.value || "").trim();
      if (!name || !Number.isFinite(kcal)) {
        setStatus("Quick item needs name + kcal.", "error");
        return;
      }
      addToCart({
        id: uid("q"),
        meal: browseMeal,
        name,
        kcal,
        protein: Number.isFinite(protein) ? protein : 0,
        note,
      });
      if ($("diet-browse-quick-name")) $("diet-browse-quick-name").value = "";
      setStatus(`Added ${name}`, "ok");
      renderBrowse();
    });
  }

  function renderHistory() {
    const root = $("diet-plan-history-list");
    if (!root) return;
    if (!historyIndex.length) {
      root.innerHTML = `<p class="hint">No diet plans published yet.</p>`;
      return;
    }
    root.innerHTML = historyIndex
      .slice(0, 14)
      .map(
        (p) => `<button type="button" class="plan-history-row" data-diet-hist="${escapeHtml(p.path)}">
          <strong>${escapeHtml(p.date)}</strong>
          <span>${escapeHtml(p.headline || "Diet plan")} · ${p.itemCount || 0} items</span>
        </button>`
      )
      .join("");
    root.querySelectorAll("[data-diet-hist]").forEach((btn) => {
      btn.addEventListener("click", () => useHistoryPlan(btn.getAttribute("data-diet-hist")));
    });
  }

  async function loadFoods() {
    try {
      const res = await fetch(`./${FOODS_PATH}?t=${Date.now()}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        foods = data.foods || [];
      }
    } catch (_) {}
  }

  async function loadHistory() {
    try {
      const res = await fetch(`./${PLANS_INDEX}?t=${Date.now()}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        historyIndex = data.plans || [];
      }
    } catch (_) {}
    renderHistory();
  }

  async function startEditCurrent() {
    await loadFoods();
    planMode = "edit";
    targetDate = todayISO();
    try {
      const res = await fetch(`./${TODAY_PATH}?t=${Date.now()}`, { cache: "no-store" });
      if (res.ok) {
        const plan = await res.json();
        cart = cartFromPlan(plan);
        headline = plan.headline || headline;
        support = plan.support || support;
        targetKcal = plan.targets?.kcal || targetKcal;
        targetProtein = plan.targets?.protein || targetProtein;
      } else {
        cart = [];
      }
    } catch {
      cart = [];
    }
    fillMetaFields();
    showBuilder(true);
    renderCart();
    setStatus("Editing today’s diet — add foods, then Publish.", "info");
    openBrowse("breakfast");
  }

  async function startCreateNew() {
    await loadFoods();
    openMeta();
  }

  function continueCreate() {
    const name = ($("diet-meta-name")?.value || "").trim();
    const date = ($("diet-meta-date")?.value || "").trim() || tomorrowISO();
    planMode = "create";
    targetDate = date;
    headline = name || `Diet · ${date}`;
    cart = [];
    fillMetaFields();
    closeMeta();
    showBuilder(true);
    renderCart();
    setStatus(`New diet plan for ${date} — fill the cart, then Publish.`, "info");
    openBrowse("breakfast");
  }

  async function useHistoryPlan(path) {
    setStatus("Loading past diet plan…", "info");
    try {
      const res = await fetch(`./${path}?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Could not load that diet plan.");
      const plan = await res.json();
      planMode = "edit";
      targetDate = todayISO();
      cart = cartFromPlan(plan);
      headline = plan.headline || headline;
      support = plan.support || support;
      targetKcal = plan.targets?.kcal || targetKcal;
      targetProtein = plan.targets?.protein || targetProtein;
      fillMetaFields();
      showBuilder(true);
      renderCart();
      setStatus("Loaded into cart — edit if needed, then Publish.", "ok");
      $("diet-plan-builder")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      setStatus(err.message || String(err), "error");
    }
  }

  async function publishPlan() {
    const token = getToken();
    if (!token) {
      setStatus("Save a GitHub PAT first (repo scope).", "error");
      return;
    }
    if (!cart.length) {
      setStatus("Cart is empty — add foods first.", "error");
      return;
    }
    const plan = buildPlanFromCart();
    const date = targetDate || plan.planDate || todayISO();
    plan.planDate = date;
    const histPath = `${PLANS_DIR}/${date}.json`;
    const histEntry = {
      date,
      headline: plan.headline,
      itemCount: cart.length,
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
    const btn = $("publish-diet-plan");
    if (btn) btn.disabled = true;
    setStatus("Publishing diet plan…", "info");
    try {
      const writeToday = planMode === "edit" || date === todayISO();
      if (writeToday) {
        await githubPutFile(
          TODAY_PATH,
          b64EncodeUnicode(JSON.stringify(plan, null, 2) + "\n"),
          `Update today's diet plan (${date})`,
          token
        );
      }
      await githubPutFile(
        histPath,
        b64EncodeUnicode(JSON.stringify(plan, null, 2) + "\n"),
        `Save diet plan ${date}`,
        token
      );
      await githubPutFile(
        PLANS_INDEX,
        b64EncodeUnicode(JSON.stringify(nextIndex, null, 2) + "\n"),
        `Update diet plan index (${date})`,
        token
      );
      historyIndex = nextIndex.plans;
      renderHistory();
      if (writeToday && window.Diet?.loadPublishedPlan) {
        try {
          window.Diet.loadPublishedPlan(plan);
        } catch (_) {}
      }
      try {
        if (window.sapnaHaptic?.ok) window.sapnaHaptic.ok();
      } catch (_) {}
      setStatus(
        writeToday
          ? "Diet plan published for today + history. Pages ~30–60s."
          : `Diet plan for ${date} saved in history. Pages ~30–60s.`,
        "ok"
      );
    } catch (err) {
      setStatus(err.message || String(err), "error");
    } finally {
      if (btn) btn.disabled = cart.length === 0;
    }
  }

  async function aiSuggestPlan() {
    const st = $("diet-ai-suggest-status") || $("admin-status");
    syncMetaFromDom();
    const puterCall = (opts) =>
      window.PuterGrok?.suggestDietPlan
        ? window.PuterGrok.suggestDietPlan({ kcal: targetKcal, protein: targetProtein }, opts)
        : Promise.reject(new Error("Puter diet suggest unavailable."));
    try {
      let result;
      let provider = "gemini";
      if (window.AiBridge?.withFallback && window.Gemini?.suggestDietPlan) {
        const out = await window.AiBridge.withFallback({
          statusEl: st,
          geminiCall: () => window.Gemini.suggestDietPlan({ kcal: targetKcal, protein: targetProtein }),
          puterCall,
        });
        result = out.result;
        provider = out.provider;
      } else if (window.Gemini?.suggestDietPlan) {
        result = await window.Gemini.suggestDietPlan({ kcal: targetKcal, protein: targetProtein });
      } else {
        throw new Error("AI not ready — unlock Admin and save a Gemini key, or use Puter.");
      }
      const meals = result?.meals || result;
      let n = 0;
      MEALS.forEach(({ id }) => {
        (meals?.[id] || []).forEach((it) => {
          if (!it?.name) return;
          addToCart({
            id: uid("ai"),
            meal: id,
            name: String(it.name),
            kcal: Number(it.kcal) || 0,
            protein: Number(it.protein) || 0,
            note: it.note || it.serving || "",
            ...nutritionFields(it),
          });
          n += 1;
        });
      });
      if (result?.headline) {
        headline = String(result.headline);
        fillMetaFields();
      }
      setStatus(
        n
          ? `AI added ${n} items via ${provider === "puter-grok" ? "Puter Grok" : "Gemini"}. Edit cart, then Publish.`
          : "AI returned no meal items — try again or add manually.",
        n ? "ok" : "error"
      );
      showBuilder(true);
      renderCart();
    } catch (e) {
      setStatus(e.message || String(e), "error");
    }
  }

  function wireCartClicks() {
    $("diet-plan-cart-list")?.addEventListener("click", (e) => {
      const browse = e.target.closest("[data-diet-browse-meal]");
      if (browse) {
        openBrowse(browse.getAttribute("data-diet-browse-meal"));
        return;
      }
      const row = e.target.closest("[data-diet-cart-idx]");
      if (!row) return;
      const idx = Number(row.getAttribute("data-diet-cart-idx"));
      if (!Number.isFinite(idx) || idx < 0 || idx >= cart.length) return;
      if (e.target.closest("[data-diet-cart-remove]")) {
        cart.splice(idx, 1);
        renderCart();
        return;
      }
      if (e.target.closest("[data-diet-cart-up]") && idx > 0) {
        const tmp = cart[idx - 1];
        cart[idx - 1] = cart[idx];
        cart[idx] = tmp;
        renderCart();
        return;
      }
      if (e.target.closest("[data-diet-cart-down]") && idx < cart.length - 1) {
        const tmp = cart[idx + 1];
        cart[idx + 1] = cart[idx];
        cart[idx] = tmp;
        renderCart();
      }
    });
  }

  function wire() {
    $("diet-edit-current")?.addEventListener("click", () => startEditCurrent());
    $("diet-create-new")?.addEventListener("click", () => startCreateNew());
    $("diet-plan-browse-open")?.addEventListener("click", () => openBrowse(browseMeal));
    $("diet-plan-browse-close")?.addEventListener("click", () => closeBrowse());
    $("diet-plan-meta-close")?.addEventListener("click", () => closeMeta());
    $("diet-meta-continue")?.addEventListener("click", () => continueCreate());
    $("publish-diet-plan")?.addEventListener("click", () => publishPlan());
    $("diet-ai-suggest")?.addEventListener("click", () => aiSuggestPlan());
    $("diet-ai-suggest-puter")?.addEventListener("click", async () => {
      const st = $("diet-ai-suggest-status") || $("admin-status");
      syncMetaFromDom();
      try {
        if (!window.AiBridge?.puterOnly || !window.PuterGrok?.suggestDietPlan) {
          throw new Error("Puter path unavailable.");
        }
        const { result } = await window.AiBridge.puterOnly({
          statusEl: st,
          puterCall: (opts) =>
            window.PuterGrok.suggestDietPlan({ kcal: targetKcal, protein: targetProtein }, opts),
        });
        const meals = result?.meals || result;
        let n = 0;
        MEALS.forEach(({ id }) => {
          (meals?.[id] || []).forEach((it) => {
            if (!it?.name) return;
            addToCart({
              id: uid("ai"),
              meal: id,
              name: String(it.name),
              kcal: Number(it.kcal) || 0,
              protein: Number(it.protein) || 0,
              note: it.note || "",
              ...nutritionFields(it),
            });
            n += 1;
          });
        });
        setStatus(n ? `Puter added ${n} items.` : "No items from Puter.", n ? "ok" : "error");
        showBuilder(true);
        renderCart();
      } catch (e) {
        setStatus(e.message || String(e), "error");
      }
    });
    $("diet-plan-history-refresh")?.addEventListener("click", () => loadHistory());
    ["diet-edit-headline", "diet-edit-support", "diet-edit-kcal", "diet-edit-protein"].forEach((id) => {
      $(id)?.addEventListener("change", () => {
        syncMetaFromDom();
        renderCart();
      });
    });
    wireCartClicks();
  }

  async function boot() {
    await loadFoods();
    await loadHistory();
  }

  return { wire, boot, startEditCurrent, publishPlan, openBrowse };
})();
