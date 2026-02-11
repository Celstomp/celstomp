function dockDrag() {
    const dockToggle = $("dockToggleBtn");
    const dock = $("colorDock");
    const head = $("colorDockHeader");
    const btn = $("dockMinBtn");
    const body = $("colorDockBody");
    if (!dock || !head) return;
    function clampDockIntoView() {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const timelineH = nowCSSVarPx("--timeline-h", 190);
        const headerH = document.querySelector("header.top")?.offsetHeight || 48;
        const rect = dock.getBoundingClientRect();
        let nx = rect.left;
        let ny = rect.top;
        const minLeft = 0;
        const maxLeft = Math.max(0, vw - rect.width);
        const minTop = headerH + 8;
        const maxTop = Math.max(minTop, vh - timelineH - rect.height - 8);
        nx = clamp(nx, minLeft, maxLeft);
        ny = clamp(ny, minTop, maxTop);
        dock.style.left = nx + "px";
        dock.style.top = ny + "px";
        dock.style.right = "auto";
        dock.style.bottom = "auto";
    }
    function setDockedRight(on) {
        if (on) {
            dock.classList.add("docked-right");
            const headerH = document.querySelector("header.top")?.offsetHeight || 48;
            dock.style.top = headerH + 8 + "px";
            dock.style.right = "14px";
            dock.style.left = "auto";
            dock.style.bottom = "calc(var(--timeline-h) + 4px)";
        } else {
            dock.classList.remove("docked-right");
            clampDockIntoView();
        }
    }
    dockToggle?.addEventListener("click", () => {
        const on = !dock.classList.contains("docked-right");
        setDockedRight(on);
    });
    let dragging = false, sx = 0, sy = 0, ox = 0, oy = 0;
    head.addEventListener("mousedown", e => {
        if (dock.classList.contains("docked-right")) return;
        dragging = true;
        sx = e.clientX;
        sy = e.clientY;
        const r = dock.getBoundingClientRect();
        ox = r.left;
        oy = r.top;
        e.preventDefault();
    });
    window.addEventListener("mousemove", e => {
        if (!dragging) return;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const timelineH = nowCSSVarPx("--timeline-h", 190);
        const headerH = document.querySelector("header.top")?.offsetHeight || 48;
        let nx = ox + e.clientX - sx;
        let ny = oy + e.clientY - sy;
        const minLeft = 0;
        const maxLeft = Math.max(0, vw - dock.offsetWidth);
        const minTop = headerH + 8;
        const maxTop = Math.max(minTop, vh - timelineH - dock.offsetHeight - 8);
        nx = clamp(nx, minLeft, maxLeft);
        ny = clamp(ny, minTop, maxTop);
        dock.style.left = nx + "px";
        dock.style.top = ny + "px";
        dock.style.right = "auto";
        dock.style.bottom = "auto";
    });
    window.addEventListener("mouseup", () => {
        dragging = false;
    });
    btn?.addEventListener("click", () => {
        if (!body) return;
        body.style.display = body.style.display === "none" ? "" : "none";
    });
    window.addEventListener("resize", () => clampDockIntoView());
}