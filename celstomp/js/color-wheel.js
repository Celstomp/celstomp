let _wheelGeom = null;
let _wheelRingImg = null;
let _dragMode = null;

let hsvPick = {
    h: 0,
    s: 1,
    v: 1
  };

function wheelLocalFromEvent(e) {
    const hsvWheelCanvas = $("hsvWheelCanvas");
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
    const hsvWheelCanvas = $("hsvWheelCanvas");
    const hsvWheelWrap = $("hsvWheelWrap");
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
}

function computeWheelGeom() {
    const hsvWheelCanvas = $("hsvWheelCanvas");
    const hsvWheelWrap = $("hsvWheelWrap");
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
function drawHSVWheel() {
    const hsvWheelCanvas = $("hsvWheelCanvas");
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
    const svImg = buildSVSquareImage(geom);
    ctx.putImageData(svImg, geom.sqLeft, geom.sqTop);
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = Math.max(1, geom.size * .004);
    ctx.strokeRect(geom.sqLeft + .5, geom.sqTop + .5, geom.sqSize - 1, geom.sqSize - 1);
    ctx.restore();
    const mx = geom.sqLeft + hsvPick.s * geom.sqSize;
    const my = geom.sqTop + (1 - hsvPick.v) * geom.sqSize;
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