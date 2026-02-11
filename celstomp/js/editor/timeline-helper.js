clipStart = 0;
clipEnd = Math.max(0, Math.min(totalFrames - 1, fps * 2 - 1));

let isPlaying = false;
let playTimer = null;
let loopPlayback = true;
let playSnapped = false;

// onion
let onionEnabled = false;
let transparencyHoldEnabled = false;
let onionAlpha = .5;
let onionPrevTint = "#4080ff";
let onionNextTint = "#40ff78";
let keepOnionWhilePlaying = false;
let keepTransWhilePlaying = false;
let restoreOnionAfterPlay = false;
let restoreTransAfterPlay = false;
let prevOnionState = false;
let prevTransState = false;

let snapFrames = 1;

// leftover timeline consts (TODO: factor out)
const timelineTable = $("timelineTable");
const timelineScroll = $("timelineScroll");
const playheadMarker = $("playheadMarker");
const clipStartMarker = $("clipStartMarker");
const clipEndMarker = $("clipEndMarker");

const hasTimeline = !!(timelineTable && timelineScroll && playheadMarker && clipStartMarker && clipEndMarker);

function buildTimeline() {
  totalFrames = fps * seconds;
  for (const layer of layers) {
      if (!layer?.sublayers || !layer?.suborder) continue;
      for (const key of layer.suborder) {
          const sub = layer.sublayers.get(key);
          if (!sub) continue;
          const old = sub.frames || [];
          const n = new Array(totalFrames).fill(null);
          const copy = Math.min(old.length, n.length);
          for (let i = 0; i < copy; i++) n[i] = old[i];
          sub.frames = n;
      }
  }
  layers.forEach(l => {
      const old = l.frames;
      const n = new Array(totalFrames).fill(null);
      const copy = Math.min(old.length, n.length);
      for (let i = 0; i < copy; i++) n[i] = old[i];
      l.frames = n;
  });
  clipStart = clamp(clipStart, 0, totalFrames - 1);
  clipEnd = clamp(clipEnd, clipStart, totalFrames - 1);
  $("timelineTable").innerHTML = "";
  const playRow = document.createElement("tr");
  playRow.className = "playhead-row";
  const phTh = document.createElement("th");
  phTh.className = "sticky";
  phTh.id = "playheadSticky";
  phTh.textContent = "Playhead";
  playRow.appendChild(phTh);
  for (let i = 0; i < totalFrames; i++) {
      const td = document.createElement("td");
      td.dataset.index = String(i);
      if (i % fps === 0) td.textContent = `${i / fps}s`;
      playRow.appendChild(td);
  }
  $("timelineTable").appendChild(playRow);
  const tr = document.createElement("tr");
  tr.className = "anim-row";
  const th = document.createElement("th");
  th.className = "sticky";
  th.textContent = "Animation";
  tr.appendChild(th);
  for (let i = 0; i < totalFrames; i++) {
      const td = document.createElement("td");
      td.dataset.index = String(i);
      if (i % fps === 0) td.classList.add("secondTick");
      if (hasCel(i)) td.classList.add("hasContent");
      tr.appendChild(td);
  }
  $("timelineTable").appendChild(tr);
  currentFrame = clamp(currentFrame, 0, totalFrames - 1);
  pruneSelection();
  highlightTimelineCell();
  updatePlayheadMarker();
  updateClipMarkers();
}
function highlightTimelineCell() {
  const tr = $("timelineTable").querySelector("tr.anim-row");
  if (!tr) return;
  [ ...tr.children ].forEach((cell, idx) => {
      if (idx === 0) return;
      const f = idx - 1;
      cell.classList.toggle("active", f === currentFrame);
      cell.classList.toggle("hasContent", hasCel(f));
      cell.classList.toggle("selected", selectedCels.has(f));
      cell.classList.toggle("ghostTarget", ghostTargets.has(f));
  });
  const ph = $("playheadSticky");
  if (ph) ph.textContent = `Playhead — ${sfString(currentFrame)}`;
}

function sfString(f) {
  const o = framesToSF(f);
  return `${o.s}s+${o.f}f`;
}

function framesToSF(f) {
  return {
      s: Math.floor(f / fps),
      f: f % fps
  };
}

function updateTimelineHasContent(F) {
  const tr = $("timelineTable").querySelector("tr.anim-row");
  if (!tr) return;
  const td = tr.children[F + 1];
  if (!td) return;
  td.classList.toggle("hasContent", hasCel(F));
}
function refreshTimelineRowHasContentAll() {
  const tr = $("timelineTable").querySelector("tr.anim-row");
  if (!tr) return;
  for (let F = 0; F < totalFrames; F++) {
      const td = tr.children[F + 1];
      if (td) td.classList.toggle("hasContent", hasCel(F));
  }
  try {
      highlightTimelineCell?.();
  } catch {}
}
function fallbackSwatchKeyForLayer(L) {
  if (L == null || L === PAPER_LAYER) return null;
  const layer = layers?.[L];
  const ord = layer?.suborder || [];
  const map = layer?.sublayers;
  for (const k of ord) {
      if (k && map?.get?.(k)) return k;
  }
  if (L === LAYER.FILL) return fillWhite || "#FFFFFF";
  try {
      return rememberedColorForLayer?.(L) ?? "#000000";
  } catch {}
  return "#000000";
}
function migrateHistoryForSwatchMove(srcL, dstL, key) {
  if (!historyMap || srcL == null || dstL == null) return;
  const srcK = typeof resolveKeyFor === "function" ? resolveKeyFor(srcL, key) : key;
  const dstK = typeof resolveKeyFor === "function" ? resolveKeyFor(dstL, key) : key;
  for (let F = 0; F < totalFrames; F++) {
      const from = historyKey(srcL, F, srcK);
      const to = historyKey(dstL, F, dstK);
      const srcHist = historyMap.get(from);
      if (!srcHist) continue;
      const dstHist = historyMap.get(to);
      if (!dstHist) {
          historyMap.set(to, srcHist);
      } else {
          dstHist.undo = [ ...dstHist.undo, ...srcHist.undo ].slice(-historyLimit);
          dstHist.redo = [ ...dstHist.redo, ...srcHist.redo ].slice(-historyLimit);
      }
      historyMap.delete(from);
  }
}
function updatePlayheadMarker() {
  const playRow = $("timelineTable").querySelector("tr.playhead-row");
  if (!playRow) return;
  const targetCell = playRow.children[currentFrame + 1];
  if (!targetCell) return;
  const cellRect = targetCell.getBoundingClientRect();
  const scrollRect = $("timelineScroll").getBoundingClientRect();
  const leftInScroll = cellRect.left - scrollRect.left + $("timelineScroll").scrollLeft;
  $("playheadMarker").style.left = Math.round(leftInScroll) + "px";
}
function edgeLeftPxOfFrame(frameIndex) {
  const playRow = $("timelineTable").querySelector("tr.playhead-row");
  const cell = playRow?.children[frameIndex + 1];
  if (!cell) return 0;
  const cellRect = cell.getBoundingClientRect();
  const scrollRect = $("timelineScroll").getBoundingClientRect();
  return cellRect.left - scrollRect.left + $("timelineScroll").scrollLeft;
}
function updateClipMarkers() {
  $("clipStartMarker").style.left = Math.round(edgeLeftPxOfFrame(clipStart)) + "px";
  $("clipEndMarker").style.left = Math.round(edgeLeftPxOfFrame(clipEnd)) + "px";
}
function applySnapFrom(start, i) {
  if (snapFrames > 0) {
      const delta = i - start;
      return clamp(start + Math.round(delta / snapFrames) * snapFrames, 0, totalFrames - 1);
  }
  return clamp(i, 0, totalFrames - 1);
}
function stepBySnap(delta) {
  if (snapFrames > 0) return clamp(currentFrame + delta * snapFrames, 0, totalFrames - 1);
  return clamp(currentFrame + delta, 0, totalFrames - 1);
}
function gotoFrame(i) {
  currentFrame = clamp(i, 0, totalFrames - 1);
  queueUpdateHud();
  queueRenderAll();
  updatePlayheadMarker();
  const playRow = $("timelineTable").querySelector("tr.playhead-row");
  const cell = playRow?.children[currentFrame + 1];
  if (!cell) return;
  const r = cell.getBoundingClientRect();
  const sr = $("timelineScroll").getBoundingClientRect();
  const left = r.left - sr.left + $("timelineScroll").scrollLeft;
  const right = left + r.width;
  if (left < $("timelineScroll").scrollLeft) $("timelineScroll").scrollLeft = left - 20; else if (right > $("timelineScroll").scrollLeft + $("timelineScroll").clientWidth) {
    $("timelineScroll").scrollLeft = right - $("timelineScroll").clientWidth + 20;
  }
}

function captureFrameBundle(F) {
  const bundle = new Array(LAYERS_COUNT);
  for (let L = 0; L < LAYERS_COUNT; L++) {
      const layer = layers[L];
      const m = new Map;
      if (layer?.sublayers && layer?.suborder) {
          for (const key of layer.suborder) {
              const sub = layer.sublayers.get(key);
              const c = sub?.frames?.[F];
              if (c && c._hasContent) m.set(key, c);
          }
      }
      bundle[L] = m;
  }
  return bundle;
}

function cloneCanvasDeep(src) {
  if (!src) return null;
  const c = document.createElement("canvas");
  c.width = src.width || contentW;
  c.height = src.height || contentH;
  const ctx = c.getContext("2d");
  ctx.drawImage(src, 0, 0);
  c._hasContent = !!src._hasContent;
  return c;
}

function cloneFrameBundleDeep(bundle) {
  const out = new Array(LAYERS_COUNT);
  for (let L = 0; L < LAYERS_COUNT; L++) {
      const src = bundle[L];
      const dst = new Map;
      if (src && src.size) {
          for (const [key, c] of src) dst.set(key, cloneCanvasDeep(c));
      }
      out[L] = dst;
  }
  return out;
}
function pasteFrameBundle(F, bundle) {
  clearFrameAllLayers(F);
  for (let L = 0; L < LAYERS_COUNT; L++) {
      const m = bundle[L];
      if (!m || !m.size) continue;
      for (const [key, c] of m) {
          const sub = ensureSublayer(L, key);
          sub.frames[F] = c;
      }
  }
}
function moveFrameAllLayers(fromF, toF) {
  if (fromF === toF) return;
  clearFrameAllLayers(toF);
  for (let L = 0; L < LAYERS_COUNT; L++) {
      const layer = layers[L];
      if (!layer?.sublayers || !layer?.suborder) continue;
      for (const key of layer.suborder) {
          const sub = layer.sublayers.get(key);
          if (!sub?.frames) continue;
          const c = sub.frames[fromF];
          if (c) sub.frames[toF] = c;
          sub.frames[fromF] = null;
      }
  }
}
function duplicateCelFrames(srcF, dstF) {
  if (srcF < 0 || dstF < 0 || srcF === dstF) return false;
  if (!hasCel(srcF)) return false;
  const srcBundle = captureFrameBundle(srcF);
  const copy = cloneFrameBundleDeep(srcBundle);
  pasteFrameBundle(dstF, copy);
  queueRenderAll();
  buildTimeline();
  gotoFrame(dstF);
  try {
      setSingleSelection(dstF);
  } catch {}
  return true;
}
function onDuplicateCel() {
  const F = currentFrame;
  if (hasCel(F)) {
      const nextIdx = nearestNextCelIndex(F);
      if (nextIdx === F + 1) return;
      const prevIdx = nearestPrevCelIndex(F);
      const step = prevIdx >= 0 ? Math.max(1, F - prevIdx) : Math.max(1, snapFrames);
      let dst = F + step;
      if (dst >= totalFrames) dst = totalFrames - 1;
      if (hasCel(dst)) return;
      duplicateCelFrames(F, dst);
  } else {
      const left = nearestPrevCelIndex(F);
      if (left < 0) return;
      if (hasCel(F)) return;
      duplicateCelFrames(left, F);
  }
}
function gotoPrevCel() {
  const p = nearestPrevCelIndex(currentFrame > 0 ? currentFrame : 0);
  if (p >= 0) gotoFrame(p);
}
function gotoNextCel() {
  const n = nearestNextCelIndex(currentFrame);
  if (n >= 0) gotoFrame(n);
}
let selectedCels = new Set;
let selectingCels = false;
let selAnchor = -1;
let selLast = -1;
let ghostTargets = new Set;
function clearGhostTargets() {
  if (!ghostTargets.size) return;
  ghostTargets.clear();
  highlightTimelineCell();
}
function computeGhostDestsForStart(startFrame) {
  const frames = selectedSorted();
  if (!frames.length) return [];
  const base = frames[0];
  let shift = startFrame - base;
  const minDest = frames[0] + shift;
  const maxDest = frames[frames.length - 1] + shift;
  if (minDest < 0) shift += -minDest;
  if (maxDest > totalFrames - 1) shift -= maxDest - (totalFrames - 1);
  return frames.map(f => f + shift);
}
function setGhostTargetsForStart(startFrame) {
  const dests = computeGhostDestsForStart(startFrame);
  ghostTargets = new Set(dests);
  highlightTimelineCell();
}
function setGhostTargetSingle(frame) {
  ghostTargets = new Set([ frame ]);
  highlightTimelineCell();
}
let groupDragActive = false;
let groupDropStart = -1;
function selectedSorted() {
  return Array.from(selectedCels).sort((a, b) => a - b);
}
function pruneSelection() {
  if (!selectedCels.size) return;
  const next = new Set;
  for (const f of selectedCels) {
      if (f >= 0 && f < totalFrames && hasCel(f)) next.add(f);
  }
  selectedCels = next;
}
function clearCelSelection() {
  selectedCels.clear();
  selAnchor = -1;
  selLast = -1;
  highlightTimelineCell();
}
function setSingleSelection(f) {
  selectedCels = new Set(hasCel(f) ? [ f ] : []);
  selAnchor = f;
  selLast = f;
  highlightTimelineCell();
}
function setSelectionRange(a, b) {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const next = new Set;
  for (let i = lo; i <= hi; i++) {
      if (hasCel(i)) next.add(i);
  }
  selectedCels = next;
  highlightTimelineCell();
}
function clearFrameAllLayers(F) {
  for (let L = 0; L < LAYERS_COUNT; L++) {
      const layer = layers[L];
      if (!layer) continue;
      if (!layer.sublayers) layer.sublayers = new Map;
      if (!layer.suborder) layer.suborder = [];
      for (const key of layer.suborder) {
          const sub = layer.sublayers.get(key);
          if (sub?.frames) sub.frames[F] = null;
      }
  }
}
function getCelBundle(F) {
  const bundle = new Array(LAYERS_COUNT);
  for (let L = 0; L < LAYERS_COUNT; L++) {
      const layer = layers[L];
      const entries = [];
      if (layer?.sublayers && layer?.suborder) {
          for (const key of layer.suborder) {
              const sub = layer.sublayers.get(key);
              const c = sub?.frames?.[F];
              if (c && c._hasContent) entries.push([ key, c ]);
          }
      }
      bundle[L] = entries;
  }
  return bundle;
}
function setCelBundle(F, bundle) {
  clearFrameAllLayers(F);
  for (let L = 0; L < LAYERS_COUNT; L++) {
      const entries = bundle[L] || [];
      for (const [key, canvas] of entries) {
          if (!canvas) continue;
          const sub = ensureSublayer(L, key);
          sub.frames[F] = canvas;
      }
  }
}
function moveCelBundle(fromF, toF) {
  if (fromF === toF) return;
  const b = getCelBundle(fromF);
  setCelBundle(toF, b);
  clearFrameAllLayers(fromF);
}

function hasCel(F) {
  return MAIN_LAYERS.some(L => mainLayerHasContent(L, F));
}

function getCelBundle(F) {
  return captureFrameBundle(F);
}
function setCelBundle(F, bundle) {
  pasteFrameBundle(F, bundle);
}
function moveCelBundle(fromF, toF) {
  moveFrameAllLayers(fromF, toF);
}
function deleteSelectedCels() {
  if (!selectedCels.size) return;
  const frames = selectedSorted();
  for (const f of frames) {
      clearFrameAllLayers(f);
  }
  for (let L = 0; L < LAYERS_COUNT; L++) pruneUnusedSublayers(L);
  clearCelSelection();
  queueRenderAll();
  if (hasTimeline) buildTimeline();
  queueUpdateHud();
}
function simulateRoomForDests(dests, dir) {
  const occ = new Uint8Array(totalFrames);
  for (let i = 0; i < totalFrames; i++) occ[i] = hasCel(i) ? 1 : 0;
  for (const f of selectedCels) if (f >= 0 && f < totalFrames) occ[f] = 0;
  const order = dests.slice().sort((a, b) => dir >= 0 ? b - a : a - b);
  const pushes = [];
  for (const d of order) {
      if (d < 0 || d >= totalFrames) return null;
      if (occ[d]) {
          let j = d;
          while (true) {
              j += dir;
              if (j < 0 || j >= totalFrames) return null;
              if (!occ[j]) {
                  occ[j] = 1;
                  occ[d] = 0;
                  pushes.push({
                      from: d,
                      to: j
                  });
                  break;
              }
          }
      }
      occ[d] = 1;
  }
  return pushes;
}
function moveSelectedCelsTo(startFrame) {
  const frames = selectedSorted();
  if (!frames.length) return;
  const base = frames[0];
  if (startFrame === base) return;
  let shift = startFrame - base;
  const minDest = frames[0] + shift;
  const maxDest = frames[frames.length - 1] + shift;
  if (minDest < 0) shift += -minDest;
  if (maxDest > totalFrames - 1) shift -= maxDest - (totalFrames - 1);
  if (shift === 0) return;
  const dests = frames.map(f => f + shift);
  const dir = shift > 0 ? 1 : -1;
  const bundles = frames.map(f => ({
      f: f,
      b: getCelBundle(f)
  }));
  for (const f of frames) clearFrameAllLayers(f);
  const pushes = simulateRoomForDests(dests, dir);
  if (!pushes) {
      for (const it of bundles) setCelBundle(it.f, it.b);
      queueRenderAll();
      if (hasTimeline) buildTimeline();
      return;
  }
  for (const mv of pushes) moveCelBundle(mv.from, mv.to);
  for (let i = 0; i < frames.length; i++) setCelBundle(dests[i], bundles[i].b);
  selectedCels = new Set(dests);
  renderAll();
  if (hasTimeline) buildTimeline();
  gotoFrame(dests[0]);
}
let celDragActive = false;
let celDragSource = -1;
let celDropTarget = -1;
let celDropLastValid = -1;
function setDropTarget(frameIndex) {
  if (!hasTimeline) return;
  const tr = timelineTable.querySelector("tr.anim-row");
  if (!tr) return;
  [ ...tr.children ].forEach((cell, idx) => {
      if (idx > 0) cell.classList.remove("dropTarget");
  });
  if (frameIndex >= 0) {
      const td = tr.children[frameIndex + 1];
      if (td) td.classList.add("dropTarget");
  }
}
function moveCel(srcF, dstF) {
  if (srcF === dstF || srcF < 0 || dstF < 0) return false;
  if (!hasCel(srcF)) return false;
  const saved = captureFrameBundle(srcF);
  clearFrameAllLayers(srcF);
  const dstOccupied = hasCel(dstF);
  if (!dstOccupied) {
      pasteFrameBundle(dstF, saved);
  } else {
      if (srcF < dstF) {
          for (let i = srcF; i < dstF; i++) moveFrameAllLayers(i + 1, i);
          pasteFrameBundle(dstF, saved);
      } else {
          for (let i = srcF - 1; i >= dstF; i--) moveFrameAllLayers(i, i + 1);
          pasteFrameBundle(dstF, saved);
      }
  }
  renderAll();
  if (hasTimeline) buildTimeline();
  gotoFrame(dstF);
  try {
      setSingleSelection(dstF);
  } catch {}
  return true;
}
let scrubbing = false;
let scrubStartFrame = 0;
let scrubMode = "playhead";
let draggingClip = null;
function frameFromClientX(clientX) {
  const playRow = timelineTable.querySelector("tr.playhead-row");
  if (!playRow) return 0;
  const rect = playRow.getBoundingClientRect();
  const x = clamp(clientX - rect.left + timelineScroll.scrollLeft, 0, playRow.scrollWidth);
  const firstW = playRow.children[0]?.getBoundingClientRect().width || 200;
  const cellW = playRow.children[1]?.getBoundingClientRect().width || nowCSSVarPx("--frame-w", 24) || 24;
  const raw = clamp(Math.floor((x - firstW) / cellW), 0, totalFrames - 1);
  return raw;
}
function overAnimRowAt(clientX, clientY) {
  const el = document.elementFromPoint(clientX, clientY);
  return !!(el && el.closest("tr.anim-row"));
}
function celIndices() {
  const list = [];
  for (let i = 0; i < totalFrames; i++) if (hasCel(i)) list.push(i);
  return list;
}

///
// timeline interaction
///
function startTimelineInteraction(e) {
  if (!hasTimeline) return;
  const scrollRect = timelineScroll.getBoundingClientRect();
  const xInScroll = e.clientX - scrollRect.left + timelineScroll.scrollLeft;
  const nearStart = Math.abs(edgeLeftPxOfFrame(clipStart) - xInScroll) < 6;
  const nearEnd = Math.abs(edgeLeftPxOfFrame(clipEnd) - xInScroll) < 6;
  if (nearStart || nearEnd) {
      draggingClip = nearStart ? "start" : "end";
      e.preventDefault();
      return;
  }
  const animCell = e.target.closest("tr.anim-row td");
  if (animCell && animCell.dataset.index !== undefined) {
      const idx = parseInt(animCell.dataset.index, 10);
      if (hasCel(idx)) {
          if (!selectedCels.has(idx)) {
              setSingleSelection(idx);
          }
          if (selectedCels.size > 1) {
              groupDragActive = true;
              groupDropStart = idx;
              setDropTarget(idx);
              setGhostTargetsForStart(idx);
              document.body.classList.add("dragging-cel");
          } else {
              celDragActive = true;
              celDragSource = idx;
              celDropTarget = idx;
              celDropLastValid = idx;
              setDropTarget(idx);
              setGhostTargetSingle(idx);
              document.body.classList.add("dragging-cel");
          }
          e.preventDefault();
          return;
      }
      selectingCels = true;
      selAnchor = idx;
      selLast = idx;
      selectedCels.clear();
      setSelectionRange(selAnchor, selLast);
      document.body.classList.add("selecting-cels");
      e.preventDefault();
      return;
  }
  const playRow = e.target.closest("tr.playhead-row");
  if (!playRow) return;
  scrubbing = true;
  scrubStartFrame = currentFrame;
  scrubMode = "playhead";
  const raw = frameFromClientX(e.clientX);
  gotoFrame(applySnapFrom(scrubStartFrame, raw));
  e.preventDefault();
}
function moveTimelineInteraction(e) {
  if (!hasTimeline) return;
  if (selectingCels) {
      const raw = frameFromClientX(e.clientX);
      selLast = clamp(raw, 0, totalFrames - 1);
      setSelectionRange(selAnchor, selLast);
      e.preventDefault();
      return;
  }
  if (groupDragActive) {
      if (overAnimRowAt(e.clientX, e.clientY)) {
          const raw = frameFromClientX(e.clientX);
          groupDropStart = clamp(raw, 0, totalFrames - 1);
          setDropTarget(groupDropStart);
          setGhostTargetsForStart(groupDropStart);
          gotoFrame(groupDropStart);
      } else {
          groupDropStart = -1;
          setDropTarget(-1);
          clearGhostTargets();
      }
      e.preventDefault();
      return;
  }
  if (celDragActive) {
      if (overAnimRowAt(e.clientX, e.clientY)) {
          const raw = frameFromClientX(e.clientX);
          celDropTarget = clamp(raw, 0, totalFrames - 1);
          celDropLastValid = celDropTarget;
          setDropTarget(celDropTarget);
          setGhostTargetSingle(celDropTarget);
          gotoFrame(celDropTarget);
      } else {
          celDropTarget = -1;
          setDropTarget(-1);
          clearGhostTargets();
      }
      e.preventDefault();
      return;
  }
  if (draggingClip) {
      const raw = frameFromClientX(e.clientX);
      if (draggingClip === "start") {
          clipStart = clamp(raw, 0, clipEnd);
          if (currentFrame < clipStart) gotoFrame(clipStart);
      } else {
          clipEnd = clamp(raw, clipStart, totalFrames - 1);
          if (currentFrame > clipEnd) gotoFrame(clipEnd);
      }
      updateClipMarkers();
      e.preventDefault();
      return;
  }
  if (!scrubbing) return;
  const raw = frameFromClientX(e.clientX);
  gotoFrame(applySnapFrom(scrubStartFrame, raw));
  e.preventDefault();
}
function endTimelineInteraction() {
  if (!hasTimeline) return;
  if (selectingCels) {
      selectingCels = false;
      document.body.classList.remove("selecting-cels");
  }
  if (groupDragActive) {
      const target = groupDropStart;
      setDropTarget(-1);
      clearGhostTargets();
      groupDragActive = false;
      groupDropStart = -1;
      document.body.classList.remove("dragging-cel");
      if (target >= 0 && selectedCels.size) moveSelectedCelsTo(target);
  }
  if (celDragActive) {
      const target = celDropTarget >= 0 ? celDropTarget : celDropLastValid;
      setDropTarget(-1);
      clearGhostTargets();
      celDragActive = false;
      document.body.classList.remove("dragging-cel");
      if (target >= 0) moveCel(celDragSource, target);
      celDropTarget = -1;
      celDropLastValid = -1;
  }
  scrubbing = false;
  draggingClip = null;
}
if (hasTimeline) {
  timelineScroll.addEventListener("pointerdown", startTimelineInteraction, {
      passive: false
  });
  window.addEventListener("pointermove", moveTimelineInteraction, {
      passive: false
  });
  window.addEventListener("pointerup", endTimelineInteraction, {
      passive: true
  });
}

///
// Playback controls
///

function stopPlayback() {
  if (!isPlaying) return;
  isPlaying = false;
  clearInterval(playTimer);
  playTimer = null;
}
function applyPlayButtonsState() {
  const playBtn = $("playBtn");
  const pauseBtn = $("pauseBtn");
  const stopBtn = $("stopBtn");
  if (!playBtn || !pauseBtn || !stopBtn) return;
  playBtn.disabled = isPlaying;
  pauseBtn.disabled = !isPlaying;
  stopBtn.disabled = !isPlaying;
}
function startPlayback() {
  if (isPlaying) return;
  prevOnionState = onionEnabled;
  prevTransState = transparencyHoldEnabled;
  restoreOnionAfterPlay = false;
  restoreTransAfterPlay = false;
  if (!keepOnionWhilePlaying && onionEnabled) {
      onionEnabled = false;
      restoreOnionAfterPlay = true;
      if (toggleOnionBtn) toggleOnionBtn.textContent = "Onion: Off";
  }
  if (!keepTransWhilePlaying && transparencyHoldEnabled) {
      transparencyHoldEnabled = false;
      restoreTransAfterPlay = true;
      if (toggleTransparencyBtn) toggleTransparencyBtn.textContent = "Transparency: Off";
  }
  renderAll();
  isPlaying = true;
  applyPlayButtonsState();
  const interval = 1e3 / fps;
  if (currentFrame < clipStart || currentFrame > clipEnd) gotoFrame(clipStart);
  playTimer = setInterval(() => {
      if (currentFrame >= clipEnd) {
          if (loopPlayback) gotoFrame(clipStart); else {
              pausePlayback();
              return;
          }
      } else {
          const step = playSnapped ? Math.max(1, snapFrames) : 1;
          const next = Math.min(clipEnd, currentFrame + step);
          gotoFrame(next);
      }
  }, interval);
}
function pausePlayback() {
  if (!isPlaying) return;
  stopPlayback();
  applyPlayButtonsState();
  if (restoreOnionAfterPlay) {
      onionEnabled = prevOnionState;
      if (toggleOnionBtn) toggleOnionBtn.textContent = `Onion: ${onionEnabled ? "On" : "Off"}`;
      restoreOnionAfterPlay = false;
  }
  if (restoreTransAfterPlay) {
      transparencyHoldEnabled = prevTransState;
      if (toggleTransparencyBtn) toggleTransparencyBtn.textContent = `Transparency: ${transparencyHoldEnabled ? "On" : "Off"}`;
      restoreTransAfterPlay = false;
  }
  renderAll();
}
function stopAndRewind() {
  if (isPlaying) pausePlayback();
  gotoFrame(clipStart);
  const stopBtn = $("stopBtn");
  if (stopBtn) stopBtn.disabled = true;
}

function nearestPrevCelIndex(F) {
  for (let i = F - 1; i >= 0; i--) if (hasCel(i)) return i;
  return -1;
}
function nearestNextCelIndex(F) {
  for (let i = F + 1; i < totalFrames; i++) if (hasCel(i)) return i;
  return -1;
}

///
// TIMELINNE INIT FUNCTIONALITY
///

function initTimelineOnionContextMenu() {
  const onionBtn = $("tlOnion");
  const menu = $("onionCtxMenu");
  const block = $("onionOptionsBlock");
  if (!onionBtn || !menu || !block) return;
  if (menu._wired) return;
  menu._wired = true;
  const homeParent = block.parentNode;
  const homeNext = block.nextSibling;
  function placeMenu(x, y) {
      menu.style.left = x + "px";
      menu.style.top = y + "px";
      const r = menu.getBoundingClientRect();
      const pad = 8;
      let nx = x, ny = y;
      if (r.right > window.innerWidth - pad) nx -= r.right - (window.innerWidth - pad);
      if (r.bottom > window.innerHeight - pad) ny -= r.bottom - (window.innerHeight - pad);
      if (nx < pad) nx = pad;
      if (ny < pad) ny = pad;
      menu.style.left = nx + "px";
      menu.style.top = ny + "px";
  }
  function openAt(x, y) {
      menu.innerHTML = "";
      menu.appendChild(block);
      menu.classList.add("open");
      menu.setAttribute("aria-hidden", "false");
      placeMenu(x, y);
  }
  function close() {
      if (!menu.classList.contains("open")) return;
      if (homeParent) {
          if (homeNext && homeNext.parentNode === homeParent) homeParent.insertBefore(block, homeNext); else homeParent.appendChild(block);
      }
      menu.classList.remove("open");
      menu.setAttribute("aria-hidden", "true");
      menu.style.left = "";
      menu.style.top = "";
  }
  onionBtn.addEventListener("contextmenu", e => {
      e.preventDefault();
      e.stopPropagation();
      openAt(e.clientX, e.clientY);
  }, {
      passive: false
  });
  window.addEventListener("pointerdown", e => {
      if (!menu.classList.contains("open")) return;
      if (e.target === menu || menu.contains(e.target)) return;
      close();
  }, {
      passive: true
  });
  window.addEventListener("keydown", e => {
      if (e.key === "Escape") close();
  });
  window.addEventListener("resize", close, {
      passive: true
  });
  window.addEventListener("scroll", close, {
      passive: true,
      capture: true
  });
}

function initMobileTimelineScrub() {
  const row = $("tlPlayheadRow") || document.querySelector(".playheadRow") || document.querySelector("[data-playhead-row]");
  if (!row || row._mobileScrubWired) return;
  row._mobileScrubWired = true;
  function findScroller(el) {
      const cand = el.closest("#timelineViewport") || el.closest("#timelineScroll") || el.closest(".timelineViewport") || el.closest(".timelineScroll") || el.closest(".tlViewport") || el.closest(".tlScroll");
      if (cand) return cand;
      let p = el.parentElement;
      while (p && p !== document.body) {
          const cs = getComputedStyle(p);
          if ((cs.overflowX === "auto" || cs.overflowX === "scroll") && p.scrollWidth > p.clientWidth) return p;
          p = p.parentElement;
      }
      return null;
  }
  const scroller = findScroller(row);
  function getFrameW() {
      const v = parseFloat(getComputedStyle(row).getPropertyValue("--tl-frame-w"));
      if (Number.isFinite(v) && v > 0) return v;
      const cell = row.querySelector(".frameCell, .tlCell, [data-frame-cell]");
      if (cell) {
          const r = cell.getBoundingClientRect();
          if (r.width > 0) return r.width;
      }
      return 16;
  }
  function applyScrubFrame(frame) {
      frame = Math.max(0, frame | 0);
      if (typeof window.gotoFrame === "function") {
          window.gotoFrame(frame);
          return;
      }
      if (window.state && typeof window.state === "object") {
          if ("frame" in window.state) window.state.frame = frame; else if ("playhead" in window.state) window.state.playhead = frame; else if ("curFrame" in window.state) window.state.curFrame = frame;
      }
      if (typeof window.renderAll === "function") window.renderAll(); else if (typeof window.renderTimeline === "function") window.renderTimeline();
  }
  function scrubAtClientX(clientX) {
      const r = row.getBoundingClientRect();
      const frameW = getFrameW();
      let x = clientX - r.left;
      const scrollX = scroller ? scroller.scrollLeft : 0;
      const xInContent = x + scrollX;
      const frame = Math.floor(xInContent / frameW);
      applyScrubFrame(frame);
  }
  let active = false;
  let activeId = -1;
  row.addEventListener("pointerdown", e => {
      if (e.pointerType !== "touch") return;
      if (!e.isPrimary) return;
      active = true;
      activeId = e.pointerId;
      e.preventDefault();
      e.stopPropagation();
      try {
          row.setPointerCapture(activeId);
      } catch {}
      scrubAtClientX(e.clientX);
  }, {
      passive: false
  });
  row.addEventListener("pointermove", e => {
      if (!active || e.pointerId !== activeId) return;
      e.preventDefault();
      e.stopPropagation();
      scrubAtClientX(e.clientX);
  }, {
      passive: false
  });
  function end(e) {
      if (!active || e.pointerId !== activeId) return;
      e.preventDefault();
      e.stopPropagation();
      active = false;
      activeId = -1;
  }
  row.addEventListener("pointerup", end, {
      passive: false
  });
  row.addEventListener("pointercancel", end, {
      passive: false
  });
}

function initTimelineToggleBridge() {
  const tlOnion = $("tlOnion");
  const btnOnion = $("toggleOnion");
  if (!tlOnion) return;
  const btnIsOn = btn => {
      if (!btn) return null;
      const t = (btn.textContent || "").toLowerCase();
      if (t.includes("off")) return false;
      if (t.includes("on")) return true;
      return null;
  };
  function syncOnionFromButton() {
      const s = btnIsOn(btnOnion);
      if (s === null) return;
      tlOnion.checked = s;
  }
  tlOnion.addEventListener("change", () => {
      if (!btnOnion) return;
      const cur = btnIsOn(btnOnion);
      const want = !!tlOnion.checked;
      if (cur === null || cur !== want) btnOnion.click();
      syncOnionFromButton();
  });
  if (btnOnion) {
      btnOnion.addEventListener("click", () => {
          setTimeout(syncOnionFromButton, 0);
      });
      syncOnionFromButton();
  }
}