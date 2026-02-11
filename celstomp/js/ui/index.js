(function () {
    'use strict';

    const barrels = window.__celstompBarrels || (window.__celstompBarrels = {});

    barrels.ui = [
        './js/ui/color-wheel.js',
        './js/ui/island-helper.js',
        './js/ui/swatch-handler.js',
        './js/ui/menu-wires.js',
        './js/ui/qol-wiring-handler.js',
        './js/ui/dock-helper.js',
        './js/ui/mobile-native-zoom-guard.js',
        './js/ui/mount-island-dock.js',
        './js/ui/ui-components.js'
    ];
})();
