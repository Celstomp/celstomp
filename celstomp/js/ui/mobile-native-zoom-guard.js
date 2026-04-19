

function _initMobileNativeZoomGuard() {
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
          _wireCanvasPointerDrawingMobileSafe();
      } catch (e) {
          console.warn("[celstomp] pointer wiring failed", e);
      }
  }
}

///////////////////
// PRIVATE FUNCS //
///////////////////

function _wireCanvasPointerDrawingMobileSafe() {
  const stageEl = typeof stage !== "undefined" && stage || document.getElementById("stage");
  const canvasEl = typeof drawCanvas !== "undefined" && drawCanvas || document.getElementById("drawCanvas") || document.querySelector("canvas");
  if (!canvasEl || canvasEl._celstompPointerWired) return;
  canvasEl._celstompPointerWired = true;
  const __USE_UNIFIED_CANVAS_INPUT__ = true;
  if (__USE_UNIFIED_CANVAS_INPUT__) {
      try {
          canvasEl.style.touchAction = "none";
      } catch {
          // intentionally empty
      }
      try {
          if (stageEl) stageEl.style.touchAction = "none";
      } catch {
          // intentionally empty
      }
      try {
          if (typeof fxCanvas !== "undefined" && fxCanvas) fxCanvas.style.pointerEvents = "none";
      } catch {
          // intentionally empty
      }
      try {
          if (typeof boundsCanvas !== "undefined" && boundsCanvas) boundsCanvas.style.pointerEvents = "none";
      } catch {
          // intentionally empty
      }
      try {
          window.__CELSTOMP_PTR_DRAW_WIRED__ = true;
      } catch {
          // intentionally empty
      }
      return;
  }
  try {
      if (typeof fxCanvas !== "undefined" && fxCanvas) fxCanvas.style.pointerEvents = "none";
  } catch {
      // intentionally empty
  }
  try {
      if (typeof boundsCanvas !== "undefined" && boundsCanvas) boundsCanvas.style.pointerEvents = "none";
  } catch {
      // intentionally empty
  }
  try {
      canvasEl.style.touchAction = "none";
  } catch {
      // intentionally empty
  }
  try {
      if (stageEl) stageEl.style.touchAction = "none";
  } catch {
      // intentionally empty
  }
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
      } catch {
          // intentionally empty
      }
      try {
        queueClearFx?.();
      } catch {
          // intentionally empty
      }
      try {
          isDrawing = false;
      } catch {
          // intentionally empty
      }
      try {
          isPanning = false;
      } catch {
          // intentionally empty
      }
      try {
          lastPt = null;
      } catch {
          // intentionally empty
      }
      try {
          stabilizedPt = null;
      } catch {
          // intentionally empty
      }
      try {
          trailPoints = [];
      } catch {
          // intentionally empty
      }
      try {
          _fillEraseAllLayers = false;
      } catch {
          // intentionally empty
      }
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
      } catch {
          // intentionally empty
      }
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
      } catch {
          // intentionally empty
      }
      try {
          canvasEl.releasePointerCapture(e.pointerId);
      } catch {
          // intentionally empty
      }
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


const _touchPointers = new Map;
let _touchGestureActive = false;
function _updateTouchGestureState() {
    const was = _touchGestureActive;
    _touchGestureActive = _touchPointers.size >= 2;
    if (!was && _touchGestureActive) {
        try {
            cancelActiveStroke?.();
        } catch {
            // intentionally empty
        }
        try {
            endStroke?.(true);
        } catch {
            // intentionally empty
        }
        try {
            stopDrawing?.();
        } catch {
            // intentionally empty
        }
        try {
            isDrawing = false;
        } catch {
            // intentionally empty
        }
        try {
            lastX = lastY = null;
        } catch {
            // intentionally empty
        }
    }
}