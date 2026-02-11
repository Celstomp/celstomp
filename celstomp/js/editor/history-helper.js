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
    currentFrame = F;
    activeLayer = L;
    try {
        queueRenderAll();
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

        // TODO: sample proper w/h in snapshotFor and applySnapshot
        return ctx.getImageData(0, 0, 960, 540);
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
    ctx.clearRect(0, 0, 960, 540);
    if (shot) {
        ctx.putImageData(shot, 0, 0);
        c._hasContent = true;
    } else {
        c._hasContent = false;
    }
    queueRenderAll();
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