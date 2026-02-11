(function () {
    'use strict';

    const barrels = window.__celstompBarrels || (window.__celstompBarrels = {});

    barrels.editor = [
        './js/editor/layer-manager.js',
        './js/editor/timeline-helper.js',
        './js/editor/history-helper.js',
        './js/editor/canvas-helper.js',
        './js/editor/export-helper.js'
    ];
})();
