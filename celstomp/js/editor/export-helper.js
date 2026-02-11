let autosaveEnabled = readAutosaveEnabledSetting();
let autosaveIntervalMinutes = readAutosaveIntervalMinutesSetting();
const autosaveController = window.CelstompAutosave?.createController?.({
  autosaveKey: "celstomp.project.autosave.v1",
  manualSaveMetaKey: "celstomp.project.manualsave.v1",
  enabled: autosaveEnabled,
  intervalMs: autosaveIntervalMinutes * 60000,
  badgeEl: saveStateBadgeEl,
  buildSnapshot: async () => await buildProjectSnapshot(),
  pointerSelectors: [ "#drawCanvas", "#fillCurrent", "#fillAll", "#tlDupCel", "#toolSeg label", "#layerSeg .layerRow", "#timelineTable td" ],
  valueSelectors: [ "#autofillToggle", "#brushSize", "#brushSizeRange", "#brushSizeNum", "#eraserSize", "#pressureSize", "#pressureOpacity", "#pressureTilt", "#tlSnap", "#tlSeconds", "#tlFps", "#tlOnion", "#tlTransparency", "#loopToggle", "#onionPrevColor", "#onionNextColor", "#onionAlpha" ],
  onRestorePayload: (payload, source) => {
      const blob = new Blob([ JSON.stringify(payload.data) ], {
          type: "application/json"
      });
      loadProject(blob, {
          source: source
      });
  }
}) || null;

function canvasesWithContentForMainLayerFrame(L, F) {
  const layer = layers[L];
  if (!layer) return [];
  const out = [];
  const order = layer.suborder || [];
  const map = layer.sublayers || null;
  if (map && order.length) {
      for (const key of order) {
          const off = map.get(key)?.frames?.[F];
          if (off && off._hasContent) out.push(off);
      }
  }
  const legacy = layer.frames?.[F];
  if (legacy && legacy._hasContent) out.push(legacy);
  return out;
}

async function drawFrameTo(ctx, i, opts = {}) {
  const forceHoldOff = !!opts.forceHoldOff;
  const transparent = !!opts.transparent;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, contentW, contentH);
  if (!transparent) {
      ctx.fillStyle = canvasBgColor;
      ctx.fillRect(0, 0, contentW, contentH);
  }
  if (hasCel(i)) drawExactCel(ctx, i); else {
      const p = nearestPrevCelIndex(i);
      if (p >= 0) {
          if (transparencyHoldEnabled && !forceHoldOff) ctx.globalAlpha = .3;
          drawExactCel(ctx, p);
          ctx.globalAlpha = 1;
      }
  }
}

function pickMP4Mime() {
  const options = [ "video/mp4;codecs=h264", "video/mp4;codecs=avc1", "video/mp4" ];
  for (const m of options) if (MediaRecorder.isTypeSupported(m)) return m;
  return null;
}

async function withTransparencyHoldForcedOffAsync(fn) {
  const prev = !!transparencyHoldEnabled;
  transparencyHoldEnabled = false;
  try {
      return await fn();
  } finally {
      transparencyHoldEnabled = prev;
  }
}
async function exportClip(mime, ext) {
  const cc = document.createElement("canvas");
  cc.width = contentW;
  cc.height = contentH;
  const cctx = cc.getContext("2d");
  cctx.imageSmoothingEnabled = !!antiAlias;
  const stream = cc.captureStream(fps);
  const chunks = [];
  const rec = new MediaRecorder(stream, {
      mimeType: mime
  });
  rec.ondataavailable = e => {
      if (e.data && e.data.size) chunks.push(e.data);
  };
  const done = new Promise(res => rec.onstop = res);
  await withTransparencyHoldForcedOffAsync(async () => {
      rec.start();
      for (let i = clipStart; i <= clipEnd; i++) {
          await sleep(0);
          await drawFrameTo(cctx, i, {
              exportMode: true
          });
          await sleep(1e3 / fps);
      }
      rec.stop();
      await done;
  });
  const blob = new Blob(chunks, {
      type: mime
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `celstomp_clip_${fps}fps_${framesToSF(clipStart).s}-${framesToSF(clipEnd).s}.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

////////////////
// GIF EXPORT //
////////////////


function buildGifPalette() {
  const out = [ 0x000000 ];
  for (let r = 0; r < 6; r++) {
      for (let g = 0; g < 6; g++) {
          for (let b = 0; b < 6; b++) {
              out.push(r * 51 << 16 | g * 51 << 8 | b * 51);
          }
      }
  }
  for (let i = 0; out.length < 256; i++) {
      const v = Math.round(i / 39 * 255);
      out.push(v << 16 | v << 8 | v);
  }
  return out;
}
function rgbaToGifIndex(r, g, b) {
  const ri = Math.max(0, Math.min(5, Math.round(r / 51)));
  const gi = Math.max(0, Math.min(5, Math.round(g / 51)));
  const bi = Math.max(0, Math.min(5, Math.round(b / 51)));
  return 1 + ri * 36 + gi * 6 + bi;
}
function imageDataToGifIndexes(data, transparent) {
  const out = new Uint8Array(data.length / 4);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      const a = data[i + 3];
      if (transparent && a < 16) {
          out[p] = 0;
          continue;
      }
      out[p] = rgbaToGifIndex(data[i], data[i + 1], data[i + 2]);
  }
  return out;
}
async function exportGif({fps: fpsLocal, transparent: transparent, loop: loop}) {
  if (typeof GifWriter !== "function") {
      alert("GIF export unavailable: encoder library not loaded.");
      return;
  }
  const start = clipStart;
  const end = clipEnd;
  const count = Math.max(0, end - start + 1);
  if (!count) {
      alert("No frames to export.");
      return;
  }
  const totalPixels = contentW * contentH * count;
  if (totalPixels > 4e7) {
      alert("GIF export range is too large. Shorten clip range or canvas size.");
      return;
  }
  const delayCs = Math.max(1, Math.round(100 / Math.max(1, fpsLocal || fps || 12)));
  const estSize = Math.max(1048576, Math.ceil(totalPixels * 1.4 + count * 256));
  const out = new Uint8Array(estSize);
  const palette = buildGifPalette();
  const writer = new GifWriter(out, contentW, contentH, {
      palette: palette,
      loop: loop ? 0 : null
  });
  const cc = document.createElement("canvas");
  cc.width = contentW;
  cc.height = contentH;
  const cctx = cc.getContext("2d", {
      willReadFrequently: true,
      alpha: true
  });
  cctx.imageSmoothingEnabled = !!antiAlias;
  await withExportOverridesAsync(async () => {
      for (let i = start; i <= end; i++) {
          await sleep(0);
          await drawFrameTo(cctx, i, {
              forceHoldOff: true,
              transparent: transparent
          });
          const img = cctx.getImageData(0, 0, contentW, contentH);
          const indexed = imageDataToGifIndexes(img.data, transparent);
          writer.addFrame(0, 0, contentW, contentH, indexed, {
              delay: delayCs,
              disposal: 1,
              transparent: transparent ? 0 : null
          });
      }
  });
  const len = writer.end();
  const blob = new Blob([ out.slice(0, len) ], {
      type: "image/gif"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `celstomp_clip_${fpsLocal}fps_${framesToSF(start).s}-${framesToSF(end).s}.gif`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function getPaperAccessor() {
  if (typeof paperEnabled !== "undefined") {
      return {
          get: () => !!paperEnabled,
          set: v => paperEnabled = !!v
      };
  }
  if (typeof paperLayerEnabled !== "undefined") {
      return {
          get: () => !!paperLayerEnabled,
          set: v => paperLayerEnabled = !!v
      };
  }
  if (typeof showPaper !== "undefined") {
      return {
          get: () => !!showPaper,
          set: v => showPaper = !!v
      };
  }
  try {
      if (typeof state === "object" && state) {
          if ("paperEnabled" in state) return {
              get: () => !!state.paperEnabled,
              set: v => state.paperEnabled = !!v
          };
          if ("paperOn" in state) return {
              get: () => !!state.paperOn,
              set: v => state.paperOn = !!v
          };
          if ("showPaper" in state) return {
              get: () => !!state.showPaper,
              set: v => state.showPaper = !!v
          };
      }
  } catch {}
  const cb = document.getElementById("paperToggle") || document.querySelector('input[type="checkbox"][id*="paper" i]') || document.querySelector('input[type="checkbox"][name*="paper" i]');
  if (cb && "checked" in cb) {
      return {
          get: () => !!cb.checked,
          set: v => {
              cb.checked = !!v;
              cb.dispatchEvent(new Event("change", {
                  bubbles: true
              }));
          }
      };
  }
  try {
      if (Array.isArray(layers)) {
          const pl = layers.find(l => /paper/i.test(String(l?.name ?? l?.id ?? "")));
          if (pl && "visible" in pl) return {
              get: () => !!pl.visible,
              set: v => pl.visible = !!v
          };
      }
  } catch {}
  return null;
}
async function withExportOverridesAsync(fn) {
  const prevHold = transparencyHoldEnabled;
  const paperAcc = getPaperAccessor();
  const prevPaper = paperAcc ? paperAcc.get() : null;
  try {
      transparencyHoldEnabled = false;
      if (paperAcc) paperAcc.set(false);
      return await fn();
  } finally {
      transparencyHoldEnabled = prevHold;
      if (paperAcc && prevPaper !== null) paperAcc.set(prevPaper);
  }
}
const imgSeqExporter = window.CelstompImgSeqExport?.createExporter?.({
  getState: () => ({
      clipStart: clipStart,
      clipEnd: clipEnd,
      totalFrames: totalFrames,
      fps: fps,
      seconds: seconds,
      contentW: contentW,
      contentH: contentH,
      antiAlias: antiAlias
  }),
  drawFrameTo: drawFrameTo,
  withExportOverridesAsync: withExportOverridesAsync,
  clamp: clamp,
  sleep: sleep
}) || null;
function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
      const r = new FileReader;
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error || new Error("FileReader failed"));
      r.readAsDataURL(blob);
  });
}
async function canvasToPngDataURL(c) {
  if (!c) return null;
  if (typeof c.toDataURL === "function") {
      try {
          return c.toDataURL("image/png");
      } catch {}
  }
  if (typeof c.convertToBlob === "function") {
      const blob = await c.convertToBlob({
          type: "image/png"
      });
      return await blobToDataURL(blob);
  }
  return null;
}
function canvasHasAnyAlpha(c) {
  try {
      const ctx = c.getContext("2d", {
          willReadFrequently: true
      });
      const data = ctx.getImageData(0, 0, contentW, contentH).data;
      for (let i = 3; i < data.length; i += 4) if (data[i] > 0) return true;
  } catch {}
  return false;
}
function uniqStable(arr) {
  const seen = new Set;
  const out = [];
  for (const v of arr || []) {
      const k = String(v);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(v);
  }
  return out;
}
const AUTOSAVE_ENABLED_KEY = "celstomp.autosave.enabled.v1";
const AUTOSAVE_INTERVAL_MIN_KEY = "celstomp.autosave.interval.min.v1";
function readAutosaveEnabledSetting() {
  try {
      const raw = localStorage.getItem(AUTOSAVE_ENABLED_KEY);
      if (raw === "1" || raw === "true") return true;
      if (raw === "0" || raw === "false") return false;
  } catch {}
  return false;
}
function readAutosaveIntervalMinutesSetting() {
  try {
      const raw = Number(localStorage.getItem(AUTOSAVE_INTERVAL_MIN_KEY) || 1);
      if (Number.isFinite(raw)) return clamp(Math.round(raw), 1, 120);
  } catch {}
  return 1;
}
function writeAutosaveEnabledSetting(v) {
  try {
      localStorage.setItem(AUTOSAVE_ENABLED_KEY, v ? "1" : "0");
  } catch {}
}
function writeAutosaveIntervalMinutesSetting(v) {
  try {
      localStorage.setItem(AUTOSAVE_INTERVAL_MIN_KEY, String(clamp(Math.round(v), 1, 120)));
  } catch {}
}

function syncAutosaveUiState() {
  const enabled = autosaveController?.isEnabled?.() ?? autosaveEnabled;
  const minutes = Math.max(1, Math.round((autosaveController?.getIntervalMs?.() ?? autosaveIntervalMinutes * 60000) / 60000));
  autosaveEnabled = !!enabled;
  autosaveIntervalMinutes = minutes;

  const toggleAutosaveBtn = $("toggleAutosaveBtn");
  const autosaveIntervalBtn = $("autosaveIntervalBtn");
  

  if (toggleAutosaveBtn) {
      toggleAutosaveBtn.textContent = autosaveEnabled ? "Disable Autosave" : "Enable Autosave";
      toggleAutosaveBtn.setAttribute("aria-pressed", autosaveEnabled ? "true" : "false");
  }
  if (autosaveIntervalBtn) {
      autosaveIntervalBtn.textContent = `Autosave Interval (${autosaveIntervalMinutes} min)`;
  }
  if (!autosaveEnabled) {
      setSaveStateBadge("Autosave Off", "");
  }
  writeAutosaveEnabledSetting(autosaveEnabled);
  writeAutosaveIntervalMinutesSetting(autosaveIntervalMinutes);
}
function setSaveStateBadge(text, tone = "") {
  const saveStateBadgeEl = $("saveStateBadge");

  if (autosaveController) {
      autosaveController.setBadge(text, tone);
      return;
  }
  if (!saveStateBadgeEl) return;
  saveStateBadgeEl.textContent = text;
  saveStateBadgeEl.classList.remove("dirty", "saving", "error");
  if (tone) saveStateBadgeEl.classList.add(tone);
}
function markProjectDirty() {
  if (autosaveController) return autosaveController.markDirty();
  setSaveStateBadge("Unsaved", "dirty");
}
function markProjectClean(text = "Saved") {
  if (autosaveController) return autosaveController.markClean(text);
  setSaveStateBadge(text, "");
}
function setLastManualSaveAt(ts = Date.now()) {
  if (autosaveController) return autosaveController.setManualSaveAt(ts);
  try {
      localStorage.setItem("celstomp.project.manualsave.v1", JSON.stringify({
          manualSavedAt: ts
      }));
  } catch {}
}
function getAutosavePayload() {
  if (autosaveController) return autosaveController.getPayload();
  return null;
}
function updateRestoreAutosaveButton() {
  const restoreAutosaveBtn = $("restoreAutosave");
  if (autosaveController) return autosaveController.updateRestoreButton(restoreAutosaveBtn);
  if (restoreAutosaveBtn) restoreAutosaveBtn.disabled = true;
}
function wireAutosaveDirtyTracking() {
  if (autosaveController) return autosaveController.wireDirtyTracking();
}
function maybePromptAutosaveRecovery() {
  if (!autosaveController) return;
  autosaveController.promptRecovery({
      source: "autosave-prompt"
  });
}
async function buildProjectSnapshot() {
  const outLayers = [];
  for (let li = 0; li < LAYERS_COUNT; li++) {
      const lay = layers?.[li];
      const opacity = typeof lay?.opacity === "number" ? clamp(lay.opacity, 0, 1) : 1;
      const name = String(lay?.name || "");
      const suborder = Array.isArray(lay?.suborder) ? lay.suborder.slice() : [];
      const keySet = new Set(suborder);
      if (lay?.sublayers && typeof lay.sublayers.keys === "function") {
          for (const k of lay.sublayers.keys()) keySet.add(k);
      }
      const keys = Array.from(keySet);
      keys.sort((a, b) => {
          const ia = suborder.indexOf(a);
          const ib = suborder.indexOf(b);
          if (ia === -1 && ib === -1) return String(a).localeCompare(String(b));
          if (ia === -1) return 1;
          if (ib === -1) return -1;
          return ia - ib;
      });
      const outSubs = {};
      for (const rawKey of keys) {
          const key = typeof resolveKeyFor === "function" ? resolveKeyFor(li, rawKey) : colorToHex(rawKey);
          const sub = lay?.sublayers?.get?.(key) || lay?.sublayers?.get?.(rawKey);
          if (!sub?.frames) continue;
          const framesOut = {};
          const n = Math.min(totalFrames, sub.frames.length);
          for (let fi = 0; fi < n; fi++) {
              const c = sub.frames[fi];
              if (!c) continue;
              const has = c._hasContent === true ? true : c._hasContent === false ? false : canvasHasAnyAlpha(c);
              if (!has) {
                  c._hasContent = false;
                  continue;
              }
              const url = await canvasToPngDataURL(c);
              if (url) framesOut[String(fi)] = url;
          }
          if (Object.keys(framesOut).length) {
              outSubs[key] = {
                  frames: framesOut
              };
          }
      }
      outLayers.push({
          name: name,
          opacity: opacity,
          suborder: uniqStable(keys),
          sublayers: outSubs
      });
  }
  return {
      version: 2,
      contentW: contentW,
      contentH: contentH,
      fps: fps,
      seconds: seconds,
      totalFrames: totalFrames,
      currentFrame: currentFrame,
      clipStart: clipStart,
      clipEnd: clipEnd,
      snapFrames: snapFrames,
      brushSize: brushSize,
      eraserSize: eraserSize,
      currentColor: currentColor,
      canvasBgColor: canvasBgColor,
      antiAlias: antiAlias,
      closeGapPx: closeGapPx,
      autofill: autofill,
      onionEnabled: onionEnabled,
      transparencyHoldEnabled: transparencyHoldEnabled,
      onionPrevTint: onionPrevTint,
      onionNextTint: onionNextTint,
      onionAlpha: onionAlpha,
      playSnapped: playSnapped,
      keepOnionWhilePlaying: keepOnionWhilePlaying,
      keepTransWhilePlaying: keepTransWhilePlaying,
      mainLayerOrder: mainLayerOrder.slice(),
      layerColors: Array.isArray(layerColorMem) ? layerColorMem.slice() : [],
      activeLayer: activeLayer,
      activeSubColor: Array.isArray(activeSubColor) ? activeSubColor.slice() : activeSubColor,
      oklchDefault: oklchDefault,
      layers: outLayers
  };
}
async function saveProject() {
  try {
      if (typeof pausePlayback === "function") pausePlayback();
  } catch {}
  try {
      if (typeof stopPlayback === "function") stopPlayback();
  } catch {}
  const data = await buildProjectSnapshot();
  const blob = new Blob([ JSON.stringify(data) ], {
      type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "celstomp_project.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  setLastManualSaveAt(Date.now());
  markProjectClean("Saved");
  updateRestoreAutosaveButton();
}
function loadProject(file, options = {}) {
  const fr = new FileReader;
  fr.onerror = () => alert("Failed to read file.");

  // lame as hell
  fr.onload = () => {
      (async () => {
          const data = JSON.parse(fr.result);
          try {
              if (typeof stopPlayback === "function") stopPlayback();
          } catch {}
          try {
              queueClearFx();
          } catch {}
          fps = clamp(parseInt(data.fps || 24, 10), 1, 120);
          seconds = clamp(parseInt(data.seconds || 5, 10), 1, 600);
          totalFrames = fps * seconds;
          if (Number.isFinite(data.contentW) && Number.isFinite(data.contentH)) {
              contentW = clamp(parseInt(data.contentW, 10), 16, 8192);
              contentH = clamp(parseInt(data.contentH, 10), 16, 8192);
          }
          currentFrame = clamp(parseInt(data.currentFrame ?? 0, 10), 0, totalFrames - 1);
          clipStart = clamp(parseInt(data.clipStart ?? 0, 10), 0, totalFrames - 1);
          clipEnd = clamp(parseInt(data.clipEnd ?? Math.min(totalFrames - 1, fps * 2 - 1), 10), clipStart, totalFrames - 1);
          snapFrames = Math.max(1, parseInt(data.snapFrames || 1, 10));
          brushSize = clamp(parseInt(data.brushSize || 3, 10), 1, 200);
          eraserSize = clamp(parseInt(data.eraserSize || 100, 10), 1, 400);
          brushSettings = mergeBrushSettings(brushSettings, {
              size: brushSize
          });
          eraserSettings = mergeBrushSettings(eraserSettings, {
              size: eraserSize
          });
          brushType = brushSettings.shape;
          currentColor = data.currentColor || "#000000";
          canvasBgColor = data.canvasBgColor || "#bfbfbf";
          antiAlias = !!data.antiAlias;
          closeGapPx = clamp(parseInt(data.closeGapPx || 0, 10), 0, 200);
          autofill = typeof data.autofill === "boolean" ? data.autofill : true;
          onionEnabled = !!data.onionEnabled;
          transparencyHoldEnabled = !!data.transparencyHoldEnabled;
          onionPrevTint = data.onionPrevTint || "#4080ff";
          onionNextTint = data.onionNextTint || "#40ff78";
          let oa = typeof data.onionAlpha === "number" ? data.onionAlpha : .2;
          if (oa > 1.001) oa = oa / 100;
          onionAlpha = clamp(oa, .05, .8);
          playSnapped = !!data.playSnapped;
          keepOnionWhilePlaying = !!data.keepOnionWhilePlaying;
          keepTransWhilePlaying = !!data.keepTransWhilePlaying;
          mainLayerOrder = normalizeMainLayerOrder(data.mainLayerOrder);
          if (data.oklchDefault && typeof data.oklchDefault === "object") {
              const L = clamp(parseFloat(data.oklchDefault.L) || 0, 0, 100);
              const C = clamp(parseFloat(data.oklchDefault.C) || 0, 0, 1);
              const H = clamp(parseFloat(data.oklchDefault.H) || 0, 0, 360);
              oklchDefault = {
                  L: L,
                  C: C,
                  H: H
              };
          }
          if (Array.isArray(data.layerColors)) {
              for (let i = 0; i < LAYERS_COUNT; i++) {
                  const v = data.layerColors[i];
                  if (typeof v === "string" && v.trim()) layerColorMem[i] = v.trim();
              }
          }
          layerColorMem[LAYER.FILL] = fillWhite;
          if (Number.isFinite(data.activeLayer)) activeLayer = clamp(data.activeLayer, 0, LAYERS_COUNT - 1);
          if (Array.isArray(data.activeSubColor)) {
              for (let i = 0; i < LAYERS_COUNT; i++) {
                  if (typeof data.activeSubColor[i] === "string") activeSubColor[i] = data.activeSubColor[i];
              }
          }
          layers = new Array(LAYERS_COUNT).fill(0).map(() => ({
              name: "",
              opacity: 1,
              prevOpacity: 1,
              frames: new Array(totalFrames).fill(null),
              suborder: [],
              sublayers: new Map
          }));
          layers[LAYER.LINE].name = "LINE";
          layers[LAYER.SHADE].name = "SHADE";
          layers[LAYER.COLOR].name = "COLOR";
          layers[LAYER.SKETCH].name = "SKETCH";
          layers[LAYER.FILL].name = "FILL";
          try {
              if (hasTimeline && typeof buildTimeline === "function") buildTimeline();
          } catch {}
          try {
              resizeCanvases?.();
          } catch {}
          function ensureSubForLoad(layerIndex, key) {
              const lay = layers[layerIndex];
              if (!lay.sublayers) lay.sublayers = new Map;
              let sub = lay.sublayers.get(key);
              if (!sub) {
                  sub = {
                      color: key,
                      frames: new Array(totalFrames).fill(null)
                  };
                  lay.sublayers.set(key, sub);
              } else if (!Array.isArray(sub.frames) || sub.frames.length !== totalFrames) {
                  sub.frames = new Array(totalFrames).fill(null);
              }
              return sub;
          }
          function loadImgIntoCanvas(url, canvas) {
              return new Promise(resolve => {
                  const img = new Image;
                  img.decoding = "async";
                  img.onload = () => {
                      try {
                          const ctx = canvas.getContext("2d");
                          ctx.setTransform(1, 0, 0, 1, 0, 0);
                          ctx.clearRect(0, 0, contentW, contentH);
                          ctx.drawImage(img, 0, 0);
                          canvas._hasContent = true;
                      } catch {}
                      resolve(true);
                  };
                  img.onerror = () => resolve(false);
                  img.src = url;
              });
          }
          const tasks = [];
          const srcLayers = Array.isArray(data.layers) ? data.layers : [];
          for (let layerIndex = 0; layerIndex < Math.min(LAYERS_COUNT, srcLayers.length); layerIndex++) {
              const src = srcLayers[layerIndex];
              const lay = layers[layerIndex];
              if (!lay || !src) continue;
              lay.opacity = typeof src.opacity === "number" ? clamp(src.opacity, 0, 1) : 1;
              lay.prevOpacity = lay.opacity;
              if (typeof src.name === "string" && src.name.trim()) lay.name = src.name.trim();
              if (src.sublayers && typeof src.sublayers === "object") {
                  const subsObj = src.sublayers;
                  const rawKeys = Array.isArray(src.suborder) && src.suborder.length ? src.suborder.slice() : Object.keys(subsObj);
                  const keys = rawKeys.map(rk => typeof resolveKeyFor === "function" ? resolveKeyFor(layerIndex, rk) : colorToHex(rk));
                  lay.suborder = uniqStable(keys);
                  for (const key of lay.suborder) ensureSubForLoad(layerIndex, key);
                  for (let ki = 0; ki < rawKeys.length; ki++) {
                      const rawKey = rawKeys[ki];
                      const key = keys[ki];
                      const subSrc = subsObj[rawKey];
                      const mapping = subSrc?.frames || {};
                      const sub = ensureSubForLoad(layerIndex, key);
                      for (const k in mapping) {
                          const url = mapping[k];
                          if (!url) continue;
                          const fi = clamp(parseInt(k, 10), 0, totalFrames - 1);
                          const off = document.createElement("canvas");
                          off.width = contentW;
                          off.height = contentH;
                          off._hasContent = false;
                          sub.frames[fi] = off;
                          tasks.push(loadImgIntoCanvas(url, off).then(() => {
                              try {
                                  if (hasTimeline && typeof updateTimelineHasContent === "function") updateTimelineHasContent(fi);
                              } catch {}
                          }));
                      }
                  }
                  continue;
              }
              if (src.frames && typeof src.frames === "object") {
                  const key = layerIndex === LAYER.FILL ? fillWhite : activeSubColor?.[layerIndex] || layerColorMem?.[layerIndex] || colorToHex(currentColor);
                  lay.suborder = [ key ];
                  const sub = ensureSubForLoad(layerIndex, key);
                  for (const k in src.frames) {
                      const url = src.frames[k];
                      if (!url) continue;
                      const fi = clamp(parseInt(k, 10), 0, totalFrames - 1);
                      const off = document.createElement("canvas");
                      off.width = contentW;
                      off.height = contentH;
                      off._hasContent = false;
                      sub.frames[fi] = off;
                      tasks.push(loadImgIntoCanvas(url, off).then(() => {
                          try {
                              if (hasTimeline && typeof updateTimelineHasContent === "function") updateTimelineHasContent(fi);
                          } catch {}
                      }));
                  }
              }
          }
          await Promise.all(tasks);
          for (let L = 0; L < LAYERS_COUNT; L++) {
              const lay = layers[L];
              if (!lay) continue;
              if (!lay.suborder) lay.suborder = [];
              if (!lay.sublayers) lay.sublayers = new Map;
              const cur = activeSubColor?.[L];
              if (cur && lay.sublayers.has(cur)) continue;
              activeSubColor[L] = lay.suborder[lay.suborder.length - 1] || (L === LAYER.FILL ? fillWhite : "#000000");
          }
          try {
              if (hasTimeline && typeof updateTimelineHasContent === "function") {
                  for (let f = 0; f < totalFrames; f++) updateTimelineHasContent(f);
              }
          } catch {}
          try {
              for (let L = 0; L < LAYERS_COUNT; L++) renderLayerSwatches?.(L);
          } catch {}
          try {
              wireLayerVisButtons?.();
          } catch {}
          try {
              queueRenderAll();
          } catch {}
          try {
              queueUpdateHud();
          } catch {}

          const brushSizeInput = $("brushSize") || $("brushSizeRange");
          const brushSizeNumInput = $("brushSizeNum");
          const eraserSizeInput = $("eraserSize");

          const brushVal = $("brushVal");
          const eraserVal = $("eraserVal");

          const aaToggle = $("aaToggle");

          const bgColorInput = $("bgColor");

          const snapValue = $("snapValue");

          const autofillToggle = $("autofillToggle");

          const onionPrevColorInput = $("onionPrevColor");
          const onionNextColorInput = $("onionNextColor");

          const onionAlphaInput = $("onionAlpha");
          const onionAlphaVal = $("onionAlphaVal");

          const playSnappedChk = $("playSnapped");

          const keepOnionPlayingChk = $("keepOnionPlaying");
          const keepTransPlayingChk = $("keepTransPlaying");

          const toggleOnionBtn = $("toggleOnion");
          const toggleTransparencyBtn = $("toggleTransparency");

          safeSetValue(brushSizeInput, brushSize);
          safeSetValue(brushSizeNumInput, brushSize);
          safeSetValue(eraserSizeInput, eraserSize);
          safeText(brushVal, String(brushSize));
          safeText(eraserVal, String(eraserSize));
          safeSetChecked(aaToggle, antiAlias);
          safeSetValue(bgColorInput, canvasBgColor);
          safeSetValue(snapValue, snapFrames);
          safeSetChecked(autofillToggle, autofill);
          safeSetValue(onionPrevColorInput, onionPrevTint);
          safeSetValue(onionNextColorInput, onionNextTint);
          safeSetValue(onionAlphaInput, Math.round(onionAlpha * 100));
          safeText(onionAlphaVal, String(Math.round(onionAlpha * 100)));
          safeSetChecked(playSnappedChk, playSnapped);
          safeSetChecked(keepOnionPlayingChk, keepOnionWhilePlaying);
          safeSetChecked(keepTransPlayingChk, keepTransWhilePlaying);
          safeSetChecked(document.getElementById("tlOnion"), onionEnabled);
          safeSetChecked(document.getElementById("tlTransparency"), transparencyHoldEnabled);
          if (toggleOnionBtn) toggleOnionBtn.textContent = `Onion: ${onionEnabled ? "On" : "Off"}`;
          if (toggleTransparencyBtn) toggleTransparencyBtn.textContent = `Transparency: ${transparencyHoldEnabled ? "On" : "Off"}`;
          if (activeLayer !== PAPER_LAYER && activeLayer !== LAYER.FILL) {
              const k = activeSubColor?.[activeLayer];
              if (typeof k === "string" && k) currentColor = k;
          }
          try {
              setColorSwatch?.();
          } catch {}
          try {
              setHSVPreviewBox?.();
          } catch {}
          try {
              centerView?.();
          } catch {}
          try {
              queueUpdateHud();
          } catch {}
          try {
              if (typeof gotoFrame === "function") gotoFrame(currentFrame);
          } catch {}
          const source = String(options?.source || "file");
          if (source.startsWith("autosave")) {
              markProjectDirty();
              setSaveStateBadge("Recovered draft", "dirty");
          } else {
              markProjectClean("Loaded");
          }
          updateRestoreAutosaveButton();
      })().catch(err => {
          console.warn("[celstomp] loadProject failed:", err);
          alert("Failed to load project:\n" + (err?.message || String(err)));
      });
  };
  fr.readAsText(file);
}

function askImgSeqExportOptions() {
  const exportImgSeqModal = $("exportImgSeqModal");
  const exportImgSeqModalBackdrop = $("exportImgSeqModalBackdrop");
  const exportImgSeqTransparencyToggle = $("exportImgSeqTransparency");
  const exportImgSeqConfirmBtn = $("exportImgSeqConfirmBtn");
  const exportImgSeqCancelBtn = $("exportImgSeqCancelBtn");

  return new Promise(resolve => {
      if (!exportImgSeqModal || !exportImgSeqModalBackdrop || !exportImgSeqConfirmBtn || !exportImgSeqCancelBtn) {
          resolve({
              transparent: false
          });
          return;
      }
      exportImgSeqModal.hidden = false;
      exportImgSeqModalBackdrop.hidden = false;
      const cleanup = value => {
          exportImgSeqModal.hidden = true;
          exportImgSeqModalBackdrop.hidden = true;
          exportImgSeqConfirmBtn.removeEventListener("click", onConfirm);
          exportImgSeqCancelBtn.removeEventListener("click", onCancel);
          exportImgSeqModalBackdrop.removeEventListener("click", onCancel);
          document.removeEventListener("keydown", onEsc);
          resolve(value);
      };
      const onConfirm = () => cleanup({
          transparent: !!exportImgSeqTransparencyToggle?.checked
      });
      const onCancel = () => cleanup(null);
      const onEsc = e => {
          if (e.key === "Escape") cleanup(null);
      };
      exportImgSeqConfirmBtn.addEventListener("click", onConfirm);
      exportImgSeqCancelBtn.addEventListener("click", onCancel);
      exportImgSeqModalBackdrop.addEventListener("click", onCancel);
      document.addEventListener("keydown", onEsc);
  });
}

function askGifExportOptions() {
  const exportGifModal = $("exportGifModal");
  const exportGifModalBackdrop = $("exportGifModalBackdrop");
  const exportGifConfirmBtn = $("exportGifConfirmBtn");
  const exportGifCancelBtn = $("exportGifCancelBtn");

  const exportGifTransparencyToggle = $("exportGifTransparency");
  const exportGifLoopToggle = $("exportGifLoop");

  const exportGifFpsInput = $("exportGifFps");

  return new Promise(resolve => {
      if (!exportGifModal || !exportGifModalBackdrop || !exportGifConfirmBtn || !exportGifCancelBtn) {
          resolve({
              fps: Math.max(1, Math.min(60, fps || 12)),
              transparent: false,
              loop: true
          });
          return;
      }
      safeSetValue(exportGifFpsInput, Math.max(1, Math.min(60, fps || 12)));
      exportGifModal.hidden = false;
      exportGifModalBackdrop.hidden = false;
      const cleanup = value => {
          exportGifModal.hidden = true;
          exportGifModalBackdrop.hidden = true;
          exportGifConfirmBtn.removeEventListener("click", onConfirm);
          exportGifCancelBtn.removeEventListener("click", onCancel);
          exportGifModalBackdrop.removeEventListener("click", onCancel);
          document.removeEventListener("keydown", onEsc);
          resolve(value);
      };
      const onConfirm = () => {
          const f = Math.max(1, Math.min(60, parseInt(exportGifFpsInput?.value, 10) || fps || 12));
          cleanup({
              fps: f,
              transparent: !!exportGifTransparencyToggle?.checked,
              loop: !!exportGifLoopToggle?.checked
          });
      };
      const onCancel = () => cleanup(null);
      const onEsc = e => {
          if (e.key === "Escape") cleanup(null);
      };
      exportGifConfirmBtn.addEventListener("click", onConfirm);
      exportGifCancelBtn.addEventListener("click", onCancel);
      exportGifModalBackdrop.addEventListener("click", onCancel);
      document.addEventListener("keydown", onEsc);
  });
}
function askAutosaveIntervalOptions() {
  const autosaveIntervalModal = $("autosaveIntervalModal");
  const autosaveIntervalModalBackdrop = $("autosaveIntervalModalBackdrop");
  const autosaveIntervalMinutesInput = $("autosaveIntervalMinutesInput");
  const autosaveIntervalConfirmBtn = $("autosaveIntervalConfirmBtn");
  const autosaveIntervalCancelBtn = $("autosaveIntervalCancelBtn");

  return new Promise(resolve => {
      if (!autosaveIntervalModal || !autosaveIntervalModalBackdrop || !autosaveIntervalConfirmBtn || !autosaveIntervalCancelBtn) {
          resolve(null);
          return;
      }
      safeSetValue(autosaveIntervalMinutesInput, autosaveIntervalMinutes);
      autosaveIntervalModal.hidden = false;
      autosaveIntervalModalBackdrop.hidden = false;
      const cleanup = value => {
          autosaveIntervalModal.hidden = true;
          autosaveIntervalModalBackdrop.hidden = true;
          autosaveIntervalConfirmBtn.removeEventListener("click", onConfirm);
          autosaveIntervalCancelBtn.removeEventListener("click", onCancel);
          autosaveIntervalModalBackdrop.removeEventListener("click", onCancel);
          document.removeEventListener("keydown", onEsc);
          resolve(value);
      };
      const onConfirm = () => {
          const mins = clamp(parseInt(autosaveIntervalMinutesInput?.value, 10) || autosaveIntervalMinutes || 1, 1, 120);
          cleanup(mins);
      };
      const onCancel = () => cleanup(null);
      const onEsc = e => {
          if (e.key === "Escape") cleanup(null);
      };
      autosaveIntervalConfirmBtn.addEventListener("click", onConfirm);
      autosaveIntervalCancelBtn.addEventListener("click", onCancel);
      autosaveIntervalModalBackdrop.addEventListener("click", onCancel);
      document.addEventListener("keydown", onEsc);
  });
}

// "clear all" migrated to export/import flow for now
function askClearAllConfirmation() {
    return new Promise(resolve => {
        if (!clearAllModal || !clearAllModalBackdrop || !clearAllConfirmBtn || !clearAllCancelBtn) {
            resolve(window.confirm("Clear ALL frames and layers?\n\nThis will reset undo history and cannot be undone."));
            return;
        }
        clearAllModal.hidden = false;
        clearAllModalBackdrop.hidden = false;
        const cleanup = ok => {
            clearAllModal.hidden = true;
            clearAllModalBackdrop.hidden = true;
            clearAllConfirmBtn.removeEventListener("click", onConfirm);
            clearAllCancelBtn.removeEventListener("click", onCancel);
            clearAllModalBackdrop.removeEventListener("click", onCancel);
            document.removeEventListener("keydown", onEsc);
            resolve(ok);
        };
        const onConfirm = () => cleanup(true);
        const onCancel = () => cleanup(false);
        const onEsc = e => {
            if (e.key === "Escape") cleanup(false);
        };
        clearAllConfirmBtn.addEventListener("click", onConfirm);
        clearAllCancelBtn.addEventListener("click", onCancel);
        clearAllModalBackdrop.addEventListener("click", onCancel);
        document.addEventListener("keydown", onEsc);
    });
}

async function clearAllProjectState() {
    const ok = await askClearAllConfirmation();
    if (!ok) return;
    try {
        stopPlayback?.();
    } catch {}
    try {
        clearFx?.();
    } catch {}
    try {
        clearRectSelection?.();
    } catch {}
    try {
        clearCelSelection?.();
    } catch {}
    try {
        clearGhostTargets?.();
    } catch {}
    try {
        cancelLasso?.();
    } catch {}
    for (let f = 0; f < totalFrames; f++) {
        clearFrameAllLayers(f);
    }
    for (let L = 0; L < LAYERS_COUNT; L++) {
        try {
            pruneUnusedSublayers(L);
        } catch {}
    }
    currentFrame = 0;
    
    globalHistory.undo.length = 0;
    globalHistory.redo.length = 0;
    historyMap.clear();
    _pendingGlobalStep = null;
    _globalStepDirty = false;
    if (hasTimeline) buildTimeline();
    try {
        gotoFrame?.(0);
    } catch {}
    try {
        renderAll?.();
    } catch {}
    try {
        updateHUD?.();
    } catch {}
    try {
        markProjectDirty?.();
    } catch {}
}

/// MISC WIRING CODE

function handleExportFunctionWiring() {
    $("exportMP4")?.addEventListener("click", async () => {
        const mime = pickMP4Mime();
        if (!mime) {
            alert("MP4 export is not supported in this browser. Try Safari or export WebM.");
            return;
        }
        await exportClip(mime, "mp4");
    });
    
    const exportImgSeqBtn = $("exportImgSeqBtn") || $("exportImgSeq");
    exportImgSeqBtn?.addEventListener("click", async e => {
        e.preventDefault();
        e.stopPropagation();
        if (!imgSeqExporter?.handleClick) {
            alert("IMG sequence exporter is unavailable.");
            return;
        }
        const options = await askImgSeqExportOptions();
        if (!options) return;
        await imgSeqExporter.handleClick({
            preventDefault: () => {},
            stopPropagation: () => {},
            altKey: !!options.transparent,
            shiftKey: false
        }, exportImgSeqBtn);
    });
    
    const exportGIFBtn = $("exportGIFBtn");
    exportGIFBtn?.addEventListener("click", async e => {
        e.preventDefault();
        e.stopPropagation();
        const options = await askGifExportOptions();
        if (!options) return;
        const oldTxt = exportGIFBtn.textContent;
        exportGIFBtn.disabled = true;
        exportGIFBtn.textContent = "Exporting...";
        try {
            await exportGif(options);
        } catch (err) {
            alert("GIF export failed: " + (err?.message || err));
        } finally {
            exportGIFBtn.disabled = false;
            exportGIFBtn.textContent = oldTxt;
        }
    });
    
    $("toggleAutosaveBtn")?.addEventListener("click", e => {
        e.preventDefault();
        e.stopPropagation();
        autosaveEnabled = !autosaveEnabled;
        autosaveController?.setEnabled?.(autosaveEnabled);
        if (autosaveEnabled) {
            autosaveController?.markClean?.("Autosave On");
        }
        syncAutosaveUiState();
        updateRestoreAutosaveButton();
    });
    
    $("autosaveIntervalBtn")?.addEventListener("click", async e => {
        e.preventDefault();
        e.stopPropagation();
        const minutes = await askAutosaveIntervalOptions();
        if (!minutes) return;
        autosaveIntervalMinutes = clamp(Number(minutes) || autosaveIntervalMinutes || 1, 1, 120);
        autosaveController?.setIntervalMs?.(autosaveIntervalMinutes * 60000);
        syncAutosaveUiState();
    });
}