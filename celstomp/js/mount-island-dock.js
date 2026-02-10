function mountIslandDock() {
  const island = document.getElementById("islandDock");
  if (!island) return;
  const header = document.getElementById("islandHeader");
  const tab = document.getElementById("islandTab");
  const btnCollapse = document.getElementById("islandCollapse");
  const btnReset = document.getElementById("islandReset");
  const wheelSlot = document.getElementById("islandWheelSlot");
  const toolsSlot = document.getElementById("islandToolsSlot");
  const layersSlot = document.getElementById("islandLayersSlot");
  const wheelWrap = document.getElementById("hsvWheelWrap");
  const toolSegEl = document.getElementById("toolSeg");
  const layerSegEl = document.getElementById("layerSeg");
  const toolPopup = document.getElementById("toolOptionsPopup");
  const eraserPopup = document.getElementById("eraserOptionsPopup");
  if (wheelWrap && wheelSlot && wheelWrap.parentElement !== wheelSlot) wheelSlot.appendChild(wheelWrap);
  if (toolSegEl && toolsSlot && toolSegEl.parentElement !== toolsSlot) toolsSlot.appendChild(toolSegEl);
  if (layerSegEl && layersSlot && layerSegEl.parentElement !== layersSlot) layersSlot.appendChild(layerSegEl);
  if (toolPopup && toolPopup.parentElement !== island) island.appendChild(toolPopup);
  if (eraserPopup && eraserPopup.parentElement !== island) island.appendChild(eraserPopup);
  _wireIslandIcons(toolSegEl);
  _wireIslandCollapse(island, tab, btnCollapse);
  _wireIslandReset(island, btnReset);
  _wireIslandDrag(island, header);
  _applyIslandSavedPos(island);
}

const ISLAND_POS_KEY = "celstomp.island.pos";
///////////////////
// PRIVATE FUNCS //
///////////////////

function _applyIslandSavedPos(island) {
  try {
      const raw = localStorage.getItem(ISLAND_POS_KEY);
      if (!raw) return;
      const p = JSON.parse(raw);
      if (Number.isFinite(p.left)) island.style.left = `${p.left}px`;
      if (Number.isFinite(p.top)) island.style.top = `${p.top}px`;
  } catch {}
}
function _saveIslandPos(island) {
  try {
      const r = island.getBoundingClientRect();
      localStorage.setItem(ISLAND_POS_KEY, JSON.stringify({
          left: Math.round(r.left),
          top: Math.round(r.top)
      }));
  } catch {}
}
function _wireIslandDrag(island, handle) {
  if (!island || !handle || handle._islandDragWired) return;
  handle._islandDragWired = true;
  let pid = null;
  let dragging = false;
  let startX = 0, startY = 0;
  let startL = 0, startT = 0;
  const onMove = e => {
      if (!dragging || e.pointerId !== pid) return;
      const nx = startL + (e.clientX - startX);
      const ny = startT + (e.clientY - startY);
      const w = island.offsetWidth || 360;
      const h = island.offsetHeight || 300;
      const maxL = Math.max(8, window.innerWidth - w - 8);
      const maxT = Math.max(8, window.innerHeight - h - 8);
      island.style.left = `${clamp(nx, 8, maxL)}px`;
      island.style.top = `${clamp(ny, 8, maxT)}px`;
      e.preventDefault();
  };
  const onUp = e => {
      if (!dragging || e.pointerId !== pid) return;
      dragging = false;
      island.classList.remove("dragging");
      try {
          handle.releasePointerCapture(pid);
      } catch {}
      pid = null;
      saveIslandPos(island);
  };
  handle.addEventListener("pointerdown", e => {
      if (e.button !== 0) return;
      pid = e.pointerId;
      dragging = true;
      const r = island.getBoundingClientRect();
      startL = r.left;
      startT = r.top;
      startX = e.clientX;
      startY = e.clientY;
      island.classList.add("dragging");
      try {
          handle.setPointerCapture(pid);
      } catch {}
      e.preventDefault();
  }, {
      passive: false
  });
  handle.addEventListener("pointermove", onMove, {
      passive: false
  });
  handle.addEventListener("pointerup", onUp, {
      passive: false
  });
  handle.addEventListener("pointercancel", onUp, {
      passive: false
  });
}
function _wireIslandCollapse(island, tab, btnCollapse) {
  if (!island || island._islandCollapseWired) return;
  island._islandCollapseWired = true;
  const setCollapsed = v => {
      island.classList.toggle("collapsed", !!v);
      if (tab) tab.setAttribute("aria-hidden", v ? "false" : "true");
  };
  btnCollapse?.addEventListener("click", e => {
      e.preventDefault();
      setCollapsed(!island.classList.contains("collapsed"));
  });
  tab?.addEventListener("click", e => {
      e.preventDefault();
      setCollapsed(false);
  });
}
function _wireIslandReset(island, btnReset) {
  btnReset?.addEventListener("click", e => {
      e.preventDefault();
      try {
          localStorage.removeItem(ISLAND_POS_KEY);
      } catch {}
      island.style.left = "18px";
      island.style.top = "calc(var(--header-h) + 28px)";
  });
}
function _wireIslandIcons(toolSegEl) {
  if (!toolSegEl || toolSegEl._islandIconsWired) return;
  toolSegEl._islandIconsWired = true;
  const map = {
      "tool-brush": "./icons/tool-brush.svg",
      "tool-eraser": "./icons/tool-eraser.svg",
      "tool-filleraser": "./icons/tool-fill-eraser.svg",
      "tool-fillbrush": "./icons/tool-fill-brush.svg",
      "tool-lassoFill": "./icons/tool-lasso-fill.svg",
      "tool-lassoErase": "./icons/tool-lasso-erase.svg"
  };
  for (const [inputId, path] of Object.entries(map)) {
      const lab = toolSegEl.querySelector(`label[for="${inputId}"]`);
      if (!lab) continue;
      lab.style.setProperty("--tool-icon", `url("${path}")`);
      const txt = (lab.textContent || "").trim();
      if (txt) lab.setAttribute("aria-label", txt);
  }
}