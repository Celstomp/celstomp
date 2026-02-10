/*
      menu helpers - wiring together open + close functionality (can be factored out, i assume)
  */
  // menu helper functions
  function _openPopupAt(popup, x, y) {
    if (!popup) return;
    popup.style.left = `${x}px`;
    popup.style.top = `${y}px`;
    popup.setAttribute("aria-hidden", "false");
    popup.classList.add("open");
}
function _closePopup(popup) {
    if (!popup) return;
    popup.setAttribute("aria-hidden", "true");
    popup.classList.remove("open");
}
function _menuFocusableItems(panel) {
    if (!panel) return [];
    return Array.from(panel.querySelectorAll("button:not([disabled]), select, input[type='checkbox']")).filter(el => !el.hidden);
}
function _closeSubmenu(triggerBtn, panel) {
    if (panel) panel.hidden = true;
    if (triggerBtn) triggerBtn.setAttribute("aria-expanded", "false");
}
function _openSubmenu(triggerBtn, panel) {
    if (!panel || !triggerBtn) return;
    panel.hidden = false;
    triggerBtn.setAttribute("aria-expanded", "true");
}
function _closeTopMenus() {
    [ [ menuFileBtn, menuFilePanel ], [ menuEditBtn, menuEditPanel ], [ menuToolBehaviorBtn, menuToolBehaviorPanel ] ].forEach(([btn, panel]) => {
        if (panel) panel.hidden = true;
        btn?.setAttribute("aria-expanded", "false");
    });
    [ [ menuExportBtn, menuExportPanel ], [ menuAutosaveBtn, menuAutosavePanel ] ].forEach(([btn, panel]) => _closeSubmenu(btn, panel));
}
function _openTopMenu(btn, panel) {
    if (!btn || !panel) return;
    _closeTopMenus();
    panel.hidden = false;
    btn.setAttribute("aria-expanded", "true");
    const first = _menuFocusableItems(panel)[0];
    if (first && window.matchMedia("(min-width: 721px)").matches) {
        try {
            first.focus({
                preventScroll: true
            });
        } catch {}
    }
}

// syntactic sugar for: open and close
function wireTopMenus() {
    if (!topMenuBar || topMenuBar.dataset.wiredMenus === "1") return;
    topMenuBar.dataset.wiredMenus = "1";
    const triggerPairs = [ [ menuFileBtn, menuFilePanel ], [ menuEditBtn, menuEditPanel ], [ menuToolBehaviorBtn, menuToolBehaviorPanel ] ];
    triggerPairs.forEach(([btn, panel]) => {
        if (!btn || !panel) return;
        btn.addEventListener("click", e => {
            e.preventDefault();
            e.stopPropagation();
            const open = !panel.hidden;
            if (open) _closeTopMenus(); else _openTopMenu(btn, panel);
        });
        btn.addEventListener("keydown", e => {
            if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                _openTopMenu(btn, panel);
            }
        });
    });
    [ [ menuExportBtn, menuExportPanel ], [ menuAutosaveBtn, menuAutosavePanel ] ].forEach(([btn, panel]) => {
        btn?.addEventListener("click", e => {
            e.preventDefault();
            e.stopPropagation();
            if (panel?.hidden) _openSubmenu(btn, panel); else _closeSubmenu(btn, panel);
        });
        btn?.addEventListener("keydown", e => {
            if (e.key === "ArrowRight" || e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                _openSubmenu(btn, panel);
                const first = _menuFocusableItems(panel)[0];
                first?.focus?.();
            }
        });
    });
    const wirePanelKeys = panel => {
        panel?.addEventListener("keydown", e => {
            const items = menuFocusableItems(panel);
            if (!items.length) return;
            const idx = Math.max(0, items.indexOf(document.activeElement));
            if (e.key === "ArrowDown") {
                e.preventDefault();
                items[(idx + 1) % items.length].focus();
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                items[(idx - 1 + items.length) % items.length].focus();
            } else if (e.key === "Escape") {
                e.preventDefault();
                _closeTopMenus();
            } else if (e.key === "ArrowLeft" && panel?.classList?.contains("topSubmenuPanel")) {
                e.preventDefault();
                const trigger = topMenuBar?.querySelector(`.topSubmenuTrigger[aria-controls="${panel.id}"]`) || null;
                _closeSubmenu(trigger, panel);
                trigger?.focus?.();
            }
        });
    };

    wirePanelKeys(menuFilePanel);
    wirePanelKeys(menuEditPanel);
    wirePanelKeys(menuToolBehaviorPanel);
    wirePanelKeys(menuExportPanel);
    wirePanelKeys(menuAutosavePanel);
    document.addEventListener("mousedown", e => {
        if (!topMenuBar.contains(e.target)) _closeTopMenus();
    });
    document.addEventListener("keydown", e => {
        if (e.key === "Escape") _closeTopMenus();
    });
    [ menuFilePanel, menuEditPanel, menuToolBehaviorPanel, menuExportPanel, menuAutosavePanel ].forEach(panel => {
        panel?.addEventListener("click", e => {
            if (e.target.closest("button") && !e.target.closest(".topSubmenuTrigger")) {
                _closeTopMenus();
            }
        });
    });
}