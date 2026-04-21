/** Shorthand: returns the element with the given id. @param {string} id @returns {HTMLElement|null} */
const $ = id => document.getElementById(id);
/** Clamps a value between a minimum and maximum. @param {number} v @param {number} a @param {number} b @returns {number} */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/** Returns a promise that resolves after the given number of milliseconds. @param {number} ms @returns {Promise<void>} */
const sleep = (ms = 0) => new Promise(r => setTimeout(r, ms));
/** Safely sets the textContent of an element if it exists. @param {HTMLElement|null} el @param {string} txt */
function safeText(el, txt) {
    if (el) el.textContent = txt;
}
/** Safely sets the value of a form element if it exists. @param {HTMLElement|null} el @param {string|number} v */
function safeSetValue(el, v) {
    if (!el) return;
    el.value = String(v);
}
/** Safely sets the checked property of a checkbox element if it exists. @param {HTMLElement|null} el @param {boolean} v */
function safeSetChecked(el, v) {
    if (!el) return;
    el.checked = !!v;
}
/**
 * Reads a CSS custom property from the root element and parses it as a pixel number.
 * @param {string} name - CSS variable name (e.g. "--timeline-h").
 * @param {number} fallback - Default value if the property cannot be read.
 * @returns {number} Parsed pixel value or fallback.
 */
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

/**
 * Returns one of the three main canvas elements by type.
 * @param {number} t - Canvas type from CANVAS_TYPE enum (0=bounds, 1=draw, 2=fx).
 * @returns {HTMLCanvasElement|null}
 */
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

/** Invokes all registered render-all listeners. */
function queueRenderAll() {
    listeners_all.forEach((l) => l());
}

/** Invokes all registered HUD-update listeners. */
function queueUpdateHud() {
    listeners_hud.forEach((l) => l());
}

/** Invokes all registered clear-fx listeners. */
function queueClearFx() {
    listeners_fx.forEach((l) => l());
}

/** Registers a listener for the next render-all cycle. @param {function} l */
function onRenderAll(l) {
    listeners_all.push(l);
}

/** Registers a listener for the next HUD-update cycle. @param {function} l */
function onUpdateHud(l) {
    listeners_hud.push(l);
}

/** Registers a listener for the next clear-fx cycle. @param {function} l */
function onClearFx(l) {
    listeners_fx.push(l);
}