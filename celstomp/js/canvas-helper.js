

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

function resizeCanvases() {
  const stageEl = $("stage");

  dpr = window.devicePixelRatio || 1;
  const cw = stageEl.clientWidth || stageEl.getBoundingClientRect().width || window.innerWidth;
  const ch = stageEl.clientHeight || stageEl.getBoundingClientRect().height || window.innerHeight;
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
        
  // mid
  const drawCanvas = $("drawCanvas");

  // front
  const fxCanvas = $("fxCanvas");


  for (const c of [ boundsCanvas, drawCanvas, fxCanvas ]) {
      c.style.width = cw + "px";
      c.style.height = ch + "px";
      c.width = Math.max(1, Math.floor(cw * dpr));
      c.height = Math.max(1, Math.floor(ch * dpr));
  }
  queueRenderAll();
  queueClearFx();
  initBrushCursorPreview(drawCanvas);
}

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

function fxTransform() {
  let dpr = window.devicePixelRatio || 1;
  const fxctx = getCanvas(CANVAS_TYPE.fxCanvas).getContext("2d");
  fxctx.setTransform(getZoom() * dpr, 0, 0, getZoom() * dpr, getOffsetX(), getOffsetY());
}

function setTransform(ctx) {
  let dpr = window.devicePixelRatio || 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.setTransform(getZoom() * dpr, 0, 0, getZoom() * dpr, getOffsetX(), getOffsetY());
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
function resetCenter() {
  setZoom(1);
  centerView();
}