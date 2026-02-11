function wirePointerDrawingOnCanvas(drawCanvas) {
  if (!drawCanvas) return;
  if (window.__CELSTOMP_PTR_DRAW_WIRED__) return;
  window.__CELSTOMP_PTR_DRAW_WIRED__ = true;
  const stageViewport = $("stageViewport") || $("stage") || drawCanvas;
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
      // weird as fuck
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
          startZoom: getZoom(),
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
      setZoom(nextZoom);
      const devX = midLocal.x * dpr;
      const devY = midLocal.y * dpr;

      setOffsetX(devX - pinch.anchorContent.x * (getZoom() * dpr));
      setOffsetY(devY - pinch.anchorContent.y * (getZoom() * dpr));

      queueRenderAll();
      queueUpdateHud();
      updatePlayheadMarker();
      updateClipMarkers();
      queueClearFx();
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