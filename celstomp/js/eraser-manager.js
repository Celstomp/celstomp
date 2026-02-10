let _eraserCtxMenu = null;
let _eraserCtxState = null;
function ensureEraserCtxMenu() {
    if (_eraserCtxMenu) return _eraserCtxMenu;
    const m = document.createElement("div");
    m.id = "eraserCtxMenu";
    m.hidden = true;
    Object.assign(m.style, {
        position: "fixed",
        zIndex: "10000",
        minWidth: "220px",
        padding: "10px",
        borderRadius: "12px",
        background: "rgba(18,18,20,0.96)",
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: "0 16px 40px rgba(0,0,0,0.45)",
        color: "rgba(255,255,255,0.92)",
        fontFamily: "var(--font), system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
        fontSize: "13px",
        backdropFilter: "blur(8px)"
    });
    m.innerHTML = `\n        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:8px;">\n          <div style="font-weight:700; letter-spacing:.2px;">Eraser options</div>\n        </div>\n\n        <div style="display:flex; align-items:center; gap:10px; margin:8px 0;">\n          <div style="width:52px; opacity:.85;">Size</div>\n          <input id="ecmSize" type="range" min="1" max="400" step="1" value="24" style="flex:1;">\n          <div id="ecmSizeVal" style="width:34px; text-align:right; font-variant-numeric:tabular-nums;">24</div>\n        </div>\n      `;
    const $m = sel => m.querySelector(sel);
    const sizeEl = $m("#ecmSize");
    const sizeVal = $m("#ecmSizeVal");
    function syncRangeLimitsFromMainUI() {
        if (typeof eraserSizeInput !== "undefined" && eraserSizeInput) {
            if (eraserSizeInput.min) sizeEl.min = eraserSizeInput.min;
            if (eraserSizeInput.max) sizeEl.max = eraserSizeInput.max;
            if (eraserSizeInput.step) sizeEl.step = eraserSizeInput.step;
        }
    }
    function syncMenuFromState() {
        syncRangeLimitsFromMainUI();
        const v = Math.round(Number(eraserSize) || 1);
        sizeEl.value = String(v);
        sizeVal.textContent = String(v);
    }
    function syncMainUIFromState() {
        if (typeof eraserSizeInput !== "undefined" && eraserSizeInput) {
            eraserSizeInput.value = String(Math.round(Number(eraserSize) || 1));
        }
        if (typeof eraserVal !== "undefined" && eraserVal) {
            eraserVal.textContent = String(Math.round(Number(eraserSize) || 1));
        }
    }
    function applyEraserSizeFromMenu() {
        const v = Math.round(Number(sizeEl.value) || 1);
        eraserSize = clamp(v, 1, 999);
        sizeVal.textContent = String(eraserSize);
        syncMainUIFromState();
    }
    sizeEl.addEventListener("input", applyEraserSizeFromMenu);
    sizeEl.addEventListener("change", applyEraserSizeFromMenu);
    document.addEventListener("mousedown", e => {
        if (m.hidden) return;
        if (e.target === m || m.contains(e.target)) return;
        closeEraserCtxMenu();
    }, true);
    document.addEventListener("keydown", e => {
        if (m.hidden) return;
        if (e.key === "Escape") closeEraserCtxMenu();
    });
    window.addEventListener("blur", () => closeEraserCtxMenu());
    document.body.appendChild(m);
    m._syncFromState = syncMenuFromState;
    _eraserCtxMenu = m;
    return m;
}
function openEraserCtxMenu(ev, anchorEl) {
    try {
        closeBrushCtxMenu?.();
    } catch {}
    const m = ensureEraserCtxMenu();
    _eraserCtxState = {
        anchorEl: anchorEl || null
    };
    try {
        m._syncFromState?.();
    } catch {}
    m.hidden = false;
    m.style.left = "0px";
    m.style.top = "0px";
    const pad = 6;
    const vw = window.innerWidth, vh = window.innerHeight;
    const r = m.getBoundingClientRect();
    let x = (ev?.clientX ?? 0) + 8;
    let y = (ev?.clientY ?? 0) + 8;
    if (x + r.width + pad > vw) x = Math.max(pad, vw - r.width - pad);
    if (y + r.height + pad > vh) y = Math.max(pad, vh - r.height - pad);
    m.style.left = `${x}px`;
    m.style.top = `${y}px`;
    try {
        m.querySelector("#ecmSize")?.focus({
            preventScroll: true
        });
    } catch {}
}
function closeEraserCtxMenu() {
    if (_eraserCtxMenu) _eraserCtxMenu.hidden = true;
    _eraserCtxState = null;
}

// wiring code for eraser
function wireEraserButtonRightClick() {
  if (document._eraserCtxWired) return;
  document._eraserCtxWired = true;
  const eraserSelectors = [ "#toolEraser", '[data-tool="eraser"]', '[data-tool="fill-eraser"]', '[data-toolid="eraser"]', '[data-toolid="fill-eraser"]', '[data-toolname="eraser"]', '[data-toolname="fill-eraser"]', 'button[value="eraser"]', 'button[value="fill-eraser"]', 'input[value="eraser"]', 'input[value="fill-eraser"]' ].join(",");
  document.addEventListener("contextmenu", e => {
      const t = e.target;
      if (!t) return;
      const eraserEl = t.closest?.(eraserSelectors);
      if (!eraserEl) return;
      e.preventDefault();
      e.stopPropagation();
      openEraserCtxMenu(e, eraserEl);
  }, {
      capture: true
  });
  try {
      getCanvas(CANVAS_TYPE.drawCanvas)?.addEventListener("pointerdown", () => closeEraserCtxMenu(), {
          passive: true
      });
  } catch {}
}