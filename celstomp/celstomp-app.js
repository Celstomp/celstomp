(() => {
    "use strict";
    let _liveColorDialogLock = false;
    function rafThrottle(fn) {
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
    function openLiveColorDialog({initialHex: initialHex = "#ffffff", onLive: onLive = null, onCommit: onCommit = null, onCancel: onCancel = null} = {}) {
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
        const liveThrottled = rafThrottle(hex => {
            try {
                onLive && onLive(hex);
            } catch {}
        });
        let lastPolled = picker.value;
        const poll = setInterval(() => {
            const v = picker.value;
            if (v && v !== lastPolled) {
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
            try {
                (onCommit || onLive) && (onCommit ? onCommit(v) : onLive(v));
            } catch {}
            cleanup();
        };
        const onWinFocus = () => {
            setTimeout(() => {
                if (committed) return;
                const v = picker.value || startHex;
                if (v === startHex) {
                    try {
                        onCancel && onCancel();
                    } catch {}
                } else {
                    try {
                        (onCommit || onLive) && (onCommit ? onCommit(v) : onLive(v));
                    } catch {}
                }
                cleanup();
            }, 0);
        };
        picker.addEventListener("input", onInp);
        picker.addEventListener("change", onChg);
        window.addEventListener("focus", onWinFocus, true);
        liveThrottled(startHex);
        picker.click();
    }
    let _cursorColorPicker = null;
    function ensureCursorColorPicker() {
        if (_cursorColorPicker && document.body.contains(_cursorColorPicker)) return _cursorColorPicker;
        if (_cursorColorPicker) {
            try {
                _cursorColorPicker.remove();
            } catch {}
            _cursorColorPicker = null;
        }
        const inp = document.createElement("input");
        inp.type = "color";
        inp.id = "cursorColorPicker";
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
    function openColorPickerAtCursor(e, initialHex, onPick) {
        const picker = ensureCursorColorPicker();
        const pad = 8;
        const w = 1, h = 1;
        const x = Math.max(0, Math.min(window.innerWidth - w - 1, (e?.clientX ?? 0) + pad));
        const y = Math.max(0, Math.min(window.innerHeight - h - 1, (e?.clientY ?? 0) + pad));
        picker.style.left = x + "px";
        picker.style.top = y + "px";
        const norm = typeof normalizeToHex === "function" ? normalizeToHex(initialHex || "#000000") : initialHex || "#000000";
        try {
            picker.value = norm;
        } catch {}
        if (picker._pickCleanup) picker._pickCleanup();
        const onInput = () => {
            const v = picker.value || norm;
            try {
                onPick?.(v);
            } catch {}
        };
        const onChange = () => {
            const v = picker.value || norm;
            try {
                onPick?.(v);
            } catch {}
            try {
                picker._pickCleanup?.();
            } catch {}
            try {
                picker.blur?.();
            } catch {}
        };
        picker.addEventListener("input", onInput, {
            passive: true
        });
        picker.addEventListener("change", onChange, {
            passive: true
        });
        picker._pickCleanup = () => {
            picker.removeEventListener("input", onInput);
            picker.removeEventListener("change", onChange);
            picker._pickCleanup = null;
        };
        try {
            picker.focus({
                preventScroll: true
            });
        } catch {}
        let opened = false;
        try {
            if (picker.showPicker) {
                picker.showPicker();
                opened = true;
            }
        } catch {}
        if (!opened) {
            try {
                picker.click();
                opened = true;
            } catch {}
        }
        if (!opened) {
            try {
                picker.remove();
            } catch {}
            _cursorColorPicker = null;
            const p2 = ensureCursorColorPicker();
            p2.style.left = x + "px";
            p2.style.top = y + "px";
            try {
                p2.value = norm;
            } catch {}
            try {
                p2.focus({
                    preventScroll: true
                });
            } catch {}
            try {
                p2.click();
            } catch {}
        }
    }
    function openColorPickerAtElement(anchorEl, initialHex, onPick) {
        const r = anchorEl?.getBoundingClientRect?.();
        const fakeEvent = {
            clientX: r ? r.left + r.width / 2 : window.innerWidth / 2,
            clientY: r ? r.top + r.height / 2 : window.innerHeight / 2
        };
        openColorPickerAtCursor(fakeEvent, initialHex, onPick);
    }
    const $ = id => document.getElementById(id);
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const sleep = (ms = 0) => new Promise(r => setTimeout(r, ms));
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
    function ready(fn) {
        if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn, {
            once: true
        }); else fn();
    }
    ready(() => {
        let contentW = 960;
        let contentH = 540;
        const stageEl = $("stage");
        const boundsCanvas = $("boundsCanvas");
        const drawCanvas = $("drawCanvas");
        const fxCanvas = $("fxCanvas");
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
        const dctx = drawCanvas.getContext("2d", {
            desynchronized: true
        }) || drawCanvas.getContext("2d");
        const fxctx = fxCanvas.getContext("2d");
        if (!(boundsCanvas instanceof HTMLCanvasElement) || !(drawCanvas instanceof HTMLCanvasElement) || !(fxCanvas instanceof HTMLCanvasElement) || !bctx || !dctx || !fxctx) {
            console.warn("[celstomp] Canvas/context init failed:", {
                boundsCanvas: boundsCanvas,
                drawCanvas: drawCanvas,
                fxCanvas: fxCanvas,
                bctx: bctx,
                dctx: dctx,
                fxctx: fxctx
            });
            return;
        }
        const hudFps = $("hudFps");
        const zoomInfo = $("zoomInfo");
        const frameInfo = $("frameInfo");
        const hudTime = $("hudTime");
        const timeCounter = $("timeCounter");
        const toolName = $("toolName");
        const fpsLabel = $("fpsLabel");
        const secLabel = $("secLabel");
        const timelineTable = $("timelineTable");
        const timelineScroll = $("timelineScroll");
        const playheadMarker = $("playheadMarker");
        const clipStartMarker = $("clipStartMarker");
        const clipEndMarker = $("clipEndMarker");
        const hasTimeline = !!(timelineTable && timelineScroll && playheadMarker && clipStartMarker && clipEndMarker);
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
        const addPaletteColorBtn = $("addPaletteColor");
        const clearAllBtn = $("clearAllBtn");
        const paletteBar = $("paletteBar");
        const defLInput = $("defL");
        const defCInput = $("defC");
        const defHInput = $("defH");
        const saveOklchDefaultBtn = $("saveOklchDefault");
        const oklchDefaultStatus = $("oklchDefaultStatus");
        const hsvWheelWrap = $("hsvWheelWrap");
        const hsvWheelCanvas = $("hsvWheelCanvas");
        const hsvWheelPreview = $("hsvWheelPreview");
        const toolSeg = document.getElementById("toolSeg");
        const brushShapeSeg = document.getElementById("brushShapeSeg");
        const toolSettingsSection = document.getElementById("toolSettingsSection");
        const toolSettingsTitle = document.getElementById("toolSettingsTitle");
        const toolFoldBrushesBtn = document.getElementById("toolFoldBrushesBtn");
        const toolFoldBrushesBody = document.getElementById("toolFoldBrushesBody");
        const toolFoldSettingsBtn = document.getElementById("toolFoldSettingsBtn");
        const toolFoldSettingsBody = document.getElementById("toolFoldSettingsBody");
        const brushShapeTooltip = document.getElementById("brushShapeTooltip");
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
        function menuFocusableItems(panel) {
            if (!panel) return [];
            return Array.from(panel.querySelectorAll("button:not([disabled]), select, input[type='checkbox']")).filter(el => !el.hidden);
        }
        function closeSubmenu(triggerBtn, panel) {
            if (panel) panel.hidden = true;
            if (triggerBtn) triggerBtn.setAttribute("aria-expanded", "false");
        }
        function openSubmenu(triggerBtn, panel) {
            if (!panel || !triggerBtn) return;
            panel.hidden = false;
            triggerBtn.setAttribute("aria-expanded", "true");
        }
        function closeTopMenus() {
            [ [ menuFileBtn, menuFilePanel ], [ menuEditBtn, menuEditPanel ], [ menuToolBehaviorBtn, menuToolBehaviorPanel ] ].forEach(([btn, panel]) => {
                if (panel) panel.hidden = true;
                btn?.setAttribute("aria-expanded", "false");
            });
            [ [ menuExportBtn, menuExportPanel ], [ menuAutosaveBtn, menuAutosavePanel ] ].forEach(([btn, panel]) => closeSubmenu(btn, panel));
        }
        function openTopMenu(btn, panel) {
            if (!btn || !panel) return;
            closeTopMenus();
            panel.hidden = false;
            btn.setAttribute("aria-expanded", "true");
            const first = menuFocusableItems(panel)[0];
            if (first && window.matchMedia("(min-width: 721px)").matches) {
                try {
                    first.focus({
                        preventScroll: true
                    });
                } catch {}
            }
        }
        function wireTopMenus() {
            if (!topMenuBar || topMenuBar.dataset.wiredMenus === "1") return;
            topMenuBar.dataset.wiredMenus = "1";
            const triggerPairs = [ [ menuFileBtn, menuFilePanel ], [ menuEditBtn, menuEditPanel ], [ menuToolBehaviorBtn, menuToolBehaviorPanel ] ];
            triggerPairs.forEach(([btn, panel]) => {
                if (!btn || !panel) return;
                btn.addEventListener("click", e => {
                    e.preventDefault();
                    e.stopPropagation();
                    const open = !panel.hidden;
                    if (open) closeTopMenus(); else openTopMenu(btn, panel);
                });
                btn.addEventListener("keydown", e => {
                    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openTopMenu(btn, panel);
                    }
                });
            });
            [ [ menuExportBtn, menuExportPanel ], [ menuAutosaveBtn, menuAutosavePanel ] ].forEach(([btn, panel]) => {
                btn?.addEventListener("click", e => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (panel?.hidden) openSubmenu(btn, panel); else closeSubmenu(btn, panel);
                });
                btn?.addEventListener("keydown", e => {
                    if (e.key === "ArrowRight" || e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openSubmenu(btn, panel);
                        const first = menuFocusableItems(panel)[0];
                        first?.focus?.();
                    }
                });
            });
            const wirePanelKeys = panel => {
                panel?.addEventListener("keydown", e => {
                    const items = menuFocusableItems(panel);
                    if (!items.length) return;
                    const idx = Math.max(0, items.indexOf(document.activeElement));
                    if (e.key === "ArrowDown") {
                        e.preventDefault();
                        items[(idx + 1) % items.length].focus();
                    } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        items[(idx - 1 + items.length) % items.length].focus();
                    } else if (e.key === "Escape") {
                        e.preventDefault();
                        closeTopMenus();
                    } else if (e.key === "ArrowLeft" && panel?.classList?.contains("topSubmenuPanel")) {
                        e.preventDefault();
                        const trigger = topMenuBar?.querySelector(`.topSubmenuTrigger[aria-controls="${panel.id}"]`) || null;
                        closeSubmenu(trigger, panel);
                        trigger?.focus?.();
                    }
                });
            };
            wirePanelKeys(menuFilePanel);
            wirePanelKeys(menuEditPanel);
            wirePanelKeys(menuToolBehaviorPanel);
            wirePanelKeys(menuExportPanel);
            wirePanelKeys(menuAutosavePanel);
            document.addEventListener("mousedown", e => {
                if (!topMenuBar.contains(e.target)) closeTopMenus();
            });
            document.addEventListener("keydown", e => {
                if (e.key === "Escape") closeTopMenus();
            });
            [ menuFilePanel, menuEditPanel, menuToolBehaviorPanel, menuExportPanel, menuAutosavePanel ].forEach(panel => {
                panel?.addEventListener("click", e => {
                    if (e.target.closest("button") && !e.target.closest(".topSubmenuTrigger")) {
                        closeTopMenus();
                    }
                });
            });
        }
        toolSeg.addEventListener("contextmenu", e => {
            const lab = e.target.closest("label[data-tool]");
            if (!lab) return;
            const tool = lab.dataset.tool;
            if (tool !== "eraser" && tool !== "fill-eraser") return;
            e.preventDefault();
            const inputId = lab.getAttribute("for");
            const input = inputId ? document.getElementById(inputId) : null;
            if (input) input.checked = true;
            openPopupAt(eraserOptionsPopup, e.clientX + 6, e.clientY + 6);
        });
        document.addEventListener("mousedown", e => {
            if (!eraserOptionsPopup) return;
            if (!eraserOptionsPopup.contains(e.target)) closePopup(eraserOptionsPopup);
        });
        document.addEventListener("keydown", e => {
            if (e.key === "Escape") closePopup(eraserOptionsPopup);
        });
        const brushSizeInput = $("brushSize") || $("brushSizeRange");
        const brushSizeNumInput = $("brushSizeNum");
        const eraserSizeInput = $("eraserSize");
        const toolOpacityRange = $("toolOpacityRange");
        const toolAngleRange = $("toolAngleRange");
        const brushVal = $("brushVal");
        const eraserVal = $("eraserVal");
        const brushSwatch = $("brushSwatch");
        const brushHexEl = $("brushHex");
        const infoBtn = $("infoBtn");
        const infoPanel = $("infoPanel");
        const exportMP4Btn = $("exportMP4");
        const saveProjBtn = document.getElementById("saveProj");
        const loadProjBtn = document.getElementById("loadProj");
        const loadFileInp = document.getElementById("loadFileInp");
        const restoreAutosaveBtn = document.getElementById("restoreAutosave");
        const toggleAutosaveBtn = document.getElementById("toggleAutosaveBtn");
        const autosaveIntervalBtn = document.getElementById("autosaveIntervalBtn");
        const saveStateBadgeEl = document.getElementById("saveStateBadge");
        const exportImgSeqBtn = document.getElementById("exportImgSeqBtn") || document.getElementById("exportImgSeq");
        const clearAllModal = document.getElementById("clearAllModal");
        const clearAllModalBackdrop = document.getElementById("clearAllModalBackdrop");
        const clearAllConfirmBtn = document.getElementById("clearAllConfirmBtn");
        const clearAllCancelBtn = document.getElementById("clearAllCancelBtn");
        const exportGIFBtn = document.getElementById("exportGIFBtn");
        const exportImgSeqModal = document.getElementById("exportImgSeqModal");
        const exportImgSeqModalBackdrop = document.getElementById("exportImgSeqModalBackdrop");
        const exportImgSeqTransparencyToggle = document.getElementById("exportImgSeqTransparency");
        const exportImgSeqConfirmBtn = document.getElementById("exportImgSeqConfirmBtn");
        const exportImgSeqCancelBtn = document.getElementById("exportImgSeqCancelBtn");
        const exportGifModal = document.getElementById("exportGifModal");
        const exportGifModalBackdrop = document.getElementById("exportGifModalBackdrop");
        const exportGifFpsInput = document.getElementById("exportGifFps");
        const exportGifTransparencyToggle = document.getElementById("exportGifTransparency");
        const exportGifLoopToggle = document.getElementById("exportGifLoop");
        const exportGifConfirmBtn = document.getElementById("exportGifConfirmBtn");
        const exportGifCancelBtn = document.getElementById("exportGifCancelBtn");
        const autosaveIntervalModal = document.getElementById("autosaveIntervalModal");
        const autosaveIntervalModalBackdrop = document.getElementById("autosaveIntervalModalBackdrop");
        const autosaveIntervalMinutesInput = document.getElementById("autosaveIntervalMinutesInput");
        const autosaveIntervalConfirmBtn = document.getElementById("autosaveIntervalConfirmBtn");
        const autosaveIntervalCancelBtn = document.getElementById("autosaveIntervalCancelBtn");
        const topMenuBar = document.getElementById("topMenuBar");
        const menuFileBtn = document.getElementById("menuFileBtn");
        const menuFilePanel = document.getElementById("menuFilePanel");
        const menuEditBtn = document.getElementById("menuEditBtn");
        const menuEditPanel = document.getElementById("menuEditPanel");
        const menuToolBehaviorBtn = document.getElementById("menuToolBehaviorBtn");
        const menuToolBehaviorPanel = document.getElementById("menuToolBehaviorPanel");
        const menuAutosaveBtn = document.getElementById("menuAutosaveBtn");
        const menuAutosavePanel = document.getElementById("menuAutosavePanel");
        const menuExportBtn = document.getElementById("menuExportBtn");
        const menuExportPanel = document.getElementById("menuExportPanel");
        const stabilizationSelect = $("stabilizationLevel");
        const penControls = $("penControls");
        const pressureSizeToggle = $("pressureSize") || $("usePressureSize");
        const pressureOpacityToggle = $("pressureOpacity") || $("usePressureOpacity");
        const pressureTiltToggle = $("pressureTilt") || $("usePressureTilt");
        function canvasToBlob(canvas, type = "image/png", quality) {
            return new Promise(resolve => {
                canvas.toBlob(b => resolve(b), type, quality);
            });
        }
        function _pad2(n) {
            return String(n).padStart(2, "0");
        }
        function _timestampSlug(d = new Date) {
            return d.getFullYear() + _pad2(d.getMonth() + 1) + _pad2(d.getDate()) + "_" + _pad2(d.getHours()) + _pad2(d.getMinutes()) + _pad2(d.getSeconds());
        }
        async function exportPngSequenceToFolder({fromFrame: fromFrame, toFrame: toFrame, transparent: transparent = true, prefix: prefix = "celstomp_", makeSubfolder: makeSubfolder = true, folderName: folderName = null, baseDirHandle: baseDirHandle = null, progressEl: progressEl = null} = {}) {
            const from = Number.isFinite(fromFrame) ? fromFrame : clipStart;
            const to = Number.isFinite(toFrame) ? toFrame : clipEnd;
            if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) {
                alert("Invalid export range.");
                return;
            }
            const outC = document.createElement("canvas");
            outC.width = contentW;
            outC.height = contentH;
            const outCtx = outC.getContext("2d");
            const total = to - from + 1;
            const setProg = done => {
                const el = progressEl || document.getElementById("exportImgSeqBtn") || document.getElementById("exportImgSeq");
                if (!el) return;
                const pct = Math.round(done / total * 100);
                el.textContent = `Exporting… ${pct}%`;
            };
            const canFolder = !!window.showDirectoryPicker && !!window.isSecureContext;
            if (canFolder) {
                let baseDir = baseDirHandle;
                if (!baseDir) {
                    baseDir = await window.showDirectoryPicker({
                        mode: "readwrite"
                    });
                }
                let dir = baseDir;
                let finalFolder = "";
                if (makeSubfolder) {
                    finalFolder = folderName || `celstomp_pngseq_${_timestampSlug()}`;
                    dir = await baseDir.getDirectoryHandle(finalFolder, {
                        create: true
                    });
                }
                for (let f = from; f <= to; f++) {
                    drawCompositeAt(outCtx, f, !transparent);
                    const blob = await canvasToBlob(outC, "image/png");
                    if (!blob) throw new Error("PNG export failed (toBlob returned null).");
                    const seq = f - from + 1;
                    const name = `${prefix}${String(seq).padStart(4, "0")}.png`;
                    const fileHandle = await dir.getFileHandle(name, {
                        create: true
                    });
                    const writable = await fileHandle.createWritable();
                    await writable.write(blob);
                    await writable.close();
                    const done = f - from + 1;
                    setProg(done);
                    if (done % 3 === 0) await sleep(0);
                }
                alert(`Exported PNG sequence.\n` + (makeSubfolder ? `Folder: ${finalFolder}\n` : "") + `Frames: ${from + 1}–${to + 1}\n\n` + `Tip: choose your Downloads folder when prompted to save it in Downloads.`);
                return;
            }
            alert((!window.isSecureContext ? "Folder export requires HTTPS (or localhost).\n\n" : "Your browser doesn’t support folder export.\n\n") + "Fallback: downloading many PNGs (your browser may block this).\n" + "For best results, use Opera/Chrome/Edge on an HTTPS site.");
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
                const done = f - from + 1;
                setProg(done);
                await sleep(60);
            }
        }
        function wireImgSeqExportButton() {
            if (document._imgSeqDelegatedWired) return;
            document._imgSeqDelegatedWired = true;
            document.addEventListener("click", async e => {
                const btn = e.target.closest("#exportImgSeqBtn, #exportImgSeq");
                if (!btn) return;
                e.preventDefault();
                e.stopPropagation();
                const prevText = btn.textContent;
                btn.disabled = true;
                const transparent = !e.shiftKey;
                let baseDirHandle = null;
                try {
                    if (window.showDirectoryPicker && window.isSecureContext) {
                        baseDirHandle = await window.showDirectoryPicker({
                            mode: "readwrite"
                        });
                    }
                    await exportPngSequenceToFolder({
                        fromFrame: clipStart,
                        toFrame: clipEnd,
                        transparent: transparent,
                        prefix: "celstomp_",
                        makeSubfolder: true,
                        baseDirHandle: baseDirHandle,
                        progressEl: btn
                    });
                } catch (err) {
                    if (err && (err.name === "AbortError" || err.name === "NotAllowedError")) {} else {
                        console.warn("[IMGSEQ] export failed:", err);
                        alert("IMG SEQ export failed:\n" + (err?.message || String(err)));
                    }
                } finally {
                    btn.disabled = false;
                    btn.textContent = prevText;
                }
            }, {
                capture: true,
                passive: false
            });
        }
        const fitViewBtn = $("fitView");
        const jumpStartBtn = $("jumpStart");
        const jumpEndBtn = $("jumpEnd");
        const prevFrameBtn = $("prevFrame");
        const nextFrameBtn = $("nextFrame");
        let dpr = window.devicePixelRatio || 1;
        let fps = 24;
        let seconds = 5;
        let totalFrames = fps * seconds;
        let zoom = 1;
        let offsetX = 0;
        let offsetY = 0;
        let canvasBgColor = "#bfbfbf";
        let transparencyHoldEnabled = false;
        let isPlaying = false;
        let playTimer = null;
        let loopPlayback = true;
        let clipStart = 0;
        let clipEnd = Math.max(0, Math.min(totalFrames - 1, fps * 2 - 1));
        let playSnapped = false;
        let onionEnabled = false;
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
        let tool = "brush";
        let brushSize = 3;
        let brushType = "circle";
        let eraserSize = 100;
        const DEFAULT_TOOL_BRUSH_SETTINGS = {
            shape: "circle",
            size: 3,
            opacity: 1,
            angle: 0
        };
        const DEFAULT_TOOL_ERASER_SETTINGS = {
            shape: "circle",
            size: 100,
            opacity: 1,
            angle: 0
        };
        let brushSettings = {
            ...DEFAULT_TOOL_BRUSH_SETTINGS
        };
        let eraserSettings = {
            ...DEFAULT_TOOL_ERASER_SETTINGS
        };
        brushType = brushSettings.shape;
        brushSize = brushSettings.size;
        eraserSize = eraserSettings.size;
        let currentColor = "#000000";
        let usePressureSize = true;
        let usePressureOpacity = false;
        let usePressureTilt = false;
        let antiAlias = false;
        let closeGapPx = 0;
        let autofill = false;
        const fillWhite = "#ffffff";
        const fillBrushTrailColor = "#ff1744";
        const pressureCache = new Map;
        const tiltCache = new Map;
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
        const PALETTE_KEY = "celstomp_palette_v1";
        let colorPalette = [];
        let oklchDefault = {
            L: 0,
            C: .2,
            H: 180
        };
        let pickerInitializing = false;
        let pickerShape = "square";
        try {
            const savedShape = localStorage.getItem("celstomp_picker_shape");
            if (savedShape === "triangle") pickerShape = "triangle";
        } catch {}
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
        const PAPER_LAYER = -1;
        let mainLayerOrder = DEFAULT_MAIN_LAYER_ORDER.slice();
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
        let layers = new Array(LAYERS_COUNT).fill(0).map(() => ({
            name: "",
            opacity: 1,
            prevOpacity: 1,
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
            setPickerToColorString(currentColor);
        }
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
        function _ctrlMovePickKeyForLayer(L) {
            if (typeof LAYER !== "undefined" && L === LAYER.FILL) {
                return activeSubColor?.[LAYER.FILL] || fillWhite || "#ffffff";
            }
            return activeSubColor?.[L] ?? (typeof currentColor === "string" ? currentColor : "#000000");
        }
        function getActiveCelCanvasForMove() {
            const L = activeLayer;
            const F = currentFrame;
            const key = typeof colorToHex === "function" ? colorToHex(_ctrlMovePickKeyForLayer(L)) : _ctrlMovePickKeyForLayer(L);
            const c = typeof getFrameCanvas === "function" ? getFrameCanvas(L, F, key) : null;
            return {
                canvas: c,
                L: L,
                F: F,
                key: key
            };
        }
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
            if (typeof renderAll === "function") renderAll();
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
            if (typeof renderAll === "function") renderAll();
            if (typeof updateTimelineHasContent === "function") updateTimelineHasContent(_ctrlMove.F);
            try {
                commitGlobalHistoryStep();
            } catch {}
            _ctrlMove.pointerId = null;
            _ctrlMove.canvas = null;
            _ctrlMove.ctx = null;
            _ctrlMove.snap = null;
        }
        const historyLimit = 50;
        const historyMap = new Map;
        const globalHistory = {
            undo: [],
            redo: []
        };
        let _pendingGlobalStep = null;
        let _globalStepDirty = false;
        function markGlobalHistoryDirty() {
            _globalStepDirty = true;
        }
        function beginGlobalHistoryStep(L = activeLayer, F = currentFrame, keyArg = null) {
            _globalStepDirty = false;
            if (L === PAPER_LAYER) {
                _pendingGlobalStep = null;
                return;
            }
            const key = resolveKeyFor(L, keyArg);
            if (!key) {
                _pendingGlobalStep = null;
                return;
            }
            _pendingGlobalStep = {
                L: L,
                F: F,
                key: key,
                before: snapshotFor(L, F, key)
            };
        }
        function commitGlobalHistoryStep() {
            const s = _pendingGlobalStep;
            _pendingGlobalStep = null;
            if (!s || !_globalStepDirty) return;
            const after = snapshotFor(s.L, s.F, s.key);
            if (!s.before && !after) return;
            globalHistory.undo.push({
                ...s,
                after: after
            });
            if (globalHistory.undo.length > historyLimit) globalHistory.undo.shift();
            globalHistory.redo.length = 0;
        }
        function _jumpToActionContext(L, F) {
            if (typeof setCurrentFrame === "function") setCurrentFrame(F); else currentFrame = F;
            if (typeof setActiveLayer === "function") setActiveLayer(L); else activeLayer = L;
            try {
                renderAll();
            } catch {}
        }
        function historyKey(L, F, key) {
            return `${L}:${F}:${String(key || "")}`;
        }
        function resolveKeyFor(L, key) {
            if (L === PAPER_LAYER) return null;
            const norm = v => colorToHex(v || "#000000");
            if (L === LAYER.FILL) {
                const k = key || activeSubColor?.[LAYER.FILL] || fillWhite || "#FFFFFF";
                return norm(k);
            }
            return norm(key || activeSubColor?.[L] || currentColor || "#000000");
        }
        function ensureHistory(L, F, key) {
            const k = historyKey(L, F, key);
            if (!historyMap.has(k)) historyMap.set(k, {
                undo: [],
                redo: []
            });
            return historyMap.get(k);
        }
        function snapshotFor(L, F, key) {
            const k = resolveKeyFor(L, key);
            if (!k) return null;
            const c = getFrameCanvas(L, F, k);
            if (!c || !c._hasContent) return null;
            try {
                const ctx = c.getContext("2d", {
                    willReadFrequently: true
                });
                return ctx.getImageData(0, 0, contentW, contentH);
            } catch {
                return null;
            }
        }
        function applySnapshot(L, F, key, shot) {
            const k = resolveKeyFor(L, key);
            if (!k) return;
            const c = getFrameCanvas(L, F, k);
            const ctx = c.getContext("2d", {
                willReadFrequently: true
            });
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
            const action = globalHistory.undo.pop();
            if (!action) return;
            globalHistory.redo.push(action);
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
        let currentFrame = 0;
        const _normC = document.createElement("canvas");
        _normC.width = _normC.height = 1;
        const _normCtx = _normC.getContext("2d", {
            willReadFrequently: true
        });
        function normalizeToHex(colorStr) {
            try {
                _normCtx.clearRect(0, 0, 1, 1);
                _normCtx.fillStyle = String(colorStr || "#000");
                _normCtx.fillRect(0, 0, 1, 1);
                const d = _normCtx.getImageData(0, 0, 1, 1).data;
                return "#" + [ d[0], d[1], d[2] ].map(v => v.toString(16).padStart(2, "0")).join("");
            } catch {
                return "#000000";
            }
        }
        function hexToRgb(hex) {
            const h = normalizeToHex(hex).slice(1);
            return {
                r: parseInt(h.slice(0, 2), 16),
                g: parseInt(h.slice(2, 4), 16),
                b: parseInt(h.slice(4, 6), 16)
            };
        }
        function rgbToHex(r, g, b) {
            return ("#" + [ r, g, b ].map(v => Math.max(0, Math.min(255, v | 0)).toString(16).padStart(2, "0")).join("")).toUpperCase();
        }
        function hsvToRgb(h, s, v) {
            h = (h % 360 + 360) % 360;
            s = clamp(s, 0, 1);
            v = clamp(v, 0, 1);
            const c = v * s;
            const x = c * (1 - Math.abs(h / 60 % 2 - 1));
            const m = v - c;
            let rp = 0, gp = 0, bp = 0;
            if (h < 60) {
                rp = c;
                gp = x;
                bp = 0;
            } else if (h < 120) {
                rp = x;
                gp = c;
                bp = 0;
            } else if (h < 180) {
                rp = 0;
                gp = c;
                bp = x;
            } else if (h < 240) {
                rp = 0;
                gp = x;
                bp = c;
            } else if (h < 300) {
                rp = x;
                gp = 0;
                bp = c;
            } else {
                rp = c;
                gp = 0;
                bp = x;
            }
            return {
                r: Math.round((rp + m) * 255),
                g: Math.round((gp + m) * 255),
                b: Math.round((bp + m) * 255)
            };
        }
        function rgbToHsv(r, g, b) {
            r /= 255;
            g /= 255;
            b /= 255;
            const max = Math.max(r, g, b), min = Math.min(r, g, b);
            const d = max - min;
            let h = 0;
            if (d !== 0) {
                if (max === r) h = 60 * ((g - b) / d % 6); else if (max === g) h = 60 * ((b - r) / d + 2); else h = 60 * ((r - g) / d + 4);
            }
            if (h < 0) h += 360;
            const s = max === 0 ? 0 : d / max;
            const v = max;
            return {
                h: h,
                s: s,
                v: v
            };
        }
        let hsvPick = {
            h: 0,
            s: 1,
            v: 1
        };
        let _wheelGeom = null;
        let _wheelRingImg = null;
        let _wheelTriangleCanvas = null;
        let _dragMode = null;
        function rememberLayerColorSafe() {
            try {
                rememberCurrentColorForLayer?.(activeLayer);
            } catch {}
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
        function computeWheelGeom() {
            if (!hsvWheelCanvas || !hsvWheelWrap) return null;
            const dprLocal = window.devicePixelRatio || 1;
            const rect = hsvWheelWrap.getBoundingClientRect();
            const sizeCss = Math.max(160, Math.floor(Math.min(rect.width, rect.height)));
            const size = Math.floor(sizeCss * dprLocal);
            hsvWheelCanvas.width = size;
            hsvWheelCanvas.height = size;
            const R = size / 2;
            const ringOuter = R * .96;
            const ringInner = R * .78;
            const ringMid = (ringOuter + ringInner) / 2;
            const sqSize = Math.floor(ringInner * 1.25);
            const sqLeft = Math.floor(R - sqSize / 2);
            const sqTop = Math.floor(R - sqSize / 2);
            return {
                size: size,
                dprLocal: dprLocal,
                R: R,
                ringOuter: ringOuter,
                ringInner: ringInner,
                ringMid: ringMid,
                sqLeft: sqLeft,
                sqTop: sqTop,
                sqSize: sqSize
            };
        }
        function buildRingImage(geom) {
            const {size: size, R: R, ringInner: ringInner, ringOuter: ringOuter} = geom;
            const img = new ImageData(size, size);
            const data = img.data;
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const dx = x - R;
                    const dy = y - R;
                    const dist = Math.hypot(dx, dy);
                    const i = (y * size + x) * 4;
                    if (dist >= ringInner && dist <= ringOuter) {
                        const ang = Math.atan2(dy, dx);
                        const h = (ang * 180 / Math.PI + 90 + 360) % 360;
                        const rgb = hsvToRgb(h, 1, 1);
                        data[i + 0] = rgb.r;
                        data[i + 1] = rgb.g;
                        data[i + 2] = rgb.b;
                        data[i + 3] = 255;
                    } else {
                        data[i + 3] = 0;
                    }
                }
            }
            return img;
        }
        function buildSVSquareImage(geom) {
            const {sqSize: sqSize, size: size} = geom;
            const img = new ImageData(sqSize, sqSize);
            const data = img.data;
            for (let y = 0; y < sqSize; y++) {
                const v = 1 - y / (sqSize - 1);
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
        function buildSVTriangleImage(geom) {
            const { size, R, ringInner } = geom;
            const triR = Math.floor(ringInner * 0.90);
            const img = new ImageData(size, size);
            const data = img.data;
            const angH = (hsvPick.h - 90) * (Math.PI / 180);
            const x1 = Math.cos(angH) * triR;
            const y1 = Math.sin(angH) * triR;
            const x2 = Math.cos(angH + 2 * Math.PI / 3) * triR;
            const y2 = Math.sin(angH + 2 * Math.PI / 3) * triR;
            const x3 = Math.cos(angH + 4 * Math.PI / 3) * triR;
            const y3 = Math.sin(angH + 4 * Math.PI / 3) * triR;
            const detT = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3);
            const minX = Math.floor(Math.min(x1, x2, x3) + R);
            const maxX = Math.ceil(Math.max(x1, x2, x3) + R);
            const minY = Math.floor(Math.min(y1, y2, y3) + R);
            const maxY = Math.ceil(Math.max(y1, y2, y3) + R);
            for (let y = minY; y <= maxY; y++) {
                for (let x = minX; x <= maxX; x++) {
                    if (x < 0 || x >= size || y < 0 || y >= size) continue;
                    const dx = x - R;
                    const dy = y - R;
                    const lambda1 = ((y2 - y3) * (dx - x3) + (x3 - x2) * (dy - y3)) / detT;
                    const lambda2 = ((y3 - y1) * (dx - x3) + (x1 - x3) * (dy - y3)) / detT;
                    const lambda3 = 1 - lambda1 - lambda2;
                    if (lambda1 >= 0 && lambda2 >= 0 && lambda3 >= 0) {
                        const vVal = lambda1 + lambda2;
                        const sVal = vVal > 0.0001 ? (lambda1 / vVal) : 0;
                        const rgb = hsvToRgb(hsvPick.h, sVal, vVal);
                        const idx = (y * size + x) * 4;
                        data[idx + 0] = rgb.r;
                        data[idx + 1] = rgb.g;
                        data[idx + 2] = rgb.b;
                        data[idx + 3] = 255;
                    }
                }
            }
            return { img, vertices: [{x:x1,y:y1}, {x:x2,y:y2}, {x:x3,y:y3}], triR };
        }
        function drawHSVWheel() {
            if (!hsvWheelCanvas) return;
            const ctx = hsvWheelCanvas.getContext("2d");
            if (!ctx) return;
            const geom = _wheelGeom = computeWheelGeom();
            if (!geom) return;
            ctx.clearRect(0, 0, geom.size, geom.size);
            if (!_wheelRingImg || !_wheelRingImg._size || _wheelRingImg._size !== geom.size) {
                _wheelRingImg = buildRingImage(geom);
                _wheelRingImg._size = geom.size;
            }
            ctx.putImageData(_wheelRingImg, 0, 0);
            let triData = null;
            if (pickerShape === "triangle") {
                triData = buildSVTriangleImage(geom);
                if (!_wheelTriangleCanvas) _wheelTriangleCanvas = document.createElement("canvas");
                if (_wheelTriangleCanvas.width !== geom.size) {
                    _wheelTriangleCanvas.width = geom.size;
                    _wheelTriangleCanvas.height = geom.size;
                }
                _wheelTriangleCanvas.getContext("2d").putImageData(triData.img, 0, 0);
                ctx.drawImage(_wheelTriangleCanvas, 0, 0);
            } else {
                const svImg = buildSVSquareImage(geom);
                ctx.putImageData(svImg, geom.sqLeft, geom.sqTop);
                ctx.save();
                ctx.strokeStyle = "rgba(255,255,255,0.12)";
                ctx.lineWidth = Math.max(1, geom.size * .004);
                ctx.strokeRect(geom.sqLeft + .5, geom.sqTop + .5, geom.sqSize - 1, geom.sqSize - 1);
                ctx.restore();
            }

            let mx, my;
            if (pickerShape === "triangle" && triData) {
                const v = hsvPick.v;
                const s = hsvPick.s;
                const l1 = s * v;
                const l2 = v * (1 - s);
                const l3 = 1 - v;
                const vs = triData.vertices;
                mx = geom.R + l1 * vs[0].x + l2 * vs[1].x + l3 * vs[2].x;
                my = geom.R + l1 * vs[0].y + l2 * vs[1].y + l3 * vs[2].y;
            } else {
                mx = geom.sqLeft + hsvPick.s * geom.sqSize;
                my = geom.sqTop + (1 - hsvPick.v) * geom.sqSize;
            }
            ctx.save();
            ctx.beginPath();
            ctx.arc(mx, my, Math.max(5, geom.size * .02), 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(0,0,0,0.65)";
            ctx.lineWidth = Math.max(2, geom.size * .007);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(mx, my, Math.max(4, geom.size * .017), 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(255,255,255,0.95)";
            ctx.lineWidth = Math.max(2, geom.size * .006);
            ctx.stroke();
            ctx.restore();
            const ang = (hsvPick.h - 90) * Math.PI / 180;
            const hx = geom.R + Math.cos(ang) * geom.ringMid;
            const hy = geom.R + Math.sin(ang) * geom.ringMid;
            ctx.save();
            ctx.beginPath();
            ctx.arc(hx, hy, Math.max(6, geom.size * .024), 0, Math.PI * 2);
            ctx.fillStyle = "rgba(0,0,0,0.55)";
            ctx.fill();
            ctx.beginPath();
            ctx.arc(hx, hy, Math.max(5, geom.size * .02), 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(255,255,255,0.95)";
            ctx.lineWidth = Math.max(2, geom.size * .006);
            ctx.stroke();
            ctx.restore();
        }
        function wheelLocalFromEvent(e) {
            const rect = hsvWheelCanvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) * (hsvWheelCanvas.width / rect.width);
            const y = (e.clientY - rect.top) * (hsvWheelCanvas.height / rect.height);
            return {
                x: x,
                y: y
            };
        }
        function hitTestWheel(x, y) {
            const g = _wheelGeom || computeWheelGeom();
            if (!g) return null;
            const dx = x - g.R;
            const dy = y - g.R;
            const dist = Math.hypot(dx, dy);
            if (pickerShape === "triangle") {
                if (dist >= g.ringInner && dist <= g.ringOuter) return "hue";
                const triR = Math.floor(g.ringInner * 0.90);
                const angH = (hsvPick.h - 90) * (Math.PI / 180);
                const x1 = Math.cos(angH) * triR;
                const y1 = Math.sin(angH) * triR;
                const x2 = Math.cos(angH + 2 * Math.PI / 3) * triR;
                const y2 = Math.sin(angH + 2 * Math.PI / 3) * triR;
                const x3 = Math.cos(angH + 4 * Math.PI / 3) * triR;
                const y3 = Math.sin(angH + 4 * Math.PI / 3) * triR;
                const detT = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3);
                const l1 = ((y2 - y3) * (dx - x3) + (x3 - x2) * (dy - y3)) / detT;
                const l2 = ((y3 - y1) * (dx - x3) + (x1 - x3) * (dy - y3)) / detT;
                const l3 = 1 - l1 - l2;
                if (l1 >= 0 && l2 >= 0 && l3 >= 0) return "sv";
                return null;
            }
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
            if (pickerShape === "triangle") {
                const dx = x - g.R;
                const dy = y - g.R;
                const triR = Math.floor(g.ringInner * 0.90);
                const angH = (hsvPick.h - 90) * (Math.PI / 180);
                const x1 = Math.cos(angH) * triR;
                const y1 = Math.sin(angH) * triR;
                const x2 = Math.cos(angH + 2 * Math.PI / 3) * triR;
                const y2 = Math.sin(angH + 2 * Math.PI / 3) * triR;
                const x3 = Math.cos(angH + 4 * Math.PI / 3) * triR;
                const y3 = Math.sin(angH + 4 * Math.PI / 3) * triR;
                const detT = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3);
                const l1 = ((y2 - y3) * (dx - x3) + (x3 - x2) * (dy - y3)) / detT;
                const l2 = ((y3 - y1) * (dx - x3) + (x1 - x3) * (dy - y3)) / detT;
                
                let cl1 = l1, cl2 = l2, cl3 = 1 - l1 - l2;
                if (cl1 < 0) { cl1 = 0; cl2 = l2 / (l2 + cl3); cl3 = 1 - cl2; }
                else if (cl2 < 0) { cl2 = 0; cl1 = cl1 / (cl1 + cl3); cl3 = 1 - cl1; }
                else if (cl3 < 0) { cl3 = 0; cl1 = cl1 / (cl1 + cl2); cl2 = 1 - cl1; }

                hsvPick.v = cl1 + cl2;
                hsvPick.s = hsvPick.v > 0.0001 ? (cl1 / hsvPick.v) : 0;
            } else {
                const sx = clamp((x - g.sqLeft) / g.sqSize, 0, 1);
                const vy = clamp(1 - (y - g.sqTop) / g.sqSize, 0, 1);
                hsvPick.s = sx;
                hsvPick.v = vy;
            }
            const rgb = hsvToRgb(hsvPick.h, hsvPick.s, hsvPick.v);
            currentColor = rgbToHex(rgb.r, rgb.g, rgb.b);
            setColorSwatch();
            setHSVPreviewBox();
            rememberLayerColorSafe();
            drawHSVWheel();
        }
        function initHSVWheelPicker() {
            if (!hsvWheelCanvas || !hsvWheelWrap) return;
            const rgb = hexToRgb(currentColor || "#000000");
            hsvPick = rgbToHsv(rgb.r, rgb.g, rgb.b);
            drawHSVWheel();
            let dragging = false;
            hsvWheelCanvas.addEventListener("pointerdown", e => {
                const p = wheelLocalFromEvent(e);
                _dragMode = hitTestWheel(p.x, p.y);
                if (!_dragMode) return;
                hsvWheelCanvas.setPointerCapture(e.pointerId);
                dragging = true;
                if (_dragMode === "hue") updateFromHuePoint(p.x, p.y); else updateFromSVPoint(p.x, p.y);
                e.preventDefault();
            }, {
                passive: false
            });
            hsvWheelCanvas.addEventListener("pointermove", e => {
                if (!dragging || !_dragMode) return;
                const p = wheelLocalFromEvent(e);
                if (_dragMode === "hue") updateFromHuePoint(p.x, p.y); else updateFromSVPoint(p.x, p.y);
                e.preventDefault();
            }, {
                passive: false
            });
            hsvWheelCanvas.addEventListener("pointerup", e => {
                dragging = false;
                _dragMode = null;
                try {
                    hsvWheelCanvas.releasePointerCapture(e.pointerId);
                } catch {}
            });
            hsvWheelCanvas.addEventListener("pointercancel", () => {
                dragging = false;
                _dragMode = null;
            });
            new ResizeObserver(() => drawHSVWheel()).observe(hsvWheelWrap);
            const triCheck = document.getElementById("trianglePickerToggle");
            if (triCheck) {
                triCheck.checked = pickerShape === "triangle";
                triCheck.addEventListener("change", e => {
                    pickerShape = e.target.checked ? "triangle" : "square";
                    try {
                        localStorage.setItem("celstomp_picker_shape", pickerShape);
                    } catch {}
                    drawHSVWheel();
                });
            }
        }
        let _brushPrevEl = null;
        let _brushPrevCanvas = null;
        let _brushPrevLastEvt = null;
        let _brushPrevRAF = 0;
        let _brushPrevLastXY = null;
        function brushShapeForType(kind) {
            const t = String(kind || "circle");
            if (t === "circle" || t === "square" || t === "diamond" || t === "oval-h" || t === "oval-v" || t === "rect-h" || t === "rect-v" || t === "triangle") return t;
            return "circle";
        }
        function brushShapeDimensions(shape, size) {
            const s = Math.max(1, Math.round(size || 1));
            switch (brushShapeForType(shape)) {
                case "oval-h":
                    return {
                        w: s,
                        h: Math.max(1, Math.round(s * 0.55))
                    };
                case "oval-v":
                    return {
                        w: Math.max(1, Math.round(s * 0.55)),
                        h: s
                    };
                case "rect-h":
                    return {
                        w: s,
                        h: Math.max(1, Math.round(s * 0.4))
                    };
                case "rect-v":
                    return {
                        w: Math.max(1, Math.round(s * 0.4)),
                        h: s
                    };
                default:
                    return {
                        w: s,
                        h: s
                    };
            }
        }
        function clamp01(v) {
            return Math.max(0, Math.min(1, Number(v) || 0));
        }
        function mergeBrushSettings(base, patch) {
            const next = {
                ...base,
                ...patch
            };
            next.shape = brushShapeForType(next.shape);
            next.size = Math.max(1, Math.round(next.size || 1));
            next.opacity = clamp01(next.opacity);
            next.angle = Math.max(-90, Math.min(90, Math.round(Number(next.angle) || 0)));
            return next;
        }
        function setActiveToolSettings(nextSettings) {
            if (tool === "eraser") {
                eraserSettings = mergeBrushSettings(eraserSettings, nextSettings);
                eraserSize = eraserSettings.size;
            } else {
                brushSettings = mergeBrushSettings(brushSettings, nextSettings);
                brushType = brushSettings.shape;
                brushSize = brushSettings.size;
            }
        }
        function refreshToolSettingsUI() {
            const isBrush = tool === "brush";
            const isEraser = tool === "eraser";
            if (toolSettingsSection) toolSettingsSection.hidden = !(isBrush || isEraser);
            if (!isBrush && !isEraser) return;
            const s = isEraser ? eraserSettings : brushSettings;
            if (toolSettingsTitle) toolSettingsTitle.textContent = isEraser ? "Eraser" : "Brushes";
            safeSetValue(brushSizeInput, s.size);
            safeSetValue(brushSizeNumInput, s.size);
            safeSetValue(toolOpacityRange, Math.round(s.opacity * 100));
            safeSetValue(toolAngleRange, s.angle);
            const activeShape = document.querySelector('input[name="brushShape"][value="' + s.shape + '"]');
            if (activeShape) activeShape.checked = true;
        }
        function setFoldExpanded(btn, body, open) {
            if (!btn || !body) return;
            btn.setAttribute("aria-expanded", open ? "true" : "false");
            body.hidden = !open;
        }
        function wireToolSettingsFolds() {
            if (toolFoldBrushesBtn && toolFoldBrushesBody && !toolFoldBrushesBtn.dataset.wired) {
                toolFoldBrushesBtn.dataset.wired = "1";
                setFoldExpanded(toolFoldBrushesBtn, toolFoldBrushesBody, true);
                toolFoldBrushesBtn.addEventListener("click", () => {
                    const open = toolFoldBrushesBtn.getAttribute("aria-expanded") === "true";
                    setFoldExpanded(toolFoldBrushesBtn, toolFoldBrushesBody, !open);
                });
            }
            if (toolFoldSettingsBtn && toolFoldSettingsBody && !toolFoldSettingsBtn.dataset.wired) {
                toolFoldSettingsBtn.dataset.wired = "1";
                setFoldExpanded(toolFoldSettingsBtn, toolFoldSettingsBody, true);
                toolFoldSettingsBtn.addEventListener("click", () => {
                    const open = toolFoldSettingsBtn.getAttribute("aria-expanded") === "true";
                    setFoldExpanded(toolFoldSettingsBtn, toolFoldSettingsBody, !open);
                });
            }
        }
        function wireBrushShapeTooltips() {
            if (!brushShapeSeg || !brushShapeTooltip || brushShapeSeg.dataset.tooltipWired === "1") return;
            brushShapeSeg.dataset.tooltipWired = "1";
            let pressTimer = 0;
            let activeTip = null;
            const GAP = 8;
            const isHoverCapable = () => window.matchMedia("(hover: hover)").matches;
            const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
            const hideTip = () => {
                activeTip = null;
                brushShapeTooltip.hidden = true;
                brushShapeTooltip.textContent = "";
            };
            const getBasePoint = state => {
                const r = state.label.getBoundingClientRect();
                if (state.mode === "press") {
                    return {
                        x: r.right,
                        y: r.top + r.height / 2,
                        rect: r
                    };
                }
                const x = Number.isFinite(state.clientX) ? state.clientX : r.left + r.width / 2;
                const y = Number.isFinite(state.clientY) ? state.clientY : r.top + r.height / 2;
                return {
                    x: x,
                    y: y,
                    rect: r
                };
            };
            const positionTip = state => {
                if (!state || brushShapeTooltip.hidden) return;
                const vw = window.innerWidth || document.documentElement.clientWidth || 0;
                const vh = window.innerHeight || document.documentElement.clientHeight || 0;
                const base = getBasePoint(state);
                const r = base.rect;
                const tipRect = brushShapeTooltip.getBoundingClientRect();
                let left = base.x + GAP;
                let top = base.y + GAP;
                const canRight = left + tipRect.width <= vw - GAP;
                const canBottom = top + tipRect.height <= vh - GAP;
                if (!canRight) left = base.x - tipRect.width - GAP;
                if (!canBottom) top = base.y - tipRect.height - GAP;
                if (left < GAP) {
                    left = r.left + (r.width - tipRect.width) / 2;
                }
                if (top < GAP) {
                    top = r.bottom + GAP;
                }
                if (top + tipRect.height > vh - GAP) {
                    top = r.top - tipRect.height - GAP;
                }
                brushShapeTooltip.style.left = `${Math.round(clamp(left, GAP, Math.max(GAP, vw - tipRect.width - GAP)))}px`;
                brushShapeTooltip.style.top = `${Math.round(clamp(top, GAP, Math.max(GAP, vh - tipRect.height - GAP)))}px`;
            };
            const showTip = (label, x, y, mode = "hover") => {
                const text = label?.title || "";
                if (!text) return;
                activeTip = {
                    label: label,
                    clientX: x,
                    clientY: y,
                    mode: mode
                };
                brushShapeTooltip.textContent = text;
                brushShapeTooltip.hidden = false;
                positionTip(activeTip);
            };
            brushShapeSeg.addEventListener("pointerdown", e => {
                const label = e.target?.closest?.("label[data-brush-shape]");
                if (!label) return;
                clearTimeout(pressTimer);
                pressTimer = window.setTimeout(() => showTip(label, e.clientX, e.clientY, "press"), 500);
            });
            ["pointerup", "pointercancel", "pointerleave", "pointermove"].forEach(evt => {
                brushShapeSeg.addEventListener(evt, e => {
                    clearTimeout(pressTimer);
                    if (evt === "pointermove" && activeTip && activeTip.mode === "hover") {
                        const label = e.target?.closest?.("label[data-brush-shape]");
                        if (!label) return;
                        activeTip.label = label;
                        activeTip.clientX = e.clientX;
                        activeTip.clientY = e.clientY;
                        positionTip(activeTip);
                        return;
                    }
                    if (evt !== "pointermove") hideTip();
                }, {
                    passive: true
                });
            });
            brushShapeSeg.addEventListener("mouseover", e => {
                if (!isHoverCapable()) return;
                const label = e.target?.closest?.("label[data-brush-shape]");
                if (!label) return;
                showTip(label, e.clientX, e.clientY, "hover");
            });
            brushShapeSeg.addEventListener("mouseout", hideTip);
            const onViewportMove = () => {
                if (!activeTip || brushShapeTooltip.hidden) return;
                positionTip(activeTip);
            };
            window.addEventListener("scroll", onViewportMove, true);
            window.addEventListener("resize", onViewportMove, {
                passive: true
            });
        }
        function initBrushCursorPreview(inputCanvasEl) {
            _brushPrevCanvas = inputCanvasEl;
            _brushPrevEl = document.getElementById("brushCursorPreview");
            if (!_brushPrevCanvas || !_brushPrevEl) return;
            let hovering = false;
            let down = false;
            const show = () => {
                _brushPrevEl.style.display = "block";
            };
            const hide = () => {
                _brushPrevEl.style.display = "none";
            };
            _brushPrevCanvas.addEventListener("pointerenter", () => {
                hovering = true;
                show();
                scheduleBrushPreviewUpdate(true);
            });
            _brushPrevCanvas.addEventListener("pointerleave", () => {
                hovering = false;
                if (!down) hide();
            });
            _brushPrevCanvas.addEventListener("pointermove", e => {
                _brushPrevLastEvt = e;
                _brushPrevLastXY = {
                    x: e.clientX,
                    y: e.clientY
                };
                scheduleBrushPreviewUpdate();
            });
            _brushPrevCanvas.addEventListener("pointerdown", e => {
                down = true;
                _brushPrevLastEvt = e;
                _brushPrevLastXY = {
                    x: e.clientX,
                    y: e.clientY
                };
                show();
                scheduleBrushPreviewUpdate(true);
            });
            window.addEventListener("pointerup", () => {
                down = false;
                if (!hovering) hide();
                scheduleBrushPreviewUpdate(true);
            }, {
                passive: true
            });
            _brushPrevCanvas.addEventListener("wheel", () => {
                scheduleBrushPreviewUpdate(true);
            }, {
                passive: true
            });
            try {
                brushSizeInput?.addEventListener("input", () => scheduleBrushPreviewUpdate(true));
            } catch {}
            try {
                eraserSizeInput?.addEventListener("input", () => scheduleBrushPreviewUpdate(true));
            } catch {}
            document.addEventListener("change", e => {
                const t = e.target;
                if (!(t instanceof HTMLInputElement)) return;
                if (t.name === "brush" || t.name === "brushShape" || t.name === "tool") scheduleBrushPreviewUpdate(true);
            }, {
                passive: true
            });
            hide();
        }
        function scheduleBrushPreviewUpdate(force = false) {
            if (!_brushPrevEl || !_brushPrevCanvas) return;
            if (_brushPrevRAF && !force) return;
            _brushPrevRAF = requestAnimationFrame(() => {
                _brushPrevRAF = 0;
                updateBrushPreview();
            });
        }
        function getActiveToolKindForPreview() {
            return String(typeof tool !== "undefined" && tool ? tool : "");
        }
        function getBrushSizeForPreview(toolKind) {
            if (toolKind === "eraser") return Number(eraserSettings?.size ?? eraserSize ?? 8);
            return Number(brushSettings?.size ?? brushSize ?? 6);
        }
        function updateBrushPreview() {
            if (!_brushPrevEl || !_brushPrevCanvas) return;
            const toolKind = getActiveToolKindForPreview();
            const isBrush = toolKind === "brush";
            const isEraser = toolKind === "eraser";
            if (!isBrush && !isEraser) {
                _brushPrevEl.style.display = "none";
                return;
            }
            const pt = _brushPrevLastXY;
            if (!pt) return;
            const cx = pt.x;
            const cy = pt.y;
            const z = typeof zoom === "number" && isFinite(zoom) ? zoom : 1;
            const settings = isEraser ? eraserSettings : brushSettings;
            const renderSettings = normalizedBrushRenderSettings(settings);
            const shape = brushShapeForType(renderSettings.shape || "circle");
            const sizeContentPx = Math.max(1, renderSettings.size || getBrushSizeForPreview(isEraser ? "eraser" : "brush"));
            const dim = brushShapeDimensions(shape, sizeContentPx);
            const widthCssPx = Math.max(2, dim.w * z);
            const heightCssPx = Math.max(2, dim.h * z);
            _brushPrevEl.classList.remove("simple");
            _brushPrevEl.classList.toggle("eraser", !!isEraser);
            _brushPrevEl.style.border = "1px solid rgba(255,255,255,.95)";
            _brushPrevEl.style.boxShadow = "0 0 0 1px rgba(0,0,0,.78)";
            _brushPrevEl.style.borderStyle = isEraser ? "dashed" : "solid";
            _brushPrevEl.style.left = `${cx}px`;
            _brushPrevEl.style.top = `${cy}px`;
            _brushPrevEl.style.width = `${widthCssPx}px`;
            _brushPrevEl.style.height = `${heightCssPx}px`;
            _brushPrevEl.style.borderRadius = "0";
            _brushPrevEl.style.clipPath = "none";
            let shapeRotation = 0;
            if (shape === "circle" || shape === "oval-h" || shape === "oval-v") {
                _brushPrevEl.style.borderRadius = "999px";
            } else if (shape === "diamond") {
                shapeRotation = 45;
            } else if (shape === "triangle") {
                _brushPrevEl.style.clipPath = "polygon(50% 0%, 100% 100%, 0% 100%)";
            }
            _brushPrevEl.style.transform = `translate(-50%, -50%) rotate(${shapeRotation + (renderSettings.angle || 0)}deg)`;
            _brushPrevEl.style.display = "block";
        }
        function framesToSF(f) {
            return {
                s: Math.floor(f / fps),
                f: f % fps
            };
        }
        function sfString(f) {
            const o = framesToSF(f);
            return `${o.s}s+${o.f}f`;
        }
        function resizeCanvases() {
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
            for (const c of [ boundsCanvas, drawCanvas, fxCanvas ]) {
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
            const devX = sx * dpr;
            const devY = sy * dpr;
            const cx = (devX - offsetX) / (zoom * dpr);
            const cy = (devY - offsetY) / (zoom * dpr);
            return {
                x: cx,
                y: cy
            };
        }
        function getCanvasPointer(e) {
            const rect = drawCanvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            return {
                x: x,
                y: y
            };
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
        function updateHUD() {
            safeText(hudFps, String(fps));
            safeText(frameInfo, `${currentFrame + 1} / ${totalFrames}`);
            safeText(hudTime, sfString(currentFrame));
            safeText(timeCounter, sfString(currentFrame));
            safeText(zoomInfo, `${Math.round(zoom * 100)}%`);
            safeText(toolName, tool.replace("-", " ").replace(/\b\w/g, m => m.toUpperCase()));
            safeText(fpsLabel, String(fps));
            safeText(secLabel, String(seconds));
            refreshToolSettingsUI();
        }
        const _colorCtx = (() => {
            const c = document.createElement("canvas");
            c.width = c.height = 1;
            return c.getContext("2d", {
                willReadFrequently: true
            });
        })();
        function colorToHex(c) {
            const ctx = _colorCtx;
            if (!ctx) return String(c || "#000").trim();
            ctx.clearRect(0, 0, 1, 1);
            ctx.fillStyle = String(c || "#000");
            ctx.fillRect(0, 0, 1, 1);
            const d = ctx.getImageData(0, 0, 1, 1).data;
            const r = d[0] | 0, g = d[1] | 0, b = d[2] | 0;
            return "#" + [ r, g, b ].map(v => v.toString(16).padStart(2, "0")).join("").toUpperCase();
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
        function getFrameCanvas(L, F, colorStr) {
            const key = colorToHex(colorStr || activeSubColor?.[L] || currentColor || "#000");
            const sub = ensureSublayer(L, key);
            if (!sub) return null;
            if (!sub.frames[F]) {
                const off = document.createElement("canvas");
                off.width = contentW;
                off.height = contentH;
                off._hasContent = false;
                sub.frames[F] = off;
            }
            return sub.frames[F];
        }
        function markFrameHasContent(L, F, colorStr) {
            const c = getFrameCanvas(L, F, colorStr);
            if (c) c._hasContent = true;
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
        function frameLayerHasContent(L, F) {
            return mainLayerHasContent(L, F);
        }
        function hasCel(F) {
            return MAIN_LAYERS.some(L => mainLayerHasContent(L, F));
        }
        function drawExactCel(ctx, idx) {
            for (const L of mainLayerOrder) {
                const layer = layers[L];
                if (!layer) continue;
                const op = layer.opacity ?? 1;
                if (op <= 0) continue;
                const srcCanvases = canvasesWithContentForMainLayerFrame(L, idx);
                if (!srcCanvases.length) continue;
                ctx.save();
                ctx.globalAlpha *= op;
                for (const off of srcCanvases) ctx.drawImage(off, 0, 0);
                ctx.restore();
            }
        }
        let _paperColorPicker = null;
        function ensurePaperColorPicker() {
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
        function setCanvasBgColor(next) {
            canvasBgColor = normalizeToHex(next || canvasBgColor || "#bfbfbf");
            if (bgColorInput) bgColorInput.value = canvasBgColor;
            renderPaperSwatch();
            renderAll();
        }
        function openPaperColorPicker() {
            const picker = ensurePaperColorPicker();
            picker.value = normalizeToHex(canvasBgColor);
            if (picker === bgColorInput) {
                return;
            }
            const onInput = () => setCanvasBgColor(picker.value);
            picker.addEventListener("input", onInput);
            picker.addEventListener("change", () => picker.removeEventListener("input", onInput), {
                once: true
            });
            try {
                picker.showPicker?.();
            } catch {}
            picker.click();
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
        function layerValueForLayer(L) {
            if (L === PAPER_LAYER) return "paper";
            if (L === LAYER.SKETCH) return "sketch";
            if (L === LAYER.LINE) return "line";
            if (L === LAYER.SHADE) return "shade";
            if (L === LAYER.COLOR) return "color";
            return "fill";
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
            renderAll();
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
        let _swatchDnD = null;
        function swatchColorKey(c) {
            c = (c || "").trim();
            if (!c) return "#000000";
            if (c[0] === "#") {
                let h = c.slice(1).replace(/[^0-9a-fA-F]/g, "");
                if (h.length === 3) h = h.split("").map(ch => ch + ch).join("");
                if (h.length >= 6) h = h.slice(0, 6);
                while (h.length < 6) h += "0";
                return ("#" + h).toUpperCase();
            }
            const m = c.match(/rgba?\(([^)]+)\)/i);
            if (m) {
                const parts = m[1].split(/[,/ ]+/).filter(Boolean);
                const r = Math.max(0, Math.min(255, (Number(parts[0]) || 0) | 0));
                const g = Math.max(0, Math.min(255, (Number(parts[1]) || 0) | 0));
                const b = Math.max(0, Math.min(255, (Number(parts[2]) || 0) | 0));
                return ("#" + r.toString(16).padStart(2, "0") + g.toString(16).padStart(2, "0") + b.toString(16).padStart(2, "0")).toUpperCase();
            }
            try {
                const hex = colorToHex(c);
                if (hex && /^#[0-9A-F]{6}$/.test(hex)) return hex;
            } catch {}
            return c.toUpperCase();
        }
        function normalizeLayerSwatchKeys(layer) {
            if (!layer) return;
            if (!layer.sublayers) layer.sublayers = new Map;
            if (!layer.suborder) layer.suborder = [];
            const m = layer.sublayers;
            for (const [k, sw] of Array.from(m.entries())) {
                const c = swatchColorKey(k);
                if (c !== k) {
                    if (!m.has(c)) {
                        m.delete(k);
                        m.set(c, sw);
                    } else {
                        m.delete(k);
                    }
                }
                if (sw && typeof sw === "object") {
                    sw.key = sw._key = sw.hex = c;
                }
            }
            const newOrd = [];
            const seen = new Set;
            for (const k of Array.isArray(layer.suborder) ? layer.suborder : []) {
                const c = swatchColorKey(k);
                if (!seen.has(c) && m.has(c)) {
                    seen.add(c);
                    newOrd.push(c);
                }
            }
            layer.suborder = newOrd;
            for (const [k, sw] of m.entries()) {
                if (!sw || typeof sw !== "object") continue;
                if (sw.parentKey) sw.parentKey = swatchColorKey(sw.parentKey);
                if (Array.isArray(sw.children)) {
                    const kids = [];
                    const kseen = new Set;
                    for (const ck of sw.children) {
                        const cc = swatchColorKey(ck);
                        if (!kseen.has(cc) && m.has(cc)) {
                            kseen.add(cc);
                            kids.push(cc);
                        }
                    }
                    sw.children = kids;
                }
            }
        }
        function getMainLayerById(layerId) {
            const idx = Number(layerId);
            if (!Number.isFinite(idx)) return null;
            return layers && layers[idx] ? layers[idx] : null;
        }
        function getOrderArray(layer) {
            if (!layer) return null;
            if (Array.isArray(layer.suborder)) return layer.suborder;
            if (Array.isArray(layer.order)) return layer.order;
            if (Array.isArray(layer.swatchOrder)) return layer.swatchOrder;
            return null;
        }
        function getSwatch(layer, key) {
            if (!layer || !key) return null;
            const raw = String(key);
            key = swatchColorKey(raw);
            if (layer.sublayers && typeof layer.sublayers.get === "function") {
                return layer.sublayers.get(key) || layer.sublayers.get(raw) || null;
            }
            if (layer.swatches && typeof layer.swatches === "object" && !Array.isArray(layer.swatches)) {
                return layer.swatches[key] || null;
            }
            if (layer.colors && typeof layer.colors === "object" && !Array.isArray(layer.colors)) {
                return layer.colors[key] || null;
            }
            if (Array.isArray(layer.swatches)) {
                return layer.swatches.find(s => (s.key ?? s._key ?? s.hex ?? s.id) === key) || null;
            }
            return null;
        }
        function removeSwatch(layer, key) {
            key = swatchColorKey(String(key || ""));
            if (!layer) return null;
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
        function insertSwatch(layer, key, sw) {
            key = swatchColorKey(String(key || ""));
            if (sw && typeof sw === "object") sw.key = sw._key = sw.hex = key;
            if (!layer || !sw) return;
            if (layer.sublayers && typeof layer.sublayers.set === "function") {
                layer.sublayers.set(key, sw);
                const ord = getOrderArray(layer);
                if (ord && !ord.includes(key)) ord.push(key);
                return;
            }
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
        function ensureChildrenArr(parentSwatch) {
            if (!parentSwatch) return null;
            if (!Array.isArray(parentSwatch.children)) parentSwatch.children = [];
            return parentSwatch.children;
        }
        function detachFromParentIfAny(layer, sw, key) {
            if (!layer || !sw) return;
            const parentKey = sw.parentKey;
            if (!parentKey) return;
            const parent = getSwatch(layer, parentKey);
            if (parent && Array.isArray(parent.children)) {
                parent.children = parent.children.filter(k => k !== key);
            }
            sw.parentKey = null;
        }
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
        function readSwatchDragPayload(dt) {
            if (!dt) return null;
            let raw = "";
            try {
                raw = dt.getData("application/x-celstomp-swatch") || "";
            } catch {}
            if (!raw) {
                try {
                    raw = dt.getData("text/plain") || "";
                } catch {}
            }
            if (!raw) return null;
            try {
                const obj = JSON.parse(raw);
                if (obj && obj.kind === "celstomp-swatch" && obj.layerId != null && obj.key) return obj;
            } catch {}
            return null;
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
        function insertIntoSuborderAfter(suborder, afterKey, key) {
            const oldIdx = suborder.indexOf(key);
            if (oldIdx >= 0) suborder.splice(oldIdx, 1);
            const i = suborder.indexOf(afterKey);
            if (i < 0) {
                suborder.push(key);
            } else {
                suborder.splice(i + 1, 0, key);
            }
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
                    setPickerToColorString?.(srcKey);
                } catch {}
                try {
                    setColorSwatch?.();
                } catch {}
                try {
                    setHSVPreviewBox?.();
                } catch {}
                try {
                    updateHUD?.();
                } catch {}
            }
            renderLayerSwatches(srcL);
            if (!sameLayer) renderLayerSwatches(dstL);
            try {
                refreshTimelineRowHasContentAll();
            } catch {}
            try {
                renderAll?.();
            } catch {}
            return true;
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
                        activeLayer = L;
                        if (Array.isArray(activeSubColor)) activeSubColor[L] = k;
                        currentColor = k;
                        try {
                            setPickerToColorString?.(k);
                        } catch {}
                        try {
                            setColorSwatch?.();
                        } catch {}
                        try {
                            setHSVPreviewBox?.();
                        } catch {}
                        setLayerRadioChecked(L);
                        try {
                            updateHUD?.();
                        } catch {}
                        renderLayerSwatches();
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
        let timelineFrameWidth = 30;
        let soloLayer = null;
        let layerVisibility = {};
        let layerLocks = {};
        let layerOpacities = {};

        let straightLineMode = false;
        let straightLineStart = null;
        let temporaryEyedropper = false;
        let previousTool = null;
        function wireQoLFeatures() {
            if (document._celstompQoLWired) return;
            document._celstompQoLWired = true;

            wireShortcutsModal();
            wireUnsavedChangesGuard();
            wireTimelineEnhancements();
            wireLayerQoL();
            wirePaletteQoL();
            wireExtraKeyboardShortcuts();
        }
        function wireShortcutsModal() {
            const modal = document.getElementById("shortcutsModal");
            const backdrop = document.getElementById("shortcutsModalBackdrop");
            const closeBtn = document.getElementById("shortcutsCloseBtn");
            if (!modal || !backdrop || !closeBtn) return;

            const toggleModal = show => {
                if (show) {
                    modal.hidden = false;
                    backdrop.hidden = false;
                } else {
                    modal.hidden = true;
                    backdrop.hidden = true;
                }
            };

            closeBtn.addEventListener("click", () => toggleModal(false));
            backdrop.addEventListener("click", () => toggleModal(false));

            document.addEventListener("keydown", e => {
                if (e.key === "?" && !isTyping(e.currentTarget.activeElement)) {
                    e.preventDefault();
                    toggleModal(!modal.hidden);
                }
            }, {
                passive: false
            });
        }
        function isTyping(el) {
            if (!el) return false;
            const tag = (el.tagName || "").toLowerCase();
            return tag === "input" || tag === "textarea" || el.isContentEditable;
        }
        function wireUnsavedChangesGuard() {
            window.addEventListener("beforeunload", e => {
                if (markProjectDirty && document.querySelector("#saveStateBadge")?.textContent !== "Saved") {
                    e.preventDefault();
                    e.returnValue = "";
                    return "";
                }
            });
        }
        function wireTimelineEnhancements() {
            const insertBtn = document.getElementById("insertFrameBtn");
            const deleteBtn = document.getElementById("deleteFrameBtn");
            const gotoInput = document.getElementById("gotoFrameInput");
            const gotoBtn = document.getElementById("gotoFrameBtn");
            const zoomIn = document.getElementById("zoomTimelineIn");
            const zoomOut = document.getElementById("zoomTimelineOut");

            if (insertBtn) {
                insertBtn.addEventListener("click", () => insertFrame(currentFrame));
            }
            if (deleteBtn) {
                deleteBtn.addEventListener("click", () => deleteFrame(currentFrame));
            }
            if (gotoBtn && gotoInput) {
                gotoBtn.addEventListener("click", () => {
                    const frame = parseInt(gotoInput.value, 10);
                    if (Number.isFinite(frame) && frame >= 1 && frame <= totalFrames) {
                        gotoFrame(frame - 1);
                        gotoInput.value = "";
                    }
                });
                gotoInput.addEventListener("keydown", e => {
                    if (e.key === "Enter") {
                        gotoBtn.click();
                    }
                });
            }
            if (zoomIn) {
                zoomIn.addEventListener("click", () => {
                    timelineFrameWidth = Math.min(100, timelineFrameWidth + 5);
                    renderTimeline();
                });
            }
            if (zoomOut) {
                zoomOut.addEventListener("click", () => {
                    timelineFrameWidth = Math.max(15, timelineFrameWidth - 5);
                    renderTimeline();
                });
            }
        }
        function insertFrame(frameIndex) {
            beginGlobalHistoryStep();
            for (let i = totalFrames - 1; i >= frameIndex; i--) {
                const src = getFrameCanvas(LAYER.LINE, i, null);
                if (src) {
                    const ctx = getFrameCanvas(LAYER.LINE, i + 1, null);
                    if (ctx) {
                        ctx.clearRect(0, 0, contentW, contentH);
                        ctx.drawImage(src, 0, 0);
                    }
                }
            }
            totalFrames++;
            markProjectDirty();
            renderTimeline();
            commitGlobalHistoryStep();
        }
        function deleteFrame(frameIndex) {
            if (totalFrames <= 1) {
                alert("Cannot delete the last frame");
                return;
            }
            beginGlobalHistoryStep();
            for (let i = frameIndex; i < totalFrames - 1; i++) {
                const src = getFrameCanvas(LAYER.LINE, i + 1, null);
                if (src) {
                    const ctx = getFrameCanvas(LAYER.LINE, i, null);
                    if (ctx) {
                        ctx.clearRect(0, 0, contentW, contentH);
                        ctx.drawImage(src, 0, 0);
                    }
                }
            }
            const last = getFrameCanvas(LAYER.LINE, totalFrames - 1, null);
            if (last) {
                const ctx = last.getContext("2d");
                if (ctx) ctx.clearRect(0, 0, contentW, contentH);
            }
            totalFrames--;
            if (currentFrame >= totalFrames) currentFrame = totalFrames - 1;
            markProjectDirty();
            renderTimeline();
            commitGlobalHistoryStep();
        }
        function wireLayerQoL() {
            const soloBtn = document.getElementById("soloLayerBtn");
            const showAllBtn = document.getElementById("showAllLayersBtn");
            if (soloBtn) {
                soloBtn.addEventListener("click", () => {
                    if (soloLayer === activeLayer) {
                        soloLayer = null;
                        soloBtn.textContent = "Solo";
                        soloBtn.style.background = "";
                    } else {
                        soloLayer = activeLayer;
                        soloBtn.textContent = `Solo ${getLayerName(activeLayer)}`;
                        soloBtn.style.background = "rgba(255,215,0,0.3)";
                    }
                    renderAll();
                });
            }
            if (showAllBtn) {
                showAllBtn.addEventListener("click", () => {
                    soloLayer = null;
                    layerVisibility = {};
                    layerLocks = {};
                    if (soloBtn) {
                        soloBtn.textContent = "Solo";
                        soloBtn.style.background = "";
                    }
                    renderAll();
                });
            }
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
        function wirePaletteQoL() {
            const newBtn = document.getElementById("newPaletteBtn");
            const exportBtn = document.getElementById("exportPaletteBtn");
            const importBtn = document.getElementById("importPaletteBtn");
            const loadFileInp = document.createElement("input");
            loadFileInp.type = "file";
            loadFileInp.accept = ".json,application/json";
            loadFileInp.style.display = "none";
            document.body.appendChild(loadFileInp);

            if (newBtn) {
                newBtn.addEventListener("click", () => {
                    colorPalette = [];
                    renderPalette();
                    markProjectDirty();
                });
            }
            if (exportBtn) {
                exportBtn.addEventListener("click", () => {
                    const data = JSON.stringify({
                        palette: colorPalette,
                        version: 1
                    }, null, 2);
                    const blob = new Blob([data], {
                        type: "application/json"
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "celstomp-palette.json";
                    a.click();
                    URL.revokeObjectURL(url);
                });
            }
            if (importBtn) {
                importBtn.addEventListener("click", () => loadFileInp.click());
                loadFileInp.addEventListener("change", e => {
                    const file = e.target.files?.[0];
                    if (file) {
                        const reader = new FileReader;
                        reader.onload = ev => {
                            try {
                                const data = JSON.parse(ev.target.result);
                                if (data.palette && Array.isArray(data.palette)) {
                                    colorPalette = data.palette;
                                    renderPalette();
                                    markProjectDirty();
                                }
                            } catch (err) {
                                alert("Failed to import palette: " + err.message);
                            }
                        };
                        reader.readAsText(file);
                    }
                    loadFileInp.value = "";
                });
            }
        }
        function wireExtraKeyboardShortcuts() {
            document.addEventListener("keydown", e => {
                if (e.defaultPrevented) return;
                if (isTyping(document.activeElement)) return;
                const ctrl = e.ctrlKey || e.metaKey;
                const k = (e.key || "").toLowerCase();

                if (k === "?" && !e.shiftKey) {
                    e.preventDefault();
                    const modal = document.getElementById("shortcutsModal");
                    const backdrop = document.getElementById("shortcutsModalBackdrop");
                    if (modal && backdrop) {
                        modal.hidden = !modal.hidden;
                        backdrop.hidden = !backdrop.hidden;
                    }
                    return;
                }

                if (ctrl && k === "y") {
                    e.preventDefault();
                    redo();
                    return;
                }

                if (k === "o") {
                    e.preventDefault();
                    const onionBtn = document.getElementById("tlOnion");
                    if (onionBtn) {
                        onionBtn.checked = !onionBtn.checked;
                        onionBtn.dispatchEvent(new Event("change"));
                    }
                    return;
                }

                if (k === "f") {
                    e.preventDefault();
                    pushUndo(LAYER.FILL, currentFrame);
                    fillFromLineart(currentFrame);
                    return;
                }

                if (k === "[") {
                    e.preventDefault();
                    brushSize = Math.max(1, brushSize - 5);
                    applyBrushSizeUi(brushSize);
                    return;
                }

                if (k === "]") {
                    e.preventDefault();
                    brushSize = Math.min(400, brushSize + 5);
                    applyBrushSizeUi(brushSize);
                    return;
                }

                if (k === "alt") {
                    if (!temporaryEyedropper) {
                        temporaryEyedropper = true;
                        previousTool = tool;
                        tool = "eyedropper";
                        updateHUD();
                    }
                    return;
                }

                if (e.key === "Shift" && !straightLineMode) {
                    straightLineMode = true;
                    return;
                }
            }, {
                passive: false
            });

            document.addEventListener("keyup", e => {
                if (e.key === "Alt" && temporaryEyedropper) {
                    temporaryEyedropper = false;
                    if (previousTool) {
                        tool = previousTool;
                        previousTool = null;
                        updateHUD();
                    }
                }
                if (e.key === "Shift") {
                    straightLineMode = false;
                    straightLineStart = null;
                }
            });

            const originalPointerDown = window._pointerDownHandler;
            if (originalPointerDown) {
                window.addEventListener("pointerdown", e => {
                    if (e.shiftKey && (tool === "brush" || tool === "fill-brush")) {
                        straightLineStart = {
                            x: e.offsetX,
                            y: e.offsetY
                        };
                    }
                    if (originalPointerDown) {
                        originalPointerDown(e);
                    }
                }, true);
            }

            const originalPointerMove = window._pointerMoveHandler;
            if (originalPointerMove) {
                window.addEventListener("pointermove", e => {
                    if (straightLineMode && straightLineStart && (tool === "brush" || tool === "fill-brush")) {
                        const drawCanvas = document.getElementById("drawCanvas");
                        if (drawCanvas) {
                            const ctx = drawCanvas.getContext("2d");
                            const rect = drawCanvas.getBoundingClientRect();
                            const x = e.clientX - rect.left;
                            const y = e.clientY - rect.top;
                            ctx.save();
                            ctx.setTransform(dctx.getTransform());
                            ctx.beginPath();
                            ctx.moveTo(straightLineStart.x, straightLineStart.y);
                            ctx.lineTo(x, y);
                            ctx.strokeStyle = currentColor;
                            ctx.lineWidth = brushSize;
                            ctx.lineCap = "round";
                            ctx.stroke();
                            ctx.restore();
                        }
                    }
                    if (originalPointerMove) {
                        originalPointerMove(e);
                    }
                }, true);
            }
        }
        function wireKeyboardShortcuts() {
            if (document._celstompKeysWired) return;
            document._celstompKeysWired = true;
            const isTyping = el => {
                if (!el) return false;
                const tag = (el.tagName || "").toLowerCase();
                return tag === "input" || tag === "textarea" || el.isContentEditable;
            };
            const setTool = t => {
                tool = t;
                try {
                    updateHUD?.();
                } catch {}
                try {
                    scheduleBrushPreviewUpdate?.(true);
                } catch {}
            };
            const toolByKey = {
                1: "brush",
                2: "eraser",
                3: "fill-brush",
                4: "fill-eraser",
                5: "lasso-fill",
                6: "lasso-erase",
                7: "rect-select",
                8: "eyedropper"
            };
            document.addEventListener("keydown", e => {
                if (e.defaultPrevented) return;
                if (isTyping(document.activeElement)) return;
                const k = (e.key || "").toLowerCase();
                if (toolByKey[k]) {
                    setTool(toolByKey[k]);
                    e.preventDefault();
                    return;
                }
            }, {
                passive: false
            });
        }
        function nearestPrevCelIndex(F) {
            for (let i = F - 1; i >= 0; i--) if (hasCel(i)) return i;
            return -1;
        }
        function nearestNextCelIndex(F) {
            for (let i = F + 1; i < totalFrames; i++) if (hasCel(i)) return i;
            return -1;
        }
        function renderBounds() {
            setTransform(bctx);
            bctx.fillStyle = "#2a2f38";
            bctx.strokeStyle = "#3b4759";
            bctx.lineWidth = 2 / Math.max(zoom, 1);
            bctx.fillRect(0, 0, contentW, contentH);
            bctx.strokeRect(0, 0, contentW, contentH);
            drawRectSelectionOverlay(bctx);
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
            const holdAlpha = transparencyHoldEnabled ? .25 : 1;
            drawCompositeAt(dctx, currentFrame, true, true, holdAlpha);
            drawOnion(dctx);
        }
        function renderAll() {
            renderBounds();
            renderFrame();
            highlightTimelineCell();
        }
        function clearFx() {
            fxctx.setTransform(1, 0, 0, 1, 0, 0);
            fxctx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
        }
        function fxTransform() {
            fxctx.setTransform(zoom * dpr, 0, 0, zoom * dpr, offsetX, offsetY);
        }
        function fxStamp1px(x0, y0, x1, y1) {
            const s = 1;
            const dx = x1 - x0, dy = y1 - y0;
            const dist = Math.hypot(dx, dy);
            const step = .5;
            const n = Math.max(1, Math.ceil(dist / step));
            const nx = dx / n, ny = dy / n;
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
            if (v > 0) layers[L].prevOpacity = v;
            renderAll();
            updateVisBtn(L);
        }
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
            m.innerHTML = `\n        <button type="button" class="lrm-btn" data-act="opacity">Opacity…</button>\n      `;
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
        let _brushCtxMenu = null;
        let _brushCtxState = null;
        function ensureBrushCtxMenu() {
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
            m.innerHTML = `\n        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:8px;">\n          <div style="font-weight:700; letter-spacing:.2px;">Brush options</div>\n        </div>\n\n        <div style="display:flex; align-items:center; gap:10px; margin:8px 0;">\n          <div style="width:52px; opacity:.85;">Size</div>\n          <input id="bcmSize" type="range" min="1" max="200" step="1" value="3" style="flex:1;">\n          <div id="bcmSizeVal" style="width:34px; text-align:right; font-variant-numeric:tabular-nums;">3</div>\n        </div>\n\n        <label style="display:flex; align-items:center; gap:10px; margin:8px 0; cursor:pointer;">\n          <input id="bcmAA" type="checkbox">\n          <span>Anti-alias</span>\n        </label>\n\n        <div style="margin:10px 0 6px; font-weight:700; opacity:.9;">Pressure</div>\n\n        <label style="display:flex; align-items:center; gap:10px; margin:6px 0; cursor:pointer;">\n          <input id="bcmPSize" type="checkbox">\n          <span>Pressure → Size</span>\n        </label>\n\n        <label style="display:flex; align-items:center; gap:10px; margin:6px 0; cursor:pointer;">\n          <input id="bcmPOp" type="checkbox">\n          <span>Pressure → Opacity</span>\n        </label>\n\n        <div style="display:flex; gap:8px; margin-top:10px;">\n          <button type="button" id="bcmReset"\n            style="flex:1; padding:8px 10px; border-radius:10px; cursor:pointer;\n                  background:rgba(255,255,255,0.08); color:rgba(255,255,255,0.92);\n                  border:1px solid rgba(255,255,255,0.12); font:inherit;">\n            Reset\n          </button>\n        </div>\n      `;
            const $m = sel => m.querySelector(sel);
            const sizeEl = $m("#bcmSize");
            const sizeVal = $m("#bcmSizeVal");
            const aaEl = $m("#bcmAA");
            const pSizeEl = $m("#bcmPSize");
            const pOpEl = $m("#bcmPOp");
            const resetBtn = $m("#bcmReset");
            function syncRangeLimitsFromMainUI() {
                if (typeof brushSizeInput !== "undefined" && brushSizeInput) {
                    if (brushSizeInput.min) sizeEl.min = brushSizeInput.min;
                    if (brushSizeInput.max) sizeEl.max = brushSizeInput.max;
                    if (brushSizeInput.step) sizeEl.step = brushSizeInput.step;
                }
            }
            function syncMenuFromState() {
                syncRangeLimitsFromMainUI();
                const v = Math.round(Number(brushSize) || 1);
                sizeEl.value = String(v);
                sizeVal.textContent = String(v);
                aaEl.checked = !!antiAlias;
                pSizeEl.checked = !!usePressureSize;
                pOpEl.checked = !!usePressureOpacity;
            }
            function syncMainUIFromState() {
                if (typeof brushSizeInput !== "undefined" && brushSizeInput) brushSizeInput.value = String(Math.round(Number(brushSize) || 1));
                if (typeof brushSizeNumInput !== "undefined" && brushSizeNumInput) brushSizeNumInput.value = String(Math.round(Number(brushSize) || 1));
                if (typeof brushVal !== "undefined" && brushVal) brushVal.textContent = String(Math.round(Number(brushSize) || 1));
                if (typeof aaToggle !== "undefined" && aaToggle && "checked" in aaToggle) aaToggle.checked = !!antiAlias;
                const ps = document.getElementById("pressureSize") || document.getElementById("usePressureSize");
                const po = document.getElementById("pressureOpacity") || document.getElementById("usePressureOpacity");
                if (ps && "checked" in ps) ps.checked = !!usePressureSize;
                if (po && "checked" in po) po.checked = !!usePressureOpacity;
            }
            function applyBrushSizeFromMenu() {
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
                try {
                    renderAll?.();
                } catch {}
            });
            pSizeEl.addEventListener("change", () => {
                usePressureSize = !!pSizeEl.checked;
                syncMainUIFromState();
            });
            pOpEl.addEventListener("change", () => {
                usePressureOpacity = !!pOpEl.checked;
                syncMainUIFromState();
            });
            resetBtn.addEventListener("click", e => {
                e.preventDefault();
                e.stopPropagation();
                brushSize = 3;
                antiAlias = false;
                usePressureSize = true;
                usePressureOpacity = false;
                syncMenuFromState();
                syncMainUIFromState();
                try {
                    renderAll?.();
                } catch {}
            });
            document.addEventListener("mousedown", e => {
                if (m.hidden) return;
                if (e.target === m || m.contains(e.target)) return;
                closeBrushCtxMenu();
            }, true);
            document.addEventListener("keydown", e => {
                if (m.hidden) return;
                if (e.key === "Escape") closeBrushCtxMenu();
            });
            window.addEventListener("blur", () => closeBrushCtxMenu());
            document.body.appendChild(m);
            m._syncFromState = syncMenuFromState;
            _brushCtxMenu = m;
            return m;
        }
        function openBrushCtxMenu(ev, anchorEl) {
            try {
                closeEraserCtxMenu?.();
            } catch {}
            const m = ensureBrushCtxMenu();
            _brushCtxState = {
                anchorEl: anchorEl || null
            };
            try {
                m._syncFromState?.();
            } catch {}
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
                m.querySelector("#bcmSize")?.focus({
                    preventScroll: true
                });
            } catch {}
        }
        function closeBrushCtxMenu() {
            if (_brushCtxMenu) _brushCtxMenu.hidden = true;
            _brushCtxState = null;
        }
        function wireBrushButtonRightClick() {
            if (document._brushCtxWired) return;
            document._brushCtxWired = true;
            const brushSelectors = [ "#toolBrush", '[data-tool="brush"]', '[data-toolid="brush"]', '[data-toolname="brush"]', 'button[value="brush"]', 'input[value="brush"]' ].join(",");
            document.addEventListener("contextmenu", e => {
                const t = e.target;
                if (!t) return;
                const brushEl = t.closest?.(brushSelectors);
                if (!brushEl) return;
                e.preventDefault();
                e.stopPropagation();
                openBrushCtxMenu(e, brushEl);
            }, {
                capture: true
            });
            try {
                drawCanvas?.addEventListener("pointerdown", () => closeBrushCtxMenu(), {
                    passive: true
                });
            } catch {}
        }
        let _eraserCtxMenu = null;
        let _eraserCtxState = null;
        function ensureEraserCtxMenu() {
            if (_eraserCtxMenu) return _eraserCtxMenu;
            const m = document.createElement("div");
            m.id = "eraserCtxMenu";
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
            m.innerHTML = `\n        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:8px;">\n          <div style="font-weight:700; letter-spacing:.2px;">Eraser options</div>\n        </div>\n\n        <div style="display:flex; align-items:center; gap:10px; margin:8px 0;">\n          <div style="width:52px; opacity:.85;">Size</div>\n          <input id="ecmSize" type="range" min="1" max="400" step="1" value="24" style="flex:1;">\n          <div id="ecmSizeVal" style="width:34px; text-align:right; font-variant-numeric:tabular-nums;">24</div>\n        </div>\n      `;
            const $m = sel => m.querySelector(sel);
            const sizeEl = $m("#ecmSize");
            const sizeVal = $m("#ecmSizeVal");
            function syncRangeLimitsFromMainUI() {
                if (typeof eraserSizeInput !== "undefined" && eraserSizeInput) {
                    if (eraserSizeInput.min) sizeEl.min = eraserSizeInput.min;
                    if (eraserSizeInput.max) sizeEl.max = eraserSizeInput.max;
                    if (eraserSizeInput.step) sizeEl.step = eraserSizeInput.step;
                }
            }
            function syncMenuFromState() {
                syncRangeLimitsFromMainUI();
                const v = Math.round(Number(eraserSize) || 1);
                sizeEl.value = String(v);
                sizeVal.textContent = String(v);
            }
            function syncMainUIFromState() {
                if (typeof eraserSizeInput !== "undefined" && eraserSizeInput) {
                    eraserSizeInput.value = String(Math.round(Number(eraserSize) || 1));
                }
                if (typeof eraserVal !== "undefined" && eraserVal) {
                    eraserVal.textContent = String(Math.round(Number(eraserSize) || 1));
                }
            }
            function applyEraserSizeFromMenu() {
                const v = Math.round(Number(sizeEl.value) || 1);
                eraserSize = clamp(v, 1, 999);
                sizeVal.textContent = String(eraserSize);
                syncMainUIFromState();
            }
            sizeEl.addEventListener("input", applyEraserSizeFromMenu);
            sizeEl.addEventListener("change", applyEraserSizeFromMenu);
            document.addEventListener("mousedown", e => {
                if (m.hidden) return;
                if (e.target === m || m.contains(e.target)) return;
                closeEraserCtxMenu();
            }, true);
            document.addEventListener("keydown", e => {
                if (m.hidden) return;
                if (e.key === "Escape") closeEraserCtxMenu();
            });
            window.addEventListener("blur", () => closeEraserCtxMenu());
            document.body.appendChild(m);
            m._syncFromState = syncMenuFromState;
            _eraserCtxMenu = m;
            return m;
        }
        function openEraserCtxMenu(ev, anchorEl) {
            try {
                closeBrushCtxMenu?.();
            } catch {}
            const m = ensureEraserCtxMenu();
            _eraserCtxState = {
                anchorEl: anchorEl || null
            };
            try {
                m._syncFromState?.();
            } catch {}
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
                m.querySelector("#ecmSize")?.focus({
                    preventScroll: true
                });
            } catch {}
        }
        function closeEraserCtxMenu() {
            if (_eraserCtxMenu) _eraserCtxMenu.hidden = true;
            _eraserCtxState = null;
        }
        function wireEraserButtonRightClick() {
            if (document._eraserCtxWired) return;
            document._eraserCtxWired = true;
            const eraserSelectors = [ "#toolEraser", '[data-tool="eraser"]', '[data-tool="fill-eraser"]', '[data-toolid="eraser"]', '[data-toolid="fill-eraser"]', '[data-toolname="eraser"]', '[data-toolname="fill-eraser"]', 'button[value="eraser"]', 'button[value="fill-eraser"]', 'input[value="eraser"]', 'input[value="fill-eraser"]' ].join(",");
            document.addEventListener("contextmenu", e => {
                const t = e.target;
                if (!t) return;
                const eraserEl = t.closest?.(eraserSelectors);
                if (!eraserEl) return;
                e.preventDefault();
                e.stopPropagation();
                openEraserCtxMenu(e, eraserEl);
            }, {
                capture: true
            });
            try {
                drawCanvas?.addEventListener("pointerdown", () => closeEraserCtxMenu(), {
                    passive: true
                });
            } catch {}
        }
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
            wireIslandIcons(toolSegEl);
            wireIslandCollapse(island, tab, btnCollapse);
            wireIslandReset(island, btnReset);
            wireIslandDrag(island, header);
            applyIslandSavedPos(island);
        }
        const ISLAND_POS_KEY = "celstomp.island.pos";
        function applyIslandSavedPos(island) {
            try {
                const raw = localStorage.getItem(ISLAND_POS_KEY);
                if (!raw) return;
                const p = JSON.parse(raw);
                if (Number.isFinite(p.left)) island.style.left = `${p.left}px`;
                if (Number.isFinite(p.top)) island.style.top = `${p.top}px`;
            } catch {}
        }
        function saveIslandPos(island) {
            try {
                const r = island.getBoundingClientRect();
                localStorage.setItem(ISLAND_POS_KEY, JSON.stringify({
                    left: Math.round(r.left),
                    top: Math.round(r.top)
                }));
            } catch {}
        }
        function wireIslandDrag(island, handle) {
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
        function wireIslandCollapse(island, tab, btnCollapse) {
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
        function wireIslandReset(island, btnReset) {
            btnReset?.addEventListener("click", e => {
                e.preventDefault();
                try {
                    localStorage.removeItem(ISLAND_POS_KEY);
                } catch {}
                island.style.left = "18px";
                island.style.top = "calc(var(--header-h) + 28px)";
            });
        }
        function wireIslandIcons(toolSegEl) {
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
        const visBtnByLayer = new Map;
        const layerMoveCtrlsByLayer = new Map;
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
            const input = document.getElementById(id);
            const label = input ? input.closest("label") || document.querySelector(`label[for="${id}"]`) || input.parentElement : null;
            return {
                input: input,
                label: label
            };
        }
        function applyLayerSegOrder() {
            const seg = document.getElementById("layerSeg");
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
        function moveLayerInList(L, dir) {
            if (L === PAPER_LAYER) return;
            const ui = mainLayersTopToBottom();
            const idx = ui.indexOf(L);
            if (idx < 0) return;
            const next = idx + dir;
            if (next < 0 || next >= ui.length) return;
            [ ui[idx], ui[next] ] = [ ui[next], ui[idx] ];
            mainLayerOrder = normalizeMainLayerOrder(ui.slice().reverse());
            applyLayerSegOrder();
            wireLayerVisButtons();
            renderAll();
            markProjectDirty();
        }
        function updateLayerMoveButtons() {
            const ui = mainLayersTopToBottom();
            for (let i = 0; i < ui.length; i++) {
                const L = ui[i];
                const refs = layerMoveCtrlsByLayer.get(L);
                if (!refs) continue;
                refs.up.disabled = i === 0;
                refs.down.disabled = i === ui.length - 1;
                refs.up.title = refs.up.disabled ? "Already at top" : "Move layer up";
                refs.down.title = refs.down.disabled ? "Already at bottom" : "Move layer down";
            }
        }
        function ensureLayerMoveControls(label, L) {
            if (!label || L === PAPER_LAYER) return;
            const existing = label.querySelector(".layerMoveControls");
            if (existing) return;
            const wrap = document.createElement("span");
            wrap.className = "layerMoveControls";
            const up = document.createElement("button");
            up.type = "button";
            up.className = "layerMoveBtn";
            up.textContent = "▲";
            up.setAttribute("aria-label", "Move layer up");
            up.addEventListener("click", e => {
                e.preventDefault();
                e.stopPropagation();
                moveLayerInList(L, -1);
            });
            const down = document.createElement("button");
            down.type = "button";
            down.className = "layerMoveBtn";
            down.textContent = "▼";
            down.setAttribute("aria-label", "Move layer down");
            down.addEventListener("click", e => {
                e.preventDefault();
                e.stopPropagation();
                moveLayerInList(L, 1);
            });
            wrap.appendChild(up);
            wrap.appendChild(down);
            const sw = label.querySelector(".layerSwatches");
            if (sw) label.insertBefore(wrap, sw); else label.appendChild(wrap);
            layerMoveCtrlsByLayer.set(L, {
                up: up,
                down: down
            });
        }
        function injectVisBtn(radioId, L) {
            const input = document.getElementById(radioId);
            if (!input) return;
            const label = input.closest("label") || document.querySelector(`label[for="${radioId}"]`) || input.parentElement;
            if (!label) return;
            const existing = label.querySelector(".visBtn");
            if (existing) {
                label.dataset.layerRow = String(L);
                ensureLayerMoveControls(label, L);
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
            ensureLayerMoveControls(label, L);
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
            updateLayerMoveButtons();
        }
        function clearCelAt(L, F) {
            if (L === PAPER_LAYER) return;
            const layer = layers[L];
            if (!layer) return;
            const order = layer.suborder || [];
            const map = layer.sublayers || new Map;
            for (const key of order) {
                const sub = map.get(key);
                const c = sub?.frames?.[F];
                if (c && c._hasContent) {
                    try {
                        pushUndo(L, F, key);
                    } catch {}
                    const g = c.getContext("2d", {
                        willReadFrequently: true
                    });
                    g.setTransform(1, 0, 0, 1, 0, 0);
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
            const map = layer.sublayers || new Map;
            for (let f = 0; f < totalFrames; f++) {
                for (const key of order) {
                    const sub = map.get(key);
                    const c = sub?.frames?.[f];
                    if (c && c._hasContent) {
                        try {
                            pushUndo(L, f, key);
                        } catch {}
                        const g = c.getContext("2d", {
                            willReadFrequently: true
                        });
                        g.setTransform(1, 0, 0, 1, 0, 0);
                        g.clearRect(0, 0, contentW, contentH);
                        c._hasContent = false;
                    }
                }
            }
            renderAll();
            if (hasTimeline) buildTimeline();
            try {
                renderLayerSwatches();
            } catch {}
            try {
                wireLayerVisButtons();
            } catch {}
            updateHUD();
            pruneUnusedSublayers(L);
        }
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
        function askImgSeqExportOptions() {
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
            clipStart = 0;
            clipEnd = Math.max(0, Math.min(totalFrames - 1, fps * 2 - 1));
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
        function buildTimeline() {
            if (!hasTimeline) return;
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
            timelineTable.innerHTML = "";
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
        function updateTimelineHasContent(F) {
            if (!hasTimeline) return;
            const tr = timelineTable.querySelector("tr.anim-row");
            if (!tr) return;
            const td = tr.children[F + 1];
            if (!td) return;
            td.classList.toggle("hasContent", hasCel(F));
        }
        function refreshTimelineRowHasContentAll() {
            if (!hasTimeline) return;
            const tr = timelineTable.querySelector("tr.anim-row");
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
            if (!hasTimeline) return;
            const playRow = timelineTable.querySelector("tr.playhead-row");
            const cell = playRow?.children[currentFrame + 1];
            if (!cell) return;
            const r = cell.getBoundingClientRect();
            const sr = timelineScroll.getBoundingClientRect();
            const left = r.left - sr.left + timelineScroll.scrollLeft;
            const right = left + r.width;
            if (left < timelineScroll.scrollLeft) timelineScroll.scrollLeft = left - 20; else if (right > timelineScroll.scrollLeft + timelineScroll.clientWidth) {
                timelineScroll.scrollLeft = right - timelineScroll.clientWidth + 20;
            }
        }
        function setColorSwatch() {
            if (!brushSwatch || !brushHexEl) return;
            const tmp = document.createElement("canvas").getContext("2d", {
                willReadFrequently: true
            });
            tmp.fillStyle = currentColor;
            tmp.fillRect(0, 0, 1, 1);
            const [r, g, b] = tmp.getImageData(0, 0, 1, 1).data;
            const hex = "#" + [ r, g, b ].map(v => v.toString(16).padStart(2, "0")).join("");
            brushSwatch.style.background = hex;
            brushHexEl.textContent = hex.toUpperCase();
        }
        function setHSVPreviewBox() {
            if (!hsvWheelPreview) return;
            hsvWheelPreview.style.background = currentColor || "#000000";
        }
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
                        updateHUD();
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
        function clearRectSelection() {
            rectSelection.active = false;
            rectSelection.moving = false;
            rectSelection.fullSnap = null;
            rectSelection.selSnap = null;
            rectSelection.pointerId = null;
            rectSelection.moveDx = 0;
            rectSelection.moveDy = 0;
            renderAll();
        }
        function drawRectSelectionOverlay(ctx) {
            if (!rectSelection.active) return;
            ctx.save();
            ctx.lineWidth = Math.max(1 / Math.max(zoom, 1), .75);
            ctx.setLineDash([ 6 / Math.max(zoom, 1), 4 / Math.max(zoom, 1) ]);
            ctx.strokeStyle = "#00e5ff";
            ctx.fillStyle = "rgba(0, 229, 255, 0.12)";
            ctx.fillRect(rectSelection.x, rectSelection.y, rectSelection.w, rectSelection.h);
            ctx.strokeRect(rectSelection.x, rectSelection.y, rectSelection.w, rectSelection.h);
            ctx.restore();
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
            renderAll();
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
                renderAll();
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
            renderAll();
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
                renderAll();
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
            renderAll();
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
        function setPenControlsVisible(visible) {
            if (!penControls) return;
            penControls.hidden = !visible;
        }
        function notePenDetected(e) {
            if (!e || e.pointerType !== "pen") return;
            if (penDetected) return;
            penDetected = true;
            setPenControlsVisible(true);
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

        const _brushMaskCache = new Map();
        const _brushStampCache = new Map();
        function brushMaskCacheKey(settings) {
            return `${settings.shape}|${settings.size}|${settings.angle}`;
        }
        function brushStampCacheKey(settings, color) {
            return `${brushMaskCacheKey(settings)}|${color}`;
        }
        function normalizedBrushRenderSettings(source) {
            return mergeBrushSettings(DEFAULT_TOOL_BRUSH_SETTINGS, source || {});
        }
        function getBrushMask(sourceSettings) {
            const settings = normalizedBrushRenderSettings(sourceSettings);
            const key = brushMaskCacheKey(settings);
            const cached = _brushMaskCache.get(key);
            if (cached) return cached;

            const dim = brushShapeDimensions(settings.shape, settings.size);
            const w = dim.w;
            const h = dim.h;
            const cx = w / 2;
            const cy = h / 2;
            const rx = Math.max(0.5, w / 2);
            const ry = Math.max(0.5, h / 2);
            const shape = settings.shape;

            const canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d", {
                willReadFrequently: true
            });

            const img = ctx.createImageData(w, h);
            const d = img.data;
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const px = x + 0.5;
                    const py = y + 0.5;
                    let inside = false;
                    if (shape === "circle" || shape === "oval-h" || shape === "oval-v") {
                        const nx = (px - cx) / rx;
                        const ny = (py - cy) / ry;
                        inside = nx * nx + ny * ny <= 1;
                    } else if (shape === "square" || shape === "rect-h" || shape === "rect-v") {
                        inside = true;
                    } else if (shape === "diamond") {
                        const nx = Math.abs((px - cx) / rx);
                        const ny = Math.abs((py - cy) / ry);
                        inside = nx + ny <= 1;
                    } else if (shape === "triangle") {
                        const tx = (px - cx) / rx;
                        const ty = (py - cy) / ry;
                        inside = ty <= 1 && ty >= -1 && Math.abs(tx) <= (1 - (ty + 1) / 2);
                    }
                    if (!inside) continue;
                    const i = (y * w + x) * 4;
                    d[i + 0] = 255;
                    d[i + 1] = 255;
                    d[i + 2] = 255;
                    d[i + 3] = 255;
                }
            }
            ctx.putImageData(img, 0, 0);

            const angle = Number(settings.angle || 0);
            let outCanvas = canvas;
            if (angle !== 0) {
                const rad = angle * Math.PI / 180;
                const cos = Math.abs(Math.cos(rad));
                const sin = Math.abs(Math.sin(rad));
                const rw = Math.max(1, Math.ceil(w * cos + h * sin));
                const rh = Math.max(1, Math.ceil(w * sin + h * cos));
                const rc = document.createElement("canvas");
                rc.width = rw;
                rc.height = rh;
                const rctx = rc.getContext("2d");
                rctx.imageSmoothingEnabled = false;
                rctx.translate(rw / 2, rh / 2);
                rctx.rotate(rad);
                rctx.drawImage(canvas, -w / 2, -h / 2);
                outCanvas = rc;
            }

            const out = {
                canvas: outCanvas,
                w: outCanvas.width,
                h: outCanvas.height,
                ox: Math.floor(outCanvas.width / 2),
                oy: Math.floor(outCanvas.height / 2)
            };
            _brushMaskCache.set(key, out);
            return out;
        }
        function getBrushStamp(sourceSettings, colorRaw) {
            const settings = normalizedBrushRenderSettings(sourceSettings);
            const color = colorToHex(colorRaw || "#000000");
            const key = brushStampCacheKey(settings, color);
            const cached = _brushStampCache.get(key);
            if (cached) return cached;

            const mask = getBrushMask(settings);
            const canvas = document.createElement("canvas");
            canvas.width = mask.w;
            canvas.height = mask.h;
            const ctx = canvas.getContext("2d");
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, mask.w, mask.h);
            ctx.globalCompositeOperation = "destination-in";
            ctx.drawImage(mask.canvas, 0, 0);
            ctx.globalCompositeOperation = "source-over";

            const out = {
                canvas: canvas,
                w: mask.w,
                h: mask.h,
                ox: mask.ox,
                oy: mask.oy
            };
            _brushStampCache.set(key, out);
            return out;
        }
        function stampLine(ctx, x0, y0, x1, y1, sourceSettings, color, alpha = 1, composite = "source-over") {
            const settings = normalizedBrushRenderSettings(sourceSettings);
            const stamp = getBrushStamp(settings, color);
            const dx = x1 - x0, dy = y1 - y0;
            const dist = Math.hypot(dx, dy);
            const step = Math.max(1, settings.size * .5);
            const n = Math.max(1, Math.ceil(dist / step));
            const nx = dx / n, ny = dy / n;
            ctx.save();
            ctx.globalCompositeOperation = composite;
            ctx.globalAlpha = clamp01(alpha) * clamp01(settings.opacity);
            ctx.fillStyle = color;
            for (let i = 0; i <= n; i++) {
                const px = Math.round(x0 + nx * i - stamp.ox);
                const py = Math.round(y0 + ny * i - stamp.oy);
                ctx.drawImage(stamp.canvas, px, py);
            }
            try {
                markGlobalHistoryDirty();
            } catch {}
            ctx.restore();
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
        function combinedInsideMask_LineOnly(F, gapPx) {
            const w = contentW, h = contentH;
            const lineCanvases = canvasesWithContentForMainLayerFrame(LAYER.LINE, F);
            if (!lineCanvases.length) return null;
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
            renderAll();
            updateTimelineHasContent(F);
            return true;
        }
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
            renderAll();
            updateTimelineHasContent(F);
            return true;
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
            renderAll();
            updateTimelineHasContent(F);
            return true;
        }
        let isDrawing = false;
        const _touchPointers = new Map;
        let _touchGestureActive = false;
        function _updateTouchGestureState() {
            const was = _touchGestureActive;
            _touchGestureActive = _touchPointers.size >= 2;
            if (!was && _touchGestureActive) {
                try {
                    cancelActiveStroke?.();
                } catch {}
                try {
                    endStroke?.(true);
                } catch {}
                try {
                    stopDrawing?.();
                } catch {}
                try {
                    isDrawing = false;
                } catch {}
                try {
                    lastX = lastY = null;
                } catch {}
            }
        }
        function wireCanvasPointerDrawingMobileSafe() {
            const stageEl = typeof stage !== "undefined" && stage || document.getElementById("stage");
            const canvasEl = typeof drawCanvas !== "undefined" && drawCanvas || document.getElementById("drawCanvas") || document.querySelector("canvas");
            if (!canvasEl || canvasEl._celstompPointerWired) return;
            canvasEl._celstompPointerWired = true;
            const __USE_UNIFIED_CANVAS_INPUT__ = true;
            if (__USE_UNIFIED_CANVAS_INPUT__) {
                try {
                    canvasEl.style.touchAction = "none";
                } catch {}
                try {
                    if (stageEl) stageEl.style.touchAction = "none";
                } catch {}
                try {
                    if (typeof fxCanvas !== "undefined" && fxCanvas) fxCanvas.style.pointerEvents = "none";
                } catch {}
                try {
                    if (typeof boundsCanvas !== "undefined" && boundsCanvas) boundsCanvas.style.pointerEvents = "none";
                } catch {}
                try {
                    window.__CELSTOMP_PTR_DRAW_WIRED__ = true;
                } catch {}
                return;
            }
            try {
                if (typeof fxCanvas !== "undefined" && fxCanvas) fxCanvas.style.pointerEvents = "none";
            } catch {}
            try {
                if (typeof boundsCanvas !== "undefined" && boundsCanvas) boundsCanvas.style.pointerEvents = "none";
            } catch {}
            try {
                canvasEl.style.touchAction = "none";
            } catch {}
            try {
                if (stageEl) stageEl.style.touchAction = "none";
            } catch {}
            const addTouchPtr = e => {
                if (e.pointerType !== "touch") return;
                _touchPointers.set(e.pointerId, {
                    x: e.clientX,
                    y: e.clientY
                });
                _updateTouchGestureState();
            };
            const moveTouchPtr = e => {
                if (e.pointerType !== "touch") return;
                if (!_touchPointers.has(e.pointerId)) return;
                _touchPointers.set(e.pointerId, {
                    x: e.clientX,
                    y: e.clientY
                });
            };
            const removeTouchPtr = e => {
                if (e.pointerType !== "touch") return;
                _touchPointers.delete(e.pointerId);
                _updateTouchGestureState();
            };
            const hardCancelStroke = () => {
                try {
                    cancelLasso?.();
                } catch {}
                try {
                    clearFx?.();
                } catch {}
                try {
                    isDrawing = false;
                } catch {}
                try {
                    isPanning = false;
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
            };
            const shouldIgnorePointer = e => {
                if (e.pointerType !== "mouse" && e.isPrimary === false) return true;
                if (e.pointerType === "mouse") {
                    if (e.button !== 0 && e.button !== 2) return true;
                }
                return false;
            };
            canvasEl.addEventListener("pointerdown", e => {
                if (shouldIgnorePointer(e)) return;
                addTouchPtr(e);
                if (_touchGestureActive) {
                    hardCancelStroke();
                    e.preventDefault();
                    return;
                }
                try {
                    canvasEl.setPointerCapture(e.pointerId);
                } catch {}
                try {
                    startStroke(e);
                } catch (err) {
                    console.warn("[celstomp] startStroke failed", err);
                }
                e.preventDefault();
            }, {
                passive: false
            });
            canvasEl.addEventListener("pointermove", e => {
                moveTouchPtr(e);
                if (_touchGestureActive) {
                    hardCancelStroke();
                    e.preventDefault();
                    return;
                }
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
            }, {
                passive: false
            });
            const finish = e => {
                removeTouchPtr(e);
                try {
                    endStrokeMobileSafe(e);
                } catch {}
                try {
                    canvasEl.releasePointerCapture(e.pointerId);
                } catch {}
            };
            canvasEl.addEventListener("pointerup", finish, {
                passive: false
            });
            canvasEl.addEventListener("pointercancel", finish, {
                passive: false
            });
            canvasEl.addEventListener("lostpointercapture", finish, {
                passive: false
            });
        }
        let lastPt = null;
        let stabilizedPt = null;
        let strokeHex = null;
        let _fillEraseAllLayers = false;
        let isPanning = false;
        let panStart = {
            x: 0,
            y: 0,
            ox: 0,
            oy: 0
        };
        let trailPoints = [];
        let lassoActive = false;
        let lassoPts = [];
        const lassoMinDist = 2.5;
        function addLassoPoint(pt) {
            const last = lassoPts[lassoPts.length - 1];
            if (!last || Math.hypot(pt.x - last.x, pt.y - last.y) >= lassoMinDist) {
                lassoPts.push(pt);
            }
        }
        function drawLassoPreview(mode = "fill") {
            clearFx();
            if (lassoPts.length < 2) return;
            const isErase = mode === "erase";
            fxTransform();
            fxctx.save();
            if (!isErase) {
                fxctx.globalAlpha = .18;
                fxctx.fillStyle = currentColor;
                fxctx.beginPath();
                fxctx.moveTo(lassoPts[0].x, lassoPts[0].y);
                for (let i = 1; i < lassoPts.length; i++) fxctx.lineTo(lassoPts[i].x, lassoPts[i].y);
                fxctx.closePath();
                fxctx.fill();
            }
            fxctx.globalAlpha = 1;
            fxctx.lineWidth = Math.max(1 / (zoom * dpr), .6);
            fxctx.setLineDash([ 10 / zoom, 7 / zoom ]);
            fxctx.strokeStyle = isErase ? "rgba(255,90,90,0.95)" : "rgba(255,255,255,0.95)";
            fxctx.beginPath();
            fxctx.moveTo(lassoPts[0].x, lassoPts[0].y);
            for (let i = 1; i < lassoPts.length; i++) fxctx.lineTo(lassoPts[i].x, lassoPts[i].y);
            fxctx.stroke();
            fxctx.restore();
        }
        function getBrushAntiAliasEnabled() {
            if (typeof brushAntiAlias !== "undefined") return !!brushAntiAlias;
            if (typeof brushAA !== "undefined") return !!brushAA;
            if (typeof antiAlias !== "undefined") return !!antiAlias;
            const el = document.getElementById("aaToggle") || document.getElementById("antiAlias") || document.getElementById("brushAA");
            if (el && "checked" in el) return !!el.checked;
            return true;
        }
        let _lassoMaskC = null;
        let _lassoColorC = null;
        function ensureTmpCanvas(c, w, h) {
            if (!c) c = document.createElement("canvas");
            if (c.width !== w) c.width = w;
            if (c.height !== h) c.height = h;
            const ctx = c.getContext("2d");
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, w, h);
            return [ c, ctx ];
        }
        function applyLassoFill() {
            const hex = colorToHex(currentColor);
            pushUndo(activeLayer, currentFrame, hex);
            activeSubColor[activeLayer] = hex;
            ensureSublayer(activeLayer, hex);
            if (lassoPts.length < 3) return false;
            const off = getFrameCanvas(activeLayer, currentFrame, hex);
            const w = off.width, h = off.height;
            const aaOn = getBrushAntiAliasEnabled();
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
            const img = mctx.getImageData(0, 0, w, h);
            const d = img.data;
            for (let i = 0; i < d.length; i += 4) {
                const a = d[i + 3];
                d[i + 3] = a >= 128 ? 255 : 0;
                d[i] = 255;
                d[i + 1] = 255;
                d[i + 2] = 255;
            }
            mctx.putImageData(img, 0, 0);
            cctx.save();
            cctx.fillStyle = currentColor;
            cctx.fillRect(0, 0, w, h);
            cctx.globalCompositeOperation = "destination-in";
            cctx.drawImage(_lassoMaskC, 0, 0);
            cctx.restore();
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
        function applyLassoErase() {
            if (activeLayer === PAPER_LAYER) return false;
            if (lassoPts.length < 3) return false;
            const L = activeLayer;
            const key = resolveKeyFor(L, activeSubColor?.[L] ?? currentColor);
            if (!key) return false;
            const layer = layers?.[L];
            if (!layer?.sublayers) return false;
            if (!layer.sublayers.has(key)) return false;
            const off = getFrameCanvas(L, currentFrame, key);
            if (!off) return false;
            try {
                pushUndo(L, currentFrame, key);
            } catch {}
            const ctx = off.getContext("2d", {
                willReadFrequently: true
            });
            if (!ctx) return false;
            const w = off.width | 0, h = off.height | 0;
            const aaOn = getBrushAntiAliasEnabled();
            if (aaOn) {
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
                    d[i + 3] = a >= 128 ? 255 : 0;
                    d[i] = 255;
                    d[i + 1] = 255;
                    d[i + 2] = 255;
                }
                mctx.putImageData(img, 0, 0);
                ctx.save();
                ctx.globalCompositeOperation = "destination-out";
                ctx.drawImage(_lassoMaskC, 0, 0);
                ctx.restore();
            }
            recomputeHasContent(L, currentFrame, key);
            renderAll();
            updateTimelineHasContent(currentFrame);
            pruneUnusedSublayers(L);
            return true;
        }
        function cancelLasso() {
            lassoActive = false;
            lassoPts = [];
            clearFx();
        }
        function startPan(e) {
            isPanning = true;
            const pos = getCanvasPointer(e);
            panStart = {
                x: pos.x * dpr,
                y: pos.y * dpr,
                ox: offsetX,
                oy: offsetY
            };
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
        function startStroke(e) {
            const pos = getCanvasPointer(e);
            let {x: x, y: y} = screenToContent(pos.x, pos.y);
            notePenDetected(e);
            stabilizedPt = null;
            const startPt = stabilizePoint(e, x, y);
            x = startPt.x;
            y = startPt.y;
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
            renderAll();
            updateTimelineHasContent(currentFrame);
        }
        function continueStroke(e) {
            if (!isDrawing) return;
            const pos = getCanvasPointer(e);
            let {x: x, y: y} = screenToContent(pos.x, pos.y);
            notePenDetected(e);
            const movePt = stabilizePoint(e, x, y);
            x = movePt.x;
            y = movePt.y;
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
            function syncActiveLayerSwatchGreen() {
                document.querySelectorAll(".layerSwatchBtn.activeOnActiveLayer").forEach(b => b.classList.remove("activeOnActiveLayer"));
                const L = activeLayer;
                const key = activeSubColor?.[L];
                if (L == null || !key) return;
                const btns = document.querySelectorAll(".layerSwatchBtn");
                for (const b of btns) {
                    const bl = Number(b.dataset.layerId);
                    const bk = String(b.dataset.key || "");
                    if (bl === L && bk === key) {
                        b.classList.add("activeOnActiveLayer");
                        break;
                    }
                }
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
            renderAll();
            updateTimelineHasContent(currentFrame);
        }
        function endStrokeMobileSafe(e) {
            if (typeof _touchGestureActive !== "undefined" && _touchGestureActive) {
                try {
                    cancelLasso?.();
                } catch {}
                try {
                    clearFx?.();
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
                    clearFx();
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
                clearFx?.();
            } catch {}
            try {
                endGlobalHistoryStep?.();
            } catch {}
        }
        function recomputeHasContent(L, F, key) {
            try {
                const k = resolveKeyFor(L, key);
                if (!k) return false;
                const c = getFrameCanvas(L, F, k);
                const ctx = c.getContext("2d", {
                    willReadFrequently: true
                });
                const data = ctx.getImageData(0, 0, contentW, contentH).data;
                let any = false;
                for (let i = 3; i < data.length; i += 4) {
                    if (data[i] > 0) {
                        any = true;
                        break;
                    }
                }
                c._hasContent = any;
                return any;
            } catch {
                return true;
            }
        }
        let _swatchCtxMenu = null;
        let _swatchCtxState = null;
        let _swatchColorPicker = null;
        function isHexColor(s) {
            return typeof s === "string" && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s.trim());
        }
        function normHex6(hex) {
            hex = String(hex || "").trim();
            if (!isHexColor(hex)) return null;
            if (hex.length === 4) {
                const r = hex[1], g = hex[2], b = hex[3];
                hex = `#${r}${r}${g}${g}${b}${b}`;
            }
            return hex.toUpperCase();
        }
        function swatchHexToRgb(hex) {
            hex = normHex6(hex);
            if (!hex) return null;
            const n = parseInt(hex.slice(1), 16);
            return {
                r: n >> 16 & 255,
                g: n >> 8 & 255,
                b: n & 255
            };
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
        function setSwatchHex(L, key, newHex) {
            const sw = getSwatchObj(L, key);
            if (!sw) return;
            if ("hex" in sw) sw.hex = newHex;
            if ("color" in sw) sw.color = newHex;
            if ("col" in sw) sw.col = newHex;
            return setSwatchObjKeyIfNeeded(L, key, newHex);
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
                renderAll();
            } catch {}
        }
        const _swatchPreviewJobs = new Map;
        function _swPrevKey(layerId, key) {
            return `${layerId}::${key}`;
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
                            renderAll?.();
                        } catch {}
                    }();
                }
                job.running = false;
            })();
        }
        function pickColorOnce(startHex, onPick) {
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
            inp.addEventListener("input", fire, {
                once: true
            });
            inp.addEventListener("change", fire, {
                once: true
            });
            inp.addEventListener("blur", () => setTimeout(cleanup, 0), {
                once: true
            });
            inp.click();
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
        function armColorPickerLive(picker, {onLive: onLive, onCommit: onCommit, onCancel: onCancel} = {}) {
            if (!picker) return;
            if (picker._liveArmCleanup) {
                try {
                    picker._liveArmCleanup();
                } catch {}
                picker._liveArmCleanup = null;
            }
            const startHex = picker.value;
            let committed = false;
            let lastPolled = picker.value;
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
            const onInput = e => {
                const hex = e?.target?.value;
                if (hex) safeLive(hex);
            };
            const onChange = e => {
                committed = true;
                const hex = e?.target?.value || picker.value || startHex;
                safeCommit(hex);
                cleanup();
            };
            const poll = setInterval(() => {
                const v = picker.value;
                if (v && v !== lastPolled) {
                    lastPolled = v;
                    safeLive(v);
                }
            }, 33);
            const onWinFocus = () => {
                setTimeout(() => {
                    if (committed) return;
                    const v = picker.value || startHex;
                    if (v === startHex) safeCancel(); else safeCommit(v);
                    cleanup();
                }, 0);
            };
            function cleanup() {
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
                        setPickerToColorString?.(k);
                    } catch {}
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
        function deleteActiveColorAtCurrentFrame() {
            if (activeLayer === PAPER_LAYER) return false;
            const L = activeLayer;
            const layer = layers[L];
            if (!layer?.sublayers || !Array.isArray(layer.suborder)) return false;
            const key = resolveKeyFor(L, activeSubColor?.[L] ?? currentColor);
            if (!key) return false;
            const sub = layer.sublayers.get(key);
            const c = sub?.frames?.[currentFrame];
            if (!c) return false;
            try {
                pushUndo(L, currentFrame, key);
            } catch {}
            try {
                const ctx = c.getContext("2d", {
                    willReadFrequently: true
                });
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.clearRect(0, 0, contentW, contentH);
            } catch {}
            sub.frames[currentFrame] = null;
            renderAll();
            updateTimelineHasContent(currentFrame);
            pruneUnusedSublayers(L);
            return true;
        }
        function endStroke() {
            if (!isDrawing) return;
            isDrawing = false;
            commitGlobalHistoryStep();
            const endKey = strokeHex;
            strokeHex = null;
            renderAll();
            updateTimelineHasContent(currentFrame);
            if (tool === "rect-select") {
                endRectSelect();
                lastPt = null;
                stabilizedPt = null;
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
                clearFx();
                trailPoints = [];
                lastPt = null;
                stabilizedPt = null;
                return;
            }
            if (tool === "fill-eraser") {
                if (activeLayer === PAPER_LAYER) {
                    clearFx();
                    trailPoints = [];
                    lastPt = null;
                    stabilizedPt = null;
                    return;
                }
                const strokePts = trailPoints.length ? trailPoints : lastPt ? [ lastPt ] : [];
                if (strokePts.length) eraseFillRegionsFromSeeds(activeLayer, currentFrame, strokePts);
                clearFx();
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
        function initStagePinchCameraZoom(stageViewport) {
            if (!stageViewport || stageViewport._pinchCamWired) return;
            stageViewport._pinchCamWired = true;
            try {
                stageViewport.style.touchAction = "none";
            } catch {}
            const touches = new Map;
            let pinch = null;
            const VIEW_MIN = .05;
            const VIEW_MAX = 16;
            const clampNum = (v, a, b) => Math.max(a, Math.min(b, v));
            function clientToCanvasLocal(clientX, clientY) {
                const rect = drawCanvas.getBoundingClientRect();
                return {
                    x: clientX - rect.left,
                    y: clientY - rect.top
                };
            }
            function beginPinchIfReady() {
                if (touches.size !== 2) return;
                try {
                    if (isDrawing) endStroke();
                } catch {}
                try {
                    if (isPanning) endPan();
                } catch {}
                const pts = Array.from(touches.values());
                const a = pts[0], b = pts[1];
                const mid = {
                    x: (a.x + b.x) / 2,
                    y: (a.y + b.y) / 2
                };
                const midLocal = clientToCanvasLocal(mid.x, mid.y);
                const before = screenToContent(midLocal.x, midLocal.y);
                const startDist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
                pinch = {
                    startZoom: zoom,
                    startOffsetX: offsetX,
                    startOffsetY: offsetY,
                    startDist: startDist,
                    anchorContent: before
                };
                window.__celstompPinching = true;
                for (const pid of touches.keys()) {
                    try {
                        stageViewport.setPointerCapture(pid);
                    } catch {}
                }
            }
            function updatePinch() {
                if (!pinch || touches.size < 2) return;
                const pts = Array.from(touches.values());
                const a = pts[0], b = pts[1];
                const curDist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
                const factor = curDist / (pinch.startDist || 1);
                const mid = {
                    x: (a.x + b.x) / 2,
                    y: (a.y + b.y) / 2
                };
                const midLocal = clientToCanvasLocal(mid.x, mid.y);
                zoom = clampNum(pinch.startZoom * factor, VIEW_MIN, VIEW_MAX);
                const after = screenToContent(midLocal.x, midLocal.y);
                offsetX = pinch.startOffsetX + (after.x - pinch.anchorContent.x) * (zoom * dpr);
                offsetY = pinch.startOffsetY + (after.y - pinch.anchorContent.y) * (zoom * dpr);
                renderAll();
                updateHUD();
                updatePlayheadMarker();
                updateClipMarkers();
                clearFx();
            }
            stageViewport.addEventListener("pointerdown", e => {
                if (e.pointerType !== "touch") return;
                touches.set(e.pointerId, {
                    x: e.clientX,
                    y: e.clientY
                });
                if (touches.size === 2) {
                    e.preventDefault();
                    beginPinchIfReady();
                    updatePinch();
                }
            }, {
                capture: true,
                passive: false
            });
            stageViewport.addEventListener("pointermove", e => {
                if (e.pointerType !== "touch") return;
                if (!touches.has(e.pointerId)) return;
                touches.set(e.pointerId, {
                    x: e.clientX,
                    y: e.clientY
                });
                if (pinch) {
                    e.preventDefault();
                    updatePinch();
                }
            }, {
                capture: true,
                passive: false
            });
            function end(e) {
                if (e.pointerType !== "touch") return;
                touches.delete(e.pointerId);
                try {
                    stageViewport.releasePointerCapture(e.pointerId);
                } catch {}
                if (touches.size < 2) {
                    pinch = null;
                    window.__celstompPinching = false;
                }
                if (touches.size === 0) {
                    pinch = null;
                    window.__celstompPinching = false;
                }
            }
            stageViewport.addEventListener("pointerup", end, {
                capture: true,
                passive: false
            });
            stageViewport.addEventListener("pointercancel", end, {
                capture: true,
                passive: false
            });
        }
        const activePointers = new Map;
        let pinch = null;
        function clientToCanvasLocal(clientX, clientY) {
            const rect = drawCanvas.getBoundingClientRect();
            return {
                x: clientX - rect.left,
                y: clientY - rect.top
            };
        }
        function handlePointerDown(e) {
            if (e.pointerType === "touch" && window.__celstompPinching) return;
            if ((e.ctrlKey || e.metaKey) && e.pointerType !== "touch") {
                if (beginCtrlMove(e)) {
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
        drawCanvas.addEventListener("wheel", e => {
            e.preventDefault();
            const factor = Math.exp(-e.deltaY * .0015);
            const pos = getCanvasPointer(e);
            const before = screenToContent(pos.x, pos.y);
            zoom = clamp(zoom * factor, .05, 16);
            const after = screenToContent(pos.x, pos.y);
            offsetX += (after.x - before.x) * (zoom * dpr);
            offsetY += (after.y - before.y) * (zoom * dpr);
            renderAll();
            updateHUD();
            updatePlayheadMarker();
            updateClipMarkers();
            clearFx();
        }, {
            passive: false
        });
        initStagePinchCameraZoom(document.getElementById("stageViewport") || document.getElementById("stage") || stageEl || drawCanvas);
        if (!drawCanvas._ptrWired) {
            drawCanvas._ptrWired = true;
            try {
                drawCanvas.style.touchAction = "none";
            } catch {}
            drawCanvas.addEventListener("pointerdown", handlePointerDown, {
                passive: false
            });
            drawCanvas.addEventListener("pointermove", handlePointerMove, {
                passive: false
            });
            drawCanvas.addEventListener("pointerup", handlePointerUp, {
                passive: false
            });
            drawCanvas.addEventListener("pointercancel", handlePointerUp, {
                passive: false
            });
            drawCanvas.addEventListener("contextmenu", e => e.preventDefault());
        }
        const hardResetPinch = () => {
            try {
                touches.clear();
            } catch {}
            pinch = null;
            window.__celstompPinching = false;
            pressureCache.clear();
            tiltCache.clear();
        };
        window.addEventListener("blur", hardResetPinch, true);
        document.addEventListener("visibilitychange", () => {
            if (document.hidden) hardResetPinch();
        }, true);
        if (lassoActive && isDrawing && (tool === "lasso-fill" || tool === "lasso-erase")) {
            addLassoPoint({
                x: x,
                y: y
            });
            drawLassoPreview(tool === "lasso-erase" ? "erase" : "fill");
            e.preventDefault();
            return;
        }
        if (lassoActive && (tool === "lasso-fill" || tool === "lasso-erase")) {
            const k = resolveKeyFor(activeLayer, tool === "lasso-erase" ? activeSubColor?.[activeLayer] ?? currentColor : currentColor);
            try {
                beginGlobalHistoryStep(activeLayer, currentFrame, k);
            } catch {}
            const ok = tool === "lasso-erase" ? applyLassoErase() : applyLassoFill();
            if (ok) {
                try {
                    markGlobalHistoryDirty();
                } catch {}
            }
            try {
                commitGlobalHistoryStep();
            } catch {}
            cancelLasso();
            isDrawing = false;
            e?.preventDefault?.();
            return;
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
            renderAll();
            if (hasTimeline) buildTimeline();
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
            if (hasTimeline) highlightTimelineCell();
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
            if (hasTimeline) highlightTimelineCell();
        }
        function setGhostTargetSingle(frame) {
            ghostTargets = new Set([ frame ]);
            if (hasTimeline) highlightTimelineCell();
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
            if (hasTimeline) highlightTimelineCell();
        }
        function setSingleSelection(f) {
            selectedCels = new Set(hasCel(f) ? [ f ] : []);
            selAnchor = f;
            selLast = f;
            if (hasTimeline) highlightTimelineCell();
        }
        function setSelectionRange(a, b) {
            const lo = Math.min(a, b);
            const hi = Math.max(a, b);
            const next = new Set;
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
        function mountIslandSlots() {
            const island = document.getElementById("floatingIsland");
            const wheelSlot = document.getElementById("islandWheelSlot");
            const brushesSlot = document.getElementById("islandBrushesSlot");
            const toolsSlot = document.getElementById("islandToolsSlot");
            const layersSlot = document.getElementById("islandLayersSlot");
            if (!island || !wheelSlot || !toolsSlot || !layersSlot) return;
            const wheelWrap = document.getElementById("hsvWheelWrap");
            if (wheelWrap && wheelWrap.parentElement !== wheelSlot) {
                wheelSlot.appendChild(wheelWrap);
            }
            const toolSeg = document.getElementById("toolSeg");
            if (toolSeg && toolSeg.parentElement !== toolsSlot) {
                toolsSlot.appendChild(toolSeg);
            }
            const mainBrushSizeGroup = document.getElementById("mainBrushSizeGroup");
            if (mainBrushSizeGroup && mainBrushSizeGroup.parentElement !== toolsSlot) {
                toolsSlot.appendChild(mainBrushSizeGroup);
            }
            const brushSeg = document.getElementById("brushSeg");
            if (brushSeg && brushSeg.parentElement !== brushesSlot) {
                brushesSlot.appendChild(brushSeg);
            }
            const layerSeg = document.getElementById("layerSeg");
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
        mountIslandSlots();
        function initMobileNativeZoomGuard() {
            const stage = document.getElementById("stage");
            if (!stage || stage._nativeZoomGuard) return;
            stage._nativeZoomGuard = true;
            [ "gesturestart", "gesturechange", "gestureend" ].forEach(type => {
                document.addEventListener(type, e => {
                    e.preventDefault();
                }, {
                    passive: false
                });
            });
            let lastEnd = 0;
            stage.addEventListener("touchend", e => {
                const now = Date.now();
                if (now - lastEnd < 300) e.preventDefault();
                lastEnd = now;
            }, {
                passive: false
            });
            if (!window.__CELSTOMP_PTR_DRAW_WIRED__) {
                try {
                    wireCanvasPointerDrawingMobileSafe();
                } catch (e) {
                    console.warn("[celstomp] pointer wiring failed", e);
                }
            }
        }
        function initIslandMinimizeTab() {
            const island = document.getElementById("floatingIsland");
            const collapseBtn = document.getElementById("islandCollapseBtn");
            const tabBtn = document.getElementById("islandTab");
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
            const header = document.getElementById("floatingIslandHeader");
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
        (() => {
            function tryInit() {
                try {
                    initIslandMinimizeTab();
                } catch (e) {
                    console.warn("[island] minimize init failed", e);
                }
                try {
                    initIslandSidePanel();
                } catch (e) {
                    console.warn("[island] side panel init failed", e);
                }
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
                mo.observe(document.body, {
                    childList: true,
                    subtree: true
                });
            }
            if (document.readyState === "loading") {
                window.addEventListener("DOMContentLoaded", boot, {
                    once: true
                });
            } else {
                boot();
            }
        })();
        (() => {
            const btn = document.getElementById("infoBtn");
            const panel = document.getElementById("infoPanel");
            const back = document.getElementById("infoBackdrop");
            const close = document.getElementById("infoCloseBtn");
            if (!btn || !panel || !back) return;
            function openInfo() {
                btn.setAttribute("aria-expanded", "true");
                panel.setAttribute("aria-hidden", "false");
                panel.classList.add("isOpen");
                back.classList.add("isOpen");
                try {
                    panel.focus({
                        preventScroll: true
                    });
                } catch {}
            }
            function closeInfo() {
                btn.setAttribute("aria-expanded", "false");
                panel.setAttribute("aria-hidden", "true");
                panel.classList.remove("isOpen");
                back.classList.remove("isOpen");
            }
            function toggleInfo() {
                const open = panel.classList.contains("isOpen");
                open ? closeInfo() : openInfo();
            }
            btn.addEventListener("click", toggleInfo);
            close?.addEventListener("click", closeInfo);
            back.addEventListener("click", closeInfo);
            window.addEventListener("keydown", e => {
                if (e.key === "Escape" && panel.classList.contains("isOpen")) closeInfo();
            });
        })();
        function initIslandSidePanel() {
            const island = document.getElementById("floatingIsland");
            if (!island) return;
            const dock = island.closest(".islandDock") || island;
            const sideBtn = dock.querySelector("#islandSideBtn") || document.getElementById("islandSideBtn");
            const sidePanel = dock.querySelector("#islandSidePanel") || document.getElementById("islandSidePanel");
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
        function clearCelFrameAllLayers(F) {
            clearFrameAllLayers(F);
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
            renderAll();
            if (hasTimeline) buildTimeline();
            updateHUD();
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
                renderAll();
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
        function pickWebMMime() {
            let m = "video/webm;codecs=vp9";
            if (!MediaRecorder.isTypeSupported(m)) m = "video/webm;codecs=vp8";
            if (!MediaRecorder.isTypeSupported(m)) m = "video/webm";
            return m;
        }
        function pickMP4Mime() {
            const options = [ "video/mp4;codecs=h264", "video/mp4;codecs=avc1", "video/mp4" ];
            for (const m of options) if (MediaRecorder.isTypeSupported(m)) return m;
            return null;
        }
        function initImgSeqExportWiring() {
            return;
        }
        async function onExportImgSeqClick(e) {
            e.preventDefault();
            e.stopPropagation();
            const oldTxt = exportImgSeqBtn.textContent;
            exportImgSeqBtn.disabled = true;
            const transparent = !!e.altKey;
            const fullRange = !!e.shiftKey;
            let baseDir;
            try {
                baseDir = await pickImgSeqDirectoryHandle();
            } catch (err) {
                console.warn("[IMGSEQ] picker cancelled/blocked:", err);
                exportImgSeqBtn.disabled = false;
                exportImgSeqBtn.textContent = oldTxt;
                return;
            }
            const tf = typeof totalFrames === "number" && totalFrames > 0 ? totalFrames : fps * seconds;
            const maxF = Math.max(0, tf - 1);
            const start = fullRange ? 0 : clamp(clipStart | 0, 0, maxF);
            const end = fullRange ? maxF : clamp(clipEnd | 0, start, maxF);
            const count = end - start + 1;
            const folderName = `celstomp_pngseq_${fps}fps_${String(start + 1).padStart(4, "0")}-${String(end + 1).padStart(4, "0")}_${imgSeqTimestampSlug()}`;
            let dir = baseDir;
            try {
                dir = await baseDir.getDirectoryHandle(folderName, {
                    create: true
                });
            } catch {
                dir = baseDir;
            }
            const cc = document.createElement("canvas");
            cc.width = contentW;
            cc.height = contentH;
            const cctx = cc.getContext("2d", {
                alpha: true
            });
            cctx.imageSmoothingEnabled = !!antiAlias;
            try {
                exportImgSeqBtn.textContent = "Exporting… 0%";
                await withImgSeqExportOverridesAsync(async () => {
                    for (let f = start; f <= end; f++) {
                        await drawFrameTo(cctx, f, {
                            forceHoldOff: true,
                            transparent: transparent
                        });
                        const blob = await imgSeqCanvasToPngBlob(cc);
                        const fname = `frame_${String(f - start).padStart(4, "0")}.png`;
                        if (dir && dir.getFileHandle) {
                            const fh = await dir.getFileHandle(fname, {
                                create: true
                            });
                            const w = await fh.createWritable();
                            await w.write(blob);
                            await w.close();
                        } else {
                            imgSeqDownloadBlob(blob, fname);
                            await imgSeqYield(60);
                        }
                        const done = f - start + 1;
                        if (done % 2 === 0) {
                            exportImgSeqBtn.textContent = `Exporting… ${Math.round(done / count * 100)}%`;
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
            try {
                return await window.showDirectoryPicker({
                    mode: "readwrite",
                    startIn: "downloads"
                });
            } catch {
                return await window.showDirectoryPicker({
                    mode: "readwrite"
                });
            }
        }
        function imgSeqTimestampSlug(d = new Date) {
            const p2 = n => String(n).padStart(2, "0");
            return d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + "_" + p2(d.getHours()) + p2(d.getMinutes()) + p2(d.getSeconds());
        }
        function imgSeqCanvasToPngBlob(canvas) {
            return new Promise((res, rej) => {
                canvas.toBlob(b => b ? res(b) : rej(new Error("toBlob returned null")), "image/png");
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
            return typeof sleep === "function" ? sleep(ms) : new Promise(r => setTimeout(r, ms));
        }
        async function withImgSeqExportOverridesAsync(fn) {
            const prev = {
                hold: typeof transparencyHoldEnabled !== "undefined" ? transparencyHoldEnabled : undefined,
                onion: typeof onionEnabled !== "undefined" ? onionEnabled : undefined,
                paperOpacity: null,
                paperAcc: null,
                paperPrev: null
            };
            try {
                if (typeof transparencyHoldEnabled !== "undefined") transparencyHoldEnabled = false;
                if (typeof onionEnabled !== "undefined") onionEnabled = false;
                if (typeof getPaperAccessor === "function") {
                    prev.paperAcc = getPaperAccessor();
                    if (prev.paperAcc) {
                        prev.paperPrev = prev.paperAcc.get();
                        prev.paperAcc.set(false);
                    }
                }
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
                    try {
                        prev.paperAcc.set(prev.paperPrev);
                    } catch {}
                }
            }
        }
        function zpad(n, w) {
            return String(n).padStart(w, "0");
        }
        function getFullAnimRange() {
            if (typeof animStart !== "undefined" && typeof animEnd !== "undefined") {
                return {
                    start: animStart | 0,
                    end: animEnd | 0
                };
            }
            if (typeof frameCount !== "undefined") {
                const fc = frameCount | 0;
                return {
                    start: 0,
                    end: Math.max(0, fc - 1)
                };
            }
            if (typeof totalFrames !== "undefined") {
                const tf = totalFrames | 0;
                return {
                    start: 0,
                    end: Math.max(0, tf - 1)
                };
            }
            if (typeof timelineFrames !== "undefined") {
                const tf = timelineFrames | 0;
                return {
                    start: 0,
                    end: Math.max(0, tf - 1)
                };
            }
            return {
                start: clipStart | 0,
                end: clipEnd | 0
            };
        }
        function canvasToPngBlob(canvas) {
            return new Promise((res, rej) => {
                canvas.toBlob(b => b ? res(b) : rej(new Error("PNG export failed (toBlob returned null)")), "image/png");
            });
        }
        async function writeBlobToFile(fileHandle, blob) {
            const w = await fileHandle.createWritable();
            await w.write(blob);
            await w.close();
        }
        async function withPaperForcedOffAsync(fn) {
            const prev = {};
            if (typeof showPaper !== "undefined") {
                prev.showPaper = showPaper;
                showPaper = false;
            }
            if (typeof paperEnabled !== "undefined") {
                prev.paperEnabled = paperEnabled;
                paperEnabled = false;
            }
            if (typeof paperLayerEnabled !== "undefined") {
                prev.paperLayerEnabled = paperLayerEnabled;
                paperLayerEnabled = false;
            }
            if (typeof state !== "undefined" && state) {
                if ("showPaper" in state) {
                    prev.state_showPaper = state.showPaper;
                    state.showPaper = false;
                }
                if ("paperEnabled" in state) {
                    prev.state_paperEnabled = state.paperEnabled;
                    state.paperEnabled = false;
                }
                if ("paperVisible" in state) {
                    prev.state_paperVisible = state.paperVisible;
                    state.paperVisible = false;
                }
                if ("paperLayerEnabled" in state) {
                    prev.state_paperLayerEnabled = state.paperLayerEnabled;
                    state.paperLayerEnabled = false;
                }
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
        async function exportPNGSequence({start: start, end: end, fpsLocal: fpsLocal}) {
            const cc = document.createElement("canvas");
            cc.width = contentW;
            cc.height = contentH;
            const cctx = cc.getContext("2d");
            cctx.imageSmoothingEnabled = !!antiAlias;
            const count = Math.max(0, end - start + 1);
            const pad = Math.max(4, String(count).length);
            if (window.showDirectoryPicker) {
                const dir = await window.showDirectoryPicker({
                    mode: "readwrite"
                });
                const manifest = {
                    app: "Celstomp",
                    fps: fpsLocal,
                    startFrame: start,
                    endFrame: end,
                    width: contentW,
                    height: contentH,
                    generatedAt: (new Date).toISOString()
                };
                const mh = await dir.getFileHandle("manifest.json", {
                    create: true
                });
                await writeBlobToFile(mh, new Blob([ JSON.stringify(manifest, null, 2) ], {
                    type: "application/json"
                }));
                for (let f = start, idx = 0; f <= end; f++, idx++) {
                    await sleep(0);
                    await drawFrameTo(cctx, i, {
                        forceHoldOff: true
                    });
                    const blob = await canvasToPngBlob(cc);
                    const name = `frame_${zpad(idx + 1, pad)}.png`;
                    const fh = await dir.getFileHandle(name, {
                        create: true
                    });
                    await writeBlobToFile(fh, blob);
                }
                return;
            }
            for (let f = start, idx = 0; f <= end; f++, idx++) {
                await sleep(0);
                await drawFrameTo(cctx, i, {
                    forceHoldOff: true
                });
                const blob = await canvasToPngBlob(cc);
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `celstomp_${fpsLocal}fps_frame_${zpad(idx + 1, pad)}.png`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
                await sleep(30);
            }
        }
        async function exportPNGSequenceFull() {
            const {start: start, end: end} = getFullAnimRange();
            if (typeof withTransparencyHoldForcedOffAsync === "function") {
                return await withTransparencyHoldForcedOffAsync(async () => await withPaperForcedOffAsync(async () => await exportPNGSequence({
                    start: start,
                    end: end,
                    fpsLocal: fps
                })));
            }
            return await withPaperForcedOffAsync(async () => await exportPNGSequence({
                start: start,
                end: end,
                fpsLocal: fps
            }));
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
        function padNum(n, w = 4) {
            const s = String(n);
            return s.length >= w ? s : "0".repeat(w - s.length) + s;
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
            return new Promise(res => canvas.toBlob(b => res(b), "image/png"));
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
        async function exportPNGSequenceFull() {
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
                if (window.showDirectoryPicker) {
                    const root = await window.showDirectoryPicker({
                        mode: "readwrite"
                    });
                    const dir = await root.getDirectoryHandle(folderName, {
                        create: true
                    });
                    for (let i = start; i <= end; i++) {
                        await sleep(0);
                        await drawFrameTo(cctx, i, {
                            forceHoldOff: true
                        });
                        const blob = await canvasToPngBlob(cc);
                        if (!blob) throw new Error("Failed to encode PNG blob.");
                        const fname = `frame_${padNum(i - start, 4)}.png`;
                        const fileHandle = await dir.getFileHandle(fname, {
                            create: true
                        });
                        const writable = await fileHandle.createWritable();
                        await writable.write(blob);
                        await writable.close();
                    }
                    alert(`Saved PNG sequence to folder: ${folderName}`);
                    return;
                }
                if (typeof JSZip === "undefined") {
                    for (let i = start; i <= end; i++) {
                        await sleep(0);
                        await drawFrameTo(cctx, i, {
                            forceHoldOff: true
                        });
                        const blob = await canvasToPngBlob(cc);
                        const fname = `${folderName}_frame_${padNum(i - start, 4)}.png`;
                        downloadBlob(blob, fname);
                        await sleep(80);
                    }
                    alert("Downloaded PNGs individually (your browser doesn’t support folder export, and JSZip not loaded).");
                    return;
                }
                const zip = new JSZip;
                const folder = zip.folder(folderName);
                for (let i = start; i <= end; i++) {
                    await sleep(0);
                    await drawFrameTo(cctx, i, {
                        forceHoldOff: true
                    });
                    const blob = await canvasToPngBlob(cc);
                    const ab = await blob.arrayBuffer();
                    folder.file(`frame_${padNum(i - start, 4)}.png`, ab);
                }
                const zipBlob = await zip.generateAsync({
                    type: "blob"
                });
                downloadBlob(zipBlob, `${folderName}.zip`);
            });
        }
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
        function syncAutosaveUiState() {
            const enabled = autosaveController?.isEnabled?.() ?? autosaveEnabled;
            const minutes = Math.max(1, Math.round((autosaveController?.getIntervalMs?.() ?? autosaveIntervalMinutes * 60000) / 60000));
            autosaveEnabled = !!enabled;
            autosaveIntervalMinutes = minutes;
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
            fr.onload = () => {
                (async () => {
                    const data = JSON.parse(fr.result);
                    try {
                        if (typeof stopPlayback === "function") stopPlayback();
                    } catch {}
                    try {
                        clearFx?.();
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
                        renderAll?.();
                    } catch {}
                    try {
                        updateHUD?.();
                    } catch {}
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
                        applyOklchDefaultToPicker?.();
                    } catch {}
                    try {
                        setColorSwatch?.();
                    } catch {}
                    try {
                        setHSVPreviewBox?.();
                    } catch {}
                    try {
                        setPickerToColorString?.(currentColor);
                    } catch {}
                    try {
                        centerView?.();
                    } catch {}
                    try {
                        updateHUD?.();
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
        (() => {
            function boot() {
                const tl = document.getElementById("timeline");
                const header = document.getElementById("timelineHeader");
                const leftBtn = document.getElementById("tlMobLeftBtn");
                const rightBtn = document.getElementById("tlMobRightBtn");
                if (!tl || !header || !leftBtn || !rightBtn) return;
                if (tl._mobDrawerWired) return;
                tl._mobDrawerWired = true;
                const mq = window.matchMedia("(max-width: 720px)");
                const isMobile = () => mq.matches;
                try {
                    leftBtn.style.touchAction = "manipulation";
                } catch {}
                try {
                    rightBtn.style.touchAction = "manipulation";
                } catch {}
                let lastToggleAt = 0;
                const toggleOnce = fn => {
                    const t = performance.now();
                    if (t - lastToggleAt < 250) return;
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
                function openLeft() {
                    if (!isMobile()) return;
                    tl.classList.toggle("mob-left-open", !tl.classList.contains("mob-left-open"));
                    tl.classList.remove("mob-right-open");
                    syncAria();
                }
                function openRight() {
                    if (!isMobile()) return;
                    tl.classList.toggle("mob-right-open", !tl.classList.contains("mob-right-open"));
                    tl.classList.remove("mob-left-open");
                    syncAria();
                }
                function wireBtn(btn, fn) {
                    const fire = e => {
                        if (!isMobile()) return;
                        e.preventDefault();
                        e.stopPropagation();
                        toggleOnce(fn);
                    };
                    btn.addEventListener("pointerdown", fire, {
                        capture: true,
                        passive: false
                    });
                    btn.addEventListener("touchstart", fire, {
                        capture: true,
                        passive: false
                    });
                    btn.addEventListener("click", e => {
                        if (!isMobile()) return;
                        e.preventDefault();
                        e.stopPropagation();
                        toggleOnce(fn);
                    }, {
                        passive: false
                    });
                }
                wireBtn(leftBtn, openLeft);
                wireBtn(rightBtn, openRight);
                const outsideClose = e => {
                    if (!isMobile()) return;
                    const t = e.target;
                    if (tl.contains(t) || header.contains(t) || leftBtn.contains(t) || rightBtn.contains(t)) return;
                    closeAll();
                };
                document.addEventListener("pointerdown", outsideClose, {
                    capture: true,
                    passive: true
                });
                document.addEventListener("touchstart", outsideClose, {
                    capture: true,
                    passive: true
                });
                const onMqChange = () => closeAll();
                if (mq.addEventListener) mq.addEventListener("change", onMqChange); else if (mq.addListener) mq.addListener(onMqChange);
                syncAria();
            }
            if (document.readyState === "loading") {
                window.addEventListener("DOMContentLoaded", boot, {
                    once: true
                });
            } else {
                boot();
            }
        })();
        (() => {
            const btn = document.getElementById("mobileIslandToggle");
            const app = document.querySelector(".app");
            if (!btn || !app) return;
            function toggleIsland() {
                app.classList.toggle("rightbar-open");
            }
            btn.addEventListener("pointerdown", e => {
                e.preventDefault();
                e.stopPropagation();
                toggleIsland();
            }, {
                passive: false
            });
            const obs = new MutationObserver(() => {
                btn.textContent = app.classList.contains("rightbar-open") ? "✕" : "☰";
            });
            obs.observe(app, {
                attributes: true,
                attributeFilter: [ "class" ]
            });
        })();
        function initTimelineOnionContextMenu() {
            const onionBtn = document.getElementById("tlOnion");
            const menu = document.getElementById("onionCtxMenu");
            const block = document.getElementById("onionOptionsBlock");
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
            const row = document.getElementById("tlPlayheadRow") || document.querySelector(".playheadRow") || document.querySelector("[data-playhead-row]");
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
                if (typeof window.setCurrentFrame === "function") {
                    window.setCurrentFrame(frame);
                    return;
                }
                if (typeof window.setPlayheadFrame === "function") {
                    window.setPlayheadFrame(frame);
                    return;
                }
                if (typeof window.gotoFrame === "function") {
                    window.gotoFrame(frame);
                    return;
                }
                if (typeof window.setFrame === "function") {
                    window.setFrame(frame);
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
        try {
            initMobileTimelineScrub();
        } catch {}
        function initTimelineToggleBridge() {
            const tlOnion = document.getElementById("tlOnion");
            const btnOnion = document.getElementById("toggleOnion");
            const btnTrans = document.getElementById("toggleTransparency");
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
        (() => {
            const boot = () => {
                try {
                    initTimelineOnionContextMenu();
                } catch {}
            };
            if (document.readyState === "loading") window.addEventListener("DOMContentLoaded", boot, {
                once: true
            }); else boot();
            initTimelineToggleBridge();
            if (document.readyState === "loading") {
                window.addEventListener("DOMContentLoaded", initTransparencyControls, {
                    once: true
                });
            } else {
                initTransparencyControls();
            }
        })();
        function wirePointerDrawingOnCanvas(drawCanvas) {
            if (!drawCanvas) return;
            if (window.__CELSTOMP_PTR_DRAW_WIRED__) return;
            window.__CELSTOMP_PTR_DRAW_WIRED__ = true;
            const stageViewport = document.getElementById("stageViewport") || document.getElementById("stage") || drawCanvas;
            try {
                stageViewport.style.touchAction = "none";
            } catch {}
            try {
                drawCanvas.style.touchAction = "none";
            } catch {}
            drawCanvas.addEventListener("contextmenu", e => e.preventDefault());
            const isCanvasDownTarget = t => !!(t && (t.tagName === "CANVAS" || t.closest?.("canvas")));
            const getToolName = () => String(typeof tool !== "undefined" && tool ? tool : "");
            function dispatchMouseOn(target, type, x, y, buttons) {
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
            function mouseDown(x, y) {
                dispatchMouseOn(drawCanvas, "mousedown", x, y, 1);
            }
            function mouseMove(x, y) {
                dispatchMouseOn(drawCanvas, "mousemove", x, y, 1);
                dispatchMouseOn(window, "mousemove", x, y, 1);
            }
            function mouseUp(x, y) {
                dispatchMouseOn(drawCanvas, "mouseup", x, y, 0);
                dispatchMouseOn(window, "mouseup", x, y, 0);
            }
            let activeDrawPid = null;
            function startDraw(pid, x, y) {
                if (activeDrawPid != null) return;
                activeDrawPid = pid;
                mouseDown(x, y);
            }
            function moveDraw(pid, x, y) {
                if (activeDrawPid !== pid) return;
                mouseMove(x, y);
            }
            function endDraw(pid, x, y) {
                if (activeDrawPid !== pid) return;
                mouseUp(x, y);
                activeDrawPid = null;
            }
            const touches = new Map;
            let pinch = null;
            let lockUntilAllUp = false;
            let pending = null;
            const START_DELAY_MS = 70;
            const START_MOVE_PX = 4;
            const IMMEDIATE_TOOLS = new Set([ "fill-brush", "fill-eraser", "lasso-fill", "lasso-erase" ]);
            const VIEW_MIN = .05;
            const VIEW_MAX = 16;
            const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
            function clientToCanvasLocal(clientX, clientY) {
                const rect = drawCanvas.getBoundingClientRect();
                return {
                    x: clientX - rect.left,
                    y: clientY - rect.top
                };
            }
            function cancelPending() {
                if (!pending) return;
                clearTimeout(pending.tmr);
                pending = null;
            }
            function stopStrokeNow(x, y) {
                cancelPending();
                if (activeDrawPid != null) endDraw(activeDrawPid, x ?? 0, y ?? 0);
            }
            function beginPinch() {
                if (touches.size < 2) return;
                stopStrokeNow();
                const ids = Array.from(touches.keys()).slice(0, 2);
                const a = touches.get(ids[0]);
                const b = touches.get(ids[1]);
                if (!a || !b) return;
                const startDist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
                const mid = {
                    x: (a.x + b.x) / 2,
                    y: (a.y + b.y) / 2
                };
                const midLocal = clientToCanvasLocal(mid.x, mid.y);
                const anchorContent = screenToContent(midLocal.x, midLocal.y);
                pinch = {
                    ids: ids,
                    startDist: startDist,
                    startZoom: zoom,
                    anchorContent: anchorContent
                };
                window.__celstompPinching = true;
            }
            function updatePinch() {
                if (!pinch) return;
                const a = touches.get(pinch.ids[0]);
                const b = touches.get(pinch.ids[1]);
                if (!a || !b) return;
                const curDist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
                const ratio = curDist / (pinch.startDist || 1);
                const nextZoom = clamp(pinch.startZoom * ratio, VIEW_MIN, VIEW_MAX);
                const mid = {
                    x: (a.x + b.x) / 2,
                    y: (a.y + b.y) / 2
                };
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
            stageViewport.addEventListener("pointerdown", e => {
                if (e.pointerType === "mouse" && e.button !== 0) return;
                if (!isCanvasDownTarget(e.target)) return;
                if (e.pointerType === "touch") {
                    touches.set(e.pointerId, {
                        x: e.clientX,
                        y: e.clientY
                    });
                    if (touches.size >= 2) {
                        lockUntilAllUp = true;
                        stopStrokeNow(e.clientX, e.clientY);
                        e.preventDefault();
                        e.stopPropagation();
                        try {
                            stageViewport.setPointerCapture(e.pointerId);
                        } catch {}
                        beginPinch();
                        updatePinch();
                        return;
                    }
                    if (lockUntilAllUp) return;
                    e.preventDefault();
                    e.stopPropagation();
                    const pid = e.pointerId;
                    try {
                        stageViewport.setPointerCapture(pid);
                    } catch {}
                    const tTool = String(typeof tool !== "undefined" && tool ? tool : "");
                    if (IMMEDIATE_TOOLS.has(tTool)) {
                        e.preventDefault();
                        if (activeDrawPid == null) {
                            startDraw(e.pointerId, e.clientX, e.clientY);
                            if (tapTrack && tapTrack.pid === e.pointerId) tapTrack.startedStroke = true;
                        }
                        moveDraw(e.pointerId, e.clientX, e.clientY);
                        return;
                    }
                    const x0 = e.clientX, y0 = e.clientY;
                    pending = {
                        pid: pid,
                        x0: x0,
                        y0: y0,
                        tmr: setTimeout(() => {
                            if (!pending) return;
                            if (touches.size === 1 && touches.has(pid) && !lockUntilAllUp) {
                                startDraw(pid, x0, y0);
                            }
                            pending = null;
                        }, START_DELAY_MS)
                    };
                    return;
                }
                e.preventDefault();
                startDraw(e.pointerId, e.clientX, e.clientY);
            }, {
                capture: true,
                passive: false
            });
            stageViewport.addEventListener("pointermove", e => {
                if (e.pointerType === "touch") {
                    if (touches.has(e.pointerId)) {
                        touches.set(e.pointerId, {
                            x: e.clientX,
                            y: e.clientY
                        });
                    }
                    if (pinch && touches.size >= 2) {
                        e.preventDefault();
                        e.stopPropagation();
                        updatePinch();
                        return;
                    }
                    if (lockUntilAllUp) return;
                    const tTool = getToolName();
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
                    if (activeDrawPid == null && IMMEDIATE_TOOLS.has(tTool) && touches.size === 1) {
                        startDraw(e.pointerId, e.clientX, e.clientY);
                    }
                    moveDraw(e.pointerId, e.clientX, e.clientY);
                    e.preventDefault();
                    e.stopPropagation();
                    return;
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
                    moveDraw(e.pointerId, e.clientX, e.clientY);
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                moveDraw(e.pointerId, e.clientX, e.clientY);
            }, {
                capture: true,
                passive: false
            });
            function endPointer(e) {
                if (e.pointerType === "touch") {
                    touches.delete(e.pointerId);
                    pressureCache.delete(e.pointerId);
                    tiltCache.delete(e.pointerId);
                    if (pending && pending.pid === e.pointerId) cancelPending();
                    if (activeDrawPid === e.pointerId) endDraw(e.pointerId, e.clientX, e.clientY);
                    if (touches.size < 2) pinch = null;
                    if (touches.size === 0) {
                        lockUntilAllUp = false;
                        pinch = null;
                        window.__celstompPinching = false;
                    }
                    try {
                        stageViewport.releasePointerCapture(e.pointerId);
                    } catch {}
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                if (activeDrawPid === e.pointerId) {
                    e.preventDefault();
                    endDraw(e.pointerId, e.clientX, e.clientY);
                }
                pressureCache.delete(e.pointerId);
                tiltCache.delete(e.pointerId);
            }
            stageViewport.addEventListener("pointerup", endPointer, {
                capture: true,
                passive: false
            });
            stageViewport.addEventListener("pointercancel", endPointer, {
                capture: true,
                passive: false
            });
        }
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
            safeSetValue(snap, snapFrames);
            safeSetValue(secs, seconds);
            safeSetValue(fpsInp, fps);
            safeSetChecked(onion, onionEnabled);
            safeSetChecked(psnap, playSnapped);
            toggle?.addEventListener("click", () => {
                if (isPlaying) pausePlayback(); else startPlayback();
            });
            prevF?.addEventListener("click", () => gotoFrame(stepBySnap(-1)));
            nextF?.addEventListener("click", () => gotoFrame(stepBySnap(1)));
            prevC?.addEventListener("click", gotoPrevCel);
            nextC?.addEventListener("click", gotoNextCel);
            onion?.addEventListener("change", e => {
                const now = !!e.target.checked;
                if (now !== onionEnabled) toggleOnionBtn?.click();
            });
            dup?.addEventListener("click", onDuplicateCel);
            snap?.addEventListener("input", e => {
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
            secs?.addEventListener("change", e => {
                seconds = Math.max(1, parseInt(e.target.value || 1, 10) || 1);
                totalFrames = fps * seconds;
                safeText(secLabel, String(seconds));
                rebuildTimelineKeepFrame();
            });
            fpsInp?.addEventListener("change", e => {
                fps = Math.max(1, parseInt(e.target.value || 1, 10) || 1);
                totalFrames = fps * seconds;
                safeText(fpsLabel, String(fps));
                rebuildTimelineKeepFrame();
            });
            psnap?.addEventListener("change", e => {
                playSnapped = !!e.target.checked;
                safeSetChecked(playSnappedChk, playSnapped);
            });
        }
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
            let dragging = false, sx = 0, sy = 0, ox = 0, oy = 0;
            head.addEventListener("mousedown", e => {
                if (dock.classList.contains("docked-right")) return;
                dragging = true;
                sx = e.clientX;
                sy = e.clientY;
                const r = dock.getBoundingClientRect();
                ox = r.left;
                oy = r.top;
                e.preventDefault();
            });
            window.addEventListener("mousemove", e => {
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
            window.addEventListener("mouseup", () => {
                dragging = false;
            });
            btn?.addEventListener("click", () => {
                if (!body) return;
                body.style.display = body.style.display === "none" ? "" : "none";
            });
            window.addEventListener("resize", () => clampDockIntoView());
        }
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
        function wireIslandResize() {
            const dock = document.querySelector(".islandDock") || document.getElementById("floatingIsland");
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
        wireIslandResize();
        wireTopMenus();
        const layerSeg = $("layerSeg");
        layerSeg?.addEventListener("change", () => {
            wireLayerVisButtons();
            if (activeLayer !== PAPER_LAYER) rememberCurrentColorForLayer(activeLayer);
            const val = document.querySelector('input[name="btype"]:checked')?.value || "line";
            if (val === "paper") {
                activeLayer = PAPER_LAYER;
                renderLayerSwatches();
                updateHUD();
                return;
            }
            activeLayer = layerFromValue(val);
            const hex = activeSubColor[activeLayer] || "#000000";
            currentColor = hex;
            try {
                setPickerToColorString?.(hex);
            } catch {}
            try {
                setColorSwatch?.();
            } catch {}
            renderLayerSwatches();
            applyRememberedColorForLayer(activeLayer);
            try {
                const c = getRememberedColorForLayer?.(activeLayer) || currentColor || "#000000";
                setCurrentColorHex(c, {
                    remember: false
                });
            } catch {
                drawHSVWheel();
            }
        });
        saveOklchDefaultBtn?.addEventListener("click", () => {
            const L = clamp(parseFloat(defLInput?.value) || 0, 0, 100);
            const C = clamp(parseFloat(defCInput?.value) || 0, 0, 1);
            const H = clamp(parseFloat(defHInput?.value) || 0, 0, 360);
            oklchDefault = {
                L: L,
                C: C,
                H: H
            };
            applyOklchDefaultToPicker();
            if (oklchDefaultStatus) {
                oklchDefaultStatus.style.display = "inline-block";
                setTimeout(() => oklchDefaultStatus.style.display = "none", 1200);
            }
        });
        toolSeg?.addEventListener("change", () => {
            tool = document.querySelector('input[name="tool"]:checked')?.value || "brush";
            if (tool !== "rect-select" && rectSelection.active && !rectSelection.moving) {
                clearRectSelection();
            }
            refreshToolSettingsUI();
            scheduleBrushPreviewUpdate(true);
            updateHUD();
            clearFx();
        });
        brushShapeSeg?.addEventListener("change", () => {
            const selectedShape = document.querySelector('input[name="brushShape"]:checked')?.value || "circle";
            if (tool === "eraser") {
                eraserSettings = mergeBrushSettings(eraserSettings, {
                    shape: selectedShape
                });
                eraserSize = eraserSettings.size;
            } else {
                brushSettings = mergeBrushSettings(brushSettings, {
                    shape: selectedShape
                });
                brushType = brushSettings.shape;
                brushSize = brushSettings.size;
            }
            refreshToolSettingsUI();
            scheduleBrushPreviewUpdate(true);
            updateHUD();
            clearFx();
        });
        addPaletteColorBtn?.addEventListener("click", () => {
            addCurrentColorToPalette();
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
        bgColorInput?.addEventListener("input", e => {
            setCanvasBgColor(e.target.value);
        });
        bgColorInput?.addEventListener("click", e => {
            e.preventDefault();
            e.stopPropagation();
            openColorPickerAtCursor(e, canvasBgColor, hex => {
                canvasBgColor = hex;
                try {
                    bgColorInput.value = hex;
                } catch {}
                renderAll();
            });
        }, {
            passive: false
        });
        aaToggle?.addEventListener("change", e => {
            antiAlias = e.target.checked;
            renderAll();
        });
        const applyStabilizationLevel = v => {
            stabilizationLevel = Math.max(0, Math.min(10, parseInt(v, 10) || 0));
            pressureSmooth = pressureSmoothFromLevel(stabilizationLevel);
            strokeSmooth = strokeSmoothFromLevel(stabilizationLevel);
            safeSetValue(stabilizationSelect, stabilizationLevel);
        };
        setPenControlsVisible(false);
        safeSetChecked(pressureSizeToggle, usePressureSize);
        safeSetChecked(pressureOpacityToggle, usePressureOpacity);
        safeSetChecked(pressureTiltToggle, usePressureTilt);
        applyStabilizationLevel(stabilizationLevel);
        stabilizationSelect?.addEventListener("change", e => {
            applyStabilizationLevel(e.target.value);
        });

        // Font and Canvas Aspect Ratio Settings
        const ASPECT_RATIOS = {
            "16:9": { w: 1920, h: 1080 },
            "4:3": { w: 1600, h: 1200 },
            "3:2": { w: 1800, h: 1200 },
            "2:3": { w: 1200, h: 1800 },
            "1:1": { w: 1200, h: 1200 },
            "9:16": { w: 1080, h: 1920 }
        };
        const FONT_OPTIONS = {
            "Cascadia": "\"Cascadia\", \"Cascadia Code\", \"Cascadia Mono\", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", monospace",
            "Roboto Mono": "\"Roboto Mono\", monospace",
            "Google Sans": "\"Google Sans\", \"Product Sans\", Arial, sans-serif",
            "Poppins": "\"Poppins\", sans-serif",
            "Comic Sans MS": "\"Comic Sans MS\", cursive, sans-serif",
            "Inconstant": "\"Inconstant\", sans-serif",
            "OpenDyslexic": "\"OpenDyslexicRegular\", \"OpenDyslexic\", sans-serif"
        };
        const FONT_STORAGE_KEY = "celstomp.ui.font.v1";
        const ASPECT_STORAGE_KEY = "celstomp.ui.aspect.v1";
        const aspectRatioSelect = $("aspectRatioSelect");
        const fontSelect = $("fontSelect");

        function applyFont(fontName) {
            const fontStack = FONT_OPTIONS[fontName] || FONT_OPTIONS["Cascadia"];
            document.documentElement.style.setProperty("--font", fontStack);
            try {
                localStorage.setItem(FONT_STORAGE_KEY, fontName);
            } catch {}
            if (fontSelect) safeSetValue(fontSelect, fontName);
        }

        function applyAspectRatio(ratio, skipResize = false) {
            const preset = ASPECT_RATIOS[ratio];
            if (preset) {
                contentW = preset.w;
                contentH = preset.h;
            }
            try {
                localStorage.setItem(ASPECT_STORAGE_KEY, ratio);
            } catch {}
            if (aspectRatioSelect) safeSetValue(aspectRatioSelect, ratio);
            if (!skipResize) {
                resizeCanvases();
            }
        }

        // Load saved settings
        (function loadSavedSettings() {
            // Load font
            let savedFont = "Cascadia";
            try {
                savedFont = localStorage.getItem(FONT_STORAGE_KEY) || "Cascadia";
            } catch {}
            if (FONT_OPTIONS[savedFont]) {
                applyFont(savedFont);
            }

            // Load aspect ratio
            let savedAspect = "16:9";
            try {
                savedAspect = localStorage.getItem(ASPECT_STORAGE_KEY) || "16:9";
            } catch {}
            if (ASPECT_RATIOS[savedAspect]) {
                applyAspectRatio(savedAspect, true);
            }
        })();

        // Event listeners
        fontSelect?.addEventListener("change", e => {
            applyFont(e.target.value);
        });

        aspectRatioSelect?.addEventListener("change", e => {
            applyAspectRatio(e.target.value);
        });

        const clampBrushSizeUiValue = raw => {
            const n = parseInt(raw, 10);
            const min = parseInt(brushSizeInput?.min || brushSizeNumInput?.min || "1", 10) || 1;
            const max = parseInt(brushSizeInput?.max || brushSizeNumInput?.max || "999", 10) || 999;
            return Math.max(min, Math.min(max, Number.isFinite(n) ? n : brushSize));
        };
        const applyBrushSizeUi = v => {
            const nextSize = clampBrushSizeUiValue(v);
            if (tool === "eraser") {
                eraserSettings = mergeBrushSettings(eraserSettings, {
                    size: nextSize
                });
                eraserSize = eraserSettings.size;
            } else {
                brushSettings = mergeBrushSettings(brushSettings, {
                    size: nextSize
                });
                brushType = brushSettings.shape;
                brushSize = brushSettings.size;
            }
            refreshToolSettingsUI();
            try {
                scheduleBrushPreviewUpdate?.(true);
            } catch {}
        };
        brushSizeInput?.addEventListener("input", e => {
            applyBrushSizeUi(e.target.value);
        });
        brushSizeNumInput?.addEventListener("input", e => {
            applyBrushSizeUi(e.target.value);
        });
        eraserSizeInput?.addEventListener("input", e => {
            eraserSize = parseInt(e.target.value, 10);
            eraserSettings = mergeBrushSettings(eraserSettings, {
                size: eraserSize
            });
            safeText(eraserVal, String(eraserSize));
            refreshToolSettingsUI();
        });
        toolOpacityRange?.addEventListener("input", e => {
            const v = clamp01((parseInt(e.target.value, 10) || 100) / 100);
            setActiveToolSettings({
                opacity: v
            });
            _brushStampCache.clear();
            scheduleBrushPreviewUpdate(true);
            refreshToolSettingsUI();
        });
        toolAngleRange?.addEventListener("input", e => {
            const v = Math.max(-90, Math.min(90, parseInt(e.target.value, 10) || 0));
            setActiveToolSettings({
                angle: v
            });
            _brushMaskCache.clear();
            _brushStampCache.clear();
            scheduleBrushPreviewUpdate(true);
            refreshToolSettingsUI();
        });
        wireToolSettingsFolds();
        wireBrushShapeTooltips();
        refreshToolSettingsUI();
        pressureSizeToggle?.addEventListener("change", e => usePressureSize = e.target.checked);
        pressureOpacityToggle?.addEventListener("change", e => usePressureOpacity = e.target.checked);
        pressureTiltToggle?.addEventListener("change", e => usePressureTilt = e.target.checked);
        toggleOnionBtn?.addEventListener("click", () => {
            onionEnabled = !onionEnabled;
            toggleOnionBtn.textContent = `Onion: ${onionEnabled ? "On" : "Off"}`;
            renderAll();
        });
        function setTransparencyEnabled(on) {
            transparencyHoldEnabled = !!on;
            const btn = document.getElementById("toggleTransparency");
            if (btn) btn.textContent = `Transparency: ${transparencyHoldEnabled ? "On" : "Off"}`;
            const chk = document.getElementById("tlTransparency");
            if (chk) chk.checked = transparencyHoldEnabled;
            try {
                renderAll();
            } catch {}
        }
        function initTransparencyControls() {
            const btn = document.getElementById("toggleTransparency");
            const chk = document.getElementById("tlTransparency");
            if (btn && !btn._wiredTransparency) {
                btn._wiredTransparency = true;
                btn.addEventListener("click", () => setTransparencyEnabled(!transparencyHoldEnabled));
            }
            if (chk && !chk._wiredTransparency) {
                chk._wiredTransparency = true;
                chk.addEventListener("change", () => setTransparencyEnabled(chk.checked));
            }
            setTransparencyEnabled(!!transparencyHoldEnabled);
        }
        onionPrevColorInput?.addEventListener("input", e => {
            onionPrevTint = e.target.value || "#4080ff";
            renderAll();
        });
        onionNextColorInput?.addEventListener("input", e => {
            onionNextTint = e.target.value || "#40ff78";
            renderAll();
        });
        onionAlphaInput?.addEventListener("input", e => {
            const v = parseInt(e.target.value, 10) || 20;
            onionAlpha = clamp(v / 100, .05, .8);
            safeText(onionAlphaVal, String(v));
            renderAll();
        });
        playSnappedChk?.addEventListener("change", e => playSnapped = e.target.checked);
        keepOnionPlayingChk?.addEventListener("change", e => keepOnionWhilePlaying = e.target.checked);
        keepTransPlayingChk?.addEventListener("change", e => keepTransWhilePlaying = e.target.checked);
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
        clearAllBtn?.addEventListener("click", clearAllProjectState);
        dupCelBtn?.addEventListener("click", onDuplicateCel);
        tlDupBtn?.addEventListener("click", onDuplicateCel);
        tlPrevCelBtn?.addEventListener("click", gotoPrevCel);
        tlNextCelBtn?.addEventListener("click", gotoNextCel);
        fitViewBtn?.addEventListener("click", resetCenter);
        jumpStartBtn?.addEventListener("click", () => gotoFrame(clipStart));
        jumpEndBtn?.addEventListener("click", () => gotoFrame(clipEnd));
        prevFrameBtn?.addEventListener("click", () => gotoFrame(stepBySnap(-1)));
        nextFrameBtn?.addEventListener("click", () => gotoFrame(stepBySnap(1)));
        $("playBtn")?.addEventListener("click", startPlayback);
        $("pauseBtn")?.addEventListener("click", pausePlayback);
        $("stopBtn")?.addEventListener("click", stopAndRewind);
        loopToggle?.addEventListener("change", () => loopPlayback = loopToggle.checked);
        tlPlayBtn?.addEventListener("click", () => $("playBtn")?.click());
        tlPauseBtn?.addEventListener("click", () => $("pauseBtn")?.click());
        tlStopBtn?.addEventListener("click", () => $("stopBtn")?.click());
        exportMP4Btn?.addEventListener("click", async () => {
            const mime = pickMP4Mime();
            if (!mime) {
                alert("MP4 export is not supported in this browser. Try Safari or export WebM.");
                return;
            }
            await exportClip(mime, "mp4");
        });
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
        toggleAutosaveBtn?.addEventListener("click", e => {
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
        autosaveIntervalBtn?.addEventListener("click", async e => {
            e.preventDefault();
            e.stopPropagation();
            const minutes = await askAutosaveIntervalOptions();
            if (!minutes) return;
            autosaveIntervalMinutes = clamp(Number(minutes) || autosaveIntervalMinutes || 1, 1, 120);
            autosaveController?.setIntervalMs?.(autosaveIntervalMinutes * 60000);
            syncAutosaveUiState();
        });
        function initSaveLoadWiring() {
            if (window.__CELSTOMP_SAVELOAD_WIRED__) return;
            window.__CELSTOMP_SAVELOAD_WIRED__ = true;
            const saveProjBtn = document.getElementById("saveProj");
            const loadProjBtn = document.getElementById("loadProj");
            const loadFileInp = document.getElementById("loadFileInp");
            const restoreAutosaveBtn = document.getElementById("restoreAutosave");
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
                loadFileInp.value = "";
                loadFileInp.click();
            });
            restoreAutosaveBtn?.addEventListener("click", () => {
                const restored = autosaveController?.restoreLatest("autosave-button");
                if (!restored) updateRestoreAutosaveButton();
            });
            loadFileInp.addEventListener("change", e => {
                const f = e.currentTarget.files?.[0] || null;
                e.currentTarget.value = "";
                if (f) loadProject(f, {
                    source: "file"
                });
            });
            if (autosaveEnabled) setSaveStateBadge("Saved");
            wireAutosaveDirtyTracking();
            updateRestoreAutosaveButton();
            if (autosaveEnabled) window.setTimeout(maybePromptAutosaveRecovery, 0);
            syncAutosaveUiState();
        }
        if (document.readyState === "loading") {
            window.addEventListener("DOMContentLoaded", initSaveLoadWiring, {
                once: true
            });
        } else {
            initSaveLoadWiring();
        }
        if (document.readyState === "loading") {
            window.addEventListener("DOMContentLoaded", () => {
                wireBrushButtonRightClick();
                wireEraserButtonRightClick();
            }, {
                once: true
            });
        } else {
            wireBrushButtonRightClick();
            wireEraserButtonRightClick();
        }
        function recalcSnap() {
            const val = parseInt(snapValue?.value, 10);
            snapFrames = Number.isFinite(val) ? Math.max(1, val) : 1;
        }
        snapValue?.addEventListener("input", recalcSnap);
        window.addEventListener("keydown", e => {
            const ctrl = e.ctrlKey || e.metaKey;
            {
                const tag = e.target && e.target.tagName ? e.target.tagName.toUpperCase() : "";
                const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.target && e.target.isContentEditable;
                if (!typing && !ctrl && !e.altKey) {
                    const k = (e.key || "").toLowerCase();
                    if (k === "e") {
                        e.preventDefault();
                        gotoFrame(stepBySnap(-1));
                        return;
                    }
                    if (k === "r") {
                        e.preventDefault();
                        gotoFrame(stepBySnap(1));
                        return;
                    }
                    if (k === "q") {
                        e.preventDefault();
                        gotoPrevCel();
                        return;
                    }
                    if (k === "w") {
                        e.preventDefault();
                        gotoNextCel();
                        return;
                    }
                }
            }
            {
                const tag = e.target && e.target.tagName ? e.target.tagName.toUpperCase() : "";
                const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.target && e.target.isContentEditable;
                if (!typing && !ctrl && !e.altKey) {
                    const isDigit = n => e.code === `Digit${n}` || e.code === `Numpad${n}` || e.key === String(n);
                    const pickTool = ({id: id, value: value, altIds: altIds = []}) => {
                        let inp = id && document.getElementById(id) || null;
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
                        inp.dispatchEvent(new Event("change", {
                            bubbles: true
                        }));
                        return true;
                    };
                    if (!e.shiftKey) {
                        if (isDigit(1)) {
                            e.preventDefault();
                            pickTool({
                                id: "tool-brush",
                                value: "brush"
                            });
                        }
                        if (isDigit(2)) {
                            e.preventDefault();
                            pickTool({
                                id: "tool-eraser",
                                value: "eraser"
                            });
                        }
                        if (isDigit(3)) {
                            e.preventDefault();
                            pickTool({
                                id: "tool-fillbrush",
                                value: "fill-brush"
                            });
                        }
                        if (isDigit(4)) {
                            e.preventDefault();
                            pickTool({
                                id: "tool-filleraser",
                                value: "fill-eraser"
                            });
                        }
                        if (isDigit(5)) {
                            e.preventDefault();
                            pickTool({
                                id: "tool-lassoFill",
                                value: "lasso-fill"
                            });
                        }
                        if (isDigit(6)) {
                            e.preventDefault();
                            pickTool({
                                id: "tool-lassoErase",
                                altIds: [ "tool-lassoerase", "tool-lasso-erase" ],
                                value: "lasso-erase"
                            });
                        }
                        if (isDigit(7)) {
                            e.preventDefault();
                            pickTool({
                                id: "tool-rectSelect",
                                value: "rect-select"
                            });
                        }
                        if (isDigit(8)) {
                            e.preventDefault();
                            pickTool({
                                id: "tool-eyedropper",
                                value: "eyedropper"
                            });
                        }
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
                if (rectSelection.active) {
                    e.preventDefault();
                    clearRectSelection();
                    return;
                }
            }
            if ((e.key === "Delete" || e.key === "Backspace") && rectSelection.active) {
                const tag = e.target && e.target.tagName ? e.target.tagName.toUpperCase() : "";
                if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") {
                    const c = getFrameCanvas(rectSelection.L, rectSelection.F, rectSelection.key);
                    const ctx = c.getContext("2d", {
                        willReadFrequently: true
                    });
                    if (ctx) {
                        beginGlobalHistoryStep(rectSelection.L, rectSelection.F, rectSelection.key);
                        ctx.clearRect(rectSelection.x, rectSelection.y, rectSelection.w, rectSelection.h);
                        markGlobalHistoryDirty();
                        recomputeHasContent(rectSelection.L, rectSelection.F, rectSelection.key);
                        commitGlobalHistoryStep();
                        updateTimelineHasContent(rectSelection.F);
                        renderAll();
                    }
                    clearRectSelection();
                    e.preventDefault();
                    return;
                }
            }
            if ((e.key === "Delete" || e.key === "Backspace") && selectedCels.size) {
                const tag = e.target && e.target.tagName ? e.target.tagName.toUpperCase() : "";
                if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") {
                    e.preventDefault();
                    deleteSelectedCels();
                    return;
                }
            }
            if ((e.key === "Delete" || e.key === "Backspace") && !selectedCels.size) {
                const tag = e.target && e.target.tagName ? e.target.tagName.toUpperCase() : "";
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
                if (isPlaying) pausePlayback(); else startPlayback();
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
        function wireFloatingIslandDrag() {
            const dock = document.getElementById("floatingIsland") || document.querySelector(".islandDock");
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
        wireFloatingIslandDrag();
        let _islandLayerAutoFit = null;
        function initIslandTogglePointerFix() {
            function findToggleBtn() {
                const dock = document.getElementById("floatingIsland") || document.querySelector(".islandDock");
                if (!dock) return null;
                let btn = dock.querySelector("#islandToggleBtn") || dock.querySelector(".islandToggleBtn");
                if (!btn) {
                    btn = Array.from(dock.querySelectorAll("button")).find(b => {
                        const t = (b.textContent || "").trim();
                        const a = (b.getAttribute("aria-label") || "").toLowerCase();
                        return t === ">" || t === "‹" || t === "⟩" || a.includes("toggle");
                    }) || null;
                }
                return btn;
            }
            function wire(btn) {
                if (!btn || btn._islandPtrWired) return true;
                btn._islandPtrWired = true;
                const doToggle = () => {
                    if (typeof window.toggleIslandPanel === "function") {
                        window.toggleIslandPanel();
                        return;
                    }
                    document.body.classList.toggle("island-open");
                };
                btn.addEventListener("pointerdown", e => {
                    if (e.pointerType === "touch") {
                        e.preventDefault();
                        e.stopPropagation();
                        doToggle();
                    }
                }, {
                    passive: false
                });
                btn.addEventListener("click", e => {
                    e.preventDefault();
                    e.stopPropagation();
                    doToggle();
                });
                return true;
            }
            const first = findToggleBtn();
            if (first) {
                wire(first);
                return;
            }
            const mo = new MutationObserver(() => {
                const btn = findToggleBtn();
                if (btn) {
                    wire(btn);
                    mo.disconnect();
                }
            });
            mo.observe(document.body, {
                childList: true,
                subtree: true
            });
        }
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
                const slot = document.getElementById("islandLayersSlot");
                const seg = document.getElementById("layerSeg");
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
                const slot = document.getElementById("islandLayersSlot");
                const seg = document.getElementById("layerSeg");
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
                const slot = document.getElementById("islandLayersSlot");
                const seg = document.getElementById("layerSeg");
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
        initIslandLayerAutoFit();
        function buildAndInit() {
            buildTimeline();
            resizeCanvases();
            resetCenter();
            updateHUD();
            initHSVWheelPicker();
            setPickerDefaultBlack();
            setColorSwatch();
            loadPalette();
            renderPalette();
            if (bgColorInput) bgColorInput.value = canvasBgColor;
            renderLayerSwatches();
            wireLayerVisButtons();
            wireKeyboardShortcuts();
            wireQoLFeatures();
            setHSVPreviewBox();
            if (toggleOnionBtn) toggleOnionBtn.textContent = "Onion: Off";
            if (toggleTransparencyBtn) toggleTransparencyBtn.textContent = "Transparency: Off";
        }
        const ro = new ResizeObserver(resizeCanvases);
        ro.observe(stageEl);
        window.addEventListener("resize", () => {
            resizeCanvases();
        });
        if (window.visualViewport) {
            window.visualViewport.addEventListener("resize", () => {
                resizeCanvases();
            }, {
                passive: true
            });
        }
        initMobileNativeZoomGuard();
        mountIslandDock();
        wireTimelineHeaderControls();
        dockDrag();
        wirePanelToggles();
        wireBrushButtonRightClick();
        wireEraserButtonRightClick();
        wirePointerDrawingOnCanvas(document.getElementById("drawCanvas"));
        buildAndInit();
    });
})();
