// island: floating window which can be dragged around

function mountIslandSlots() {
  const island = $("floatingIsland");
  const wheelSlot = $("islandWheelSlot");
  const brushesSlot = $("islandBrushesSlot");
  const toolsSlot = $("islandToolsSlot");
  const layersSlot = $("islandLayersSlot");
  if (!island || !wheelSlot || !toolsSlot || !layersSlot) return;
  const wheelWrap = $("hsvWheelWrap");
  if (wheelWrap && wheelWrap.parentElement !== wheelSlot) {
      wheelSlot.appendChild(wheelWrap);
  }
  const toolSeg = $("toolSeg");
  if (toolSeg && toolSeg.parentElement !== toolsSlot) {
      toolsSlot.appendChild(toolSeg);
  }
  const mainBrushSizeGroup = $("mainBrushSizeGroup");
  if (mainBrushSizeGroup && mainBrushSizeGroup.parentElement !== toolsSlot) {
      toolsSlot.appendChild(mainBrushSizeGroup);
  }
  const brushSeg = $("brushSeg");
  if (brushSeg && brushSeg.parentElement !== brushesSlot) {
      brushesSlot.appendChild(brushSeg);
  }
  const layerSeg = $("layerSeg");
  if (layerSeg && layerSeg.parentElement !== layersSlot) {
      layersSlot.appendChild(layerSeg);
  }
  try {
      drawHSVWheel?.();
  } catch {}
  try {
      requestAnimationFrame(() => {
          try {
              drawHSVWheel?.();
          } catch {}
      });
  } catch {}
}

function initIslandMinimizeTab() {
  const island = $("floatingIsland");
  const collapseBtn = $("islandCollapseBtn");
  const tabBtn = $("islandTab");
  if (!island || !collapseBtn || !tabBtn) return;
  const LS_KEY = "celstomp_island_collapsed";
  const stop = e => {
      e.stopPropagation();
  };
  [ "pointerdown", "mousedown", "touchstart" ].forEach(evt => {
      collapseBtn.addEventListener(evt, stop, {
          passive: true
      });
      tabBtn.addEventListener(evt, stop, {
          passive: true
      });
  });
  if (island._minWired) return;
  island._minWired = true;
  function setCollapsed(v) {
      const yes = !!v;
      island.classList.toggle("collapsed", yes);
      try {
          localStorage.setItem(LS_KEY, yes ? "1" : "0");
      } catch {}
  }
  function toggleCollapsed() {
      setCollapsed(!island.classList.contains("collapsed"));
  }
  try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved === "1") island.classList.add("collapsed");
  } catch {}
  collapseBtn.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
      toggleCollapsed();
  }, {
      passive: false
  });
  tabBtn.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
      setCollapsed(false);
  }, {
      passive: false
  });
  const header = $("floatingIslandHeader");
  if (header) {
      header.addEventListener("dblclick", e => {
          if (e.target && e.target.closest("button")) return;
          e.preventDefault();
          toggleCollapsed();
      }, {
          passive: false
      });
  }
}

function initIslandSidePanel() {
  const island = $("floatingIsland");
  if (!island) return;
  const dock = island.closest(".islandDock") || island;
  const sideBtn = dock.querySelector("#islandSideBtn") || $("islandSideBtn");
  const sidePanel = dock.querySelector("#islandSidePanel") || $("islandSidePanel");
  if (!sideBtn || !sidePanel) return;
  if (sidePanel.parentElement !== dock) dock.appendChild(sidePanel);
  const LS_KEY = "celstomp_island_side_open";
  if (dock._sideWired) return;
  dock._sideWired = true;
  const stopProp = e => {
      e.stopPropagation();
  };
  let _lastToggleAt = 0;
  function toggleOpenOnce() {
      const t = performance.now();
      if (t - _lastToggleAt < 280) return;
      _lastToggleAt = t;
      toggleOpen();
  }
  function setOpen(v) {
      const yes = !!v;
      dock.classList.toggle("side-open", yes);
      island.classList.toggle("side-open", yes);
      sidePanel.setAttribute("aria-hidden", yes ? "false" : "true");
      sideBtn.textContent = yes ? "<" : ">";
      sidePanel.hidden = !yes;
      try {
          localStorage.setItem(LS_KEY, yes ? "1" : "0");
      } catch {}
  }
  function toggleOpen() {
      setOpen(!dock.classList.contains("side-open"));
  }
  [ "touchstart", "pointerdown", "mousedown" ].forEach(evt => {
      sideBtn.addEventListener(evt, stopProp, {
          capture: true,
          passive: true
      });
  });
  sideBtn.addEventListener("pointerdown", e => {
      e.preventDefault();
      e.stopPropagation();
      toggleOpenOnce();
  }, {
      capture: true,
      passive: false
  });
  sideBtn.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
      toggleOpenOnce();
  }, {
      capture: true,
      passive: false
  });
  try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved === "1") setOpen(true);
  } catch {}
  const mo = new MutationObserver(() => {
      if (island.classList.contains("collapsed") || dock.classList.contains("collapsed")) setOpen(false);
  });
  mo.observe(island, {
      attributes: true,
      attributeFilter: [ "class" ]
  });
}

function wireFloatingIslandDrag() {
  const dock = $("floatingIsland") || document.querySelector(".islandDock");
  if (!dock) return;
  const head = dock.querySelector(".islandHeader");
  if (!head) return;
  if (dock._dragWired) return;
  dock._dragWired = true;
  let dragging = false;
  let pid = null;
  let offX = 0;
  let offY = 0;
  let cachedHeaderH = 48;
  let cachedVW = window.innerWidth;
  let cachedVH = window.innerHeight;
  let cachedW = 0;
  let cachedH = 0;
  const pad = 8;
  const updateCache = () => {
      cachedHeaderH = typeof nowCSSVarPx === "function" ? nowCSSVarPx("--header-h", 48) : 48;
      cachedVW = window.innerWidth;
      cachedVH = window.innerHeight;
      const r = dock.getBoundingClientRect();
      cachedW = r.width;
      cachedH = r.height;
  };
  const clampPos = (x, y) => {
      // O(1) calculation using cached values to prevent Layout Thrashing
      x = Math.max(pad, Math.min(cachedVW - cachedW - pad, x));
      y = Math.max(cachedHeaderH + pad, Math.min(cachedVH - cachedH - pad, y));
      return { x, y };
  };
  head.addEventListener("pointerdown", e => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (e.target.closest(".islandBtn, .islandBtns, .islandResizeHandle")) return;
      
      updateCache();
      
      const r = dock.getBoundingClientRect();
      offX = e.clientX - r.left;
      offY = e.clientY - r.top;
      dragging = true;
      pid = e.pointerId;
      dock.classList.add("dragging");
      try {
          head.setPointerCapture(pid);
      } catch {}
      e.preventDefault();
  }, {
      passive: false
  });
  window.addEventListener("pointermove", e => {
      if (!dragging || e.pointerId !== pid) return;
      const pos = clampPos(e.clientX - offX, e.clientY - offY);
      dock.style.left = pos.x + "px";
      dock.style.top = pos.y + "px";
      e.preventDefault();
  }, {
      passive: false
  });
  const end = e => {
      if (!dragging || pid != null && e.pointerId !== pid) return;
      dragging = false;
      dock.classList.remove("dragging");
      try {
          head.releasePointerCapture(pid);
      } catch {}
      pid = null;
  };

  window.addEventListener("pointerup", end, {
      passive: true
  });
  window.addEventListener("pointercancel", end, {
      passive: true
  });
}

let _islandLayerAutoFit = null;
        
function initIslandLayerAutoFit() {
    if (_islandLayerAutoFit) return;
    const st = {
        raf: 0,
        lastScale: 1,
        ro: null,
        mo: null,
        docMo: null
    };
    function schedule() {
        if (st.raf) return;
        st.raf = requestAnimationFrame(() => {
            st.raf = 0;
            apply();
        });
    }
    function apply() {
        const slot = $("islandLayersSlot");
        const seg = $("layerSeg");
        if (!slot || !seg) return;
        if (!slot.contains(seg)) {
            if (st.lastScale !== 1) {
                seg.style.transform = "";
                seg.style.transformOrigin = "";
                seg.style.willChange = "";
                st.lastScale = 1;
            }
            return;
        }
        const cs = getComputedStyle(slot);
        const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
        const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
        const availH = Math.max(10, slot.clientHeight - padY);
        const availW = Math.max(10, slot.clientWidth - padX);
        const naturalH = Math.max(1, seg.scrollHeight);
        const naturalW = Math.max(1, seg.scrollWidth);
        let s = Math.min(1, availH / naturalH, availW / naturalW);
        s = Math.max(.25, s);
        s = Math.round(s * 100) / 100;
        if (Math.abs(s - st.lastScale) < .01) return;
        st.lastScale = s;
        seg.style.transformOrigin = "top left";
        seg.style.transform = `scale(${s})`;
        seg.style.willChange = "transform";
    }
    function startObservers() {
        const slot = $("islandLayersSlot");
        const seg = $("layerSeg");
        if (!slot || !seg) return;
        st.ro = new ResizeObserver(schedule);
        st.ro.observe(slot);
        st.mo = new MutationObserver(schedule);
        st.mo.observe(seg, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true
        });
        st.mo.observe(slot, {
            childList: true,
            subtree: true
        });
        window.addEventListener("resize", schedule, {
            passive: true
        });
        apply();
    }
    st.docMo = new MutationObserver(() => {
        schedule();
        const slot = $("islandLayersSlot");
        const seg = $("layerSeg");
        if (slot && seg && slot.contains(seg)) {
            if (!st.ro) startObservers();
        }
    });
    st.docMo.observe(document.body, {
        childList: true,
        subtree: true
    });
    schedule();
    _islandLayerAutoFit = st;
}

function wireIslandResize() {
  const dock = document.querySelector(".islandDock") || $("floatingIsland");
  if (!dock || dock._islandResizeWired) return;
  dock._islandResizeWired = true;
  let handle = dock.querySelector(".islandResizeHandle");
  if (!handle) {
      handle = document.createElement("div");
      handle.className = "islandResizeHandle";
      handle.title = "Resize";
      dock.appendChild(handle);
  }
  const KEY = "celstomp_island_rect_v1";
  const minW = 240;
  const minH = 300;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "null");
      if (saved && Number.isFinite(saved.w) && Number.isFinite(saved.h)) {
          dock.style.width = saved.w + "px";
          dock.style.height = saved.h + "px";
      }
      if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
          dock.style.left = saved.x + "px";
          dock.style.top = saved.y + "px";
      }
  } catch {}
  let start = null;
  handle.addEventListener("pointerdown", e => {
      e.preventDefault();
      e.stopPropagation();
      const r = dock.getBoundingClientRect();
      start = {
          id: e.pointerId,
          x: e.clientX,
          y: e.clientY,
          w: r.width,
          h: r.height,
          left: r.left,
          top: r.top
      };
      dock.classList.add("resizing");
      try {
          handle.setPointerCapture(e.pointerId);
      } catch {}
  }, {
      passive: false
  });
  handle.addEventListener("pointermove", e => {
      if (!start || e.pointerId !== start.id) return;
      const maxW = window.innerWidth - start.left - 8;
      const maxH = window.innerHeight - start.top - 8;
      const w = clamp(start.w + (e.clientX - start.x), minW, Math.max(minW, maxW));
      const h = clamp(start.h + (e.clientY - start.y), minH, Math.max(minH, maxH));
      dock.style.width = w + "px";
      dock.style.height = h + "px";
  });
  const end = e => {
      if (!start || e.pointerId !== start.id) return;
      try {
          handle.releasePointerCapture(start.id);
      } catch {}
      dock.classList.remove("resizing");
      try {
          const r = dock.getBoundingClientRect();
          localStorage.setItem(KEY, JSON.stringify({
              x: Math.round(r.left),
              y: Math.round(r.top),
              w: Math.round(r.width),
              h: Math.round(r.height)
          }));
      } catch {}
      start = null;
  };
  handle.addEventListener("pointerup", end);
  handle.addEventListener("pointercancel", end);
}