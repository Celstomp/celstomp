let _brushPrevEl = null;
let _brushPrevCanvas = null;
let _brushPrevLastEvt = null;
let _brushPrevRAF = 0;
let _brushPrevLastXY = null;
let brushType = "circle";

let eraserSize = 100;
const DEFAULT_TOOL_BRUSH_SETTINGS = {
    shape: "circle",
    size: 3,
    opacity: 1,
    angle: 0
};
const DEFAULT_TOOL_ERASER_SETTINGS = {
    shape: "circle",
    size: 100,
    opacity: 1,
    angle: 0
};
let brushSettings = {
    ...DEFAULT_TOOL_BRUSH_SETTINGS
};
let eraserSettings = {
    ...DEFAULT_TOOL_ERASER_SETTINGS
};
brushType = brushSettings.shape;
brushSize = brushSettings.size;
eraserSize = eraserSettings.size;

let antiAlias = false;
let closeGapPx = 0;

function initBrushCursorPreview(inputCanvasEl) {
    _brushPrevCanvas = inputCanvasEl;
    _brushPrevEl = document.getElementById("brushCursorPreview");
    if (!_brushPrevCanvas || !_brushPrevEl) return;
    let hovering = false;
    let down = false;
    const show = () => {
        _brushPrevEl.style.display = "block";
    };
    const hide = () => {
        _brushPrevEl.style.display = "none";
    };
    _brushPrevCanvas.addEventListener("pointerenter", () => {
        hovering = true;
        show();
        scheduleBrushPreviewUpdate(true);
    });
    _brushPrevCanvas.addEventListener("pointerleave", () => {
        hovering = false;
        if (!down) hide();
    });
    _brushPrevCanvas.addEventListener("pointermove", e => {
        _brushPrevLastEvt = e;
        _brushPrevLastXY = {
            x: e.clientX,
            y: e.clientY
        };
        scheduleBrushPreviewUpdate();
    });
    _brushPrevCanvas.addEventListener("pointerdown", e => {
        down = true;
        _brushPrevLastEvt = e;
        _brushPrevLastXY = {
            x: e.clientX,
            y: e.clientY
        };
        show();
        scheduleBrushPreviewUpdate(true);
    });
    window.addEventListener("pointerup", () => {
        down = false;
        if (!hovering) hide();
        scheduleBrushPreviewUpdate(true);
    }, {
        passive: true
    });
    _brushPrevCanvas.addEventListener("wheel", () => {
        scheduleBrushPreviewUpdate(true);
    }, {
        passive: true
    });
    try {
        $("brushSizeInput")?.addEventListener("input", () => scheduleBrushPreviewUpdate(true));
    } catch {}
    try {
        $("eraserSizeInput")?.addEventListener("input", () => scheduleBrushPreviewUpdate(true));
    } catch {}
    document.addEventListener("change", e => {
        const t = e.target;
        if (!(t instanceof HTMLInputElement)) return;
        if (t.name === "brush" || t.name === "brushShape" || t.name === "tool") scheduleBrushPreviewUpdate(true);
    }, {
        passive: true
    });
    hide();
  }
  

function brushShapeForType(kind) {
    const t = String(kind || "circle");
    if (t === "circle" || t === "square" || t === "diamond" || t === "oval-h" || t === "oval-v" || t === "rect-h" || t === "rect-v" || t === "triangle") return t;
    return "circle";
}
function brushShapeDimensions(shape, size) {
    const s = Math.max(1, Math.round(size || 1));
    switch (brushShapeForType(shape)) {
        case "oval-h":
            return {
                w: s,
                h: Math.max(1, Math.round(s * 0.55))
            };
        case "oval-v":
            return {
                w: Math.max(1, Math.round(s * 0.55)),
                h: s
            };
        case "rect-h":
            return {
                w: s,
                h: Math.max(1, Math.round(s * 0.4))
            };
        case "rect-v":
            return {
                w: Math.max(1, Math.round(s * 0.4)),
                h: s
            };
        default:
            return {
                w: s,
                h: s
            };
    }
}
function clamp01(v) {
    return Math.max(0, Math.min(1, Number(v) || 0));
}
function mergeBrushSettings(base, patch) {
    const next = {
        ...base,
        ...patch
    };
    next.shape = brushShapeForType(next.shape);
    next.size = Math.max(1, Math.round(next.size || 1));
    next.opacity = clamp01(next.opacity);
    next.angle = Math.max(-90, Math.min(90, Math.round(Number(next.angle) || 0)));
    return next;
}

function stampLine(ctx, x0, y0, x1, y1, sourceSettings, color, alpha = 1, composite = "source-over") {
    const settings = normalizedBrushRenderSettings(sourceSettings);
    const stamp = getBrushStamp(settings, color);
    const dx = x1 - x0, dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    const step = Math.max(1, settings.size * .5);
    const n = Math.max(1, Math.ceil(dist / step));
    const nx = dx / n, ny = dy / n;
    ctx.save();
    ctx.globalCompositeOperation = composite;
    ctx.globalAlpha = clamp01(alpha) * clamp01(settings.opacity);
    ctx.fillStyle = color;
    for (let i = 0; i <= n; i++) {
        const px = Math.round(x0 + nx * i - stamp.ox);
        const py = Math.round(y0 + ny * i - stamp.oy);
        ctx.drawImage(stamp.canvas, px, py);
    }
    try {
        markGlobalHistoryDirty();
    } catch {}
    ctx.restore();
}

function normalizedBrushRenderSettings(source) {
    return mergeBrushSettings(DEFAULT_TOOL_BRUSH_SETTINGS, source || {});
}

const _brushMaskCache = new Map();
const _brushStampCache = new Map();
function brushMaskCacheKey(settings) {
    return `${settings.shape}|${settings.size}|${settings.angle}`;
}
function brushStampCacheKey(settings, color) {
    return `${brushMaskCacheKey(settings)}|${color}`;
}

function getBrushMask(sourceSettings) {
    const settings = normalizedBrushRenderSettings(sourceSettings);
    const key = brushMaskCacheKey(settings);
    const cached = _brushMaskCache.get(key);
    if (cached) return cached;

    const dim = brushShapeDimensions(settings.shape, settings.size);
    const w = dim.w;
    const h = dim.h;
    const cx = w / 2;
    const cy = h / 2;
    const rx = Math.max(0.5, w / 2);
    const ry = Math.max(0.5, h / 2);
    const shape = settings.shape;

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", {
        willReadFrequently: true
    });

    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const px = x + 0.5;
            const py = y + 0.5;
            let inside = false;
            if (shape === "circle" || shape === "oval-h" || shape === "oval-v") {
                const nx = (px - cx) / rx;
                const ny = (py - cy) / ry;
                inside = nx * nx + ny * ny <= 1;
            } else if (shape === "square" || shape === "rect-h" || shape === "rect-v") {
                inside = true;
            } else if (shape === "diamond") {
                const nx = Math.abs((px - cx) / rx);
                const ny = Math.abs((py - cy) / ry);
                inside = nx + ny <= 1;
            } else if (shape === "triangle") {
                const tx = (px - cx) / rx;
                const ty = (py - cy) / ry;
                inside = ty <= 1 && ty >= -1 && Math.abs(tx) <= (1 - (ty + 1) / 2);
            }
            if (!inside) continue;
            const i = (y * w + x) * 4;
            d[i + 0] = 255;
            d[i + 1] = 255;
            d[i + 2] = 255;
            d[i + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);

    const angle = Number(settings.angle || 0);
    let outCanvas = canvas;
    if (angle !== 0) {
        const rad = angle * Math.PI / 180;
        const cos = Math.abs(Math.cos(rad));
        const sin = Math.abs(Math.sin(rad));
        const rw = Math.max(1, Math.ceil(w * cos + h * sin));
        const rh = Math.max(1, Math.ceil(w * sin + h * cos));
        const rc = document.createElement("canvas");
        rc.width = rw;
        rc.height = rh;
        const rctx = rc.getContext("2d");
        rctx.imageSmoothingEnabled = false;
        rctx.translate(rw / 2, rh / 2);
        rctx.rotate(rad);
        rctx.drawImage(canvas, -w / 2, -h / 2);
        outCanvas = rc;
    }

    const out = {
        canvas: outCanvas,
        w: outCanvas.width,
        h: outCanvas.height,
        ox: Math.floor(outCanvas.width / 2),
        oy: Math.floor(outCanvas.height / 2)
    };
    _brushMaskCache.set(key, out);
    return out;
}
function getBrushStamp(sourceSettings, colorRaw) {
    const settings = normalizedBrushRenderSettings(sourceSettings);
    const color = colorToHex(colorRaw || "#000000");
    const key = brushStampCacheKey(settings, color);
    const cached = _brushStampCache.get(key);
    if (cached) return cached;

    const mask = getBrushMask(settings);
    const canvas = document.createElement("canvas");
    canvas.width = mask.w;
    canvas.height = mask.h;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, mask.w, mask.h);
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(mask.canvas, 0, 0);
    ctx.globalCompositeOperation = "source-over";

    const out = {
        canvas: canvas,
        w: mask.w,
        h: mask.h,
        ox: mask.ox,
        oy: mask.oy
    };
    _brushStampCache.set(key, out);
    return out;
}

function scheduleBrushPreviewUpdate(force = false) {
    if (!_brushPrevEl || !_brushPrevCanvas) return;
    if (_brushPrevRAF && !force) return;
    _brushPrevRAF = requestAnimationFrame(() => {
        _brushPrevRAF = 0;
        updateBrushPreview();
    });
}
function getActiveToolKindForPreview() {
    return String(typeof tool !== "undefined" && tool ? tool : "");
}
function getBrushSizeForPreview(toolKind) {
    if (toolKind === "eraser") return Number(eraserSettings?.size ?? eraserSize ?? 8);
    return Number(brushSettings?.size ?? brushSize ?? 6);
}
function updateBrushPreview() {
    if (!_brushPrevEl || !_brushPrevCanvas) return;
    const toolKind = getActiveToolKindForPreview();
    const isBrush = toolKind === "brush";
    const isEraser = toolKind === "eraser";
    if (!isBrush && !isEraser) {
        _brushPrevEl.style.display = "none";
        return;
    }
    const pt = _brushPrevLastXY;
    if (!pt) return;
    const cx = pt.x;
    const cy = pt.y;
    const z = typeof getZoom() === "number" && isFinite(getZoom()) ? getZoom() : 1;
    const settings = isEraser ? eraserSettings : brushSettings;
    const renderSettings = normalizedBrushRenderSettings(settings);
    const shape = brushShapeForType(renderSettings.shape || "circle");
    const sizeContentPx = Math.max(1, renderSettings.size || getBrushSizeForPreview(isEraser ? "eraser" : "brush"));
    const dim = brushShapeDimensions(shape, sizeContentPx);
    const widthCssPx = Math.max(2, dim.w * z);
    const heightCssPx = Math.max(2, dim.h * z);
    _brushPrevEl.classList.remove("simple");
    _brushPrevEl.classList.toggle("eraser", !!isEraser);
    _brushPrevEl.style.border = "1px solid rgba(255,255,255,.95)";
    _brushPrevEl.style.boxShadow = "0 0 0 1px rgba(0,0,0,.78)";
    _brushPrevEl.style.borderStyle = isEraser ? "dashed" : "solid";
    _brushPrevEl.style.left = `${cx}px`;
    _brushPrevEl.style.top = `${cy}px`;
    _brushPrevEl.style.width = `${widthCssPx}px`;
    _brushPrevEl.style.height = `${heightCssPx}px`;
    _brushPrevEl.style.borderRadius = "0";
    _brushPrevEl.style.clipPath = "none";
    let shapeRotation = 0;
    if (shape === "circle" || shape === "oval-h" || shape === "oval-v") {
        _brushPrevEl.style.borderRadius = "999px";
    } else if (shape === "diamond") {
        shapeRotation = 45;
    } else if (shape === "triangle") {
        _brushPrevEl.style.clipPath = "polygon(50% 0%, 100% 100%, 0% 100%)";
    }
    _brushPrevEl.style.transform = `translate(-50%, -50%) rotate(${shapeRotation + (renderSettings.angle || 0)}deg)`;
    _brushPrevEl.style.display = "block";
}

function getBrushAntiAliasEnabled() {
    if (typeof brushAntiAlias !== "undefined") return !!brushAntiAlias;
    if (typeof brushAA !== "undefined") return !!brushAA;
    if (typeof antiAlias !== "undefined") return !!antiAlias;
    const el = $("aaToggle") || $("antiAlias") || $("brushAA");
    if (el && "checked" in el) return !!el.checked;
    return true;
}

///////////
// MENUS //
///////////

let _brushCtxMenu = null;
let _brushCtxState = null;
function ensureBrushCtxMenu() {
    if (_brushCtxMenu) return _brushCtxMenu;
    const m = document.createElement("div");
    m.id = "brushCtxMenu";
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
    m.innerHTML = `\n        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:8px;">\n          <div style="font-weight:700; letter-spacing:.2px;">Brush options</div>\n        </div>\n\n        <div style="display:flex; align-items:center; gap:10px; margin:8px 0;">\n          <div style="width:52px; opacity:.85;">Size</div>\n          <input id="bcmSize" type="range" min="1" max="200" step="1" value="3" style="flex:1;">\n          <div id="bcmSizeVal" style="width:34px; text-align:right; font-variant-numeric:tabular-nums;">3</div>\n        </div>\n\n        <label style="display:flex; align-items:center; gap:10px; margin:8px 0; cursor:pointer;">\n          <input id="bcmAA" type="checkbox">\n          <span>Anti-alias</span>\n        </label>\n\n        <div style="margin:10px 0 6px; font-weight:700; opacity:.9;">Pressure</div>\n\n        <label style="display:flex; align-items:center; gap:10px; margin:6px 0; cursor:pointer;">\n          <input id="bcmPSize" type="checkbox">\n          <span>Pressure → Size</span>\n        </label>\n\n        <label style="display:flex; align-items:center; gap:10px; margin:6px 0; cursor:pointer;">\n          <input id="bcmPOp" type="checkbox">\n          <span>Pressure → Opacity</span>\n        </label>\n\n        <div style="display:flex; gap:8px; margin-top:10px;">\n          <button type="button" id="bcmReset"\n            style="flex:1; padding:8px 10px; border-radius:10px; cursor:pointer;\n                  background:rgba(255,255,255,0.08); color:rgba(255,255,255,0.92);\n                  border:1px solid rgba(255,255,255,0.12); font:inherit;">\n            Reset\n          </button>\n        </div>\n      `;
    const $m = sel => m.querySelector(sel);
    const sizeEl = $m("#bcmSize");
    const sizeVal = $m("#bcmSizeVal");
    const aaEl = $m("#bcmAA");
    const pSizeEl = $m("#bcmPSize");
    const pOpEl = $m("#bcmPOp");
    const resetBtn = $m("#bcmReset");
    function syncRangeLimitsFromMainUI() {
        const brushSizeInput = $("brushSize") || $("brushSizeRange");

        if (typeof brushSizeInput !== "undefined" && brushSizeInput) {
            if (brushSizeInput.min) sizeEl.min = brushSizeInput.min;
            if (brushSizeInput.max) sizeEl.max = brushSizeInput.max;
            if (brushSizeInput.step) sizeEl.step = brushSizeInput.step;
        }
    }
    function syncMenuFromState() {
        syncRangeLimitsFromMainUI();
        const v = Math.round(Number(brushSize) || 1);
        sizeEl.value = String(v);
        sizeVal.textContent = String(v);
        aaEl.checked = !!antiAlias;
        pSizeEl.checked = !!usePressureSize;
        pOpEl.checked = !!usePressureOpacity;
    }
    function syncMainUIFromState() {
        const brushSizeInput = $("brushSize") || $("brushSizeRange");
        const brushSizeNumInput = $("brushSizeNum");
        const brushVal = $("brushVal");
        const aaToggle = $("aaToggle");

        if (typeof brushSizeInput !== "undefined" && brushSizeInput) brushSizeInput.value = String(Math.round(Number(brushSize) || 1));
        if (typeof brushSizeNumInput !== "undefined" && brushSizeNumInput) brushSizeNumInput.value = String(Math.round(Number(brushSize) || 1));
        if (typeof brushVal !== "undefined" && brushVal) brushVal.textContent = String(Math.round(Number(brushSize) || 1));
        if (typeof aaToggle !== "undefined" && aaToggle && "checked" in aaToggle) aaToggle.checked = !!antiAlias;
        const ps = $("pressureSize") || $("usePressureSize");
        const po = $("pressureOpacity") || $("usePressureOpacity");
        if (ps && "checked" in ps) ps.checked = !!usePressureSize;
        if (po && "checked" in po) po.checked = !!usePressureOpacity;
    }
    function applyBrushSizeFromMenu() {
        const v = Math.round(Number(sizeEl.value) || 1);
        brushSize = clamp(v, 1, 999);
        sizeVal.textContent = String(brushSize);
        syncMainUIFromState();
    }
    sizeEl.addEventListener("input", applyBrushSizeFromMenu);
    sizeEl.addEventListener("change", applyBrushSizeFromMenu);
    aaEl.addEventListener("change", () => {
        antiAlias = !!aaEl.checked;
        syncMainUIFromState();
        try {
            renderAll?.();
        } catch {}
    });
    pSizeEl.addEventListener("change", () => {
        usePressureSize = !!pSizeEl.checked;
        syncMainUIFromState();
    });
    pOpEl.addEventListener("change", () => {
        usePressureOpacity = !!pOpEl.checked;
        syncMainUIFromState();
    });
    resetBtn.addEventListener("click", e => {
        e.preventDefault();
        e.stopPropagation();
        brushSize = 3;
        antiAlias = false;
        usePressureSize = true;
        usePressureOpacity = false;
        syncMenuFromState();
        syncMainUIFromState();
        try {
            renderAll?.();
        } catch {}
    });
    document.addEventListener("mousedown", e => {
        if (m.hidden) return;
        if (e.target === m || m.contains(e.target)) return;
        closeBrushCtxMenu();
    }, true);
    document.addEventListener("keydown", e => {
        if (m.hidden) return;
        if (e.key === "Escape") closeBrushCtxMenu();
    });
    window.addEventListener("blur", () => closeBrushCtxMenu());
    document.body.appendChild(m);
    m._syncFromState = syncMenuFromState;
    _brushCtxMenu = m;
    return m;
}
function openBrushCtxMenu(ev, anchorEl) {
    try {
        closeEraserCtxMenu?.();
    } catch {}
    const m = ensureBrushCtxMenu();
    _brushCtxState = {
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
        m.querySelector("#bcmSize")?.focus({
            preventScroll: true
        });
    } catch {}
}
function closeBrushCtxMenu() {
    if (_brushCtxMenu) _brushCtxMenu.hidden = true;
    _brushCtxState = null;
}