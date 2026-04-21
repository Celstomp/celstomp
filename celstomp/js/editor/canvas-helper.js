

/**
 * Returns the pointer position relative to the draw canvas element.
 * @param {PointerEvent} e - Pointer event.
 * @returns {{x: number, y: number}} Position in CSS pixels relative to the canvas.
 */
function getCanvasPointer(e) {
  const drawCanvas = $("drawCanvas");
  const rect = drawCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  return {
      x: x,
      y: y
  };
}

/**
 * Converts screen-space CSS pixel coordinates to content-space coordinates, accounting for zoom, pan, and DPR.
 * @param {number} sx - Screen X in CSS pixels.
 * @param {number} sy - Screen Y in CSS pixels.
 * @returns {{x: number, y: number}} Content-space coordinates.
 */
function screenToContent(sx, sy) {
  const dpr = window.devicePixelRatio || 1;
  const devX = sx * dpr;
  const devY = sy * dpr;
  const cx = (devX - getOffsetX()) / (getZoom() * dpr);
  const cy = (devY - getOffsetY()) / (getZoom() * dpr);
  return {
      x: cx,
      y: cy
  };
}

/**
 * Resizes all three main canvases (bounds, draw, fx) to match the current stage dimensions and DPR.
 * Re-renders all layers after resizing.
 */
function resizeCanvases() {
  const stageEl = $("stage");

  dpr = window.devicePixelRatio || 1;
  const drawCanvas = $("drawCanvas");
  const host = drawCanvas?.parentElement || stageEl;
  const cssRect = drawCanvas?.getBoundingClientRect?.() || host?.getBoundingClientRect?.();
  const cw = cssRect?.width || host?.clientWidth || stageEl.clientWidth || window.innerWidth;
  const ch = cssRect?.height || host?.clientHeight || stageEl.clientHeight || window.innerHeight;
  if (cw < 10 || ch < 10) {
      console.warn("[celstomp] stage has no size yet:", {
          cw: cw,
          ch: ch,
          stage: stageEl
      });
      requestAnimationFrame(resizeCanvases);
      return;
  }

  // back
  const boundsCanvas = $("boundsCanvas");

  // front
  const fxCanvas = $("fxCanvas");


  for (const c of [ boundsCanvas, drawCanvas, fxCanvas ]) {
      c.width = Math.max(1, Math.round(cw * dpr));
      c.height = Math.max(1, Math.round(ch * dpr));
  }
  debugCheckCanvasSizing("resizeCanvases");
  queueRenderAll();
  queueClearFx();
  initBrushCursorPreview(drawCanvas);
}

/**
 * Draws a 1px trail line on the FX canvas between two points (brush cursor feedback).
 * @param {number} x0 - Start X in content space.
 * @param {number} y0 - Start Y in content space.
 * @param {number} x1 - End X in content space.
 * @param {number} y1 - End Y in content space.
 */
function fxStamp1px(x0, y0, x1, y1) {
  const s = 1;
  const dx = x1 - x0, dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const step = .5;
  const n = Math.max(1, Math.ceil(dist / step));
  const nx = dx / n, ny = dy / n;

  // dont like doing this here
  const fxctx = getCanvas(CANVAS_TYPE.fxCanvas).getContext("2d");

  fxctx.save();
  fxctx.globalCompositeOperation = "source-over";
  fxctx.globalAlpha = 1;
  fxctx.fillStyle = fillBrushTrailColor;
  for (let i = 0; i <= n; i++) {
      const px = Math.round(x0 + nx * i - s / 2);
      const py = Math.round(y0 + ny * i - s / 2);
      fxctx.fillRect(px, py, s, s);
  }
  fxctx.restore();
}

/** Applies the current zoom/pan transform to the FX canvas context. */
function fxTransform() {
  let dpr = window.devicePixelRatio || 1;
  const fxctx = getCanvas(CANVAS_TYPE.fxCanvas).getContext("2d");
  fxctx.setTransform(getZoom() * dpr, 0, 0, getZoom() * dpr, getOffsetX(), getOffsetY());
}

/**
 * Resets and applies the zoom/pan transform to a 2D canvas context, then clears and re-applies it.
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context to transform.
 */
function setTransform(ctx) {
  let dpr = window.devicePixelRatio || 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  const z = getZoom() * dpr;
  ctx.setTransform(z, 0, 0, z, getOffsetX(), getOffsetY());
  if (isCanvasDebugEnabled()) {
      const t = ctx.getTransform();
      const ok = Math.abs(t.a - z) < 1e-6 && Math.abs(t.d - z) < 1e-6 && Math.abs(t.b) < 1e-6 && Math.abs(t.c) < 1e-6;
      if (!ok) {
          console.warn("[celstomp] unexpected canvas transform", {
              canvasId: ctx.canvas?.id,
              expectedScale: z,
              expectedOffsetX: getOffsetX(),
              expectedOffsetY: getOffsetY(),
              actual: {
                  a: t.a,
                  b: t.b,
                  c: t.c,
                  d: t.d,
                  e: t.e,
                  f: t.f
              }
          });
      }
  }
}

/** Checks whether canvas debug logging is enabled via global flag or localStorage. @returns {boolean} */
function isCanvasDebugEnabled() {
  try {
      return window.__CELSTOMP_DEBUG_CANVAS === true || localStorage.getItem("celstomp_debug_canvas") === "1";
  } catch {
      return window.__CELSTOMP_DEBUG_CANVAS === true;
  }
}

/**
 * Validates canvas backing store sizes against their CSS layout sizes; logs warnings if mismatched (debug only).
 * @param {string} [from=""] - Label for the calling site in log messages.
 */
function debugCheckCanvasSizing(from = "") {
  if (!isCanvasDebugEnabled()) return;
  const canvases = [ $("boundsCanvas"), $("drawCanvas"), $("fxCanvas") ];
  const curDpr = window.devicePixelRatio || 1;
  for (const c of canvases) {
      if (!(c instanceof HTMLCanvasElement)) continue;
      const r = c.getBoundingClientRect();
      const wantW = Math.max(1, Math.round(r.width * curDpr));
      const wantH = Math.max(1, Math.round(r.height * curDpr));
      if ((c.width | 0) !== wantW || (c.height | 0) !== wantH) {
          console.warn("[celstomp] canvas backing store mismatch", {
              from: from,
              id: c.id,
              cssWidth: r.width,
              cssHeight: r.height,
              dpr: curDpr,
              actualWidth: c.width,
              actualHeight: c.height,
              expectedWidth: wantW,
              expectedHeight: wantH
          });
      }
  }
}

/** Centers the viewport on the content area at the current zoom level. */
function centerView() {
  let dpr = window.devicePixelRatio || 1;
  const drawCanvas = getCanvas(CANVAS_TYPE.drawCanvas);
  const cw = drawCanvas.width;
  const ch = drawCanvas.height;
  setOffsetX((cw - contentW * getZoom() * dpr) / 2);
  setOffsetY((ch - contentH * getZoom() * dpr) / 2);
  queueUpdateHud();
  queueRenderAll();
  updatePlayheadMarker();
  updateClipMarkers();
}
/** Resets zoom to 1× and centers the viewport. */
function resetCenter() {
  setZoom(1);
  centerView();
}
