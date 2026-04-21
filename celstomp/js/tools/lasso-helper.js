let lassoActive = false;
let lassoPts = [];
const lassoMinDist = 2.5;
let _lassoPreviewScheduled = false;
let _lassoLastPreviewMode = "fill";

/** Adds a point to the lasso path if it is far enough from the last point (minimum distance threshold). */
function addLassoPoint(pt) {
    const last = lassoPts[lassoPts.length - 1];
    if (!last || Math.hypot(pt.x - last.x, pt.y - last.y) >= lassoMinDist) {
        lassoPts.push(pt);
    }
}
/** Schedules a single requestAnimationFrame callback to draw the lasso preview, deduplicating rapid calls. */
function scheduleLassoPreview(mode = "fill") {
    _lassoLastPreviewMode = mode;
    if (_lassoPreviewScheduled) return;
    _lassoPreviewScheduled = true;
    requestAnimationFrame(() => {
        _lassoPreviewScheduled = false;
        drawLassoPreviewImmediate(_lassoLastPreviewMode);
    });
}
/** Schedules a lasso preview render via requestAnimationFrame. Delegates to scheduleLassoPreview. */
function drawLassoPreview(mode = "fill") {
    scheduleLassoPreview(mode);
}
/** Renders the lasso selection preview on the FX canvas with optional fill and colored outline. */
function drawLassoPreviewImmediate(mode = "fill") {
    const fxctx = getCanvas(CANVAS_TYPE.fxCanvas).getContext("2d");
    queueClearFx();
    if (lassoPts.length < 2) return;
    const isErase = mode === "erase";
    fxTransform();
    fxctx.save();
    if (!isErase) {
        fxctx.globalAlpha = .18;
        fxctx.fillStyle = currentColor;
        fxctx.beginPath();
        fxctx.moveTo(lassoPts[0].x, lassoPts[0].y);
        for (let i = 1; i < lassoPts.length; i++) fxctx.lineTo(lassoPts[i].x, lassoPts[i].y);
        fxctx.closePath();
        fxctx.fill();
    }
    fxctx.globalAlpha = 1;
    fxctx.lineWidth = Math.max(1 / (getZoom() * dpr), .6);
    fxctx.strokeStyle = isErase ? "rgba(255,90,90,0.95)" : "rgba(255,255,255,0.95)";
    fxctx.beginPath();
    fxctx.moveTo(lassoPts[0].x, lassoPts[0].y);
    for (let i = 1; i < lassoPts.length; i++) fxctx.lineTo(lassoPts[i].x, lassoPts[i].y);
    fxctx.stroke();
    fxctx.restore();
}

let _lassoMaskC = null;
let _lassoColorC = null;
/** Creates or resizes a temporary canvas to the given dimensions and clears it. */
function ensureTmpCanvas(c, w, h) {
    if (!c) c = document.createElement("canvas");
    if (c.width !== w) c.width = w;
    if (c.height !== h) c.height = h;
    const ctx = c.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return [ c, ctx ];
}
/** Fills the lasso-selected region with the current color on the active layer/frame. Handles anti-aliased and aliased modes. */
function applyLassoFill() {
    const hex = colorToHex(currentColor);
    pushUndo(activeLayer, currentFrame, hex);
    activeSubColor[activeLayer] = hex;
    ensureSublayer(activeLayer, hex);
    if (lassoPts.length < 3) return false;
    const off = getFrameCanvas(activeLayer, currentFrame, hex);
    const w = off.width, h = off.height;
    const aaOn = getBrushAntiAliasEnabled();
    if (aaOn) {
        const ctx = off.getContext("2d");
        ctx.save();
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = currentColor;
        ctx.beginPath();
        ctx.moveTo(lassoPts[0].x, lassoPts[0].y);
        for (let i = 1; i < lassoPts.length; i++) ctx.lineTo(lassoPts[i].x, lassoPts[i].y);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        markFrameHasContent(activeLayer, currentFrame, strokeHex || hex);
        queueRenderAll();
        updateTimelineHasContent(currentFrame);
        return true;
    }
    let mctx, cctx;
    [_lassoMaskC, mctx] = ensureTmpCanvas(_lassoMaskC, w, h);
    [_lassoColorC, cctx] = ensureTmpCanvas(_lassoColorC, w, h);
    mctx.save();
    mctx.fillStyle = "#fff";
    mctx.beginPath();
    mctx.moveTo(lassoPts[0].x, lassoPts[0].y);
    for (let i = 1; i < lassoPts.length; i++) mctx.lineTo(lassoPts[i].x, lassoPts[i].y);
    mctx.closePath();
    mctx.fill();
    mctx.restore();
    const img = mctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
        const a = d[i + 3];
        d[i + 3] = a >= 128 ? 255 : 0;
        d[i] = 255;
        d[i + 1] = 255;
        d[i + 2] = 255;
    }
    mctx.putImageData(img, 0, 0);
    cctx.save();
    cctx.fillStyle = currentColor;
    cctx.fillRect(0, 0, w, h);
    cctx.globalCompositeOperation = "destination-in";
    cctx.drawImage(_lassoMaskC, 0, 0);
    cctx.restore();
    const ctx = off.getContext("2d");
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(_lassoColorC, 0, 0);
    ctx.restore();
    markFrameHasContent(activeLayer, currentFrame, strokeHex || hex);
    queueRenderAll();
    updateTimelineHasContent(currentFrame);
    return true;
}
/** Erases the lasso-selected region from the active sublayer using destination-out compositing. */
function applyLassoErase() {
    if (activeLayer === PAPER_LAYER) return false;
    if (lassoPts.length < 3) return false;
    const L = activeLayer;
    const key = resolveKeyFor(L, activeSubColor?.[L] ?? currentColor);
    if (!key) return false;
    const layer = layers?.[L];
    if (!layer?.sublayers) return false;
    if (!layer.sublayers.has(key)) return false;
    const off = getFrameCanvas(L, currentFrame, key);
    if (!off) return false;
    try {
        pushUndo(L, currentFrame, key);
    } catch {}
    const ctx = off.getContext("2d", {
        willReadFrequently: true
    });
    if (!ctx) return false;
    const w = off.width | 0, h = off.height | 0;
    const aaOn = getBrushAntiAliasEnabled();
    let mctx;
    [_lassoMaskC, mctx] = ensureTmpCanvas(_lassoMaskC, w, h);
    mctx.save();
    mctx.fillStyle = "#fff";
    mctx.beginPath();
    mctx.moveTo(lassoPts[0].x, lassoPts[0].y);
    for (let i = 1; i < lassoPts.length; i++) mctx.lineTo(lassoPts[i].x, lassoPts[i].y);
    mctx.closePath();
    mctx.fill();
    mctx.restore();

    if (!aaOn) {
        const img = mctx.getImageData(0, 0, w, h);
        const d = img.data;
        for (let i = 0; i < d.length; i += 4) {
            const a = d[i + 3];
            d[i + 3] = a >= 128 ? 255 : 0;
            d[i] = 255;
            d[i + 1] = 255;
            d[i + 2] = 255;
        }
        mctx.putImageData(img, 0, 0);
    }

    if (typeof removeTextEntriesIntersectingMask === "function") {
        removeTextEntriesIntersectingMask(L, currentFrame, key, _lassoMaskC);
    }

    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.drawImage(_lassoMaskC, 0, 0);
    ctx.restore();

    recomputeHasContent(L, currentFrame, key);
    queueRenderAll();
    updateTimelineHasContent(currentFrame);
    pruneUnusedSublayers(L);
    return true;
}

/** Scans the frame canvas pixel data to determine if any non-transparent pixels exist, updating _hasContent. */
function recomputeHasContent(L, F, key) {
  try {
      const k = resolveKeyFor(L, key);
      if (!k) return false;
      const c = getFrameCanvas(L, F, k);
      const ctx = c.getContext("2d", {
          willReadFrequently: true
      });
      const data = ctx.getImageData(0, 0, contentW, contentH).data;
      let any = false;
      for (let i = 3; i < data.length; i += 4) {
          if (data[i] > 0) {
              any = true;
              break;
          }
      }
      c._hasContent = any;
      return any;
  } catch {
      return true;
  }
}

/** Cancels the active lasso selection, clearing points and the FX preview. */
function cancelLasso() {
    lassoActive = false;
    lassoPts = [];
    queueClearFx();
}
