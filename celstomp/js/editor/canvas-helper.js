

function _getCanvasPointer(e) {
  const drawCanvas = $("drawCanvas");
  const rect = drawCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  return {
      x: x,
      y: y
  };
}

function _screenToContent(sx, sy) {
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

function _resizeCanvases() {
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

function _fxStamp1px(x0, y0, x1, y1) {
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

function _fxTransform() {
  let dpr = window.devicePixelRatio || 1;
  const fxctx = getCanvas(CANVAS_TYPE.fxCanvas).getContext("2d");
  fxctx.setTransform(getZoom() * dpr, 0, 0, getZoom() * dpr, getOffsetX(), getOffsetY());
}

function _setTransform(ctx) {
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

function isCanvasDebugEnabled() {
  try {
      return window.__CELSTOMP_DEBUG_CANVAS === true || localStorage.getItem("celstomp_debug_canvas") === "1";
  } catch {
      return window.__CELSTOMP_DEBUG_CANVAS === true;
  }
}

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
function _resetCenter() {
  setZoom(1);
  centerView();
}
