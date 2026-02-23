



(() => {
    "use strict";

    
    

    // shorthand funcs (more of)

    // -- above this point: looks like helper functions

    function ready(fn) {
        if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn, {
            once: true
        }); else fn();
    }
    
    ready(() => {
        const stageEl = $("stage");

        function ensureChild(parent, el) {
            if (!parent || !el) return false;
            if (el.parentElement !== parent) {
                parent.appendChild(el);
            }

            return true;
        }

        // back
        const boundsCanvas = getCanvas(CANVAS_TYPE.boundsCanvas);
        
        // mid
        const drawCanvas = getCanvas(CANVAS_TYPE.drawCanvas);

        // front
        const fxCanvas = getCanvas(CANVAS_TYPE.fxCanvas);

        // mostly sanity checks
        if (!stageEl || !boundsCanvas || !getCanvas(CANVAS_TYPE.drawCanvas) || !fxCanvas) {
            console.warn("[celstomp] Missing required DOM: #stage/#boundsCanvas/#drawCanvas/#fxCanvas");
            return;
        }

        ensureChild(stageEl, boundsCanvas);
        ensureChild(stageEl, getCanvas(CANVAS_TYPE.drawCanvas));
        ensureChild(stageEl, fxCanvas);

        const bctx = boundsCanvas.getContext("2d");
        const dctx = getCanvas(CANVAS_TYPE.drawCanvas).getContext("2d", {
            desynchronized: true
        }) || getCanvas(CANVAS_TYPE.drawCanvas).getContext("2d");
        const fxctx = fxCanvas.getContext("2d");
        if (!(boundsCanvas instanceof HTMLCanvasElement) || !(getCanvas(CANVAS_TYPE.drawCanvas) instanceof HTMLCanvasElement) || !(fxCanvas instanceof HTMLCanvasElement) || !bctx || !dctx || !fxctx) {
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

        const loopToggle = $("loopToggle");
        const snapValue = $("snapValue");
        const bgColorInput = $("bgColor");
        const aaToggle = $("aaToggle");
        const toggleOnionBtn = $("toggleOnion");
        const toggleTransparencyBtn = $("toggleTransparency");

        const onionPrevColorInput = $("onionPrevColor");
        const onionNextColorInput = $("onionNextColor");
        const onionAlphaInput = $("onionAlpha");
        const onionBlendModeInput = $("onionBlendMode");
        const onionAlphaVal = $("onionAlphaVal");
        const playSnappedChk = $("playSnapped");

        const keepOnionPlayingChk = $("keepOnionPlaying");
        const keepTransPlayingChk = $("keepTransPlaying");

        const gapPxInput = $("gapPx");
        const autofillToggle = $("autofillToggle");
        const fillCurrentBtn = $("fillCurrent");
        const fillAllBtn = $("fillAll");
        const clearCelBtn = $("clearCelBtn");
        const clearColorBtn = $("clearColorBtn");
        const clearLayerBtn = $("clearLayerBtn");
        const chooseFillEraserBtn = $("chooseFillEraser");
        const chooseFillBrushBtn = $("chooseFillBrush");
        const chooseLassoFillBtn = $("chooseLassoFill");
        const addPaletteColorBtn = $("addPaletteColor");
        const newProjBtn = $("newProj");

        const homeModalBackdrop = $("homeModalBackdrop");
        const homeModal = $("homeModal");
        const homeDraftBanner = $("homeDraftBanner");
        const homeNewProjectBtn = $("homeNewProjectBtn");
        const homeOpenProjectBtn = $("homeOpenProjectBtn");
        const homeRestoreDraftBtn = $("homeRestoreDraftBtn");
        const homeRecentList = $("homeRecentList");
        const createAspectSelect = $("createAspectSelect");

        const defLInput = $("defL");
        const defCInput = $("defC");
        const defHInput = $("defH");
        const saveOklchDefaultBtn = $("saveOklchDefault");
        const oklchDefaultStatus = $("oklchDefaultStatus");

        const toolSeg = $("toolSeg");
        const brushShapeSeg = $("brushShapeSeg");
        const toolSettingsSection = $("toolSettingsSection");
        const toolSettingsTitle = $("toolSettingsTitle");
        const toolFoldBrushesBtn = $("toolFoldBrushesBtn");
        const toolFoldBrushesBody = $("toolFoldBrushesBody");
        const toolFoldSettingsBtn = $("toolFoldSettingsBtn");
        const toolFoldSettingsBody = $("toolFoldSettingsBody");
        const brushShapeTooltip = $("brushShapeTooltip");
        const eraserOptionsPopup = $("eraserOptionsPopup");


        // v different syntax for doing the same thing
        toolSeg.addEventListener("contextmenu", e => {
            const lab = e.target.closest("label[data-tool]");
            if (!lab) return;
            const tool = lab.dataset.tool;
            if (tool !== "eraser" && tool !== "fill-eraser") return;
            e.preventDefault();
            const inputId = lab.getAttribute("for");
            const input = inputId ? $(inputId) : null;
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
        const eraserVal = $("eraserVal");
    

        const stabilizationSelect = $("stabilizationLevel");
        const pressureSizeToggle = $("pressureSize") || $("usePressureSize");
        const pressureOpacityToggle = $("pressureOpacity") || $("usePressureOpacity");
        const pressureTiltToggle = $("pressureTilt") || $("usePressureTilt");
        let dpr = window.devicePixelRatio || 1;

        let pickerInitializing = false;
        
        try {
            const savedShape = localStorage.getItem("celstomp_picker_shape");
            if (savedShape === "triangle") pickerShape = "triangle";
        } catch {}

        // listeners for event hooks
        onRenderAll(renderAll);
        onUpdateHud(updateHUD);
        onClearFx(clearFx);

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

        // updates text on page
        function updateHUD() {
            const hudFps = $("hudFps");
            const zoomInfo = $("zoomInfo");
            const frameInfo = $("frameInfo");
            const hudTime = $("hudTime");
            const timeCounter = $("timeCounter");
            const toolName = $("toolName");
            const fpsLabel = $("fpsLabel");
            const secLabel = $("secLabel");

            safeText(hudFps, String(fps));
            safeText(frameInfo, `${currentFrame + 1} / ${totalFrames}`);
            safeText(hudTime, sfString(currentFrame));
            safeText(timeCounter, sfString(currentFrame));
            safeText(zoomInfo, `${Math.round(getZoom() * 100)}%`);
            safeText(toolName, tool.replace("-", " ").replace(/\b\w/g, m => m.toUpperCase()));
            safeText(fpsLabel, String(fps));
            safeText(secLabel, String(seconds));

            highlightTimelineCell();
            refreshToolSettingsUI();
        }
        
        
        function renderBounds() {
            setTransform(bctx);
            setTransform(fxctx);
            bctx.fillStyle = "#2a2f38";
            bctx.strokeStyle = "#3b4759";
            bctx.lineWidth = 2 / Math.max(getZoom(), 1);
            bctx.fillRect(0, 0, contentW, contentH);
            bctx.strokeRect(0, 0, contentW, contentH);
            drawRectSelectionOverlay(fxctx);
            drawLineToolPreview(fxctx);
        }

        function onionCompositeOperation() {
            if (onionBlendMode === "multiply") return "multiply";
            if (onionBlendMode === "overlay") return "overlay";
            return "source-over";
        }
        
        // tba: rect, lasso, and onion should have their own locations in code
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
                ctx.save();
                ctx.globalCompositeOperation = onionCompositeOperation();
                ctx.drawImage(off, 0, 0);
                ctx.restore();
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
            setTransform(fxctx);
            drawRectSelectionOverlay(fxctx);
            drawLineToolPreview(fxctx);
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
                getCanvas(CANVAS_TYPE.drawCanvas)?.addEventListener("pointerdown", () => closeBrushCtxMenu(), {
                    passive: true
                });
            } catch {}
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
                const rect = getCanvas(CANVAS_TYPE.drawCanvas).getBoundingClientRect();
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
                    startZoom: getZoom(),
                    startOffsetX: getOffsetX(),
                    startOffsetY: getOffsetY(),
                    startDist: startDist,
                    anchorContent: before
                };
                
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
                const zl = clampNum(pinch.startZoom * factor, VIEW_MIN, VIEW_MAX);
                setZoom(zl)
                const after = screenToContent(midLocal.x, midLocal.y);
                setOffsetX(pinch.startOffsetX + (after.x - pinch.anchorContent.x) * (getZoom() * dpr));
                setOffsetY(pinch.startOffsetY + (after.y - pinch.anchorContent.y) * (getZoom() * dpr));
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
        
        let pinch = null;
        drawCanvas.addEventListener("wheel", e => {
            e.preventDefault();
            const factor = Math.exp(-e.deltaY * .0015);
            const pos = getCanvasPointer(e);
            const before = screenToContent(pos.x, pos.y);
            setZoom(clamp(getZoom() * factor, .05, 16));
            const after = screenToContent(pos.x, pos.y);
            setOffsetX(getOffsetX() + (after.x - before.x) * (getZoom() * dpr));
            setOffsetY(getOffsetY() + (after.y - before.y) * (getZoom() * dpr));
            queueRenderAll();
            queueUpdateHud();
            updatePlayheadMarker();
            updateClipMarkers();
            queueClearFx();
        }, {
            passive: false
        });
        initStagePinchCameraZoom($("stageViewport") || $("stage") || stageEl || drawCanvas);
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
        
        
        
        mountIslandSlots();
        
        
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
                const island = $("floatingIsland");
                const dock = island?.closest(".islandDock") || island;
                const sideBtn = dock?.querySelector("#islandSideBtn") || $("islandSideBtn");
                const sidePanel = dock?.querySelector("#islandSidePanel") || $("islandSidePanel");
                const collapseBtn = $("islandCollapseBtn");
                const tabBtn = $("islandTab");
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
            // info(?) wiring controls
            const btn = $("infoBtn");
            const panel = $("infoPanel");
            const back = $("infoBackdrop");
            const close = $("infoCloseBtn");
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

        (() => {
            // timeline wiring controls
            function boot() {
                const tl = $("timeline");
                const header = $("timelineHeader");
                const leftBtn = $("tlMobLeftBtn");
                const rightBtn = $("tlMobRightBtn");
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
            const btn = $("mobileIslandToggle");
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
        
        
        try {
            initMobileTimelineScrub();
        } catch {}
        
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
                if (now !== onionEnabled) $("toggleOnion")?.click();
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

        wireIslandResize();
        wireTopMenus();

        const layerSeg = $("layerSeg");
        layerSeg?.addEventListener("change", () => {
            wireLayerVisButtons();
            if (activeLayer !== PAPER_LAYER) rememberCurrentColorForLayer(activeLayer);
            const val = document.querySelector('input[name="btype"]:checked')?.value || "line";
            if (val === "paper") {
                activeLayer = PAPER_LAYER;
                syncActiveLayerColorUI({
                    layer: PAPER_LAYER,
                    redrawSwatches: true,
                    updateHud: true
                });
                return;
            }
            const nextLayer = layerFromValue(val);
            syncActiveLayerColorUI({
                layer: nextLayer,
                remember: false,
                redrawSwatches: true,
                updateHud: true
            });
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
            renderAll();
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
            queueRenderAll();
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

        // Font and project defaults
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
        const RECENT_PROJECTS_KEY = "celstomp.recent.projects.v1";
        const RECENT_PROJECTS_LIMIT = 12;
        const fontSelect = $("fontSelect");
        let projectBooted = false;

        function applyFont(fontName) {
            const fontStack = FONT_OPTIONS[fontName] || FONT_OPTIONS["Cascadia"];
            document.documentElement.style.setProperty("--font", fontStack);
            try {
                localStorage.setItem(FONT_STORAGE_KEY, fontName);
            } catch {}
            if (fontSelect) safeSetValue(fontSelect, fontName);
        }

        function normalizedAspectRatio(ratio) {
            return ASPECT_RATIOS[ratio] ? ratio : "16:9";
        }

        function applyAspectRatio(ratio, skipResize = false) {
            const nextRatio = normalizedAspectRatio(ratio);
            const preset = ASPECT_RATIOS[nextRatio];
            if (preset) {
                contentW = preset.w;
                contentH = preset.h;
            }
            try {
                syncAllLayerCanvasSizesToContent?.();
            } catch {}
            try {
                localStorage.setItem(ASPECT_STORAGE_KEY, nextRatio);
            } catch {}
            if (createAspectSelect) safeSetValue(createAspectSelect, nextRatio);
            if (!skipResize) {
                resizeCanvases();
                try {
                    queueRenderAll?.();
                } catch {}
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

            // Load preferred aspect for new projects
            let savedAspect = "16:9";
            try {
                savedAspect = localStorage.getItem(ASPECT_STORAGE_KEY) || "16:9";
            } catch {}
            safeSetValue(createAspectSelect, normalizedAspectRatio(savedAspect));
        })();

        // Event listeners
        fontSelect?.addEventListener("change", e => {
            applyFont(e.target.value);
        });

        createAspectSelect?.addEventListener("change", e => {
            applyAspectRatio(e.target.value, true);
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
        $("toggleOnion")?.addEventListener("click", () => {
            onionEnabled = !onionEnabled;
            $("toggleOnion").textContent = `Onion: ${onionEnabled ? "On" : "Off"}`;
            renderAll();
        });
        function setTransparencyEnabled(on) {
            transparencyHoldEnabled = !!on;
            const btn = $("toggleTransparency");
            if (btn) btn.textContent = `Transparency: ${transparencyHoldEnabled ? "On" : "Off"}`;
            const chk = $("tlTransparency");
            if (chk) chk.checked = transparencyHoldEnabled;
            try {
                renderAll();
            } catch {}
        }
        function initTransparencyControls() {
            const btn = $("toggleTransparency");
            const chk = $("tlTransparency");
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
        onionBlendModeInput?.addEventListener("change", e => {
            onionBlendMode = String(e.target.value || "normal").toLowerCase();
            if (onionBlendMode !== "multiply" && onionBlendMode !== "overlay") {
                onionBlendMode = "normal";
            }
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

        function collectLayerKeysAtFrame(L, F) {
            const out = [];
            const lay = layers?.[L];
            if (!lay?.sublayers || !Array.isArray(lay.suborder)) return out;
            for (const key of lay.suborder) {
                const off = lay.sublayers.get(key)?.frames?.[F];
                if (off && off._hasContent) out.push(key);
            }
            return out;
        }

        function clearFrameSubLayer(L, key, F) {
            const lay = layers?.[L];
            const sub = lay?.sublayers?.get?.(key);
            if (!sub?.frames?.[F]) return false;
            try {
                beginGlobalHistoryStep?.(L, F, key);
            } catch {}
            sub.frames[F] = null;
            try {
                markGlobalHistoryDirty?.();
                commitGlobalHistoryStep?.();
            } catch {}
            return true;
        }

        function applyPostClearUi() {
            for (let L = 0; L < LAYERS_COUNT; L++) {
                try {
                    pruneUnusedSublayers(L);
                } catch {}
            }
            try {
                updateTimelineHasContent(currentFrame);
            } catch {}
            try {
                renderLayerSwatches();
            } catch {}
            try {
                queueRenderAll();
            } catch {}
            try {
                queueUpdateHud();
            } catch {}
            try {
                markProjectDirty?.();
            } catch {}
        }

        function clearCurrentCelAction() {
            let changed = false;
            for (const L of MAIN_LAYERS) {
                const keys = collectLayerKeysAtFrame(L, currentFrame);
                for (const key of keys) {
                    changed = clearFrameSubLayer(L, key, currentFrame) || changed;
                }
            }
            if (!changed) return;
            applyPostClearUi();
        }

        function clearSelectedColorAction() {
            if (activeLayer === PAPER_LAYER) return;
            const key = swatchColorKey(activeSubColor?.[activeLayer] || currentColor || "#000000");
            if (!key) return;
            const changed = clearFrameSubLayer(activeLayer, key, currentFrame);
            if (!changed) return;
            applyPostClearUi();
        }

        function clearSelectedLayerAction() {
            if (activeLayer === PAPER_LAYER) return;
            let changed = false;
            const keys = collectLayerKeysAtFrame(activeLayer, currentFrame);
            for (const key of keys) {
                changed = clearFrameSubLayer(activeLayer, key, currentFrame) || changed;
            }
            if (!changed) return;
            applyPostClearUi();
        }

        function blankProjectState() {
            layers = new Array(LAYERS_COUNT).fill(0).map(() => ({
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
            activeLayer = LAYER.LINE;
            activeSubColor = new Array(LAYERS_COUNT).fill("#000000");
            activeSubColor[LAYER.FILL] = fillWhite;
            layerColorMem = new Array(LAYERS_COUNT).fill("#000000");
            layerColorMem[LAYER.FILL] = fillWhite;
            currentColor = "#000000";
            currentFrame = 0;
            clipStart = 0;
            clipEnd = Math.min(totalFrames - 1, fps * 2 - 1);
            try {
                globalHistory.undo.length = 0;
                globalHistory.redo.length = 0;
                historyMap.clear();
                _pendingGlobalStep = null;
                _globalStepDirty = false;
            } catch {}
            try {
                clearCelSelection?.();
                clearRectSelection?.();
                clearGhostTargets?.();
                cancelLasso?.();
            } catch {}
        }

        function readRecentProjects() {
            try {
                const raw = JSON.parse(localStorage.getItem(RECENT_PROJECTS_KEY) || "[]");
                if (!Array.isArray(raw)) return [];
                return raw.filter(v => v && typeof v === "object" && typeof v.name === "string").slice(0, RECENT_PROJECTS_LIMIT);
            } catch {
                return [];
            }
        }

        function writeRecentProjects(items) {
            try {
                localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(items.slice(0, RECENT_PROJECTS_LIMIT)));
            } catch {}
        }

        function recordRecentProject(meta = {}) {
            const name = String(meta.fileName || "Untitled Project").trim() || "Untitled Project";
            const now = Date.now();
            const nextItem = {
                id: `${name}:${now}`,
                name: name,
                openedAt: now,
                source: String(meta.source || "file"),
                missing: true
            };
            const existing = readRecentProjects().filter(it => it.name !== name);
            const next = [ nextItem, ...existing ].slice(0, RECENT_PROJECTS_LIMIT);
            writeRecentProjects(next);
            renderRecentProjects();
        }

        function removeRecentProject(id) {
            const next = readRecentProjects().filter(it => it.id !== id);
            writeRecentProjects(next);
            renderRecentProjects();
        }

        function renderRecentProjects() {
            if (!homeRecentList) return;
            const items = readRecentProjects();
            homeRecentList.innerHTML = "";
            if (!items.length) {
                const empty = document.createElement("div");
                empty.className = "homeRecentSub";
                empty.textContent = "No recent projects yet.";
                homeRecentList.appendChild(empty);
                return;
            }
            for (const item of items) {
                const row = document.createElement("div");
                row.className = "homeRecentItem";
                const meta = document.createElement("div");
                meta.className = "homeRecentMeta";
                const name = document.createElement("div");
                name.className = "homeRecentName";
                name.textContent = item.name;
                const sub = document.createElement("div");
                sub.className = "homeRecentSub homeRecentMissing";
                sub.textContent = "File link unavailable in-browser. Open manually if moved.";
                meta.appendChild(name);
                meta.appendChild(sub);
                const rm = document.createElement("button");
                rm.type = "button";
                rm.className = "homeRecentRemove";
                rm.textContent = "x";
                rm.setAttribute("aria-label", `Remove ${item.name} from recent projects`);
                rm.addEventListener("click", () => removeRecentProject(item.id));
                row.appendChild(meta);
                row.appendChild(rm);
                homeRecentList.appendChild(row);
            }
        }

        function refreshHomeDraftState() {
            const hasDraft = !!autosaveController?.getPayload?.();
            if (homeDraftBanner) homeDraftBanner.hidden = !hasDraft;
            if (homeRestoreDraftBtn) homeRestoreDraftBtn.disabled = !hasDraft;
        }

        function openHomeModal() {
            if (homeModalBackdrop) homeModalBackdrop.hidden = false;
            if (homeModal) homeModal.hidden = false;
            renderRecentProjects();
            refreshHomeDraftState();
            const preferredAspect = (() => {
                try {
                    return localStorage.getItem(ASPECT_STORAGE_KEY) || "16:9";
                } catch {
                    return "16:9";
                }
            })();
            safeSetValue(createAspectSelect, normalizedAspectRatio(preferredAspect));
        }

        function closeHomeModal() {
            if (homeModalBackdrop) homeModalBackdrop.hidden = true;
            if (homeModal) homeModal.hidden = true;
        }

        function ensureProjectBooted() {
            if (projectBooted) return;
            buildAndInit();
            projectBooted = true;
        }

        function startNewProject() {
            ensureProjectBooted();
            const ratio = createAspectSelect?.value || "16:9";
            applyAspectRatio(ratio, true);
            blankProjectState();
            buildTimeline();
            resizeCanvases();
            resetCenter();
            syncActiveLayerColorUI({
                layer: LAYER.LINE,
                color: "#000000",
                remember: false,
                redrawSwatches: true,
                updateHud: true
            });
            setColorSwatch();
            setHSVPreviewBox();
            queueRenderAll();
            queueUpdateHud();
            markProjectClean("New Project");
            closeHomeModal();
        }

        function openProjectFromFile(file, source = "file") {
            if (!file) return;
            ensureProjectBooted();
            loadProject(file, {
                source: source,
                onLoaded: meta => {
                    recordRecentProject(meta);
                    closeHomeModal();
                    refreshHomeDraftState();
                },
                onError: () => {
                    refreshHomeDraftState();
                }
            });
        }

        function restoreDraftFromHome(source = "autosave-home") {
            ensureProjectBooted();
            const restored = autosaveController?.restoreLatest(source);
            if (restored) closeHomeModal();
            refreshHomeDraftState();
            if (!restored) updateRestoreAutosaveButton();
        }

        clearCelBtn?.addEventListener("click", clearCurrentCelAction);
        clearColorBtn?.addEventListener("click", clearSelectedColorAction);
        clearLayerBtn?.addEventListener("click", clearSelectedLayerAction);
        newProjBtn?.addEventListener("click", openHomeModal);
        homeNewProjectBtn?.addEventListener("click", startNewProject);
        homeOpenProjectBtn?.addEventListener("click", () => {
            $("loadFileInp").value = "";
            $("loadFileInp").click();
        });
        homeRestoreDraftBtn?.addEventListener("click", () => restoreDraftFromHome("autosave-home"));

        $("clearAllBtn")?.addEventListener("click", clearAllProjectState);
        $("dupCelBtn")?.addEventListener("click", onDuplicateCel);
        $("tlDupCel")?.addEventListener("click", onDuplicateCel);
        $("tlPrevCel")?.addEventListener("click", gotoPrevCel);
        $("tlNextCel")?.addEventListener("click", gotoNextCel);
        $("fitView")?.addEventListener("click", resetCenter);
        $("jumpStart")?.addEventListener("click", () => gotoFrame(clipStart));
        $("jumpEnd")?.addEventListener("click", () => gotoFrame(clipEnd));
        $("prevFrame")?.addEventListener("click", () => gotoFrame(stepBySnap(-1)));
        $("nextFrame")?.addEventListener("click", () => gotoFrame(stepBySnap(1)));

        $("playBtn")?.addEventListener("click", startPlayback);
        $("pauseBtn")?.addEventListener("click", pausePlayback);
        $("stopBtn")?.addEventListener("click", stopAndRewind);
        $("loopToggle")?.addEventListener("change", () => loopPlayback = loopToggle.checked);
        $("tlPlay")?.addEventListener("click", () => $("playBtn")?.click());
        $("tlPause")?.addEventListener("click", () => $("pauseBtn")?.click());
        $("tlStop")?.addEventListener("click", () => $("stopBtn")?.click());

        handleExportFunctionWiring();

        function initSaveLoadWiring() {
            if (window.__CELSTOMP_SAVELOAD_WIRED__) return;
            window.__CELSTOMP_SAVELOAD_WIRED__ = true;
            const saveProjBtn = $("saveProj");
            const loadProjBtn = $("loadProj");
            const loadFileInp = $("loadFileInp");
            const restoreAutosaveBtn = $("restoreAutosave");
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
                restoreDraftFromHome("autosave-button");
            });
            loadFileInp.addEventListener("change", e => {
                const f = e.currentTarget.files?.[0] || null;
                e.currentTarget.value = "";
                if (f) openProjectFromFile(f, "file");
            });
            if (autosaveEnabled) setSaveStateBadge("Saved");
            wireAutosaveDirtyTracking();
            updateRestoreAutosaveButton();
            syncAutosaveUiState();
            refreshHomeDraftState();
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
        window.addEventListener("keydown", onWindowKeyDown);
        
        wireFloatingIslandDrag();
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
        if (stageEl.parentElement) ro.observe(stageEl.parentElement);
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
        wirePointerDrawingOnCanvas($("drawCanvas"));

        openHomeModal();
    });
})();
