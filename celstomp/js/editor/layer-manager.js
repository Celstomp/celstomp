

const LAYER = {
  FILL: 0,
  COLOR: 1,
  SHADE: 2,
  LINE: 3,
  SKETCH: 4
};

const MAIN_LAYERS = [ LAYER.FILL, LAYER.COLOR, LAYER.SHADE, LAYER.LINE, LAYER.SKETCH ];
const DEFAULT_MAIN_LAYER_ORDER = [ LAYER.FILL, LAYER.COLOR, LAYER.SHADE, LAYER.LINE, LAYER.SKETCH ];
const LAYERS_COUNT = 5;

let layers = new Array(LAYERS_COUNT).fill(0).map(() => ({
  name: "",
  opacity: 1,
  prevOpacity: 1,
  blendMode: "normal",
  frames: new Array(totalFrames).fill(null),
  sublayers: new Map,
  suborder: []
}));

layers[LAYER.LINE].name = "LINE";
layers[LAYER.SHADE].name = "SHADE";
layers[LAYER.COLOR].name = "COLOR";
layers[LAYER.SKETCH].name = "SKETCH";
layers[LAYER.FILL].name = "FILL";
let activeLayer = LAYER.LINE;

let activeSubColor = new Array(LAYERS_COUNT).fill("#000000");
let layerColorMem = new Array(LAYERS_COUNT).fill("#000000");
layerColorMem[LAYER.FILL] = fillWhite;

const PAPER_LAYER = -1;
let mainLayerOrder = DEFAULT_MAIN_LAYER_ORDER.slice();

const LAYER_BLEND_MODES = [ "normal", "multiply", "overlay" ];

function normalizeLayerBlendMode(mode) {
    const key = String(mode || "normal").toLowerCase();
    if (LAYER_BLEND_MODES.includes(key)) return key;
    return "normal";
}

function layerBlendModeCanvasOperation(mode) {
    const normalized = normalizeLayerBlendMode(mode);
    if (normalized === "multiply") return "multiply";
    if (normalized === "overlay") return "overlay";
    return "source-over";
}

function getLayerBlendMode(L) {
    const layer = layers?.[L];
    if (!layer) return "normal";
    const normalized = normalizeLayerBlendMode(layer.blendMode);
    layer.blendMode = normalized;
    return normalized;
}

function setLayerBlendMode(L, mode) {
    const layer = layers?.[L];
    if (!layer) return;
    layer.blendMode = normalizeLayerBlendMode(mode);
    queueRenderAll();
}

function getLayerName(layer) {
    switch (layer) {
        case LAYER.LINE:
            return "Line";
        case LAYER.SHADE:
            return "Shade";
        case LAYER.COLOR:
            return "Color";
        case LAYER.FILL:
            return "Fill";
        case LAYER.PAPER:
            return "Paper";
        default:
            return layer;
    }
}

function normalizeMainLayerOrder(order) {
    if (!Array.isArray(order)) return DEFAULT_MAIN_LAYER_ORDER.slice();
    const seen = new Set;
    const out = [];
    for (const raw of order) {
        const n = Number(raw);
        if (!Number.isFinite(n)) continue;
        if (!MAIN_LAYERS.includes(n)) continue;
        if (seen.has(n)) continue;
        seen.add(n);
        out.push(n);
    }
    for (const L of DEFAULT_MAIN_LAYER_ORDER) {
        if (!seen.has(L)) out.push(L);
    }
    return out;
}
function mainLayersTopToBottom() {
    return mainLayerOrder.slice().reverse();
}

function rememberedColorForLayer(L) {
  if (L === LAYER.FILL) return fillWhite;
  return layerColorMem[L] || "#000000";
}

function rememberCurrentColorForLayer(L = activeLayer) {
  if (L === LAYER.FILL) return;
  layerColorMem[L] = currentColor;
}

function applyRememberedColorForLayer(L = activeLayer) {
  currentColor = rememberedColorForLayer(L);
  setColorSwatch();
}

function syncActiveLayerColorUI({
  layer: layer = activeLayer,
  color: color = null,
  remember: remember = false,
  redrawSwatches: redrawSwatches = true,
  updateHud: updateHud = true
} = {}) {
  if (layer === PAPER_LAYER) {
      if (redrawSwatches) {
          try {
              renderLayerSwatches();
          } catch {}
      }
      if (updateHud) {
          try {
              queueUpdateHud?.();
          } catch {}
      }
      return;
  }
  const fromActive = Array.isArray(activeSubColor) ? activeSubColor[layer] : null;
  const fallback = typeof rememberedColorForLayer === "function" ? rememberedColorForLayer(layer) : "#000000";
  const next = swatchColorKey(color || fromActive || fallback || "#000000");
  if (Array.isArray(activeSubColor)) activeSubColor[layer] = next;
  activeLayer = layer;
  if (typeof setCurrentColorHex === "function") {
      setCurrentColorHex(next, {
          remember: remember
      });
  } else {
      currentColor = next;
      try {
          setColorSwatch?.();
      } catch {}
      try {
          setHSVPreviewBox?.();
      } catch {}
      if (remember) {
          try {
              rememberCurrentColorForLayer?.(layer);
          } catch {}
      }
      try {
          drawHSVWheel?.();
      } catch {}
  }
  try {
      setLayerRadioChecked(layer);
  } catch {}
  if (redrawSwatches) {
      try {
          renderLayerSwatches();
      } catch {}
  }
  if (updateHud) {
      try {
          queueUpdateHud?.();
      } catch {}
  }
}

function setColorSwatch() {
  const brushSwatch = $("brushSwatch");
  const brushHexEl = $("brushHex");
  if (!brushSwatch || !brushHexEl) return;
  brushSwatch.style.background = currentColor;
  brushHexEl.textContent = currentColor.toUpperCase();
}

function _ctrlMovePickKeyForLayer(L) {
  if (L === LAYER.FILL) {
      // what
      return activeSubColor?.[LAYER.FILL] || fillWhite || "#ffffff";
  }
  return activeSubColor?.[L] ?? (typeof currentColor === "string" ? currentColor : "#000000");
}

function getActiveCelCanvasForMove() {
  const L = activeLayer;
  const F = currentFrame;

  const key = colorToHex(_ctrlMovePickKeyForLayer(L));
  const c = getFrameCanvas(L, F, key);
  return {
      canvas: c,
      L: L,
      F: F,
      key: key
  };
}

function getFrameCanvas(L, F, colorStr) {
  const key = colorToHex(colorStr || activeSubColor?.[L] || currentColor || "#000");
  const sub = ensureSublayer(L, key);
  if (!sub) return null;
  if (!sub.frames[F]) {
      const off = document.createElement("canvas");
      off.width = Math.max(1, contentW | 0);
      off.height = Math.max(1, contentH | 0);
      off._hasContent = false;
      sub.frames[F] = off;
  } else if ((sub.frames[F].width | 0) !== (contentW | 0) || (sub.frames[F].height | 0) !== (contentH | 0)) {
      const old = sub.frames[F];
      const off = document.createElement("canvas");
      off.width = Math.max(1, contentW | 0);
      off.height = Math.max(1, contentH | 0);
      const ctx = off.getContext("2d");
      if (ctx && old) {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, off.width, off.height);
          ctx.drawImage(old, 0, 0, old.width || 1, old.height || 1, 0, 0, off.width, off.height);
      }
      off._hasContent = !!old?._hasContent;
      sub.frames[F] = off;
  }
  return sub.frames[F];
}

function syncAllLayerCanvasSizesToContent() {
    const targetW = Math.max(1, contentW | 0);
    const targetH = Math.max(1, contentH | 0);
    for (let L = 0; L < LAYERS_COUNT; L++) {
        const layer = layers?.[L];
        if (!layer?.sublayers) continue;
        for (const [key, sub] of layer.sublayers.entries()) {
            if (!sub?.frames) continue;
            for (let F = 0; F < sub.frames.length; F++) {
                const old = sub.frames[F];
                if (!old) continue;
                if ((old.width | 0) === targetW && (old.height | 0) === targetH) continue;
                const off = document.createElement("canvas");
                off.width = targetW;
                off.height = targetH;
                const ctx = off.getContext("2d");
                if (ctx) {
                    ctx.setTransform(1, 0, 0, 1, 0, 0);
                    ctx.clearRect(0, 0, targetW, targetH);
                    ctx.drawImage(old, 0, 0, old.width || 1, old.height || 1, 0, 0, targetW, targetH);
                }
                off._hasContent = !!old._hasContent;
                sub.frames[F] = off;
            }
            layer.sublayers.set(key, sub);
        }
    }
}

function ensureSublayer(L, colorStr) {
  const hex = swatchColorKey(colorStr);
  const layer = layers[L];
  if (!layer) return null;
  if (!layer.sublayers) layer.sublayers = new Map;
  if (!layer.suborder) layer.suborder = [];
  let sub = layer.sublayers.get(hex);
  if (!sub) {
      sub = {
          color: hex,
          frames: new Array(totalFrames).fill(null)
      };
      layer.sublayers.set(hex, sub);
      if (!layer.suborder.includes(hex)) layer.suborder.push(hex);
      if (layer.suborder.length > 1) {
          const seen = new Set;
          layer.suborder = layer.suborder.filter(k => {
              if (seen.has(k)) return false;
              seen.add(k);
              return true;
          });
      }
      if (Array.isArray(activeSubColor)) activeSubColor[L] = activeSubColor[L] || hex;
      try {
          normalizeLayerSwatchKeys(layer);
      } catch {}
      try {
          renderLayerSwatches(L);
      } catch {}
  } else {
      if (sub.frames.length < totalFrames) {
          const oldLen = sub.frames.length;
          sub.frames.length = totalFrames;
          for (let i = oldLen; i < totalFrames; i++) sub.frames[i] = null;
      }
      if (layer.suborder.includes(hex)) {
          const seen = new Set;
          layer.suborder = layer.suborder.filter(k => {
              if (seen.has(k)) return false;
              seen.add(k);
              return true;
          });
      } else {
          layer.suborder.push(hex);
      }
      if (!layer.sublayers.has(hex)) {
          for (const [k, sw] of Array.from(layer.sublayers.entries())) {
              const ck = swatchColorKey(k);
              if (ck === hex && k !== hex) {
                  layer.sublayers.delete(k);
                  layer.sublayers.set(hex, sw);
                  break;
              }
          }
      }
  }
  return sub;
}

function renderPaperSwatch() {
  const host = document.getElementById("swatches-paper");
  if (!host) return;
  host.innerHTML = "";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "layerSwatchBtn" + (activeLayer === PAPER_LAYER ? " active" : "");
  btn.style.background = canvasBgColor;
  btn.title = `PAPER: ${String(canvasBgColor || "").toUpperCase()}`;
  btn.addEventListener("pointerdown", e => {
      e.preventDefault();
      e.stopPropagation();
  }, {
      passive: false
  });
  btn.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
      const startHex = normalizeToHex(canvasBgColor);
      requestAnimationFrame(() => {
          openColorPickerAtElement(btn, startHex, hex => {
              setCanvasBgColor(hex);
          });
      });
  });
  host.appendChild(btn);
}

function renderLayerSwatches(onlyLayer = null) {
  renderPaperSwatch();
  if (onlyLayer != null) {
      const n = Number(onlyLayer);
      if (Number.isFinite(n)) onlyLayer = n;
  }
  const todo = onlyLayer === null ? mainLayerOrder.slice() : [ onlyLayer ];
  for (const L of todo) {
      const host = document.getElementById(swatchContainerIdForLayer(L));
      if (!host) continue;
      host.innerHTML = "";
      const layer = layers[L];
      if (!layer) continue;
      if (!layer.sublayers) layer.sublayers = new Map;
      if (!layer.suborder) layer.suborder = [];
      normalizeLayerSwatchKeys(layer);
      const getSw = k => layer.sublayers.get(k) || null;
      const hasKids = sw => !!(sw && Array.isArray(sw.children) && sw.children.length);
      function makeBtn(key, depth, hiddenByFolder) {
          const swObj = getSw(key);
          const btn = document.createElement("button");
          btn.type = "button";
          const isSelected = activeSubColor?.[L] === key;
          btn.className = "layerSwatchBtn" + (isSelected ? " active" : "");
          if (isSelected && activeLayer === L) btn.classList.add("activeOnActiveLayer");
          if (depth > 0) btn.classList.add("isChild");
          if (hiddenByFolder) btn.classList.add("hiddenByFolder");
          if (hasKids(swObj)) btn.classList.add("hasKids");
          btn.style.background = key;
          if (depth > 0) btn.style.marginLeft = `${depth * 14}px`;
          btn.draggable = false;
          btn.dataset.layerId = String(L);
          btn.dataset.swatchKey = String(key);
          btn.dataset.key = String(key);
          const pKey = swObj?.parentKey;
          btn.title = depth > 0 && pKey ? `${key} (paired under ${pKey})` : key;
          if (hasKids(swObj)) {
              const caret = document.createElement("span");
              caret.className = "swatchCaret";
              caret.textContent = swObj.collapsed ? "▸" : "▾";
              caret.addEventListener("click", e => {
                  e.preventDefault();
                  e.stopPropagation();
                  swObj.collapsed = !swObj.collapsed;
                  renderLayerSwatches(L);
              });
              btn.appendChild(caret);
          }
          const readKey = () => swatchColorKey(String(btn.dataset.key || btn.dataset.swatchKey || key || ""));
          btn.addEventListener("click", e => {
              if (btn._skipClickOnce) {
                  btn._skipClickOnce = false;
                  return;
              }
              e.preventDefault();
              e.stopPropagation();
              const k = swatchColorKey(readKey());
              syncActiveLayerColorUI({
                  layer: L,
                  color: k,
                  remember: true,
                  redrawSwatches: true,
                  updateHud: true
              });
          });
          btn.addEventListener("contextmenu", e => {
              e.preventDefault();
              e.stopPropagation();
              openSwatchContextMenu(L, readKey(), e);
          }, {
              passive: false
          });
          host.appendChild(btn);
          return btn;
      }
      function renderTree(key, depth, ancestorCollapsed) {
          const swObj = getSw(key);
          if (!swObj) return;
          const hiddenByFolder = !!ancestorCollapsed;
          makeBtn(key, depth, hiddenByFolder);
          const kids = Array.isArray(swObj.children) ? swObj.children : [];
          const nextAncestorCollapsed = ancestorCollapsed || !!swObj.collapsed;
          for (const ck of kids) {
              if (!getSw(ck)) continue;
              renderTree(ck, depth + 1, nextAncestorCollapsed);
          }
      }
      for (const key of layer.suborder) {
          const swObj = getSw(key);
          if (!swObj) continue;
          if (swObj.parentKey) continue;
          renderTree(key, 0, false);
      }
      wireSwatchPointerDnD(host);
  }
}

function setCanvasBgColor(next) {
  canvasBgColor = normalizeToHex(next || canvasBgColor || "#bfbfbf");
  if (bgColorInput) bgColorInput.value = canvasBgColor;
  renderPaperSwatch();
}

function _canvasHasAnyAlpha(c) {
    try {
        const ctx = c.getContext("2d", {
            willReadFrequently: true
        });
        const data = ctx.getImageData(0, 0, contentW, contentH).data;
        for (let i = 3; i < data.length; i += 4) {
            if (data[i] > 0) return true;
        }
    } catch {}
    return false;
}
function _sublayerHasAnyContentAccurate(sub) {
    if (!sub || !Array.isArray(sub.frames)) return false;
    for (let f = 0; f < sub.frames.length; f++) {
        const c = sub.frames[f];
        if (!c) continue;
        if (c._hasContent) {
            if (_canvasHasAnyAlpha(c)) {
                c._hasContent = true;
                return true;
            }
            c._hasContent = false;
        }
    }
    return false;
}

function pruneUnusedSublayers(L) {
    if (L === PAPER_LAYER) return false;
    const layer = layers[L];
    if (!layer) return false;
    if (!layer.sublayers) layer.sublayers = new Map;
    if (!Array.isArray(layer.suborder)) layer.suborder = [];
    let removedAny = false;
    for (let i = layer.suborder.length - 1; i >= 0; i--) {
        const key = layer.suborder[i];
        const sub = layer.sublayers.get(key);
        const keep = _sublayerHasAnyContentAccurate(sub);
        if (!keep) {
            layer.sublayers.delete(key);
            layer.suborder.splice(i, 1);
            removedAny = true;
            try {
                for (const hk of historyMap.keys()) {
                    if (hk.startsWith(`${L}:`) && hk.endsWith(`:${key}`)) historyMap.delete(hk);
                }
            } catch {}
        }
    }
    if (!removedAny) return false;
    const curKey = activeSubColor?.[L];
    if (curKey && !layer.sublayers.has(curKey)) {
        activeSubColor[L] = layer.suborder[layer.suborder.length - 1] || (L === LAYER.FILL ? fillWhite : "#000000");
    }
    if (L === activeLayer) {
        const k = activeSubColor?.[L];
        if (k && layer.sublayers.has(k)) {
            currentColor = k;
            try {
                setColorSwatch?.();
            } catch {}
            try {
                setHSVPreviewBox?.();
            } catch {}
        }
    }
    try {
        normalizeLayerSwatchKeys(layer);
    } catch {}
    try {
        renderLayerSwatches(L);
    } catch {}
    return true;
}


// lookup funcs

function swatchContainerIdForLayer(L) {
  if (L === PAPER_LAYER) return "swatches-paper";
  if (L === LAYER.SKETCH) return "swatches-sketch";
  if (L === LAYER.LINE) return "swatches-line";
  if (L === LAYER.SHADE) return "swatches-shade";
  if (L === LAYER.COLOR) return "swatches-color";
  return "swatches-fill";
}
function layerRadioIdForLayer(L) {
  if (L === PAPER_LAYER) return "bt-paper";
  if (L === LAYER.SKETCH) return "bt-sketch-layer";
  if (L === LAYER.LINE) return "bt-line";
  if (L === LAYER.SHADE) return "bt-color";
  if (L === LAYER.COLOR) return "bt-sketch";
  return "bt-fill";
}

function layerFromValue(val) {
  if (val === "paper") return PAPER_LAYER;
  if (val === "sketch") return LAYER.SKETCH;
  if (val === "line") return LAYER.LINE;
  if (val === "shade") return LAYER.SHADE;
  if (val === "color") return LAYER.COLOR;
  if (val === "fill") return LAYER.FILL;
  return LAYER.LINE;
}

function setLayerRadioChecked(L) {
  const id = layerRadioIdForLayer(L);
  const r = document.getElementById(id);
  if (r) r.checked = true;
}

function mainLayerHasContent(L, F) {
    const layer = layers[L];
    if (!layer || !layer.suborder || !layer.sublayers) return false;
    for (const key of layer.suborder) {
        const sub = layer.sublayers.get(key);
        const off = sub?.frames?.[F];
        if (off && off._hasContent) return true;
    }
    return false;
}

function setLayerVisibility(L, vis) {
    const now = !!vis;
    const cur = layers[L].opacity ?? 1;
    if (!now) {
        if (cur > 0) layers[L].prevOpacity = cur;
        layers[L].opacity = 0;
    } else {
        layers[L].opacity = layers[L].prevOpacity > 0 ? layers[L].prevOpacity : 1;
    }
    queueRenderAll();
    updateVisBtn(L);
}
function setLayerOpacity(L, a) {
    const v = Math.max(0, Math.min(1, Number(a) || 0));
    layers[L].opacity = v;
    if (v > 0) layers[L].prevOpacity = v;
    queueRenderAll();
    updateVisBtn(L);
}

///////////
// MENUS //
///////////
let _layerOpMenu = null;
let _layerOpState = null;
function ensureLayerOpacityMenu() {
    if (_layerOpMenu) return _layerOpMenu;
    const m = document.createElement("div");
    m.id = "layerOpacityMenu";
    m.hidden = true;
    m.innerHTML = `\n        <div class="lom-title" id="lomTitle">Layer opacity</div>\n        <input id="lomRange" type="range" min="0" max="100" step="1" value="100" />\n        <div class="lom-row">\n          <span class="lom-val" id="lomVal">100%</span>\n          <button type="button" class="lom-reset" id="lomReset">Reset</button>\n        </div>\n      `;
    const range = m.querySelector("#lomRange");
    const val = m.querySelector("#lomVal");
    const reset = m.querySelector("#lomReset");
    function applyFromRange() {
        const st = _layerOpState;
        if (!st) return;
        const pct = Number(range.value) || 0;
        val.textContent = `${pct}%`;
        setLayerOpacity(st.L, pct / 100);
    }
    range.addEventListener("input", applyFromRange);
    range.addEventListener("change", applyFromRange);
    reset.addEventListener("click", e => {
        e.preventDefault();
        e.stopPropagation();
        range.value = "100";
        applyFromRange();
    });
    document.addEventListener("mousedown", e => {
        if (m.hidden) return;
        if (e.target === m || m.contains(e.target)) return;
        closeLayerOpacityMenu();
    }, true);
    document.addEventListener("keydown", e => {
        if (e.key === "Escape") closeLayerOpacityMenu();
    });
    window.addEventListener("blur", closeLayerOpacityMenu);
    document.body.appendChild(m);
    _layerOpMenu = m;
    return m;
}
function openLayerOpacityMenu(L, ev) {
    if (L === PAPER_LAYER) return;
    if (!layers?.[L]) return;
    const m = ensureLayerOpacityMenu();
    _layerOpState = {
        L: L
    };
    const title = m.querySelector("#lomTitle");
    const range = m.querySelector("#lomRange");
    const val = m.querySelector("#lomVal");
    const name = layers[L]?.name || `Layer ${L}`;
    const pct = Math.round((layers[L]?.opacity ?? 1) * 100);
    if (title) title.textContent = `${name} opacity`;
    if (range) range.value = String(Math.max(0, Math.min(100, pct)));
    if (val) val.textContent = `${Math.max(0, Math.min(100, pct))}%`;
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
        range?.focus({
            preventScroll: true
        });
    } catch {}
}
function closeLayerOpacityMenu() {
    if (_layerOpMenu) _layerOpMenu.hidden = true;
    _layerOpState = null;
}

let _layerRowMenu = null;
let _layerRowState = null;
function ensureLayerRowMenu() {
    if (_layerRowMenu) return _layerRowMenu;
    const m = document.createElement("div");
    m.id = "layerRowMenu";
    m.hidden = true;
    m.innerHTML = `\n        <button type="button" class="lrm-btn" data-act="opacity">Opacity…</button>\n        <div class="lrm-sep" role="separator"></div>\n        <button type="button" class="lrm-btn" data-act="blend" data-blend="normal">Blend: Normal</button>\n        <button type="button" class="lrm-btn" data-act="blend" data-blend="multiply">Blend: Multiply</button>\n        <button type="button" class="lrm-btn" data-act="blend" data-blend="overlay">Blend: Overlay</button>\n      `;
    m.addEventListener("click", e => {
        const b = e.target.closest("button[data-act]");
        if (!b) return;
        const act = b.dataset.act;
        const st = _layerRowState;
        closeLayerRowMenu();
        if (!st) return;
        const L = st.L;
        if (act === "opacity") {
            openLayerOpacityMenu(L, st.anchorEvLike);
            return;
        }
        if (act === "blend") {
            setLayerBlendMode(L, b.dataset.blend || "normal");
            return;
        }
    });
    document.addEventListener("mousedown", e => {
        if (m.hidden) return;
        if (e.target === m || m.contains(e.target)) return;
        closeLayerRowMenu();
    }, true);
    document.addEventListener("keydown", e => {
        if (e.key === "Escape") closeLayerRowMenu();
    });
    window.addEventListener("blur", closeLayerRowMenu);
    document.body.appendChild(m);
    _layerRowMenu = m;
    return m;
}
function openLayerRowMenu(L, ev) {
    if (L === PAPER_LAYER) return;
    if (!layers?.[L]) return;
    const m = ensureLayerRowMenu();
    const anchorEvLike = {
        clientX: ev?.clientX ?? 0,
        clientY: ev?.clientY ?? 0
    };
    _layerRowState = {
        L: L,
        anchorEvLike: anchorEvLike
    };
    const blendMode = getLayerBlendMode(L);
    const blendBtns = m.querySelectorAll("button[data-act='blend']");
    blendBtns.forEach(btn => {
        const isActive = btn.dataset.blend === blendMode;
        btn.classList.toggle("is-active", isActive);
    });
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
}
function closeLayerRowMenu() {
    if (_layerRowMenu) _layerRowMenu.hidden = true;
    _layerRowState = null;
}

const visBtnByLayer = new Map;
function layerIsHidden(L) {
    if (L === PAPER_LAYER) return false;
    return (layers[L]?.opacity ?? 1) <= 0;
}
function updateVisBtn(L) {
    const btn = visBtnByLayer.get(L);
    if (!btn) return;
    const hidden = layerIsHidden(L);
    btn.classList.toggle("is-hidden", hidden);
    btn.textContent = hidden ? "🙈" : "👁";
    btn.title = hidden ? "Show layer" : "Hide layer";
    btn.setAttribute("aria-pressed", hidden ? "true" : "false");
}
function getLayerRowElements(L) {
    const id = layerRadioIdForLayer(L);
    const input = $(id);
    const label = input ? input.closest("label") || document.querySelector(`label[for="${id}"]`) || input.parentElement : null;
    return {
        input: input,
        label: label
    };
}
function applyLayerSegOrder() {
    const seg = $("layerSeg");
    if (!seg) return;
    const topToBottom = mainLayersTopToBottom();
    const ordered = topToBottom.concat(PAPER_LAYER);
    for (const L of ordered) {
        const row = getLayerRowElements(L);
        if (!row?.input || !row?.label) continue;
        seg.appendChild(row.input);
        seg.appendChild(row.label);
    }
}
function injectVisBtn(radioId, L) {
    const input = $(radioId);
    if (!input) return;
    const label = input.closest("label") || document.querySelector(`label[for="${radioId}"]`) || input.parentElement;
    if (!label) return;
    const existing = label.querySelector(".visBtn");
    if (existing) {
        label.dataset.layerRow = String(L);
        visBtnByLayer.set(L, existing);
        updateVisBtn(L);
        return;
    }
    if (L === PAPER_LAYER) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "visBtn";
    btn.dataset.layer = String(L);
    btn.addEventListener("click", e => {
        e.preventDefault();
        e.stopPropagation();
        const wasHidden = layerIsHidden(L);
        setLayerVisibility(L, wasHidden);
        updateVisBtn(L);
    });
    label.insertBefore(btn, label.firstChild);
    label.dataset.layerRow = String(L);
    if (!label._opacityCtxWired) {
        label._opacityCtxWired = true;
        label.addEventListener("contextmenu", e => {
            e.preventDefault();
            e.stopPropagation();
            openLayerRowMenu(L, e);
        }, {
            passive: false
        });
    }
    visBtnByLayer.set(L, btn);
    updateVisBtn(L);
}

function wireLayerVisButtons() {
    applyLayerSegOrder();
    injectVisBtn("bt-paper", PAPER_LAYER);
    injectVisBtn("bt-fill", LAYER.FILL);
    injectVisBtn("bt-sketch", LAYER.COLOR);
    injectVisBtn("bt-color", LAYER.SHADE);
    injectVisBtn("bt-line", LAYER.LINE);
    injectVisBtn("bt-sketch-layer", LAYER.SKETCH);
    updateVisBtn(LAYER.FILL);
    updateVisBtn(LAYER.COLOR);
    updateVisBtn(LAYER.SHADE);
    updateVisBtn(LAYER.LINE);
    updateVisBtn(LAYER.SKETCH);
}
