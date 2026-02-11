(function () {
    'use strict';

    const barrels = window.__celstompBarrels || (window.__celstompBarrels = {});

    barrels.core = [
        './js/core/helper-funcs.js',
        './js/core/time-helper.js',
        './js/core/color-manager.js',
        './js/core/zoom-helper.js'
    ];
})();
