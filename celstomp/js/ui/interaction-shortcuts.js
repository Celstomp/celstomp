let timelineFrameWidth = 30;
let soloLayer = null;

let straightLineMode = false;
let straightLineStart = null;
let temporaryEyedropper = false;
let previousTool = null;

// keyboard shortcuts, some other stuff tagged "QoL"

function wireQoLFeatures() {
  if (document._celstompQoLWired) return;
  document._celstompQoLWired = true;

  _wireShortcutsModal();
  _maybeShowGuidedTutorial();
  _wireUnsavedChangesGuard();
  _wireTimelineEnhancements();
  _wireLayerQoL();
  _wirePaletteQoL();
  _wireExtraKeyboardShortcuts();
}

function _isShortcutsHotkey(e) {
  const key = String(e?.key || "");
  const code = String(e?.code || "");
  if (key === "?") return true;
  if (code === "Slash" && !!e.shiftKey) return true;
  return false;
}

// IMPL funcs
function _wireShortcutsModal() {
  const modal = $("shortcutsModal");
  const backdrop = $("shortcutsModalBackdrop");
  const closeBtn = $("shortcutsCloseBtn");
  const replayBtn = $("tutorialReplayBtn");
  const replayInfoBtn = $("tutorialReplayInfoBtn");
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
  const closeInfoPanel = () => {
      const infoPanel = $("infoPanel");
      const infoBackdrop = $("infoBackdrop");
      const infoBtn = $("infoBtn");
      if (!infoPanel || !infoBackdrop || !infoBtn) return;
      infoBtn.setAttribute("aria-expanded", "false");
      infoPanel.setAttribute("aria-hidden", "true");
      infoPanel.classList.remove("isOpen");
      infoBackdrop.classList.remove("isOpen");
  };
  const replayTutorial = () => {
      toggleModal(false);
      closeInfoPanel();
      _maybeShowGuidedTutorial({
          force: true
      });
  };
  replayBtn?.addEventListener("click", () => {
      replayTutorial();
  });
  replayInfoBtn?.addEventListener("click", replayTutorial);

  const onShortcutKey = e => {
      if (!_isShortcutsHotkey(e)) return;
      if (e.__celstompShortcutsHandled) return;
      e.__celstompShortcutsHandled = true;
      if (isTyping(document.activeElement)) return;
      e.preventDefault();
      toggleModal(modal.hidden);
  };

  document.addEventListener("keydown", onShortcutKey, {
      capture: true,
      passive: false
  });
}

function _maybeShowGuidedTutorial(options = {}) {
  const force = !!options.force;
  const modal = $("tutorialModal");
  const backdrop = $("tutorialModalBackdrop");
  const highlight = $("tutorialHighlight");
  const titleEl = $("tutorialStepTitle");
  const bodyEl = $("tutorialStepBody");
  const counterEl = $("tutorialStepCounter");
  const hintEl = $("tutorialStepHint");
  const backBtn = $("tutorialBackBtn");
  const skipBtn = $("tutorialSkipBtn");
  const nextBtn = $("tutorialNextBtn");
  if (!modal || !backdrop || !highlight || !titleEl || !bodyEl || !counterEl || !backBtn || !skipBtn || !nextBtn) return;

  const STORAGE_KEY = "celstomp_tutorial_seen_v2";
  let seen = false;
  try {
    seen = localStorage.getItem(STORAGE_KEY) === "1";
  } catch {}
  if (seen && !force) return;

  const steps = [ {
    title: "Welcome to Celstomp (^_^)",
    body: "Quick guided tour. Use Next/Back anytime.",
    selector: "#toolSeg"
  }, {
    title: "Layers (•̀ᴗ•́)و",
    body: "Use layer rows for drawing order. Right-click one for opacity/blend.",
    selector: "#layerSeg"
  }, {
    title: "Onion Skin",
    body: "Toggle Onion in timeline. Right-click Onion for extra controls.",
    selector: "#tlOnion"
  }, {
    title: "Export",
    body: "Open File and export as MP4, GIF, or image sequence.",
    selector: "#menuFileBtn"
  }, {
    title: "You are ready! (^-^)/",
    body: "Press ? anytime to open shortcuts. Have fun animating!"
  } ];

  let idx = 0;
  let isOpen = false;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const markSeen = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {}
  };

  const findVisibleTarget = selector => {
    if (!selector) return null;
    const nodes = Array.from(document.querySelectorAll(selector));
    for (const el of nodes) {
      const r = el.getBoundingClientRect();
      if (r.width > 2 && r.height > 2) return el;
    }
    return null;
  };

  const setHighlight = target => {
    if (!target) {
      highlight.hidden = true;
      return;
    }
    const r = target.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) {
      highlight.hidden = true;
      return;
    }
    const pad = 8;
    const left = clamp(r.left - pad, 4, window.innerWidth - 8);
    const top = clamp(r.top - pad, 4, window.innerHeight - 8);
    const width = clamp(r.width + pad * 2, 24, window.innerWidth - left - 4);
    const height = clamp(r.height + pad * 2, 24, window.innerHeight - top - 4);
    highlight.style.left = `${Math.round(left)}px`;
    highlight.style.top = `${Math.round(top)}px`;
    highlight.style.width = `${Math.round(width)}px`;
    highlight.style.height = `${Math.round(height)}px`;
    highlight.hidden = false;
  };

  const placeCard = target => {
    if (!target) {
      modal.style.left = "50%";
      modal.style.top = "50%";
      modal.style.transform = "translate(-50%, -50%)";
      return;
    }
    modal.style.left = "50%";
    modal.style.top = "50%";
    modal.style.transform = "translate(-50%, -50%)";
    const tr = target.getBoundingClientRect();
    const mr = modal.getBoundingClientRect();
    let x = tr.right + 14;
    let y = tr.top;
    if (x + mr.width > window.innerWidth - 8) x = tr.left - mr.width - 14;
    if (x < 8) x = 8;
    if (y + mr.height > window.innerHeight - 8) y = window.innerHeight - mr.height - 8;
    if (y < 8) y = 8;
    modal.style.left = `${Math.round(x)}px`;
    modal.style.top = `${Math.round(y)}px`;
    modal.style.transform = "none";
  };

  const renderStep = () => {
    const step = steps[idx] || steps[0];
    titleEl.textContent = step.title;
    bodyEl.textContent = step.body;
    counterEl.textContent = `${idx + 1} / ${steps.length}`;
    backBtn.disabled = idx <= 0;
    nextBtn.textContent = idx >= steps.length - 1 ? "Done" : "Next";
    nextBtn.disabled = false;

    const target = findVisibleTarget(step.selector);
    if (hintEl) {
      hintEl.textContent = "";
      hintEl.hidden = true;
    }

    requestAnimationFrame(() => {
      setHighlight(target);
      placeCard(target);
    });
  };

  const close = () => {
    if (!isOpen) return;
    isOpen = false;
    modal.hidden = true;
    backdrop.hidden = true;
    highlight.hidden = true;
    backBtn.removeEventListener("click", onBack);
    nextBtn.removeEventListener("click", onNext);
    skipBtn.removeEventListener("click", onSkip);
    document.removeEventListener("keydown", onEsc);
    window.removeEventListener("resize", onReposition, true);
    window.removeEventListener("scroll", onReposition, true);
    markSeen();
  };

  const onBack = () => {
    if (idx <= 0) return;
    idx -= 1;
    renderStep();
  };

  const onNext = () => {
    if (idx >= steps.length - 1) {
      close();
      return;
    }
    idx += 1;
    renderStep();
  };

  const onSkip = () => close();

  const onEsc = e => {
    if (e.key === "Escape") close();
  };

  const onReposition = () => {
    if (!isOpen) return;
    const step = steps[idx] || steps[0];
    const target = findVisibleTarget(step.selector);
    setHighlight(target);
    placeCard(target);
  };

  backdrop.style.background = "transparent";
  backdrop.style.pointerEvents = "none";
  modal.hidden = false;
  backdrop.hidden = false;
  isOpen = true;
  renderStep();
  backBtn.addEventListener("click", onBack);
  nextBtn.addEventListener("click", onNext);
  skipBtn.addEventListener("click", onSkip);
  document.addEventListener("keydown", onEsc);
  window.addEventListener("resize", onReposition, true);
  window.addEventListener("scroll", onReposition, true);
}
function isTyping(el) {
  if (!el) return false;
  const tag = (el.tagName || "").toLowerCase();
  return tag === "input" || tag === "textarea" || el.isContentEditable;
}
function _wireUnsavedChangesGuard() {
  window.addEventListener("beforeunload", e => {
      if (markProjectDirty && document.querySelector("#saveStateBadge")?.textContent !== "Saved") {
          e.preventDefault();
          e.returnValue = "";
          return "";
      }
  });
}
function _wireTimelineEnhancements() {
  const insertBtn = $("insertFrameBtn");
  const deleteBtn = $("deleteFrameBtn");
  const gotoInput = $("gotoFrameInput");
  const gotoBtn = $("gotoFrameBtn");
  const zoomIn = $("zoomTimelineIn");
  const zoomOut = $("zoomTimelineOut");

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
function _wireLayerQoL() {
  const soloBtn = $("soloLayerBtn");
  const showAllBtn = $("showAllLayersBtn");
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
          queueRenderAll();
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
          queueRenderAll();
      });
  }
}

function _wirePaletteQoL() {
  const newBtn = $("newPaletteBtn");
  const exportBtn = $("exportPaletteBtn");
  const importBtn = $("importPaletteBtn");
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
function _wireExtraKeyboardShortcuts() {
  document.addEventListener("keydown", e => {
      if (e.defaultPrevented) return;
      if (isTyping(document.activeElement)) return;
      const ctrl = e.ctrlKey || e.metaKey;
      const k = (e.key || "").toLowerCase();

      if (ctrl && k === "y") {
          e.preventDefault();
          redo();
          return;
      }

      if (k === "o") {
          e.preventDefault();
          const onionBtn = $("tlOnion");
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
              queuepdateHud();
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
              queueUpdateHUD();
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

function flipSelection(horizontal) {
    if (!rectSelection.active) return;
    const c = getFrameCanvas(rectSelection.L, rectSelection.F, rectSelection.key);
    if (!c) return;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const selSnap = ctx.getImageData(rectSelection.x, rectSelection.y, rectSelection.w, rectSelection.h);
    const fullSnap = ctx.getImageData(0, 0, contentW, contentH);

    beginGlobalHistoryStep(rectSelection.L, rectSelection.F, rectSelection.key);

    ctx.clearRect(rectSelection.x, rectSelection.y, rectSelection.w, rectSelection.h);

    const flipped = ctx.createImageData(rectSelection.w, rectSelection.h);
    const src = selSnap.data;
    const dst = flipped.data;

    for (let y = 0; y < rectSelection.h; y++) {
        for (let x = 0; x < rectSelection.w; x++) {
            const srcIdx = (y * rectSelection.w + x) * 4;
            const dstY = horizontal ? y : (rectSelection.h - 1 - y);
            const dstX = horizontal ? (rectSelection.w - 1 - x) : x;
            const dstIdx = (dstY * rectSelection.w + dstX) * 4;
            dst[dstIdx] = src[srcIdx];
            dst[dstIdx + 1] = src[srcIdx + 1];
            dst[dstIdx + 2] = src[srcIdx + 2];
            dst[dstIdx + 3] = src[srcIdx + 3];
        }
    }

    ctx.putImageData(flipped, rectSelection.x, rectSelection.y);

    markGlobalHistoryDirty();
    commitGlobalHistoryStep();
    recomputeHasContent(rectSelection.L, rectSelection.F, rectSelection.key);
    queueRenderAll();
    updateTimelineHasContent(rectSelection.F);
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
          queueUpdateHUD?.();
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

// event handler for key pressed in window
function onWindowKeyDown(e) {
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
                let inp = id && $(id) || null;
                if (!inp) {
                    for (const a of altIds) {
                        inp = $(a);
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
    if (rectSelection.active && (e.key.toLowerCase() === "h" || e.key.toLowerCase() === "v")) {
        const tag = e.target && e.target.tagName ? e.target.tagName.toUpperCase() : "";
        if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") {
            e.preventDefault();
            flipSelection(e.key.toLowerCase() === "h");
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
                queueRenderAll();
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
    queueRenderAll();
    updateTimelineHasContent(currentFrame);
    pruneUnusedSublayers(L);
    return true;
}
