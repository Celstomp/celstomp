

(() => {
  "use strict";

  // -------------------------
  // Helpers
  // -------------------------

  // CLIP_TO_BELOW (unique anchor)
  function isClipEligibleMainLayer(kindOrType){
    const k = String(kindOrType || "").toLowerCase();
    return (k === "line" || k === "shade" || k === "color");
  }

  // two offscreen buffers:
  // - _clipWork: used to apply destination-in mask
  // - _clipMask: holds the effective alpha of the most recent visible layer below
  const _clipWork = document.createElement("canvas");
  const _clipWorkCtx = _clipWork.getContext("2d");
  const _clipMask = document.createElement("canvas");
  const _clipMaskCtx = _clipMask.getContext("2d");

  function ensureClipBuffers(w, h){
    if (_clipWork.width !== w || _clipWork.height !== h){
      _clipWork.width = w; _clipWork.height = h;
    }
    if (_clipMask.width !== w || _clipMask.height !== h){
      _clipMask.width = w; _clipMask.height = h;
    }
  }

  // -------------------------
  // Live native color dialog helper
  // - Continuous preview while dragging
  // - Stops when dialog closes (window focus returns)
  // - Best-effort cancel: if no change, revert
  // -------------------------
  let _liveColorDialogLock = false;

  function rafThrottle(fn){
    let queued = false;
    let lastArgs = null;
    return (...args) => {
      lastArgs = args;
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        fn(...lastArgs);
      });
    };
  }

  function openLiveColorDialog({
    initialHex = "#ffffff",
    onLive = null,    // (hex) => void  (preview)
    onCommit = null,  // (hex) => void  (final)
    onCancel = null,  // () => void     (revert)
  } = {}){
    if (_liveColorDialogLock) return;
    _liveColorDialogLock = true;

    const picker = document.createElement("input");
    picker.type = "color";
    picker.value = initialHex || "#ffffff";
    picker.style.position = "fixed";
    picker.style.left = "-9999px";
    picker.style.top = "-9999px";
    picker.style.opacity = "0";
    picker.style.pointerEvents = "none";
    document.body.appendChild(picker);

    const startHex = picker.value;
    let committed = false;

    const liveThrottled = rafThrottle((hex) => {
      try { onLive && onLive(hex); } catch {}
    });

    let lastPolled = picker.value;
    const poll = setInterval(() => {
      const v = picker.value;
      if (v && v !== lastPolled){
        lastPolled = v;
        liveThrottled(v);
      }
    }, 33);

    const cleanup = () => {
      clearInterval(poll);
      window.removeEventListener("focus", onWinFocus, true);
      picker.removeEventListener("input", onInp);
      picker.removeEventListener("change", onChg);
      picker.remove();
      _liveColorDialogLock = false;
    };

    const onInp = () => liveThrottled(picker.value);

    const onChg = () => {
      committed = true;
      const v = picker.value || startHex;
      try { (onCommit || onLive) && (onCommit ? onCommit(v) : onLive(v)); } catch {}
      cleanup();
    };

    // When the native dialog closes, window focus typically returns.
    const onWinFocus = () => {
      // Give 'change' a chance to fire first.
      setTimeout(() => {
        if (committed) return;

        const v = picker.value || startHex;

        // If nothing changed -> treat as cancel (revert)
        if (v === startHex){
          try { onCancel && onCancel(); } catch {}
        } else {
          // Some browsers may not fire change; treat as commit if value changed.
          try { (onCommit || onLive) && (onCommit ? onCommit(v) : onLive(v)); } catch {}
        }

        cleanup();
      }, 0);
    };

    picker.addEventListener("input", onInp);
    picker.addEventListener("change", onChg);
    window.addEventListener("focus", onWinFocus, true);

    // Apply initial preview immediately (so UI matches at open)
    liveThrottled(startHex);

    picker.click();
  }


  
  // -------------------------
  // Cursor-anchored color picker
  // -------------------------
  let _cursorColorPicker = null;

  function ensureCursorColorPicker(){
    // if the old node got removed somehow, rebuild it
    if (_cursorColorPicker && document.body.contains(_cursorColorPicker)) return _cursorColorPicker;
    if (_cursorColorPicker) { try { _cursorColorPicker.remove(); } catch {} _cursorColorPicker = null; }

    const inp = document.createElement("input");
    inp.type = "color";
    inp.id = "cursorColorPicker";

    // IMPORTANT: must be "rendered" (not opacity:0, not offscreen) for reliable re-open
    Object.assign(inp.style, {
      position: "fixed",
      left: "0px",
      top: "0px",
      width: "1px",
      height: "1px",
      opacity: "0.01",
      zIndex: "2147483647",
      border: "0",
      padding: "0",
      margin: "0",
      background: "transparent",
      pointerEvents: "auto"
    });

    document.body.appendChild(inp);
    _cursorColorPicker = inp;
    return inp;
  }




  // Open native color dialog "at" cursor by positioning the hidden input there.
  function openColorPickerAtCursor(e, initialHex, onPick){
    const picker = ensureCursorColorPicker();

    // position near cursor (clamped)
    const pad = 8;
    const w = 1, h = 1; // we force 1px size above
    const x = Math.max(0, Math.min(window.innerWidth  - w - 1, (e?.clientX ?? 0) + pad));
    const y = Math.max(0, Math.min(window.innerHeight - h - 1, (e?.clientY ?? 0) + pad));
    picker.style.left = x + "px";
    picker.style.top  = y + "px";

    const norm = (typeof normalizeToHex === "function")
      ? normalizeToHex(initialHex || "#000000")
      : (initialHex || "#000000");

    try { picker.value = norm; } catch {}

    // cleanup previous handler
    if (picker._pickCleanup) picker._pickCleanup();

    let fired = false;
    
    const finish = () => {
      if (fired) return;
      fired = true;

      const v = picker.value || norm;

      // cleanup handlers immediately (prevents “stuck” state)
      try { picker._pickCleanup?.(); } catch {}
      try { picker.blur?.(); } catch {}

      try { onPick?.(v); } catch {}
    };

    

    const onInput = () => finish();
    const onChange = () => finish();



    picker.addEventListener("input", onInput, { passive: true });
    picker.addEventListener("change", onChange, { passive: true });

    picker._pickCleanup = () => {
      picker.removeEventListener("input", onInput);
      picker.removeEventListener("change", onChange);
      picker._pickCleanup = null;
    };

        // ✅ best effort: focus first (some browsers require this)
    try { picker.focus({ preventScroll: true }); } catch {}

    // ✅ open picker (Chromium showPicker, else click)
    let opened = false;
    try {
      if (picker.showPicker) { picker.showPicker(); opened = true; }
    } catch {}

    if (!opened) {
      try { picker.click(); opened = true; } catch {}
    }

    // ✅ last resort: rebuild the input and click again (fixes "works once" cases)
    if (!opened) {
      try { picker.remove(); } catch {}
      _cursorColorPicker = null;
      const p2 = ensureCursorColorPicker();
      p2.style.left = x + "px";
      p2.style.top  = y + "px";
      try { p2.value = norm; } catch {}
      try { p2.focus({ preventScroll: true }); } catch {}
      try { p2.click(); } catch {}
    }

  }

  function openColorPickerAtElement(anchorEl, initialHex, onPick){
    const r = anchorEl?.getBoundingClientRect?.();
    const fakeEvent = {
      clientX: r ? (r.left + r.width / 2) : (window.innerWidth / 2),
      clientY: r ? (r.top  + r.height / 2) : (window.innerHeight / 2),
    };
    openColorPickerAtCursor(fakeEvent, initialHex, onPick);
  }





  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sleep = (ms = 0) => new Promise((r) => setTimeout(r, ms));

  function safeText(el, txt) {
    if (el) el.textContent = txt;
  }

  function safeSetValue(el, v) {
    if (!el) return;
    el.value = String(v);
  }

  function safeSetChecked(el, v) {
    if (!el) return;
    el.checked = !!v;
  }

  function nowCSSVarPx(name, fallback) {
    try {
      const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : fallback;
    } catch {
      return fallback;
    }
  }

  // -------------------------
  // Boot
  // -------------------------
  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn, { once: true });
    else fn();
  }

  ready(() => {
    // -------------------------
    // Core config
    // -------------------------
    let contentW = 960;
    let contentH = 540;

    // -------------------------
    // DOM essentials
    // -------------------------
    const stageEl = $("stage");
    const boundsCanvas = $("boundsCanvas");
    const drawCanvas = $("drawCanvas");
    const fxCanvas = $("fxCanvas");

    // Ensure canvases live inside #stage (so absolute positioning is correct)
    function ensureChild(parent, el) {
      if (!parent || !el) return;
      if (el.parentElement !== parent) parent.appendChild(el);
    }
    ensureChild(stageEl, boundsCanvas);
    ensureChild(stageEl, drawCanvas);
    ensureChild(stageEl, fxCanvas);


    if (!stageEl || !boundsCanvas || !drawCanvas || !fxCanvas) {
      console.warn("[celstomp] Missing required DOM: #stage/#boundsCanvas/#drawCanvas/#fxCanvas");
      return;
    }

    const bctx = boundsCanvas.getContext("2d");
    const dctx =
      drawCanvas.getContext("2d", { desynchronized: true }) ||
      drawCanvas.getContext("2d");

    const fxctx = fxCanvas.getContext("2d");

    // ✅ HARD GUARD: ensure these are real canvases + contexts
    if (
      !(boundsCanvas instanceof HTMLCanvasElement) ||
      !(drawCanvas instanceof HTMLCanvasElement) ||
      !(fxCanvas instanceof HTMLCanvasElement) ||
      !bctx || !dctx || !fxctx
    ) {
      console.warn("[celstomp] Canvas/context init failed:", {
        boundsCanvas, drawCanvas, fxCanvas, bctx, dctx, fxctx
      });
      return;
    }

    // HUD
    const hudFps = $("hudFps");
    const zoomInfo = $("zoomInfo");
    const frameInfo = $("frameInfo");
    const hudTime = $("hudTime");
    const timeCounter = $("timeCounter");
    const toolName = $("toolName");
    const fpsLabel = $("fpsLabel");
    const secLabel = $("secLabel");

    // Timeline
    const timelineTable = $("timelineTable");
    const timelineScroll = $("timelineScroll");
    const playheadMarker = $("playheadMarker");
    const clipStartMarker = $("clipStartMarker");
    const clipEndMarker = $("clipEndMarker");

    // If your timeline is optional on some pages, bail gracefully.
    const hasTimeline = !!(timelineTable && timelineScroll && playheadMarker && clipStartMarker && clipEndMarker);

    // UI
    const loopToggle = $("loopToggle");
    const snapValue = $("snapValue");
    const bgColorInput = $("bgColor");
    const aaToggle = $("aaToggle");
    const toggleOnionBtn = $("toggleOnion");
    const toggleTransparencyBtn = $("toggleTransparency");

    const onionPrevColorInput = $("onionPrevColor");
    const onionNextColorInput = $("onionNextColor");
    const onionAlphaInput = $("onionAlpha");
    const onionAlphaVal = $("onionAlphaVal");
    const playSnappedChk = $("playSnapped");

    const dupCelBtn = $("dupCelBtn");
    const tlPrevCelBtn = $("tlPrevCel");
    const tlNextCelBtn = $("tlNextCel");
    const tlPlayBtn = $("tlPlay");
    const tlPauseBtn = $("tlPause");
    const tlStopBtn = $("tlStop");
    const tlDupBtn = $("tlDupCel");

    const keepOnionPlayingChk = $("keepOnionPlaying");
    const keepTransPlayingChk = $("keepTransPlaying");

    const gapPxInput = $("gapPx");
    const autofillToggle = $("autofillToggle");
    const fillCurrentBtn = $("fillCurrent");
    const fillAllBtn = $("fillAll");
    const chooseFillEraserBtn = $("chooseFillEraser");
    const chooseFillBrushBtn = $("chooseFillBrush");
    const chooseLassoFillBtn = $("chooseLassoFill");



    // OKLCH default UI
    const defLInput = $("defL");
    const defCInput = $("defC");
    const defHInput = $("defH");
    const saveOklchDefaultBtn = $("saveOklchDefault");
    const oklchDefaultStatus = $("oklchDefaultStatus");


    // HSV wheel picker (canvas)
    const hsvWheelWrap = $("hsvWheelWrap");
    const hsvWheelCanvas = $("hsvWheelCanvas");
    const hsvWheelPreview = $("hsvWheelPreview");




    const toolSeg = document.getElementById("toolSeg");
    const eraserOptionsPopup = document.getElementById("eraserOptionsPopup");

    function openPopupAt(popup, x, y) {
      if (!popup) return;
      popup.style.left = `${x}px`;
      popup.style.top = `${y}px`;
      popup.setAttribute("aria-hidden", "false");
      popup.classList.add("open");
    }

    function closePopup(popup) {
      if (!popup) return;
      popup.setAttribute("aria-hidden", "true");
      popup.classList.remove("open");
    }

    toolSeg.addEventListener("contextmenu", (e) => {
      const lab = e.target.closest('label[data-tool]');
      if (!lab) return;

      const tool = lab.dataset.tool;

      // Only show for eraser tools (adjust if you want more)
      if (tool !== "eraser" && tool !== "fill-eraser") return;

      e.preventDefault();

      // (Optional) also select the tool on right-click
      const inputId = lab.getAttribute("for");
      const input = inputId ? document.getElementById(inputId) : null;
      if (input) input.checked = true;

      openPopupAt(eraserOptionsPopup, e.clientX + 6, e.clientY + 6);
    });

    document.addEventListener("mousedown", (e) => {
      if (!eraserOptionsPopup) return;
      if (!eraserOptionsPopup.contains(e.target)) closePopup(eraserOptionsPopup);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closePopup(eraserOptionsPopup);
    });
    const brushSizeInput = $("brushSize");
    const eraserSizeInput = $("eraserSize");
    const brushVal = $("brushVal");
    const eraserVal = $("eraserVal");
    const brushSwatch = $("brushSwatch");
    const brushHexEl = $("brushHex");

    // Info overlay
    const infoBtn = $("infoBtn");
    const infoPanel = $("infoPanel");

    // Export/Save/Load
    const exportWebMBtn = $("exportWebM");
    const exportMP4Btn = $("exportMP4");
    const saveProjBtn = document.getElementById("saveProj");
    const loadProjBtn = document.getElementById("loadProj");
    const loadFileInp = document.getElementById("loadFileInp");

    const exportImgSeqBtn =
      document.getElementById("exportImgSeqBtn") ||
      document.getElementById("exportImgSeq");
      

    

    function canvasToBlob(canvas, type = "image/png", quality) {
      return new Promise((resolve) => {
        canvas.toBlob((b) => resolve(b), type, quality);
      });
    }

    function _pad2(n){ return String(n).padStart(2, "0"); }
    function _timestampSlug(d = new Date()){
      return (
        d.getFullYear() +
        _pad2(d.getMonth() + 1) +
        _pad2(d.getDate()) + "_" +
        _pad2(d.getHours()) +
        _pad2(d.getMinutes()) +
        _pad2(d.getSeconds())
      );
    }




    async function exportPngSequenceToFolder({
      fromFrame,
      toFrame,
      transparent = true,
      prefix = "celstomp_",
      makeSubfolder = true,
      folderName = null,

      // ✅ NEW: handle passed from click handler
      baseDirHandle = null,

      // ✅ NEW: UI progress target (the actual clicked button)
      progressEl = null,
    } = {}) {
      const from = Number.isFinite(fromFrame) ? fromFrame : clipStart;
      const to   = Number.isFinite(toFrame)   ? toFrame   : clipEnd;

      if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) {
        alert("Invalid export range.");
        return;
      }

      // Offscreen render canvas (content resolution)
      const outC = document.createElement("canvas");
      outC.width = contentW;
      outC.height = contentH;
      const outCtx = outC.getContext("2d");

      const total = (to - from + 1);

      // Helper: update progress safely
      const setProg = (done) => {
        const el =
          progressEl ||
          document.getElementById("exportImgSeqBtn") ||
          document.getElementById("exportImgSeq");
        if (!el) return;
        const pct = Math.round((done / total) * 100);
        el.textContent = `Exporting… ${pct}%`;
      };

      // ✅ Secure-context guard (folder picker needs https/localhost)
      const canFolder = !!window.showDirectoryPicker && !!window.isSecureContext;

      if (canFolder) {
        let baseDir = baseDirHandle;
        if (!baseDir) {
          baseDir = await window.showDirectoryPicker({ mode: "readwrite" });
        }

        let dir = baseDir;
        let finalFolder = "";

        if (makeSubfolder) {
          finalFolder = folderName || `celstomp_pngseq_${_timestampSlug()}`;
          dir = await baseDir.getDirectoryHandle(finalFolder, { create: true });
        }

        for (let f = from; f <= to; f++) {
          drawCompositeAt(outCtx, f, !transparent);

          const blob = await canvasToBlob(outC, "image/png");
          if (!blob) throw new Error("PNG export failed (toBlob returned null).");

          const seq = (f - from + 1); // ✅ 1..N within the IN→OUT range
          const name = `${prefix}${String(seq).padStart(4, "0")}.png`;
          const fileHandle = await dir.getFileHandle(name, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();

          const done = (f - from + 1);
          setProg(done);
          if ((done % 3) === 0) await sleep(0);
        }

        alert(
          `Exported PNG sequence.\n` +
          (makeSubfolder ? `Folder: ${finalFolder}\n` : "") +
          `Frames: ${from + 1}–${to + 1}\n\n` +
          `Tip: choose your Downloads folder when prompted to save it in Downloads.`
        );
        return;
      }

      // Fallback: multi-download (browser may block)
      alert(
        (!window.isSecureContext
          ? "Folder export requires HTTPS (or localhost).\n\n"
          : "Your browser doesn’t support folder export.\n\n") +
        "Fallback: downloading many PNGs (your browser may block this).\n" +
        "For best results, use Opera/Chrome/Edge on an HTTPS site."
      );

      for (let f = from; f <= to; f++) {
        drawCompositeAt(outCtx, f, !transparent);
        const blob = await canvasToBlob(outC, "image/png");
        if (!blob) throw new Error("PNG export failed (toBlob returned null).");

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${prefix}${String(f + 1).padStart(4, "0")}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

        const done = (f - from + 1);
        setProg(done);
        await sleep(60);
      }
    }


    // IMGSEQ_WIRE (unique anchor)
    function wireImgSeqExportButton(){
      if (document._imgSeqDelegatedWired) return;
      document._imgSeqDelegatedWired = true;

      document.addEventListener("click", async (e) => {
        const btn = e.target.closest("#exportImgSeqBtn, #exportImgSeq");
        if (!btn) return;

        e.preventDefault();
        e.stopPropagation();

        const prevText = btn.textContent;
        btn.disabled = true;

        // Default = NO PAPER (transparent PNG). Hold SHIFT to INCLUDE paper bg.
        const transparent = !e.shiftKey;

        let baseDirHandle = null;

        try {
          // Must happen on the direct user gesture path
          if (window.showDirectoryPicker && window.isSecureContext) {
            baseDirHandle = await window.showDirectoryPicker({ mode: "readwrite" });
          }

          await exportPngSequenceToFolder({
            fromFrame: clipStart,
            toFrame: clipEnd,
            transparent,
            prefix: "celstomp_",
            makeSubfolder: true,
            baseDirHandle,
            progressEl: btn, // ✅ progress always updates the real live button
          });

        } catch (err) {
          if (err && (err.name === "AbortError" || err.name === "NotAllowedError")) {
            // user canceled / blocked — silent
          } else {
            console.warn("[IMGSEQ] export failed:", err);
            alert("IMG SEQ export failed:\n" + (err?.message || String(err)));
          }
        } finally {
          btn.disabled = false;
          btn.textContent = prevText;
        }
      }, { capture: true, passive: false });
      
    
    }


    // View
    const fitViewBtn = $("fitView");

    // Timeline nav buttons
    const jumpStartBtn = $("jumpStart");
    const jumpEndBtn = $("jumpEnd");
    const prevFrameBtn = $("prevFrame");
    const nextFrameBtn = $("nextFrame");

    // -------------------------
    // State
    // -------------------------
    let dpr = window.devicePixelRatio || 1;

    let fps = 24;
    let seconds = 5;
    let totalFrames = fps * seconds;

    // View transform
    let zoom = 1;
    let offsetX = 0; // in device px
    let offsetY = 0; // in device px
    let canvasBgColor = "#bfbfbf";

    // Reference image
    let referenceCels = []; 
    let referenceOpacity = 0.4;
    let referenceVisible = true;
    let refDragState = null;

    // Transparency hold
    let transparencyHoldEnabled = false;


    // Playback
    let isPlaying = false;
    let playTimer = null;
    let loopPlayback = true;
    let clipStart = 0;
    let clipEnd = Math.max(0, Math.min(totalFrames - 1, fps * 2 - 1));
    let playSnapped = false;

    // Onion
    let onionEnabled = false;
    let onionAlpha = 0.5;
    let onionPrevTint = "#4080ff";
    let onionNextTint = "#40ff78";

    // When playing: optionally keep onion/transparency states
    let keepOnionWhilePlaying = false;
    let keepTransWhilePlaying = false;
    let restoreOnionAfterPlay = false;
    let restoreTransAfterPlay = false;
    let prevOnionState = false;
    let prevTransState = false;

  

    // Snap
    let snapFrames = 1;

    // Tools
    let tool = "brush"; // brush | eraser | fill-eraser | fill-brush | hand 
    let brushSize = 3;
    let eraserSize = 100;
    let currentColor = "#000000";
    let usePressureSize = true;
    let usePressureOpacity = false;
    let antiAlias = false;


    let closeGapPx = 0;
    let autofill = false; // default ON
    const fillWhite = "#ffffff";
    const fillBrushTrailColor = "#ff1744";

    // OKLCH default
    let oklchDefault = { L: 0, C: 0.2, H: 180 };
    let pickerInitializing = false;

    // Layers
    const LAYER = { FILL: 0, COLOR: 1, SHADE: 2, LINE: 3 };
    const RENDER_ORDER = [LAYER.FILL, LAYER.COLOR, LAYER.SHADE, LAYER.LINE];
    const LAYERS_COUNT = 4;
    const PAPER_LAYER = -1; // sentinel: not part of layers[] (non-drawable)


    let layers = new Array(LAYERS_COUNT).fill(0).map(() => ({
      name: "",
      opacity: 1,
      prevOpacity: 1,
      clipToBelow: false,
      frames: new Array(totalFrames).fill(null),

      sublayers: new Map(),
      suborder: [], // stable ordering of hex keys
    }));

    layers[LAYER.LINE].name  = "LINE";
    layers[LAYER.SHADE].name = "SHADE";
    layers[LAYER.COLOR].name = "COLOR";
    layers[LAYER.FILL].name  = "FILL";

    let activeLayer = LAYER.LINE;
    let activeSubColor = new Array(LAYERS_COUNT).fill("#000000");

    // -------------------------
    // Per-layer color memory
    // -------------------------
    // Fill is fixed white; other layers remember last-used color.
    let layerColorMem = new Array(LAYERS_COUNT).fill("#000000");
    layerColorMem[LAYER.FILL] = fillWhite; // keep fill white

    function rememberedColorForLayer(L){
      if (L === LAYER.FILL) return fillWhite;
      return layerColorMem[L] || "#000000";
    }

    function rememberCurrentColorForLayer(L = activeLayer){
      if (L === LAYER.FILL) return; // keep Fill fixed to white
      layerColorMem[L] = currentColor;
    }

    function applyRememberedColorForLayer(L = activeLayer){
      currentColor = rememberedColorForLayer(L);
      setColorSwatch();
      setPickerToColorString(currentColor);
    }

    // ───────── CTRL+DRAG: move ACTIVE cel pixels ─────────
    // Moves the active main layer + active sublayer color at currentFrame.
    // (Uses drawCanvas pointer coords -> content coords, so it works with zoom/pan.)
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
      h: 0,
    };

    function _ctrlMovePickKeyForLayer(L){
      // ✅ FILL should follow its active swatch if you have colored fill swatches
      if (typeof LAYER !== "undefined" && L === LAYER.FILL){
        return (activeSubColor?.[LAYER.FILL] || fillWhite || "#ffffff");
      }
      return (activeSubColor?.[L] ?? (typeof currentColor === "string" ? currentColor : "#000000"));
    }

    // returns the OFFSCREEN canvas for active cel (layer+color+frame)
    function getActiveCelCanvasForMove(){
      const L = activeLayer;
      const F = currentFrame;
      const key = (typeof colorToHex === "function")
        ? colorToHex(_ctrlMovePickKeyForLayer(L))
        : _ctrlMovePickKeyForLayer(L);

      // getFrameCanvas is in your file already (sublayer aware)
      const c = (typeof getFrameCanvas === "function") ? getFrameCanvas(L, F, key) : null;
      return { canvas: c, L, F, key };
    }

    function beginCtrlMove(e){

      if (activeLayer === PAPER_LAYER) return false;

      // only left button / primary
      const leftDown = (e.button === 0) || (e.buttons === 1);
      if (!leftDown) return false;

      const picked = getActiveCelCanvasForMove();
      if (!picked.canvas) return false;

      const ctx = picked.canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return false;

      // use DRAW canvas coordinates, not offscreen canvas coords
      const pos = getCanvasPointer(e);             // CSS px in drawCanvas space
      const cpt = screenToContent(pos.x, pos.y);   // content space (0..contentW/H)

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

      // snapshot pixels once
      try {
        _ctrlMove.snap = ctx.getImageData(0, 0, _ctrlMove.w, _ctrlMove.h);
      } catch {
        _ctrlMove.active = false;
        return false;
      }

      // ✅ begin a global history step for ctrl-move
      try { beginGlobalHistoryStep(_ctrlMove.L, _ctrlMove.F, _ctrlMove.key); } catch {}

      // capture pointer so dragging continues outside canvas
      try { drawCanvas.setPointerCapture(e.pointerId); } catch {}

      return true;
    }

    function updateCtrlMove(e){
      if (!_ctrlMove.active) return;

      const pos = getCanvasPointer(e);
      const cpt = screenToContent(pos.x, pos.y);

      const dx = Math.round(cpt.x - _ctrlMove.startCX);
      const dy = Math.round(cpt.y - _ctrlMove.startCY);

      if (dx === _ctrlMove.dx && dy === _ctrlMove.dy) return;
      _ctrlMove.dx = dx;
      _ctrlMove.dy = dy;

      const ctx = _ctrlMove.ctx;

      // restore from snapshot, shifted
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, _ctrlMove.w, _ctrlMove.h);

      try { markGlobalHistoryDirty(); } catch {}
      ctx.putImageData(_ctrlMove.snap, dx, dy);

      // content likely still exists; keep true (optional: you can scan on end if you want)
      _ctrlMove.canvas._hasContent = true;

      if (typeof renderAll === "function") renderAll();
      if (typeof updateTimelineHasContent === "function") updateTimelineHasContent(_ctrlMove.F);
    }

    function endCtrlMove(e){
      if (!_ctrlMove.active) return;

      // optional: refine _hasContent truth by scanning alpha once
      try {
        const data = _ctrlMove.ctx.getImageData(0, 0, _ctrlMove.w, _ctrlMove.h).data;
        let any = false;
        for (let i = 3; i < data.length; i += 4) { if (data[i] > 0) { any = true; break; } }
        _ctrlMove.canvas._hasContent = any;
      } catch {}

      _ctrlMove.active = false;

      try { drawCanvas.releasePointerCapture(_ctrlMove.pointerId); } catch {}

      if (typeof renderAll === "function") renderAll();
      if (typeof updateTimelineHasContent === "function") updateTimelineHasContent(_ctrlMove.F);


 
      try { commitGlobalHistoryStep(); } catch {}

      _ctrlMove.pointerId = null;
      _ctrlMove.canvas = null;
      _ctrlMove.ctx = null;
      _ctrlMove.snap = null;


    }



    // -------------------------
    // Undo/Redo per (layer,frame,colorKey)  ✅ sublayer-aware
    // -------------------------
    const historyLimit = 50;
    const historyMap = new Map(); // "L:F:KEY" -> {undo:[], redo:[]}



    // GLOBAL_UNDO_CROSS_LAYER (unique anchor)
    // -------------------------
    // Global Undo/Redo across layers/frames/sublayers
    // - Records each completed stroke as {L,F,key,before,after}
    // - undo()/redo() will act on the last action, even if it was on another layer
    // -------------------------
    const globalHistory = { undo: [], redo: [] };

    // pending step captured on stroke start, committed on stroke end
    let _pendingGlobalStep = null;
    let _globalStepDirty = false;

    // Call this from your drawing code whenever pixels actually change
    function markGlobalHistoryDirty(){
      _globalStepDirty = true;
    }

    function beginGlobalHistoryStep(L = activeLayer, F = currentFrame, keyArg = null){
      _globalStepDirty = false;

      if (L === PAPER_LAYER) { _pendingGlobalStep = null; return; }

      const key = resolveKeyFor(L, keyArg);
      if (!key) { _pendingGlobalStep = null; return; }

      _pendingGlobalStep = {
        L, F, key,
        before: snapshotFor(L, F, key),
      };
    }

    function commitGlobalHistoryStep(){
      const s = _pendingGlobalStep;
      _pendingGlobalStep = null;

      // If nothing actually changed, don't create a history step
      if (!s || !_globalStepDirty) return;

      const after = snapshotFor(s.L, s.F, s.key);

      // If both empty, skip (rare, but safe)
      if (!s.before && !after) return;

      globalHistory.undo.push({ ...s, after });
      if (globalHistory.undo.length > historyLimit) globalHistory.undo.shift();
      globalHistory.redo.length = 0;
    }

    // Optional: jump UI to the action's layer/frame if you have helpers.
    // Safe: falls back to plain variable assignment.
    function _jumpToActionContext(L, F){
      if (typeof setCurrentFrame === "function") setCurrentFrame(F);
      else currentFrame = F;

      if (typeof setActiveLayer === "function") setActiveLayer(L);
      else activeLayer = L;

      // If you have UI refresh helpers, keep them safe:
      try { renderAll(); } catch {}
    }
    function historyKey(L, F, key){
      return `${L}:${F}:${String(key || "")}`;
    }

    function resolveKeyFor(L, key){
      if (L === PAPER_LAYER) return null;

      // Normalize helper
      const norm = (v) => colorToHex(v || "#000000");

      // ✅ FILL layer: allow colored swatches (fill-brush), not always white
      if (L === LAYER.FILL){
        const k = key || activeSubColor?.[LAYER.FILL] || fillWhite || "#FFFFFF";
        return norm(k);
      }

      // other layers
      return norm(key || activeSubColor?.[L] || currentColor || "#000000");
    }

    function ensureHistory(L, F, key) {
      const k = historyKey(L, F, key);
      if (!historyMap.has(k)) historyMap.set(k, { undo: [], redo: [] });
      return historyMap.get(k);
    }

    function snapshotFor(L, F, key) {
      const k = resolveKeyFor(L, key);
      if (!k) return null;

      const c = getFrameCanvas(L, F, k);
      if (!c || !c._hasContent) return null;

      try {
        const ctx = c.getContext("2d", { willReadFrequently: true });
        return ctx.getImageData(0, 0, contentW, contentH);
      } catch {
        return null;
      }
    }

    function applySnapshot(L, F, key, shot) {
      const k = resolveKeyFor(L, key);
      if (!k) return;

      const c = getFrameCanvas(L, F, k);
      const ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, contentW, contentH);

      if (shot) {
        ctx.putImageData(shot, 0, 0);
        c._hasContent = true;
      } else {
        c._hasContent = false;
      }

      renderAll();
      updateTimelineHasContent(F);
    }

    function pushUndo(L, F, key) {
      const k = resolveKeyFor(L, key);
      if (!k) return;

      const hist = ensureHistory(L, F, k);
      const shot = snapshotFor(L, F, k);

      hist.undo.push(shot);
      if (hist.undo.length > historyLimit) hist.undo.shift();
      hist.redo.length = 0;
    }

    function undo() {
      // global undo across layers
      const action = globalHistory.undo.pop();
      if (!action) return;

      globalHistory.redo.push(action);

      // jump to where the action happened (layer + frame), then apply snapshot
      _jumpToActionContext(action.L, action.F);
      applySnapshot(action.L, action.F, action.key, action.before);
    }

    function redo() {
      const action = globalHistory.redo.pop();
      if (!action) return;

      globalHistory.undo.push(action);

      _jumpToActionContext(action.L, action.F);
      applySnapshot(action.L, action.F, action.key, action.after);
    }

    // Current frame
    let currentFrame = 0;

   // -------------------------
    // HSV Wheel picker (Hue ring + SV square)
    // - Looks like your screenshot: ring + square
    // - Updates currentColor (hex) + swatch
    // - Calls rememberCurrentColorForLayer(activeLayer) if you have it
    // -------------------------

    // one tiny 1x1 canvas to normalize any CSS color -> hex
    const _normC = document.createElement("canvas");
    _normC.width = _normC.height = 1;
    const _normCtx = _normC.getContext("2d");

    function normalizeToHex(colorStr) {
      try {
        _normCtx.clearRect(0, 0, 1, 1);
        _normCtx.fillStyle = String(colorStr || "#000");
        _normCtx.fillRect(0, 0, 1, 1);
        const d = _normCtx.getImageData(0, 0, 1, 1).data;
        return "#" + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, "0")).join("");
      } catch {
        return "#000000";
      }
    }

    function hexToRgb(hex) {
      const h = normalizeToHex(hex).slice(1);
      return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
      };
    }

    function rgbToHex(r, g, b) {
      return (
        "#" +
        [r, g, b]
          .map((v) => Math.max(0, Math.min(255, v | 0)).toString(16).padStart(2, "0"))
          .join("")
      ).toUpperCase();
    }

    // HSV <-> RGB
    function hsvToRgb(h, s, v) {
      h = ((h % 360) + 360) % 360;
      s = clamp(s, 0, 1);
      v = clamp(v, 0, 1);

      const c = v * s;
      const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
      const m = v - c;

      let rp = 0, gp = 0, bp = 0;
      if (h < 60)      { rp = c; gp = x; bp = 0; }
      else if (h < 120){ rp = x; gp = c; bp = 0; }
      else if (h < 180){ rp = 0; gp = c; bp = x; }
      else if (h < 240){ rp = 0; gp = x; bp = c; }
      else if (h < 300){ rp = x; gp = 0; bp = c; }
      else             { rp = c; gp = 0; bp = x; }

      return {
        r: Math.round((rp + m) * 255),
        g: Math.round((gp + m) * 255),
        b: Math.round((bp + m) * 255),
      };
    }

    function rgbToHsv(r, g, b) {
      r /= 255; g /= 255; b /= 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const d = max - min;

      let h = 0;
      if (d !== 0) {
        if (max === r) h = 60 * (((g - b) / d) % 6);
        else if (max === g) h = 60 * (((b - r) / d) + 2);
        else h = 60 * (((r - g) / d) + 4);
      }
      if (h < 0) h += 360;

      const s = max === 0 ? 0 : d / max;
      const v = max;

      return { h, s, v };
    }

    // Picker state
    let hsvPick = { h: 0, s: 1, v: 1 };
    let _wheelGeom = null;
    let _wheelRingImg = null; // cached ring image for size
    let _dragMode = null; // "hue" | "sv" | null

    function rememberLayerColorSafe() {
      try { rememberCurrentColorForLayer?.(activeLayer); } catch {}
    }

    function setCurrentColorHex(hex, { remember = true } = {}) {
      currentColor = normalizeToHex(hex);
      setColorSwatch();
      setHSVPreviewBox();
      if (remember) rememberLayerColorSafe();
      // keep wheel in sync
      hsvPick = rgbToHsv(...Object.values(hexToRgb(currentColor)));
      drawHSVWheel();
    }

    function setPickerDefaultBlack() {
      setCurrentColorHex("#000000", { remember: true });
    }

    function computeWheelGeom() {
      if (!hsvWheelCanvas || !hsvWheelWrap) return null;

      const dprLocal = window.devicePixelRatio || 1;
      const rect = hsvWheelWrap.getBoundingClientRect();
      const sizeCss = Math.max(160, Math.floor(Math.min(rect.width, rect.height)));
      const size = Math.floor(sizeCss * dprLocal);

      hsvWheelCanvas.width = size;
      hsvWheelCanvas.height = size;

      const R = size / 2;
      const ringOuter = R * 0.96;
      const ringInner = R * 0.78;
      const ringMid = (ringOuter + ringInner) / 2;

      // Square fits inside ringInner with padding
      const sqSize = Math.floor(ringInner * 1.25);
      const sqLeft = Math.floor(R - sqSize / 2);
      const sqTop = Math.floor(R - sqSize / 2);

      return { size, dprLocal, R, ringOuter, ringInner, ringMid, sqLeft, sqTop, sqSize };
    }

    function buildRingImage(geom) {
      const { size, R, ringInner, ringOuter } = geom;
      const img = new ImageData(size, size);
      const data = img.data;

      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const dx = x - R;
          const dy = y - R;
          const dist = Math.hypot(dx, dy);

          const i = (y * size + x) * 4;

          if (dist >= ringInner && dist <= ringOuter) {
            // Hue angle: 0 at top, clockwise
            const ang = Math.atan2(dy, dx); // -PI..PI, 0 at right
            const h = (ang * 180 / Math.PI + 90 + 360) % 360;

            const rgb = hsvToRgb(h, 1, 1);
            data[i + 0] = rgb.r;
            data[i + 1] = rgb.g;
            data[i + 2] = rgb.b;
            data[i + 3] = 255;
          } else {
            data[i + 3] = 0; // transparent outside ring
          }
        }
      }
      return img;
    }

    function buildSVSquareImage(geom) {
      const { sqSize, size } = geom;
      const img = new ImageData(sqSize, sqSize);
      const data = img.data;

      for (let y = 0; y < sqSize; y++) {
        const v = 1 - (y / (sqSize - 1));
        for (let x = 0; x < sqSize; x++) {
          const s = x / (sqSize - 1);
          const rgb = hsvToRgb(hsvPick.h, s, v);
          const i = (y * sqSize + x) * 4;
          data[i + 0] = rgb.r;
          data[i + 1] = rgb.g;
          data[i + 2] = rgb.b;
          data[i + 3] = 255;
        }
      }
      return img;
    }

    function drawHSVWheel() {
      if (!hsvWheelCanvas) return;

      const ctx = hsvWheelCanvas.getContext("2d");
      if (!ctx) return;

      const geom = (_wheelGeom = computeWheelGeom());
      if (!geom) return;

      // clear
      ctx.clearRect(0, 0, geom.size, geom.size);

      // cache ring per size
      if (!_wheelRingImg || !_wheelRingImg._size || _wheelRingImg._size !== geom.size) {
        _wheelRingImg = buildRingImage(geom);
        _wheelRingImg._size = geom.size;
      }

      // draw ring
      ctx.putImageData(_wheelRingImg, 0, 0);

      // draw square
      const svImg = buildSVSquareImage(geom);
      ctx.putImageData(svImg, geom.sqLeft, geom.sqTop);

      // square border
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = Math.max(1, geom.size * 0.004);
      ctx.strokeRect(geom.sqLeft + 0.5, geom.sqTop + 0.5, geom.sqSize - 1, geom.sqSize - 1);
      ctx.restore();

      // SV marker
      const mx = geom.sqLeft + hsvPick.s * geom.sqSize;
      const my = geom.sqTop + (1 - hsvPick.v) * geom.sqSize;

      ctx.save();
      ctx.beginPath();
      ctx.arc(mx, my, Math.max(5, geom.size * 0.02), 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(0,0,0,0.65)";
      ctx.lineWidth = Math.max(2, geom.size * 0.007);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(mx, my, Math.max(4, geom.size * 0.017), 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.lineWidth = Math.max(2, geom.size * 0.006);
      ctx.stroke();
      ctx.restore();

      // Hue marker
      const ang = ((hsvPick.h - 90) * Math.PI) / 180;
      const hx = geom.R + Math.cos(ang) * geom.ringMid;
      const hy = geom.R + Math.sin(ang) * geom.ringMid;

      ctx.save();
      ctx.beginPath();
      ctx.arc(hx, hy, Math.max(6, geom.size * 0.024), 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(hx, hy, Math.max(5, geom.size * 0.02), 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.lineWidth = Math.max(2, geom.size * 0.006);
      ctx.stroke();
      ctx.restore();
    }

    function wheelLocalFromEvent(e) {
      const rect = hsvWheelCanvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (hsvWheelCanvas.width / rect.width);
      const y = (e.clientY - rect.top) * (hsvWheelCanvas.height / rect.height);
      return { x, y };
    }

    function hitTestWheel(x, y) {
      const g = _wheelGeom || computeWheelGeom();
      if (!g) return null;

      const dx = x - g.R;
      const dy = y - g.R;
      const dist = Math.hypot(dx, dy);

      const inRing = dist >= g.ringInner && dist <= g.ringOuter;
      const inSquare = x >= g.sqLeft && x <= g.sqLeft + g.sqSize && y >= g.sqTop && y <= g.sqTop + g.sqSize;

      if (inSquare) return "sv";
      if (inRing) return "hue";
      return null;
    }

    function updateFromHuePoint(x, y) {
      const g = _wheelGeom;
      const ang = Math.atan2(y - g.R, x - g.R);
      const h = (ang * 180 / Math.PI + 90 + 360) % 360;
      hsvPick.h = h;

      const rgb = hsvToRgb(hsvPick.h, hsvPick.s, hsvPick.v);
      currentColor = rgbToHex(rgb.r, rgb.g, rgb.b);
      setColorSwatch();
      setHSVPreviewBox();
      rememberLayerColorSafe();

      drawHSVWheel();
    }

    function updateFromSVPoint(x, y) {
      const g = _wheelGeom;
      const sx = clamp((x - g.sqLeft) / g.sqSize, 0, 1);
      const vy = clamp(1 - (y - g.sqTop) / g.sqSize, 0, 1);

      hsvPick.s = sx;
      hsvPick.v = vy;

      const rgb = hsvToRgb(hsvPick.h, hsvPick.s, hsvPick.v);
      currentColor = rgbToHex(rgb.r, rgb.g, rgb.b);
      setColorSwatch();
      setHSVPreviewBox();
      rememberLayerColorSafe();

      drawHSVWheel();
    }

    function initHSVWheelPicker() {
      if (!hsvWheelCanvas || !hsvWheelWrap) return;

      // sync wheel from whatever currentColor is right now
      const rgb = hexToRgb(currentColor || "#000000");
      hsvPick = rgbToHsv(rgb.r, rgb.g, rgb.b);

      drawHSVWheel();

      let dragging = false;

      hsvWheelCanvas.addEventListener("pointerdown", (e) => {
        const p = wheelLocalFromEvent(e);
        _dragMode = hitTestWheel(p.x, p.y);
        if (!_dragMode) return;

        hsvWheelCanvas.setPointerCapture(e.pointerId);
        dragging = true;

        if (_dragMode === "hue") updateFromHuePoint(p.x, p.y);
        else updateFromSVPoint(p.x, p.y);

        e.preventDefault();
      }, { passive: false });


      hsvWheelCanvas.addEventListener("pointermove", (e) => {
        if (!dragging || !_dragMode) return;
        const p = wheelLocalFromEvent(e);
        if (_dragMode === "hue") updateFromHuePoint(p.x, p.y);
        else updateFromSVPoint(p.x, p.y);
        e.preventDefault();
      }, { passive: false });

      hsvWheelCanvas.addEventListener("pointerup", (e) => {
        dragging = false;
        _dragMode = null;
        try { hsvWheelCanvas.releasePointerCapture(e.pointerId); } catch {}
      });

      hsvWheelCanvas.addEventListener("pointercancel", () => {
        dragging = false;
        _dragMode = null;
      });

      // redraw on resize so it stays crisp
      new ResizeObserver(() => drawHSVWheel()).observe(hsvWheelWrap);
    }



    // BRUSH_CURSOR_PREVIEW (unique anchor)
      let _brushPrevEl = null;
      let _brushPrevCanvas = null;
      let _brushPrevLastEvt = null;
      let _brushPrevRAF = 0;
      let _brushPrevLastXY = null;

      function initBrushCursorPreview(inputCanvasEl){
        _brushPrevCanvas = inputCanvasEl;
        _brushPrevEl = document.getElementById("brushCursorPreview");
        if (!_brushPrevCanvas || !_brushPrevEl) return;

        let hovering = false;
        let down = false;

        const show = () => { _brushPrevEl.style.display = "block"; };
        const hide = () => { _brushPrevEl.style.display = "none"; };

        _brushPrevCanvas.addEventListener("pointerenter", () => {
          hovering = true;
          show();
          scheduleBrushPreviewUpdate(true);
        });

        _brushPrevCanvas.addEventListener("pointerleave", () => {
          hovering = false;
          if (!down) hide();
        });

        _brushPrevCanvas.addEventListener("pointermove", (e) => {
          _brushPrevLastEvt = e;
          _brushPrevLastXY = { x: e.clientX, y: e.clientY };
          scheduleBrushPreviewUpdate();
        });

        _brushPrevCanvas.addEventListener("pointerdown", (e) => {
          down = true;
          _brushPrevLastEvt = e;
          _brushPrevLastXY = { x: e.clientX, y: e.clientY };
          show();
          scheduleBrushPreviewUpdate(true);
        });

        window.addEventListener("pointerup", () => {
          down = false;
          if (!hovering) hide();
          scheduleBrushPreviewUpdate(true);
        }, { passive:true });

        // update size when zooming (wheel)
        _brushPrevCanvas.addEventListener("wheel", () => {
          scheduleBrushPreviewUpdate(true);
        }, { passive:true });

        // ✅ update when sliders change (optional but nice)
        try { brushSizeInput?.addEventListener("input", () => scheduleBrushPreviewUpdate(true)); } catch {}
        try { eraserSizeInput?.addEventListener("input", () => scheduleBrushPreviewUpdate(true)); } catch {}

        hide();
      }

      function scheduleBrushPreviewUpdate(force=false){
        if (!_brushPrevEl || !_brushPrevCanvas) return;
        if (_brushPrevRAF && !force) return;
        _brushPrevRAF = requestAnimationFrame(() => {
          _brushPrevRAF = 0;
          updateBrushPreview();
        });
      }

      // ---- customize these two getters to match YOUR variables ----
      function getActiveToolKindForPreview(){
        // ✅ your real tool variable is `tool`
        return String((typeof tool !== "undefined" && tool) ? tool : "");
      }

      function getBrushSizeForPreview(toolKind){
        // ✅ your real size variables are `brushSize` and `eraserSize`
        if (toolKind === "eraser") return Number(eraserSize ?? 8);
        return Number(brushSize ?? 6);
      }
      // ------------------------------------------------------------

      function updateBrushPreview(){
        if (!_brushPrevEl || !_brushPrevCanvas) return;

        const toolKind = getActiveToolKindForPreview();

        // Tools that should show a tiny fixed circle outline
        const SIMPLE_TOOLS = new Set([
          "fill-eraser",
          "fill-brush",
          "lasso-fill",
          "lasso-erase",
        ]);

        const isBrush  = (toolKind === "brush");
        const isEraser = (toolKind === "eraser");
        const isSimple = SIMPLE_TOOLS.has(toolKind);

        // show for brush/eraser AND these fill/lasso tools
        if (!isBrush && !isEraser && !isSimple) {
          _brushPrevEl.style.display = "none";
          return;
        }

        // Need a recent pointer position (stored as client coords already)
        const pt = _brushPrevLastXY;
        if (!pt) return;

        // position: fixed → use viewport coords directly
        const cx = pt.x;
        const cy = pt.y;

        // size:
        // - brush/eraser scale with zoom
        // - fill/lasso tools use a tiny fixed ring
        const z = (typeof zoom === "number" && isFinite(zoom)) ? zoom : 1;

        let diameterCssPx;
        if (isSimple) {
          diameterCssPx = 4; // <- tweak: 8..14 feels good
        } else {
          const sizeContentPx = Math.max(1, getBrushSizeForPreview(isEraser ? "eraser" : "brush"));
          diameterCssPx = Math.max(2, sizeContentPx * z);
        }

        // classes
        _brushPrevEl.classList.toggle("simple", !!isSimple);
        _brushPrevEl.classList.toggle("eraser", !!isEraser && !isSimple); // dashed only for normal eraser

        _brushPrevEl.style.left = `${cx}px`;
        _brushPrevEl.style.top  = `${cy}px`;
        _brushPrevEl.style.width  = `${diameterCssPx}px`;
        _brushPrevEl.style.height = `${diameterCssPx}px`;
        _brushPrevEl.style.display = "block";
      }



    // -------------------------
    // Timeline helpers
    // -------------------------
    function framesToSF(f) {
      return { s: Math.floor(f / fps), f: f % fps };
    }
    function sfString(f) {
      const o = framesToSF(f);
      return `${o.s}s+${o.f}f`;
    }

    // -------------------------
    // Canvases & transforms
    // -------------------------
    function resizeCanvases() {
      dpr = window.devicePixelRatio || 1;

      // Use clientWidth/Height first (more stable for layout),
      // fallback to rect, then fallback to viewport.
      const cw = stageEl.clientWidth || stageEl.getBoundingClientRect().width || window.innerWidth;
      const ch = stageEl.clientHeight || stageEl.getBoundingClientRect().height || window.innerHeight;

      // If stage is collapsed/hidden, don't smash canvases to 1x1.
      if (cw < 10 || ch < 10) {
        console.warn("[celstomp] stage has no size yet:", { cw, ch, stage: stageEl });
        requestAnimationFrame(resizeCanvases);
        return;
      }


      // IMPORTANT: set CSS size so canvas matches stage visually
      for (const c of [boundsCanvas, drawCanvas, fxCanvas]) {
        c.style.width = cw + "px";
        c.style.height = ch + "px";
        c.width = Math.max(1, Math.floor(cw * dpr));
        c.height = Math.max(1, Math.floor(ch * dpr));
      }

      renderAll();
      clearFx();
      initBrushCursorPreview(drawCanvas);
    }


    function setTransform(ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.setTransform(zoom * dpr, 0, 0, zoom * dpr, offsetX, offsetY);
    }

    function screenToContent(sx, sy) {
      // sx/sy are canvas-local CSS pixels
      const devX = sx * dpr;
      const devY = sy * dpr;
      const cx = (devX - offsetX) / (zoom * dpr);
      const cy = (devY - offsetY) / (zoom * dpr);
      return { x: cx, y: cy };
    }

    function getCanvasPointer(e) {
      const rect = drawCanvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      return { x, y };
    }

    function centerView() {
      const cw = drawCanvas.width;
      const ch = drawCanvas.height;
      offsetX = (cw - contentW * zoom * dpr) / 2;
      offsetY = (ch - contentH * zoom * dpr) / 2;
      updateHUD();
      renderAll();
      updatePlayheadMarker();
      updateClipMarkers();
    }

    function resetCenter() {
      zoom = 1;
      centerView();
    }

    // -------------------------
    // HUD
    // -------------------------
    function updateHUD() {
      safeText(hudFps, String(fps));
      safeText(frameInfo, `${currentFrame + 1} / ${totalFrames}`);
      safeText(hudTime, sfString(currentFrame));
      safeText(timeCounter, sfString(currentFrame));
      safeText(zoomInfo, `${Math.round(zoom * 100)}%`);
      safeText(toolName, tool.replace("-", " ").replace(/\b\w/g, (m) => m.toUpperCase()));
      safeText(fpsLabel, String(fps));
      safeText(secLabel, String(seconds));
    }

  // -------------------------
    // Frames & layers (MAIN layer -> color sublayers -> frames)
    // -------------------------

    /* Cached 1x1 ctx for color normalization */
    const _colorCtx = (() => {
      const c = document.createElement("canvas");
      c.width = c.height = 1;
      return c.getContext("2d", { willReadFrequently: true });
    })();

    function colorToHex(c){
      const ctx = _colorCtx;
      if (!ctx) return String(c || "#000").trim();

      // Canvas normalizes most CSS colors (rgb(), named colors, etc.)
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = String(c || "#000");
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;

      const r = d[0] | 0, g = d[1] | 0, b = d[2] | 0;
      return "#" + [r,g,b].map(v => v.toString(16).padStart(2,"0")).join("").toUpperCase();
    }

    function ensureSublayer(L, colorStr){
      const hex = swatchColorKey(colorStr);
      const layer = layers[L];
      if (!layer) return null;

      // Ensure structures exist (in case older saves/init)
      if (!layer.sublayers) layer.sublayers = new Map();
      if (!layer.suborder)  layer.suborder  = [];

      let sub = layer.sublayers.get(hex);
      if (!sub){
        sub = { color: hex, frames: new Array(totalFrames).fill(null) };
        layer.sublayers.set(hex, sub);

        // ✅ De-dupe: only add to ordering if it's not already there
        if (!layer.suborder.includes(hex)) layer.suborder.push(hex);

        // ✅ Repair: if suborder already has duplicates (from older bug), clean it once
        // (keeps first occurrence order)
        if (layer.suborder.length > 1){
          const seen = new Set();
          layer.suborder = layer.suborder.filter((k) => {
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          });
        }

        // ensure activeSubColor exists and defaults per layer
        if (Array.isArray(activeSubColor)) activeSubColor[L] = activeSubColor[L] || hex;
        try { normalizeLayerSwatchKeys(layer); } catch {}
        try { renderLayerSwatches(L); } catch {}
      } else {
        // If totalFrames grew, extend frames array
        if (sub.frames.length < totalFrames) {
          const oldLen = sub.frames.length;
          sub.frames.length = totalFrames;
          for (let i = oldLen; i < totalFrames; i++) sub.frames[i] = null;
        }

        // ✅ Also keep suborder clean even if sub already existed
        // (covers “sub existed but suborder got duplicated elsewhere”)
        if (layer.suborder.includes(hex)) {
          const seen = new Set();
          layer.suborder = layer.suborder.filter((k) => {
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          });
        } else {
          layer.suborder.push(hex);
        }


        //  If an older/non-canonical key exists that normalizes to the same hex,
        // migrate it so we never end up with “same color, different string” dupes.
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

    /**
     * Get the offscreen canvas for (mainLayer L, frame F, color sublayer).
     * Backwards compatible: if colorStr is omitted, uses activeSubColor[L] or currentColor.
     */
    function getFrameCanvas(L, F, colorStr){
      const key = colorToHex(colorStr || activeSubColor?.[L] || currentColor || "#000");
      const sub = ensureSublayer(L, key);
      if (!sub) return null;
      

      if (!sub.frames[F]){
        const off = document.createElement("canvas");
        off.width = contentW;
        off.height = contentH;
        off._hasContent = false;
        sub.frames[F] = off;
      }
      return sub.frames[F];
    }

    /**
     * Mark that a cel has content.
     * Backwards compatible: if colorStr omitted, uses activeSubColor/currentColor.
     */
    function markFrameHasContent(L, F, colorStr){
      const c = getFrameCanvas(L, F, colorStr);
      if (c) c._hasContent = true;
    }

    /** Returns true if ANY sublayer in main layer L has content at frame F */
    function mainLayerHasContent(L, F){
      const layer = layers[L];
      if (!layer || !layer.suborder || !layer.sublayers) return false;

      for (const key of layer.suborder){
        const sub = layer.sublayers.get(key);
        const off = sub?.frames?.[F];
        if (off && off._hasContent) return true;
      }
      return false;
    }

    function canvasesWithContentForMainLayerFrame(L, F){
      const layer = layers[L];
      if (!layer) return [];

      const out = [];

      // NEW system: sublayers
      const order = layer.suborder || [];
      const map   = layer.sublayers || null;

      if (map && order.length){
        for (const key of order){
          const off = map.get(key)?.frames?.[F];
          if (off && off._hasContent) out.push(off);
        }
      }

      // LEGACY fallback (in case anything still writes to layer.frames)
      const legacy = layer.frames?.[F];
      if (legacy && legacy._hasContent) out.push(legacy);

      return out;
    }



    /* Compatibility alias: old code might call frameLayerHasContent(L,F) */
    function frameLayerHasContent(L, F){
      return mainLayerHasContent(L, F);
    }

    /** Timeline "does this frame have anything at all" */
    function hasCel(F){
      return (
        mainLayerHasContent(LAYER.LINE,  F) ||
        mainLayerHasContent(LAYER.SHADE, F) ||
        mainLayerHasContent(LAYER.COLOR, F) ||
        mainLayerHasContent(LAYER.FILL,  F)
      );
    }

    /** Draw composited cel: render all sublayers in each main layer */
    function drawExactCel(ctx, idx){
      ensureClipBuffers(contentW, contentH);

      for (const L of RENDER_ORDER){
        const layer = layers[L];
        if (!layer) continue;

        const op = layer.opacity ?? 1;
        if (op <= 0) continue;

        // Gather this layer’s drawable canvases (sublayers + legacy)
        const srcCanvases = canvasesWithContentForMainLayerFrame(L, idx);
        if (!srcCanvases.length) continue;

        const wantsClip = !!layer.clipToBelow && isClipEligibleMainLayer(layer.name);

        // Only LINE/SHADE/COLOR can clip (never FILL), and must have a layer below
        const belowL = Number(L) - 1;

        if (!wantsClip || L === LAYER.FILL || belowL < 0 || !layers?.[belowL]) {
          // Normal draw
          ctx.save();
          ctx.globalAlpha *= op;
          for (const off of srcCanvases) ctx.drawImage(off, 0, 0);
          ctx.restore();
          continue;
        }

        const belowLayer = layers[belowL];
        const belowOp = belowLayer?.opacity ?? 0;
        if (belowOp <= 0) {
          // If the base is hidden, clipped layer should disappear too
          continue;
        }

        const maskCanvases = canvasesWithContentForMainLayerFrame(belowL, idx);
        if (!maskCanvases.length) {
          // Nothing below at this frame -> nothing to clip to
          continue;
        }

        // 1) draw this layer into work buffer
        _clipWorkCtx.setTransform(1,0,0,1,0,0);
        _clipWorkCtx.globalCompositeOperation = "source-over";
        _clipWorkCtx.globalAlpha = 1;
        _clipWorkCtx.clearRect(0, 0, contentW, contentH);
        for (const off of srcCanvases) _clipWorkCtx.drawImage(off, 0, 0);

        // 2) build mask from layer below’s alpha
        _clipMaskCtx.setTransform(1,0,0,1,0,0);
        _clipMaskCtx.globalCompositeOperation = "source-over";
        _clipMaskCtx.clearRect(0, 0, contentW, contentH);
        _clipMaskCtx.globalAlpha = belowOp; // base opacity affects mask strength
        for (const off of maskCanvases) _clipMaskCtx.drawImage(off, 0, 0);
        _clipMaskCtx.globalAlpha = 1;

        // 3) apply destination-in mask
        _clipWorkCtx.globalCompositeOperation = "destination-in";
        _clipWorkCtx.drawImage(_clipMask, 0, 0);
        _clipWorkCtx.globalCompositeOperation = "source-over";

        // 4) draw clipped result into final ctx with this layer’s opacity
        ctx.save();
        ctx.globalAlpha *= op;
        ctx.drawImage(_clipWork, 0, 0);
        ctx.restore();
      }
    }

    /* ---------- Swatches UI ---------- */

    // Paper swatch: shows canvasBgColor and edits it.
    // Uses #bgColor if it exists; otherwise creates a hidden <input type="color">.
    let _paperColorPicker = null;

    function ensurePaperColorPicker(){
      if (bgColorInput && bgColorInput.tagName === "INPUT" && bgColorInput.type === "color") {
        return bgColorInput;
      }
      if (_paperColorPicker) return _paperColorPicker;

      const inp = document.createElement("input");
      inp.type = "color";
      inp.style.position = "fixed";
      inp.style.left = "-9999px";
      inp.style.top = "-9999px";
      inp.style.opacity = "0";
      document.body.appendChild(inp);
      _paperColorPicker = inp;
      return inp;
    }

    function setCanvasBgColor(next){
      canvasBgColor = normalizeToHex(next || canvasBgColor || "#bfbfbf");
      if (bgColorInput) bgColorInput.value = canvasBgColor;
      renderPaperSwatch();     // keep paper swatch in sync
      renderAll();             // redraw with new background
    }

    function openPaperColorPicker(){
      const picker = ensurePaperColorPicker();
      picker.value = normalizeToHex(canvasBgColor);

      // If we're reusing #bgColor, it already has an input listener below.
      if (picker === bgColorInput) {
        return;
      }

      const onInput = () => setCanvasBgColor(picker.value);
      picker.addEventListener("input", onInput);
      picker.addEventListener("change", () => picker.removeEventListener("input", onInput), { once: true });

      try { picker.showPicker?.(); } catch {}
      picker.click();
    }

    function renderPaperSwatch(){
      const host = document.getElementById("swatches-paper");
      if (!host) return;

      

      host.innerHTML = "";

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "layerSwatchBtn" + ((activeLayer === PAPER_LAYER) ? " active" : "");
      btn.style.background = canvasBgColor;
      btn.title = `PAPER: ${String(canvasBgColor || "").toUpperCase()}`;

      btn.addEventListener("pointerdown", (e) => {
        // Important: prevent the surrounding <label for="bt-paper"> from stealing focus
        // (which can instantly close the native color picker).
        e.preventDefault();
        e.stopPropagation();
      }, { passive: false });

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const startHex = normalizeToHex(canvasBgColor);

        // ✅ Defer opening until next frame so the "opening click" can't also be treated as outside-click.
        requestAnimationFrame(() => {
          openLiveColorDialog({
            initialHex: startHex,
            onLive: (hex) => setCanvasBgColor(hex),
            onCommit: (hex) => setCanvasBgColor(hex),
            onCancel: () => setCanvasBgColor(startHex),
          });
        });
      });


      host.appendChild(btn);
    }


    function swatchContainerIdForLayer(L){
      if (L === PAPER_LAYER) return "swatches-paper";
      if (L === LAYER.LINE)  return "swatches-line";
      if (L === LAYER.SHADE) return "swatches-shade";
      if (L === LAYER.COLOR) return "swatches-color";
      return "swatches-fill";
    }


    function setLayerRadioChecked(L){
      const id =
        (L === PAPER_LAYER)  ? "bt-paper" :
        (L === LAYER.LINE)   ? "bt-line" :
        (L === LAYER.SHADE)  ? "bt-color" :
        (L === LAYER.COLOR)  ? "bt-sketch" :
                              "bt-fill";
      const r = document.getElementById(id);
      if (r) r.checked = true;
    }


    // -------------------------
    // Swatch drag-reorder (per main layer)
    // Rightmost swatch draws on top (drawn last)
    // -------------------------


 
    function commitSwatchOrderFromDOM(host, L) {
      const layer = layers?.[L];
      if (!layer) return;

      const btns = Array.from(host.querySelectorAll(".layerSwatchBtn"));

      const domOrder = btns
        .map((b) => swatchColorKey((b?.dataset?.key || "").trim()))
        .filter(Boolean);

      const seen = new Set();
      const next = [];

      for (const k of domOrder) {
        if (!seen.has(k)) { seen.add(k); next.push(k); }
      }

      const mapKeys = layer.sublayers ? Array.from(layer.sublayers.keys()) : [];
      for (const k of mapKeys) {
        if (!seen.has(k)) { seen.add(k); next.push(k); }
      }

      layer.suborder = next;

      try { normalizeLayerSwatchKeys(layer); } catch {}

      if (activeSubColor?.[L] && !layer.suborder.includes(activeSubColor[L])) {
        activeSubColor[L] = layer.suborder[0] || activeSubColor[L];
      }

      renderAll();
    }

 

    // -------------------------
    // Swatch pairing (cross-layer drag onto swatch)
    // -------------------------

    // Unified swatch pointer DnD (reorder + pair + move/unpair)
    // - Drag within same layer: reorders (live)
    // - Drag onto a swatch in ANOTHER layer: pairs under it
    // - Drop into empty space of ANOTHER layer: moves there unpaired
    // - Same-layer pairing: hold SHIFT and drop onto another swatch
    // -------------------------
    let _swatchPtrDrag = null;

    function _swatchHostLayer(host){
      const id = host?.id || "";
      if (id === "swatches-line")  return LAYER.LINE;
      if (id === "swatches-shade") return LAYER.SHADE;
      if (id === "swatches-color") return LAYER.COLOR;
      if (id === "swatches-fill")  return LAYER.FILL;
      // paper host is not a real layer for swatches
      return null;
    }

    function wireSwatchPointerDnD(host){
      if (!host || host._swatchPtrDnDWired) return;
      host._swatchPtrDnDWired = true;

      const THRESH = 4;

      function layerRowInfoFromEl(el){
        const row = el?.closest?.("[data-layer-row]") || null;
        if (!row) return null;
        const L = Number(row.dataset.layerRow);
        if (!Number.isFinite(L) || L === PAPER_LAYER) return null;
        return { row, L };
      }

      function cleanup(){
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      }

      function clearHoverTarget(){
        if (_swatchPtrDrag?.hoverBtn) {
          _swatchPtrDrag.hoverBtn.classList.remove("swatchDropTarget");
          _swatchPtrDrag.hoverBtn = null;
        }
      }

      function clearHoverLayerRow(){
        if (_swatchPtrDrag?.hoverRowEl){
          _swatchPtrDrag.hoverRowEl.classList.remove("swatchLayerDropTarget");
          _swatchPtrDrag.hoverRowEl = null;
          _swatchPtrDrag.overRowLayer = null;
        }
      }

      function onMove(e){
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

        // 1) Swatch host under pointer?
        const overHost = el?.closest?.('[id^="swatches-"]') || null;

        // ignore paper host entirely
        if (overHost && overHost.id === "swatches-paper") {
          e.preventDefault();
          return;
        }

        // 2) If NOT over a swatch host, allow dropping onto the MAIN LAYER ROW (label)
        if (!overHost) {
          const info = layerRowInfoFromEl(el);
          if (info) {
            // don’t allow dropping back onto same main layer row
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

        // live reorder: insert within the current overHost based on X midpoint
        const btns = Array.from(overHost.querySelectorAll(".layerSwatchBtn"));
        let insertBefore = null;

        for (const b of btns) {
          if (b === d.btn) continue;
          const r = b.getBoundingClientRect();
          const mid = r.left + r.width / 2;
          if (e.clientX < mid) { insertBefore = b; break; }
        }

        if (insertBefore) {
          if (d.btn.nextSibling !== insertBefore) overHost.insertBefore(d.btn, insertBefore);
        } else {
          if (overHost.lastElementChild !== d.btn) overHost.appendChild(d.btn);
        }

        // highlight if we're over a swatch button (potential pairing target)
        const overBtn = el?.closest?.(".layerSwatchBtn");
        if (overBtn && overBtn !== d.btn) {
          overBtn.classList.add("swatchDropTarget");
          d.hoverBtn = overBtn;
        }

        e.preventDefault();
      }

      function onUp(e){
        const d = _swatchPtrDrag;
        if (!d || e.pointerId !== d.pointerId) return;

        try { d.btn.releasePointerCapture(e.pointerId); } catch {}

        clearHoverTarget();
        clearHoverLayerRow();

        if (d.moved) {
          d.btn.classList.remove("swatchDragging");
          document.body.classList.remove("swatch-reordering");

          const el = document.elementFromPoint(e.clientX, e.clientY);

          // Prefer swatch host; fallback to “layer row” drop
          const overHost = el?.closest?.('[id^="swatches-"]') || null;
          const rowInfo = layerRowInfoFromEl(el);

          const srcL = Number(d.srcLayer);
          const srcKey = d.srcKey;

          const dstLayerFromHost = overHost ? _swatchHostLayer(overHost) : null;
          const dstLayer = (dstLayerFromHost != null) ? dstLayerFromHost
                        : (d.overRowLayer != null) ? Number(d.overRowLayer)
                        : (rowInfo?.L != null) ? Number(rowInfo.L)
                        : null;

          // Pairing: only if dropped ONTO another swatch button
          const overBtn = el?.closest?.(".layerSwatchBtn");
          const overBtnLayer = overBtn ? Number(overBtn.dataset.layerId) : null;

          if (overBtn && overBtn !== d.btn && Number.isFinite(overBtnLayer)) {
            const dstL = overBtnLayer;
            const dstParentKey = String(overBtn.dataset.key || "");

            // Pair cross-layer always, same-layer only when SHIFT is held
            const allowSameLayerPair = !!e.shiftKey;
            if (String(dstL) !== String(srcL) || allowSameLayerPair) {
              pairSwatchAcrossLayers(srcL, srcKey, dstL, dstParentKey);
              _swatchPtrDrag = null;
              cleanup();
              return;
            }
          }

          // Move: if dropped into ANOTHER layer (either host empty space OR layer-row)
          if (dstLayer != null && String(dstLayer) !== String(srcL)) {
            const ok = moveSwatchToLayerUnpaired(srcL, srcKey, dstLayer);
            if (!ok) {
              // restore DOM/UI if move was rejected (collision etc.)
              try { renderLayerSwatches(srcL); } catch {}
              try { renderLayerSwatches(dstLayer); } catch {}
            }
            _swatchPtrDrag = null;
            cleanup();
            return;
          }

          // Otherwise: same-layer reorder => commit from DOM
          if (dstLayer != null) {
            const hostToCommit = overHost || d.srcHost;
            commitSwatchOrderFromDOM(hostToCommit, dstLayer);
          } else {
            // fallback: restore by re-rendering source layer
            renderLayerSwatches(srcL);
          }

          e.preventDefault();
        }

        _swatchPtrDrag = null;
        cleanup();
      }

      host.addEventListener("pointerdown", (e) => {
        const btn = e.target.closest(".layerSwatchBtn");
        if (!btn || !host.contains(btn)) return;

        // left button only (mouse), primary touch/pen ok
        if (e.pointerType === "mouse" && e.button !== 0) return;

        // don't start a drag when clicking the caret (folder toggle)
        if (e.target.closest(".swatchCaret")) return;

        const srcLayer = Number(btn.dataset.layerId);
        const srcKey = String(btn.dataset.key || "");
        if (!Number.isFinite(srcLayer) || !srcKey) return;

        _swatchPtrDrag = {
          pointerId: e.pointerId,
          btn,
          srcHost: host,
          overHost: host,
          srcLayer,
          srcKey,
          startX: e.clientX,
          startY: e.clientY,
          moved: false,
          hoverBtn: null,
          hoverRowEl: null,
          overRowLayer: null,
        };

        try { btn.setPointerCapture(e.pointerId); } catch {}
        window.addEventListener("pointermove", onMove, { passive: false });
        window.addEventListener("pointerup", onUp, { passive: false });
        window.addEventListener("pointercancel", onUp, { passive: false });
      }, { passive: false });
    }

   
   
    let _swatchDnD = null;

    // SWATCH_KEY_CANON (unique anchor)
    function swatchColorKey(c){
      c = (c || "").trim();
      if (!c) return "#000000";

      // #RGB / #RRGGBB / #RRGGBBAA -> #RRGGBB
      if (c[0] === "#") {
        let h = c.slice(1).replace(/[^0-9a-fA-F]/g, "");
        if (h.length === 3) h = h.split("").map(ch => ch + ch).join("");
        if (h.length >= 6) h = h.slice(0, 6);
        while (h.length < 6) h += "0";
        return ("#" + h).toUpperCase();
      }

      // rgb()/rgba() -> #RRGGBB
      const m = c.match(/rgba?\(([^)]+)\)/i);
      if (m) {
        const parts = m[1].split(/[,/ ]+/).filter(Boolean);
        const r = Math.max(0, Math.min(255, (Number(parts[0]) || 0) | 0));
        const g = Math.max(0, Math.min(255, (Number(parts[1]) || 0) | 0));
        const b = Math.max(0, Math.min(255, (Number(parts[2]) || 0) | 0));
        return (
          "#" +
          r.toString(16).padStart(2, "0") +
          g.toString(16).padStart(2, "0") +
          b.toString(16).padStart(2, "0")
        ).toUpperCase();
      }

      // ✅ Any other CSS color syntax (oklch/hsl/named/etc) -> normalize via canvas
      // This is the critical mobile de-dupe fix.
      try {
        const hex = colorToHex(c); // your 1x1 canvas normalizer
        if (hex && /^#[0-9A-F]{6}$/.test(hex)) return hex;
      } catch {}

      // last resort: keep stable (but uppercase)
      return c.toUpperCase();
    }

    // SWATCH_LAYER_NORMALIZE (unique anchor)
    function normalizeLayerSwatchKeys(layer){
      if (!layer) return;

      if (!layer.sublayers) layer.sublayers = new Map();
      if (!layer.suborder) layer.suborder = [];

      const m = layer.sublayers;

      // Move Map entries to canonical keys (avoid case/rgb/alpha duplicates)
      for (const [k, sw] of Array.from(m.entries())) {
        const c = swatchColorKey(k);
        if (c !== k) {
          if (!m.has(c)) {
            m.delete(k);
            m.set(c, sw);
          } else {
            // collision: keep canonical, drop the duplicate key (prevents duplicates)
            // (If you ever suspect real data in both, tell me and we can merge intelligently.)
            m.delete(k);
          }
        }
        if (sw && typeof sw === "object") {
          sw.key = sw._key = sw.hex = c;
        }
      }

      // Rebuild suborder as unique canonical keys
      const newOrd = [];
      const seen = new Set();
      for (const k of (Array.isArray(layer.suborder) ? layer.suborder : [])) {
        const c = swatchColorKey(k);
        if (!seen.has(c) && m.has(c)) {
          seen.add(c);
          newOrd.push(c);
        }
      }
      layer.suborder = newOrd;

      // Normalize parent/children references too (important for folders/pairing)
      for (const [k, sw] of m.entries()) {
        if (!sw || typeof sw !== "object") continue;
        if (sw.parentKey) sw.parentKey = swatchColorKey(sw.parentKey);
        if (Array.isArray(sw.children)) {
          const kids = [];
          const kseen = new Set();
          for (const ck of sw.children) {
            const cc = swatchColorKey(ck);
            if (!kseen.has(cc) && m.has(cc)) { kseen.add(cc); kids.push(cc); }
          }
          sw.children = kids;
        }
      }
    }

    // NOTE: adjust if your layer list isn't state.layers
    function getMainLayerById(layerId){
      const idx = Number(layerId);
      if (!Number.isFinite(idx)) return null;

      // Your render uses: const layer = layers[L];
      // so layerId should resolve directly into layers[enum]
      return (layers && layers[idx]) ? layers[idx] : null;
    }





    function getOrderArray(layer){
      if (!layer) return null;
      if (Array.isArray(layer.suborder)) return layer.suborder;        // ✅ your UI path
      if (Array.isArray(layer.order)) return layer.order;
      if (Array.isArray(layer.swatchOrder)) return layer.swatchOrder;
      return null;
    }

    function getSwatch(layer, key){
      if (!layer || !key) return null;

      const raw = String(key);
      key = swatchColorKey(raw);

      // ✅ Map-based
      if (layer.sublayers && typeof layer.sublayers.get === "function") {
        return layer.sublayers.get(key) || layer.sublayers.get(raw) || null;
      }


      // object map fallback
      if (layer.swatches && typeof layer.swatches === "object" && !Array.isArray(layer.swatches)) {
        return layer.swatches[key] || null;
      }

      if (layer.colors && typeof layer.colors === "object" && !Array.isArray(layer.colors)) {
        return layer.colors[key] || null;
      }

      // array fallback
      if (Array.isArray(layer.swatches)) {
        return layer.swatches.find(s => (s.key ?? s._key ?? s.hex ?? s.id) === key) || null;
      }

      return null;
    }

    function removeSwatch(layer, key){

      key = swatchColorKey(String(key || ""));
      if (!layer) return null;

      // ✅ Map-based remove (matches layer.sublayers + layer.suborder)
      if (layer.sublayers && typeof layer.sublayers.delete === "function") {
        const sw = layer.sublayers.get(key) || null;
        if (!sw) return null;

        layer.sublayers.delete(key);

        const ord = getOrderArray(layer);
        if (ord) {
          const i = ord.indexOf(key);
          if (i >= 0) ord.splice(i, 1);
        }
        return sw;
      }

      // ---- your original fallbacks ----


      const sw = layer.sublayers.get(key) || layer.sublayers.get(String(key)) || null;

      if (layer.swatches && typeof layer.swatches === "object" && !Array.isArray(layer.swatches)) {
        const sw = layer.swatches[key] || null;
        if (sw) delete layer.swatches[key];
        const ord = getOrderArray(layer);
        if (ord) {
          const i = ord.indexOf(key);
          if (i >= 0) ord.splice(i, 1);
        }
        return sw;
      }

      

      if (layer.colors && typeof layer.colors === "object") {
        const sw = layer.colors[key] || null;
        if (sw) delete layer.colors[key];
        const ord = getOrderArray(layer);
        if (ord) {
          const i = ord.indexOf(key);
          if (i >= 0) ord.splice(i, 1);
        }
        return sw;
      }

      if (Array.isArray(layer.swatches)) {
        const i = layer.swatches.findIndex(s => (s.key ?? s._key ?? s.hex ?? s.id) === key);
        if (i >= 0) return layer.swatches.splice(i, 1)[0];
      }

      return null;
    }

    function insertSwatch(layer, key, sw){


      key = swatchColorKey(String(key || ""));
      if (sw && typeof sw === "object") sw.key = sw._key = sw.hex = key;
      if (!layer || !sw) return;

      // ✅ Map-based insert
      if (layer.sublayers && typeof layer.sublayers.set === "function") {
        layer.sublayers.set(key, sw);
        const ord = getOrderArray(layer);
        if (ord && !ord.includes(key)) ord.push(key);
        return;
      }

      // ---- your original fallbacks ----
      if (layer.swatches && typeof layer.swatches === "object" && !Array.isArray(layer.swatches)) {
        layer.swatches[key] = sw;
        const ord = getOrderArray(layer);
        if (ord && !ord.includes(key)) ord.push(key);
        return;
      }

      if (layer.colors && typeof layer.colors === "object") {
        layer.colors[key] = sw;
        const ord = getOrderArray(layer);
        if (ord && !ord.includes(key)) ord.push(key);
        return;
      }

      if (Array.isArray(layer.swatches)) {
        if (sw.key == null) sw.key = key;
        layer.swatches.push(sw);
      }
    }

    function ensureChildrenArr(parentSwatch){
      if (!parentSwatch) return null;
      if (!Array.isArray(parentSwatch.children)) parentSwatch.children = [];
      return parentSwatch.children;
    }

    function detachFromParentIfAny(layer, sw, key){
      if (!layer || !sw) return;

      const parentKey = sw.parentKey;
      if (!parentKey) return;

      const parent = getSwatch(layer, parentKey);
      if (parent && Array.isArray(parent.children)) {
        parent.children = parent.children.filter(k => k !== key);
      }

      sw.parentKey = null;
    }


    function pairSwatchAcrossLayers(srcL, srcKey, dstL, dstParentKey){
      // guards
      if (srcL == null || dstL == null) return false;
      if (!srcKey || !dstParentKey) return false;

      // prevent self-pair
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

      /* -----------------------------
        DETACH from old parent (if any)
      ----------------------------- */
      if (sw.parentKey){
        const oldParent = srcMap.get(sw.parentKey);
        if (oldParent && Array.isArray(oldParent.children)){
          oldParent.children = oldParent.children.filter(k => k !== srcKey);
        }
        delete sw.parentKey;
      }

      /* -----------------------------
        REMOVE from source layer
      ----------------------------- */
      srcMap.delete(srcKey);
      const si = srcLayer.suborder.indexOf(srcKey);
      if (si >= 0) srcLayer.suborder.splice(si, 1);

      /* -----------------------------
        INSERT into destination layer
      ----------------------------- */
      dstMap.set(srcKey, sw);
      if (!dstLayer.suborder.includes(srcKey)){
        dstLayer.suborder.push(srcKey);
      }

      /* -----------------------------
        PARENT under destination swatch
      ----------------------------- */
      sw.parentKey = dstParentKey;

      if (!Array.isArray(parent.children)){
        parent.children = [];
      }
      if (!parent.children.includes(srcKey)){
        parent.children.push(srcKey);
      }

      /* -----------------------------
        Refresh UI
      ----------------------------- */
      renderLayerSwatches(srcL);
      renderLayerSwatches(dstL);

      return true;
    }


    // A small helper for parsing drag payload
    function readSwatchDragPayload(dt){

      if (!dt) return null;

      // Prefer our custom type
      let raw = "";
      try { raw = dt.getData("application/x-celstomp-swatch") || ""; } catch {}
      if (!raw) {
        try { raw = dt.getData("text/plain") || ""; } catch {}
      }
      if (!raw) return null;

      try {
        const obj = JSON.parse(raw);
        if (obj && obj.kind === "celstomp-swatch" && obj.layerId != null && obj.key) return obj;
      } catch {}

      return null;
    }


    function getSwatchObj(layer, key){
      try { return layer?.sublayers?.get(key) ?? null; } catch { return null; }
    }


    function detachFromParentIfAnyInLayer(layer, swKey){
      const sw = getSwatchObj(layer, swKey);
      if (!sw || !sw.parentKey) return;

      const parent = getSwatchObj(layer, sw.parentKey);
      if (parent && Array.isArray(parent.children)){
        parent.children = parent.children.filter(k => k !== swKey);
      }
      delete sw.parentKey;
    }

    function insertIntoSuborderAfter(suborder, afterKey, key){
      // remove if exists
      const oldIdx = suborder.indexOf(key);
      if (oldIdx >= 0) suborder.splice(oldIdx, 1);

      const i = suborder.indexOf(afterKey);
      if (i < 0) {
        suborder.push(key);
      } else {
        suborder.splice(i + 1, 0, key);
      }
    }

    function moveSwatchToLayerUnpaired(srcL, srcKey, dstL){
      const srcLayer = layers[srcL];
      const dstLayer = layers[dstL];
      if (!srcLayer || !dstLayer) return false;

      const srcMap = srcLayer.sublayers;
      const dstMap = dstLayer.sublayers;
      if (!srcMap || !dstMap) return false;

      const sw = srcMap.get(srcKey);
      if (!sw) return false;

      const sameLayer = String(srcL) === String(dstL);

      const wasActiveOnSrc = (activeLayer === srcL) && (String(activeSubColor?.[srcL] || "") === String(srcKey));

      // detach from parent in source layer before moving
      detachFromParentIfAnyInLayer(srcLayer, srcKey);

      // if moving across layers, avoid overwriting an existing key
      if (!sameLayer && dstMap.has(srcKey)){
        console.warn("[Celstomp] Can't move swatch: target layer already has key:", srcKey);
        return false;
      }

      if (!sameLayer){
        // remove from source
        srcMap.delete(srcKey);
        const si = srcLayer.suborder.indexOf(srcKey);
        if (si >= 0) srcLayer.suborder.splice(si, 1);

        // insert into destination (top-most = end)
        dstMap.set(srcKey, sw);
        if (!dstLayer.suborder.includes(srcKey)) dstLayer.suborder.push(srcKey);

        // best-effort history migration
        try { migrateHistoryForSwatchMove(srcL, dstL, srcKey); } catch {}
      } else {
        // same layer drag-out = just unpair + move to end (optional)
        const si = srcLayer.suborder.indexOf(srcKey);
        if (si >= 0){
          srcLayer.suborder.splice(si, 1);
          srcLayer.suborder.push(srcKey);
        }
      }

      // ensure it's unpaired
      delete sw.parentKey;

      // If we just moved away the active swatch on source, choose a fallback
      if (!sameLayer && String(activeSubColor?.[srcL] || "") === String(srcKey)) {
        const fb = fallbackSwatchKeyForLayer(srcL);
        if (Array.isArray(activeSubColor) && fb) activeSubColor[srcL] = fb;
      }

      // If it was the active swatch, jump selection to destination (feels natural)
      if (!sameLayer && wasActiveOnSrc) {
        activeLayer = dstL;
        if (Array.isArray(activeSubColor)) activeSubColor[dstL] = srcKey;

        currentColor = srcKey;
        try { setLayerRadioChecked(dstL); } catch {}
        try { setPickerToColorString?.(srcKey); } catch {}
        try { setColorSwatch?.(); } catch {}
        try { setHSVPreviewBox?.(); } catch {}
        try { updateHUD?.(); } catch {}
      }

      // Re-render UI
      renderLayerSwatches(srcL);
      if (!sameLayer) renderLayerSwatches(dstL);

      // Timeline may change because content moved layers
      try { refreshTimelineRowHasContentAll(); } catch {}

      // redraw
      try { renderAll?.(); } catch {}

      return true;
    }

    /**
     * Render swatches for all layers or a single layer.

     */
    function renderLayerSwatches(onlyLayer = null){
      renderPaperSwatch();

      // normalize string -> number enums (optional but helps)
      if (onlyLayer != null) {
        const n = Number(onlyLayer);
        if (Number.isFinite(n)) onlyLayer = n;
      }

      const todo = (onlyLayer === null)
        ? [LAYER.FILL, LAYER.COLOR, LAYER.SHADE, LAYER.LINE]
        : [onlyLayer];

      for (const L of todo){
        const host = document.getElementById(swatchContainerIdForLayer(L));
        if (!host) continue;

        host.innerHTML = "";

        const layer = layers[L];
        if (!layer) continue;

        if (!layer.sublayers) layer.sublayers = new Map();
        if (!layer.suborder)  layer.suborder  = [];
        normalizeLayerSwatchKeys(layer);

        // -------- helpers (render-time) --------
        const getSw = (k) => layer.sublayers.get(k) || null;
        const hasKids = (sw) => !!(sw && Array.isArray(sw.children) && sw.children.length);

        function makeBtn(key, depth, hiddenByFolder){
          const swObj = getSw(key);

          const btn = document.createElement("button");
          btn.type = "button";


          const isSelected = (activeSubColor?.[L] === key);

          btn.className = "layerSwatchBtn" + (isSelected ? " active" : "");

          // ✅ green outline ONLY for the selected swatch on the currently active main layer
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

          // tooltip
          const pKey = swObj?.parentKey;
          btn.title = (depth > 0 && pKey) ? `${key} (paired under ${pKey})` : key;

          // caret for folders
          if (hasKids(swObj)) {
            const caret = document.createElement("span");
            caret.className = "swatchCaret";
            caret.textContent = swObj.collapsed ? "▸" : "▾";

            caret.addEventListener("click", (e) => {
              e.preventDefault();
              e.stopPropagation();
              swObj.collapsed = !swObj.collapsed;
              renderLayerSwatches(L);
            });

            btn.appendChild(caret);
          }




   
          // selection (IMPORTANT: read key live from dataset so recolor/re-key keeps working)
          const readKey = () => swatchColorKey(String(btn.dataset.key || btn.dataset.swatchKey || key || ""));

          btn.addEventListener("click", (e) => {
            if (btn._skipClickOnce) { btn._skipClickOnce = false; return; }
            e.preventDefault();
            e.stopPropagation();

            const k = swatchColorKey(readKey());

            activeLayer = L;
            if (Array.isArray(activeSubColor)) activeSubColor[L] = k;

            currentColor = k;

            try { setPickerToColorString?.(k); } catch {}
            try { setColorSwatch?.(); } catch {}
            try { setHSVPreviewBox?.(); } catch {}

            setLayerRadioChecked(L);
            try { updateHUD?.(); } catch {}
            renderLayerSwatches(); // refresh active outlines
          });

          btn.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            e.stopPropagation();
            openSwatchContextMenu(L, readKey(), e);
          }, { passive: false });

     

          host.appendChild(btn);
          return btn;
        }

        // recursive render: parents -> children (supports deep nesting)
        function renderTree(key, depth, ancestorCollapsed){
          const swObj = getSw(key);
          if (!swObj) return;

          const hiddenByFolder = !!ancestorCollapsed;
          makeBtn(key, depth, hiddenByFolder);

          const kids = Array.isArray(swObj.children) ? swObj.children : [];
          const nextAncestorCollapsed = ancestorCollapsed || !!swObj.collapsed;

          for (const ck of kids){
            if (!getSw(ck)) continue;
            renderTree(ck, depth + 1, nextAncestorCollapsed);
          }
        }

        // top-level keys only (no parentKey)
        for (const key of layer.suborder){
          const swObj = getSw(key);
          if (!swObj) continue;
          if (swObj.parentKey) continue; // skip children at top level
          renderTree(key, 0, false);
        }
        wireSwatchPointerDnD(host);

      }
      
    }



    // KEYBOARD_SHORTCUTS (unique anchor)
    function wireKeyboardShortcuts(){
      if (document._celstompKeysWired) return;
      document._celstompKeysWired = true;

      const isTyping = (el) => {
        if (!el) return false;
        const tag = (el.tagName || "").toLowerCase();
        return tag === "input" || tag === "textarea" || el.isContentEditable;
      };

      const setTool = (t) => {
        tool = t;
        try { updateHUD?.(); } catch {}
        try { scheduleBrushPreviewUpdate?.(true); } catch {}
      };

      const toolByKey = {
        "1": "brush",
        "2": "eraser",
        "3": "fill-brush",
        "4": "fill-eraser",
        "5": "lasso-fill",
        "6": "lasso-erase",
      };

      document.addEventListener("keydown", (e) => {
        if (e.defaultPrevented) return;
        if (isTyping(document.activeElement)) return;

        const k = (e.key || "").toLowerCase();

        // tools 1..6
        if (toolByKey[k]) {
          setTool(toolByKey[k]);
          e.preventDefault();
          return;
        }

      }, { passive:false });
    }

    /* ---------- Timeline navigation helpers ---------- */
2
    function nearestPrevCelIndex(F) {
      for (let i = F - 1; i >= 0; i--) if (hasCel(i)) return i;
      return -1;
    }
    function nearestNextCelIndex(F) {
      for (let i = F + 1; i < totalFrames; i++) if (hasCel(i)) return i;
      return -1;
    }


    // -------------------------
    // Rendering
    // -------------------------
    function renderBounds() {
      setTransform(bctx);
      bctx.fillStyle = "#2a2f38";
      bctx.strokeStyle = "#3b4759";
      bctx.lineWidth = 2 / Math.max(zoom, 1);
      bctx.fillRect(0, 0, contentW, contentH);
      bctx.strokeRect(0, 0, contentW, contentH);
    }

    function drawCompositeAt(ctx, F, withBg = true, holdPrevWhenEmpty = true, holdPrevAlpha = 1) {
      ctx.save();
      ctx.clearRect(0, 0, contentW, contentH);
      ctx.imageSmoothingEnabled = !!antiAlias;

      if (withBg) {
        ctx.fillStyle = canvasBgColor;
        ctx.fillRect(0, 0, contentW, contentH);
      }

      if (withBg && referenceVisible) {
        let activeRef = null;
        for (let i = F; i >= 0; i--) {
          const entry = referenceCels[i];
          if (entry) {
            activeRef = entry;
            break;
          }
        }

        if (activeRef && activeRef instanceof HTMLImageElement) {
          ctx.save();
          ctx.globalAlpha = referenceOpacity;
          ctx.drawImage(activeRef, 0, 0, contentW, contentH);
          ctx.restore();
        }
      }

      if (hasCel(F)) {
        drawExactCel(ctx, F);
      } else if (holdPrevWhenEmpty) {
        const prevIdx = nearestPrevCelIndex(F);
        if (prevIdx >= 0) {
          // ✅ interactive preview can draw the held cel faint
          const a = Math.max(0, Math.min(1, Number(holdPrevAlpha ?? 1)));

          ctx.save();
          ctx.globalAlpha *= a;      // don't hard-set to 1; respect any caller alpha
          drawExactCel(ctx, prevIdx);
          ctx.restore();
        }
      }

      ctx.restore();
    }

    function drawOnion(ctx) {
      if (!onionEnabled) return;

      const prevIdx = nearestPrevCelIndex(currentFrame);
      const nextIdx = nearestNextCelIndex(currentFrame);

      function tintCel(index, color, alpha) {
        if (index < 0) return;
        const off = document.createElement("canvas");
        off.width = contentW;
        off.height = contentH;
        const octx = off.getContext("2d");
        drawExactCel(octx, index);
        octx.globalCompositeOperation = "source-in";
        octx.globalAlpha = alpha;
        octx.fillStyle = color;
        octx.fillRect(0, 0, contentW, contentH);
        ctx.drawImage(off, 0, 0);
      }

      if (prevIdx >= 0) tintCel(prevIdx, onionPrevTint, onionAlpha);
      if (nextIdx >= 0) tintCel(nextIdx, onionNextTint, onionAlpha);
    }

    function renderFrame() {
      setTransform(dctx);

      // ✅ Trans ON = faint held cel. Trans OFF = full held cel.
      const holdAlpha = transparencyHoldEnabled ? 0.25 : 1;

      drawCompositeAt(dctx, currentFrame, true, true, holdAlpha);
      drawOnion(dctx);
    }

    function renderAll() {
      renderBounds();
      renderFrame();
      highlightTimelineCell();
    }



    // -------------------------
    // FX (fill brush trail)
    // -------------------------
    function clearFx() {
      fxctx.setTransform(1, 0, 0, 1, 0, 0);
      fxctx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
    }

    function fxTransform() {
      fxctx.setTransform(zoom * dpr, 0, 0, zoom * dpr, offsetX, offsetY);
    }

    function fxStamp1px(x0, y0, x1, y1) {
      const s = 1;
      const dx = x1 - x0,
        dy = y1 - y0;
      const dist = Math.hypot(dx, dy);
      const step = 0.5;
      const n = Math.max(1, Math.ceil(dist / step));
      const nx = dx / n,
        ny = dy / n;

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



    // -------------------------
    // Layer opacity helpers
    // -------------------------
    function setLayerVisibility(L, vis) {
      const now = !!vis;
      const cur = layers[L].opacity ?? 1;
      if (!now) {
        if (cur > 0) layers[L].prevOpacity = cur;
        layers[L].opacity = 0;
      } else {
        layers[L].opacity = layers[L].prevOpacity > 0 ? layers[L].prevOpacity : 1;
      }
      renderAll();
      updateVisBtn(L);
    }

    function setLayerOpacity(L, a) {
      const v = Math.max(0, Math.min(1, Number(a) || 0));
      layers[L].opacity = v;

      // ✅ remember last non-zero so the 👁 toggle restores what you set
      if (v > 0) layers[L].prevOpacity = v;

      renderAll();
      updateVisBtn(L);
    }


    // -------------------------
    // Layer opacity popup (right-click a layer row)
    // -------------------------
    let _layerOpMenu = null;
    let _layerOpState = null;

    function ensureLayerOpacityMenu() {
      if (_layerOpMenu) return _layerOpMenu;

      const m = document.createElement("div");
      m.id = "layerOpacityMenu";
      m.hidden = true;

      m.innerHTML = `
        <div class="lom-title" id="lomTitle">Layer opacity</div>
        <input id="lomRange" type="range" min="0" max="100" step="1" value="100" />
        <div class="lom-row">
          <span class="lom-val" id="lomVal">100%</span>
          <button type="button" class="lom-reset" id="lomReset">Reset</button>
        </div>
      `;

      const range = m.querySelector("#lomRange");
      const val   = m.querySelector("#lomVal");
      const reset = m.querySelector("#lomReset");

      function applyFromRange() {
        const st = _layerOpState;
        if (!st) return;
        const pct = Number(range.value) || 0;
        val.textContent = `${pct}%`;
        setLayerOpacity(st.L, pct / 100);
      }

      // live update while dragging
      range.addEventListener("input", applyFromRange);
      range.addEventListener("change", applyFromRange);

      reset.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        range.value = "100";
        applyFromRange();
      });

      // close on outside click / escape / blur
      document.addEventListener("mousedown", (e) => {
        if (m.hidden) return;
        if (e.target === m || m.contains(e.target)) return;
        closeLayerOpacityMenu();
      }, true);

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeLayerOpacityMenu();
      });

      window.addEventListener("blur", closeLayerOpacityMenu);

      document.body.appendChild(m);
      _layerOpMenu = m;
      return m;
    }

    function openLayerOpacityMenu(L, ev) {
      if (L === PAPER_LAYER) return;     // no opacity menu for paper (not in layers[])
      if (!layers?.[L]) return;

      const m = ensureLayerOpacityMenu();
      _layerOpState = { L };

      const title = m.querySelector("#lomTitle");
      const range = m.querySelector("#lomRange");
      const val   = m.querySelector("#lomVal");

      const name = layers[L]?.name || `Layer ${L}`;
      const pct = Math.round((layers[L]?.opacity ?? 1) * 100);

      if (title) title.textContent = `${name} opacity`;
      if (range) range.value = String(Math.max(0, Math.min(100, pct)));
      if (val)   val.textContent   = `${Math.max(0, Math.min(100, pct))}%`;

      // show + position near cursor (clamped)
      m.hidden = false;
      m.style.left = "0px";
      m.style.top  = "0px";

      const pad = 6;
      const vw = window.innerWidth, vh = window.innerHeight;
      const r = m.getBoundingClientRect();

      let x = (ev?.clientX ?? 0) + 8;
      let y = (ev?.clientY ?? 0) + 8;

      if (x + r.width + pad > vw) x = Math.max(pad, vw - r.width - pad);
      if (y + r.height + pad > vh) y = Math.max(pad, vh - r.height - pad);

      m.style.left = `${x}px`;
      m.style.top  = `${y}px`;

      try { range?.focus({ preventScroll: true }); } catch {}
    }

    function closeLayerOpacityMenu() {
      if (_layerOpMenu) _layerOpMenu.hidden = true;
      _layerOpState = null;
    }


    // BRUSH_RIGHTCLICK_MENU (unique anchor)
    let _layerRowMenu = null;
    let _layerRowState = null;

    function ensureLayerRowMenu(){
      if (_layerRowMenu) return _layerRowMenu;

      const m = document.createElement("div");
      m.id = "layerRowMenu";
      m.hidden = true;

      m.innerHTML = `
        <button type="button" class="lrm-btn" data-act="opacity">Opacity…</button>
        <button type="button" class="lrm-btn lrm-clip" data-act="clip">
          <span class="lrm-chk" aria-hidden="true">☐</span>
          <span class="lrm-txt">Clip to layer below</span>
        </button>
      `;

      m.addEventListener("click", (e) => {
        const b = e.target.closest("button[data-act]");
        if (!b) return;

        const act = b.dataset.act;
        const st = _layerRowState;
        closeLayerRowMenu();

        if (!st) return;
        const L = st.L;

        if (act === "opacity") {
          // open your existing slider at the same cursor position
          openLayerOpacityMenu(L, st.anchorEvLike);
          return;
        }

        if (act === "clip") {
          if (L === PAPER_LAYER) return;
          if (!layers?.[L]) return;

          // only LINE/SHADE/COLOR
          if (!isClipEligibleMainLayer(layers[L]?.name)) return;

          layers[L].clipToBelow = !layers[L].clipToBelow;

          try { updateLayerClipBadge(L); } catch {}
          renderAll();
          return;
        }
      });

      // close on outside click / escape / blur
      document.addEventListener("mousedown", (e) => {
        if (m.hidden) return;
        if (e.target === m || m.contains(e.target)) return;
        closeLayerRowMenu();
      }, true);

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeLayerRowMenu();
      });

      window.addEventListener("blur", closeLayerRowMenu);

      document.body.appendChild(m);
      _layerRowMenu = m;
      return m;
    }

    function openLayerRowMenu(L, ev){
      if (L === PAPER_LAYER) return;
      if (!layers?.[L]) return;

      const m = ensureLayerRowMenu();

      // store a minimal "event-like" anchor for the opacity menu
      const anchorEvLike = { clientX: ev?.clientX ?? 0, clientY: ev?.clientY ?? 0 };

      _layerRowState = { L, anchorEvLike };

      const clipBtn = m.querySelector('button[data-act="clip"]');
      const chk = clipBtn?.querySelector(".lrm-chk");

      const eligible = isClipEligibleMainLayer(layers[L]?.name);
      if (clipBtn) {
        // only show for LINE/SHADE/COLOR (not FILL)
        clipBtn.hidden = !eligible;

        if (eligible) {
          const on = !!layers[L].clipToBelow;
          if (chk) chk.textContent = on ? "☑" : "☐";

          // if no layer below (shouldn’t happen for eligible), disable
          const hasBelow = (Number(L) > Number(LAYER.FILL));
          clipBtn.disabled = !hasBelow;
          clipBtn.title = hasBelow ? "Clip this layer to the alpha of the layer below" : "No layer below to clip to";
        }
      }

      // position near cursor, clamp to viewport
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
      m.style.top  = `${y}px`;
    }

    function closeLayerRowMenu(){
      if (_layerRowMenu) _layerRowMenu.hidden = true;
      _layerRowState = null;
    }

    // optional visual indicator on the layer row
    function updateLayerClipBadge(L){
      const label = document.querySelector(`[data-layer-row="${String(L)}"]`);
      if (!label) return;

      const on = !!layers?.[L]?.clipToBelow;
      label.classList.toggle("isClippedToBelow", on);

      const badge = label.querySelector(".clipBadge");
      if (badge) badge.hidden = !on;
    }


    // BRUSH_RIGHTCLICK_MENU (unique anchor)
    let _brushCtxMenu = null;
    let _brushCtxState = null;

    function ensureBrushCtxMenu(){
      if (_brushCtxMenu) return _brushCtxMenu;

      const m = document.createElement("div");
      m.id = "brushCtxMenu";
      m.hidden = true;

      Object.assign(m.style, {
        position: "fixed",
        zIndex: "10000",
        minWidth: "220px",
        padding: "10px",
        borderRadius: "12px",
        background: "rgba(18,18,20,0.96)",
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: "0 16px 40px rgba(0,0,0,0.45)",
        color: "rgba(255,255,255,0.92)",
        fontFamily: "var(--font), system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
        fontSize: "13px",
        backdropFilter: "blur(8px)"
      });

      // ✅ NO close button in header
      m.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:8px;">
          <div style="font-weight:700; letter-spacing:.2px;">Brush options</div>
        </div>

        <div style="display:flex; align-items:center; gap:10px; margin:8px 0;">
          <div style="width:52px; opacity:.85;">Size</div>
          <input id="bcmSize" type="range" min="1" max="200" step="1" value="3" style="flex:1;">
          <div id="bcmSizeVal" style="width:34px; text-align:right; font-variant-numeric:tabular-nums;">3</div>
        </div>

        <label style="display:flex; align-items:center; gap:10px; margin:8px 0; cursor:pointer;">
          <input id="bcmAA" type="checkbox">
          <span>Anti-alias</span>
        </label>

        <div style="margin:10px 0 6px; font-weight:700; opacity:.9;">Pressure</div>

        <label style="display:flex; align-items:center; gap:10px; margin:6px 0; cursor:pointer;">
          <input id="bcmPSize" type="checkbox">
          <span>Pressure → Size</span>
        </label>

        <label style="display:flex; align-items:center; gap:10px; margin:6px 0; cursor:pointer;">
          <input id="bcmPOp" type="checkbox">
          <span>Pressure → Opacity</span>
        </label>

        <div style="display:flex; gap:8px; margin-top:10px;">
          <button type="button" id="bcmReset"
            style="flex:1; padding:8px 10px; border-radius:10px; cursor:pointer;
                  background:rgba(255,255,255,0.08); color:rgba(255,255,255,0.92);
                  border:1px solid rgba(255,255,255,0.12); font:inherit;">
            Reset
          </button>
        </div>
      `;

      const $m = (sel) => m.querySelector(sel);

      const sizeEl   = $m("#bcmSize");
      const sizeVal  = $m("#bcmSizeVal");
      const aaEl     = $m("#bcmAA");
      const pSizeEl  = $m("#bcmPSize");
      const pOpEl    = $m("#bcmPOp");
      const resetBtn = $m("#bcmReset");

      function syncRangeLimitsFromMainUI(){
        if (typeof brushSizeInput !== "undefined" && brushSizeInput) {
          if (brushSizeInput.min)  sizeEl.min  = brushSizeInput.min;
          if (brushSizeInput.max)  sizeEl.max  = brushSizeInput.max;
          if (brushSizeInput.step) sizeEl.step = brushSizeInput.step;
        }
      }

      function syncMenuFromState(){
        syncRangeLimitsFromMainUI();

        const v = Math.round(Number(brushSize) || 1);
        sizeEl.value = String(v);
        sizeVal.textContent = String(v);

        aaEl.checked = !!antiAlias;
        pSizeEl.checked = !!usePressureSize;
        pOpEl.checked = !!usePressureOpacity;
      }

      function syncMainUIFromState(){
        if (typeof brushSizeInput !== "undefined" && brushSizeInput) brushSizeInput.value = String(Math.round(Number(brushSize) || 1));
        if (typeof brushVal !== "undefined" && brushVal) brushVal.textContent = String(Math.round(Number(brushSize) || 1));
        if (typeof aaToggle !== "undefined" && aaToggle && "checked" in aaToggle) aaToggle.checked = !!antiAlias;

        const ps = document.getElementById("pressureSize") || document.getElementById("usePressureSize");
        const po = document.getElementById("pressureOpacity") || document.getElementById("usePressureOpacity");
        if (ps && "checked" in ps) ps.checked = !!usePressureSize;
        if (po && "checked" in po) po.checked = !!usePressureOpacity;
      }

      function applyBrushSizeFromMenu(){
        const v = Math.round(Number(sizeEl.value) || 1);
        brushSize = clamp(v, 1, 999);
        sizeVal.textContent = String(brushSize);
        syncMainUIFromState();
      }

      sizeEl.addEventListener("input", applyBrushSizeFromMenu);
      sizeEl.addEventListener("change", applyBrushSizeFromMenu);

      aaEl.addEventListener("change", () => {
        antiAlias = !!aaEl.checked;
        syncMainUIFromState();
        try { renderAll?.(); } catch {}
      });

      pSizeEl.addEventListener("change", () => {
        usePressureSize = !!pSizeEl.checked;
        syncMainUIFromState();
      });

      pOpEl.addEventListener("change", () => {
        usePressureOpacity = !!pOpEl.checked;
        syncMainUIFromState();
      });

      resetBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        brushSize = 3;
        antiAlias = false;
        usePressureSize = true;
        usePressureOpacity = false;
        syncMenuFromState();
        syncMainUIFromState();
        try { renderAll?.(); } catch {}
      });

      // close on outside click / escape / blur
      document.addEventListener("mousedown", (e) => {
        if (m.hidden) return;
        if (e.target === m || m.contains(e.target)) return;
        closeBrushCtxMenu();
      }, true);

      document.addEventListener("keydown", (e) => {
        if (m.hidden) return;
        if (e.key === "Escape") closeBrushCtxMenu();
      });

      window.addEventListener("blur", () => closeBrushCtxMenu());

      document.body.appendChild(m);

      m._syncFromState = syncMenuFromState;

      _brushCtxMenu = m;
      return m;
    }

    

    function openBrushCtxMenu(ev, anchorEl){
      try { closeEraserCtxMenu?.(); } catch {}
      const m = ensureBrushCtxMenu();
      _brushCtxState = { anchorEl: anchorEl || null };

      // sync values before showing
      try { m._syncFromState?.(); } catch {}

      // show + position near cursor (clamped)
      m.hidden = false;
      m.style.left = "0px";
      m.style.top  = "0px";

      const pad = 6;
      const vw = window.innerWidth, vh = window.innerHeight;
      const r = m.getBoundingClientRect();

      let x = (ev?.clientX ?? 0) + 8;
      let y = (ev?.clientY ?? 0) + 8;

      if (x + r.width + pad > vw) x = Math.max(pad, vw - r.width - pad);
      if (y + r.height + pad > vh) y = Math.max(pad, vh - r.height - pad);

      m.style.left = `${x}px`;
      m.style.top  = `${y}px`;

      // focus the slider so mouse wheel + arrows work immediately
      try { m.querySelector("#bcmSize")?.focus({ preventScroll: true }); } catch {}
    }

    function closeBrushCtxMenu(){
      if (_brushCtxMenu) _brushCtxMenu.hidden = true;
      _brushCtxState = null;
    }

    // Wire: right-click brush tool button opens the menu
    function wireBrushButtonRightClick(){
      if (document._brushCtxWired) return;
      document._brushCtxWired = true;

      // Robust selector set (works even if your markup differs)
      const brushSelectors = [
        "#toolBrush",
        '[data-tool="brush"]',
        '[data-toolid="brush"]',
        '[data-toolname="brush"]',
        'button[value="brush"]',
        'input[value="brush"]',
      ].join(",");

      document.addEventListener("contextmenu", (e) => {
        const t = e.target;
        if (!t) return;

        const brushEl = t.closest?.(brushSelectors);
        if (!brushEl) return;

        // Only the BRUSH tool button should trigger this
        e.preventDefault();
        e.stopPropagation();

        openBrushCtxMenu(e, brushEl);
      }, { capture: true });

      // Optional: close the menu when you start interacting with the canvas area
      try {
        drawCanvas?.addEventListener("pointerdown", () => closeBrushCtxMenu(), { passive: true });
      } catch {}
    }



    // ERASER_RIGHTCLICK_MENU (unique anchor)
    let _eraserCtxMenu = null;
    let _eraserCtxState = null;


    function ensureEraserCtxMenu(){
      if (_eraserCtxMenu) return _eraserCtxMenu;

      const m = document.createElement("div");
      m.id = "eraserCtxMenu";
      m.hidden = true;

      // Same visual language as brush menu (inline, single-file)
      Object.assign(m.style, {
        position: "fixed",
        zIndex: "10000",
        minWidth: "220px",
        padding: "10px",
        borderRadius: "12px",
        background: "rgba(18,18,20,0.96)",
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: "0 16px 40px rgba(0,0,0,0.45)",
        color: "rgba(255,255,255,0.92)",
        fontFamily: "var(--font), system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
        fontSize: "13px",
        backdropFilter: "blur(8px)"
      });

      // ✅ Eraser menu = ONLY size slider (keeps header/close for consistency)
      m.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:8px;">
          <div style="font-weight:700; letter-spacing:.2px;">Eraser options</div>
        </div>

        <div style="display:flex; align-items:center; gap:10px; margin:8px 0;">
          <div style="width:52px; opacity:.85;">Size</div>
          <input id="ecmSize" type="range" min="1" max="400" step="1" value="24" style="flex:1;">
          <div id="ecmSizeVal" style="width:34px; text-align:right; font-variant-numeric:tabular-nums;">24</div>
        </div>
      `;

      const $m = (sel) => m.querySelector(sel);

      const sizeEl   = $m("#ecmSize");
      const sizeVal  = $m("#ecmSizeVal");


      function syncRangeLimitsFromMainUI(){
        // Mirror your main eraser slider if it exists
        if (typeof eraserSizeInput !== "undefined" && eraserSizeInput) {
          if (eraserSizeInput.min)  sizeEl.min  = eraserSizeInput.min;
          if (eraserSizeInput.max)  sizeEl.max  = eraserSizeInput.max;
          if (eraserSizeInput.step) sizeEl.step = eraserSizeInput.step;
        }
      }

      function syncMenuFromState(){
        syncRangeLimitsFromMainUI();

        const v = Math.round(Number(eraserSize) || 1);
        sizeEl.value = String(v);
        sizeVal.textContent = String(v);
      }

      function syncMainUIFromState(){
        if (typeof eraserSizeInput !== "undefined" && eraserSizeInput) {
          eraserSizeInput.value = String(Math.round(Number(eraserSize) || 1));
        }
        if (typeof eraserVal !== "undefined" && eraserVal) {
          eraserVal.textContent = String(Math.round(Number(eraserSize) || 1));
        }
      }

      function applyEraserSizeFromMenu(){
        const v = Math.round(Number(sizeEl.value) || 1);
        eraserSize = clamp(v, 1, 999);
        sizeVal.textContent = String(eraserSize);
        syncMainUIFromState();
      }

      // Live updates
      sizeEl.addEventListener("input", applyEraserSizeFromMenu);
      sizeEl.addEventListener("change", applyEraserSizeFromMenu);


      // close on outside click / escape / blur
      document.addEventListener("mousedown", (e) => {
        if (m.hidden) return;
        if (e.target === m || m.contains(e.target)) return;
        closeEraserCtxMenu();
      }, true);

      document.addEventListener("keydown", (e) => {
        if (m.hidden) return;
        if (e.key === "Escape") closeEraserCtxMenu();
      });

      window.addEventListener("blur", () => closeEraserCtxMenu());

      document.body.appendChild(m);

      // expose sync for open()
      m._syncFromState = syncMenuFromState;

      _eraserCtxMenu = m;
      return m;
    }


    function openEraserCtxMenu(ev, anchorEl){
      // (optional) close brush menu if open so they don't overlap
      try { closeBrushCtxMenu?.(); } catch {}

      const m = ensureEraserCtxMenu();
      _eraserCtxState = { anchorEl: anchorEl || null };

      try { m._syncFromState?.(); } catch {}

      m.hidden = false;
      m.style.left = "0px";
      m.style.top  = "0px";

      const pad = 6;
      const vw = window.innerWidth, vh = window.innerHeight;
      const r = m.getBoundingClientRect();

      let x = (ev?.clientX ?? 0) + 8;
      let y = (ev?.clientY ?? 0) + 8;

      if (x + r.width + pad > vw) x = Math.max(pad, vw - r.width - pad);
      if (y + r.height + pad > vh) y = Math.max(pad, vh - r.height - pad);

      m.style.left = `${x}px`;
      m.style.top  = `${y}px`;

      try { m.querySelector("#ecmSize")?.focus({ preventScroll: true }); } catch {}
    }

    function closeEraserCtxMenu(){
      if (_eraserCtxMenu) _eraserCtxMenu.hidden = true;
      _eraserCtxState = null;
    }

    // Wire: right-click eraser tool button opens the menu
    function wireEraserButtonRightClick(){
      if (document._eraserCtxWired) return;
      document._eraserCtxWired = true;

      const eraserSelectors = [
        "#toolEraser",
        '[data-tool="eraser"]',
        '[data-tool="fill-eraser"]',
        '[data-toolid="eraser"]',
        '[data-toolid="fill-eraser"]',
        '[data-toolname="eraser"]',
        '[data-toolname="fill-eraser"]',
        'button[value="eraser"]',
        'button[value="fill-eraser"]',
        'input[value="eraser"]',
        'input[value="fill-eraser"]',
      ].join(",");

      document.addEventListener("contextmenu", (e) => {
        const t = e.target;
        if (!t) return;

        const eraserEl = t.closest?.(eraserSelectors);
        if (!eraserEl) return;

        e.preventDefault();
        e.stopPropagation();

        openEraserCtxMenu(e, eraserEl);
      }, { capture: true });

      // Optional: close when interacting with canvas
      try {
        drawCanvas?.addEventListener("pointerdown", () => closeEraserCtxMenu(), { passive: true });
      } catch {}
    }



    // =========================================================
    // ISLAND_DOCK (Wheel + Tools + Layers)  (unique anchor)
    // - Reuses existing DOM nodes: #hsvWheelWrap, #toolSeg, #layerSeg
    // - Moves tool popups too so they don't get clipped by sidebars
    // =========================================================

    function mountIslandDock(){
      const island = document.getElementById("islandDock");
      if (!island) return;

      const header = document.getElementById("islandHeader");
      const tab = document.getElementById("islandTab");
      const btnCollapse = document.getElementById("islandCollapse");
      const btnReset = document.getElementById("islandReset");

      const wheelSlot  = document.getElementById("islandWheelSlot");
      const toolsSlot  = document.getElementById("islandToolsSlot");
      const layersSlot = document.getElementById("islandLayersSlot");

      const wheelWrap = document.getElementById("hsvWheelWrap");
      const toolSegEl = document.getElementById("toolSeg");
      const layerSegEl = document.getElementById("layerSeg");

      // popups (so they don't get clipped by sidebar overflow)
      const toolPopup = document.getElementById("toolOptionsPopup");
      const eraserPopup = document.getElementById("eraserOptionsPopup");

      if (wheelWrap && wheelSlot && wheelWrap.parentElement !== wheelSlot) wheelSlot.appendChild(wheelWrap);
      if (toolSegEl && toolsSlot && toolSegEl.parentElement !== toolsSlot) toolsSlot.appendChild(toolSegEl);
      if (layerSegEl && layersSlot && layerSegEl.parentElement !== layersSlot) layersSlot.appendChild(layerSegEl);

      if (toolPopup && toolPopup.parentElement !== island) island.appendChild(toolPopup);
      if (eraserPopup && eraserPopup.parentElement !== island) island.appendChild(eraserPopup);

      wireIslandIcons(toolSegEl);
      wireIslandCollapse(island, tab, btnCollapse);
      wireIslandReset(island, btnReset);
      wireIslandDrag(island, header);
      applyIslandSavedPos(island);
    }

    const ISLAND_POS_KEY = "celstomp.island.pos";

    function applyIslandSavedPos(island){
      try{
        const raw = localStorage.getItem(ISLAND_POS_KEY);
        if (!raw) return;
        const p = JSON.parse(raw);
        if (Number.isFinite(p.left)) island.style.left = `${p.left}px`;
        if (Number.isFinite(p.top))  island.style.top  = `${p.top}px`;
      } catch {}
    }

    function saveIslandPos(island){
      try{
        const r = island.getBoundingClientRect();
        localStorage.setItem(ISLAND_POS_KEY, JSON.stringify({
          left: Math.round(r.left),
          top:  Math.round(r.top),
        }));
      } catch {}
    }

    function wireIslandDrag(island, handle){
      if (!island || !handle || handle._islandDragWired) return;
      handle._islandDragWired = true;

      let pid = null;
      let dragging = false;
      let startX = 0, startY = 0;
      let startL = 0, startT = 0;

      const onMove = (e) => {
        if (!dragging || e.pointerId !== pid) return;

        const nx = startL + (e.clientX - startX);
        const ny = startT + (e.clientY - startY);

        const w = island.offsetWidth || 360;
        const h = island.offsetHeight || 300;

        const maxL = Math.max(8, window.innerWidth  - w - 8);
        const maxT = Math.max(8, window.innerHeight - h - 8);

        island.style.left = `${clamp(nx, 8, maxL)}px`;
        island.style.top  = `${clamp(ny, 8, maxT)}px`;

        e.preventDefault();
      };

      const onUp = (e) => {
        if (!dragging || e.pointerId !== pid) return;
        dragging = false;
        island.classList.remove("dragging");
        try { handle.releasePointerCapture(pid); } catch {}
        pid = null;
        saveIslandPos(island);
      };

      handle.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        pid = e.pointerId;
        dragging = true;

        const r = island.getBoundingClientRect();
        startL = r.left;
        startT = r.top;
        startX = e.clientX;
        startY = e.clientY;

        island.classList.add("dragging");
        try { handle.setPointerCapture(pid); } catch {}

        e.preventDefault();
      }, { passive: false });

      handle.addEventListener("pointermove", onMove, { passive: false });
      handle.addEventListener("pointerup", onUp, { passive: false });
      handle.addEventListener("pointercancel", onUp, { passive: false });
    }

    function wireIslandCollapse(island, tab, btnCollapse){
      if (!island || island._islandCollapseWired) return;
      island._islandCollapseWired = true;

      const setCollapsed = (v) => {
        island.classList.toggle("collapsed", !!v);
        if (tab) tab.setAttribute("aria-hidden", v ? "false" : "true");
      };

      btnCollapse?.addEventListener("click", (e) => {
        e.preventDefault();
        setCollapsed(!island.classList.contains("collapsed"));
      });

      tab?.addEventListener("click", (e) => {
        e.preventDefault();
        setCollapsed(false);
      });
    }

    function wireIslandReset(island, btnReset){
      btnReset?.addEventListener("click", (e) => {
        e.preventDefault();
        try { localStorage.removeItem(ISLAND_POS_KEY); } catch {}
        island.style.left = "18px";
        island.style.top  = "76px";
      });
    }

    // Assign icons (set CSS var --tool-icon on the labels)
    // Put your icon files in ./icons/ with these names (or change paths below)
    function wireIslandIcons(toolSegEl){
      if (!toolSegEl || toolSegEl._islandIconsWired) return;
      toolSegEl._islandIconsWired = true;

      const map = {
        "tool-brush":      "./icons/tool-brush.svg",
        "tool-eraser":     "./icons/tool-eraser.svg",
        "tool-filleraser": "./icons/tool-fill-eraser.svg",
        "tool-fillbrush":  "./icons/tool-fill-brush.svg",
        "tool-lassoFill":  "./icons/tool-lasso-fill.svg",
        "tool-lassoErase": "./icons/tool-lasso-erase.svg",
      };

      for (const [inputId, path] of Object.entries(map)){
        const lab = toolSegEl.querySelector(`label[for="${inputId}"]`);
        if (!lab) continue;

        lab.style.setProperty("--tool-icon", `url("${path}")`);

        // keep accessibility even though we hide text visually in the island
        const txt = (lab.textContent || "").trim();
        if (txt) lab.setAttribute("aria-label", txt);
      }
    }








    // Layer row right-click menu (Opacity + Clip to below)




    // ───────── Layer visibility (eye buttons) ─────────
    const visBtnByLayer = new Map();

    function layerIsHidden(L){
      if (L === PAPER_LAYER) return false;
      return (layers[L]?.opacity ?? 1) <= 0;
    }

    function updateVisBtn(L){
      const btn = visBtnByLayer.get(L);
      if (!btn) return;

      const hidden = layerIsHidden(L);
      btn.classList.toggle("is-hidden", hidden);
      btn.textContent = hidden ? "🙈" : "👁";
      btn.title = hidden ? "Show layer" : "Hide layer";
      btn.setAttribute("aria-pressed", hidden ? "true" : "false");
    }

    function injectVisBtn(radioId, L){
      const input = document.getElementById(radioId);
      if (!input) return;


      const label =
        input.closest("label") ||
        document.querySelector(`label[for="${radioId}"]`) ||
        input.parentElement;

      if (!label) return;

    
      const existing = label.querySelector(".visBtn");
      if (existing) {
        visBtnByLayer.set(L, existing);
        updateVisBtn(L);
        return;
      }

      // (optional) don't show eye for PAPER
      if (L === PAPER_LAYER) return;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "visBtn";
      btn.dataset.layer = String(L);

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const wasHidden = layerIsHidden(L);
        setLayerVisibility(L, wasHidden); // wasHidden=true => show, false => hide
        updateVisBtn(L);
      });

      // Put button on the LEFT of the row
      label.insertBefore(btn, label.firstChild);

      // ✅ optional: a tiny badge that shows when clip is ON (LINE/SHADE/COLOR only)
      label.dataset.layerRow = String(L);

      if (isClipEligibleMainLayer(layers?.[L]?.name)) {
        let badge = label.querySelector(".clipBadge");
        if (!badge) {
          badge = document.createElement("span");
          badge.className = "clipBadge";
          badge.textContent = "⛓";
          badge.title = "Clipped to layer below";
          badge.hidden = true;

          // place right after the eye button
          label.insertBefore(badge, btn.nextSibling);
        }
        try { updateLayerClipBadge(L); } catch {}
      }



      // ✅ Right-click anywhere on the layer row opens opacity slider
      if (!label._opacityCtxWired) {
        label._opacityCtxWired = true;
        label.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          e.stopPropagation();
          openLayerRowMenu(L, e);
        }, { passive: false });

      }

      
      visBtnByLayer.set(L, btn);
      updateVisBtn(L);
    }


    function wireLayerVisButtons(){
      // Map your radio ids to your layer constants.
      // Adjust these IDs if your HTML differs.
      injectVisBtn("bt-paper",  PAPER_LAYER);
      injectVisBtn("bt-fill",   LAYER.FILL);
      injectVisBtn("bt-sketch", LAYER.COLOR);
      injectVisBtn("bt-color",  LAYER.SHADE);
      injectVisBtn("bt-line",   LAYER.LINE);

      // refresh all
      updateVisBtn(LAYER.FILL);
      updateVisBtn(LAYER.COLOR);
      updateVisBtn(LAYER.SHADE);
      updateVisBtn(LAYER.LINE);
      try {
        updateLayerClipBadge(LAYER.COLOR);
        updateLayerClipBadge(LAYER.SHADE);
        updateLayerClipBadge(LAYER.LINE);
      } catch {}

    }

    



    function clearCelAt(L, F) {
      if (L === PAPER_LAYER) return;

      const layer = layers[L];
      if (!layer) return;

      // clear ALL sublayers at this frame (most intuitive behavior)
      const order = layer.suborder || [];
      const map = layer.sublayers || new Map();

      for (const key of order) {
        const sub = map.get(key);
        const c = sub?.frames?.[F];
        if (c && c._hasContent) {
          try { pushUndo(L, F, key); } catch {}
          const g = c.getContext("2d", { willReadFrequently: true });
          g.setTransform(1,0,0,1,0,0);
          g.clearRect(0, 0, contentW, contentH);
          c._hasContent = false;
        }
      }

      renderAll();
      updateTimelineHasContent(F);
      updateHUD();
      pruneUnusedSublayers(L);

    }

    function clearEntireLayer(L) {
      if (L === PAPER_LAYER) return;

      const layer = layers[L];
      if (!layer) return;

      const order = layer.suborder || [];
      const map = layer.sublayers || new Map();

      for (let f = 0; f < totalFrames; f++) {
        for (const key of order) {
          const sub = map.get(key);
          const c = sub?.frames?.[f];
          if (c && c._hasContent) {
            try { pushUndo(L, f, key); } catch {}
            const g = c.getContext("2d", { willReadFrequently: true });
            g.setTransform(1,0,0,1,0,0);
            g.clearRect(0, 0, contentW, contentH);
            c._hasContent = false;
          }
        }
      }

   
      renderAll();
      if (hasTimeline) buildTimeline(); 
      try { renderLayerSwatches(); } catch {}
      try { wireLayerVisButtons(); } catch {}  
      updateHUD();
      pruneUnusedSublayers(L);
    

    }


    
    // -------------------------
    // Timeline build + markers
    // -------------------------
    function buildTimeline() {
      if (!hasTimeline) return;

      totalFrames = fps * seconds;

      if (referenceCels.length < totalFrames) {
        const oldLen = referenceCels.length;
        referenceCels.length = totalFrames;
        referenceCels.fill(null, oldLen);
      } else if (referenceCels.length > totalFrames) {
        referenceCels.length = totalFrames;
      }

      // ✅ Resize ALL sublayer frame arrays to match new totalFrames
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

      // Resize layer frame arrays, preserving existing references
      layers.forEach((l) => {
        const old = l.frames;
        const n = new Array(totalFrames).fill(null);
        const copy = Math.min(old.length, n.length);
        for (let i = 0; i < copy; i++) n[i] = old[i];
        l.frames = n;
      });

      clipStart = clamp(clipStart, 0, totalFrames - 1);
      clipEnd = clamp(clipEnd, clipStart, totalFrames - 1);

      timelineTable.innerHTML = "";

      // Playhead row
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
      timelineTable.appendChild(playRow);

      const refRow = document.createElement("tr");
      refRow.className = "ref-row";
      const refTh = document.createElement("th");
      refTh.className = "sticky";
      refTh.textContent = "Reference";
      refTh.style.fontSize = "11px";
      refRow.appendChild(refTh);

      for (let i = 0; i < totalFrames; i++) {
        const td = document.createElement("td");
        td.dataset.index = String(i);

        const item = referenceCels[i];

        if (item && item instanceof HTMLImageElement) {
          let span = 1;
          for (let j = i + 1; j < totalFrames; j++) {
            if (referenceCels[j] !== null) break;
            span++;
          }

          const block = document.createElement("div");
          block.className = "ref-block";
          block.textContent = item._filename || "Reference";
          block.title = item._filename || "Reference Image";
          block.style.width = `calc(${span} * var(--frame-w, 24px) - 1px)`;
          block.dataset.startIndex = i;
          block.dataset.span = span;

          const hL = document.createElement("div");
          hL.className = "ref-handle left";
          hL.dataset.action = "resize-left";
          
          const hR = document.createElement("div");
          hR.className = "ref-handle right";
          hR.dataset.action = "resize-right";

          block.appendChild(hL);
          block.appendChild(hR);
          td.appendChild(block);
        }
        
        // Visual indicator for "Empty/Stop" markers (Optional, debugging mostly)
        //if (item && item.empty) {
        //   td.style.background = "rgba(255, 255, 255, 0.05)";
        //   td.title = "Reference Cleared Here";
        //}

        refRow.appendChild(td);
      }
      timelineTable.appendChild(refRow);

      // Anim row
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

      timelineTable.appendChild(tr);

      currentFrame = clamp(currentFrame, 0, totalFrames - 1);
      updateHUD();
  

      pruneSelection();
      highlightTimelineCell();
      updatePlayheadMarker();
      updateClipMarkers();
    }

    function highlightTimelineCell() {
      if (!hasTimeline) return;
      const tr = timelineTable.querySelector("tr.anim-row");
      if (!tr) return;

      [...tr.children].forEach((cell, idx) => {
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

    function updateTimelineHasContent(F) {
      if (!hasTimeline) return;
      const tr = timelineTable.querySelector("tr.anim-row");
      if (!tr) return;
      const td = tr.children[F + 1];
      if (!td) return;
      td.classList.toggle("hasContent", hasCel(F));
    }

    function refreshTimelineRowHasContentAll(){
      if (!hasTimeline) return;
      const tr = timelineTable.querySelector("tr.anim-row");
      if (!tr) return;
      for (let F = 0; F < totalFrames; F++){
        const td = tr.children[F + 1];
        if (td) td.classList.toggle("hasContent", hasCel(F));
      }
      try { highlightTimelineCell?.(); } catch {}
    }

    function fallbackSwatchKeyForLayer(L){
      if (L == null || L === PAPER_LAYER) return null;

      const layer = layers?.[L];
      const ord = layer?.suborder || [];
      const map = layer?.sublayers;

      // pick first existing swatch key
      for (const k of ord){
        if (k && map?.get?.(k)) return k;
      }

      // defaults
      if (L === LAYER.FILL) return fillWhite || "#FFFFFF";
      try { return rememberedColorForLayer?.(L) ?? "#000000"; } catch {}
      return "#000000";
    }

    function migrateHistoryForSwatchMove(srcL, dstL, key){
      if (!historyMap || srcL == null || dstL == null) return;

      const srcK = (typeof resolveKeyFor === "function") ? resolveKeyFor(srcL, key) : key;
      const dstK = (typeof resolveKeyFor === "function") ? resolveKeyFor(dstL, key) : key;

      for (let F = 0; F < totalFrames; F++){
        const from = historyKey(srcL, F, srcK);
        const to   = historyKey(dstL, F, dstK);

        const srcHist = historyMap.get(from);
        if (!srcHist) continue;

        const dstHist = historyMap.get(to);

        if (!dstHist){
          historyMap.set(to, srcHist);
        } else {
          // merge (keep within limit)
          dstHist.undo = [...dstHist.undo, ...srcHist.undo].slice(-historyLimit);
          dstHist.redo = [...dstHist.redo, ...srcHist.redo].slice(-historyLimit);
        }

        historyMap.delete(from);
      }
    }

    function updatePlayheadMarker() {
      if (!hasTimeline) return;
      const playRow = timelineTable.querySelector("tr.playhead-row");
      if (!playRow) return;
      const targetCell = playRow.children[currentFrame + 1];
      if (!targetCell) return;

      const cellRect = targetCell.getBoundingClientRect();
      const scrollRect = timelineScroll.getBoundingClientRect();
      const leftInScroll = cellRect.left - scrollRect.left + timelineScroll.scrollLeft;

      playheadMarker.style.left = Math.round(leftInScroll) + "px";
    }

    function edgeLeftPxOfFrame(frameIndex) {
      if (!hasTimeline) return 0;
      const playRow = timelineTable.querySelector("tr.playhead-row");
      const cell = playRow?.children[frameIndex + 1];
      if (!cell) return 0;

      const cellRect = cell.getBoundingClientRect();
      const scrollRect = timelineScroll.getBoundingClientRect();
      return cellRect.left - scrollRect.left + timelineScroll.scrollLeft;
    }

    function updateClipMarkers() {
      if (!hasTimeline) return;
      clipStartMarker.style.left = Math.round(edgeLeftPxOfFrame(clipStart)) + "px";
      clipEndMarker.style.left = Math.round(edgeLeftPxOfFrame(clipEnd)) + "px";
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
      updateHUD();
    
      renderAll();
      updatePlayheadMarker();

      // Keep visible in scroll
      if (!hasTimeline) return;
      const playRow = timelineTable.querySelector("tr.playhead-row");
      const cell = playRow?.children[currentFrame + 1];
      if (!cell) return;

      const r = cell.getBoundingClientRect();
      const sr = timelineScroll.getBoundingClientRect();
      const left = r.left - sr.left + timelineScroll.scrollLeft;
      const right = left + r.width;

      if (left < timelineScroll.scrollLeft) timelineScroll.scrollLeft = left - 20;
      else if (right > timelineScroll.scrollLeft + timelineScroll.clientWidth) {
        timelineScroll.scrollLeft = right - timelineScroll.clientWidth + 20;
      }
    }



    // -------------------------
    // Color swatch
    // -------------------------
    function setColorSwatch() {
      if (!brushSwatch || !brushHexEl) return;
      const tmp = document.createElement("canvas").getContext("2d");
      tmp.fillStyle = currentColor;
      tmp.fillRect(0, 0, 1, 1);
      const [r, g, b] = tmp.getImageData(0, 0, 1, 1).data;
      const hex = "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
      brushSwatch.style.background = hex;
      brushHexEl.textContent = hex.toUpperCase();
    }

    function setHSVPreviewBox() {
      if (!hsvWheelPreview) return;
      hsvWheelPreview.style.background = currentColor || "#000000";
    }

    // -------------------------
    // Drawing tools
    // -------------------------
    function pressure(e) {
      return typeof e.pressure === "number" && e.pressure > 0 ? e.pressure : 1;
    }

    function stampSquareLine(ctx, x0, y0, x1, y1, size, color, alpha = 1) {
      const s = Math.max(1, Math.round(size));
      const dx = x1 - x0,
        dy = y1 - y0;
      const dist = Math.hypot(dx, dy);
      const step = Math.max(1, s * 0.5);
      const n = Math.max(1, Math.ceil(dist / step));
      const nx = dx / n,
        ny = dy / n;

      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;

      for (let i = 0; i <= n; i++) {
        const px = Math.round(x0 + nx * i - s / 2);
        const py = Math.round(y0 + ny * i - s / 2);
        ctx.fillRect(px, py, s, s);
      }
      try { markGlobalHistoryDirty(); } catch {}
      ctx.restore();
    }

    // -------------------------
    // Fill masks + flood (Line+Color) and (Line+Termi)
    // -------------------------
    function morphologicalClose(mask, w, h, gapPx) {
      const r = Math.max(0, Math.round(gapPx));

      function dilate(src) {
        const dst = new Uint8Array(w * h);
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            let v = 0;
            for (let oy = -1; oy <= 1; oy++) {
              for (let ox = -1; ox <= 1; ox++) {
                const nx = x + ox,
                  ny = y + oy;
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
                const nx = x + ox,
                  ny = y + oy;
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
      let qs = 0,
        qe = 0;

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
        const x = qx[qs],
          y = qy[qs];
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

      const lineCanvases  = canvasesWithContentForMainLayerFrame(LAYER.LINE,  F);

      // ✅ If we're filling/erasing on COLOR layer, don't include COLOR as a wall.
      const colorCanvases =
        (targetLayer === LAYER.COLOR)
          ? []
          : canvasesWithContentForMainLayerFrame(LAYER.COLOR, F);

      if (!lineCanvases.length && !colorCanvases.length) return null;

      const mask = new Uint8Array(w * h);

      function addMaskFrom(canvas) {
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        const im = ctx.getImageData(0, 0, w, h).data;
        for (let i = 0, p = 0; i < im.length; i += 4, p++) {
          if (im[i + 3] > 10) mask[p] = 1;
        }
      }

      for (const c of lineCanvases) addMaskFrom(c);
      for (const c of colorCanvases) addMaskFrom(c);

      const closed = morphologicalClose(mask, w, h, gapPx);
      const outside = computeOutsideFromClosed(closed, w, h);

      return { closed, outside, w, h };
    }

    function combinedInsideMask_LineOnly(F, gapPx) {
      const w = contentW, h = contentH;

      const lineCanvases = canvasesWithContentForMainLayerFrame(LAYER.LINE, F);
      if (!lineCanvases.length) return null;

      const mask = new Uint8Array(w * h);

      function addMaskFrom(canvas) {
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        const im = ctx.getImageData(0, 0, w, h).data;
        for (let i = 0, p = 0; i < im.length; i += 4, p++) {
          if (im[i + 3] > 10) mask[p] = 1;
        }
      }

      for (const c of lineCanvases) addMaskFrom(c);

      const closed  = morphologicalClose(mask, w, h, gapPx);
      const outside = computeOutsideFromClosed(closed, w, h);

      return { closed, outside, w, h };
    }


    // FILL_TOOL_SWATCH_SYNC (unique anchor)
       
    function fillKeyForTool(L, toolKind){
      if (L === PAPER_LAYER) return null;

      const cur = colorToHex(currentColor ?? "#000000");

      // ✅ FILL layer: special rules
      if (L === LAYER.FILL) {
        // Fill-brush on FILL layer = colored swatches
        if (toolKind === "fill-brush") return cur;

        // Fill-eraser on FILL layer = erase active fill swatch (fallback white)
        if (toolKind === "fill-eraser") return (activeSubColor?.[LAYER.FILL] || fillWhite);

        // Fill-main behaviors (fill current/all cels, fill from lineart) stay white
        return fillWhite;
      }

      // ✅ Non-FILL layers
      if (toolKind === "fill-brush") return cur;

      // Fill-eraser erases ACTIVE swatch (fallback currentColor)
      return colorToHex(activeSubColor?.[L] ?? currentColor ?? "#000000");
    }

    function ensureActiveSwatchForColorLayer(L, key){
      if (L == null || L === PAPER_LAYER || L === LAYER.FILL) return;
      if (Array.isArray(activeSubColor)) activeSubColor[L] = key;
      ensureSublayer(L, key);
      try { normalizeLayerSwatchKeys(layer); } catch {}
      try { renderLayerSwatches(L); } catch {}
    }

    function applyFillRegionsFromSeeds(F, seeds, targetLayer) {


      // ✅ IMPORTANT: mask must NOT include the target paint layer, or it blocks erase
      let masks = insideMaskFromLineartOnly(F, closeGapPx);

      // fallback if no lineart exists
      if (!masks && typeof combinedInsideMask_LineColor === "function") {
        masks = combinedInsideMask_LineColor(F, closeGapPx);
      }
      if (!masks) return false;

      const { closed, outside, w, h } = masks;
      const visited = new Uint8Array(w * h);

      const layer = (typeof targetLayer === "number") ? targetLayer : LAYER.FILL;

      // ✅ Keyed to the fill-brush color (currentColor), so the swatch matches the fill
      const key = fillKeyForTool(layer, "fill-brush");
      if (!key) return false;

      // ✅ For FILL layer, we DO want colored swatches for fill-brush
      if (layer === LAYER.FILL) {
        if (Array.isArray(activeSubColor)) activeSubColor[LAYER.FILL] = key;
        ensureSublayer(LAYER.FILL, key);
        try { renderLayerSwatches(LAYER.FILL); } catch {}
      } else {
        // ✅ Non-FILL layers keep existing behavior
        ensureActiveSwatchForColorLayer(layer, key);
      }

      const fillCanvas = getFrameCanvas(layer, F, key);
      const fctx = fillCanvas.getContext("2d", { willReadFrequently: true });
      const img = fctx.getImageData(0, 0, w, h);
      const d = img.data;

      // Fill color = this swatch key (white for FILL layer, or currentColor for others)
      const tmp = document.createElement("canvas").getContext("2d");
      tmp.fillStyle = key;
      tmp.fillRect(0, 0, 1, 1);
      const c = tmp.getImageData(0, 0, 1, 1).data;

      const qx = new Uint32Array(w * h), qy = new Uint32Array(w * h);
      let qs = 0, qe = 0;

      function push(x, y){ qx[qe] = x; qy[qe] = y; qe++; }
      function inBounds(x, y){ return x >= 0 && y >= 0 && x < w && y < h; }
      function isInside(x, y){
        const idx = y * w + x;
        return !outside[idx] && !closed[idx];
      }

      let any = false;

      function floodSeed(sx, sy){
        sx |= 0; sy |= 0;
        if (!inBounds(sx, sy)) return;

        const si = sy * w + sx;
        if (visited[si] || !isInside(sx, sy)) return;

        visited[si] = 1;
        push(sx, sy);

        while (qs < qe){
          const x = qx[qs], y = qy[qs]; qs++;
          const idx = y * w + x;
          const i4 = idx * 4;

          d[i4 + 0] = c[0];
          d[i4 + 1] = c[1];
          d[i4 + 2] = c[2];
          d[i4 + 3] = 255;
          any = true;

          const nbs = [[x+1,y],[x-1,y],[x,y+1],[x,y-1]];
          for (const [nx, ny] of nbs){
            if (!inBounds(nx, ny)) continue;
            const j = ny * w + nx;
            if (visited[j]) continue;
            if (!isInside(nx, ny)) continue;
            visited[j] = 1;
            push(nx, ny);
          }
        }

        qs = 0; qe = 0;
      }

      for (const pt of seeds) floodSeed(Math.round(pt.x), Math.round(pt.y));
      if (!any) return false;

      fctx.putImageData(img, 0, 0);
      fillCanvas._hasContent = true;

      renderAll();
      updateTimelineHasContent(F);
      return true;
    }

    function eraseFillRegionsFromSeeds(a, b, c, d) {
      // Accept BOTH call styles safely:
      // - (targetLayer, F, seeds [, strokePts])
      // - (F, seeds, targetLayer [, strokePts])
      let layer, F, seeds, strokePts;

      if (Array.isArray(b)) {
        // (F, seeds, targetLayer [, strokePts])
        F = Number(a);
        seeds = b;
        layer = (typeof c === "number") ? c : LAYER.FILL;
        strokePts = (Array.isArray(d) && d.length) ? d : seeds;
      } else if (Array.isArray(c)) {
        // (targetLayer, F, seeds [, strokePts])
        layer = (typeof a === "number") ? a : LAYER.FILL;
        F = Number(b);
        seeds = c;
        strokePts = (Array.isArray(d) && d.length) ? d : seeds;
      } else {
        return false;
      }

      const pts = (Array.isArray(strokePts) && strokePts.length) ? strokePts : seeds;
      if (!Array.isArray(pts) || !pts.length) return false;
      if (!Array.isArray(seeds) || !seeds.length) seeds = pts;
      if (!Number.isFinite(F)) F = currentFrame;

      // ✅ Same enclosure detection as fill brush
      const masks = combinedInsideMask_LineColor(F, closeGapPx);
      if (!masks) return false;

      const { closed, outside, w, h } = masks;

      const inBounds = (x, y) => (x >= 0 && y >= 0 && x < w && y < h);
      const idxOf = (x, y) => (y * w + x);
      const isInsideIdx = (idx) => (!outside[idx] && !closed[idx]);

      // Build usable inside seed indices (ignore outside/closed pixels)
      const seedIdxs = [];
      for (const pt of pts) {
        const sx = Math.round(pt.x), sy = Math.round(pt.y);
        if (!inBounds(sx, sy)) continue;
        const si = idxOf(sx, sy);
        if (isInsideIdx(si)) seedIdxs.push(si);
      }
      if (!seedIdxs.length) return false;

      // Toggle:
      // - true  => erase whatever swatch has pixels under the stroke (feels like a real "fill eraser")
      // - false => erase ONLY the currently active swatch
      const AUTO_PICK_UNDER_STROKE = false;

      function pickExistingKey(L, want) {
        const lay = layers?.[L];
        const subMap = lay?.sublayers;
        if (!subMap || !subMap.get) return null;

        const hasKey = (k) => !!k && (subMap.has?.(k) || !!subMap.get(k));

        // Prefer your resolver if it exists
        if (typeof resolveKeyFor === "function") {
          try {
            const rk = resolveKeyFor(L, want);
            if (hasKey(rk)) return rk;
          } catch {}
        }

        if (hasKey(want)) return want;

        if (typeof want === "string") {
          // normalize #rgb -> #rrggbb and uppercase
          const n = (typeof normHex6 === "function") ? normHex6(want) : null;
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
        const seen = new Set();

        const tryAdd = (k) => {
          if (!k || seen.has(k)) return;
          if (!(subMap.has?.(k) || subMap.get(k))) return;
          seen.add(k);
          out.push(k);
        };

        // 1) preferred first
        tryAdd(preferredKey);

        // 2) auto-pick by checking alpha under seeds
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

            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            if (!ctx) continue;

            let img;
            try { img = ctx.getImageData(0, 0, w, h); } catch { continue; }
            const dpx = img.data;

            let hit = false;
            for (let s = 0; s < seedIdxs.length; s++) {
              if (dpx[seedIdxs[s] * 4 + 3]) { hit = true; break; }
            }
            if (hit) tryAdd(k);
          }
        }

        return out;
      }

      // Decide which layer(s) to erase on.
      // If you ONLY want the active layer, keep as [layer].
      // If you often fill on FILL but erase while on COLOR, uncomment the fallback.
      const layersToErase = (layer === -1)
        ? [LAYER.FILL, LAYER.COLOR, LAYER.SHADE, LAYER.LINE]  // all paint-ish layers
        : [layer];
      // if (layer === LAYER.COLOR) layersToErase.push(LAYER.FILL);

      let didAny = false;

      // shared BFS buffers
      const qx = new Uint32Array(w * h);
      const qy = new Uint32Array(w * h);

      for (const L of layersToErase) {
        const lay = layers?.[L];
        const subMap = lay?.sublayers;
        if (!subMap || !subMap.get) continue;

        // preferred swatch = current active on that layer (Fill uses fillWhite)
        const want =
          (L === LAYER.FILL)
            ? (activeSubColor?.[LAYER.FILL] || fillWhite || "#FFFFFF")
            : (activeSubColor?.[L] ?? currentColor);
        const preferredKey = pickExistingKey(L, want);
        const keys = keysHitUnderStroke(L, preferredKey);

        for (const key of keys) {
          const sub = subMap.get(key);
          const canvas = sub?.frames?.[F] || null;
          if (!canvas) continue;
          if ((canvas.width | 0) !== w || (canvas.height | 0) !== h) continue;

          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (!ctx) continue;

          let img;
          try { img = ctx.getImageData(0, 0, w, h); } catch { continue; }
          const dpx = img.data;

          // Lazy undo (per swatch)
          let undoPushed = false;
          const ensureUndoOnce = () => {
            if (undoPushed) return;
            undoPushed = true;
            try { pushUndo(L, F, key); } catch {}
          };

          const visited = new Uint8Array(w * h);

          function floodFromSeedIdx(si) {
            if (visited[si] || !isInsideIdx(si)) return false;

            let qs = 0, qe = 0;
            visited[si] = 1;
            qx[qe] = si % w;
            qy[qe] = (si / w) | 0;
            qe++;

            let anyHere = false;

            while (qs < qe) {
              const x = qx[qs], y = qy[qs]; qs++;
              const idx = idxOf(x, y);
              const a4 = idx * 4 + 3;

              if (dpx[a4]) {
                ensureUndoOnce();
                dpx[a4] = 0;
                anyHere = true;
              }

              // 4-neighbors
              if (x + 1 < w) { const ni = idx + 1; if (!visited[ni] && isInsideIdx(ni)) { visited[ni] = 1; qx[qe] = x + 1; qy[qe] = y; qe++; } }
              if (x - 1 >= 0) { const ni = idx - 1; if (!visited[ni] && isInsideIdx(ni)) { visited[ni] = 1; qx[qe] = x - 1; qy[qe] = y; qe++; } }
              if (y + 1 < h) { const ni = idx + w; if (!visited[ni] && isInsideIdx(ni)) { visited[ni] = 1; qx[qe] = x; qy[qe] = y + 1; qe++; } }
              if (y - 1 >= 0) { const ni = idx - w; if (!visited[ni] && isInsideIdx(ni)) { visited[ni] = 1; qx[qe] = x; qy[qe] = y - 1; qe++; } }
            }

            return anyHere;
          }

          let any = false;
          for (let s = 0; s < seedIdxs.length; s++) {
            if (floodFromSeedIdx(seedIdxs[s])) any = true;
          }
          if (!any) continue;

          ctx.putImageData(img, 0, 0);

          // Accurate _hasContent
          let anyAlpha = false;
          for (let i = 3; i < dpx.length; i += 4) { if (dpx[i]) { anyAlpha = true; break; } }
          canvas._hasContent = anyAlpha;

          didAny = true;
        }

        if (didAny) {
          try { pruneUnusedSublayers?.(L); } catch {}
        }
      }

      if (!didAny) return false;

      renderAll();
      updateTimelineHasContent(F);
      return true;
    }


    function insideMaskFromLineartOnly(F, gapPx){
      const w = contentW | 0, h = contentH | 0;

      const lineCanvases = canvasesWithContentForMainLayerFrame(LAYER.LINE, F);
      if (!lineCanvases || !lineCanvases.length) return null;

      const mask = new Uint8Array(w * h);

      for (const canvas of lineCanvases) {
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) continue;

        const data = ctx.getImageData(0, 0, w, h).data;

        // use ALPHA so it works even if line is colored
        for (let i = 3, p = 0; i < data.length; i += 4, p++) {
          if (data[i] > 10) mask[p] = 1;
        }
      }

      const closed  = morphologicalClose(mask, w, h, gapPx);
      const outside = computeOutsideFromClosed(closed, w, h);

      return { closed, outside, w, h };
    }

    // Autofill: fill all inside lineart
    function fillFromLineart(F) {
      const w = contentW, h = contentH;

      const lineCanvases = canvasesWithContentForMainLayerFrame(LAYER.LINE, F);
      if (!lineCanvases.length) return false;

      const mask = new Uint8Array(w * h);
      for (const canvas of lineCanvases) {
        const srcCtx = canvas.getContext("2d", { willReadFrequently: true });
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

      const tmp = document.createElement("canvas").getContext("2d");
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
      renderAll();
      updateTimelineHasContent(F);
      return true;
    }


   

    // -------------------------
    // Stroke state
    // -------------------------
    let isDrawing = false;


    // TOUCH_GESTURE_LOCK (unique anchor)
    const _touchPointers = new Map(); // pointerId -> {x,y}
    let _touchGestureActive = false;

    function _updateTouchGestureState(){
      const was = _touchGestureActive;
      _touchGestureActive = (_touchPointers.size >= 2);

      // If gesture starts, kill any active stroke immediately
      if (!was && _touchGestureActive){
        try { cancelActiveStroke?.(); } catch {}
        try { endStroke?.(true); } catch {}   // if you have something like this
        try { stopDrawing?.(); } catch {}     // if you have something like this

        // Hard fallback (safe even if you don't have helpers)
        try { isDrawing = false; } catch {}
        try { lastX = lastY = null; } catch {}
      }
    }

    // MOBILE_FILL_LASSO_POINTER_CAPTURE (unique anchor)
    function wireCanvasPointerDrawingMobileSafe(){
      // Prefer your existing references if they exist
      const stageEl =
        (typeof stage !== "undefined" && stage) ||
        document.getElementById("stage");

      const canvasEl =
        (typeof drawCanvas !== "undefined" && drawCanvas) ||
        document.getElementById("drawCanvas") ||
        document.querySelector("canvas");

      if (!canvasEl || canvasEl._celstompPointerWired) return;
      canvasEl._celstompPointerWired = true;


      // ✅ UNIFY_CANVAS_INPUT (unique anchor)
      const __USE_UNIFIED_CANVAS_INPUT__ = true;

      // ...

      if (__USE_UNIFIED_CANVAS_INPUT__) {
        // We already have the main pointer pipeline: handlePointerDown/Move/Up.
        // So here we ONLY prep the surface; do NOT attach a second set of listeners.
        try { canvasEl.style.touchAction = "none"; } catch {}
        try { if (stageEl) stageEl.style.touchAction = "none"; } catch {}

        // Make sure overlays never steal touches
        try { if (typeof fxCanvas !== "undefined" && fxCanvas) fxCanvas.style.pointerEvents = "none"; } catch {}
        try { if (typeof boundsCanvas !== "undefined" && boundsCanvas) boundsCanvas.style.pointerEvents = "none"; } catch {}

        // mark wired so native-zoom-guard stops trying
        try { window.__CELSTOMP_PTR_DRAW_WIRED__ = true; } catch {}
        return;
      }

      // Make sure overlays never steal touches
      try {
        if (typeof fxCanvas !== "undefined" && fxCanvas) fxCanvas.style.pointerEvents = "none";
      } catch {}
      try {
        if (typeof boundsCanvas !== "undefined" && boundsCanvas) boundsCanvas.style.pointerEvents = "none";
      } catch {}

      // Kill native scroll/zoom gestures on the drawing surface
      try { canvasEl.style.touchAction = "none"; } catch {}
      try { if (stageEl) stageEl.style.touchAction = "none"; } catch {}

      // Touch pointer tracking for your gesture lock
      const addTouchPtr = (e) => {
        if (e.pointerType !== "touch") return;
        _touchPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        _updateTouchGestureState();
      };
      const moveTouchPtr = (e) => {
        if (e.pointerType !== "touch") return;
        if (!_touchPointers.has(e.pointerId)) return;
        _touchPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      };
      const removeTouchPtr = (e) => {
        if (e.pointerType !== "touch") return;
        _touchPointers.delete(e.pointerId);
        _updateTouchGestureState();
      };

      const hardCancelStroke = () => {
        // safe “stop everything”
        try { cancelLasso?.(); } catch {}
        try { clearFx?.(); } catch {}
        try { isDrawing = false; } catch {}
        try { isPanning = false; } catch {}
        try { lastPt = null; } catch {}
        try { trailPoints = []; } catch {}
        try { _fillEraseAllLayers = false; } catch {}
      };

      const shouldIgnorePointer = (e) => {
        // Don’t start a second stroke from extra touches
        if (e.pointerType !== "mouse" && e.isPrimary === false) return true;

        // Ignore non-left clicks (except right click pan)
        if (e.pointerType === "mouse") {
          if (e.button !== 0 && e.button !== 2) return true;
        }
        return false;
      };

      canvasEl.addEventListener("pointerdown", (e) => {
        if (shouldIgnorePointer(e)) return;

        addTouchPtr(e);

        // If 2+ fingers: gesture mode. Don’t let tools start.
        if (_touchGestureActive) {
          hardCancelStroke();
          e.preventDefault();
          return;
        }

        // Capture so pointerup always arrives (mobile fix)
        try { canvasEl.setPointerCapture(e.pointerId); } catch {}

        // Your normal tool logic
        try { startStroke(e); } catch (err) { console.warn("[celstomp] startStroke failed", err); }

        e.preventDefault();
      }, { passive: false });

      canvasEl.addEventListener("pointermove", (e) => {
        moveTouchPtr(e);

        // If gesture becomes active mid-stroke, cancel drawing cleanly
        if (_touchGestureActive) {
          hardCancelStroke();
          e.preventDefault();
          return;
        }

        // keep your pan/draw behavior intact
        try {
          if (typeof isPanning !== "undefined" && isPanning) {
            continuePan(e);
            e.preventDefault();
            return;
          }
          if (typeof isDrawing !== "undefined" && isDrawing) {
            continueStroke(e);
            e.preventDefault();
            return;
          }
        } catch (err) {
          console.warn("[celstomp] pointermove failed", err);
        }
      }, { passive: false });

      const finish = (e) => {
        removeTouchPtr(e);

        // Always attempt to commit a stroke on release (this is what mobile was missing)
        try { endStrokeMobileSafe(e); } catch {}

        try { canvasEl.releasePointerCapture(e.pointerId); } catch {}
      };

      canvasEl.addEventListener("pointerup", finish, { passive: false });
      canvasEl.addEventListener("pointercancel", finish, { passive: false });
      canvasEl.addEventListener("lostpointercapture", finish, { passive: false });
    }

    let lastPt = null;
    let strokeHex = null; // <-- add

    let _fillEraseAllLayers = false; // SHIFT when starting fill-eraser


    let isPanning = false;
    let panStart = { x: 0, y: 0, ox: 0, oy: 0 };

    // Fill brush trail and Termi seeds
    let trailPoints = [];
  
    // Lasso fill state
    let lassoActive = false;
    let lassoPts = [];
    const lassoMinDist = 2.5; // content-space distance between points

    function addLassoPoint(pt){
      const last = lassoPts[lassoPts.length - 1];
      if (!last || Math.hypot(pt.x - last.x, pt.y - last.y) >= lassoMinDist) {
        lassoPts.push(pt);
      }
    }

    function drawLassoPreview(mode = "fill"){
      clearFx();
      if (lassoPts.length < 2) return;

      const isErase = (mode === "erase");

      fxTransform();
      fxctx.save();

      // Ghost fill preview (only for fill-mode)
      if (!isErase) {
        fxctx.globalAlpha = 0.18;
        fxctx.fillStyle = currentColor;
        fxctx.beginPath();
        fxctx.moveTo(lassoPts[0].x, lassoPts[0].y);
        for (let i = 1; i < lassoPts.length; i++) fxctx.lineTo(lassoPts[i].x, lassoPts[i].y);
        fxctx.closePath();
        fxctx.fill();
      }

      // Outline (dash)
      fxctx.globalAlpha = 1;
      fxctx.lineWidth = Math.max(1 / (zoom * dpr), 0.6);
      fxctx.setLineDash([10 / zoom, 7 / zoom]);
      fxctx.strokeStyle = isErase ? "rgba(255,90,90,0.95)" : "rgba(255,255,255,0.95)";
      fxctx.beginPath();
      fxctx.moveTo(lassoPts[0].x, lassoPts[0].y);
      for (let i = 1; i < lassoPts.length; i++) fxctx.lineTo(lassoPts[i].x, lassoPts[i].y);
      fxctx.stroke();

      fxctx.restore();
    }



    // Try to reuse your existing AA flag if you already have one.
    // If not, it falls back to common checkbox ids.
    function getBrushAntiAliasEnabled(){
      // If you already have a variable like `brushAntiAlias` / `antiAlias` / `brushAA`, prefer it here:
      if (typeof brushAntiAlias !== "undefined") return !!brushAntiAlias;
      if (typeof brushAA !== "undefined") return !!brushAA;
      if (typeof antiAlias !== "undefined") return !!antiAlias;

      // Fallback: checkbox in UI (rename ids to match yours if needed)
      const el =
        document.getElementById("aaToggle") ||
        document.getElementById("antiAlias") ||
        document.getElementById("brushAA");

      if (el && "checked" in el) return !!el.checked;
      return true; // default: AA on
    }

    // Reusable temp canvases for aliased fill
    let _lassoMaskC = null;
    let _lassoColorC = null;

    function ensureTmpCanvas(c, w, h){
      if (!c) c = document.createElement("canvas");
      if (c.width !== w) c.width = w;
      if (c.height !== h) c.height = h;
      const ctx = c.getContext("2d");
      ctx.setTransform(1,0,0,1,0,0);
      ctx.clearRect(0,0,w,h);
      return [c, ctx];
    }


    function applyLassoFill(){

      const hex = colorToHex(currentColor);
      pushUndo(activeLayer, currentFrame, hex);

      activeSubColor[activeLayer] = hex;
      ensureSublayer(activeLayer, hex);

      if (lassoPts.length < 3) return false;

      const off = getFrameCanvas(activeLayer, currentFrame, hex);

      const w = off.width, h = off.height;

      const aaOn = getBrushAntiAliasEnabled();

      // AA ON: normal path fill (smooth)
      if (aaOn) {
        const ctx = off.getContext("2d");
        ctx.save();
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = currentColor;
        ctx.beginPath();
        ctx.moveTo(lassoPts[0].x, lassoPts[0].y);
        for (let i = 1; i < lassoPts.length; i++) ctx.lineTo(lassoPts[i].x, lassoPts[i].y);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        markFrameHasContent(activeLayer, currentFrame, strokeHex || hex);

        renderAll();
        updateTimelineHasContent(currentFrame);
        return true;
      }

      // AA OFF: thresholded mask => hard aliased edges
      // 1) Draw shape into a white alpha mask
      let mctx, cctx;
      [_lassoMaskC, mctx] = ensureTmpCanvas(_lassoMaskC, w, h);
      [_lassoColorC, cctx] = ensureTmpCanvas(_lassoColorC, w, h);

      mctx.save();
      mctx.fillStyle = "#fff";
      mctx.beginPath();
      mctx.moveTo(lassoPts[0].x, lassoPts[0].y);
      for (let i = 1; i < lassoPts.length; i++) mctx.lineTo(lassoPts[i].x, lassoPts[i].y);
      mctx.closePath();
      mctx.fill();
      mctx.restore();

      // 2) Hard-threshold alpha (kills the anti-aliased fringe)
      const img = mctx.getImageData(0, 0, w, h);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const a = d[i + 3];
        // >= 128 becomes fully opaque, else fully transparent
        d[i + 3] = (a >= 128) ? 255 : 0;
        // RGB doesn't matter much, but keep it white
        d[i] = 255; d[i + 1] = 255; d[i + 2] = 255;
      }
      mctx.putImageData(img, 0, 0);

      // 3) Make a full color layer, then punch it with the mask (destination-in)
      cctx.save();
      cctx.fillStyle = currentColor;
      cctx.fillRect(0, 0, w, h);
      cctx.globalCompositeOperation = "destination-in";
      cctx.drawImage(_lassoMaskC, 0, 0);
      cctx.restore();

      // 4) Composite into the actual cel
      const ctx = off.getContext("2d");
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(_lassoColorC, 0, 0);
      ctx.restore();

      markFrameHasContent(activeLayer, currentFrame, strokeHex || hex);

      renderAll();
      updateTimelineHasContent(currentFrame);
      return true;
    }

    function applyLassoErase(){
      if (activeLayer === PAPER_LAYER) return false;
      if (lassoPts.length < 3) return false;

      const L = activeLayer;

      // Erase affects the ACTIVE swatch for this layer (Fill = white)
      const key = resolveKeyFor(L, activeSubColor?.[L] ?? currentColor);
      if (!key) return false;

      // If there's nothing to erase yet, bail quietly
      const layer = layers?.[L];
      if (!layer?.sublayers) return false;
      if (!layer.sublayers.has(key)) return false;

      const off = getFrameCanvas(L, currentFrame, key);
      if (!off) return false;

      // Undo snapshot BEFORE destructive op
      try { pushUndo(L, currentFrame, key); } catch {}

      const ctx = off.getContext("2d", { willReadFrequently: true });
      if (!ctx) return false;

      const w = off.width | 0, h = off.height | 0;
      const aaOn = getBrushAntiAliasEnabled();

      if (aaOn) {
        // Smooth lasso erase
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle = "rgba(0,0,0,1)";
        ctx.beginPath();
        ctx.moveTo(lassoPts[0].x, lassoPts[0].y);
        for (let i = 1; i < lassoPts.length; i++) ctx.lineTo(lassoPts[i].x, lassoPts[i].y);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        // Hard/aliased lasso erase (thresholded mask)
        let mctx;
        [_lassoMaskC, mctx] = ensureTmpCanvas(_lassoMaskC, w, h);

        mctx.save();
        mctx.fillStyle = "#fff";
        mctx.beginPath();
        mctx.moveTo(lassoPts[0].x, lassoPts[0].y);
        for (let i = 1; i < lassoPts.length; i++) mctx.lineTo(lassoPts[i].x, lassoPts[i].y);
        mctx.closePath();
        mctx.fill();
        mctx.restore();

        const img = mctx.getImageData(0, 0, w, h);
        const d = img.data;
        for (let i = 0; i < d.length; i += 4) {
          const a = d[i + 3];
          d[i + 3] = (a >= 128) ? 255 : 0;
          d[i] = 255; d[i + 1] = 255; d[i + 2] = 255;
        }
        mctx.putImageData(img, 0, 0);

        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        ctx.drawImage(_lassoMaskC, 0, 0);
        ctx.restore();
      }

      // Update flags + UI
      recomputeHasContent(L, currentFrame, key);
      renderAll();
      updateTimelineHasContent(currentFrame);

      // If this swatch becomes fully unused, remove it
      pruneUnusedSublayers(L);

      return true;
    }


    function cancelLasso(){
      lassoActive = false;
      lassoPts = [];
      clearFx();
    }

    // -------------------------
    // Pan
    // -------------------------
    function startPan(e) {
      isPanning = true;
      const pos = getCanvasPointer(e);
      panStart = { x: pos.x * dpr, y: pos.y * dpr, ox: offsetX, oy: offsetY };
    }

    function continuePan(e) {
      if (!isPanning) return;
      const pos = getCanvasPointer(e);
      const dx = pos.x * dpr - panStart.x;
      const dy = pos.y * dpr - panStart.y;
      offsetX = panStart.ox + dx;
      offsetY = panStart.oy + dy;
      renderAll();
      updateHUD();
      updatePlayheadMarker();
      updateClipMarkers();
      clearFx();
    }

    function endPan() {
      isPanning = false;
    }

    // -------------------------
    // Brush logic
    // -------------------------


    function startStroke(e) {
      const pos = getCanvasPointer(e);
      

      const { x, y } = screenToContent(pos.x, pos.y);
      if (x < 0 || y < 0 || x > contentW || y > contentH) return;

      // Right click pans
      if (e.button === 2) {
        startPan(e);
        return;
      }

      // Lasso Fill tool
      if (tool === "lasso-fill") {
      
        lassoActive = true;
        isDrawing = true;

        lassoPts = [];
        addLassoPoint({ x, y });
        drawLassoPreview();
        return;
      }

      // GLOBAL_STEP_BEGIN (unique anchor)
      try {
        const k =
          (tool === "eraser")
            ? resolveKeyFor(activeLayer, activeSubColor?.[activeLayer] ?? currentColor)
            : resolveKeyFor(activeLayer, currentColor);
        beginGlobalHistoryStep(activeLayer, currentFrame, k);
      } catch {}


      // Lasso Erase tool
      if (tool === "lasso-erase") {
        // PAPER layer is non-drawable
        if (activeLayer === PAPER_LAYER) return;

        lassoActive = true;
        isDrawing = true;

        lassoPts = [];
        addLassoPoint({ x, y });
        drawLassoPreview("erase");
        return;
      }


   
      // Fill tools: create trail + fx
      if (tool === "fill-eraser" || tool === "fill-brush") {
        if (activeLayer === PAPER_LAYER) return;

        // ✅ fill-eraser must NOT create new swatches/canvases on click
        if (tool === "fill-eraser" && activeLayer !== LAYER.FILL) {
          // If no active swatch, pick an EXISTING one (don’t create)
          if (Array.isArray(activeSubColor) && !activeSubColor[activeLayer]) {
            const lay = layers?.[activeLayer];
            const fallback =
              lay?.suborder?.slice().reverse().find(k => lay?.sublayers?.has?.(k)) ||
              lay?.suborder?.[0] ||
              null;
            if (fallback) activeSubColor[activeLayer] = fallback;
          }
        }

        let key = fillKeyForTool(activeLayer, tool);

        if (tool === "fill-brush" && key) key = swatchColorKey(key);


        // ✅ If we're on FILL + fill-brush, actually create/select that swatch
        if (tool === "fill-brush" && activeLayer === LAYER.FILL) {
          activeSubColor[LAYER.FILL] = key;
          ensureSublayer(LAYER.FILL, key);     // create the swatch if missing
          try { renderLayerSwatches(LAYER.FILL); } catch {}
        }
        // ✅ fill-brush needs a key (it creates/targets a swatch)
        if (tool === "fill-brush" && !key) return;

        // ✅ fill-eraser can proceed without a key (we'll pick what to erase on release)
        if (tool === "fill-eraser") key = key || null;

        // ✅ Fill-brush: OK to create swatch (by design)
        if (tool === "fill-brush") ensureActiveSwatchForColorLayer(activeLayer, key);

        // ❌ DO NOT pushUndo here for fill-eraser (it creates empty swatches)
        if (tool === "fill-brush") pushUndo(activeLayer, currentFrame, key);

        isDrawing = true;
        if (tool === "fill-eraser") _fillEraseAllLayers = !!e.shiftKey;
        lastPt = { x, y };
        trailPoints = [{ x, y }];

        fxTransform();
        fxStamp1px(x, y, x + 0.01, y + 0.01);
        return;
      }

      // Hand tool
      if (tool === "hand") {
        startPan(e);
        return;
      }

      // PAPER layer is non-drawable
      if (activeLayer === PAPER_LAYER) {
        return;
      }

      // Normal draw/erase
      isDrawing = true;

      // Decide the target sublayer key BEFORE pushUndo
      const hex =
        (tool === "eraser")
          ? (activeSubColor?.[activeLayer] || colorToHex(currentColor))
          : colorToHex(currentColor);

      strokeHex = (activeLayer === LAYER.FILL) ? fillWhite : hex;

      activeSubColor[activeLayer] = strokeHex;
      ensureSublayer(activeLayer, strokeHex);
      renderLayerSwatches(activeLayer);

      // ✅ Now push undo for the correct sublayer canvas
   
      beginGlobalHistoryStep(activeLayer, currentFrame, strokeHex);
      pushUndo(activeLayer, currentFrame, strokeHex);

      lastPt = { x, y };
      const off = getFrameCanvas(activeLayer, currentFrame, strokeHex);
      const ctx = off.getContext("2d");

      const p = pressure(e);
      markGlobalHistoryDirty();
      markGlobalHistoryDirty();

      if (tool === "brush") {
        if (activeLayer === LAYER.LINE) {
          const size = usePressureSize ? brushSize * p : brushSize;
          const alpha = usePressureOpacity ? p : 1;
          stampSquareLine(ctx, x, y, x + 0.01, y + 0.01, size, currentColor, alpha);
        } else {
          if (antiAlias) {
            ctx.save();
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.globalCompositeOperation = "source-over";
            ctx.strokeStyle = currentColor;
            ctx.globalAlpha = usePressureOpacity ? p : 1;
            ctx.lineWidth = Math.max(0.5, usePressureSize ? brushSize * p : brushSize);
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + 0.01, y + 0.01);
            ctx.stroke();
            ctx.restore();
          } else {
            const size = usePressureSize ? brushSize * p : brushSize;
            const alpha = usePressureOpacity ? p : 1;
            stampSquareLine(ctx, x, y, x + 0.01, y + 0.01, size, currentColor, alpha);
          }
        }
      } else if (tool === "eraser") {
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineWidth = eraserSize;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 0.01, y + 0.01);
        ctx.stroke();
        ctx.restore();
      }

      markFrameHasContent(activeLayer, currentFrame, strokeHex || hex);
      renderAll();
      updateTimelineHasContent(currentFrame);
      
    }

    function continueStroke(e) {
      if (!isDrawing) return;

      const pos = getCanvasPointer(e);
      const { x, y } = screenToContent(pos.x, pos.y);

      if (!lastPt) lastPt = { x, y };

      // Fill tools: stamp FX, collect seeds
      if (tool === "fill-eraser" || tool === "fill-brush") {
        fxTransform();
        fxStamp1px(lastPt.x, lastPt.y, x, y);
        if (!trailPoints.length || Math.hypot(x - lastPt.x, y - lastPt.y) > 4) trailPoints.push({ x, y });
        lastPt = { x, y };
        return;
      }


      // Lasso Fill / Erase: keep collecting points + draw preview
      if ((tool === "lasso-fill" || tool === "lasso-erase") && lassoActive) {
        addLassoPoint({ x, y });
        drawLassoPreview(tool === "lasso-erase" ? "erase" : "fill");
        lastPt = { x, y };
        return;
      }


      // ACTIVE_LAYER_SWATCH_GREEN (unique anchor)
      function syncActiveLayerSwatchGreen(){
        // clear previous
        document.querySelectorAll(".layerSwatchBtn.activeOnActiveLayer")
          .forEach(b => b.classList.remove("activeOnActiveLayer"));

        const L = activeLayer;
        const key = activeSubColor?.[L];
        if (L == null || !key) return;

        // find the swatch button that matches (activeLayer + its activeSubColor)
        const btns = document.querySelectorAll(".layerSwatchBtn");
        for (const b of btns){
          const bl = Number(b.dataset.layerId);
          const bk = String(b.dataset.key || "");
          if (bl === L && bk === key){
            b.classList.add("activeOnActiveLayer");
            break;
          }
        }
      }

    
      // Normal brush/eraser
      const hex = strokeHex || (activeSubColor?.[activeLayer] ?? colorToHex(currentColor));
      const off = getFrameCanvas(activeLayer, currentFrame, hex);
      const ctx = off.getContext("2d");
      const p = pressure(e);
      markGlobalHistoryDirty();


      if (tool === "brush") {
        if (activeLayer === LAYER.LINE) {
          const size = usePressureSize ? brushSize * p : brushSize;
          const alpha = usePressureOpacity ? p : 1;
          stampSquareLine(ctx, lastPt.x, lastPt.y, x, y, size, currentColor, alpha);
        } else {
          if (antiAlias) {
            ctx.save();
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.globalCompositeOperation = "source-over";
            ctx.strokeStyle = currentColor;
            ctx.globalAlpha = usePressureOpacity ? p : 1;
            ctx.lineWidth = Math.max(0.5, usePressureSize ? brushSize * p : brushSize);
            ctx.beginPath();
            ctx.moveTo(lastPt.x, lastPt.y);
            ctx.lineTo(x, y);
            ctx.stroke();
            ctx.restore();
          } else {
            const size = usePressureSize ? brushSize * p : brushSize;
            const alpha = usePressureOpacity ? p : 1;
            stampSquareLine(ctx, lastPt.x, lastPt.y, x, y, size, currentColor, alpha);
          }
        }
      } else if (tool === "eraser") {
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineWidth = eraserSize;
        ctx.beginPath();
        ctx.moveTo(lastPt.x, lastPt.y);
        ctx.lineTo(x, y);
        
        ctx.stroke();
        ctx.restore();
      }

      lastPt = { x, y };
      markFrameHasContent(activeLayer, currentFrame, strokeHex || hex);


      renderAll();
      updateTimelineHasContent(currentFrame);
    }


    // MOBILE_FILL_LASSO_ENDSTROKE (unique anchor)
    function endStrokeMobileSafe(e){
      // If a 2-finger gesture is active, do not commit anything
      if (typeof _touchGestureActive !== "undefined" && _touchGestureActive) {
        try { cancelLasso?.(); } catch {}
        try { clearFx?.(); } catch {}
        try { isDrawing = false; } catch {}
        try { lastPt = null; } catch {}
        try { trailPoints = []; } catch {}
        try { _fillEraseAllLayers = false; } catch {}
        return;
      }

      const F = (typeof currentFrame === "number") ? currentFrame : 0;

      // Finish pan if it was active
      try { if (typeof isPanning !== "undefined" && isPanning) endPan(); } catch {}

      // ---- LASSO COMMIT ----
      if ((tool === "lasso-fill" || tool === "lasso-erase") && (typeof lassoActive !== "undefined") && lassoActive) {
        try {
          if (tool === "lasso-fill") applyLassoFill();
          else applyLassoErase();
        } catch (err) {
          console.warn("[celstomp] lasso commit failed", err);
        }

        try { cancelLasso(); } catch {}
        try { isDrawing = false; } catch {}
        try { lastPt = null; } catch {}
        return;
      }

      // ---- FILL / FILL-ERASER COMMIT ----
      if (tool === "fill-brush" || tool === "fill-eraser") {
        const seeds =
          (Array.isArray(trailPoints) && trailPoints.length) ? trailPoints :
          (lastPt ? [lastPt] : []);

        if (seeds.length) {
          try {
            if (tool === "fill-brush") {
              // commit fill on the activeLayer
              applyFillRegionsFromSeeds(F, seeds, activeLayer);
            } else {
              // commit erase; SHIFT-start on desktop can erase all layers, keep your flag
              const L = (_fillEraseAllLayers ? -1 : activeLayer);
              eraseFillRegionsFromSeeds(L, F, seeds, seeds);
            }
          } catch (err) {
            console.warn("[celstomp] fill commit failed", err);
          }
        }

        try { clearFx(); } catch {}
        trailPoints = [];
        lastPt = null;
        _fillEraseAllLayers = false;
        isDrawing = false;

        // close any global history step if you have it
        try { endGlobalHistoryStep?.(); } catch {}
        return;
      }

      // ---- NORMAL BRUSH/ERASER END ----
      try { isDrawing = false; } catch {}
      try { lastPt = null; } catch {}
      try { trailPoints = []; } catch {}
      try { _fillEraseAllLayers = false; } catch {}
      try { clearFx?.(); } catch {}

      try { endGlobalHistoryStep?.(); } catch {}
    }

    function recomputeHasContent(L, F, key){
      try {
        const k = resolveKeyFor(L, key);
        if (!k) return false;

        const c = getFrameCanvas(L, F, k);
        const ctx = c.getContext("2d", { willReadFrequently: true });
        const data = ctx.getImageData(0, 0, contentW, contentH).data;

        let any = false;
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] > 0) { any = true; break; }
        }
        c._hasContent = any;
        return any;
      } catch {
        return true; // if we can't read, don't accidentally hide
      }
    }



    // -------------------------
    // Swatch right-click: recolor across all cels in that swatch
    // -------------------------
    let _swatchCtxMenu = null;
    let _swatchCtxState = null;
    let _swatchColorPicker = null;

    function isHexColor(s){
      return typeof s === "string" && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s.trim());
    }
    function normHex6(hex){
      hex = String(hex || "").trim();
      if (!isHexColor(hex)) return null;
      if (hex.length === 4){
        // #rgb -> #rrggbb
        const r = hex[1], g = hex[2], b = hex[3];
        hex = `#${r}${r}${g}${g}${b}${b}`;
      }
      return hex.toUpperCase();
    }
    function swatchHexToRgb(hex){

      hex = normHex6(hex);
      if (!hex) return null;
      const n = parseInt(hex.slice(1), 16);
      return { r:(n>>16)&255, g:(n>>8)&255, b:n&255 };
    }
    function extractCanvas(v){
      if (!v) return null;
      if (v instanceof HTMLCanvasElement) return v;
      if (v.canvas instanceof HTMLCanvasElement) return v.canvas;      // {canvas}
      if (v.ctx && v.ctx.canvas instanceof HTMLCanvasElement) return v.ctx.canvas; // {ctx}
      return null;
    }
    function iterContainerValues(container, fn){
      if (!container) return;
      if (container instanceof Map){
        for (const v of container.values()) fn(v);
        return;
      }
      if (Array.isArray(container)){
        for (const v of container) fn(v);
        return;
      }
      if (typeof container === "object"){
        for (const k of Object.keys(container)) fn(container[k]);
      }
    }

    function getSwatchCollection(L){
      return L?.swatches || L?.sublayers || L?.subLayers || L?.colors || L?.colorSwatches || null;
    }
    function getSwatchObj(L, key){
      const col = getSwatchCollection(L);
      if (!col) return null;
      if (col instanceof Map) return col.get(key) ?? null;
      if (typeof col === "object") return col[key] ?? null;
      return null;
    }
    function setSwatchObjKeyIfNeeded(layer, oldKey, newKey){
      const col = getSwatchCollection(layer);
      if (!col) return oldKey;

      const isColorKeyMode = isHexColor(oldKey) && (
        (col instanceof Map && col.has(oldKey)) ||
        (!(col instanceof Map) && typeof col === "object" && Object.prototype.hasOwnProperty.call(col, oldKey))
      );
      if (!isColorKeyMode) return oldKey;

      // prevent collision
      if (col instanceof Map) {
        if (col.has(newKey)) { alert("That swatch color already exists. Pick a different color."); return oldKey; }
      } else {
        if (Object.prototype.hasOwnProperty.call(col, newKey)) { alert("That swatch color already exists. Pick a different color."); return oldKey; }
      }

      // move swatch in collection
      let sw = null;
      if (col instanceof Map){
        sw = col.get(oldKey);
        col.delete(oldKey);
        col.set(newKey, sw);
      } else {
        sw = col[oldKey];
        delete col[oldKey];
        col[newKey] = sw;
      }

      // ✅ update layer.suborder
      if (Array.isArray(layer.suborder)) {
        for (let i = 0; i < layer.suborder.length; i++){
          if (layer.suborder[i] === oldKey) layer.suborder[i] = newKey;
        }
      }

      // ✅ update nesting pointers everywhere
      const vals = (col instanceof Map) ? Array.from(col.values()) : Object.values(col);
      for (const s of vals){
        if (!s) continue;
        if (s.parentKey === oldKey) s.parentKey = newKey;
        if (Array.isArray(s.children)) {
          for (let i = 0; i < s.children.length; i++){
            if (s.children[i] === oldKey) s.children[i] = newKey;
          }
        }
      }

      return newKey;
    }

    function setSwatchHex(L, key, newHex){
      const sw = getSwatchObj(L, key);
      if (!sw) return;

      // update common fields
      if ("hex" in sw) sw.hex = newHex;
      if ("color" in sw) sw.color = newHex;
      if ("col" in sw) sw.col = newHex;

      // sometimes the swatch key itself is the color string:
      // we re-key collection safely (only if it really looks like color-key mode)
      return setSwatchObjKeyIfNeeded(L, key, newHex);
    }

    function collectCanvasesForLayerSwatch(L, key){
      const out = [];
      const seen = new Set();

      function pushCanvas(c){
        if (!c) return;
        if (seen.has(c)) return;
        seen.add(c);
        out.push(c);
      }

      // 1) from swatch object itself
      const sw = getSwatchObj(L, key);
      if (sw){
        pushCanvas(extractCanvas(sw));
        iterContainerValues(sw.cels, (v) => pushCanvas(extractCanvas(v) || extractCanvas(v?.canvas) || extractCanvas(v?.ctx)));
        iterContainerValues(sw.frames, (v) => pushCanvas(extractCanvas(v) || extractCanvas(v?.canvas) || extractCanvas(v?.ctx)));
        iterContainerValues(sw.cells, (v) => pushCanvas(extractCanvas(v) || extractCanvas(v?.canvas) || extractCanvas(v?.ctx)));

        // sometimes cel entries are objects like { canvas, ... }
        iterContainerValues(sw.cels, (v) => pushCanvas(extractCanvas(v?.canvas)));
        iterContainerValues(sw.frames, (v) => pushCanvas(extractCanvas(v?.canvas)));
        iterContainerValues(sw.cells, (v) => pushCanvas(extractCanvas(v?.canvas)));
      }

      // 2) fallback: scan likely layer containers for per-frame swatch storage
      const layerContainers = [L?.cels, L?.frames, L?.cells, L?.celByFrame, L?.frameMap];
      for (const cont of layerContainers){
        iterContainerValues(cont, (celEntry) => {
          if (!celEntry) return;

          // patterns: celEntry.swatches[key], celEntry.sublayers[key], celEntry[key]
          const a = celEntry.swatches || celEntry.sublayers || celEntry.subLayers || celEntry.colors || null;
          if (a){
            if (a instanceof Map){
              pushCanvas(extractCanvas(a.get(key)));
            } else if (typeof a === "object"){
              pushCanvas(extractCanvas(a[key]));
            }
          }
          // direct key
          if (typeof celEntry === "object" && key in celEntry){
            pushCanvas(extractCanvas(celEntry[key]));
          }
          // direct canvas
          pushCanvas(extractCanvas(celEntry));
          pushCanvas(extractCanvas(celEntry?.canvas));
          pushCanvas(extractCanvas(celEntry?.ctx));
        });
      }

      return out;
    }

    function recolorCanvasAllNonTransparent(canvas, rgb){
      const w = canvas.width | 0, h = canvas.height | 0;
      if (!w || !h) return;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      const img = ctx.getImageData(0, 0, w, h);
      const d = img.data;

      // recolor any pixel with alpha > 0
      for (let i = 0; i < d.length; i += 4){
        const a = d[i + 3];
        if (a === 0) continue;
        d[i]     = rgb.r;
        d[i + 1] = rgb.g;
        d[i + 2] = rgb.b;
      }

      ctx.putImageData(img, 0, 0);
    }

    async function applySwatchRecolor(layerId, key, newHex){
      const L = layers?.[layerId];
      if (!L) return;

      newHex = normHex6(newHex);
      if (!newHex) return;

      const rgb = swatchHexToRgb(newHex);
      if (!rgb) return;

      // collect canvases for this swatch across all cels
      const canvases = collectCanvasesForLayerSwatch(L, key);
    
      // recolor (yield occasionally to keep UI responsive)
      for (let i = 0; i < canvases.length; i++){
        recolorCanvasAllNonTransparent(canvases[i], rgb);
        if ((i % 2) === 1) await sleep(0);
      }

      // update stored swatch color + (optionally) swatch key
      const newKey = setSwatchHex(L, key, newHex) || key;


      try {
        if (activeSubColor?.[layerId] === key) activeSubColor[layerId] = newKey;
        if (currentColor === key) currentColor = newKey;
      } catch {}

      // update current selection references (best-effort, won’t crash if fields don’t exist)
      try {
        if (L?.activeSwatchKey === key) L.activeSwatchKey = newKey;
        if (L?.selectedSwatchKey === key) L.selectedSwatchKey = newKey;
        if (typeof state === "object" && state){
          if (state.activeSwatchKey === key) state.activeSwatchKey = newKey;
          if (state.activeColorKey === key) state.activeColorKey = newKey;
          if (state.activeSwatchKeyByLayer && L?.id && state.activeSwatchKeyByLayer[L.id] === key) state.activeSwatchKeyByLayer[L.id] = newKey;
        }
      } catch {}

      // update the clicked button instantly if we have it
      if (_swatchCtxState?.btn){
        _swatchCtxState.btn.style.background = newHex;
        _swatchCtxState.btn.style.borderColor = newHex;
        _swatchCtxState.btn.dataset.swatchKey = newKey;
        _swatchCtxState.btn.dataset.hex = newHex;
      }

      // request a redraw (best-effort)
      
      try { requestRender?.(); } catch {}
      try { requestRedraw?.(); } catch {}
      try { redraw?.(); } catch {}
      try { render?.(); } catch {}

      // ✅ ensure UI + render reflect the new swatch key/color immediately
      try { renderLayerSwatches(layerId); } catch {}
      try { renderAll(); } catch {}

    }
    // -------------------------
    // Live preview recolor queue (fast scrubbing support)
    // - Recolors pixels ONLY (no key/metadata changes)
    // - Cancels in-flight work when a newer color arrives
    // -------------------------
    const _swatchPreviewJobs = new Map();

    function _swPrevKey(layerId, key){ return `${layerId}::${key}`; }

    function cancelSwatchPreview(layerId, key){
      const job = _swatchPreviewJobs.get(_swPrevKey(layerId, key));
      if (!job) return;
      job.token++;
      job.pendingHex = null;
    }

    function queueSwatchRecolorPreview(layerId, key, hex){
      const k = _swPrevKey(layerId, key);
      let job = _swatchPreviewJobs.get(k);
      if (!job){
        job = { running:false, pendingHex:null, token:0, canvases:null };
        _swatchPreviewJobs.set(k, job);
      }

      job.pendingHex = normHex6(hex);
      job.token++;

      if (job.running) return;

      job.running = true;
      (async () => {
        while (job.pendingHex){
          const nextHex = job.pendingHex;
          job.pendingHex = null;
          const myToken = job.token;

          await (async function applyPreviewOnce(){
            const L = layers?.[layerId];
            if (!L) return;

            const newHex = normHex6(nextHex);
            if (!newHex) return;

            const rgb = swatchHexToRgb(newHex);
            if (!rgb) return;

            // cache canvases for this swatch while dialog is open
            const canvases = job.canvases || (job.canvases = collectCanvasesForLayerSwatch(L, key));

            for (let i = 0; i < canvases.length; i++){
              // cancel if a newer color arrived
              if (job.token !== myToken) return;

              recolorCanvasAllNonTransparent(canvases[i], rgb);
              if ((i % 2) === 1) await sleep(0);
            }

            // update the clicked button instantly if we have it
            if (_swatchCtxState?.btn){
              _swatchCtxState.btn.style.background = newHex;
              _swatchCtxState.btn.style.borderColor = newHex;
              _swatchCtxState.btn.dataset.hex = newHex;
            }

            // redraw (best-effort)
            try { requestRender?.(); } catch {}
            try { requestRedraw?.(); } catch {}
            try { redraw?.(); } catch {}
            try { render?.(); } catch {}
            try { renderAll?.(); } catch {}
          })();
        }

        job.running = false;
        // keep canvases cached for next open; you can clear if you want:
        // job.canvases = null;
      })();
    }

    
    // -------------------------
    // Swatch rightclick
    // -------------------------
    function pickColorOnce(startHex, onPick){
      const inp = document.createElement("input");
      inp.type = "color";

      const safe = (typeof startHex === "string" && /^#[0-9a-fA-F]{6}$/.test(startHex))
        ? startHex
        : "#000000";

      // set initial value
      inp.value = safe;

      // keep it invisible but "clickable" via programmatic click
      inp.style.position = "fixed";
      inp.style.left = "-9999px";
      inp.style.top = "0";
      inp.style.opacity = "0";
      inp.style.pointerEvents = "none";

      document.body.appendChild(inp);

      let fired = false;

      const cleanup = () => {
        if (inp && inp.parentNode) inp.parentNode.removeChild(inp);
      };

      const fire = () => {
        if (fired) return;
        fired = true;
        const hex = String(inp.value || "").toLowerCase();
        cleanup();
        if (/^#[0-9a-f]{6}$/.test(hex)) onPick(hex);
      };

      // Some browsers fire input, some fire change more reliably
      inp.addEventListener("input", fire, { once: true });
      inp.addEventListener("change", fire, { once: true });

      // If user cancels (no change), neither may fire; just clean up.
      inp.addEventListener("blur", () => setTimeout(cleanup, 0), { once: true });

      // IMPORTANT: must be called synchronously inside the click handler
      inp.click();
    }

    function pickColorLiveOnce(startHex, { onLive, onCommit, onCancel } = {}){
      const inp = document.createElement("input");
      inp.type = "color";

      const safe = (typeof startHex === "string" && /^#[0-9a-fA-F]{6}$/.test(startHex))
        ? startHex
        : "#000000";

      inp.value = safe;

      inp.style.position = "fixed";
      inp.style.left = "-9999px";
      inp.style.top = "0";
      inp.style.opacity = "0";
      inp.style.pointerEvents = "none";

      document.body.appendChild(inp);

      let committed = false;
      const start = inp.value;

      const safeLive = (hex) => { try { onLive?.(hex); } catch {} };
      const safeCommit = (hex) => { try { (onCommit || onLive)?.(hex); } catch {} };
      const safeCancel = () => { try { onCancel?.(); } catch {} };

      const cleanup = () => {
        inp.removeEventListener("input", onInput);
        inp.removeEventListener("change", onChange);
        window.removeEventListener("focus", onWinFocus, true);
        if (inp && inp.parentNode) inp.parentNode.removeChild(inp);
      };

      const onInput = (e) => {
        const hex = e?.target?.value;
        if (hex) safeLive(hex);
      };

      const onChange = (e) => {
        committed = true;
        const hex = e?.target?.value || inp.value || start;
        safeCommit(hex);
        cleanup();
      };

      const onWinFocus = () => {
        // native dialog closed (best-effort)
        setTimeout(() => {
          if (committed) return;
          const v = inp.value || start;

          // treat “no change” as cancel
          if (v === start) safeCancel();
          else safeCommit(v);

          cleanup();
        }, 0);
      };

      inp.addEventListener("input", onInput);
      inp.addEventListener("change", onChange);
      window.addEventListener("focus", onWinFocus, true);

      try { inp.showPicker?.(); } catch {}
      inp.click();
    }


    function armColorPickerLive(picker, { onLive, onCommit, onCancel } = {}){
      if (!picker) return;

      // cleanup previous live arm if any
      if (picker._liveArmCleanup){
        try { picker._liveArmCleanup(); } catch {}
        picker._liveArmCleanup = null;
      }

      const startHex = picker.value;
      let committed = false;
      let lastPolled = picker.value;

      const safeLive = (hex) => { try { onLive?.(hex); } catch {} };
      const safeCommit = (hex) => { try { (onCommit || onLive)?.(hex); } catch {} };
      const safeCancel = () => { try { onCancel?.(); } catch {} };

      const onInput = (e) => {
        const hex = e?.target?.value;
        if (hex) safeLive(hex);
      };

      const onChange = (e) => {
        committed = true;
        const hex = e?.target?.value || picker.value || startHex;
        safeCommit(hex);
        cleanup();
      };

      const poll = setInterval(() => {
        const v = picker.value;
        if (v && v !== lastPolled){
          lastPolled = v;
          safeLive(v);
        }
      }, 33);

      const onWinFocus = () => {
        // focus returns when native dialog closes (best-effort)
        setTimeout(() => {
          if (committed) return;
          const v = picker.value || startHex;

          // treat “no change” as cancel
          if (v === startHex) safeCancel();
          else safeCommit(v);

          cleanup();
        }, 0);
      };

      function cleanup(){
        clearInterval(poll);
        picker.removeEventListener("input", onInput);
        picker.removeEventListener("change", onChange);
        window.removeEventListener("focus", onWinFocus, true);
        picker._liveArmCleanup = null;
      }

      picker.addEventListener("input", onInput);
      picker.addEventListener("change", onChange);
      window.addEventListener("focus", onWinFocus, true);

      picker._liveArmCleanup = cleanup;
    }

    function ensureSwatchCtxMenu(){
      if (_swatchCtxMenu) return _swatchCtxMenu;

      const m = document.createElement("div");
      m.id = "swatchCtxMenu";
      m.hidden = true;

      m.innerHTML = `
        <button type="button" data-act="change">Change color…</button>
      `;

      m.addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-act]");
        if (!btn) return;
        const act = btn.dataset.act;

        const st = _swatchCtxState;
        closeSwatchContextMenu();

        if (!st) return;


        if (act === "change"){
          // pick current swatch hex
          let curHex = null;
          const sw = getSwatchObj(st.layerObj, st.key);
          curHex = normHex6(
            sw?.hex || sw?.color || sw?.col || (isHexColor(st.key) ? st.key : null)
          ) || "#FFFFFF";

          const startHex = curHex;

          pickColorLiveOnce(startHex, {
            onLive: (hex) => {
              // pixels only (fast) while scrubbing
              queueSwatchRecolorPreview(st.layerId, st.key, hex);
            },
            onCommit: (hex) => {
              // stop any pending preview work, then do the real commit (updates key + UI)
              cancelSwatchPreview(st.layerId, st.key);
              applySwatchRecolor(st.layerId, st.key, hex);
            },
            onCancel: () => {
              // revert preview back to original
              cancelSwatchPreview(st.layerId, st.key);
              queueSwatchRecolorPreview(st.layerId, st.key, startHex);
            }
          });

        }

        

      });

      // close on outside click / escape
      document.addEventListener("mousedown", (e) => {
        if (!_swatchCtxMenu || _swatchCtxMenu.hidden) return;
        if (e.target === _swatchCtxMenu || _swatchCtxMenu.contains(e.target)) return;
        closeSwatchContextMenu();
      }, true);

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeSwatchContextMenu();
      });

      window.addEventListener("blur", closeSwatchContextMenu);

      document.body.appendChild(m);
      _swatchCtxMenu = m;
      return m;
    }

    function openSwatchContextMenu(L, key, ev){
      try { ev.preventDefault(); } catch {}
      try { ev.stopPropagation(); } catch {}

      const layerId = Number(L);
      const layerObj = Number.isFinite(layerId) ? layers?.[layerId] : L;

      const m = ensureSwatchCtxMenu();
      _swatchCtxState = { layerId, layerObj, key, btn: ev.currentTarget || null };

      // ...rest unchanged...


      // position near cursor, clamp to viewport
      m.hidden = false;
      m.style.left = "0px";
      m.style.top = "0px";

      const pad = 6;
      const vw = window.innerWidth, vh = window.innerHeight;

      // measure
      const r = m.getBoundingClientRect();
      let x = ev.clientX + 6;
      let y = ev.clientY + 6;

      if (x + r.width + pad > vw) x = Math.max(pad, vw - r.width - pad);
      if (y + r.height + pad > vh) y = Math.max(pad, vh - r.height - pad);

      m.style.left = `${x}px`;
      m.style.top = `${y}px`;
    }

    function closeSwatchContextMenu(){
      if (_swatchCtxMenu) _swatchCtxMenu.hidden = true;
      _swatchCtxState = null;
    }

    // -------------------------
    // Swatch cleanup helpers
    // - Delete current swatch color on current frame
    // - Auto-remove swatches that have no pixels anywhere
    // -------------------------

    function _canvasHasAnyAlpha(c){
      try {
        const ctx = c.getContext("2d", { willReadFrequently: true });
        const data = ctx.getImageData(0, 0, contentW, contentH).data;
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] > 0) return true;
        }
      } catch {}
      return false;
    }

    function _sublayerHasAnyContentAccurate(sub){
      if (!sub || !Array.isArray(sub.frames)) return false;

      for (let f = 0; f < sub.frames.length; f++) {
        const c = sub.frames[f];
        if (!c) continue;

        // If flagged as having content, verify (fix stale _hasContent=true cases)
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

    /**
     * Remove sublayer colors that have no pixels in ANY frame.
     * Returns true if anything was removed.
     */
    function pruneUnusedSublayers(L){
      if (L === PAPER_LAYER) return false;

      const layer = layers[L];
      if (!layer) return false;

      if (!layer.sublayers) layer.sublayers = new Map();
      if (!Array.isArray(layer.suborder)) layer.suborder = [];

      let removedAny = false;

      for (let i = layer.suborder.length - 1; i >= 0; i--) {
        const key = layer.suborder[i];
        const sub = layer.sublayers.get(key);

        const keep = _sublayerHasAnyContentAccurate(sub);
        if (!keep) {
          // remove sublayer
          layer.sublayers.delete(key);
          layer.suborder.splice(i, 1);
          removedAny = true;

          // optional: purge undo history for this key (keeps memory clean)
          try {
            for (const hk of historyMap.keys()) {
              // historyKey format: "L:F:KEY"
              if (hk.startsWith(`${L}:`) && hk.endsWith(`:${key}`)) historyMap.delete(hk);
            }
          } catch {}
        }
      }

      if (!removedAny) return false;

      // If active swatch got removed, pick a fallback
      const curKey = activeSubColor?.[L];
      if (curKey && !layer.sublayers.has(curKey)) {
        activeSubColor[L] = layer.suborder[layer.suborder.length - 1] || (L === LAYER.FILL ? fillWhite : "#000000");
      }

      // If we're on this layer, keep currentColor in sync with new activeSubColor
      if (L === activeLayer) {
        const k = activeSubColor?.[L];
        if (k && layer.sublayers.has(k)) {
          currentColor = k;
          try { setPickerToColorString?.(k); } catch {}
          try { setColorSwatch?.(); } catch {}
          try { setHSVPreviewBox?.(); } catch {}
        }
      }

      // Re-render swatches for this layer
      try { normalizeLayerSwatchKeys(layer); } catch {}
      try { renderLayerSwatches(L); } catch {}

      return true;
    }

    /**
     * Delete ONLY the active swatch color on the current frame.
     * (layer = activeLayer, color = activeSubColor[activeLayer])
     */
    function deleteActiveColorAtCurrentFrame(){
      if (activeLayer === PAPER_LAYER) return false;

      const L = activeLayer;
      const layer = layers[L];
      if (!layer?.sublayers || !Array.isArray(layer.suborder)) return false;

      const key = resolveKeyFor(L, activeSubColor?.[L] ?? currentColor);
      if (!key) return false;

      const sub = layer.sublayers.get(key);
      const c = sub?.frames?.[currentFrame];
      if (!c) return false;

      // record undo for THIS color only
      try { pushUndo(L, currentFrame, key); } catch {}

      // clear pixels
      try {
        const ctx = c.getContext("2d", { willReadFrequently: true });
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, contentW, contentH);
      } catch {}

      // free the frame canvas entirely (keeps memory smaller + makes "no content" obvious)
      sub.frames[currentFrame] = null;

      renderAll();
      updateTimelineHasContent(currentFrame);

      // if this color is now unused in ALL frames, drop the swatch
      pruneUnusedSublayers(L);

      return true;
    }

    function endStroke() {
      if (!isDrawing) return;
      isDrawing = false;
      commitGlobalHistoryStep();
      const endKey = strokeHex;

      strokeHex = null;

      // safety: ensure the last segment is visible even if the last move was missed
      renderAll();
      updateTimelineHasContent(currentFrame);


      // Lasso Erase: commit on release
      if (tool === "lasso-erase" && lassoActive) {
        lassoActive = false;
        applyLassoErase();
        cancelLasso(); // clears fx + points
        lastPt = null;
        return;
      }

      // GLOBAL_STEP_COMMIT (unique anchor)
      try { commitGlobalHistoryStep(); } catch {}


      // Lasso Fill: commit on release
      if (tool === "lasso-fill" && lassoActive) {
        lassoActive = false;
        applyLassoFill();
        cancelLasso(); // clears fx + points
        
        lastPt = null;
        return;
      }

      if (tool === "eraser" && activeLayer !== PAPER_LAYER) {
        recomputeHasContent(activeLayer, currentFrame, endKey || activeSubColor?.[activeLayer] || currentColor);
        if (tool === "eraser" && activeLayer !== PAPER_LAYER) {
          recomputeHasContent(activeLayer, currentFrame, endKey || activeSubColor?.[activeLayer] || currentColor);
          updateTimelineHasContent(currentFrame);

          // ✅ NEW: if that color is now empty across all frames, remove swatch
          pruneUnusedSublayers(activeLayer);
        }

      
        updateTimelineHasContent(currentFrame);
      }


      // Fill brush: apply region fill on release
      if (tool === "fill-brush") {
        const seeds = trailPoints.length ? trailPoints : lastPt ? [lastPt] : [];
        if (seeds.length) applyFillRegionsFromSeeds(currentFrame, seeds, activeLayer);
        clearFx();
        trailPoints = [];
        lastPt = null;
        return;
      }

      // Fill eraser: erase region on release
      if (tool === "fill-eraser") {
        if (activeLayer === PAPER_LAYER) {
          clearFx();
          trailPoints = [];
          lastPt = null;
          return;
        }

        const strokePts = trailPoints.length ? trailPoints : (lastPt ? [lastPt] : []);
        if (strokePts.length) eraseFillRegionsFromSeeds(activeLayer, currentFrame, strokePts);
        clearFx();
        trailPoints = [];
        lastPt = null;
        return;
      }



      // Autofill after lineart brush
      if (autofill && activeLayer === LAYER.LINE && tool === "brush") {
        pushUndo(LAYER.FILL, currentFrame);
        fillFromLineart(currentFrame);
      }

      lastPt = null;
    }


    // STAGE_PINCH_CAMERA_ZOOM (unique anchor)
    // Pinch on the STAGE container, but zoom the *camera* (zoom/offsetX/offsetY)
    // Same math as wheel-zoom: keep the content point under the midpoint stable.
    function initStagePinchCameraZoom(stageViewport){
      if (!stageViewport || stageViewport._pinchCamWired) return;
      stageViewport._pinchCamWired = true;

      // ensure the browser doesn't steal the gesture
      try { stageViewport.style.touchAction = "none"; } catch {}

      const touches = new Map(); // pointerId -> {x,y}
      let pinch = null;

      const VIEW_MIN = 0.05; // match your wheel clamp
      const VIEW_MAX = 16;

      const clampNum = (v, a, b) => Math.max(a, Math.min(b, v));

      function clientToCanvasLocal(clientX, clientY){
        const rect = drawCanvas.getBoundingClientRect();
        return { x: clientX - rect.left, y: clientY - rect.top };
      }

      function beginPinchIfReady(){
        if (touches.size !== 2) return;

        // kill any current action cleanly
        try { if (isDrawing) endStroke(); } catch {}
        try { if (isPanning) endPan(); } catch {}

        const pts = Array.from(touches.values());
        const a = pts[0], b = pts[1];

        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const midLocal = clientToCanvasLocal(mid.x, mid.y);

        const before = screenToContent(midLocal.x, midLocal.y);
        const startDist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));

        pinch = {
          startZoom: zoom,
          startOffsetX: offsetX,
          startOffsetY: offsetY,
          startDist,
          anchorContent: before,
        };

        window.__celstompPinching = true;

        // try to capture both pointers so moves keep coming even if fingers drift
        for (const pid of touches.keys()){
          try { stageViewport.setPointerCapture(pid); } catch {}
        }
      }

      function updatePinch(){
        if (!pinch || touches.size < 2) return;

        const pts = Array.from(touches.values());
        const a = pts[0], b = pts[1];

        const curDist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
        const factor = curDist / (pinch.startDist || 1);

        // midpoint in canvas-local CSS pixels
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const midLocal = clientToCanvasLocal(mid.x, mid.y);

        // apply zoom first so screenToContent() uses the new zoom
        zoom = clampNum(pinch.startZoom * factor, VIEW_MIN, VIEW_MAX);

        const after = screenToContent(midLocal.x, midLocal.y);

        // same stabilization you do on wheel
        offsetX = pinch.startOffsetX + (after.x - pinch.anchorContent.x) * (zoom * dpr);
        offsetY = pinch.startOffsetY + (after.y - pinch.anchorContent.y) * (zoom * dpr);

        renderAll();
        updateHUD();
        updatePlayheadMarker();
        updateClipMarkers();
        clearFx();
      }

      // Capture-phase so stageViewport sees touches even if they start on a child canvas
      stageViewport.addEventListener("pointerdown", (e) => {
        if (e.pointerType !== "touch") return;
        touches.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (touches.size === 2){
          e.preventDefault();
          beginPinchIfReady();
          updatePinch();
        }
      }, { capture: true, passive: false });

      stageViewport.addEventListener("pointermove", (e) => {
        if (e.pointerType !== "touch") return;
        if (!touches.has(e.pointerId)) return;

        touches.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (pinch){
          e.preventDefault();
          updatePinch();
        }
      }, { capture: true, passive: false });

      function end(e){
        if (e.pointerType !== "touch") return;

        touches.delete(e.pointerId);
        try { stageViewport.releasePointerCapture(e.pointerId); } catch {}

        // ✅ If we're no longer in a 2-finger gesture, unlock drawing immediately
        if (touches.size < 2) {
          pinch = null;
          window.__celstompPinching = false;
        }

        if (touches.size === 0){
          pinch = null;
          window.__celstompPinching = false;
        }
      }

      stageViewport.addEventListener("pointerup", end, { capture: true, passive: false });
      stageViewport.addEventListener("pointercancel", end, { capture: true, passive: false });
    }


    // -------------------------
    // Pointer input + pinch zoom
    // -------------------------
    const activePointers = new Map();
    let pinch = null;

    function clientToCanvasLocal(clientX, clientY) {
      const rect = drawCanvas.getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
    }

    function handlePointerDown(e) {


      if (e.pointerType === "touch" && window.__celstompPinching) return;
      // ✅ CTRL+DRAG: move active cel pixels (must start here)
      if ((e.ctrlKey || e.metaKey) && e.pointerType !== "touch") {
        if (beginCtrlMove(e)) {
          e.preventDefault();
          return;
        }
      }


      try {
        drawCanvas.setPointerCapture(e.pointerId);
      } catch {}

      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });

      // Pen draws
      if (e.pointerType === "pen") {
        startStroke(e);
        return;
      }

      // Touch: pinch or pan
        // Touch: 1 finger draws (unless Hand tool), 2 fingers pinch zoom
      if (e.pointerType === "touch") {
        if (window.__celstompPinching) { e.preventDefault(); return; }

        // single finger only
        if (tool === "hand") startPan(e);
        else startStroke(e);

        e.preventDefault();
        return;
      }

      // Mouse: right button or hand tool pans
      if (e.button === 2 || tool === "hand") startPan(e);
      else startStroke(e);
    }

    function handlePointerMove(e) {


      if (e.pointerType === "touch") e.preventDefault();

      if (e.pointerType === "touch" && window.__celstompPinching) return;



      // ✅ TOUCH_LOCK_SAFETY (unique anchor)
      if (e.pointerType === "touch") {
        // if pinch lock is stuck but we don't have 2 pointers, clear it
        if (window.__celstompPinching && activePointers.size < 2) {
          window.__celstompPinching = false;
        }
      }

      if (e.pointerType === "touch" && window.__celstompPinching) return;

      
      // If CTRL-move is active, it owns pointer moves
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
          
      // End CTRL-move
      if (_ctrlMove.active && e.pointerId === _ctrlMove.pointerId) {
        endCtrlMove(e);
        e.preventDefault();
        return;
      }

      try {
        drawCanvas.releasePointerCapture(e.pointerId);
      } catch {}

       activePointers.delete(e.pointerId);

      //  If we're not in a 2-finger gesture anymore, unlock drawing
      if (activePointers.size < 2) window.__celstompPinching = false;



      if (isDrawing) endStroke();
      if (isPanning) endPan();
    }

    // Wheel zoom
    drawCanvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const factor = Math.exp(-e.deltaY * 0.0015);
        const pos = getCanvasPointer(e);
        const before = screenToContent(pos.x, pos.y);

        zoom = clamp(zoom * factor, 0.05, 16);

        const after = screenToContent(pos.x, pos.y);
        offsetX += (after.x - before.x) * (zoom * dpr);
        offsetY += (after.y - before.y) * (zoom * dpr);

        renderAll();
        updateHUD();
        updatePlayheadMarker();
        updateClipMarkers();
        clearFx();
      },
      { passive: false }
    );



    // STAGE_PINCH_CAMERA_ZOOM_BOOT (unique anchor)
    initStagePinchCameraZoom(
      document.getElementById("stageViewport") ||
      document.getElementById("stage") ||
      stageEl ||
      drawCanvas
    );



    // Attach canvas pointer events
  

    if (!drawCanvas._ptrWired) {
      drawCanvas._ptrWired = true;

      try { drawCanvas.style.touchAction = "none"; } catch {}
      drawCanvas.addEventListener("pointerdown", handlePointerDown, { passive: false });
      drawCanvas.addEventListener("pointermove", handlePointerMove, { passive: false });
      drawCanvas.addEventListener("pointerup", handlePointerUp, { passive: false });
      drawCanvas.addEventListener("pointercancel", handlePointerUp, { passive: false });
      drawCanvas.addEventListener("contextmenu", (e) => e.preventDefault());
    }

    //  PINCH_HARD_RESET (unique anchor)
    const hardResetPinch = () => {
      try { touches.clear(); } catch {}
      pinch = null;
      window.__celstompPinching = false;
    };

    window.addEventListener("blur", hardResetPinch, true);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) hardResetPinch();
    }, true);

    // LASSO_MOVE (unique anchor)
    if (lassoActive && isDrawing && (tool === "lasso-fill" || tool === "lasso-erase")) {
      addLassoPoint({ x, y });
      drawLassoPreview(tool === "lasso-erase" ? "erase" : "fill");
      e.preventDefault();
      return;
    }

    // LASSO_END (unique anchor)
    if (lassoActive && (tool === "lasso-fill" || tool === "lasso-erase")) {
      // start global step
      const k = resolveKeyFor(activeLayer, (tool === "lasso-erase")
        ? (activeSubColor?.[activeLayer] ?? currentColor)
        : (currentColor)
      );
      try { beginGlobalHistoryStep(activeLayer, currentFrame, k); } catch {}

      const ok = (tool === "lasso-erase") ? applyLassoErase() : applyLassoFill();
      if (ok) { try { markGlobalHistoryDirty(); } catch {} }

      try { commitGlobalHistoryStep(); } catch {}

      cancelLasso();
      isDrawing = false;
      e?.preventDefault?.();
      return;
    }
    
    // -------------------------
    // Cel duplication + nav
    // -------------------------
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

    /* ---------- Sublayer-aware frame bundle helpers ---------- */



    function captureFrameBundle(F) {
      const bundle = new Array(LAYERS_COUNT);

      for (let L = 0; L < LAYERS_COUNT; L++) {
        const layer = layers[L];
        const m = new Map();

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

    function cloneFrameBundleDeep(bundle) {
      const out = new Array(LAYERS_COUNT);

      for (let L = 0; L < LAYERS_COUNT; L++) {
        const src = bundle[L];
        const dst = new Map();
        if (src && src.size) {
          for (const [key, c] of src) dst.set(key, cloneCanvasDeep(c));
        }
        out[L] = dst;
      }

      return out;
    }

    function pasteFrameBundle(F, bundle) {
      // overwrite destination completely
      clearFrameAllLayers(F);

      for (let L = 0; L < LAYERS_COUNT; L++) {
        const m = bundle[L];
        if (!m || !m.size) continue;

        for (const [key, c] of m) {
          const sub = ensureSublayer(L, key); // keeps suborder consistent
          sub.frames[F] = c;
        }
      }
    }

    function moveFrameAllLayers(fromF, toF) {
      if (fromF === toF) return;

      // overwrite destination completely
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

    /* ---------- Duplicate cel (sublayer-aware) ---------- */

    function duplicateCelFrames(srcF, dstF) {
      if (srcF < 0 || dstF < 0 || srcF === dstF) return false;
      if (!hasCel(srcF)) return false;

      const srcBundle = captureFrameBundle(srcF);
      const copy = cloneFrameBundleDeep(srcBundle);

      pasteFrameBundle(dstF, copy);

      renderAll();
      if (hasTimeline) buildTimeline();
      gotoFrame(dstF);
      try { setSingleSelection(dstF); } catch {}
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

    // -------------------------
    // Cel drag & drop (timeline)
    // -------------------------



    // Multi-cel selection (timeline)
    let selectedCels = new Set();     // frames (indices) that have cels
    let selectingCels = false;
    let selAnchor = -1;
    let selLast = -1;

    // Ghost preview targets (destination frames while dragging)
    let ghostTargets = new Set();

    function clearGhostTargets(){
      if (!ghostTargets.size) return;
      ghostTargets.clear();
      if (hasTimeline) highlightTimelineCell();
    }

    function computeGhostDestsForStart(startFrame){
      const frames = selectedSorted();
      if (!frames.length) return [];

      const base = frames[0];
      let shift = startFrame - base;

      // clamp shift so all dests stay inside timeline
      const minDest = frames[0] + shift;
      const maxDest = frames[frames.length - 1] + shift;

      if (minDest < 0) shift += -minDest;
      if (maxDest > totalFrames - 1) shift -= (maxDest - (totalFrames - 1));

      return frames.map(f => f + shift);
    }

    function setGhostTargetsForStart(startFrame){
      const dests = computeGhostDestsForStart(startFrame);
      ghostTargets = new Set(dests);
      if (hasTimeline) highlightTimelineCell();
    }

    function setGhostTargetSingle(frame){
      ghostTargets = new Set([frame]);
      if (hasTimeline) highlightTimelineCell();
    }


    // Group drag (move selected set)
    let groupDragActive = false;
    let groupDropStart = -1;

    function selectedSorted() {
      return Array.from(selectedCels).sort((a, b) => a - b);
    }

    function pruneSelection() {
      if (!selectedCels.size) return;
      const next = new Set();
      for (const f of selectedCels) {
        if (f >= 0 && f < totalFrames && hasCel(f)) next.add(f);
      }
      selectedCels = next;
    }

    function clearCelSelection() {
      selectedCels.clear();
      selAnchor = -1;
      selLast = -1;
      if (hasTimeline) highlightTimelineCell();
    }

    function setSingleSelection(f) {
      selectedCels = new Set(hasCel(f) ? [f] : []);
      selAnchor = f;
      selLast = f;
      if (hasTimeline) highlightTimelineCell();
    }

    function setSelectionRange(a, b) {
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      const next = new Set();
      for (let i = lo; i <= hi; i++) {
        if (hasCel(i)) next.add(i);
      }
      selectedCels = next;
      if (hasTimeline) highlightTimelineCell();
    }

    function clearFrameAllLayers(F) {
      for (let L = 0; L < LAYERS_COUNT; L++) {
        const layer = layers[L];
        if (!layer) continue;
        if (!layer.sublayers) layer.sublayers = new Map();
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
            if (c && c._hasContent) entries.push([key, c]);
          }
        }
        bundle[L] = entries;
      }
      return bundle;
    }

    function setCelBundle(F, bundle) {
      // important: clear destination so old colors don't "stick"
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


    // ISLAND_MOUNT_SLOTS (unique anchor)
    function mountIslandSlots(){
      const island = document.getElementById("floatingIsland");
      const wheelSlot  = document.getElementById("islandWheelSlot");
      const toolsSlot  = document.getElementById("islandToolsSlot");
      const layersSlot = document.getElementById("islandLayersSlot");

      if (!island || !wheelSlot || !toolsSlot || !layersSlot) return;

      // --- move wheel ---
      const wheelWrap = document.getElementById("hsvWheelWrap");
      if (wheelWrap && wheelWrap.parentElement !== wheelSlot) {
        wheelSlot.appendChild(wheelWrap);
      }

      // --- move tool buttons grid ---
      const toolSeg = document.getElementById("toolSeg");
      if (toolSeg && toolSeg.parentElement !== toolsSlot) {
        toolsSlot.appendChild(toolSeg);
      }

      // --- move layers list ---
      const layerSeg = document.getElementById("layerSeg");
      if (layerSeg && layerSeg.parentElement !== layersSlot) {
        layersSlot.appendChild(layerSeg);
      }

      // After moving, force wheel redraw if available (prevents “blank wheel”)
      try { drawHSVWheel?.(); } catch {}
      try { requestAnimationFrame(() => { try { drawHSVWheel?.(); } catch {} }); } catch {}
    }

    mountIslandSlots();



    // MOBILE_NATIVE_ZOOM_GUARD (unique anchor)
    function initMobileNativeZoomGuard(){

      

      const stage = document.getElementById("stage");
      if (!stage || stage._nativeZoomGuard) return;
      stage._nativeZoomGuard = true;

      // iOS Safari pinch gesture events (still needed even with touch-action:none)
      ["gesturestart", "gesturechange", "gestureend"].forEach((type) => {
        document.addEventListener(type, (e) => { e.preventDefault(); }, { passive: false });
      });


      // Optional: stop double-tap to zoom on some browsers
      let lastEnd = 0;
      stage.addEventListener("touchend", (e) => {
        const now = Date.now();
        if (now - lastEnd < 300) e.preventDefault();
        lastEnd = now;
      }, { passive: false });


      if (!window.__CELSTOMP_PTR_DRAW_WIRED__) {
        try { wireCanvasPointerDrawingMobileSafe(); } catch (e) { console.warn("[celstomp] pointer wiring failed", e); }
      }
    }

    // ISLAND_MINIMIZE_WIRE (unique anchor)
    function initIslandMinimizeTab(){
      const island = document.getElementById("floatingIsland");
      const collapseBtn = document.getElementById("islandCollapseBtn");
      const tabBtn = document.getElementById("islandTab");
      if (!island || !collapseBtn || !tabBtn) return;

      const LS_KEY = "celstomp_island_collapsed";

      // Prevent any header drag pointerdown from stealing the click on these
      const stop = (e) => { e.stopPropagation(); };
      ["pointerdown","mousedown","touchstart"].forEach((evt) => {
        collapseBtn.addEventListener(evt, stop, { passive: true });
        tabBtn.addEventListener(evt, stop, { passive: true });
      });

      // Avoid double-wiring if init runs more than once
      if (island._minWired) return;
      island._minWired = true;
      

      function setCollapsed(v){
        const yes = !!v;
        island.classList.toggle("collapsed", yes);
        try { localStorage.setItem(LS_KEY, yes ? "1" : "0"); } catch {}
      }

      function toggleCollapsed(){
        setCollapsed(!island.classList.contains("collapsed"));
      }

      // Restore previous state (optional but nice)
      try {
        const saved = localStorage.getItem(LS_KEY);
        if (saved === "1") island.classList.add("collapsed");
      } catch {}

      // Collapse button (top-right —)
      collapseBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation(); // prevent starting a drag from the header
        toggleCollapsed();
      }, { passive: false });

      // Tab button (appears when collapsed)
      tabBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        setCollapsed(false);
      }, { passive: false });

      // Optional: double-click header to toggle
      const header = document.getElementById("floatingIslandHeader");
      if (header){
        header.addEventListener("dblclick", (e) => {
          // ignore dblclicks on actual buttons
          if (e.target && e.target.closest("button")) return;
          e.preventDefault();
          toggleCollapsed();
        }, { passive: false });
      }
    }

    // ISLAND_MINIMIZE_BOOT (unique anchor)
    (() => {
      function tryInit() {
        try { initIslandMinimizeTab(); } catch (e) { console.warn("[island] minimize init failed", e); }
        try { initIslandSidePanel(); } catch (e) { console.warn("[island] side panel init failed", e); }

        // if mountIslandDock hasn't created things yet, keep waiting
        const island = document.getElementById("floatingIsland");
        const dock = island?.closest(".islandDock") || island;
        const sideBtn = dock?.querySelector("#islandSideBtn") || document.getElementById("islandSideBtn");
        const sidePanel = dock?.querySelector("#islandSidePanel") || document.getElementById("islandSidePanel");
        const collapseBtn = document.getElementById("islandCollapseBtn");
        const tabBtn = document.getElementById("islandTab");

        return !!(island && dock && sideBtn && sidePanel && collapseBtn && tabBtn);
      }

      function boot() {
        if (tryInit()) return;

        const mo = new MutationObserver(() => {
          if (tryInit()) mo.disconnect();
        });
        mo.observe(document.body, { childList: true, subtree: true });
      }

      if (document.readyState === "loading") {
        window.addEventListener("DOMContentLoaded", boot, { once: true });
      } else {
        boot();
      }
    })();



    // INFO_PANEL (unique anchor)
    // INFO_PANEL_WIRE (unique anchor)
    (() => {
      const btn = document.getElementById("infoBtn");
      const panel = document.getElementById("infoPanel");
      const back = document.getElementById("infoBackdrop");
      const close = document.getElementById("infoCloseBtn");
      if (!btn || !panel || !back) return;

      function openInfo(){
        btn.setAttribute("aria-expanded", "true");
        panel.setAttribute("aria-hidden", "false");
        panel.classList.add("isOpen");
        back.classList.add("isOpen");
        // optional focus for accessibility
        try { panel.focus({ preventScroll: true }); } catch {}
      }

      function closeInfo(){
        btn.setAttribute("aria-expanded", "false");
        panel.setAttribute("aria-hidden", "true");
        panel.classList.remove("isOpen");
        back.classList.remove("isOpen");
      }

      function toggleInfo(){
        const open = panel.classList.contains("isOpen");
        open ? closeInfo() : openInfo();
      }

      

      btn.addEventListener("click", toggleInfo);
      close?.addEventListener("click", closeInfo);

      // click outside to close
      back.addEventListener("click", closeInfo);

      // escape to close
      window.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && panel.classList.contains("isOpen")) closeInfo();
      });
    })();

    // ISLAND_SIDE_PANEL (unique anchor)
    function initIslandSidePanel(){
      const island = document.getElementById("floatingIsland");
      if (!island) return;

      const dock = island.closest(".islandDock") || island;

      const sideBtn =
        dock.querySelector("#islandSideBtn") || document.getElementById("islandSideBtn");
      const sidePanel =
        dock.querySelector("#islandSidePanel") || document.getElementById("islandSidePanel");

      if (!sideBtn || !sidePanel) return;

      // ensure panel is a direct child of dock (not inside body)
      if (sidePanel.parentElement !== dock) dock.appendChild(sidePanel);

      const LS_KEY = "celstomp_island_side_open";

      if (dock._sideWired) return;
      dock._sideWired = true;

      const stopProp = (e) => { e.stopPropagation(); };

      let _lastToggleAt = 0;
      function toggleOpenOnce(){
        const t = performance.now();
        if (t - _lastToggleAt < 280) return; // blocks the follow-up click after pointerdown
        _lastToggleAt = t;
        toggleOpen();
      }



      function setOpen(v){
        const yes = !!v;

        // toggle on both (CSS supports either)
        dock.classList.toggle("side-open", yes);
        island.classList.toggle("side-open", yes);

        sidePanel.setAttribute("aria-hidden", yes ? "false" : "true");
        sideBtn.textContent = yes ? "<" : ">";

        sidePanel.hidden = !yes;

        try { localStorage.setItem(LS_KEY, yes ? "1" : "0"); } catch {}
      }

      function toggleOpen(){
        setOpen(!dock.classList.contains("side-open"));
      }

      // stop the header drag from stealing the tap
      ["touchstart", "pointerdown", "mousedown"].forEach((evt) => {
        sideBtn.addEventListener(evt, stopProp, { capture: true, passive: true });
      });

      sideBtn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleOpenOnce();
      }, { capture: true, passive: false });

      sideBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleOpenOnce();
      }, { capture: true, passive: false });


      // restore
      try {
        const saved = localStorage.getItem(LS_KEY);
        if (saved === "1") setOpen(true);
      } catch {}

      // if island collapses, auto-close side panel
      const mo = new MutationObserver(() => {
        if (island.classList.contains("collapsed") || dock.classList.contains("collapsed")) setOpen(false);
      });
      mo.observe(island, { attributes: true, attributeFilter: ["class"] });


    }



















    function clearCelFrameAllLayers(F) {
      // overwrite legacy impl: clear ALL sublayer frames for this time index
      clearFrameAllLayers(F);
    }

    function getCelBundle(F) {
      // return bundle of all sublayers that have content at frame F
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

      // clear selected frames across all layers+sublayers (optionally add undo later)
      for (const f of frames) {
        clearFrameAllLayers(f);
      }

      // ✅ NEW: remove any colors that became unused because frames were deleted
      for (let L = 0; L < LAYERS_COUNT; L++) pruneUnusedSublayers(L);

      clearCelSelection();
      renderAll();
      
      if (hasTimeline) buildTimeline();
      updateHUD();
    
    }

    function simulateRoomForDests(dests, dir) {
      // occupancy simulation to avoid partial moves
      const occ = new Uint8Array(totalFrames);
      for (let i = 0; i < totalFrames; i++) occ[i] = hasCel(i) ? 1 : 0;

      // selected are treated as empty (we'll re-place them)
      for (const f of selectedCels) if (f >= 0 && f < totalFrames) occ[f] = 0;

      const order = dests
        .slice()
        .sort((a, b) => (dir >= 0 ? b - a : a - b)); // right-move: high→low, left-move: low→high

      const pushes = []; // {from,to} moves for existing occupants

      for (const d of order) {
        if (d < 0 || d >= totalFrames) return null;

        if (occ[d]) {
          let j = d;
          while (true) {
            j += dir;
            if (j < 0 || j >= totalFrames) return null;
            if (!occ[j]) {
              // push occupant d -> j
              occ[j] = 1;
              occ[d] = 0;
              pushes.push({ from: d, to: j });
              break;
            }
          }
        }

        // reserve destination for selected
        occ[d] = 1;
      }

      return pushes;
    }

    function moveSelectedCelsTo(startFrame) {
      const frames = selectedSorted();
      if (!frames.length) return;

      const base = frames[0];
      if (startFrame === base) return;

      // compute shift, clamp so all dests stay inside timeline
      let shift = startFrame - base;

      const minDest = frames[0] + shift;
      const maxDest = frames[frames.length - 1] + shift;

      if (minDest < 0) shift += -minDest;
      if (maxDest > totalFrames - 1) shift -= (maxDest - (totalFrames - 1));

      if (shift === 0) return;

      const dests = frames.map((f) => f + shift);
      const dir = shift > 0 ? 1 : -1;

      // capture selected bundles
      const bundles = frames.map((f) => ({ f, b: getCelBundle(f) }));

      // temporarily clear selected frames so collisions are accurate
      for (const f of frames) clearFrameAllLayers(f);


      // simulate room + get pushes needed
      const pushes = simulateRoomForDests(dests, dir);
      if (!pushes) {
        // restore and abort (no room)
        for (const it of bundles) setCelBundle(it.f, it.b);
        renderAll();
        if (hasTimeline) buildTimeline();
        return;
      }

      // perform pushes for real
      for (const mv of pushes) moveCelBundle(mv.from, mv.to);

      // place selected at destinations
      for (let i = 0; i < frames.length; i++) setCelBundle(dests[i], bundles[i].b);

      // update selection to new frames
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

      [...tr.children].forEach((cell, idx) => {
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

      // capture the cel at src
      const saved = captureFrameBundle(srcF);

      // remove src immediately (so ripple moves are accurate)
      clearFrameAllLayers(srcF);

      const dstOccupied = hasCel(dstF);

      if (!dstOccupied) {
        pasteFrameBundle(dstF, saved);
      } else {
        if (srcF < dstF) {
          // ripple-left everything between (srcF+1 .. dstF) into (srcF .. dstF-1)
          for (let i = srcF; i < dstF; i++) moveFrameAllLayers(i + 1, i);
          pasteFrameBundle(dstF, saved);
        } else {
          // ripple-right everything between (dstF .. srcF-1) into (dstF+1 .. srcF)
          for (let i = srcF - 1; i >= dstF; i--) moveFrameAllLayers(i, i + 1);
          pasteFrameBundle(dstF, saved);
        }
      }

      renderAll();
      if (hasTimeline) buildTimeline();
      gotoFrame(dstF);
      try { setSingleSelection(dstF); } catch {}
      return true;
    }


    // -------------------------
    // Timeline scrubbing + clip drag + cel drag
    // -------------------------
    let scrubbing = false;
    let scrubStartFrame = 0;
    let scrubMode = "playhead"; // playhead | cels
    let draggingClip = null; // 'start' | 'end'

    function frameFromClientX(clientX) {
      const playRow = timelineTable.querySelector("tr.playhead-row");
      if (!playRow) return 0;
      const rect = playRow.getBoundingClientRect();
      const x = clamp(clientX - rect.left + timelineScroll.scrollLeft, 0, playRow.scrollWidth);

      const firstW = playRow.children[0]?.getBoundingClientRect().width || 200;
      const cellW =
        playRow.children[1]?.getBoundingClientRect().width ||
        nowCSSVarPx("--frame-w", 24) ||
        24;

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

    function startTimelineInteraction(e) {
      if (!hasTimeline) return;

      // Clip marker drag by proximity to marker lines (priority)
      const scrollRect = timelineScroll.getBoundingClientRect();
      const xInScroll = e.clientX - scrollRect.left + timelineScroll.scrollLeft;

      const nearStart = Math.abs(edgeLeftPxOfFrame(clipStart) - xInScroll) < 6;
      const nearEnd = Math.abs(edgeLeftPxOfFrame(clipEnd) - xInScroll) < 6;
      if (nearStart || nearEnd) {
        draggingClip = nearStart ? "start" : "end";
        e.preventDefault();
        return;
      }

      // Animation row: select or drag-move cels
      const animCell = e.target.closest("tr.anim-row td");
      if (animCell && animCell.dataset.index !== undefined) {
        const idx = parseInt(animCell.dataset.index, 10);

        // If clicked a cel: start drag (group if selected set includes it)
        if (hasCel(idx)) {
          if (!selectedCels.has(idx)) {
            // clicking a new cel makes it the selection
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

        // Empty cell: drag-select range (selects ONLY frames that have cels)
        selectingCels = true;
        selAnchor = idx;
        selLast = idx;

        // starting a new selection clears old selection
        selectedCels.clear();
        setSelectionRange(selAnchor, selLast);

        document.body.classList.add("selecting-cels");
        e.preventDefault();
        return;
      }

      // Playhead row scrubbing (unchanged)
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
      timelineScroll.addEventListener("pointerdown", startTimelineInteraction, { passive: false });
      window.addEventListener("pointermove", moveTimelineInteraction, { passive: false });
      window.addEventListener("pointerup", endTimelineInteraction, { passive: true });
    }

    // -------------------------
    // Playback
    // -------------------------
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

      const interval = 1000 / fps;
      if (currentFrame < clipStart || currentFrame > clipEnd) gotoFrame(clipStart);

      playTimer = setInterval(() => {
        if (currentFrame >= clipEnd) {
          if (loopPlayback) gotoFrame(clipStart);
          else {
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

  
    // -------------------------
    // Export
    // -------------------------
    async function drawFrameTo(ctx, i, opts = {}) {
      const forceHoldOff = !!opts.forceHoldOff;
      const transparent  = !!opts.transparent;

      // reset compositing
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";

      ctx.clearRect(0, 0, contentW, contentH);

      // ✅ only fill bg when NOT exporting transparent PNGs
      if (!transparent) {
        ctx.fillStyle = canvasBgColor;
        ctx.fillRect(0, 0, contentW, contentH);
      }

      // ---- keep the rest of your existing logic exactly ----
      if (hasCel(i)) drawExactCel(ctx, i);
      else {
        const p = nearestPrevCelIndex(i);
        if (p >= 0) {
          // forceHoldOff=true => NEVER ghost, always full opacity hold
          if (transparencyHoldEnabled && !forceHoldOff) ctx.globalAlpha = 0.3;
          drawExactCel(ctx, p);
          ctx.globalAlpha = 1;
        }
      }
    }



    function pickWebMMime() {
      let m = "video/webm;codecs=vp9";
      if (!MediaRecorder.isTypeSupported(m)) m = "video/webm;codecs=vp8";
      if (!MediaRecorder.isTypeSupported(m)) m = "video/webm";
      return m;
    }

    function pickMP4Mime() {
      const options = ["video/mp4;codecs=h264", "video/mp4;codecs=avc1", "video/mp4"];
      for (const m of options) if (MediaRecorder.isTypeSupported(m)) return m;
      return null;
    }


    /* =========================================================
      IMG SEQ EXPORT — FIXED
      - Exports clipStart..clipEnd inclusive (your timeline range)
      - Holds last cel at FULL opacity for empty frames
      - Forces Paper layer OFF during export
      - ALT held while clicking => transparent PNGs (no bg fill)
      - SHIFT held while clicking => export full timeline (0..totalFrames-1)
      ========================================================= */

    // ✅ Wire once
    if (exportImgSeqBtn) {
      exportImgSeqBtn.addEventListener("click", onExportImgSeqClick);
    } else {
      console.warn("[celstomp] exportImgSeqBtn not found (id exportImgSeqBtn/exportImgSeq).");
    }

    async function onExportImgSeqClick(e) {
      e.preventDefault();
      e.stopPropagation();

      const oldTxt = exportImgSeqBtn.textContent;
      exportImgSeqBtn.disabled = true;

      // modifiers
      const transparent = !!e.altKey;   // ALT => transparent PNGs
      const fullRange   = !!e.shiftKey; // SHIFT => full timeline

      // 🚨 Must pick folder immediately on the click gesture
      let baseDir;
      try {
        baseDir = await pickImgSeqDirectoryHandle();
      } catch (err) {
        console.warn("[IMGSEQ] picker cancelled/blocked:", err);
        exportImgSeqBtn.disabled = false;
        exportImgSeqBtn.textContent = oldTxt;
        return;
      }

      // range
      const tf = (typeof totalFrames === "number" && totalFrames > 0) ? totalFrames : (fps * seconds);
      const maxF = Math.max(0, tf - 1);

      const start = fullRange ? 0 : clamp((clipStart | 0), 0, maxF);
      const end   = fullRange ? maxF : clamp((clipEnd   | 0), start, maxF);

      const count = end - start + 1;

      // make a subfolder (user should choose Downloads in picker)
      const folderName =
        `celstomp_pngseq_${fps}fps_${String(start + 1).padStart(4, "0")}-${String(end + 1).padStart(4, "0")}_${imgSeqTimestampSlug()}`;

      let dir = baseDir;
      try {
        dir = await baseDir.getDirectoryHandle(folderName, { create: true });
      } catch {
        // if creating subfolder fails, we’ll try writing to baseDir directly
        dir = baseDir;
      }

      // offscreen render canvas
      const cc = document.createElement("canvas");
      cc.width = contentW;
      cc.height = contentH;

      const cctx = cc.getContext("2d", { alpha: true });
      cctx.imageSmoothingEnabled = !!antiAlias;

      try {
        exportImgSeqBtn.textContent = "Exporting… 0%";

        await withImgSeqExportOverridesAsync(async () => {
          for (let f = start; f <= end; f++) {
            // ✅ Holds previous cel full opacity (see drawFrameTo tweak below)
            await drawFrameTo(cctx, f, { forceHoldOff: true, transparent });

            const blob = await imgSeqCanvasToPngBlob(cc);
            const fname = `frame_${String(f - start).padStart(4, "0")}.png`;

            // folder write (Chromium) or fallback download
            if (dir && dir.getFileHandle) {
              const fh = await dir.getFileHandle(fname, { create: true });
              const w = await fh.createWritable();
              await w.write(blob);
              await w.close();
            } else {
              imgSeqDownloadBlob(blob, fname);
              await imgSeqYield(60);
            }

            const done = f - start + 1;
            if ((done % 2) === 0) {
              exportImgSeqBtn.textContent = `Exporting… ${Math.round((done / count) * 100)}%`;
              await imgSeqYield(0);
            }
          }
        });

        exportImgSeqBtn.textContent = oldTxt;
        alert(`PNG sequence exported.\nFolder: ${folderName}\nFrames: ${start + 1}–${end + 1} (${count})`);
      } catch (err) {
        console.error(err);
        exportImgSeqBtn.textContent = oldTxt;
        alert("IMG SEQ export failed. Check console for details.");
      } finally {
        exportImgSeqBtn.disabled = false;
      }
    }

    async function pickImgSeqDirectoryHandle() {
      if (!window.isSecureContext) throw new Error("IMG SEQ export requires HTTPS (secure context).");
      if (!window.showDirectoryPicker) throw new Error("Folder picker not supported (use Chrome/Edge/Opera desktop).");

      // Some browsers support startIn; if not, retry without it.
      try {
        return await window.showDirectoryPicker({ mode: "readwrite", startIn: "downloads" });
      } catch {
        return await window.showDirectoryPicker({ mode: "readwrite" });
      }
    }

    function imgSeqTimestampSlug(d = new Date()) {
      const p2 = (n) => String(n).padStart(2, "0");
      return (
        d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + "_" +
        p2(d.getHours()) + p2(d.getMinutes()) + p2(d.getSeconds())
      );
    }

    function imgSeqCanvasToPngBlob(canvas) {
      return new Promise((res, rej) => {
        canvas.toBlob((b) => (b ? res(b) : rej(new Error("toBlob returned null"))), "image/png");
      });
    }

    function imgSeqDownloadBlob(blob, filename) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    }

    function imgSeqYield(ms = 0) {
      return (typeof sleep === "function") ? sleep(ms) : new Promise((r) => setTimeout(r, ms));
    }

    // ✅ Force paper OFF + prevent ghost-hold during export
    async function withImgSeqExportOverridesAsync(fn) {
      const prev = {
        hold: (typeof transparencyHoldEnabled !== "undefined") ? transparencyHoldEnabled : undefined,
        onion: (typeof onionEnabled !== "undefined") ? onionEnabled : undefined,
        paperOpacity: null,
        paperAcc: null,
        paperPrev: null,
      };

      try {
        // Force: hold-not-ghost + no onion
        if (typeof transparencyHoldEnabled !== "undefined") transparencyHoldEnabled = false;
        if (typeof onionEnabled !== "undefined") onionEnabled = false;

        // 1) If you have getPaperAccessor(), use it
        if (typeof getPaperAccessor === "function") {
          prev.paperAcc = getPaperAccessor();
          if (prev.paperAcc) {
            prev.paperPrev = prev.paperAcc.get();
            prev.paperAcc.set(false);
          }
        }

        // 2) Also try direct layers[PAPER_LAYER].opacity = 0
        if (typeof PAPER_LAYER !== "undefined" && Array.isArray(layers) && layers[PAPER_LAYER]) {
          prev.paperOpacity = layers[PAPER_LAYER].opacity;
          layers[PAPER_LAYER].opacity = 0;
        }

        return await fn();
      } finally {
        if (typeof transparencyHoldEnabled !== "undefined" && prev.hold !== undefined) transparencyHoldEnabled = prev.hold;
        if (typeof onionEnabled !== "undefined" && prev.onion !== undefined) onionEnabled = prev.onion;

        if (typeof PAPER_LAYER !== "undefined" && Array.isArray(layers) && layers[PAPER_LAYER] && prev.paperOpacity !== null) {
          layers[PAPER_LAYER].opacity = prev.paperOpacity;
        }
        if (prev.paperAcc && prev.paperPrev !== null) {
          try { prev.paperAcc.set(prev.paperPrev); } catch {}
        }
      }
    }


    // -------------------------
    // Export: PNG sequence
    // -------------------------

    function zpad(n, w){ return String(n).padStart(w, "0"); }

    function getFullAnimRange(){
      // Try common “full timeline” vars first; fallback to your existing clipStart/clipEnd.
      // ✅ If your app uses different names, add them here.
      if (typeof animStart !== "undefined" && typeof animEnd !== "undefined") {
        return { start: (animStart|0), end: (animEnd|0) };
      }
      if (typeof frameCount !== "undefined") {
        const fc = (frameCount|0);
        return { start: 0, end: Math.max(0, fc - 1) };
      }
      if (typeof totalFrames !== "undefined") {
        const tf = (totalFrames|0);
        return { start: 0, end: Math.max(0, tf - 1) };
      }
      if (typeof timelineFrames !== "undefined") {
        const tf = (timelineFrames|0);
        return { start: 0, end: Math.max(0, tf - 1) };
      }
      return { start: (clipStart|0), end: (clipEnd|0) };
    }

    function canvasToPngBlob(canvas){
      return new Promise((res, rej) => {
        canvas.toBlob((b) => b ? res(b) : rej(new Error("PNG export failed (toBlob returned null)")), "image/png");
      });
    }

    async function writeBlobToFile(fileHandle, blob){
      const w = await fileHandle.createWritable();
      await w.write(blob);
      await w.close();
    }

    // Force “paper” OFF during export (adjust keys to match your actual variable/state names)
    async function withPaperForcedOffAsync(fn){
      const prev = {};

      // Common patterns: plain vars
      if (typeof showPaper !== "undefined") { prev.showPaper = showPaper; showPaper = false; }
      if (typeof paperEnabled !== "undefined") { prev.paperEnabled = paperEnabled; paperEnabled = false; }
      if (typeof paperLayerEnabled !== "undefined") { prev.paperLayerEnabled = paperLayerEnabled; paperLayerEnabled = false; }

      // Common patterns: state flags
      if (typeof state !== "undefined" && state) {
        if ("showPaper" in state) { prev.state_showPaper = state.showPaper; state.showPaper = false; }
        if ("paperEnabled" in state) { prev.state_paperEnabled = state.paperEnabled; state.paperEnabled = false; }
        if ("paperVisible" in state) { prev.state_paperVisible = state.paperVisible; state.paperVisible = false; }
        if ("paperLayerEnabled" in state) { prev.state_paperLayerEnabled = state.paperLayerEnabled; state.paperLayerEnabled = false; }
      }

      try {
        return await fn();
      } finally {
        if ("showPaper" in prev && typeof showPaper !== "undefined") showPaper = prev.showPaper;
        if ("paperEnabled" in prev && typeof paperEnabled !== "undefined") paperEnabled = prev.paperEnabled;
        if ("paperLayerEnabled" in prev && typeof paperLayerEnabled !== "undefined") paperLayerEnabled = prev.paperLayerEnabled;

        if (typeof state !== "undefined" && state) {
          if ("state_showPaper" in prev) state.showPaper = prev.state_showPaper;
          if ("state_paperEnabled" in prev) state.paperEnabled = prev.state_paperEnabled;
          if ("state_paperVisible" in prev) state.paperVisible = prev.state_paperVisible;
          if ("state_paperLayerEnabled" in prev) state.paperLayerEnabled = prev.state_paperLayerEnabled;
        }
      }
    }

    async function exportPNGSequence({ start, end, fpsLocal }){
      const cc = document.createElement("canvas");
      cc.width = contentW;
      cc.height = contentH;

      const cctx = cc.getContext("2d");
      cctx.imageSmoothingEnabled = !!antiAlias;

      const count = Math.max(0, end - start + 1);
      const pad = Math.max(4, String(count).length);

      // ✅ Best UX: write files to a chosen folder (avoids 1000 download prompts)
      // Works in Chromium browsers on https:// or localhost.
      if (window.showDirectoryPicker) {
        const dir = await window.showDirectoryPicker({ mode: "readwrite" });

        // Optional manifest
        const manifest = {
          app: "Celstomp",
          fps: fpsLocal,
          startFrame: start,
          endFrame: end,
          width: contentW,
          height: contentH,
          generatedAt: new Date().toISOString()
        };
        const mh = await dir.getFileHandle("manifest.json", { create: true });
        await writeBlobToFile(mh, new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" }));

        for (let f = start, idx = 0; f <= end; f++, idx++) {
          await sleep(0);
          await drawFrameTo(cctx, i, { forceHoldOff: true });

          const blob = await canvasToPngBlob(cc);

          const name = `frame_${zpad(idx + 1, pad)}.png`;
          const fh = await dir.getFileHandle(name, { create: true });
          await writeBlobToFile(fh, blob);
        }
        return;
      }

      // Fallback: many downloads (some browsers will block / prompt a lot)
      for (let f = start, idx = 0; f <= end; f++, idx++) {
        await sleep(0);
        await drawFrameTo(cctx, i, { forceHoldOff: true });

        const blob = await canvasToPngBlob(cc);

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `celstomp_${fpsLocal}fps_frame_${zpad(idx + 1, pad)}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

        // small delay so the browser keeps up
        await sleep(30);
      }
    }

    // One-call “full range” exporter that also forces OFF:
    // - transparency hold (your previous wrapper)
    // - paper layer
    async function exportPNGSequenceFull(){
      const { start, end } = getFullAnimRange();

      // If you already added withTransparencyHoldForcedOffAsync earlier, keep this:
      if (typeof withTransparencyHoldForcedOffAsync === "function") {
        return await withTransparencyHoldForcedOffAsync(async () => {
          return await withPaperForcedOffAsync(async () => {
            return await exportPNGSequence({ start, end, fpsLocal: fps });
          });
        });
      }

      // Otherwise, just do paper-off:
      return await withPaperForcedOffAsync(async () => {
        return await exportPNGSequence({ start, end, fpsLocal: fps });
      });
    }


    async function withTransparencyHoldForcedOffAsync(fn){
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
      const rec = new MediaRecorder(stream, { mimeType: mime });

      rec.ondataavailable = (e) => {
        if (e.data && e.data.size) chunks.push(e.data);
      };
      const done = new Promise((res) => (rec.onstop = res));

      await withTransparencyHoldForcedOffAsync(async () => {
        rec.start();

        for (let i = clipStart; i <= clipEnd; i++) {
          await sleep(0);
          await drawFrameTo(cctx, i, { exportMode: true });
          await sleep(1000 / fps);
        }

        rec.stop();
        await done;
      });

      const blob = new Blob(chunks, { type: mime });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `celstomp_clip_${fps}fps_${framesToSF(clipStart).s}-${framesToSF(clipEnd).s}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }
    

    // -------------------------
    // Export: PNG image sequence (folder or ZIP)
    // - forces: transparencyHold OFF, paper OFF
    // -------------------------

    function padNum(n, w = 4) {
      const s = String(n);
      return s.length >= w ? s : ("0".repeat(w - s.length) + s);
    }

    function downloadBlob(blob, filename) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    }

    function canvasToPngBlob(canvas) {
      return new Promise((res) => canvas.toBlob((b) => res(b), "image/png"));
    }

    // Best-effort paper toggle accessor.
    // If it can’t find yours, you’ll map it once (see NOTE inside).
    function getPaperAccessor() {
      // 1) common globals
      if (typeof paperEnabled !== "undefined") {
        return { get: () => !!paperEnabled, set: (v) => (paperEnabled = !!v) };
      }
      if (typeof paperLayerEnabled !== "undefined") {
        return { get: () => !!paperLayerEnabled, set: (v) => (paperLayerEnabled = !!v) };
      }
      if (typeof showPaper !== "undefined") {
        return { get: () => !!showPaper, set: (v) => (showPaper = !!v) };
      }

      // 2) common state fields
      try {
        if (typeof state === "object" && state) {
          if ("paperEnabled" in state) return { get: () => !!state.paperEnabled, set: (v) => (state.paperEnabled = !!v) };
          if ("paperOn" in state)      return { get: () => !!state.paperOn,      set: (v) => (state.paperOn = !!v) };
          if ("showPaper" in state)    return { get: () => !!state.showPaper,    set: (v) => (state.showPaper = !!v) };
        }
      } catch {}

      // 3) checkbox heuristic
      const cb =
        document.getElementById("paperToggle") ||
        document.querySelector('input[type="checkbox"][id*="paper" i]') ||
        document.querySelector('input[type="checkbox"][name*="paper" i]');

      if (cb && "checked" in cb) {
        return {
          get: () => !!cb.checked,
          set: (v) => {
            cb.checked = !!v;
            cb.dispatchEvent(new Event("change", { bubbles: true }));
          },
        };
      }

      // 4) layer object heuristic (if you have layers[])
      try {
        if (Array.isArray(layers)) {
          const pl = layers.find((l) => /paper/i.test(String(l?.name ?? l?.id ?? "")));
          if (pl && ("visible" in pl)) return { get: () => !!pl.visible, set: (v) => (pl.visible = !!v) };
        }
      } catch {}

      return null;
    }

    async function withExportOverridesAsync(fn) {
      const prevHold = transparencyHoldEnabled;

      const paperAcc = getPaperAccessor();
      const prevPaper = paperAcc ? paperAcc.get() : null;

      try {
        // force export behavior
        transparencyHoldEnabled = false;
        if (paperAcc) paperAcc.set(false);

        // If your renderer caches visibility, you may need a refresh:
        // try { render?.(); } catch {}
        return await fn();
      } finally {
        transparencyHoldEnabled = prevHold;
        if (paperAcc && prevPaper !== null) paperAcc.set(prevPaper);
        // try { render?.(); } catch {}
      }
    }

    async function exportPNGSequenceFull() {
      // Uses existing clip range; matches your video export behavior.
      const start = clipStart;
      const end = clipEnd;

      if (start == null || end == null) {
        alert("PNG sequence export: clipStart/clipEnd not set.");
        return;
      }

      const folderName = `celstomp_pngseq_${fps}fps_${framesToSF(start).s}-${framesToSF(end).s}`;
      const cc = document.createElement("canvas");
      cc.width = contentW;
      cc.height = contentH;
      const cctx = cc.getContext("2d");
      cctx.imageSmoothingEnabled = !!antiAlias;

      await withExportOverridesAsync(async () => {
        // Prefer real folder export when supported (Chrome/Edge).
        if (window.showDirectoryPicker) {
          const root = await window.showDirectoryPicker({ mode: "readwrite" });
          const dir = await root.getDirectoryHandle(folderName, { create: true });

          for (let i = start; i <= end; i++) {
            await sleep(0);
            await drawFrameTo(cctx, i, { forceHoldOff: true });

            const blob = await canvasToPngBlob(cc);
            if (!blob) throw new Error("Failed to encode PNG blob.");

            const fname = `frame_${padNum(i - start, 4)}.png`;
            const fileHandle = await dir.getFileHandle(fname, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
          }

          alert(`Saved PNG sequence to folder: ${folderName}`);
          return;
        }

        // Fallback: ZIP (needs JSZip). If missing, we’ll do multi-download.
        if (typeof JSZip === "undefined") {
          // multi-download fallback (no folder possible)
          for (let i = start; i <= end; i++) {
            await sleep(0);
            await drawFrameTo(cctx, i, { forceHoldOff: true });

            const blob = await canvasToPngBlob(cc);
            const fname = `${folderName}_frame_${padNum(i - start, 4)}.png`;
            downloadBlob(blob, fname);

            // small delay so browser doesn’t drop downloads
            await sleep(80);
          }
          alert("Downloaded PNGs individually (your browser doesn’t support folder export, and JSZip not loaded).");
          return;
        }

        // ZIP with a folder inside
        const zip = new JSZip();
        const folder = zip.folder(folderName);

        for (let i = start; i <= end; i++) {
          await sleep(0);
          await drawFrameTo(cctx, i, { forceHoldOff: true });

          const blob = await canvasToPngBlob(cc);
          const ab = await blob.arrayBuffer();
          folder.file(`frame_${padNum(i - start, 4)}.png`, ab);
        }

        const zipBlob = await zip.generateAsync({ type: "blob" });
        downloadBlob(zipBlob, `${folderName}.zip`);
      });
    }


    // -------------------------
    // Save/Load
    // -------------------------
    // SAVE_PROJECT_FULL (unique anchor)

    // SAVE_PROJECT_FULL_V2 (unique anchor)
    // ✅ Save/Load v2 FIXED (sublayer-aware, no-const crash, no missing helpers)

    function blobToDataURL(blob){
      return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => reject(r.error || new Error("FileReader failed"));
        r.readAsDataURL(blob);
      });
    }

    async function canvasToPngDataURL(c){
      if (!c) return null;

      // HTMLCanvasElement
      if (typeof c.toDataURL === "function"){
        try { return c.toDataURL("image/png"); } catch {}
      }

      // OffscreenCanvas
      if (typeof c.convertToBlob === "function"){
        const blob = await c.convertToBlob({ type: "image/png" });
        return await blobToDataURL(blob);
      }

      return null;
    }

    // ✅ Provide the helper name your saveProject uses (your code was calling canvasHasAnyAlpha)
    function canvasHasAnyAlpha(c){
      try {
        const ctx = c.getContext("2d", { willReadFrequently: true });
        const data = ctx.getImageData(0, 0, contentW, contentH).data;
        for (let i = 3; i < data.length; i += 4) if (data[i] > 0) return true;
      } catch {}
      return false;
    }

    // De-dupe while preserving order
    function uniqStable(arr){
      const seen = new Set();
      const out = [];
      for (const v of (arr || [])){
        const k = String(v);
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(v);
      }
      return out;
    }

    async function saveProject(){
      // optional: stop playback to avoid mid-save changes
      try { if (typeof pausePlayback === "function") pausePlayback(); } catch {}
      try { if (typeof stopPlayback === "function") stopPlayback(); } catch {}

      const outLayers = [];

      for (let li = 0; li < LAYERS_COUNT; li++){
        const lay = layers?.[li];

        const opacity = (typeof lay?.opacity === "number") ? clamp(lay.opacity, 0, 1) : 1;
        const name = String(lay?.name || "");
        const clipToBelow = !!lay?.clipToBelow;

        const suborder = Array.isArray(lay?.suborder) ? lay.suborder.slice() : [];
        const keySet = new Set(suborder);

        if (lay?.sublayers && typeof lay.sublayers.keys === "function"){
          for (const k of lay.sublayers.keys()) keySet.add(k);
        }

        // stable order: keep suborder first; then any missing keys sorted
        const keys = Array.from(keySet);
        keys.sort((a,b) => {
          const ia = suborder.indexOf(a);
          const ib = suborder.indexOf(b);
          if (ia === -1 && ib === -1) return String(a).localeCompare(String(b));
          if (ia === -1) return 1;
          if (ib === -1) return -1;
          return ia - ib;
        });

        const outSubs = {};

        for (const rawKey of keys){
          const key = (typeof resolveKeyFor === "function") ? resolveKeyFor(li, rawKey) : colorToHex(rawKey);
          const sub = lay?.sublayers?.get?.(key) || lay?.sublayers?.get?.(rawKey);
          if (!sub?.frames) continue;

          const framesOut = {};
          const n = Math.min(totalFrames, sub.frames.length);

          for (let fi = 0; fi < n; fi++){
            const c = sub.frames[fi];
            if (!c) continue;

            const has =
              (c._hasContent === true) ? true :
              (c._hasContent === false) ? false :
              canvasHasAnyAlpha(c);

            if (!has) { c._hasContent = false; continue; }

            const url = await canvasToPngDataURL(c);
            if (url) framesOut[String(fi)] = url;
          }

          if (Object.keys(framesOut).length){
            outSubs[key] = { frames: framesOut };
          }
        }

        outLayers.push({
          name,
          opacity,
          clipToBelow,
          suborder: uniqStable(keys),
          sublayers: outSubs,
        });
      }

      const refExportMap = {};
      
      for (let i = 0; i < totalFrames; i++) {
        const item = referenceCels[i];
        if (!item) continue; 

        if (item.empty) {
          refExportMap[i] = "EMPTY";
        } else if (item instanceof HTMLImageElement) {
          try {
            const tmpC = document.createElement("canvas");
            tmpC.width = item.naturalWidth || item.width;
            tmpC.height = item.naturalHeight || item.height;
            tmpC.getContext("2d").drawImage(item, 0, 0);
            refExportMap[i] = tmpC.toDataURL("image/png");
          } catch (e) {
            console.warn("Skipping tainted ref", e);
          }
        }
      }

      const data = {
        version: 2,

        // canvas + timeline
        contentW,
        contentH,
        fps,
        seconds,
        totalFrames,
        currentFrame,
        clipStart,
        clipEnd,
        snapFrames,

        // prefs/tools
        brushSize,
        eraserSize,
        currentColor,
        canvasBgColor,
        antiAlias,
        closeGapPx,
        autofill,

        // onion/transparency
        onionEnabled,
        transparencyHoldEnabled,
        onionPrevTint,
        onionNextTint,
        onionAlpha,
        playSnapped,
        keepOnionWhilePlaying,
        keepTransWhilePlaying,

        // color memory / selection
        layerColors: Array.isArray(layerColorMem) ? layerColorMem.slice() : [],
        activeLayer,
        activeSubColor: Array.isArray(activeSubColor) ? activeSubColor.slice() : activeSubColor,

        oklchDefault,

        // Reference images
        referenceLayerMap: refExportMap,
        referenceOpacity: (typeof referenceOpacity !== "undefined") ? referenceOpacity : 0.4,
        referenceVisible: (typeof referenceVisible !== "undefined") ? referenceVisible : true,

        // drawings
        layers: outLayers
      };

      const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "celstomp_project.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }


    function loadProject(file){
      const fr = new FileReader();
      fr.onerror = () => alert("Failed to read file.");

      fr.onload = () => {
        (async () => {
          const data = JSON.parse(fr.result);

          // stop playback if you have it
          try { if (typeof stopPlayback === "function") stopPlayback(); } catch {}
          try { clearFx?.(); } catch {}

          // restore base settings FIRST
          fps = clamp(parseInt(data.fps || 24, 10), 1, 120);
          seconds = clamp(parseInt(data.seconds || 5, 10), 1, 600);
          totalFrames = fps * seconds;

          // ✅ restore canvas size (now works because contentW/H are let)
          if (Number.isFinite(data.contentW) && Number.isFinite(data.contentH)) {
            contentW = clamp(parseInt(data.contentW, 10), 16, 8192);
            contentH = clamp(parseInt(data.contentH, 10), 16, 8192);
          }

          currentFrame = clamp(parseInt(data.currentFrame ?? 0, 10), 0, totalFrames - 1);

          clipStart = clamp(parseInt(data.clipStart ?? 0, 10), 0, totalFrames - 1);
          clipEnd = clamp(
            parseInt(data.clipEnd ?? Math.min(totalFrames - 1, fps * 2 - 1), 10),
            clipStart,
            totalFrames - 1
          );

          snapFrames = Math.max(1, parseInt(data.snapFrames || 1, 10));

          brushSize = clamp(parseInt(data.brushSize || 3, 10), 1, 200);
          eraserSize = clamp(parseInt(data.eraserSize || 100, 10), 1, 400);

          currentColor = data.currentColor || "#000000";
          canvasBgColor = data.canvasBgColor || "#bfbfbf";
          antiAlias = !!data.antiAlias;

          closeGapPx = clamp(parseInt(data.closeGapPx || 0, 10), 0, 200);
          autofill = (typeof data.autofill === "boolean") ? data.autofill : true;

          onionEnabled = !!data.onionEnabled;
          transparencyHoldEnabled = !!data.transparencyHoldEnabled;

          onionPrevTint = data.onionPrevTint || "#4080ff";
          onionNextTint = data.onionNextTint || "#40ff78";

          let oa = (typeof data.onionAlpha === "number") ? data.onionAlpha : 0.2;
          if (oa > 1.001) oa = oa / 100;
          onionAlpha = clamp(oa, 0.05, 0.8);

          playSnapped = !!data.playSnapped;
          keepOnionWhilePlaying = !!data.keepOnionWhilePlaying;
          keepTransWhilePlaying = !!data.keepTransWhilePlaying;

          if (typeof data.referenceOpacity === "number") {
            referenceOpacity = Math.max(0, Math.min(1, data.referenceOpacity));
            const opInp = document.getElementById("refOpacity");
            if (opInp) opInp.value = Math.round(referenceOpacity * 100);
          }

          if (typeof data.referenceVisible === "boolean") {
            referenceVisible = data.referenceVisible;
            const refTog = document.getElementById("refToggle");
            if (refTog) refTog.checked = referenceVisible;
          }

          referenceCels = new Array(totalFrames).fill(null);

          // Handle Legacy (single image)
          if (data.referenceDataUrl) {
             const img = new Image();
             img.onload = () => { referenceCels[0] = img; try{renderAll();}catch{} };
             img.src = data.referenceDataUrl;
          }

          // Handle New (timeline map)
          if (data.referenceLayerMap) {
            for (const [fIndex, val] of Object.entries(data.referenceLayerMap)) {
              const idx = parseInt(fIndex, 10);
              if (idx < 0 || idx >= totalFrames) continue;

              if (val === "EMPTY") {
                referenceCels[idx] = { empty: true };
              } else {
                const img = new Image();
                img.onload = () => { 
                  referenceCels[idx] = img; 
                  if (currentFrame === idx) try{renderAll();}catch{} 
                };
                img.src = val;
              }
            }
          }

          if (data.oklchDefault && typeof data.oklchDefault === "object") {
            const L = clamp(parseFloat(data.oklchDefault.L) || 0, 0, 100);
            const C = clamp(parseFloat(data.oklchDefault.C) || 0, 0, 1);
            const H = clamp(parseFloat(data.oklchDefault.H) || 0, 0, 360);
            oklchDefault = { L, C, H };
          }

          // restore layer color memory
          if (Array.isArray(data.layerColors)) {
            for (let i = 0; i < LAYERS_COUNT; i++) {
              const v = data.layerColors[i];
              if (typeof v === "string" && v.trim()) layerColorMem[i] = v.trim();
            }
          }
          layerColorMem[LAYER.FILL] = fillWhite;

          // restore active layer / active swatches
          if (Number.isFinite(data.activeLayer)) activeLayer = clamp(data.activeLayer, 0, LAYERS_COUNT - 1);
          if (Array.isArray(data.activeSubColor)) {
            for (let i = 0; i < LAYERS_COUNT; i++) {
              if (typeof data.activeSubColor[i] === "string") activeSubColor[i] = data.activeSubColor[i];
            }
          }

          // ✅ rebuild layers with the FULL shape your app expects
          layers = new Array(LAYERS_COUNT).fill(0).map(() => ({
            name: "",
            opacity: 1,
            prevOpacity: 1,
            clipToBelow: false,
            frames: new Array(totalFrames).fill(null), // legacy compat
            suborder: [],
            sublayers: new Map(),
          }));

          layers[LAYER.LINE].name  = "LINE";
          layers[LAYER.SHADE].name = "SHADE";
          layers[LAYER.COLOR].name = "COLOR";
          layers[LAYER.FILL].name  = "FILL";

          // timeline UI refresh early (but guard it)
          try { if (hasTimeline && typeof buildTimeline === "function") buildTimeline(); } catch {}
          try { resizeCanvases?.(); } catch {}

          // helper: ensure sublayer exists WITHOUT letting ensureSublayer push duplicates
          function ensureSubForLoad(layerIndex, key){
            const lay = layers[layerIndex];
            if (!lay.sublayers) lay.sublayers = new Map();
            let sub = lay.sublayers.get(key);
            if (!sub){
              sub = { color: key, frames: new Array(totalFrames).fill(null) };
              lay.sublayers.set(key, sub);
            } else if (!Array.isArray(sub.frames) || sub.frames.length !== totalFrames){
              sub.frames = new Array(totalFrames).fill(null);
            }
            return sub;
          }

          function loadImgIntoCanvas(url, canvas){
            return new Promise((resolve) => {
              const img = new Image();
              img.decoding = "async";
              img.onload = () => {
                try {
                  const ctx = canvas.getContext("2d");
                  ctx.setTransform(1,0,0,1,0,0);
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

          // load drawings
          const srcLayers = Array.isArray(data.layers) ? data.layers : [];

          for (let layerIndex = 0; layerIndex < Math.min(LAYERS_COUNT, srcLayers.length); layerIndex++){
            const src = srcLayers[layerIndex];
            const lay = layers[layerIndex];
            if (!lay || !src) continue;

            lay.opacity = (typeof src.opacity === "number") ? clamp(src.opacity, 0, 1) : 1;
            lay.prevOpacity = lay.opacity;
            if ("clipToBelow" in src) lay.clipToBelow = !!src.clipToBelow;
            if (typeof src.name === "string" && src.name.trim()) lay.name = src.name.trim();

            // v2 format
            if (src.sublayers && typeof src.sublayers === "object") {
              const subsObj = src.sublayers;
              const rawKeys = (Array.isArray(src.suborder) && src.suborder.length)
                ? src.suborder.slice()
                : Object.keys(subsObj);

              // normalize keys
              const keys = rawKeys.map((rk) => (typeof resolveKeyFor === "function") ? resolveKeyFor(layerIndex, rk) : colorToHex(rk));
              lay.suborder = uniqStable(keys);

              // create all subs first so getFrameCanvas doesn't push duplicates
              for (const key of lay.suborder) ensureSubForLoad(layerIndex, key);

              for (let ki = 0; ki < rawKeys.length; ki++){
                const rawKey = rawKeys[ki];
                const key = keys[ki];
                const subSrc = subsObj[rawKey];
                const mapping = subSrc?.frames || {};
                const sub = ensureSubForLoad(layerIndex, key);

                for (const k in mapping){
                  const url = mapping[k];
                  if (!url) continue;

                  const fi = clamp(parseInt(k, 10), 0, totalFrames - 1);

                  // make canvas for this frame
                  const off = document.createElement("canvas");
                  off.width = contentW;
                  off.height = contentH;
                  off._hasContent = false;
                  sub.frames[fi] = off;

                  tasks.push(
                    loadImgIntoCanvas(url, off).then(() => {
                      try { if (hasTimeline && typeof updateTimelineHasContent === "function") updateTimelineHasContent(fi); } catch {}
                    })
                  );
                }
              }

              continue;
            }

            // legacy fallback: src.frames mapping
            if (src.frames && typeof src.frames === "object") {
              const key = (layerIndex === LAYER.FILL)
                ? fillWhite
                : (activeSubColor?.[layerIndex] || layerColorMem?.[layerIndex] || colorToHex(currentColor));

              lay.suborder = [key];
              const sub = ensureSubForLoad(layerIndex, key);

              for (const k in src.frames){
                const url = src.frames[k];
                if (!url) continue;

                const fi = clamp(parseInt(k, 10), 0, totalFrames - 1);

                const off = document.createElement("canvas");
                off.width = contentW;
                off.height = contentH;
                off._hasContent = false;
                sub.frames[fi] = off;

                tasks.push(
                  loadImgIntoCanvas(url, off).then(() => {
                    try { if (hasTimeline && typeof updateTimelineHasContent === "function") updateTimelineHasContent(fi); } catch {}
                  })
                );
              }
            }
          }

          // wait for all images
          await Promise.all(tasks);

          // ✅ ensure activeSubColor points to an existing key
          for (let L = 0; L < LAYERS_COUNT; L++){
            const lay = layers[L];
            if (!lay) continue;

            if (!lay.suborder) lay.suborder = [];
            if (!lay.sublayers) lay.sublayers = new Map();

            const cur = activeSubColor?.[L];
            if (cur && lay.sublayers.has(cur)) continue;

            // fallback: last swatch, else defaults
            activeSubColor[L] = lay.suborder[lay.suborder.length - 1] || (L === LAYER.FILL ? fillWhite : "#000000");
          }

          // refresh timeline + UI
          try {
            if (hasTimeline && typeof updateTimelineHasContent === "function") {
              for (let f = 0; f < totalFrames; f++) updateTimelineHasContent(f);
            }
          } catch {}

          try { for (let L = 0; L < LAYERS_COUNT; L++) renderLayerSwatches?.(L); } catch {}
          try { renderAll?.(); } catch {}
          try { updateHUD?.(); } catch {}

          // reflect UI controls (keep your existing UI assignments)
          safeSetValue(brushSizeInput, brushSize);
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

          // sync currentColor to active layer swatch
          if (activeLayer !== PAPER_LAYER && activeLayer !== LAYER.FILL) {
            const k = activeSubColor?.[activeLayer];
            if (typeof k === "string" && k) currentColor = k;
          }

          try { applyOklchDefaultToPicker?.(); } catch {}
          try { setColorSwatch?.(); } catch {}
          try { setHSVPreviewBox?.(); } catch {}
          try { setPickerToColorString?.(currentColor); } catch {}

          try { centerView?.(); } catch {}
          try { updateHUD?.(); } catch {}
          try { if (typeof gotoFrame === "function") gotoFrame(currentFrame); } catch {}
        })().catch((err) => {
          console.warn("[celstomp] loadProject failed:", err);
          alert("Failed to load project:\n" + (err?.message || String(err)));
        });
      };

      fr.readAsText(file);
    }


    // TIMELINE_MOBILE_DRAWERS (unique anchor)

    (() => {
      function boot(){
        const tl = document.getElementById("timeline");
        const header = document.getElementById("timelineHeader");
        const leftBtn = document.getElementById("tlMobLeftBtn");
        const rightBtn = document.getElementById("tlMobRightBtn");

        if (!tl || !header || !leftBtn || !rightBtn) return;

        // prevent double-wiring (your file runs a lot of init)
        if (tl._mobDrawerWired) return;
        tl._mobDrawerWired = true;

        const mq = window.matchMedia("(max-width: 720px)");
        const isMobile = () => mq.matches;

        // help mobile taps (doesn't hurt desktop)
        try { leftBtn.style.touchAction = "manipulation"; } catch {}
        try { rightBtn.style.touchAction = "manipulation"; } catch {}

        let lastToggleAt = 0;
        const toggleOnce = (fn) => {
          const t = performance.now();
          if (t - lastToggleAt < 250) return; // blocks synthetic click after pointer/touch
          lastToggleAt = t;
          fn();
        };

        const syncAria = () => {
          leftBtn.setAttribute("aria-expanded", tl.classList.contains("mob-left-open") ? "true" : "false");
          rightBtn.setAttribute("aria-expanded", tl.classList.contains("mob-right-open") ? "true" : "false");
        };

        const closeAll = () => {
          tl.classList.remove("mob-left-open", "mob-right-open");
          syncAria();
        };

        function openLeft(){
          if (!isMobile()) return;
          tl.classList.toggle("mob-left-open", !tl.classList.contains("mob-left-open"));
          tl.classList.remove("mob-right-open");
          syncAria();
        }

        function openRight(){
          if (!isMobile()) return;
          tl.classList.toggle("mob-right-open", !tl.classList.contains("mob-right-open"));
          tl.classList.remove("mob-left-open");
          syncAria();
        }

        function wireBtn(btn, fn){
          const fire = (e) => {
            if (!isMobile()) return;
            e.preventDefault();
            e.stopPropagation();
            toggleOnce(fn);
          };

          // support iOS/Safari + Chromium
          btn.addEventListener("pointerdown", fire, { capture: true, passive: false });
          btn.addEventListener("touchstart",  fire, { capture: true, passive: false });

          // desktop fallback
          btn.addEventListener("click", (e) => {
            if (!isMobile()) return;
            e.preventDefault();
            e.stopPropagation();
            toggleOnce(fn);
          }, { passive: false });
        }

        wireBtn(leftBtn, openLeft);
        wireBtn(rightBtn, openRight);

        // tap outside closes drawers (capture so it works even if things stop bubbling)
        const outsideClose = (e) => {
          if (!isMobile()) return;

          const t = e.target;
          if (tl.contains(t) || header.contains(t) || leftBtn.contains(t) || rightBtn.contains(t)) return;

          closeAll();
        };

        document.addEventListener("pointerdown", outsideClose, { capture: true, passive: true });
        document.addEventListener("touchstart",  outsideClose, { capture: true, passive: true });

        // leaving mobile closes drawers
        const onMqChange = () => closeAll();
        if (mq.addEventListener) mq.addEventListener("change", onMqChange);
        else if (mq.addListener) mq.addListener(onMqChange);

        syncAria();
      }

      // IMPORTANT: works whether this code runs before OR after DOMContentLoaded
      if (document.readyState === "loading") {
        window.addEventListener("DOMContentLoaded", boot, { once: true });
      } else {
        boot();
      }
    })();


    // MOBILE_ISLAND_TOGGLE_WIRE (unique anchor)
    (() => {
      const btn = document.getElementById("mobileIslandToggle");
      const app = document.querySelector(".app"); // this is the element that has rightbar-open
      if (!btn || !app) return;

      function toggleIsland(){
        app.classList.toggle("rightbar-open");
      }

      // Use pointerdown so it works instantly on mobile; also stop it from starting strokes.
      btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleIsland();
      }, { passive: false });

      // (Optional) reflect state
      const obs = new MutationObserver(() => {
        btn.textContent = app.classList.contains("rightbar-open") ? "✕" : "☰";
      });
      obs.observe(app, { attributes: true, attributeFilter: ["class"] });
    })();


    // TIMELINE_ONION_CTX (unique anchor)
    function initTimelineOnionContextMenu(){
      const onionBtn = document.getElementById("tlOnion");
      const menu = document.getElementById("onionCtxMenu");
      const block = document.getElementById("onionOptionsBlock");
      if (!onionBtn || !menu || !block) return;

      if (menu._wired) return;
      menu._wired = true;

      // Remember original home so we can put the block back
      const homeParent = block.parentNode;
      const homeNext = block.nextSibling;

      function placeMenu(x, y){
        // open first (so it has size), then clamp into viewport
        menu.style.left = x + "px";
        menu.style.top  = y + "px";

        const r = menu.getBoundingClientRect();
        const pad = 8;

        let nx = x, ny = y;
        if (r.right > window.innerWidth - pad) nx -= (r.right - (window.innerWidth - pad));
        if (r.bottom > window.innerHeight - pad) ny -= (r.bottom - (window.innerHeight - pad));
        if (nx < pad) nx = pad;
        if (ny < pad) ny = pad;

        menu.style.left = nx + "px";
        menu.style.top  = ny + "px";
      }

      function openAt(x, y){
        // move the real controls into the menu (keeps existing listeners!)
        menu.innerHTML = "";
        menu.appendChild(block);

        menu.classList.add("open");
        menu.setAttribute("aria-hidden", "false");

        // position after it’s visible
        placeMenu(x, y);
      }

      function close(){
        if (!menu.classList.contains("open")) return;

        // put the block back exactly where it came from
        if (homeParent){
          if (homeNext && homeNext.parentNode === homeParent) homeParent.insertBefore(block, homeNext);
          else homeParent.appendChild(block);
        }

        menu.classList.remove("open");
        menu.setAttribute("aria-hidden", "true");
        menu.style.left = "";
        menu.style.top = "";
      }

      onionBtn.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        openAt(e.clientX, e.clientY);
      }, { passive: false });

      // Close rules
      window.addEventListener("pointerdown", (e) => {
        if (!menu.classList.contains("open")) return;
        if (e.target === menu || menu.contains(e.target)) return;
        close();
      }, { passive: true });

      window.addEventListener("keydown", (e) => {
        if (e.key === "Escape") close();
      });

      window.addEventListener("resize", close, { passive: true });
      window.addEventListener("scroll", close, { passive: true, capture: true });
    }


    // MOBILE_TIMELINE_SCRUB (unique anchor)
    function initMobileTimelineScrub(){
      const row =
        document.getElementById("tlPlayheadRow") ||
        document.querySelector(".playheadRow") ||
        document.querySelector("[data-playhead-row]");

      if (!row || row._mobileScrubWired) return;
      row._mobileScrubWired = true;

      // Try to find the scrollable timeline viewport (if any)
      function findScroller(el){
        // closest common candidates first
        const cand =
          el.closest("#timelineViewport") ||
          el.closest("#timelineScroll") ||
          el.closest(".timelineViewport") ||
          el.closest(".timelineScroll") ||
          el.closest(".tlViewport") ||
          el.closest(".tlScroll");
        if (cand) return cand;

        // fallback: walk up to find something scrollable horizontally
        let p = el.parentElement;
        while (p && p !== document.body){
          const cs = getComputedStyle(p);
          if ((cs.overflowX === "auto" || cs.overflowX === "scroll") && p.scrollWidth > p.clientWidth) return p;
          p = p.parentElement;
        }
        return null;
      }

      const scroller = findScroller(row);

      // Determine "pixels per frame"
      function getFrameW(){
        // Prefer CSS var if you have one
        const v = parseFloat(getComputedStyle(row).getPropertyValue("--tl-frame-w"));
        if (Number.isFinite(v) && v > 0) return v;

        // Else measure a typical frame cell if it exists
        const cell = row.querySelector(".frameCell, .tlCell, [data-frame-cell]");
        if (cell){
          const r = cell.getBoundingClientRect();
          if (r.width > 0) return r.width;
        }

        // Fallback
        return 16;
      }

      // Plug into your existing playhead setter / state
      function applyScrubFrame(frame){
        frame = Math.max(0, frame | 0);

        // Prefer existing functions if your app has them
        if (typeof window.setCurrentFrame === "function") { window.setCurrentFrame(frame); return; }
        if (typeof window.setPlayheadFrame === "function") { window.setPlayheadFrame(frame); return; }
        if (typeof window.gotoFrame === "function")       { window.gotoFrame(frame); return; }
        if (typeof window.setFrame === "function")        { window.setFrame(frame); return; }

        // Fallback: poke common state fields
        if (window.state && typeof window.state === "object"){
          if ("frame" in window.state) window.state.frame = frame;
          else if ("playhead" in window.state) window.state.playhead = frame;
          else if ("curFrame" in window.state) window.state.curFrame = frame;
        }

        // Re-render fallback
        if (typeof window.renderAll === "function") window.renderAll();
        else if (typeof window.renderTimeline === "function") window.renderTimeline();
      }

      function scrubAtClientX(clientX){
        const r = row.getBoundingClientRect();
        const frameW = getFrameW();

        // x within row box
        let x = clientX - r.left;

        // include scroll position if the timeline content scrolls
        const scrollX = scroller ? scroller.scrollLeft : 0;
        const xInContent = x + scrollX;

        const frame = Math.floor(xInContent / frameW);
        applyScrubFrame(frame);
      }

      let active = false;
      let activeId = -1;

      row.addEventListener("pointerdown", (e) => {
        // Mobile/touch only
        if (e.pointerType !== "touch") return;
        if (!e.isPrimary) return;

        active = true;
        activeId = e.pointerId;

        // IMPORTANT: stop this gesture from becoming a draw stroke / scroll
        e.preventDefault();
        e.stopPropagation();

        try { row.setPointerCapture(activeId); } catch {}

        scrubAtClientX(e.clientX);
      }, { passive: false });

      row.addEventListener("pointermove", (e) => {
        if (!active || e.pointerId !== activeId) return;
        e.preventDefault();
        e.stopPropagation();
        scrubAtClientX(e.clientX);
      }, { passive: false });

      function end(e){
        if (!active || e.pointerId !== activeId) return;
        e.preventDefault();
        e.stopPropagation();
        active = false;
        activeId = -1;
      }

      row.addEventListener("pointerup", end, { passive: false });
      row.addEventListener("pointercancel", end, { passive: false });
    }

    // Call it once during your boot/init
    // MOBILE_TIMELINE_SCRUB_CALL (unique anchor)
    try { initMobileTimelineScrub(); } catch {}

    // TIMELINE_TOGGLE_BRIDGE (unique anchor)
    function initTimelineToggleBridge(){
      const tlOnion = document.getElementById("tlOnion");
      const btnOnion = document.getElementById("toggleOnion");
      const btnTrans = document.getElementById("toggleTransparency"); // optional if you still use it

      if (!tlOnion) return;

      // helper: infer current state from button text like "Onion: Off"
      const btnIsOn = (btn) => {
        if (!btn) return null;
        const t = (btn.textContent || "").toLowerCase();
        if (t.includes("off")) return false;
        if (t.includes("on")) return true;
        return null;
      };

      // keep checkbox in sync with the app's onion button (if it exists)
      function syncOnionFromButton(){
        const s = btnIsOn(btnOnion);
        if (s === null) return;
        tlOnion.checked = s;
      }

      // When user changes checkbox, click the real app toggle if needed
      tlOnion.addEventListener("change", () => {
        if (!btnOnion) return; // if missing, your app needs a real onion toggle function instead
        const cur = btnIsOn(btnOnion);
        const want = !!tlOnion.checked;
        if (cur === null || cur !== want) btnOnion.click();
        syncOnionFromButton();
      });

      // If user clicks the app button somewhere else, sync checkbox
      if (btnOnion){
        btnOnion.addEventListener("click", () => {
          // let the app update its state first, then sync
          setTimeout(syncOnionFromButton, 0);
        });
        // initial sync
        syncOnionFromButton();
      }
    }

    // boot
    (() => {
      const boot = () => { try { initTimelineOnionContextMenu(); } catch {} };
      if (document.readyState === "loading") window.addEventListener("DOMContentLoaded", boot, { once: true });
      else boot();

      initTimelineToggleBridge();

      // TRANSPARENCY_INIT (unique anchor)
      if (document.readyState === "loading") {
        window.addEventListener("DOMContentLoaded", initTransparencyControls, { once: true });
      } else {
        initTransparencyControls();
      }
      
    })();


    

    /* =========================================================
      MOBILE TOUCH INPUT
      - 1 finger: draw (simulates mouse events)
      - 2 fingers: pan + pinch zoom (blocks drawing)
      - 1 finger on island header: drag island
      ========================================================= */




    // MOBILE_DRAW_POINTER (unique anchor)
    // 1 finger: draw (dispatch mouse events)
    // 2 fingers: pinch zoom the CAMERA (zoom/offsetX/offsetY)
    function wirePointerDrawingOnCanvas(drawCanvas){
      if (!drawCanvas) return;

      // ✅ Global single-wire so you don't get double listeners (fixes “duplicate swatches” too)
      if (window.__CELSTOMP_PTR_DRAW_WIRED__) return;
      window.__CELSTOMP_PTR_DRAW_WIRED__ = true;

      const stageViewport =
        document.getElementById("stageViewport") ||
        document.getElementById("stage") ||
        drawCanvas;

      // stop browser gestures/scroll stealing touches on the stage/canvas
      try { stageViewport.style.touchAction = "none"; } catch {}
      try { drawCanvas.style.touchAction = "none"; } catch {}

      drawCanvas.addEventListener("contextmenu", (e) => e.preventDefault());

      // Only start strokes if the DOWN started on a canvas (don’t steal UI taps)
      const isCanvasDownTarget = (t) => !!(t && (t.tagName === "CANVAS" || t.closest?.("canvas")));

      const getToolName = () => String((typeof tool !== "undefined" && tool) ? tool : "");

      function dispatchMouseOn(target, type, x, y, buttons){
        try {
          target.dispatchEvent(new MouseEvent(type, {
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y,
            buttons: buttons || 0,
            button: 0
          }));
        } catch {}
      }

      // Send DOWN to canvas. MOVE/UP to both canvas+window (safe for apps that listen on either).
      function mouseDown(x,y){ dispatchMouseOn(drawCanvas, "mousedown", x,y, 1); }
      function mouseMove(x,y){
        dispatchMouseOn(drawCanvas, "mousemove", x,y, 1);
        dispatchMouseOn(window,     "mousemove", x,y, 1);
      }
      function mouseUp(x,y){
        dispatchMouseOn(drawCanvas, "mouseup", x,y, 0);
        dispatchMouseOn(window,     "mouseup", x,y, 0);
      }

      let activeDrawPid = null;

      function startDraw(pid, x, y){
        if (activeDrawPid != null) return;
        activeDrawPid = pid;
        mouseDown(x, y);
      }
      function moveDraw(pid, x, y){
        if (activeDrawPid !== pid) return;
        mouseMove(x, y);
      }
      function endDraw(pid, x, y){
        if (activeDrawPid !== pid) return;
        mouseUp(x, y);
        activeDrawPid = null;
      }

      // --- pinch state (CAMERA zoom) ---
      const touches = new Map(); // pointerId -> {x,y}
      let pinch = null;
      let lockUntilAllUp = false;

      // delay stroke slightly to avoid “pinch dot” for normal brush/eraser
      let pending = null;
      const START_DELAY_MS = 70;
      const START_MOVE_PX  = 4;

      // ✅ Tools that MUST start immediately (no delay)
      const IMMEDIATE_TOOLS = new Set([
        "fill-brush",
        "fill-eraser",
        "lasso-fill",
        "lasso-erase",
      ]);

      const VIEW_MIN = 0.05;
      const VIEW_MAX = 16;
      const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));

      function clientToCanvasLocal(clientX, clientY){
        const rect = drawCanvas.getBoundingClientRect();
        return { x: clientX - rect.left, y: clientY - rect.top };
      }

      function cancelPending(){
        if (!pending) return;
        clearTimeout(pending.tmr);
        pending = null;
      }

      function stopStrokeNow(x,y){
        cancelPending();
        if (activeDrawPid != null) endDraw(activeDrawPid, x ?? 0, y ?? 0);
      }

      function beginPinch(){
        if (touches.size < 2) return;

        stopStrokeNow();

        const ids = Array.from(touches.keys()).slice(0, 2);
        const a = touches.get(ids[0]);
        const b = touches.get(ids[1]);
        if (!a || !b) return;

        const startDist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));

        const mid = { x:(a.x + b.x)/2, y:(a.y + b.y)/2 };
        const midLocal = clientToCanvasLocal(mid.x, mid.y);

        const anchorContent = screenToContent(midLocal.x, midLocal.y);

        pinch = {
          ids,
          startDist,
          startZoom: zoom,
          anchorContent,
        };

        window.__celstompPinching = true;
      }

      function updatePinch(){
        if (!pinch) return;

        const a = touches.get(pinch.ids[0]);
        const b = touches.get(pinch.ids[1]);
        if (!a || !b) return;

        const curDist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
        const ratio = curDist / (pinch.startDist || 1);

        const nextZoom = clamp(pinch.startZoom * ratio, VIEW_MIN, VIEW_MAX);

        const mid = { x:(a.x + b.x)/2, y:(a.y + b.y)/2 };
        const midLocal = clientToCanvasLocal(mid.x, mid.y);

        zoom = nextZoom;

        const devX = midLocal.x * dpr;
        const devY = midLocal.y * dpr;

        offsetX = devX - pinch.anchorContent.x * (zoom * dpr);
        offsetY = devY - pinch.anchorContent.y * (zoom * dpr);

        renderAll();
        updateHUD();
        updatePlayheadMarker();
        updateClipMarkers();
        clearFx();
      }

      stageViewport.addEventListener("pointerdown", (e) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;

        // Only START drawing if the DOWN began on canvas
        if (!isCanvasDownTarget(e.target)) return;

        if (e.pointerType === "touch"){
          touches.set(e.pointerId, { x:e.clientX, y:e.clientY });

          // 2nd finger => pinch mode immediately
          if (touches.size >= 2){
            lockUntilAllUp = true;
            stopStrokeNow(e.clientX, e.clientY);

            e.preventDefault();
            e.stopPropagation();

            try { stageViewport.setPointerCapture(e.pointerId); } catch {}
            beginPinch();
            updatePinch();
            return;
          }

          if (lockUntilAllUp) return;

          e.preventDefault();
          e.stopPropagation();

          const pid = e.pointerId;
          try { stageViewport.setPointerCapture(pid); } catch {}

          // ✅ IMMEDIATE_TOOLS must still MOVE (previous code returned too early)
          const tTool = String((typeof tool !== "undefined" && tool) ? tool : "");

  

          if (IMMEDIATE_TOOLS.has(tTool)) {
            e.preventDefault();

            // If the stroke hasn't started yet, start it now…
            if (activeDrawPid == null) {
              startDraw(e.pointerId, e.clientX, e.clientY);
              if (tapTrack && tapTrack.pid === e.pointerId) tapTrack.startedStroke = true;
            }

            // …but ALWAYS move so it drags like a brush ✅
            moveDraw(e.pointerId, e.clientX, e.clientY);
            return;
          }

          // normal brush/eraser: delayed start to avoid pinch-dot
          const x0 = e.clientX, y0 = e.clientY;
          pending = {
            pid, x0, y0,
            tmr: setTimeout(() => {
              if (!pending) return;
              if (touches.size === 1 && touches.has(pid) && !lockUntilAllUp){
                startDraw(pid, x0, y0);
              }
              pending = null;
            }, START_DELAY_MS)
          };
          return;
        }

        // pen/mouse: draw immediately
        e.preventDefault();
        startDraw(e.pointerId, e.clientX, e.clientY);
      }, { capture:true, passive:false });

      stageViewport.addEventListener("pointermove", (e) => {
        if (e.pointerType === "touch"){
          if (touches.has(e.pointerId)){
            touches.set(e.pointerId, { x:e.clientX, y:e.clientY });
          }

          // pinch updates
          if (pinch && touches.size >= 2){
            e.preventDefault();
            e.stopPropagation();
            updatePinch();
            return;
          }

          if (lockUntilAllUp) return;


          // ✅ Always move the active stroke (works for fill/lasso too)
          const tTool = getToolName();

          // For delayed tools: start early if user moves enough
          if (pending && e.pointerId === pending.pid && touches.size === 1) {
            const dx = e.clientX - pending.x0;
            const dy = e.clientY - pending.y0;
            if (Math.hypot(dx, dy) >= START_MOVE_PX) {
              clearTimeout(pending.tmr);
              const pid = pending.pid;
              const sx = pending.x0, sy = pending.y0;
              pending = null;
              startDraw(pid, sx, sy);
            }
          }

          // For IMMEDIATE_TOOLS: if somehow not started yet, start now
          if (activeDrawPid == null && IMMEDIATE_TOOLS.has(tTool) && touches.size === 1) {
            startDraw(e.pointerId, e.clientX, e.clientY);
          }

          // ALWAYS move (pointer capture means target may not be canvas)
          moveDraw(e.pointerId, e.clientX, e.clientY);

          e.preventDefault();
          e.stopPropagation();
          return;


          // start early if user moves enough (for normal tools)
          if (pending && e.pointerId === pending.pid && touches.size === 1){
            const dx = e.clientX - pending.x0;
            const dy = e.clientY - pending.y0;
            if (Math.hypot(dx,dy) >= START_MOVE_PX){
              clearTimeout(pending.tmr);
              const pid = pending.pid;
              const sx = pending.x0, sy = pending.y0;
              pending = null;
              startDraw(pid, sx, sy);
            }
          }

          // ✅ IMPORTANT: keep moving even if finger leaves the canvas
          // (pointer capture means we should NOT depend on e.target being canvas)
          moveDraw(e.pointerId, e.clientX, e.clientY);

          e.preventDefault();
          e.stopPropagation();
          return;
        }

        // pen/mouse
        moveDraw(e.pointerId, e.clientX, e.clientY);
      }, { capture:true, passive:false });

      function endPointer(e){

          

        if (e.pointerType === "touch"){
          touches.delete(e.pointerId);

          if (pending && pending.pid === e.pointerId) cancelPending();
          if (activeDrawPid === e.pointerId) endDraw(e.pointerId, e.clientX, e.clientY);

          if (touches.size < 2) pinch = null;

          if (touches.size === 0){
            lockUntilAllUp = false;
            pinch = null;
            window.__celstompPinching = false;
          }

          try { stageViewport.releasePointerCapture(e.pointerId); } catch {}

          e.preventDefault();
          e.stopPropagation();
          return;
        }

        if (activeDrawPid === e.pointerId){
          e.preventDefault();
          endDraw(e.pointerId, e.clientX, e.clientY);
        }
      }

      stageViewport.addEventListener("pointerup", endPointer, { capture:true, passive:false });
      stageViewport.addEventListener("pointercancel", endPointer, { capture:true, passive:false });
    }

function initReferenceTimelineInteraction() {
      const scroll = document.getElementById("timelineScroll");

      function getFrameFromX(x) {
        const playRow = document.querySelector("tr.playhead-row");
        if (!playRow) return 0;
        const rect = playRow.getBoundingClientRect();
        const firstCell = playRow.children[1];
        const cellW = firstCell ? firstCell.getBoundingClientRect().width : 24; 
        const headerW = playRow.children[0].offsetWidth;
        const scrollLeft = scroll.scrollLeft;
        const contentX = x - rect.left - headerW + scrollLeft;
        return Math.floor(contentX / cellW);
      }

      function getCellWidthPx() {
        const playRow = document.querySelector("tr.playhead-row");
        const c = playRow?.children[1];
        return c ? c.getBoundingClientRect().width : 24;
      }

      scroll.addEventListener("pointerdown", (e) => {
        const handle = e.target.closest(".ref-handle");
        const block = e.target.closest(".ref-block");

        if (!block) return; 

        e.preventDefault();
        e.stopPropagation();

        const startIdx = parseInt(block.dataset.startIndex, 10);
        const span = parseInt(block.dataset.span, 10);
        const clickFrame = getFrameFromX(e.clientX);

        let mode = "move";
        if (handle) {
          mode = handle.dataset.action === "resize-left" ? "left" : "right";
        }

        refDragState = {
          mode,
          originalStart: startIdx,
          originalSpan: span,
          clickFrame: clickFrame,
          refItem: referenceCels[startIdx],
          domElement: block,
          cellW: getCellWidthPx()
        };

        block.classList.add("dragging");
        try { scroll.setPointerCapture(e.pointerId); } catch {}
      });

      scroll.addEventListener("pointermove", (e) => {
        if (!refDragState) return;
        e.preventDefault();

        const curFrame = clamp(getFrameFromX(e.clientX), 0, totalFrames - 1);
        const delta = curFrame - refDragState.clickFrame;
        const { mode, originalSpan, cellW, domElement } = refDragState;

        if (mode === "move") {
          domElement.style.transform = `translateX(${delta * cellW}px)`;
        } 
        else if (mode === "right") {
          const newSpan = Math.max(1, originalSpan + delta);
          domElement.style.width = `calc(${newSpan} * ${cellW}px - 1px)`;
        } 
        else if (mode === "left") {
          const validDelta = Math.min(delta, originalSpan - 1);
          const newSpan = originalSpan - validDelta;

          domElement.style.transform = `translateX(${validDelta * cellW}px)`;
          domElement.style.width = `calc(${newSpan} * ${cellW}px - 1px)`;
        }
      });

      scroll.addEventListener("pointerup", (e) => {
        if (!refDragState) return;

        const curFrame = clamp(getFrameFromX(e.clientX), 0, totalFrames - 1);
        const delta = curFrame - refDragState.clickFrame;
        const { mode, originalStart, originalSpan, refItem, domElement } = refDragState;

        domElement.style.transform = "";
        domElement.classList.remove("dragging");
        try { scroll.releasePointerCapture(e.pointerId); } catch {}

        if (delta !== 0) {
          let newStart = originalStart;
          let oldEndIdx = originalStart + originalSpan; 
          let newEndIdx = oldEndIdx;

          if (mode === "move") {
            newStart = clamp(originalStart + delta, 0, totalFrames - 1);
            newEndIdx = Math.min(newStart + originalSpan, totalFrames);
          } 
          else if (mode === "left") {
            newStart = clamp(originalStart + delta, 0, oldEndIdx - 1);
            newEndIdx = oldEndIdx; 
          } 
          else if (mode === "right") {
            newStart = originalStart;
            const requestedEnd = originalStart + originalSpan + delta;
            newEndIdx = clamp(requestedEnd, newStart + 1, totalFrames);
          }

          if (newStart !== originalStart && referenceCels[originalStart] === refItem) {
            referenceCels[originalStart] = null; 
          }

          referenceCels[newStart] = refItem;

          for (let i = newStart + 1; i < newEndIdx; i++) {
            if (i < totalFrames && !(referenceCels[i] instanceof HTMLImageElement)) {
              referenceCels[i] = null;
            }
          }

          if (newEndIdx < totalFrames) {
            const existing = referenceCels[newEndIdx];
            if (existing === null || existing.empty) {
              referenceCels[newEndIdx] = { empty: true };
            }
          }
        }

        refDragState = null;
        if (typeof buildTimeline === "function") buildTimeline();
        renderAll();
      });
    }

    // -------------------------
    // Timeline header mini-controls wiring (if you have them)
    // -------------------------
    function wireTimelineHeaderControls() {
      if (!$("timelineHeader")) return;

      const prevF = $("tlPrevFrame");
      const nextF = $("tlNextFrame");
      const prevC = $("tlPrevCel");
      const nextC = $("tlNextCel");
      const toggle = $("tlPlayToggle");
      const onion = $("tlOnion");
      const dup = $("tlDupCel");
      const snap = $("tlSnap");
      const secs = $("tlSeconds");
      const fpsInp = $("tlFps");
      const psnap = $("tlPlaySnapped");

      // init values
      safeSetValue(snap, snapFrames);
      safeSetValue(secs, seconds);
      safeSetValue(fpsInp, fps);
      safeSetChecked(onion, onionEnabled);
      safeSetChecked(psnap, playSnapped);

      toggle?.addEventListener("click", () => {
        if (isPlaying) pausePlayback();
        else startPlayback();
      });

      prevF?.addEventListener("click", () => gotoFrame(stepBySnap(-1)));
      nextF?.addEventListener("click", () => gotoFrame(stepBySnap(1)));

      prevC?.addEventListener("click", gotoPrevCel);
      nextC?.addEventListener("click", gotoNextCel);

      onion?.addEventListener("change", (e) => {
        const now = !!e.target.checked;
        if (now !== onionEnabled) toggleOnionBtn?.click();
      });

      dup?.addEventListener("click", onDuplicateCel);

      snap?.addEventListener("input", (e) => {
        const v = Math.max(1, parseInt(e.target.value || 1, 10) || 1);
        snapFrames = v;
        safeSetValue(snapValue, v);
        updateHUD();
      });

      function rebuildTimelineKeepFrame() {
        const cur = currentFrame;
        buildTimeline();
        gotoFrame(Math.min(cur, totalFrames - 1));
        updateHUD();
        updateClipMarkers();
      }

      secs?.addEventListener("change", (e) => {
        seconds = Math.max(1, parseInt(e.target.value || 1, 10) || 1);
        totalFrames = fps * seconds;
        safeText(secLabel, String(seconds));
        rebuildTimelineKeepFrame();
      });

      fpsInp?.addEventListener("change", (e) => {
        fps = Math.max(1, parseInt(e.target.value || 1, 10) || 1);
        totalFrames = fps * seconds;
        safeText(fpsLabel, String(fps));
        rebuildTimelineKeepFrame();
      });

      psnap?.addEventListener("change", (e) => {
        playSnapped = !!e.target.checked;
        safeSetChecked(playSnappedChk, playSnapped);
      });
    }

    // -------------------------
    // Color dock drag/minimize (optional)
    // -------------------------
    function dockDrag() {



    
      const dockToggle = $("dockToggleBtn");
      const dock = $("colorDock");
      const head = $("colorDockHeader");
      const btn = $("dockMinBtn");
      const body = $("colorDockBody");
      if (!dock || !head) return;

      function clampDockIntoView() {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const timelineH = nowCSSVarPx("--timeline-h", 190);
        const headerH = document.querySelector("header.top")?.offsetHeight || 48;

        const rect = dock.getBoundingClientRect();
        let nx = rect.left;
        let ny = rect.top;

        const minLeft = 0;
        const maxLeft = Math.max(0, vw - rect.width);
        const minTop = headerH + 8;
        const maxTop = Math.max(minTop, vh - timelineH - rect.height - 8);

        nx = clamp(nx, minLeft, maxLeft);
        ny = clamp(ny, minTop, maxTop);

        dock.style.left = nx + "px";
        dock.style.top = ny + "px";
        dock.style.right = "auto";
        dock.style.bottom = "auto";
      }

      

      function setDockedRight(on) {
        if (on) {
          dock.classList.add("docked-right");
          const headerH = document.querySelector("header.top")?.offsetHeight || 48;
          dock.style.top = headerH + 8 + "px";
          dock.style.right = "14px";
          dock.style.left = "auto";
          dock.style.bottom = "calc(var(--timeline-h) + 4px)";
        } else {
          dock.classList.remove("docked-right");
          clampDockIntoView();
        }
      }

      dockToggle?.addEventListener("click", () => {
        const on = !dock.classList.contains("docked-right");
        setDockedRight(on);
      });

      let dragging = false,
        sx = 0,
        sy = 0,
        ox = 0,
        oy = 0;

      head.addEventListener("mousedown", (e) => {

    

        if (dock.classList.contains("docked-right")) return;
        dragging = true;
        sx = e.clientX;
        sy = e.clientY;
        const r = dock.getBoundingClientRect();
        ox = r.left;
        oy = r.top;
        e.preventDefault();
      });

      window.addEventListener("mousemove", (e) => {




        if (!dragging) return;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const timelineH = nowCSSVarPx("--timeline-h", 190);
        const headerH = document.querySelector("header.top")?.offsetHeight || 48;

        let nx = ox + e.clientX - sx;
        let ny = oy + e.clientY - sy;

        const minLeft = 0;
        const maxLeft = Math.max(0, vw - dock.offsetWidth);
        const minTop = headerH + 8;
        const maxTop = Math.max(minTop, vh - timelineH - dock.offsetHeight - 8);

        nx = clamp(nx, minLeft, maxLeft);
        ny = clamp(ny, minTop, maxTop);

        dock.style.left = nx + "px";
        dock.style.top = ny + "px";
        dock.style.right = "auto";
        dock.style.bottom = "auto";
      });

      window.addEventListener("mouseup", () => { dragging = false; });




      btn?.addEventListener("click", () => {
        if (!body) return;
        body.style.display = body.style.display === "none" ? "" : "none";
      });

      window.addEventListener("resize", () => clampDockIntoView());
    }

    // -------------------------
    // Left/Right/Timeline panel toggles (optional)
    // -------------------------
    function wirePanelToggles() {
      const app = document.querySelector(".app");
      if (!app) return;

      const hideLeft = $("hideLeftPanelBtn");
      const hideRight = $("hideRightPanelBtn");
      const hideTl = $("hideTimelineBtn");

      const showLeft = $("showLeftEdge");
      const showRight = $("showRightEdge");
      const showTl = $("showTimelineEdge");

      const tLeft = $("toggleSidebarBtn");
      const tRight = $("toggleRightbarBtn");

      function applyLayoutChange() {
        setTimeout(() => {
          resizeCanvases();
          updatePlayheadMarker();
          updateClipMarkers();
          centerView();
        }, 120);
      }

      function setLeftOpen(open) {
        app.classList.toggle("sidebar-collapsed", !open);
        applyLayoutChange();
      }
      function setRightOpen(open) {
        app.classList.toggle("rightbar-collapsed", !open);
        app.classList.toggle("rightbar-open", open);
        applyLayoutChange();
      }
      function setTimelineOpen(open) {
        app.classList.toggle("tl-collapsed", !open);
        applyLayoutChange();
      }

      // Start with all visible (matching your pasted “overridden start state”)
      setLeftOpen(true);
      setRightOpen(true);
      setTimelineOpen(true);

      hideLeft?.addEventListener("click", () => setLeftOpen(false));
      hideRight?.addEventListener("click", () => setRightOpen(false));
      hideTl?.addEventListener("click", () => setTimelineOpen(false));

      showLeft?.addEventListener("click", () => setLeftOpen(true));
      showRight?.addEventListener("click", () => setRightOpen(true));
      showTl?.addEventListener("click", () => setTimelineOpen(true));

      tLeft?.addEventListener("click", () => setLeftOpen(app.classList.contains("sidebar-collapsed")));
      tRight?.addEventListener("click", () => setRightOpen(app.classList.contains("rightbar-collapsed")));
    }




    // ISLAND_RESIZE (unique anchor)
    function wireIslandResize(){
      const dock =
        document.querySelector(".islandDock") ||
        document.getElementById("floatingIsland");

      if (!dock || dock._islandResizeWired) return;
      dock._islandResizeWired = true;

      // create handle if missing
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

      // restore saved size/pos
      try {
        const saved = JSON.parse(localStorage.getItem(KEY) || "null");
        if (saved && Number.isFinite(saved.w) && Number.isFinite(saved.h)) {
          dock.style.width  = saved.w + "px";
          dock.style.height = saved.h + "px";
        }
        if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
          dock.style.left = saved.x + "px";
          dock.style.top  = saved.y + "px";
        }
      } catch {}

      let start = null;

      handle.addEventListener("pointerdown", (e) => {
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
          top: r.top,
        };

        dock.classList.add("resizing");
        try { handle.setPointerCapture(e.pointerId); } catch {}
      }, { passive: false });

      handle.addEventListener("pointermove", (e) => {
        if (!start || e.pointerId !== start.id) return;

        // clamp to viewport so you can't resize off-screen
        const maxW = window.innerWidth  - start.left - 8;
        const maxH = window.innerHeight - start.top  - 8;

        const w = clamp(start.w + (e.clientX - start.x), minW, Math.max(minW, maxW));
        const h = clamp(start.h + (e.clientY - start.y), minH, Math.max(minH, maxH));

        dock.style.width  = w + "px";
        dock.style.height = h + "px";
      });

      const end = (e) => {
        if (!start || e.pointerId !== start.id) return;

        try { handle.releasePointerCapture(start.id); } catch {}
        dock.classList.remove("resizing");

        // save
        try {
          const r = dock.getBoundingClientRect();
          localStorage.setItem(KEY, JSON.stringify({
            x: Math.round(r.left),
            y: Math.round(r.top),
            w: Math.round(r.width),
            h: Math.round(r.height),
          }));
        } catch {}

        start = null;
      };

      handle.addEventListener("pointerup", end);
      handle.addEventListener("pointercancel", end);
    }

    wireIslandResize();



    // -------------------------
    // UI wiring
    // -------------------------
    // Info overlay
    infoBtn?.addEventListener("click", () => {
      if (!infoPanel) return;
      infoPanel.style.display = infoPanel.style.display === "block" ? "none" : "block";
    });

    // Layer selection 
    const layerSeg = $("layerSeg");
    layerSeg?.addEventListener("change", () => {
      wireLayerVisButtons();

      
      // Save color for the layer you're leaving (not paper)
      if (activeLayer !== PAPER_LAYER) rememberCurrentColorForLayer(activeLayer);

      const val = document.querySelector('input[name="btype"]:checked')?.value || "line";

      if (val === "paper") {
        activeLayer = PAPER_LAYER;
        renderLayerSwatches();
        updateHUD();
        return;
      }

      activeLayer =
        val === "shade" ? LAYER.SHADE :
        val === "color" ? LAYER.COLOR :
        val === "fill"  ? LAYER.FILL  :
                          LAYER.LINE;


      // restore last selected sublayer color for this main layer
      const hex = activeSubColor[activeLayer] || "#000000";
      currentColor = hex;
      try { setPickerToColorString?.(hex); } catch {}
      try { setColorSwatch?.(); } catch {}

      renderLayerSwatches();


      // Restore the remembered color for the layer you switched to
      applyRememberedColorForLayer(activeLayer);
      // after activeLayer changes, load that layer’s remembered color and refresh wheel
      try {
        const c = (getRememberedColorForLayer?.(activeLayer)) || currentColor || "#000000";
        setCurrentColorHex(c, { remember: false });
      } catch {
        drawHSVWheel();
      }

    
    
    });




    saveOklchDefaultBtn?.addEventListener("click", () => {
      const L = clamp(parseFloat(defLInput?.value) || 0, 0, 100);
      const C = clamp(parseFloat(defCInput?.value) || 0, 0, 1);
      const H = clamp(parseFloat(defHInput?.value) || 0, 0, 360);
      oklchDefault = { L, C, H };
      applyOklchDefaultToPicker();
      if (oklchDefaultStatus) {
        oklchDefaultStatus.style.display = "inline-block";
        setTimeout(() => (oklchDefaultStatus.style.display = "none"), 1200);
      }
    });

    // Tool selection
    toolSeg?.addEventListener("change", () => {
      tool = document.querySelector('input[name="tool"]:checked')?.value || "brush";
      updateHUD();
      clearFx();
    });

    chooseFillEraserBtn?.addEventListener("click", () => {
      const r = $("tool-filleraser");
      if (r) r.checked = true;
      tool = "fill-eraser";
      updateHUD();
      clearFx();
    });

    chooseFillBrushBtn?.addEventListener("click", () => {
      const r = $("tool-fillbrush");
      if (r) r.checked = true;
      tool = "fill-brush";
      updateHUD();
      clearFx();
    });

    chooseLassoFillBtn?.addEventListener("click", () => {
      const r = $("tool-lassoFill");
      if (r) r.checked = true;
      tool = "lasso-fill";
      updateHUD();
      clearFx();
    });



    // Options
    bgColorInput?.addEventListener("input", (e) => {
      setCanvasBgColor(e.target.value);
    });

    bgColorInput?.addEventListener("click", (e) => {
      // stop the native <input type="color"> picker
      e.preventDefault();
      e.stopPropagation();

      openColorPickerAtCursor(e, canvasBgColor, (hex) => {
        canvasBgColor = hex;
        try { bgColorInput.value = hex; } catch {}
        renderAll();
      });
    }, { passive: false });


    

    aaToggle?.addEventListener("change", (e) => {
      antiAlias = e.target.checked;
      renderAll();
    });

    brushSizeInput?.addEventListener("input", (e) => {
      brushSize = parseInt(e.target.value, 10);
      safeText(brushVal, String(brushSize));
    });
    eraserSizeInput?.addEventListener("input", (e) => {
      eraserSize = parseInt(e.target.value, 10);
      safeText(eraserVal, String(eraserSize));
    });

    $("pressureSize")?.addEventListener("change", (e) => (usePressureSize = e.target.checked));
    $("pressureOpacity")?.addEventListener("change", (e) => (usePressureOpacity = e.target.checked));

    toggleOnionBtn?.addEventListener("click", () => {
      onionEnabled = !onionEnabled;
      toggleOnionBtn.textContent = `Onion: ${onionEnabled ? "On" : "Off"}`;
      renderAll();
    });

    // TRANSPARENCY_WIRING (unique anchor)
    function setTransparencyEnabled(on){
      transparencyHoldEnabled = !!on;

      // update any UI that exists
      const btn = document.getElementById("toggleTransparency");
      if (btn) btn.textContent = `Transparency: ${transparencyHoldEnabled ? "On" : "Off"}`;

      const chk = document.getElementById("tlTransparency");
      if (chk) chk.checked = transparencyHoldEnabled;

      try { renderAll(); } catch {}
    }

    function initTransparencyControls(){
      const btn = document.getElementById("toggleTransparency");
      const chk = document.getElementById("tlTransparency");

      if (btn && !btn._wiredTransparency){
        btn._wiredTransparency = true;
        btn.addEventListener("click", () => setTransparencyEnabled(!transparencyHoldEnabled));
      }

      if (chk && !chk._wiredTransparency){
        chk._wiredTransparency = true;
        chk.addEventListener("change", () => setTransparencyEnabled(chk.checked));
      }

      // initial sync
      setTransparencyEnabled(!!transparencyHoldEnabled);
    }

    onionPrevColorInput?.addEventListener("input", (e) => {
      onionPrevTint = e.target.value || "#4080ff";
      renderAll();
    });
    onionNextColorInput?.addEventListener("input", (e) => {
      onionNextTint = e.target.value || "#40ff78";
      renderAll();
    });
    onionAlphaInput?.addEventListener("input", (e) => {
      const v = parseInt(e.target.value, 10) || 20;
      onionAlpha = clamp(v / 100, 0.05, 0.8);
      safeText(onionAlphaVal, String(v));
      renderAll();
    });

    playSnappedChk?.addEventListener("change", (e) => (playSnapped = e.target.checked));

    keepOnionPlayingChk?.addEventListener("change", (e) => (keepOnionWhilePlaying = e.target.checked));
    keepTransPlayingChk?.addEventListener("change", (e) => (keepTransWhilePlaying = e.target.checked));

    gapPxInput?.addEventListener("input", () => {
      closeGapPx = clamp(parseInt(gapPxInput.value, 10) || 0, 0, 200);
    });

    autofillToggle?.addEventListener("change", () => {
      autofill = autofillToggle.checked;
    });

    fillCurrentBtn?.addEventListener("click", () => {
      pushUndo(LAYER.FILL, currentFrame);
      fillFromLineart(currentFrame);
    });

    fillAllBtn?.addEventListener("click", async () => {
      for (let i = 0; i < totalFrames; i++) {
        if (mainLayerHasContent(LAYER.LINE, i)) {

          pushUndo(LAYER.FILL, i);
          fillFromLineart(i);
        }
        if (i % 10 === 0) await sleep(0);
      }
    });





    // Duplicate cel
    dupCelBtn?.addEventListener("click", onDuplicateCel);
    tlDupBtn?.addEventListener("click", onDuplicateCel);

    // TL cel nav buttons
    tlPrevCelBtn?.addEventListener("click", gotoPrevCel);
    tlNextCelBtn?.addEventListener("click", gotoNextCel);

    // Fit view
    fitViewBtn?.addEventListener("click", resetCenter);

    // Timeline nav buttons
    jumpStartBtn?.addEventListener("click", () => gotoFrame(clipStart));
    jumpEndBtn?.addEventListener("click", () => gotoFrame(clipEnd));
    prevFrameBtn?.addEventListener("click", () => gotoFrame(stepBySnap(-1)));
    nextFrameBtn?.addEventListener("click", () => gotoFrame(stepBySnap(1)));

    // Play buttons
    $("playBtn")?.addEventListener("click", startPlayback);
    $("pauseBtn")?.addEventListener("click", pausePlayback);
    $("stopBtn")?.addEventListener("click", stopAndRewind);
    loopToggle?.addEventListener("change", () => (loopPlayback = loopToggle.checked));

    // Timeline header play mirror buttons (if present)
    tlPlayBtn?.addEventListener("click", () => $("playBtn")?.click());
    tlPauseBtn?.addEventListener("click", () => $("pauseBtn")?.click());
    tlStopBtn?.addEventListener("click", () => $("stopBtn")?.click());

    // Export
    exportWebMBtn?.addEventListener("click", async () => {
      const mime = pickWebMMime();
      await exportClip(mime, "webm");
    });
    exportMP4Btn?.addEventListener("click", async () => {
      const mime = pickMP4Mime();
      if (!mime) {
        alert("MP4 export is not supported in this browser. Try Safari or export WebM.");
        return;
      }
      await exportClip(mime, "mp4");
    });

    exportImgSeqBtn?.addEventListener("click", async () => {
      try {
        await exportPNGSequenceFull();
      } catch (e) {
        console.error(e);
        alert("IMG SEQ export failed. Open console for details.");
      }
    });


    // IMGSEQ_INIT (unique anchor)
    wireImgSeqExportButton();




    // SAVE_LOAD_WIRING (unique anchor)
    function initSaveLoadWiring(){
      if (window.__CELSTOMP_SAVELOAD_WIRED__) return;
      window.__CELSTOMP_SAVELOAD_WIRED__ = true;

      const saveProjBtn = document.getElementById("saveProj");
      const loadProjBtn = document.getElementById("loadProj");
      const loadFileInp = document.getElementById("loadFileInp");

      if (!saveProjBtn || !loadProjBtn || !loadFileInp) return;

      saveProjBtn.addEventListener("click", async () => {
        try {
          if (saveProjBtn.disabled) return;
          saveProjBtn.disabled = true;
          await saveProject();
        } catch (err) {
          alert("Failed to save project: " + (err?.message || err));
        } finally {
          saveProjBtn.disabled = false;
        }
      });

      loadProjBtn.addEventListener("click", () => {
        // IMPORTANT: must be directly inside the click (no await / timeout)
        loadFileInp.value = "";     // allow picking same file twice
        loadFileInp.click();
      });

      loadFileInp.addEventListener("change", (e) => {
        const f = e.currentTarget.files?.[0] || null;
        e.currentTarget.value = ""; // reset immediately
        if (f) loadProject(f);
      });
    }

    // call once on boot
    if (document.readyState === "loading") {
      window.addEventListener("DOMContentLoaded", initSaveLoadWiring, { once: true });
    } else {
      initSaveLoadWiring();
    }





    if (document.readyState === "loading") {
      window.addEventListener("DOMContentLoaded", () => {
        wireBrushButtonRightClick();
        wireEraserButtonRightClick();
      }, { once: true });
    } else {
      wireBrushButtonRightClick();
      wireEraserButtonRightClick();
    }


    // Snap controls
    function recalcSnap() {
      const val = parseInt(snapValue?.value, 10);
      snapFrames = Number.isFinite(val) ? Math.max(1, val) : 1;
    }
    snapValue?.addEventListener("input", recalcSnap);

    // Keyboard
    window.addEventListener("keydown", (e) => {
      const ctrl = e.ctrlKey || e.metaKey;



      // TIMELINE_QWAS_SHORTCUTS (unique anchor)
      {
 
        const tag = (e.target && e.target.tagName) ? e.target.tagName.toUpperCase() : "";
        const typing =
          tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" ||
          (e.target && e.target.isContentEditable);

        if (!typing && !ctrl && !e.altKey) {
          const k = (e.key || "").toLowerCase();

          if (k === "e") { // prev frame
            e.preventDefault();
            gotoFrame(stepBySnap(-1));
            return;
          }
          if (k === "r") { // next frame
            e.preventDefault();
            gotoFrame(stepBySnap(1));
            return;
          }
          if (k === "q") { // prev cel
            e.preventDefault();
            gotoPrevCel();
            return;
          }
          if (k === "w") { // next cel
            e.preventDefault();
            gotoNextCel();
            return;
          }
        }
      }


      // TOOL_SHORTCUT_KEYS (unique anchor)
      {
     
        const tag = (e.target && e.target.tagName) ? e.target.tagName.toUpperCase() : "";
        const typing =
          tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" ||
          (e.target && e.target.isContentEditable);

        if (!typing && !ctrl && !e.altKey) {
          const isDigit = (n) =>
            e.code === `Digit${n}` || e.code === `Numpad${n}` || e.key === String(n);

          // helper: find the radio by id OR by value and trigger your existing change logic
          const pickTool = ({ id, value, altIds = [] }) => {
            let inp = (id && document.getElementById(id)) || null;
            if (!inp) {
              for (const a of altIds) {
                inp = document.getElementById(a);
                if (inp) break;
              }
            }
            if (!inp && value) {
              inp = document.querySelector(`input[name="tool"][value="${value}"]`);
            }
            if (!inp) return false;

            inp.checked = true;
            inp.dispatchEvent(new Event("change", { bubbles: true })); // hits your toolSeg change listener
            return true;
          };

          if (!e.shiftKey) {
            if (isDigit(1)) { e.preventDefault(); pickTool({ id: "tool-brush",      value: "brush" }); }
            if (isDigit(2)) { e.preventDefault(); pickTool({ id: "tool-eraser",     value: "eraser" }); }
            if (isDigit(3)) { e.preventDefault(); pickTool({ id: "tool-fillbrush",  value: "fill-brush" }); }
            if (isDigit(4)) { e.preventDefault(); pickTool({ id: "tool-filleraser", value: "fill-eraser" }); }
            if (isDigit(5)) { e.preventDefault(); pickTool({ id: "tool-lassoFill",  value: "lasso-fill" }); }
            if (isDigit(6)) { e.preventDefault(); pickTool({
              id: "tool-lassoErase",
              altIds: ["tool-lassoerase", "tool-lasso-erase"],
              value: "lasso-erase"
            }); }
          }
        }
      }

      if (e.key === "Escape") {
        if (tool === "lasso-fill" && lassoActive) {
          e.preventDefault();
          cancelLasso();
          isDrawing = false;
          lastPt = null;
          return;
        }
      }

      // Delete selected cels (don’t hijack typing in inputs)
      if ((e.key === "Delete" || e.key === "Backspace") && selectedCels.size) {
        const tag = (e.target && e.target.tagName) ? e.target.tagName.toUpperCase() : "";
        if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") {
          e.preventDefault();
          deleteSelectedCels();
          return;
        }
      }

      // ✅ Delete current swatch color on current frame (only this cel)
      // (don’t hijack typing in inputs)
      if ((e.key === "Delete" || e.key === "Backspace") && !selectedCels.size) {
        const tag = (e.target && e.target.tagName) ? e.target.tagName.toUpperCase() : "";
        if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") {
          const did = deleteActiveColorAtCurrentFrame();
          if (did) {
            e.preventDefault();
            return;
          }
        }
      }


      if (ctrl && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (ctrl && e.key.toLowerCase() === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
      } else if (e.key === " ") {
        e.preventDefault();
        if (isPlaying) pausePlayback();
        else startPlayback();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        gotoNextCel();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        gotoPrevCel();
      } else if (e.key === "ArrowLeft") {
        gotoFrame(stepBySnap(-1));
      } else if (e.key === "ArrowRight") {
        gotoFrame(stepBySnap(1));
      }

    });

    //checkhere
    
    // FLOATING_ISLAND_DRAG (unique anchor)
    function wireFloatingIslandDrag(){
      const dock =
        document.getElementById("floatingIsland") ||
        document.querySelector(".islandDock");
      if (!dock) return;

      const head = dock.querySelector(".islandHeader");
      if (!head) return;

      if (dock._dragWired) return;
      dock._dragWired = true;

      let dragging = false;
      let pid = null;
      let offX = 0;
      let offY = 0;

      const clampPos = (x, y) => {
        const pad = 6;
        const w = dock.offsetWidth  || dock.getBoundingClientRect().width;
        const h = dock.offsetHeight || dock.getBoundingClientRect().height;

        x = Math.max(pad, Math.min(window.innerWidth  - w - pad, x));
        y = Math.max(pad, Math.min(window.innerHeight - h - pad, y));
        return { x, y };
      };

      head.addEventListener("pointerdown", (e) => {
        // mouse: left button only
        if (e.pointerType === "mouse" && e.button !== 0) return;

        // don't start drag if clicking buttons or resize handle
        if (e.target.closest(".islandBtn, .islandBtns, .islandResizeHandle")) return;

        const r = dock.getBoundingClientRect();
        offX = e.clientX - r.left;
        offY = e.clientY - r.top;

        dragging = true;
        pid = e.pointerId;

        dock.classList.add("dragging");
        try { head.setPointerCapture(pid); } catch {}

        e.preventDefault();
      }, { passive: false });

      window.addEventListener("pointermove", (e) => {
        if (!dragging || e.pointerId !== pid) return;

        const pos = clampPos(e.clientX - offX, e.clientY - offY);
        dock.style.left = pos.x + "px";
        dock.style.top  = pos.y + "px";

        e.preventDefault();
      }, { passive: false });

      const end = (e) => {
        if (!dragging || (pid != null && e.pointerId !== pid)) return;

        dragging = false;
        dock.classList.remove("dragging");

        try { head.releasePointerCapture(pid); } catch {}
        pid = null;
      };

      window.addEventListener("pointerup", end, { passive: true });
      window.addEventListener("pointercancel", end, { passive: true });
    }

    // call it once after island exists
    wireFloatingIslandDrag();



    // ISLAND_LAYER_AUTOFIT (unique anchor)
    let _islandLayerAutoFit = null;




    // ISLAND_TOGGLE_POINTER (unique anchor)
    function initIslandTogglePointerFix(){
      // We'll keep trying until the island exists (because mountIslandDock runs later)
      function findToggleBtn(){
        const dock =
          document.getElementById("floatingIsland") ||
          document.querySelector(".islandDock");

        if (!dock) return null;

        // Try common selectors first
        let btn =
          dock.querySelector("#islandToggleBtn") ||
          dock.querySelector(".islandToggleBtn");

        // If still not found, fallback: find a button whose text is ">" (or similar)
        if (!btn){
          btn = Array.from(dock.querySelectorAll("button")).find(b => {
            const t = (b.textContent || "").trim();
            const a = (b.getAttribute("aria-label") || "").toLowerCase();
            return t === ">" || t === "‹" || t === "⟩" || a.includes("toggle");
          }) || null;
        }

        return btn;
      }

      function wire(btn){
        if (!btn || btn._islandPtrWired) return true;
        btn._islandPtrWired = true;

        // IMPORTANT: this must call REAL toggle logic (NOT btn.click()).
        // If you already have a real function, use it.
        const doToggle = () => {
          if (typeof window.toggleIslandPanel === "function") {
            window.toggleIslandPanel();
            return;
          }

          // fallback: toggle a class (adjust to whatever your CSS expects)
          document.body.classList.toggle("island-open");
        };

        // Use pointerdown for mobile (instant + reliable)
        btn.addEventListener("pointerdown", (e) => {
          if (e.pointerType === "touch") {
            e.preventDefault();
            e.stopPropagation();
            doToggle();
          }
        }, { passive: false });

        // Normal click for desktop + fallback
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          doToggle();
        });

        return true;
      }

      // Try immediately
      const first = findToggleBtn();
      if (first) { wire(first); return; }

      // Otherwise wait until mountIslandDock inserts it
      const mo = new MutationObserver(() => {
        const btn = findToggleBtn();
        if (btn) {
          wire(btn);
          mo.disconnect();
        }
      });
      mo.observe(document.body, { childList: true, subtree: true });
    }

    function initIslandLayerAutoFit(){
      if (_islandLayerAutoFit) return;

      const st = {
        raf: 0,
        lastScale: 1,
        ro: null,
        mo: null,
        docMo: null,
      };

      function schedule(){
        if (st.raf) return;
        st.raf = requestAnimationFrame(() => {
          st.raf = 0;
          apply();
        });
      }

      function apply(){
        const slot = document.getElementById("islandLayersSlot");
        const seg  = document.getElementById("layerSeg");
        if (!slot || !seg) return;

        // Only scale when the layerSeg is actually inside the island layer slot
        if (!slot.contains(seg)){
          // reset if it got moved elsewhere
          if (st.lastScale !== 1){
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
        const availW = Math.max(10, slot.clientWidth  - padX);

        // scrollHeight/scrollWidth are NOT affected by transform (good for measuring)
        const naturalH = Math.max(1, seg.scrollHeight);
        const naturalW = Math.max(1, seg.scrollWidth);

        let s = Math.min(1, availH / naturalH, availW / naturalW);

        // allow very small if needed so it "always fits"
        s = Math.max(0.25, s);

        // reduce jitter on resize
        s = Math.round(s * 100) / 100;

        if (Math.abs(s - st.lastScale) < 0.01) return;
        st.lastScale = s;

        seg.style.transformOrigin = "top left";
        seg.style.transform = `scale(${s})`;
        seg.style.willChange = "transform";
      }

      function startObservers(){
        const slot = document.getElementById("islandLayersSlot");
        const seg  = document.getElementById("layerSeg");
        if (!slot || !seg) return;

        // resize island -> refit
        st.ro = new ResizeObserver(schedule);
        st.ro.observe(slot);

        // swatches/labels change -> refit
        st.mo = new MutationObserver(schedule);
        st.mo.observe(seg,  { childList:true, subtree:true, attributes:true, characterData:true });
        st.mo.observe(slot, { childList:true, subtree:true }); // if seg moves around inside

        window.addEventListener("resize", schedule, { passive:true });

        apply();
      }

      // Watch the document until #layerSeg is inside #islandLayersSlot, then start
      st.docMo = new MutationObserver(() => {
        schedule();
        const slot = document.getElementById("islandLayersSlot");
        const seg  = document.getElementById("layerSeg");
        if (slot && seg && slot.contains(seg)){
          // start once
          if (!st.ro) startObservers();
        }
      });
      st.docMo.observe(document.body, { childList:true, subtree:true });

      // run immediately too
      schedule();

      _islandLayerAutoFit = st;
    }

    // Call once (safe)
    initIslandLayerAutoFit();

    // -------------------------
    // Reference Layer Wiring
    // -------------------------
    function wireReferenceLayerControls() {
      const refFileInp = document.getElementById("refFileInp");
      const loadRefBtn = document.getElementById("loadRefBtn");
      const clearRefBtn = document.getElementById("clearRefBtn");
      const refOpacityInp = document.getElementById("refOpacity");
      const refToggle = document.getElementById("refToggle");

      if (loadRefBtn && refFileInp) {
        loadRefBtn.addEventListener("click", () => {
          refFileInp.value = ""; 
          refFileInp.click();
        });

        refFileInp.addEventListener("change", (e) => {
          const file = e.target.files?.[0]; 
          if (!file) return;
          const reader = new FileReader();

          reader.onload = (evt) => {
            const img = new Image();
            img._filename = file.name; 

            img.onload = () => {
              referenceCels[currentFrame] = img;

              const duration = (typeof fps === "number" ? fps : 24); 
              const endFrame = currentFrame + duration;

              if (endFrame < totalFrames) {
                 if (referenceCels[endFrame] === null) {
                   referenceCels[endFrame] = { empty: true };
                 }
              }

              referenceVisible = true;
              if (refToggle) refToggle.checked = true;

              if (typeof buildTimeline === "function") buildTimeline();
              renderAll();
            };
            img.src = evt.target.result;
          };
          reader.readAsDataURL(file);
        });
      }

      if (clearRefBtn) {
        clearRefBtn.addEventListener("click", () => {
          referenceCels[currentFrame] = { empty: true };
          if (typeof buildTimeline === "function") buildTimeline();
          renderAll();
        });

        clearRefBtn.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          referenceCels[currentFrame] = null;
          if (typeof buildTimeline === "function") buildTimeline();
          renderAll();
        });
      }

      if (refOpacityInp) {
        refOpacityInp.addEventListener("input", (e) => {
          referenceOpacity = parseInt(e.target.value, 10) / 100;
          renderAll();
        });
      }

      if (refToggle) {
        refToggle.addEventListener("change", (e) => {
          referenceVisible = e.target.checked;
          renderAll();
        });
      }
    }

    // -------------------------
    // Init
    // -------------------------
    function buildAndInit() {
      buildTimeline();
      resizeCanvases();
      resetCenter();
      updateHUD();

      initHSVWheelPicker();



      setPickerDefaultBlack();
      setColorSwatch();

      if (bgColorInput) bgColorInput.value = canvasBgColor;

      renderLayerSwatches();

      // ✅ ADD THIS: inject eye buttons immediately on boot
      wireLayerVisButtons();
      wireKeyboardShortcuts();

      setHSVPreviewBox();

      if (toggleOnionBtn) toggleOnionBtn.textContent = "Onion: Off";
      if (toggleTransparencyBtn) toggleTransparencyBtn.textContent = "Transparency: Off";
    }


    // Observe stage size
    const ro = new ResizeObserver(resizeCanvases);
    ro.observe(stageEl);

    window.addEventListener("resize", () => {
      resizeCanvases();
    });

    window.addEventListener("resize", () => {
      if (shouldIgnoreViewportResize()) return;
      scheduleResizeAll(); // whatever you call
    }, { passive: true });

    if (window.visualViewport){
      window.visualViewport.addEventListener("resize", () => {
        if (shouldIgnoreViewportResize()) return;
        scheduleResizeAll();
      }, { passive: true });
    }

    initMobileNativeZoomGuard();
    mountIslandDock();

    // Optional subsystems
    wireTimelineHeaderControls();
    dockDrag();
    wirePanelToggles();
    wireBrushButtonRightClick();
    wireEraserButtonRightClick();

    wireReferenceLayerControls();
    initReferenceTimelineInteraction();

    wirePointerDrawingOnCanvas(document.getElementById("drawCanvas"));
    // Final init
    buildAndInit();
  });
})();
 