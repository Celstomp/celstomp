let _wheelGeom = null;
let _wheelRingImg = null;
let _wheelTriangleCanvas = null;
let _dragMode = null;

let pickerShape = "square";

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

function getSVTriangleGeom(g) {
    const triR = Math.floor(g.ringInner * 0.90);
    const angH = (hsvPick.h - 90) * (Math.PI / 180);
    const a = {
        x: Math.cos(angH) * triR,
        y: Math.sin(angH) * triR
    };
    const b = {
        x: Math.cos(angH + 2 * Math.PI / 3) * triR,
        y: Math.sin(angH + 2 * Math.PI / 3) * triR
    };
    const c = {
        x: Math.cos(angH + 4 * Math.PI / 3) * triR,
        y: Math.sin(angH + 4 * Math.PI / 3) * triR
    };
    const detT = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
    return {
        a: a,
        b: b,
        c: c,
        triR: triR,
        detT: detT
    };
}

function barycentricSV(px, py, tri) {
    const {a, b, c, detT} = tri;
    if (!detT) return {
        l1: 0,
        l2: 0,
        l3: 1
    };
    const l1 = ((b.y - c.y) * (px - c.x) + (c.x - b.x) * (py - c.y)) / detT;
    const l2 = ((c.y - a.y) * (px - c.x) + (a.x - c.x) * (py - c.y)) / detT;
    return {
        l1: l1,
        l2: l2,
        l3: 1 - l1 - l2
    };
}

function closestPointOnSegment(px, py, ax, ay, bx, by) {
    const abx = bx - ax;
    const aby = by - ay;
    const den = abx * abx + aby * aby;
    if (den <= 1e-12) return {
        x: ax,
        y: ay
    };
    const t = clamp(((px - ax) * abx + (py - ay) * aby) / den, 0, 1);
    return {
        x: ax + abx * t,
        y: ay + aby * t
    };
}

function closestPointOnSVTriangle(px, py, tri) {
    const {a, b, c} = tri;
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const acx = c.x - a.x;
    const acy = c.y - a.y;
    const apx = px - a.x;
    const apy = py - a.y;

    const d1 = abx * apx + aby * apy;
    const d2 = acx * apx + acy * apy;
    if (d1 <= 0 && d2 <= 0) return {
        x: a.x,
        y: a.y
    };

    const bpx = px - b.x;
    const bpy = py - b.y;
    const d3 = abx * bpx + aby * bpy;
    const d4 = acx * bpx + acy * bpy;
    if (d3 >= 0 && d4 <= d3) return {
        x: b.x,
        y: b.y
    };

    const vc = d1 * d4 - d3 * d2;
    if (vc <= 0 && d1 >= 0 && d3 <= 0) {
        const v = d1 / (d1 - d3);
        return {
            x: a.x + v * abx,
            y: a.y + v * aby
        };
    }

    const cpx = px - c.x;
    const cpy = py - c.y;
    const d5 = abx * cpx + aby * cpy;
    const d6 = acx * cpx + acy * cpy;
    if (d6 >= 0 && d5 <= d6) return {
        x: c.x,
        y: c.y
    };

    const vb = d5 * d2 - d1 * d6;
    if (vb <= 0 && d2 >= 0 && d6 <= 0) {
        const w = d2 / (d2 - d6);
        return {
            x: a.x + w * acx,
            y: a.y + w * acy
        };
    }

    const va = d3 * d6 - d5 * d4;
    if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
        const p = closestPointOnSegment(px, py, b.x, b.y, c.x, c.y);
        return {
            x: p.x,
            y: p.y
        };
    }

    return {
        x: px,
        y: py
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
        const tri = getSVTriangleGeom(g);
        const {l1, l2, l3} = barycentricSV(dx, dy, tri);
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
        const tri = getSVTriangleGeom(g);
        const baryRaw = barycentricSV(dx, dy, tri);
        let px = dx;
        let py = dy;
        if (baryRaw.l1 < 0 || baryRaw.l2 < 0 || baryRaw.l3 < 0) {
            const clamped = closestPointOnSVTriangle(dx, dy, tri);
            px = clamped.x;
            py = clamped.y;
        }
        let {l1, l2, l3} = barycentricSV(px, py, tri);
        l1 = clamp(l1, 0, 1);
        l2 = clamp(l2, 0, 1);
        l3 = clamp(l3, 0, 1);
        const sum = l1 + l2 + l3;
        if (sum > 1e-9) {
            l1 /= sum;
            l2 /= sum;
            l3 /= sum;
        }
        hsvPick.v = l1 + l2;
        hsvPick.s = hsvPick.v > 0.0001 ? (l1 / hsvPick.v) : 0;
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
function _initHSVWheelPicker() {
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
        } catch {
            // intentionally empty
        }
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
            } catch {
                // intentionally empty
            }
            drawHSVWheel();
        });
    }
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
