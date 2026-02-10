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

const CANVAS_TYPE = {
    boundsCanvas: 0,
    drawCanvas: 1,
    fxCanvas: 2
}

function getCanvas(t) {
    switch(t) {
        case CANVAS_TYPE.boundsCanvas:
        return $("boundsCanvas");
        case CANVAS_TYPE.drawCanvas:
        return $("drawCanvas");
        case CANVAS_TYPE.fxCanvas:
        return $("fxCanvas");
        default:
        return null;
    }
}

// tool - wasnt sure where to put it lolol
let tool = "brush";

// renderhud/renderall hooks
// allows other components to call on app code to refresh display

const listeners_all = [];
const listeners_hud = [];
const listeners_fx = [];

function queueRenderAll() {
    listeners_all.forEach((l) => l());
}

function queueUpdateHud() {
    listeners_hud.forEach((l) => l());
}

function queueClearFx() {
    listeners_fx.forEach((l) => l());
}

function onRenderAll(l) {
    listeners_all.push(l);
}

function onUpdateHud(l) {
    listeners_hud.push(l);
}

function onClearFx(l) {
    listeners_fx.push(l);
}