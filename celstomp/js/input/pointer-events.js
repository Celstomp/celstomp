window.__celstompPinching = true;

const pressureCache = new Map;
const tiltCache = new Map;
const activePointers = new Map;

let usePressureSize = true;
let usePressureOpacity = false;
let usePressureTilt = false;

let brushSize = 3;
let autofill = false;

let trailPoints = [];
let lineToolStart = null;
let lineToolPreview = null;
let rectToolStart = null;
let rectToolPreview = null;
let gridEnabled = false;
let gridSize = 32;
let gridSnap = false;
let rulersEnabled = false;
let guides = [];
let draggingGuide = null;
let guideSnap = false;

let textEntryOverlay = null;
let textEntryInput = null;
let textEntryTarget = null;
let textEntryFamily = null;
let textEntrySize = null;
let textEntryWeight = null;
let textEntryItalic = null;
let textEntryAlign = null;
let textEntryStroke = null;
let textEntryStrokeWidth = null;
let textEntries = [];

let textToolOptions = {
    family: "system-ui, sans-serif",
    size: 22,
    weight: "400",
    italic: false,
    align: "left",
    stroke: false,
    strokeWidth: 2
};

function normalizeTextOptions(opts) {
    return {
        family: opts?.family || "system-ui, sans-serif",
        size: Math.max(8, Math.min(240, parseInt(opts?.size ?? 22, 10) || 22)),
        weight: String(opts?.weight || "400"),
        italic: !!opts?.italic,
        align: opts?.align || "left",
        stroke: !!opts?.stroke,
        strokeWidth: Math.max(1, Math.min(20, parseInt(opts?.strokeWidth ?? 2, 10) || 2))
    };
}

function buildTextFont(opts) {
    return `${opts.italic ? "italic " : ""}${opts.weight} ${opts.size}px ${opts.family}`;
}

function applyTextStyle(ctx, opts, hex) {
    ctx.fillStyle = hex;
    ctx.textBaseline = "top";
    ctx.textAlign = opts.align;
    ctx.font = buildTextFont(opts);
}

function measureTextBounds(ctx, x, y, text, opts) {
    const metrics = ctx.measureText(text || " ");
    const textW = Math.max(1, Math.ceil(metrics.width || 1));
    const textH = Math.max(1, Math.ceil((metrics.actualBoundingBoxAscent || opts.size * 0.8) + (metrics.actualBoundingBoxDescent || opts.size * 0.25)));
    let left = x;
    if (opts.align === "center") left = x - textW / 2;
    if (opts.align === "right") left = x - textW;
    const pad = opts.stroke ? opts.strokeWidth + 2 : 2;
    const x0 = Math.max(0, Math.floor(left - pad));
    const y0 = Math.max(0, Math.floor(y - pad));
    const x1 = Math.min(contentW, Math.ceil(left + textW + pad));
    const y1 = Math.min(contentH, Math.ceil(y + textH + pad));
    return {
        x: x0,
        y: y0,
        w: Math.max(1, x1 - x0),
        h: Math.max(1, y1 - y0)
    };
}

function captureTextAreaSnapshot(ctx, bounds) {
    try {
        return ctx.getImageData(bounds.x, bounds.y, bounds.w, bounds.h);
    } catch {
        return null;
    }
}

function findTextEntryAtPoint(x, y, layer, frame) {
    for (let i = textEntries.length - 1; i >= 0; i--) {
        const entry = textEntries[i];
        if (entry.layer !== layer || entry.frame !== frame) continue;
        const inX = x >= entry.bounds.x && x <= entry.bounds.x + entry.bounds.w;
        const inY = y >= entry.bounds.y && y <= entry.bounds.y + entry.bounds.h;
        if (inX && inY) return entry;
    }
    return null;
}

function ensureTextEntryOverlay() {
    if (textEntryOverlay && textEntryInput) return;
    textEntryOverlay = document.createElement("div");
    textEntryOverlay.id = "canvasTextEntry";
    textEntryOverlay.className = "canvasTextEntry";
    textEntryOverlay.innerHTML = '<div class="canvasTextEntryCard"><label class="canvasTextEntryLabel" for="canvasTextEntryInput">Text</label><input id="canvasTextEntryInput" class="canvasTextEntryInput" type="text" maxlength="120" autocomplete="off" /><div class="canvasTextEntryOptions"><label class="canvasTextEntryOpt"><span>Font</span><select id="canvasTextEntryFamily" class="canvasTextEntrySelect"><option value="system-ui, sans-serif">System</option><option value="Arial, sans-serif">Arial</option><option value="Verdana, sans-serif">Verdana</option><option value="Georgia, serif">Georgia</option><option value="\"Trebuchet MS\", sans-serif">Trebuchet</option><option value="\"Courier New\", monospace">Courier</option></select></label><label class="canvasTextEntryOpt"><span>Size</span><input id="canvasTextEntrySize" class="canvasTextEntryNum" type="number" min="8" max="240" step="1" /></label><label class="canvasTextEntryOpt"><span>Weight</span><select id="canvasTextEntryWeight" class="canvasTextEntrySelect"><option value="300">Light</option><option value="400">Regular</option><option value="500">Medium</option><option value="700">Bold</option><option value="900">Black</option></select></label><label class="canvasTextEntryOpt"><span>Align</span><select id="canvasTextEntryAlign" class="canvasTextEntrySelect"><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label><label class="canvasTextEntryOpt canvasTextEntryOptCheck"><input id="canvasTextEntryItalic" type="checkbox" /><span>Italic</span></label><label class="canvasTextEntryOpt canvasTextEntryOptCheck"><input id="canvasTextEntryStroke" type="checkbox" /><span>Stroke</span></label><label class="canvasTextEntryOpt"><span>Stroke Width</span><input id="canvasTextEntryStrokeWidth" class="canvasTextEntryNum" type="number" min="1" max="20" step="1" /></label></div><div class="canvasTextEntryActions"><button type="button" id="canvasTextEntryCancel" class="canvasTextEntryBtn">Cancel</button><button type="button" id="canvasTextEntryOk" class="canvasTextEntryBtn canvasTextEntryBtnPrimary">Place</button></div></div>';
    document.body.appendChild(textEntryOverlay);
    textEntryInput = textEntryOverlay.querySelector("#canvasTextEntryInput");
    textEntryFamily = textEntryOverlay.querySelector("#canvasTextEntryFamily");
    textEntrySize = textEntryOverlay.querySelector("#canvasTextEntrySize");
    textEntryWeight = textEntryOverlay.querySelector("#canvasTextEntryWeight");
    textEntryItalic = textEntryOverlay.querySelector("#canvasTextEntryItalic");
    textEntryAlign = textEntryOverlay.querySelector("#canvasTextEntryAlign");
    textEntryStroke = textEntryOverlay.querySelector("#canvasTextEntryStroke");
    textEntryStrokeWidth = textEntryOverlay.querySelector("#canvasTextEntryStrokeWidth");
    const cancelBtn = textEntryOverlay.querySelector("#canvasTextEntryCancel");
    const okBtn = textEntryOverlay.querySelector("#canvasTextEntryOk");
    cancelBtn?.addEventListener("click", () => closeTextEntryOverlay());
    okBtn?.addEventListener("click", () => commitTextEntryOverlay());
    textEntryInput?.addEventListener("keydown", e => {
        if (e.key === "Enter") {
            e.preventDefault();
            commitTextEntryOverlay();
        }
        if (e.key === "Escape") {
            e.preventDefault();
            closeTextEntryOverlay();
        }
    });
}

function openTextEntryOverlay(target) {
    ensureTextEntryOverlay();
    textEntryTarget = target;
    textEntryOverlay.classList.add("open");
    document.body.classList.add("canvasTextEntryMode");
    const opts = normalizeTextOptions(target?.initialOptions || textToolOptions);
    textEntryInput.value = target?.initialText || "";
    if (textEntryFamily) textEntryFamily.value = opts.family;
    if (textEntrySize) textEntrySize.value = String(opts.size);
    if (textEntryWeight) textEntryWeight.value = opts.weight;
    if (textEntryItalic) textEntryItalic.checked = !!opts.italic;
    if (textEntryAlign) textEntryAlign.value = opts.align;
    if (textEntryStroke) textEntryStroke.checked = !!opts.stroke;
    if (textEntryStrokeWidth) textEntryStrokeWidth.value = String(opts.strokeWidth);
    queueMicrotask(() => textEntryInput?.focus());
}

function closeTextEntryOverlay() {
    if (!textEntryOverlay) return;
    textEntryOverlay.classList.remove("open");
    document.body.classList.remove("canvasTextEntryMode");
    textEntryTarget = null;
}

function commitTextEntryOverlay() {
    const text = (textEntryInput?.value || "").trim();
    if (!text || !textEntryTarget) {
        closeTextEntryOverlay();
        return;
    }
    const t = textEntryTarget;
    const off = getFrameCanvas(t.layer, t.frame, t.hex);
    const ctx = off?.getContext("2d");
    if (!ctx) {
        closeTextEntryOverlay();
        return;
    }
    const opts = normalizeTextOptions({
        family: textEntryFamily?.value || textToolOptions.family,
        size: textEntrySize?.value,
        weight: textEntryWeight?.value || textToolOptions.weight,
        italic: !!textEntryItalic?.checked,
        align: textEntryAlign?.value || textToolOptions.align,
        stroke: !!textEntryStroke?.checked,
        strokeWidth: textEntryStrokeWidth?.value
    });

    textToolOptions = { ...opts };

    ctx.save();
    applyTextStyle(ctx, opts, t.hex);
    const bounds = measureTextBounds(ctx, t.x, t.y, text, opts);
    ctx.restore();

    beginGlobalHistoryStep(t.layer, t.frame, t.hex);
    if (t.editEntry && t.editEntry.snapshot) {
        try {
            ctx.putImageData(t.editEntry.snapshot, t.editEntry.bounds.x, t.editEntry.bounds.y);
        } catch {}
    }

    const snapshot = captureTextAreaSnapshot(ctx, bounds);

    ctx.save();
    applyTextStyle(ctx, opts, t.hex);
    if (opts.stroke) {
        ctx.lineWidth = opts.strokeWidth;
        ctx.strokeStyle = "rgba(0,0,0,0.78)";
        ctx.strokeText(text, t.x, t.y);
    }
    ctx.fillText(text, t.x, t.y);
    ctx.restore();

    if (t.editEntry) {
        t.editEntry.text = text;
        t.editEntry.hex = t.hex;
        t.editEntry.options = { ...opts };
        t.editEntry.bounds = bounds;
        t.editEntry.snapshot = snapshot;
    } else {
        textEntries.push({
            layer: t.layer,
            frame: t.frame,
            text,
            x: t.x,
            y: t.y,
            hex: t.hex,
            options: { ...opts },
            bounds,
            snapshot
        });
    }
    markGlobalHistoryDirty();
    commitGlobalHistoryStep();
    markFrameHasContent(t.layer, t.frame, t.hex);
    queueRenderAll();
    updateTimelineHasContent(t.frame);
    closeTextEntryOverlay();
}

function pressure(e) {
    const pid = Number.isFinite(e?.pointerId) ? e.pointerId : -1;
    const isPen = e?.pointerType === "pen";
    const raw = typeof e?.pressure === "number" && e.pressure > 0 ? e.pressure : isPen ? .35 : 1;
    const prev = pressureCache.has(pid) ? pressureCache.get(pid) : raw;
    const smoothed = prev + (raw - prev) * pressureSmooth;
    const out = Math.max(PRESSURE_MIN, Math.min(1, smoothed));
    pressureCache.set(pid, out);
    return out;
}
function tiltAmount(e) {
    const pid = Number.isFinite(e?.pointerId) ? e.pointerId : -1;
    if (e?.pointerType !== "pen") {
        tiltCache.set(pid, 0);
        return 0;
    }
    const tx = Number.isFinite(e?.tiltX) ? e.tiltX : 0;
    const ty = Number.isFinite(e?.tiltY) ? e.tiltY : 0;
    const raw = Math.max(0, Math.min(1, Math.hypot(tx, ty) / 90));
    const prev = tiltCache.has(pid) ? tiltCache.get(pid) : raw;
    const smoothed = prev + (raw - prev) * .35;
    const out = Math.max(0, Math.min(1, smoothed));
    tiltCache.set(pid, out);
    return out;
}

function handlePointerDown(e) {
  if (e.pointerType === "touch" && window.__celstompPinching) return;
  if ((e.ctrlKey || e.metaKey) && e.pointerType !== "touch") {
      if (beginCtrlMove(e)) {
          e.preventDefault();
          return;
      }
  }
  
  // Handle guide placement mode
  const guideMode = document.body.classList.contains("guide-place-mode");
  if (guideMode && e.button === 0) {
      const pos = getCanvasPointer(e);
      const pt = screenToContent(pos.x, pos.y);
      if (pt.x >= 0 && pt.x <= contentW && pt.y >= 0 && pt.y <= contentH) {
          if (document.body.classList.contains("guide-place-h")) {
              guides.push({ horizontal: true, pos: pt.y });
          } else if (document.body.classList.contains("guide-place-v")) {
              guides.push({ horizontal: false, pos: pt.x });
          }
          queueRenderAll();
          if (window.__celstompSetGuidePlacementMode) {
              window.__celstompSetGuidePlacementMode(null);
          }
          e.preventDefault();
          return;
      }
  }
  
  try {
      drawCanvas.setPointerCapture(e.pointerId);
  } catch {}
  activePointers.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY,
      type: e.pointerType
  });
  if (e.pointerType === "pen") {
      startStroke(e);
      return;
  }
  if (e.pointerType === "touch") {
      if (window.__celstompPinching) {
          e.preventDefault();
          return;
      }
      if (tool === "hand") startPan(e); else startStroke(e);
      e.preventDefault();
      return;
  }
  if (e.button === 2 || tool === "hand") startPan(e); else startStroke(e);
}

function handlePointerMove(e) {
  if (e.pointerType === "touch") e.preventDefault();
  if (e.pointerType === "touch" && window.__celstompPinching) return;
  if (e.pointerType === "touch") {
      if (window.__celstompPinching && activePointers.size < 2) {
          window.__celstompPinching = false;
      }
  }
  if (e.pointerType === "touch" && window.__celstompPinching) return;
  if (_ctrlMove.active && e.pointerId === _ctrlMove.pointerId) {
      updateCtrlMove(e);
      e.preventDefault();
      return;
  }
  if (isPanning) {
      continuePan(e);
      return;
  }
  if (isDrawing) {
      continueStroke(e);
      return;
  }
}

function handlePointerUp(e) {
  if (e.pointerType === "touch") e.preventDefault();
  if (_ctrlMove.active && e.pointerId === _ctrlMove.pointerId) {
      endCtrlMove(e);
      e.preventDefault();
      return;
  }
  try {
      drawCanvas.releasePointerCapture(e.pointerId);
  } catch {}
  pressureCache.delete(e.pointerId);
  tiltCache.delete(e.pointerId);
  activePointers.delete(e.pointerId);
  if (activePointers.size < 2) window.__celstompPinching = false;
  if (isDrawing) endStroke();
  if (isPanning) endPan();
}

// pen config
const PRESSURE_MIN = .05;
let penDetected = false;
let stabilizationLevel = 5;
let pressureSmooth = .45;
let strokeSmooth = .6;



function pressureSmoothFromLevel(level) {
    const lv = Math.max(0, Math.min(10, Number(level) || 0));
    return Math.max(.2, Math.min(1, 1 - lv * .08));
}
function strokeSmoothFromLevel(level) {
    const lv = Math.max(0, Math.min(10, Number(level) || 0));
    return Math.max(.2, Math.min(1, 1 - lv * .08));
}

function notePenDetected(e) {
  if (!e || e.pointerType !== "pen") return;
  if (penDetected) return;
  penDetected = true;
  setPenControlsVisible(true);
}

function setPenControlsVisible(visible) {
    if (!$("penControls")) return;
    $("penControls").hidden = !visible;
}

function shouldStabilizeTool(name) {
  return name === "brush" || name === "eraser" || name === "fill-brush" || name === "fill-eraser";
}
function stabilizePoint(e, x, y) {
  if (!shouldStabilizeTool(tool)) return {
      x: x,
      y: y
  };
  const pt = {
      x: x,
      y: y
  };
  if (!stabilizedPt) {
      stabilizedPt = pt;
      return pt;
  }
  stabilizedPt = {
      x: stabilizedPt.x + (pt.x - stabilizedPt.x) * strokeSmooth,
      y: stabilizedPt.y + (pt.y - stabilizedPt.y) * strokeSmooth
  };
  return stabilizedPt;
}

// stroke events

let lastPt = null;
let stabilizedPt = null;
let strokeHex = null;
let _fillEraseAllLayers = false;

function drawExactCel(ctx, idx) {
    for (const L of mainLayerOrder) {
        const layer = layers[L];
        if (!layer) continue;
        const op = layer.opacity ?? 1;
        if (op <= 0) continue;
        const blendOp = typeof layerBlendModeCanvasOperation === "function" ? layerBlendModeCanvasOperation(layer.blendMode) : "source-over";
        const srcCanvases = canvasesWithContentForMainLayerFrame(L, idx);
        if (!srcCanvases.length) continue;
        ctx.save();
        ctx.globalAlpha *= op;

        ctx.globalCompositeOperation = blendOp;
        for (const off of srcCanvases) {
            if ((off.width | 0) !== (contentW | 0) || (off.height | 0) !== (contentH | 0)) {
                ctx.drawImage(off, 0, 0, off.width, off.height, 0, 0, contentW, contentH);
            } else {
                ctx.drawImage(off, 0, 0);
            }
        }

        ctx.restore();
    }
}

function drawCompositeAt(ctx, F, withBg = true, holdPrevWhenEmpty = true, holdPrevAlpha = 1) {
    ctx.save();
    ctx.clearRect(0, 0, contentW, contentH);
    ctx.imageSmoothingEnabled = !!antiAlias;
    if (withBg) {
        ctx.fillStyle = canvasBgColor;
        ctx.fillRect(0, 0, contentW, contentH);
    }
    if (hasCel(F)) {
        drawExactCel(ctx, F);
    } else if (holdPrevWhenEmpty) {
        const prevIdx = nearestPrevCelIndex(F);
        if (prevIdx >= 0) {
            const a = Math.max(0, Math.min(1, Number(holdPrevAlpha ?? 1)));
            ctx.save();
            ctx.globalAlpha *= a;
            drawExactCel(ctx, prevIdx);
            ctx.restore();
        }
    }
    ctx.restore();
}

function getPixelHexAtContentPoint(cx, cy) {
    const x = Math.max(0, Math.min(contentW - 1, Math.round(cx)));
    const y = Math.max(0, Math.min(contentH - 1, Math.round(cy)));
    const tmp = document.createElement("canvas");
    tmp.width = contentW;
    tmp.height = contentH;
    const tctx = tmp.getContext("2d", {
        willReadFrequently: true
    });
    if (!tctx) return null;
    drawCompositeAt(tctx, currentFrame, true, true, transparencyHoldEnabled ? .25 : 1);
    let d;
    try {
        d = tctx.getImageData(x, y, 1, 1).data;
    } catch {
        return null;
    }
    return rgbToHex(d[0], d[1], d[2]);
}
function pickCanvasColorAtEvent(e) {
    const pos = getCanvasPointer(e);
    const pt = screenToContent(pos.x, pos.y);
    const picked = getPixelHexAtContentPoint(pt.x, pt.y);
    if (!picked) return;
    setCurrentColorHex(picked);
    addCurrentColorToPalette();
}

function startStroke(e) {
  const pos = getCanvasPointer(e);
  let {x: x, y: y} = screenToContent(pos.x, pos.y);
  notePenDetected(e);
  stabilizedPt = null;
  const startPt = stabilizePoint(e, x, y);
  x = startPt.x;
  y = startPt.y;
  if (gridSnap && gridEnabled) {
      const snapped = snapToGrid(x, y);
      x = snapped.x;
      y = snapped.y;
  }
  if (guideSnap) {
      const snapped = snapToGuides(x, y);
      x = snapped.x;
      y = snapped.y;
  }
  if (x < 0 || y < 0 || x > contentW || y > contentH) return;
  if (e.button === 2) {
      startPan(e);
      return;
  }
  if (tool === "eyedropper") {
      pickCanvasColorAtEvent(e);
      return;
  }
  if (tool === "rect-select") {
      isDrawing = true;
      beginRectSelect(e);
      return;
  }
  if (tool === "lasso-fill") {
      lassoActive = true;
      isDrawing = true;
      lassoPts = [];
      addLassoPoint({
          x: x,
          y: y
      });
      drawLassoPreview();
      return;
  }
  try {
      const k = tool === "eraser" ? resolveKeyFor(activeLayer, activeSubColor?.[activeLayer] ?? currentColor) : resolveKeyFor(activeLayer, currentColor);
      beginGlobalHistoryStep(activeLayer, currentFrame, k);
  } catch {}
  if (tool === "lasso-erase") {
      if (activeLayer === PAPER_LAYER) return;
      lassoActive = true;
      isDrawing = true;
      lassoPts = [];
      addLassoPoint({
          x: x,
          y: y
      });
      drawLassoPreview("erase");
      return;
  }
  if (tool === "fill-eraser" || tool === "fill-brush") {
      if (activeLayer === PAPER_LAYER) return;
      if (tool === "fill-eraser" && activeLayer !== LAYER.FILL) {
          if (Array.isArray(activeSubColor) && !activeSubColor[activeLayer]) {
              const lay = layers?.[activeLayer];
              const fallback = lay?.suborder?.slice().reverse().find(k => lay?.sublayers?.has?.(k)) || lay?.suborder?.[0] || null;
              if (fallback) activeSubColor[activeLayer] = fallback;
          }
      }
      let key = fillKeyForTool(activeLayer, tool);
      if (tool === "fill-brush" && key) key = swatchColorKey(key);
      if (tool === "fill-brush" && activeLayer === LAYER.FILL) {
          activeSubColor[LAYER.FILL] = key;
          ensureSublayer(LAYER.FILL, key);
          try {
              renderLayerSwatches(LAYER.FILL);
          } catch {}
      }
      if (tool === "fill-brush" && !key) return;
      if (tool === "fill-eraser") key = key || null;
      if (tool === "fill-brush") ensureActiveSwatchForColorLayer(activeLayer, key);
      if (tool === "fill-brush") pushUndo(activeLayer, currentFrame, key);
      isDrawing = true;
      if (tool === "fill-eraser") _fillEraseAllLayers = !!e.shiftKey;
      lastPt = {
          x: x,
          y: y
      };
      trailPoints = [ {
          x: x,
          y: y
      } ];
      fxTransform();
      fxStamp1px(x, y, x + .01, y + .01);
      return;
  }
  if (tool === "hand") {
      startPan(e);
      return;
  }
  if (tool === "line") {
      isDrawing = true;
      const hex = colorToHex(currentColor);
      strokeHex = activeLayer === LAYER.FILL ? fillWhite : hex;
      activeSubColor[activeLayer] = strokeHex;
      ensureSublayer(activeLayer, strokeHex);
      renderLayerSwatches(activeLayer);
      lineToolStart = { x, y };
      lineToolPreview = { x, y };
      return;
  }
  if (tool === "text") {
      const found = findTextEntryAtPoint(x, y, activeLayer, currentFrame);
      if (found) {
          openTextEntryOverlay({
              x: found.x,
              y: found.y,
              layer: found.layer,
              frame: found.frame,
              hex: found.hex,
              initialText: found.text,
              initialOptions: found.options,
              editEntry: found
          });
      } else {
          const hex = colorToHex(currentColor);
          openTextEntryOverlay({
              x,
              y,
              layer: activeLayer,
              frame: currentFrame,
              hex,
              initialOptions: {
                  ...textToolOptions,
                  size: Math.max(10, Math.round(brushSize * 4))
              }
          });
      }
      return;
  }
  if (tool === "rect") {
      isDrawing = true;
      const hex = colorToHex(currentColor);
      strokeHex = activeLayer === LAYER.FILL ? fillWhite : hex;
      activeSubColor[activeLayer] = strokeHex;
      ensureSublayer(activeLayer, strokeHex);
      renderLayerSwatches(activeLayer);
      rectToolStart = { x, y };
      rectToolPreview = { x, y };
      return;
  }
  if (activeLayer === PAPER_LAYER) {
      return;
  }
  isDrawing = true;
  const hex = tool === "eraser" ? activeSubColor?.[activeLayer] || colorToHex(currentColor) : colorToHex(currentColor);
  strokeHex = activeLayer === LAYER.FILL ? fillWhite : hex;
  activeSubColor[activeLayer] = strokeHex;
  ensureSublayer(activeLayer, strokeHex);
  renderLayerSwatches(activeLayer);
  beginGlobalHistoryStep(activeLayer, currentFrame, strokeHex);
  pushUndo(activeLayer, currentFrame, strokeHex);
  lastPt = {
      x: x,
      y: y
  };
  const off = getFrameCanvas(activeLayer, currentFrame, strokeHex);
  const ctx = off.getContext("2d");
  const p = pressure(e);
  const t = usePressureTilt ? tiltAmount(e) : 0;
  markGlobalHistoryDirty();
  markGlobalHistoryDirty();
  if (tool === "brush") {
      const pressureSize = usePressureSize ? brushSize * p : brushSize;
      const size = e?.pointerType === "pen" && usePressureTilt ? pressureSize * (1 + t * .75) : pressureSize;
      const alpha = usePressureOpacity ? p : 1;
      const brushRenderSettings = mergeBrushSettings(brushSettings, {
          size: size
      });
      stampLine(ctx, x, y, x + .01, y + .01, brushRenderSettings, currentColor, alpha, "source-over");
  } else if (tool === "eraser") {
      const eraserTilt = e?.pointerType === "pen" && usePressureTilt ? 1 + t * .75 : 1;
      const eraserRenderSettings = mergeBrushSettings(eraserSettings, {
          size: eraserSize * eraserTilt
      });
      stampLine(ctx, x, y, x + .01, y + .01, eraserRenderSettings, "#ffffff", 1, "destination-out");
  }
  markFrameHasContent(activeLayer, currentFrame, strokeHex || hex);
  queueRenderAll();
  updateTimelineHasContent(currentFrame);
}

function markFrameHasContent(L, F, colorStr) {
    const c = getFrameCanvas(L, F, colorStr);
    if (c) c._hasContent = true;
}

function continueStroke(e) {
  if (!isDrawing) return;
  const pos = getCanvasPointer(e);
  let {x: x, y: y} = screenToContent(pos.x, pos.y);
  notePenDetected(e);
  const movePt = stabilizePoint(e, x, y);
  x = movePt.x;
  y = movePt.y;
  if (gridSnap && gridEnabled && tool !== "line") {
      const snapped = snapToGrid(x, y);
      x = snapped.x;
      y = snapped.y;
  }
  if (!lastPt) lastPt = {
      x: x,
      y: y
  };
  if (tool === "rect-select") {
      updateRectSelect(e);
      lastPt = {
          x: x,
          y: y
      };
      return;
  }
  if (tool === "line") {
      lineToolPreview = { x, y };
      queueRenderAll();
      return;
  }
  if (tool === "rect") {
      rectToolPreview = { x, y };
      queueRenderAll();
      return;
  }
  if (tool === "fill-eraser" || tool === "fill-brush") {
      fxTransform();
      fxStamp1px(lastPt.x, lastPt.y, x, y);
      if (!trailPoints.length || Math.hypot(x - lastPt.x, y - lastPt.y) > 4) trailPoints.push({
          x: x,
          y: y
      });
      lastPt = {
          x: x,
          y: y
      };
      return;
  }
  if ((tool === "lasso-fill" || tool === "lasso-erase") && lassoActive) {
      addLassoPoint({
          x: x,
          y: y
      });
      drawLassoPreview(tool === "lasso-erase" ? "erase" : "fill");
      lastPt = {
          x: x,
          y: y
      };
      return;
  }
  
  const hex = strokeHex || (activeSubColor?.[activeLayer] ?? colorToHex(currentColor));
  const off = getFrameCanvas(activeLayer, currentFrame, hex);
  const ctx = off.getContext("2d");
  const p = pressure(e);
  const t = usePressureTilt ? tiltAmount(e) : 0;
  markGlobalHistoryDirty();
  if (tool === "brush") {
      const pressureSize = usePressureSize ? brushSize * p : brushSize;
      const size = e?.pointerType === "pen" && usePressureTilt ? pressureSize * (1 + t * .75) : pressureSize;
      const alpha = usePressureOpacity ? p : 1;
      const brushRenderSettings = mergeBrushSettings(brushSettings, {
          size: size
      });
      stampLine(ctx, lastPt.x, lastPt.y, x, y, brushRenderSettings, currentColor, alpha, "source-over");
  } else if (tool === "eraser") {
      const eraserTilt = e?.pointerType === "pen" && usePressureTilt ? 1 + t * .75 : 1;
      const eraserRenderSettings = mergeBrushSettings(eraserSettings, {
          size: eraserSize * eraserTilt
      });
      stampLine(ctx, lastPt.x, lastPt.y, x, y, eraserRenderSettings, "#ffffff", 1, "destination-out");
  }
  lastPt = {
      x: x,
      y: y
  };
  markFrameHasContent(activeLayer, currentFrame, strokeHex || hex);
  queueRenderAll();
  updateTimelineHasContent(currentFrame);
}

function endStroke() {
  if (!isDrawing) return;
  isDrawing = false;
  commitGlobalHistoryStep();
  const endKey = strokeHex;
  strokeHex = null;
  queueRenderAll();
  updateTimelineHasContent(currentFrame);
  if (tool === "rect-select") {
      endRectSelect();
      lastPt = null;
      stabilizedPt = null;
      return;
  }
  if (tool === "line" && lineToolStart && lineToolPreview) {
      const hex = strokeHex || activeSubColor?.[activeLayer] || colorToHex(currentColor);
      const off = getFrameCanvas(activeLayer, currentFrame, hex);
      const ctx = off.getContext("2d");
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = brushSize;
      ctx.strokeStyle = hex;
      ctx.beginPath();
      ctx.moveTo(lineToolStart.x, lineToolStart.y);
      ctx.lineTo(lineToolPreview.x, lineToolPreview.y);
      ctx.stroke();
      markFrameHasContent(activeLayer, currentFrame, hex);
      lineToolStart = null;
      lineToolPreview = null;
      queueRenderAll();
      updateTimelineHasContent(currentFrame);
      return;
  }
  if (tool === "rect" && rectToolStart && rectToolPreview) {
      const hex = strokeHex || activeSubColor?.[activeLayer] || colorToHex(currentColor);
      const off = getFrameCanvas(activeLayer, currentFrame, hex);
      const ctx = off.getContext("2d");
      ctx.lineWidth = brushSize;
      ctx.strokeStyle = hex;
      const rx = Math.min(rectToolStart.x, rectToolPreview.x);
      const ry = Math.min(rectToolStart.y, rectToolPreview.y);
      const rw = Math.abs(rectToolPreview.x - rectToolStart.x);
      const rh = Math.abs(rectToolPreview.y - rectToolStart.y);
      ctx.strokeRect(rx, ry, rw, rh);
      markFrameHasContent(activeLayer, currentFrame, hex);
      rectToolStart = null;
      rectToolPreview = null;
      queueRenderAll();
      updateTimelineHasContent(currentFrame);
      return;
  }
  if (tool === "lasso-erase" && lassoActive) {
      lassoActive = false;
      applyLassoErase();
      cancelLasso();
      lastPt = null;
      stabilizedPt = null;
      return;
  }
  try {
      commitGlobalHistoryStep();
  } catch {}
  if (tool === "lasso-fill" && lassoActive) {
      lassoActive = false;
      applyLassoFill();
      cancelLasso();
      lastPt = null;
      stabilizedPt = null;
      return;
  }
  if (tool === "eraser" && activeLayer !== PAPER_LAYER) {
      recomputeHasContent(activeLayer, currentFrame, endKey || activeSubColor?.[activeLayer] || currentColor);
      if (tool === "eraser" && activeLayer !== PAPER_LAYER) {
          recomputeHasContent(activeLayer, currentFrame, endKey || activeSubColor?.[activeLayer] || currentColor);
          updateTimelineHasContent(currentFrame);
          pruneUnusedSublayers(activeLayer);
      }
      updateTimelineHasContent(currentFrame);
  }
  if (tool === "fill-brush") {
      const seeds = trailPoints.length ? trailPoints : lastPt ? [ lastPt ] : [];
      if (seeds.length) applyFillRegionsFromSeeds(currentFrame, seeds, activeLayer);
      queueClearFx();
      trailPoints = [];
      lastPt = null;
      stabilizedPt = null;
      return;
  }
  if (tool === "fill-eraser") {
      if (activeLayer === PAPER_LAYER) {
        queueClearFx();
          trailPoints = [];
          lastPt = null;
          stabilizedPt = null;
          return;
      }
      const strokePts = trailPoints.length ? trailPoints : lastPt ? [ lastPt ] : [];
      if (strokePts.length) eraseFillRegionsFromSeeds(activeLayer, currentFrame, strokePts);
      queueClearFx();
      trailPoints = [];
      lastPt = null;
      stabilizedPt = null;
      return;
  }
  if (autofill && activeLayer === LAYER.LINE && tool === "brush") {
      pushUndo(LAYER.FILL, currentFrame);
      beginGlobalHistoryStep(LAYER.FILL, currentFrame, fillWhite);
      const filled = fillFromLineart(currentFrame);
      if (filled) markGlobalHistoryDirty();
      commitGlobalHistoryStep();
  }
  lastPt = null;
  stabilizedPt = null;
}

function endStrokeMobileSafe(e) {
  if (typeof _touchGestureActive !== "undefined" && _touchGestureActive) {
      try {
          cancelLasso?.();
      } catch {}
      try {
        queueClearFx?.();
      } catch {}
      try {
          isDrawing = false;
      } catch {}
      try {
          lastPt = null;
      } catch {}
      try {
          stabilizedPt = null;
      } catch {}
      try {
          trailPoints = [];
      } catch {}
      try {
          _fillEraseAllLayers = false;
      } catch {}
      return;
  }
  const F = typeof currentFrame === "number" ? currentFrame : 0;
  try {
      if (typeof isPanning !== "undefined" && isPanning) endPan();
  } catch {}
  if ((tool === "lasso-fill" || tool === "lasso-erase") && typeof lassoActive !== "undefined" && lassoActive) {
      try {
          if (tool === "lasso-fill") applyLassoFill(); else applyLassoErase();
      } catch (err) {
          console.warn("[celstomp] lasso commit failed", err);
      }
      try {
          cancelLasso();
      } catch {}
      try {
          isDrawing = false;
      } catch {}
      try {
          lastPt = null;
      } catch {}
      try {
          stabilizedPt = null;
      } catch {}
      return;
  }
  if (tool === "rect-select") {
      try {
          endRectSelect();
      } catch {}
      try {
          isDrawing = false;
      } catch {}
      try {
          lastPt = null;
      } catch {}
      try {
          stabilizedPt = null;
      } catch {}
      return;
  }
  if (tool === "fill-brush" || tool === "fill-eraser") {
      const seeds = Array.isArray(trailPoints) && trailPoints.length ? trailPoints : lastPt ? [ lastPt ] : [];
      if (seeds.length) {
          try {
              if (tool === "fill-brush") {
                  applyFillRegionsFromSeeds(F, seeds, activeLayer);
              } else {
                  const L = _fillEraseAllLayers ? -1 : activeLayer;
                  eraseFillRegionsFromSeeds(L, F, seeds, seeds);
              }
          } catch (err) {
              console.warn("[celstomp] fill commit failed", err);
          }
      }
      try {
        queueClearFx();
      } catch {}
      trailPoints = [];
      lastPt = null;
      stabilizedPt = null;
      _fillEraseAllLayers = false;
      isDrawing = false;
      try {
          endGlobalHistoryStep?.();
      } catch {}
      return;
  }
  try {
      isDrawing = false;
  } catch {}
  try {
      lastPt = null;
  } catch {}
  try {
      stabilizedPt = null;
  } catch {}
  try {
      trailPoints = [];
  } catch {}
  try {
      _fillEraseAllLayers = false;
  } catch {}
  try {
    queueClearFx?.();
  } catch {}
  try {
      endGlobalHistoryStep?.();
  } catch {}
}

// pan events

let isDrawing = false;

let isPanning = false;
let panStart = {
    x: 0,
    y: 0,
    ox: 0,
    oy: 0
};

function startPan(e) {
  isPanning = true;
  const pos = getCanvasPointer(e);
  panStart = {
      x: pos.x * dpr,
      y: pos.y * dpr,
      ox: getOffsetX(),
      oy: getOffsetY()
  };
}
function continuePan(e) {
  if (!isPanning) return;
  const pos = getCanvasPointer(e);
  const dx = pos.x * dpr - panStart.x;
  const dy = pos.y * dpr - panStart.y;
  setOffsetX(panStart.ox + dx);
  setOffsetY(panStart.oy + dy);
  queueRenderAll();
  queueUpdateHud();
  updatePlayheadMarker();
  updateClipMarkers();
  queueClearFx();
}
function endPan() {
  isPanning = false;
}

// ctrl move

const _ctrlMove = {
  active: false,
  pointerId: null,
  startCX: 0,
  startCY: 0,
  dx: 0,
  dy: 0,
  L: 0,
  F: 0,
  key: "#000000",
  canvas: null,
  ctx: null,
  snap: null,
  w: 0,
  h: 0
};

let rectSelection = {
    active: false,
    moving: false,
    L: null,
    F: null,
    key: null,
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    startX: 0,
    startY: 0,
    baseX: 0,
    baseY: 0,
    moveDx: 0,
    moveDy: 0,
    fullSnap: null,
    selSnap: null,
    pointerId: null
};

function beginCtrlMove(e) {
  if (activeLayer === PAPER_LAYER) return false;
  const leftDown = e.button === 0 || e.buttons === 1;
  if (!leftDown) return false;
  const picked = getActiveCelCanvasForMove();
  if (!picked.canvas) return false;
  const ctx = picked.canvas.getContext("2d", {
      willReadFrequently: true
  });
  if (!ctx) return false;
  const pos = getCanvasPointer(e);
  const cpt = screenToContent(pos.x, pos.y);
  _ctrlMove.active = true;
  _ctrlMove.pointerId = e.pointerId;
  _ctrlMove.startCX = cpt.x;
  _ctrlMove.startCY = cpt.y;
  _ctrlMove.dx = 0;
  _ctrlMove.dy = 0;
  _ctrlMove.L = picked.L;
  _ctrlMove.F = picked.F;
  _ctrlMove.key = picked.key;
  _ctrlMove.canvas = picked.canvas;
  _ctrlMove.ctx = ctx;
  _ctrlMove.w = picked.canvas.width | 0;
  _ctrlMove.h = picked.canvas.height | 0;
  try {
      _ctrlMove.snap = ctx.getImageData(0, 0, _ctrlMove.w, _ctrlMove.h);
  } catch {
      _ctrlMove.active = false;
      return false;
  }
  try {
      beginGlobalHistoryStep(_ctrlMove.L, _ctrlMove.F, _ctrlMove.key);
  } catch {}
  try {
      drawCanvas.setPointerCapture(e.pointerId);
  } catch {}
  return true;
}
function updateCtrlMove(e) {
  if (!_ctrlMove.active) return;
  const pos = getCanvasPointer(e);
  const cpt = screenToContent(pos.x, pos.y);
  const dx = Math.round(cpt.x - _ctrlMove.startCX);
  const dy = Math.round(cpt.y - _ctrlMove.startCY);
  if (dx === _ctrlMove.dx && dy === _ctrlMove.dy) return;
  _ctrlMove.dx = dx;
  _ctrlMove.dy = dy;
  const ctx = _ctrlMove.ctx;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, _ctrlMove.w, _ctrlMove.h);
  try {
      markGlobalHistoryDirty();
  } catch {}
  ctx.putImageData(_ctrlMove.snap, dx, dy);
  _ctrlMove.canvas._hasContent = true;
  if (typeof queueRenderAll === "function") queueRenderAll();
  if (typeof updateTimelineHasContent === "function") updateTimelineHasContent(_ctrlMove.F);
}
function endCtrlMove(e) {
  if (!_ctrlMove.active) return;
  try {
      const data = _ctrlMove.ctx.getImageData(0, 0, _ctrlMove.w, _ctrlMove.h).data;
      let any = false;
      for (let i = 3; i < data.length; i += 4) {
          if (data[i] > 0) {
              any = true;
              break;
          }
      }
      _ctrlMove.canvas._hasContent = any;
  } catch {}
  _ctrlMove.active = false;
  try {
      drawCanvas.releasePointerCapture(_ctrlMove.pointerId);
  } catch {}
  if (typeof queueRenderAll === "function") queueRenderAll();
  if (typeof updateTimelineHasContent === "function") updateTimelineHasContent(_ctrlMove.F);
  try {
      commitGlobalHistoryStep();
  } catch {}
  _ctrlMove.pointerId = null;
  _ctrlMove.canvas = null;
  _ctrlMove.ctx = null;
  _ctrlMove.snap = null;
}

////////////////////
// RECT SELECTION //
////////////////////

function clearRectSelection() {
    rectSelection.active = false;
    rectSelection.moving = false;
    rectSelection.fullSnap = null;
    rectSelection.selSnap = null;
    rectSelection.pointerId = null;
    rectSelection.moveDx = 0;
    rectSelection.moveDy = 0;
    queueRenderAll();
}
function drawRectSelectionOverlay(ctx) {
    if (!rectSelection.active) return;
    ctx.save();
    ctx.lineWidth = Math.max(1 / Math.max(getZoom(), 1), .75);
    ctx.setLineDash([ 6 / Math.max(getZoom(), 1), 4 / Math.max(getZoom(), 1) ]);
    ctx.strokeStyle = "#00e5ff";
    ctx.fillStyle = "rgba(0, 229, 255, 0.12)";
    ctx.fillRect(rectSelection.x, rectSelection.y, rectSelection.w, rectSelection.h);
    ctx.strokeRect(rectSelection.x, rectSelection.y, rectSelection.w, rectSelection.h);
    ctx.restore();
}
function drawLineToolPreview(ctx) {
    if (!lineToolStart || !lineToolPreview) return;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = brushSize;
    ctx.strokeStyle = currentColor;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(lineToolStart.x, lineToolStart.y);
    ctx.lineTo(lineToolPreview.x, lineToolPreview.y);
    ctx.stroke();
    ctx.restore();
}
function drawRectToolPreview(ctx) {
    if (!rectToolStart || !rectToolPreview) return;
    ctx.save();
    ctx.lineWidth = brushSize;
    ctx.strokeStyle = currentColor;
    ctx.globalAlpha = 0.5;
    const rx = Math.min(rectToolStart.x, rectToolPreview.x);
    const ry = Math.min(rectToolStart.y, rectToolPreview.y);
    const rw = Math.abs(rectToolPreview.x - rectToolStart.x);
    const rh = Math.abs(rectToolPreview.y - rectToolStart.y);
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.restore();
}
function drawGrid(ctx) {
    if (!gridEnabled) return;
    ctx.save();
    ctx.strokeStyle = "rgba(128, 128, 128, 0.5)";
    const z = getZoom();
    ctx.lineWidth = 1 / z; // Scale line width with zoom to remain visible
    for (let x = 0; x <= contentW; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, contentH);
        ctx.stroke();
    }
    for (let y = 0; y <= contentH; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(contentW, y);
        ctx.stroke();
    }
    ctx.restore();
}
function drawGuides(ctx) {
    if (!guides.length) return;
    ctx.save();
    ctx.strokeStyle = "#ff6b6b";
    const z = getZoom();
    ctx.lineWidth = 1 / z; // Scale with zoom
    ctx.setLineDash([4 / z, 4 / z]);
    for (const guide of guides) {
        if (guide.horizontal) {
            ctx.beginPath();
            ctx.moveTo(0, guide.pos);
            ctx.lineTo(contentW, guide.pos);
            ctx.stroke();
        } else {
            ctx.beginPath();
            ctx.moveTo(guide.pos, 0);
            ctx.lineTo(guide.pos, contentH);
            ctx.stroke();
        }
    }
    ctx.restore();
}
function snapToGuides(x, y) {
    if (!guideSnap || !guides.length) return { x, y };
    const threshold = 8;
    for (const guide of guides) {
        if (guide.horizontal && Math.abs(y - guide.pos) < threshold) {
            y = guide.pos;
        } else if (!guide.horizontal && Math.abs(x - guide.pos) < threshold) {
            x = guide.pos;
        }
    }
    return { x, y };
}
function snapToGrid(x, y) {
    if (!gridSnap || !gridEnabled) return { x, y };
    return {
        x: Math.round(x / gridSize) * gridSize,
        y: Math.round(y / gridSize) * gridSize
    };
}
function beginRectSelect(e) {
    if (activeLayer === PAPER_LAYER) return;
    const pos = getCanvasPointer(e);
    const pt = screenToContent(pos.x, pos.y);
    const key = resolveKeyFor(activeLayer, activeSubColor?.[activeLayer] ?? currentColor);
    if (!key) return;
    if (rectSelection.active) {
        const inX = pt.x >= rectSelection.x && pt.x <= rectSelection.x + rectSelection.w;
        const inY = pt.y >= rectSelection.y && pt.y <= rectSelection.y + rectSelection.h;
        const sameTarget = rectSelection.L === activeLayer && rectSelection.F === currentFrame && rectSelection.key === key;
        if (inX && inY && sameTarget) {
            const c = getFrameCanvas(activeLayer, currentFrame, key);
            const ctx = c.getContext("2d", {
                willReadFrequently: true
            });
            if (!ctx) return;
            try {
                rectSelection.fullSnap = ctx.getImageData(0, 0, contentW, contentH);
                rectSelection.selSnap = ctx.getImageData(rectSelection.x, rectSelection.y, rectSelection.w, rectSelection.h);
            } catch {
                clearRectSelection();
                return;
            }
            rectSelection.moving = true;
            rectSelection.baseX = rectSelection.x;
            rectSelection.baseY = rectSelection.y;
            rectSelection.startX = pt.x;
            rectSelection.startY = pt.y;
            rectSelection.pointerId = e.pointerId ?? null;
            beginGlobalHistoryStep(activeLayer, currentFrame, key);
            return;
        }
    }
    rectSelection.active = true;
    rectSelection.moving = false;
    rectSelection.L = activeLayer;
    rectSelection.F = currentFrame;
    rectSelection.key = key;
    rectSelection.startX = pt.x;
    rectSelection.startY = pt.y;
    rectSelection.x = Math.floor(pt.x);
    rectSelection.y = Math.floor(pt.y);
    rectSelection.w = 1;
    rectSelection.h = 1;
    rectSelection.pointerId = e.pointerId ?? null;
    queueRenderAll();
}
function updateRectSelect(e) {
    if (!rectSelection.active) return;
    const pos = getCanvasPointer(e);
    const pt = screenToContent(pos.x, pos.y);
    if (rectSelection.moving) {
        const dx = Math.round(pt.x - rectSelection.startX);
        const dy = Math.round(pt.y - rectSelection.startY);
        if (dx === rectSelection.moveDx && dy === rectSelection.moveDy) return;
        rectSelection.moveDx = dx;
        rectSelection.moveDy = dy;
        rectSelection.x = Math.max(0, Math.min(contentW - rectSelection.w, rectSelection.baseX + dx));
        rectSelection.y = Math.max(0, Math.min(contentH - rectSelection.h, rectSelection.baseY + dy));
        const c = getFrameCanvas(rectSelection.L, rectSelection.F, rectSelection.key);
        const ctx = c.getContext("2d", {
            willReadFrequently: true
        });
        if (!ctx || !rectSelection.fullSnap || !rectSelection.selSnap) return;
        ctx.putImageData(rectSelection.fullSnap, 0, 0);
        ctx.clearRect(rectSelection.baseX, rectSelection.baseY, rectSelection.w, rectSelection.h);
        ctx.putImageData(rectSelection.selSnap, rectSelection.x, rectSelection.y);
        markGlobalHistoryDirty();
        c._hasContent = true;
        queueRenderAll();
        updateTimelineHasContent(rectSelection.F);
        return;
    }
    const x0 = rectSelection.startX;
    const y0 = rectSelection.startY;
    const x1 = pt.x;
    const y1 = pt.y;
    rectSelection.x = Math.max(0, Math.floor(Math.min(x0, x1)));
    rectSelection.y = Math.max(0, Math.floor(Math.min(y0, y1)));
    rectSelection.w = Math.max(1, Math.ceil(Math.abs(x1 - x0)));
    rectSelection.h = Math.max(1, Math.ceil(Math.abs(y1 - y0)));
    rectSelection.w = Math.min(rectSelection.w, contentW - rectSelection.x);
    rectSelection.h = Math.min(rectSelection.h, contentH - rectSelection.y);
    queueRenderAll();
}
function endRectSelect() {
    if (!rectSelection.active) return;
    if (rectSelection.moving) {
        rectSelection.moving = false;
        rectSelection.baseX = rectSelection.x;
        rectSelection.baseY = rectSelection.y;
        rectSelection.fullSnap = null;
        rectSelection.selSnap = null;
        commitGlobalHistoryStep();
        queueRenderAll();
        return;
    }
    const c = getFrameCanvas(rectSelection.L, rectSelection.F, rectSelection.key);
    const ctx = c.getContext("2d", {
        willReadFrequently: true
    });
    if (!ctx) {
        clearRectSelection();
        return;
    }
    let img;
    try {
        img = ctx.getImageData(rectSelection.x, rectSelection.y, rectSelection.w, rectSelection.h);
    } catch {
        clearRectSelection();
        return;
    }
    let hasAlpha = false;
    for (let i = 3; i < img.data.length; i += 4) {
        if (img.data[i] > 0) {
            hasAlpha = true;
            break;
        }
    }
    if (!hasAlpha) {
        clearRectSelection();
        return;
    }
    queueRenderAll();
}

function applyFillRegionsFromSeeds(F, seeds, targetLayer) {
    let masks = insideMaskFromLineartOnly(F, closeGapPx);
    if (!masks && typeof combinedInsideMask_LineColor === "function") {
        masks = combinedInsideMask_LineColor(F, closeGapPx);
    }
    if (!masks) return false;
    const {closed: closed, outside: outside, w: w, h: h} = masks;
    const visited = new Uint8Array(w * h);
    const layer = typeof targetLayer === "number" ? targetLayer : LAYER.FILL;
    const key = fillKeyForTool(layer, "fill-brush");
    if (!key) return false;
    if (layer === LAYER.FILL) {
        if (Array.isArray(activeSubColor)) activeSubColor[LAYER.FILL] = key;
        ensureSublayer(LAYER.FILL, key);
        try {
            renderLayerSwatches(LAYER.FILL);
        } catch {}
    } else {
        ensureActiveSwatchForColorLayer(layer, key);
    }
    const fillCanvas = getFrameCanvas(layer, F, key);
    const fctx = fillCanvas.getContext("2d", {
        willReadFrequently: true
    });
    const img = fctx.getImageData(0, 0, w, h);
    const d = img.data;
    const tmp = document.createElement("canvas").getContext("2d", {
        willReadFrequently: true
    });
    tmp.fillStyle = key;
    tmp.fillRect(0, 0, 1, 1);
    const c = tmp.getImageData(0, 0, 1, 1).data;
    const qx = new Uint32Array(w * h), qy = new Uint32Array(w * h);
    let qs = 0, qe = 0;
    function push(x, y) {
        qx[qe] = x;
        qy[qe] = y;
        qe++;
    }
    function inBounds(x, y) {
        return x >= 0 && y >= 0 && x < w && y < h;
    }
    function isInside(x, y) {
        const idx = y * w + x;
        return !outside[idx] && !closed[idx];
    }
    let any = false;
    function floodSeed(sx, sy) {
        sx |= 0;
        sy |= 0;
        if (!inBounds(sx, sy)) return;
        const si = sy * w + sx;
        if (visited[si] || !isInside(sx, sy)) return;
        visited[si] = 1;
        push(sx, sy);
        while (qs < qe) {
            const x = qx[qs], y = qy[qs];
            qs++;
            const idx = y * w + x;
            const i4 = idx * 4;
            d[i4 + 0] = c[0];
            d[i4 + 1] = c[1];
            d[i4 + 2] = c[2];
            d[i4 + 3] = 255;
            any = true;
            const nbs = [ [ x + 1, y ], [ x - 1, y ], [ x, y + 1 ], [ x, y - 1 ] ];
            for (const [nx, ny] of nbs) {
                if (!inBounds(nx, ny)) continue;
                const j = ny * w + nx;
                if (visited[j]) continue;
                if (!isInside(nx, ny)) continue;
                visited[j] = 1;
                push(nx, ny);
            }
        }
        qs = 0;
        qe = 0;
    }
    for (const pt of seeds) floodSeed(Math.round(pt.x), Math.round(pt.y));
    if (!any) return false;
    fctx.putImageData(img, 0, 0);
    fillCanvas._hasContent = true;
    queueRenderAll();
    updateTimelineHasContent(F);
    return true;
}

// fill tools

function eraseFillRegionsFromSeeds(a, b, c, d) {
    let layer, F, seeds, strokePts;
    if (Array.isArray(b)) {
        F = Number(a);
        seeds = b;
        layer = typeof c === "number" ? c : LAYER.FILL;
        strokePts = Array.isArray(d) && d.length ? d : seeds;
    } else if (Array.isArray(c)) {
        layer = typeof a === "number" ? a : LAYER.FILL;
        F = Number(b);
        seeds = c;
        strokePts = Array.isArray(d) && d.length ? d : seeds;
    } else {
        return false;
    }
    const pts = Array.isArray(strokePts) && strokePts.length ? strokePts : seeds;
    if (!Array.isArray(pts) || !pts.length) return false;
    if (!Array.isArray(seeds) || !seeds.length) seeds = pts;
    if (!Number.isFinite(F)) F = currentFrame;
    const masks = combinedInsideMask_LineColor(F, closeGapPx);
    if (!masks) return false;
    const {closed: closed, outside: outside, w: w, h: h} = masks;
    const inBounds = (x, y) => x >= 0 && y >= 0 && x < w && y < h;
    const idxOf = (x, y) => y * w + x;
    const isInsideIdx = idx => !outside[idx] && !closed[idx];
    const seedIdxs = [];
    for (const pt of pts) {
        const sx = Math.round(pt.x), sy = Math.round(pt.y);
        if (!inBounds(sx, sy)) continue;
        const si = idxOf(sx, sy);
        if (isInsideIdx(si)) seedIdxs.push(si);
    }
    if (!seedIdxs.length) return false;
    const AUTO_PICK_UNDER_STROKE = false;
    function pickExistingKey(L, want) {
        const lay = layers?.[L];
        const subMap = lay?.sublayers;
        if (!subMap || !subMap.get) return null;
        const hasKey = k => !!k && (subMap.has?.(k) || !!subMap.get(k));
        if (typeof resolveKeyFor === "function") {
            try {
                const rk = resolveKeyFor(L, want);
                if (hasKey(rk)) return rk;
            } catch {}
        }
        if (hasKey(want)) return want;
        if (typeof want === "string") {
            const n = typeof normHex6 === "function" ? normHex6(want) : null;
            if (n && hasKey(n)) return n;
            if (n && hasKey(n.toLowerCase())) return n.toLowerCase();
            if (hasKey(want.toUpperCase())) return want.toUpperCase();
            if (hasKey(want.toLowerCase())) return want.toLowerCase();
        }
        return null;
    }
    function keysHitUnderStroke(L, preferredKey) {
        const lay = layers?.[L];
        const subMap = lay?.sublayers;
        if (!subMap || !subMap.get) return [];
        const out = [];
        const seen = new Set;
        const tryAdd = k => {
            if (!k || seen.has(k)) return;
            if (!(subMap.has?.(k) || subMap.get(k))) return;
            seen.add(k);
            out.push(k);
        };
        tryAdd(preferredKey);
        if (AUTO_PICK_UNDER_STROKE) {
            const order = Array.isArray(lay?.suborder) ? lay.suborder : [];
            for (let i = order.length - 1; i >= 0; i--) {
                const k = order[i];
                if (!k || seen.has(k)) continue;
                const sub = subMap.get(k);
                const canvas = sub?.frames?.[F] || null;
                if (!canvas) continue;
                if ((canvas.width | 0) !== w || (canvas.height | 0) !== h) continue;
                if (canvas._hasContent === false) continue;
                const ctx = canvas.getContext("2d", {
                    willReadFrequently: true
                });
                if (!ctx) continue;
                let img;
                try {
                    img = ctx.getImageData(0, 0, w, h);
                } catch {
                    continue;
                }
                const dpx = img.data;
                let hit = false;
                for (let s = 0; s < seedIdxs.length; s++) {
                    if (dpx[seedIdxs[s] * 4 + 3]) {
                        hit = true;
                        break;
                    }
                }
                if (hit) tryAdd(k);
            }
        }
        return out;
    }
    const layersToErase = layer === -1 ? MAIN_LAYERS.slice() : [ layer ];
    let didAny = false;
    const qx = new Uint32Array(w * h);
    const qy = new Uint32Array(w * h);
    for (const L of layersToErase) {
        const lay = layers?.[L];
        const subMap = lay?.sublayers;
        if (!subMap || !subMap.get) continue;
        const want = L === LAYER.FILL ? activeSubColor?.[LAYER.FILL] || fillWhite || "#FFFFFF" : activeSubColor?.[L] ?? currentColor;
        const preferredKey = pickExistingKey(L, want);
        const keys = keysHitUnderStroke(L, preferredKey);
        for (const key of keys) {
            const sub = subMap.get(key);
            const canvas = sub?.frames?.[F] || null;
            if (!canvas) continue;
            if ((canvas.width | 0) !== w || (canvas.height | 0) !== h) continue;
            const ctx = canvas.getContext("2d", {
                willReadFrequently: true
            });
            if (!ctx) continue;
            let img;
            try {
                img = ctx.getImageData(0, 0, w, h);
            } catch {
                continue;
            }
            const dpx = img.data;
            let undoPushed = false;
            const ensureUndoOnce = () => {
                if (undoPushed) return;
                undoPushed = true;
                try {
                    pushUndo(L, F, key);
                } catch {}
            };
            const visited = new Uint8Array(w * h);
            function floodFromSeedIdx(si) {
                if (visited[si] || !isInsideIdx(si)) return false;
                let qs = 0, qe = 0;
                visited[si] = 1;
                qx[qe] = si % w;
                qy[qe] = si / w | 0;
                qe++;
                let anyHere = false;
                while (qs < qe) {
                    const x = qx[qs], y = qy[qs];
                    qs++;
                    const idx = idxOf(x, y);
                    const a4 = idx * 4 + 3;
                    if (dpx[a4]) {
                        ensureUndoOnce();
                        dpx[a4] = 0;
                        anyHere = true;
                    }
                    if (x + 1 < w) {
                        const ni = idx + 1;
                        if (!visited[ni] && isInsideIdx(ni)) {
                            visited[ni] = 1;
                            qx[qe] = x + 1;
                            qy[qe] = y;
                            qe++;
                        }
                    }
                    if (x - 1 >= 0) {
                        const ni = idx - 1;
                        if (!visited[ni] && isInsideIdx(ni)) {
                            visited[ni] = 1;
                            qx[qe] = x - 1;
                            qy[qe] = y;
                            qe++;
                        }
                    }
                    if (y + 1 < h) {
                        const ni = idx + w;
                        if (!visited[ni] && isInsideIdx(ni)) {
                            visited[ni] = 1;
                            qx[qe] = x;
                            qy[qe] = y + 1;
                            qe++;
                        }
                    }
                    if (y - 1 >= 0) {
                        const ni = idx - w;
                        if (!visited[ni] && isInsideIdx(ni)) {
                            visited[ni] = 1;
                            qx[qe] = x;
                            qy[qe] = y - 1;
                            qe++;
                        }
                    }
                }
                return anyHere;
            }
            let any = false;
            for (let s = 0; s < seedIdxs.length; s++) {
                if (floodFromSeedIdx(seedIdxs[s])) any = true;
            }
            if (!any) continue;
            ctx.putImageData(img, 0, 0);
            let anyAlpha = false;
            for (let i = 3; i < dpx.length; i += 4) {
                if (dpx[i]) {
                    anyAlpha = true;
                    break;
                }
            }
            canvas._hasContent = anyAlpha;
            didAny = true;
        }
        if (didAny) {
            try {
                pruneUnusedSublayers?.(L);
            } catch {}
        }
    }
    if (!didAny) return false;
    queueRenderAll();
    updateTimelineHasContent(F);
    return true;
}

function morphologicalClose(mask, w, h, gapPx) {
    const r = Math.max(0, Math.round(gapPx));
    function dilate(src) {
        const dst = new Uint8Array(w * h);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                let v = 0;
                for (let oy = -1; oy <= 1; oy++) {
                    for (let ox = -1; ox <= 1; ox++) {
                        const nx = x + ox, ny = y + oy;
                        if (nx >= 0 && ny >= 0 && nx < w && ny < h && src[ny * w + nx]) {
                            v = 1;
                            oy = 2;
                            break;
                        }
                    }
                }
                dst[y * w + x] = v;
            }
        }
        return dst;
    }
    function erode(src) {
        const dst = new Uint8Array(w * h);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                let v = 1;
                for (let oy = -1; oy <= 1; oy++) {
                    for (let ox = -1; ox <= 1; ox++) {
                        const nx = x + ox, ny = y + oy;
                        if (!(nx >= 0 && ny >= 0 && nx < w && ny < h) || !src[ny * w + nx]) {
                            v = 0;
                            oy = 2;
                            break;
                        }
                    }
                }
                dst[y * w + x] = v;
            }
        }
        return dst;
    }
    let closed = mask;
    if (r > 0) {
        const reps = Math.max(1, Math.round(r / 2));
        for (let i = 0; i < reps; i++) closed = dilate(closed);
        for (let i = 0; i < reps; i++) closed = erode(closed);
    }
    return closed;
}
function computeOutsideFromClosed(closed, w, h) {
    const outside = new Uint8Array(w * h);
    const qx = new Uint32Array(w * h);
    const qy = new Uint32Array(w * h);
    let qs = 0, qe = 0;
    function push(x, y) {
        qx[qe] = x;
        qy[qe] = y;
        qe++;
    }
    function mark(x, y) {
        if (x < 0 || y < 0 || x >= w || y >= h) return;
        const idx = y * w + x;
        if (outside[idx] || closed[idx]) return;
        outside[idx] = 1;
        push(x, y);
    }
    for (let x = 0; x < w; x++) {
        mark(x, 0);
        mark(x, h - 1);
    }
    for (let y = 0; y < h; y++) {
        mark(0, y);
        mark(w - 1, y);
    }
    while (qs < qe) {
        const x = qx[qs], y = qy[qs];
        qs++;
        mark(x + 1, y);
        mark(x - 1, y);
        mark(x, y + 1);
        mark(x, y - 1);
    }
    return outside;
} 

function combinedInsideMask_LineColor(F, gapPx, targetLayer = null) {
    const w = contentW, h = contentH;
    const lineCanvases = canvasesWithContentForMainLayerFrame(LAYER.LINE, F);
    const colorCanvases = targetLayer === LAYER.COLOR ? [] : canvasesWithContentForMainLayerFrame(LAYER.COLOR, F);
    if (!lineCanvases.length && !colorCanvases.length) return null;
    const mask = new Uint8Array(w * h);
    function addMaskFrom(canvas) {
        const ctx = canvas.getContext("2d", {
            willReadFrequently: true
        });
        const im = ctx.getImageData(0, 0, w, h).data;
        for (let i = 0, p = 0; i < im.length; i += 4, p++) {
            if (im[i + 3] > 10) mask[p] = 1;
        }
    }
    for (const c of lineCanvases) addMaskFrom(c);
    for (const c of colorCanvases) addMaskFrom(c);
    const closed = morphologicalClose(mask, w, h, gapPx);
    const outside = computeOutsideFromClosed(closed, w, h);
    return {
        closed: closed,
        outside: outside,
        w: w,
        h: h
    };
}

function fillKeyForTool(L, toolKind) {
    if (L === PAPER_LAYER) return null;
    const cur = colorToHex(currentColor ?? "#000000");
    if (L === LAYER.FILL) {
        if (toolKind === "fill-brush") return cur;
        if (toolKind === "fill-eraser") return activeSubColor?.[LAYER.FILL] || fillWhite;
        return fillWhite;
    }
    if (toolKind === "fill-brush") return cur;
    return colorToHex(activeSubColor?.[L] ?? currentColor ?? "#000000");
}
function ensureActiveSwatchForColorLayer(L, key) {
    if (L == null || L === PAPER_LAYER || L === LAYER.FILL) return;
    if (Array.isArray(activeSubColor)) activeSubColor[L] = key;
    ensureSublayer(L, key);
    try {
        normalizeLayerSwatchKeys(layer);
    } catch {}
    try {
        renderLayerSwatches(L);
    } catch {}
}

function insideMaskFromLineartOnly(F, gapPx) {
    const w = contentW | 0, h = contentH | 0;
    const lineCanvases = canvasesWithContentForMainLayerFrame(LAYER.LINE, F);
    if (!lineCanvases || !lineCanvases.length) return null;
    const mask = new Uint8Array(w * h);
    for (const canvas of lineCanvases) {
        const ctx = canvas.getContext("2d", {
            willReadFrequently: true
        });
        if (!ctx) continue;
        const data = ctx.getImageData(0, 0, w, h).data;
        for (let i = 3, p = 0; i < data.length; i += 4, p++) {
            if (data[i] > 10) mask[p] = 1;
        }
    }
    const closed = morphologicalClose(mask, w, h, gapPx);
    const outside = computeOutsideFromClosed(closed, w, h);
    return {
        closed: closed,
        outside: outside,
        w: w,
        h: h
    };
}
function fillFromLineart(F) {
    const w = contentW, h = contentH;
    const lineCanvases = canvasesWithContentForMainLayerFrame(LAYER.LINE, F);
    if (!lineCanvases.length) return false;
    const mask = new Uint8Array(w * h);
    for (const canvas of lineCanvases) {
        const srcCtx = canvas.getContext("2d", {
            willReadFrequently: true
        });
        const data = srcCtx.getImageData(0, 0, w, h).data;
        for (let i = 0, p = 0; i < data.length; i += 4, p++) {
            if (data[i + 3] > 10) mask[p] = 1;
        }
    }
    const closed = morphologicalClose(mask, w, h, closeGapPx);
    const outside = computeOutsideFromClosed(closed, w, h);
    const fillCanvas = getFrameCanvas(LAYER.FILL, F, fillWhite);
    const fctx = fillCanvas.getContext("2d");
    const out = fctx.createImageData(w, h);
    const od = out.data;
    const tmp = document.createElement("canvas").getContext("2d", {
        willReadFrequently: true
    });
    tmp.fillStyle = fillWhite;
    tmp.fillRect(0, 0, 1, 1);
    const c = tmp.getImageData(0, 0, 1, 1).data;
    let any = false;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const p = y * w + x;
            const i4 = p * 4;
            if (!outside[p] && !closed[p]) {
                od[i4 + 0] = c[0];
                od[i4 + 1] = c[1];
                od[i4 + 2] = c[2];
                od[i4 + 3] = 255;
                any = true;
            }
        }
    }
    if (!any) return false;
    fctx.putImageData(out, 0, 0);
    fillCanvas._hasContent = true;
    queueRenderAll();
    updateTimelineHasContent(F);
    return true;
}
