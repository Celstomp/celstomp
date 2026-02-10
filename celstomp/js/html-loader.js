(function () {
    'use strict';

    const MOBILE_GATE_DISMISS_KEY = 'celstomp.mobile_gate_dismissed.v1';
    const PHONE_ONLY_QUERY = '(max-width: 720px) and (hover: none) and (pointer: coarse)';

    const partScripts = [
        './parts/header.js',
        './parts/stage.js',
        './parts/sidepanel.js',
        './parts/timeline.js',
        './parts/modals.js'
    ];

    const appScripts = [
        './js/helper-funcs.js',
        
        './js/time-helper.js',
        './js/color-manager.js',
        './js/zoom-helper.js',
        './js/color-wheel.js',
        './js/island-helper.js',
        './js/layer-manager.js',
        './js/timeline-helper.js',

        
        './js/swatch-handler.js',
        './js/history-helper.js',
        './js/brush-helper.js',
        './js/canvas-helper.js',
        './js/eraser-manager.js',
        './js/lasso-helper.js',
        './js/export-helper.js',
        './js/pointer-events.js',

        './js/pointer-wire.js',
        './js/menu-wires.js',
        './js/qol-wiring-handler.js',
        
        './js/dock-helper.js',
        './js/mobile-native-zoom-guard.js',
        './js/mount-island-dock.js',
        './js/ui-components.js',

        './js/omggif.js',
        './celstomp-imgseq.js',
        './celstomp-autosave.js',
        './celstomp-app.js'
    ];

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
            document.body.appendChild(script);
        });
    }

    function hasDismissedMobileGate() {
        try {
            return localStorage.getItem(MOBILE_GATE_DISMISS_KEY) === '1';
        } catch {
            return false;
        }
    }

    function persistMobileGateDismissed() {
        try {
            localStorage.setItem(MOBILE_GATE_DISMISS_KEY, '1');
        } catch {}
    }

    function shouldShowMobileGate() {
        if (hasDismissedMobileGate()) return false;
        return window.matchMedia(PHONE_ONLY_QUERY).matches;
    }

    function wireMobileGate() {
        const backdrop = document.getElementById('mobileGateBackdrop');
        const modal = document.getElementById('mobileGateModal');
        const continueBtn = document.getElementById('mobileGateContinueBtn');
        const backBtn = document.getElementById('mobileGateBackBtn');
        if (!backdrop || !modal || !continueBtn || !backBtn) return Promise.resolve();

        backdrop.hidden = false;
        modal.hidden = false;

        const prevActive = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const focusableSelector = [
            'button:not([disabled])',
            '[href]',
            'input:not([disabled]):not([type="hidden"])',
            'select:not([disabled])',
            'textarea:not([disabled])',
            '[tabindex]:not([tabindex="-1"])'
        ].join(',');

        const resolveAndClose = resolve => {
            document.removeEventListener('keydown', onKeyDown, true);
            backdrop.hidden = true;
            modal.hidden = true;
            if (prevActive && typeof prevActive.focus === 'function') {
                try {
                    prevActive.focus({ preventScroll: true });
                } catch {
                    prevActive.focus();
                }
            }
            resolve();
        };

        const focusFirst = () => {
            const focusables = Array.from(modal.querySelectorAll(focusableSelector));
            if (!focusables.length) {
                modal.setAttribute('tabindex', '-1');
                modal.focus();
                return;
            }
            const target = continueBtn.hidden || continueBtn.disabled ? focusables[0] : continueBtn;
            target.focus();
        };

        let resolver = null;

        const onKeyDown = e => {
            if (modal.hidden) return;
            if (e.key === 'Escape') {
                e.preventDefault();
                if (resolver) resolveAndClose(resolver);
                return;
            }

            if (e.key !== 'Tab') return;
            const focusables = Array.from(modal.querySelectorAll(focusableSelector));
            if (!focusables.length) {
                e.preventDefault();
                modal.focus();
                return;
            }
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            const active = document.activeElement;
            if (e.shiftKey && active === first) {
                e.preventDefault();
                last.focus();
                return;
            }
            if (!e.shiftKey && active === last) {
                e.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', onKeyDown, true);
        focusFirst();

        return new Promise(resolve => {
            resolver = resolve;

            continueBtn.addEventListener('click', () => {
                persistMobileGateDismissed();
                resolveAndClose(resolve);
            }, { once: true });

            backBtn.addEventListener('click', () => {
                if (window.history.length > 1) {
                    window.history.back();
                    return;
                }
                window.location.href = '/';
            }, { once: true });
        });
    }

    async function loadAppScripts() {
        for (const src of appScripts) {
            await loadScript(src);
        }
    }

    async function boot() {
        try {
            for (const src of partScripts) {
                await loadScript(src);
            }

            if (shouldShowMobileGate()) {
                await wireMobileGate();
            }

            await loadAppScripts();

            console.log('[celstomp] All parts and scripts loaded via JS injection.');

        } catch (err) {
            console.error('[celstomp] Boot error:', err);
            alert('Error loading application: ' + err.message);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

})();
