let _swatchCtxMenu = null;
let _swatchCtxState = null;
let _swatchColorPicker = null;

function openSwatchContextMenu(L, key, ev) {
  try {
      ev.preventDefault();
  } catch {}
  try {
      ev.stopPropagation();
  } catch {}
  const layerId = Number(L);
  const layerObj = Number.isFinite(layerId) ? layers?.[layerId] : L;
  const m = ensureSwatchCtxMenu();
  _swatchCtxState = {
      layerId: layerId,
      layerObj: layerObj,
      key: key,
      btn: ev.currentTarget || null
  };
  m.hidden = false;
  m.style.left = "0px";
  m.style.top = "0px";
  const pad = 6;
  const vw = window.innerWidth, vh = window.innerHeight;
  const r = m.getBoundingClientRect();
  let x = ev.clientX + 6;
  let y = ev.clientY + 6;
  if (x + r.width + pad > vw) x = Math.max(pad, vw - r.width - pad);
  if (y + r.height + pad > vh) y = Math.max(pad, vh - r.height - pad);
  m.style.left = `${x}px`;
  m.style.top = `${y}px`;
}

function closeSwatchContextMenu() {
  if (_swatchCtxMenu) _swatchCtxMenu.hidden = true;
  _swatchCtxState = null;
}

function cancelSwatchPreview(layerId, key) {
  const job = _swatchPreviewJobs.get(_swPrevKey(layerId, key));
  if (!job) return;
  job.token++;
  job.pendingHex = null;
}
function queueSwatchRecolorPreview(layerId, key, hex) {
  const k = _swPrevKey(layerId, key);
  let job = _swatchPreviewJobs.get(k);
  if (!job) {
      job = {
          running: false,
          pendingHex: null,
          token: 0,
          canvases: null
      };
      _swatchPreviewJobs.set(k, job);
  }
  job.pendingHex = normHex6(hex);
  job.token++;
  if (job.running) return;
  job.running = true;
  (async () => {
      while (job.pendingHex) {
          const nextHex = job.pendingHex;
          job.pendingHex = null;
          const myToken = job.token;
          await async function applyPreviewOnce() {
              const L = layers?.[layerId];
              if (!L) return;
              const newHex = normHex6(nextHex);
              if (!newHex) return;
              const rgb = swatchHexToRgb(newHex);
              if (!rgb) return;
              const canvases = job.canvases || (job.canvases = collectCanvasesForLayerSwatch(L, key));
              for (let i = 0; i < canvases.length; i++) {
                  if (job.token !== myToken) return;
                  recolorCanvasAllNonTransparent(canvases[i], rgb);
                  if (i % 2 === 1) await sleep(0);
              }
              if (_swatchCtxState?.btn) {
                  _swatchCtxState.btn.style.background = newHex;
                  _swatchCtxState.btn.style.borderColor = newHex;
                  _swatchCtxState.btn.dataset.hex = newHex;
              }
              try {
                  requestRender?.();
              } catch {}
              try {
                  requestRedraw?.();
              } catch {}
              try {
                  redraw?.();
              } catch {}
              try {
                  render?.();
              } catch {}
              try {
                  queueRenderAll?.();
              } catch {}
          }();
      }
      job.running = false;
  })();
}

async function applySwatchRecolor(layerId, key, newHex) {
  const L = layers?.[layerId];
  if (!L) return;
  newHex = normHex6(newHex);
  if (!newHex) return;
  const rgb = swatchHexToRgb(newHex);
  if (!rgb) return;
  const canvases = collectCanvasesForLayerSwatch(L, key);
  for (let i = 0; i < canvases.length; i++) {
      recolorCanvasAllNonTransparent(canvases[i], rgb);
      if (i % 2 === 1) await sleep(0);
  }
  const newKey = setSwatchHex(L, key, newHex) || key;
  try {
      if (activeSubColor?.[layerId] === key) activeSubColor[layerId] = newKey;
      if (currentColor === key) currentColor = newKey;
  } catch {}
  try {
      if (L?.activeSwatchKey === key) L.activeSwatchKey = newKey;
      if (L?.selectedSwatchKey === key) L.selectedSwatchKey = newKey;
      if (typeof state === "object" && state) {
          if (state.activeSwatchKey === key) state.activeSwatchKey = newKey;
          if (state.activeColorKey === key) state.activeColorKey = newKey;
          if (state.activeSwatchKeyByLayer && L?.id && state.activeSwatchKeyByLayer[L.id] === key) state.activeSwatchKeyByLayer[L.id] = newKey;
      }
  } catch {}
  if (_swatchCtxState?.btn) {
      _swatchCtxState.btn.style.background = newHex;
      _swatchCtxState.btn.style.borderColor = newHex;
      _swatchCtxState.btn.dataset.swatchKey = newKey;
      _swatchCtxState.btn.dataset.hex = newHex;
  }
  try {
      requestRender?.();
  } catch {}
  try {
      requestRedraw?.();
  } catch {}
  try {
      redraw?.();
  } catch {}
  try {
      render?.();
  } catch {}
  try {
      renderLayerSwatches(layerId);
  } catch {}
  try {
      // queueRenderAll();
  } catch {}
}
const _swatchPreviewJobs = new Map;
function _swPrevKey(layerId, key) {
  return `${layerId}::${key}`;
}

function ensureSwatchCtxMenu() {
  if (_swatchCtxMenu) return _swatchCtxMenu;
  const m = document.createElement("div");
  m.id = "swatchCtxMenu";
  m.hidden = true;
  m.innerHTML = `\n        <button type="button" data-act="change">Change color…</button>\n      `;
  m.addEventListener("click", e => {
      const btn = e.target.closest("button[data-act]");
      if (!btn) return;
      const act = btn.dataset.act;
      const st = _swatchCtxState;
      closeSwatchContextMenu();
      if (!st) return;
      if (act === "change") {
          let curHex = null;
          const sw = getSwatchObj(st.layerObj, st.key);
          curHex = normHex6(sw?.hex || sw?.color || sw?.col || (isHexColor(st.key) ? st.key : null)) || "#FFFFFF";
          const startHex = curHex;
          pickColorLiveOnce(startHex, {
              onLive: hex => {
                  queueSwatchRecolorPreview(st.layerId, st.key, hex);
              },
              onCommit: hex => {
                  cancelSwatchPreview(st.layerId, st.key);
                  applySwatchRecolor(st.layerId, st.key, hex);
              },
              onCancel: () => {
                  cancelSwatchPreview(st.layerId, st.key);
                  queueSwatchRecolorPreview(st.layerId, st.key, startHex);
              }
          });
      }
  });
  document.addEventListener("mousedown", e => {
      if (!_swatchCtxMenu || _swatchCtxMenu.hidden) return;
      if (e.target === _swatchCtxMenu || _swatchCtxMenu.contains(e.target)) return;
      closeSwatchContextMenu();
  }, true);
  document.addEventListener("keydown", e => {
      if (e.key === "Escape") closeSwatchContextMenu();
  });
  window.addEventListener("blur", closeSwatchContextMenu);
  document.body.appendChild(m);
  _swatchCtxMenu = m;
  return m;
}

function pickColorLiveOnce(startHex, {onLive: onLive, onCommit: onCommit, onCancel: onCancel} = {}) {
  const inp = document.createElement("input");
  inp.type = "color";
  const safe = typeof startHex === "string" && /^#[0-9a-fA-F]{6}$/.test(startHex) ? startHex : "#000000";
  inp.value = safe;
  inp.style.position = "fixed";
  inp.style.left = "-9999px";
  inp.style.top = "0";
  inp.style.opacity = "0";
  inp.style.pointerEvents = "none";
  document.body.appendChild(inp);
  let committed = false;
  const start = inp.value;
  const safeLive = hex => {
      try {
          onLive?.(hex);
      } catch {}
  };
  const safeCommit = hex => {
      try {
          (onCommit || onLive)?.(hex);
      } catch {}
  };
  const safeCancel = () => {
      try {
          onCancel?.();
      } catch {}
  };
  const cleanup = () => {
      inp.removeEventListener("input", onInput);
      inp.removeEventListener("change", onChange);
      window.removeEventListener("focus", onWinFocus, true);
      if (inp && inp.parentNode) inp.parentNode.removeChild(inp);
  };
  const onInput = e => {
      const hex = e?.target?.value;
      if (hex) safeLive(hex);
  };
  const onChange = e => {
      committed = true;
      const hex = e?.target?.value || inp.value || start;
      safeCommit(hex);
      cleanup();
  };
  const onWinFocus = () => {
      setTimeout(() => {
          if (committed) return;
          const v = inp.value || start;
          if (v === start) safeCancel(); else safeCommit(v);
          cleanup();
      }, 0);
  };
  inp.addEventListener("input", onInput);
  inp.addEventListener("change", onChange);
  window.addEventListener("focus", onWinFocus, true);
  try {
      inp.showPicker?.();
  } catch {}
  inp.click();
}

function setSwatchHex(L, key, newHex) {
  const sw = getSwatchObj(L, key);
  if (!sw) return;
  if ("hex" in sw) sw.hex = newHex;
  if ("color" in sw) sw.color = newHex;
  if ("col" in sw) sw.col = newHex;
  return setSwatchObjKeyIfNeeded(L, key, newHex);
}

function extractCanvas(v) {
  if (!v) return null;
  if (v instanceof HTMLCanvasElement) return v;
  if (v.canvas instanceof HTMLCanvasElement) return v.canvas;
  if (v.ctx && v.ctx.canvas instanceof HTMLCanvasElement) return v.ctx.canvas;
  return null;
}
function iterContainerValues(container, fn) {
  if (!container) return;
  if (container instanceof Map) {
      for (const v of container.values()) fn(v);
      return;
  }
  if (Array.isArray(container)) {
      for (const v of container) fn(v);
      return;
  }
  if (typeof container === "object") {
      for (const k of Object.keys(container)) fn(container[k]);
  }
}

function setSwatchObjKeyIfNeeded(layer, oldKey, newKey) {
  const col = getSwatchCollection(layer);
  if (!col) return oldKey;
  const isColorKeyMode = isHexColor(oldKey) && (col instanceof Map && col.has(oldKey) || !(col instanceof Map) && typeof col === "object" && Object.prototype.hasOwnProperty.call(col, oldKey));
  if (!isColorKeyMode) return oldKey;
  if (col instanceof Map) {
      if (col.has(newKey)) {
          alert("That swatch color already exists. Pick a different color.");
          return oldKey;
      }
  } else {
      if (Object.prototype.hasOwnProperty.call(col, newKey)) {
          alert("That swatch color already exists. Pick a different color.");
          return oldKey;
      }
  }
  let sw = null;
  if (col instanceof Map) {
      sw = col.get(oldKey);
      col.delete(oldKey);
      col.set(newKey, sw);
  } else {
      sw = col[oldKey];
      delete col[oldKey];
      col[newKey] = sw;
  }
  if (Array.isArray(layer.suborder)) {
      for (let i = 0; i < layer.suborder.length; i++) {
          if (layer.suborder[i] === oldKey) layer.suborder[i] = newKey;
      }
  }
  const vals = col instanceof Map ? Array.from(col.values()) : Object.values(col);
  for (const s of vals) {
      if (!s) continue;
      if (s.parentKey === oldKey) s.parentKey = newKey;
      if (Array.isArray(s.children)) {
          for (let i = 0; i < s.children.length; i++) {
              if (s.children[i] === oldKey) s.children[i] = newKey;
          }
      }
  }
  return newKey;
}

function isHexColor(s) {
  return typeof s === "string" && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s.trim());
}

function getSwatchCollection(L) {
  return L?.swatches || L?.sublayers || L?.subLayers || L?.colors || L?.colorSwatches || null;
}
function getSwatchObj(L, key) {
  const col = getSwatchCollection(L);
  if (!col) return null;
  if (col instanceof Map) return col.get(key) ?? null;
  if (typeof col === "object") return col[key] ?? null;
  return null;
}

function recolorCanvasAllNonTransparent(canvas, rgb) {
  const w = canvas.width | 0, h = canvas.height | 0;
  if (!w || !h) return;
  const ctx = canvas.getContext("2d", {
      willReadFrequently: true
  });
  if (!ctx) return;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
      const a = d[i + 3];
      if (a === 0) continue;
      d[i] = rgb.r;
      d[i + 1] = rgb.g;
      d[i + 2] = rgb.b;
  }
  ctx.putImageData(img, 0, 0);
} 

function collectCanvasesForLayerSwatch(L, key) {
  const out = [];
  const seen = new Set;
  function pushCanvas(c) {
      if (!c) return;
      if (seen.has(c)) return;
      seen.add(c);
      out.push(c);
  }
  const sw = getSwatchObj(L, key);
  if (sw) {
      pushCanvas(extractCanvas(sw));
      iterContainerValues(sw.cels, v => pushCanvas(extractCanvas(v) || extractCanvas(v?.canvas) || extractCanvas(v?.ctx)));
      iterContainerValues(sw.frames, v => pushCanvas(extractCanvas(v) || extractCanvas(v?.canvas) || extractCanvas(v?.ctx)));
      iterContainerValues(sw.cells, v => pushCanvas(extractCanvas(v) || extractCanvas(v?.canvas) || extractCanvas(v?.ctx)));
      iterContainerValues(sw.cels, v => pushCanvas(extractCanvas(v?.canvas)));
      iterContainerValues(sw.frames, v => pushCanvas(extractCanvas(v?.canvas)));
      iterContainerValues(sw.cells, v => pushCanvas(extractCanvas(v?.canvas)));
  }
  const layerContainers = [ L?.cels, L?.frames, L?.cells, L?.celByFrame, L?.frameMap ];
  for (const cont of layerContainers) {
      iterContainerValues(cont, celEntry => {
          if (!celEntry) return;
          const a = celEntry.swatches || celEntry.sublayers || celEntry.subLayers || celEntry.colors || null;
          if (a) {
              if (a instanceof Map) {
                  pushCanvas(extractCanvas(a.get(key)));
              } else if (typeof a === "object") {
                  pushCanvas(extractCanvas(a[key]));
              }
          }
          if (typeof celEntry === "object" && key in celEntry) {
              pushCanvas(extractCanvas(celEntry[key]));
          }
          pushCanvas(extractCanvas(celEntry));
          pushCanvas(extractCanvas(celEntry?.canvas));
          pushCanvas(extractCanvas(celEntry?.ctx));
      });
  }
  return out;
}

function wireSwatchPointerDnD(host) {
  if (!host || host._swatchPtrDnDWired) return;
  host._swatchPtrDnDWired = true;
  const THRESH = 4;
  function layerRowInfoFromEl(el) {
      const row = el?.closest?.("[data-layer-row]") || null;
      if (!row) return null;
      const L = Number(row.dataset.layerRow);
      if (!Number.isFinite(L) || L === PAPER_LAYER) return null;
      return {
          row: row,
          L: L
      };
  }
  function cleanup() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
  }
  function clearHoverTarget() {
      if (_swatchPtrDrag?.hoverBtn) {
          _swatchPtrDrag.hoverBtn.classList.remove("swatchDropTarget");
          _swatchPtrDrag.hoverBtn = null;
      }
  }
  function clearHoverLayerRow() {
      if (_swatchPtrDrag?.hoverRowEl) {
          _swatchPtrDrag.hoverRowEl.classList.remove("swatchLayerDropTarget");
          _swatchPtrDrag.hoverRowEl = null;
          _swatchPtrDrag.overRowLayer = null;
      }
  }
  function onMove(e) {
      const d = _swatchPtrDrag;
      if (!d || e.pointerId !== d.pointerId) return;
      const dx = Math.abs(e.clientX - d.startX);
      const dy = Math.abs(e.clientY - d.startY);
      if (!d.moved) {
          if (dx + dy < THRESH) return;
          d.moved = true;
          d.btn._skipClickOnce = true;
          d.btn.classList.add("swatchDragging");
          document.body.classList.add("swatch-reordering");
      }
      clearHoverTarget();
      clearHoverLayerRow();
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const overHost = el?.closest?.('[id^="swatches-"]') || null;
      if (overHost && overHost.id === "swatches-paper") {
          e.preventDefault();
          return;
      }
      if (!overHost) {
          const info = layerRowInfoFromEl(el);
          if (info) {
              if (String(info.L) !== String(d.srcLayer)) {
                  info.row.classList.add("swatchLayerDropTarget");
                  d.hoverRowEl = info.row;
                  d.overRowLayer = info.L;
              }
          }
          e.preventDefault();
          return;
      }
      d.overHost = overHost;
      const btns = Array.from(overHost.querySelectorAll(".layerSwatchBtn"));
      let insertBefore = null;
      for (const b of btns) {
          if (b === d.btn) continue;
          const r = b.getBoundingClientRect();
          const mid = r.left + r.width / 2;
          if (e.clientX < mid) {
              insertBefore = b;
              break;
          }
      }
      if (insertBefore) {
          if (d.btn.nextSibling !== insertBefore) overHost.insertBefore(d.btn, insertBefore);
      } else {
          if (overHost.lastElementChild !== d.btn) overHost.appendChild(d.btn);
      }
      const overBtn = el?.closest?.(".layerSwatchBtn");
      if (overBtn && overBtn !== d.btn) {
          overBtn.classList.add("swatchDropTarget");
          d.hoverBtn = overBtn;
      }
      e.preventDefault();
  }
  function onUp(e) {
      const d = _swatchPtrDrag;
      if (!d || e.pointerId !== d.pointerId) return;
      try {
          d.btn.releasePointerCapture(e.pointerId);
      } catch {}
      clearHoverTarget();
      clearHoverLayerRow();
      if (d.moved) {
          d.btn.classList.remove("swatchDragging");
          document.body.classList.remove("swatch-reordering");
          const el = document.elementFromPoint(e.clientX, e.clientY);
          const overHost = el?.closest?.('[id^="swatches-"]') || null;
          const rowInfo = layerRowInfoFromEl(el);
          const srcL = Number(d.srcLayer);
          const srcKey = d.srcKey;
          const dstLayerFromHost = overHost ? _swatchHostLayer(overHost) : null;
          const dstLayer = dstLayerFromHost != null ? dstLayerFromHost : d.overRowLayer != null ? Number(d.overRowLayer) : rowInfo?.L != null ? Number(rowInfo.L) : null;
          const overBtn = el?.closest?.(".layerSwatchBtn");
          const overBtnLayer = overBtn ? Number(overBtn.dataset.layerId) : null;
          if (overBtn && overBtn !== d.btn && Number.isFinite(overBtnLayer)) {
              const dstL = overBtnLayer;
              const dstParentKey = String(overBtn.dataset.key || "");
              const allowSameLayerPair = !!e.shiftKey;
              if (String(dstL) !== String(srcL) || allowSameLayerPair) {
                  pairSwatchAcrossLayers(srcL, srcKey, dstL, dstParentKey);
                  _swatchPtrDrag = null;
                  cleanup();
                  return;
              }
          }
          if (dstLayer != null && String(dstLayer) !== String(srcL)) {
              const ok = moveSwatchToLayerUnpaired(srcL, srcKey, dstLayer);
              if (!ok) {
                  try {
                      renderLayerSwatches(srcL);
                  } catch {}
                  try {
                      renderLayerSwatches(dstLayer);
                  } catch {}
              }
              _swatchPtrDrag = null;
              cleanup();
              return;
          }
          if (dstLayer != null) {
              const hostToCommit = overHost || d.srcHost;
              commitSwatchOrderFromDOM(hostToCommit, dstLayer);
          } else {
              renderLayerSwatches(srcL);
          }
          e.preventDefault();
      }
      _swatchPtrDrag = null;
      cleanup();
  }
  host.addEventListener("pointerdown", e => {
      const btn = e.target.closest(".layerSwatchBtn");
      if (!btn || !host.contains(btn)) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (e.target.closest(".swatchCaret")) return;
      const srcLayer = Number(btn.dataset.layerId);
      const srcKey = String(btn.dataset.key || "");
      if (!Number.isFinite(srcLayer) || !srcKey) return;
      _swatchPtrDrag = {
          pointerId: e.pointerId,
          btn: btn,
          srcHost: host,
          overHost: host,
          srcLayer: srcLayer,
          srcKey: srcKey,
          startX: e.clientX,
          startY: e.clientY,
          moved: false,
          hoverBtn: null,
          hoverRowEl: null,
          overRowLayer: null
      };
      try {
          btn.setPointerCapture(e.pointerId);
      } catch {}
      window.addEventListener("pointermove", onMove, {
          passive: false
      });
      window.addEventListener("pointerup", onUp, {
          passive: false
      });
      window.addEventListener("pointercancel", onUp, {
          passive: false
      });
  }, {
      passive: false
  });
}

let _paperColorPicker = null;

function commitSwatchOrderFromDOM(host, L) {
    const layer = layers?.[L];
    if (!layer) return;
    const btns = Array.from(host.querySelectorAll(".layerSwatchBtn"));
    const domOrder = btns.map(b => swatchColorKey((b?.dataset?.key || "").trim())).filter(Boolean);
    const seen = new Set;
    const next = [];
    for (const k of domOrder) {
        if (!seen.has(k)) {
            seen.add(k);
            next.push(k);
        }
    }
    const mapKeys = layer.sublayers ? Array.from(layer.sublayers.keys()) : [];
    for (const k of mapKeys) {
        if (!seen.has(k)) {
            seen.add(k);
            next.push(k);
        }
    }
    layer.suborder = next;
    try {
        normalizeLayerSwatchKeys(layer);
    } catch {}
    if (activeSubColor?.[L] && !layer.suborder.includes(activeSubColor[L])) {
        activeSubColor[L] = layer.suborder[0] || activeSubColor[L];
    }
    queueRenderAll();
}
let _swatchPtrDrag = null;
function _swatchHostLayer(host) {
    const id = host?.id || "";
    if (id === "swatches-sketch") return LAYER.SKETCH;
    if (id === "swatches-line") return LAYER.LINE;
    if (id === "swatches-shade") return LAYER.SHADE;
    if (id === "swatches-color") return LAYER.COLOR;
    if (id === "swatches-fill") return LAYER.FILL;
    return null;
}

let _swatchDnD = null;

function pairSwatchAcrossLayers(srcL, srcKey, dstL, dstParentKey) {
    if (srcL == null || dstL == null) return false;
    if (!srcKey || !dstParentKey) return false;
    if (String(srcL) === String(dstL) && srcKey === dstParentKey) return false;
    const srcLayer = layers[srcL];
    const dstLayer = layers[dstL];
    if (!srcLayer || !dstLayer) return false;
    const srcMap = srcLayer.sublayers;
    const dstMap = dstLayer.sublayers;
    if (!srcMap || !dstMap) return false;
    const sw = srcMap.get(srcKey);
    const parent = dstMap.get(dstParentKey);
    if (!sw || !parent) return false;
    if (sw.parentKey) {
        const oldParent = srcMap.get(sw.parentKey);
        if (oldParent && Array.isArray(oldParent.children)) {
            oldParent.children = oldParent.children.filter(k => k !== srcKey);
        }
        delete sw.parentKey;
    }
    srcMap.delete(srcKey);
    const si = srcLayer.suborder.indexOf(srcKey);
    if (si >= 0) srcLayer.suborder.splice(si, 1);
    dstMap.set(srcKey, sw);
    if (!dstLayer.suborder.includes(srcKey)) {
        dstLayer.suborder.push(srcKey);
    }
    sw.parentKey = dstParentKey;
    if (!Array.isArray(parent.children)) {
        parent.children = [];
    }
    if (!parent.children.includes(srcKey)) {
        parent.children.push(srcKey);
    }
    renderLayerSwatches(srcL);
    renderLayerSwatches(dstL);
    return true;
}

function getSwatchObj(layer, key) {
    try {
        return layer?.sublayers?.get(key) ?? null;
    } catch {
        return null;
    }
}
function detachFromParentIfAnyInLayer(layer, swKey) {
    const sw = getSwatchObj(layer, swKey);
    if (!sw || !sw.parentKey) return;
    const parent = getSwatchObj(layer, sw.parentKey);
    if (parent && Array.isArray(parent.children)) {
        parent.children = parent.children.filter(k => k !== swKey);
    }
    delete sw.parentKey;
}

function moveSwatchToLayerUnpaired(srcL, srcKey, dstL) {
    const srcLayer = layers[srcL];
    const dstLayer = layers[dstL];
    if (!srcLayer || !dstLayer) return false;
    const srcMap = srcLayer.sublayers;
    const dstMap = dstLayer.sublayers;
    if (!srcMap || !dstMap) return false;
    const sw = srcMap.get(srcKey);
    if (!sw) return false;
    const sameLayer = String(srcL) === String(dstL);
    const wasActiveOnSrc = activeLayer === srcL && String(activeSubColor?.[srcL] || "") === String(srcKey);
    detachFromParentIfAnyInLayer(srcLayer, srcKey);
    if (!sameLayer && dstMap.has(srcKey)) {
        console.warn("[Celstomp] Can't move swatch: target layer already has key:", srcKey);
        return false;
    }
    if (!sameLayer) {
        srcMap.delete(srcKey);
        const si = srcLayer.suborder.indexOf(srcKey);
        if (si >= 0) srcLayer.suborder.splice(si, 1);
        dstMap.set(srcKey, sw);
        if (!dstLayer.suborder.includes(srcKey)) dstLayer.suborder.push(srcKey);
        try {
            migrateHistoryForSwatchMove(srcL, dstL, srcKey);
        } catch {}
    } else {
        const si = srcLayer.suborder.indexOf(srcKey);
        if (si >= 0) {
            srcLayer.suborder.splice(si, 1);
            srcLayer.suborder.push(srcKey);
        }
    }
    delete sw.parentKey;
    if (!sameLayer && String(activeSubColor?.[srcL] || "") === String(srcKey)) {
        const fb = fallbackSwatchKeyForLayer(srcL);
        if (Array.isArray(activeSubColor) && fb) activeSubColor[srcL] = fb;
    }
    if (!sameLayer && wasActiveOnSrc) {
        activeLayer = dstL;
        if (Array.isArray(activeSubColor)) activeSubColor[dstL] = srcKey;
        currentColor = srcKey;
        try {
            setLayerRadioChecked(dstL);
        } catch {}
        try {
            setColorSwatch?.();
        } catch {}
        try {
            setHSVPreviewBox?.();
        } catch {}
        try {
            queueUpdateHud?.();
        } catch {}
    }
    renderLayerSwatches(srcL);
    if (!sameLayer) renderLayerSwatches(dstL);
    try {
        refreshTimelineRowHasContentAll();
    } catch {}
    try {
        queueRenderAll?.();
    } catch {}
    return true;
}

function rememberLayerColorSafe() {
  try {
      rememberCurrentColorForLayer?.(activeLayer);
  } catch {}
}

function setHSVPreviewBox() {
  $("hsvWheelPreview").style.background = currentColor ?? "#000000";
}

function setCurrentColorHex(hex, {remember: remember = true} = {}) {
  currentColor = normalizeToHex(hex);
  setColorSwatch();
  setHSVPreviewBox();
  if (remember) rememberLayerColorSafe();
  hsvPick = rgbToHsv(...Object.values(hexToRgb(currentColor)));
  drawHSVWheel();
}
function setPickerDefaultBlack() {
  setCurrentColorHex("#000000", {
      remember: true
  });
}


// palette logic
const PALETTE_KEY = "celstomp_palette_v1";
        let colorPalette = [];
        let oklchDefault = {
            L: 0,
            C: .2,
            H: 180
        };

function loadPalette() {
  try {
      const raw = localStorage.getItem(PALETTE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      colorPalette = Array.isArray(parsed) ? parsed.map(c => normalizeToHex(c)).slice(0, 48) : [];
  } catch {
      colorPalette = [];
  }
}
function savePalette() {
  try {
      localStorage.setItem(PALETTE_KEY, JSON.stringify(colorPalette.slice(0, 48)));
  } catch {}
}
function renderPalette() {
  const paletteBar = $("paletteBar");
  if (!paletteBar) return;
  paletteBar.innerHTML = "";
  for (const color of colorPalette) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "paletteSwatch";
      b.style.background = color;
      b.title = color;
      b.addEventListener("click", () => {
          setCurrentColorHex(color);
          if (tool === "eyedropper") {
              const brushRadio = $("tool-brush");
              if (brushRadio) brushRadio.checked = true;
              tool = "brush";
              queueUpdateHud();
          }
      });
      b.addEventListener("contextmenu", e => {
          e.preventDefault();
          colorPalette = colorPalette.filter(c => c !== color);
          savePalette();
          renderPalette();
      });
      paletteBar.appendChild(b);
  }
}
function addCurrentColorToPalette() {
  const hex = normalizeToHex(currentColor);
  colorPalette = [ hex, ...colorPalette.filter(c => c !== hex) ].slice(0, 48);
  savePalette();
  renderPalette();
}