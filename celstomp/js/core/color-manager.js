let currentColor = "#000000";

const fillWhite = "#ffffff";
const fillBrushTrailColor = "#ff1744";

let canvasBgColor = "#bfbfbf";


/**
 * Converts any CSS color string to a normalized #RRGGBB hex string.
 * @param {string} c - CSS color value.
 * @returns {string} Uppercase hex color string (e.g. "#FF0000").
 */
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


// this is stupid - normalized canvas logic (???)
const _normC = document.createElement("canvas");
_normC.width = _normC.height = 1;
const _normCtx = _normC.getContext("2d", {
    willReadFrequently: true
});

/**
 * Normalizes any CSS color string to a lowercase #rrggbb hex string via a 1×1 canvas.
 * @param {string} colorStr - CSS color value.
 * @returns {string} Hex color string (e.g. "#ff0000"), or "#000000" on failure.
 */
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

/**
 * Normalizes a color string to a canonical uppercase hex key suitable for use as a swatch map key.
 * Handles #hex, rgb()/rgba(), and other CSS color formats.
 * @param {string} c - Color string to normalize.
 * @returns {string} Uppercase hex key (e.g. "#FF0000").
 */
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

/**
 * Rekeys a layer's sublayer map so every entry uses a canonical hex key, and repairs suborder/children references.
 * @param {object} layer - Layer object with .sublayers (Map) and .suborder (string[]).
 */
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

/// COLOR PICKER FUNCTIONALITY 


let _cursorColorPicker = null;
/** Creates or returns the hidden `<input type="color">` element used for cursor-position color picking. */
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

/**
 * Opens the native color picker positioned near the cursor.
 * @param {PointerEvent} e - Event providing screen coordinates.
 * @param {string} initialHex - Starting color value.
 * @param {function(string): void} onPick - Callback receiving the picked hex color.
 */
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

/**
 * Opens the native color picker centered on a given element.
 * @param {HTMLElement} anchorEl - Element to position the picker near.
 * @param {string} initialHex - Starting color value.
 * @param {function(string): void} onPick - Callback receiving the picked hex color.
 */
function openColorPickerAtElement(anchorEl, initialHex, onPick) {
  const r = anchorEl?.getBoundingClientRect?.();
  const fakeEvent = {
      clientX: r ? r.left + r.width / 2 : window.innerWidth / 2,
      clientY: r ? r.top + r.height / 2 : window.innerHeight / 2
  };
  openColorPickerAtCursor(fakeEvent, initialHex, onPick);
}

/**
 * Normalizes a hex color string to 6-digit uppercase form (e.g. "#FF0" → "#FFFF00").
 * @param {string} hex - Hex color string.
 * @returns {string|null} Uppercase 6-digit hex, or null if not a valid hex color.
 */
function normHex6(hex) {
  hex = String(hex || "").trim();
  if (!isHexColor(hex)) return null;
  if (hex.length === 4) {
      const r = hex[1], g = hex[2], b = hex[3];
      hex = `#${r}${r}${g}${g}${b}${b}`;
  }
  return hex.toUpperCase();
}
/**
 * Converts a hex color string to an {r, g, b} object.
 * @param {string} hex - Hex color string.
 * @returns {{r: number, g: number, b: number}|null} RGB values (0–255), or null if invalid.
 */
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

const _colorCtx = (() => {
  const c = document.createElement("canvas");
  c.width = c.height = 1;
  return c.getContext("2d", {
      willReadFrequently: true
  });
})();


/**
 * Converts a hex color string to an {r, g, b} object.
 * @param {string} hex - Any CSS color string; normalized internally.
 * @returns {{r: number, g: number, b: number}} RGB values (0–255).
 */
function hexToRgb(hex) {
  const h = normalizeToHex(hex).slice(1);
  return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16)
  };
}
/**
 * Converts r, g, b channel values to an uppercase hex color string.
 * @param {number} r - Red (0–255).
 * @param {number} g - Green (0–255).
 * @param {number} b - Blue (0–255).
 * @returns {string} Uppercase hex color (e.g. "#FF8800").
 */
function rgbToHex(r, g, b) {
  return ("#" + [ r, g, b ].map(v => Math.max(0, Math.min(255, v | 0)).toString(16).padStart(2, "0")).join("")).toUpperCase();
}
/**
 * Converts HSV color values to RGB.
 * @param {number} h - Hue (0–360 degrees).
 * @param {number} s - Saturation (0–1).
 * @param {number} v - Value (0–1).
 * @returns {{r: number, g: number, b: number}} RGB values (0–255).
 */
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
/**
 * Converts RGB color values to HSV.
 * @param {number} r - Red (0–255).
 * @param {number} g - Green (0–255).
 * @param {number} b - Blue (0–255).
 * @returns {{h: number, s: number, v: number}} HSV values (h in degrees, s/v 0–1).
 */
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

