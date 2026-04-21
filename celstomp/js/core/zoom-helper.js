// leave global here for now - quick refactor
let zoom = 1;
let offsetX = 0;
let offsetY = 0;

/** Returns the current canvas zoom factor. @returns {number} */
const getZoom = () => zoom;
/** Sets the canvas zoom factor. @param {number} z */
const setZoom = (z) => zoom = z;

/** Returns the current horizontal pan offset in device pixels. @returns {number} */
const getOffsetX = () => offsetX;
/** Sets the horizontal pan offset. @param {number} x */
const setOffsetX = (x) => offsetX = x;

/** Returns the current vertical pan offset in device pixels. @returns {number} */
const getOffsetY = () => offsetY;
/** Sets the vertical pan offset. @param {number} y */
const setOffsetY = (y) => offsetY = y;

