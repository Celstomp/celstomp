(() => {
  "use strict";

  function createController(options = {}) {
    const autosaveKey = String(options.autosaveKey || "celstomp.project.autosave.v1");
    const manualSaveMetaKey = String(options.manualSaveMetaKey || "celstomp.project.manualsave.v1");
    let intervalMs = Math.max(5000, Number(options.intervalMs || 45000));
    let enabled = !!options.enabled;
    const badgeEl = options.badgeEl || null;
    const buildSnapshot = options.buildSnapshot;
    const onRestorePayload = options.onRestorePayload;
    const pointerSelectors = Array.isArray(options.pointerSelectors) ? options.pointerSelectors : [];
    const valueSelectors = Array.isArray(options.valueSelectors) ? options.valueSelectors : [];

    if (typeof buildSnapshot !== "function") {
      throw new Error("CelstompAutosave: buildSnapshot() is required");
    }
    if (typeof onRestorePayload !== "function") {
      throw new Error("CelstompAutosave: onRestorePayload() is required");
    }

    let dirty = false;
    let busy = false;
    let wired = false;
    let intervalId = 0;

    function formatClock(ts) {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    function setBadge(text, tone = "") {
      if (!badgeEl) return;
      badgeEl.textContent = text;
      badgeEl.classList.remove("dirty", "saving", "error");
      if (tone) badgeEl.classList.add(tone);
    }

    function markDirty() {
      dirty = true;
      setBadge("Unsaved", "dirty");
    }

    function markClean(text = "Saved") {
      dirty = false;
      setBadge(text, "");
    }

    function setManualSaveAt(ts = Date.now()) {
      try {
        localStorage.setItem(manualSaveMetaKey, JSON.stringify({ manualSavedAt: ts }));
      } catch {
          // intentionally empty
      }
    }

    function getLastManualSaveAt() {
      try {
        const meta = JSON.parse(localStorage.getItem(manualSaveMetaKey) || "null");
        const v = Number(meta?.manualSavedAt || 0);
        return Number.isFinite(v) ? v : 0;
      } catch {
        return 0;
      }
    }

    function getPayload() {
      try {
        const raw = localStorage.getItem(autosaveKey);
        if (!raw) return null;
        const payload = JSON.parse(raw);
        const savedAt = Number(payload?.savedAt || 0);
        if (!Number.isFinite(savedAt) || !payload?.data) return null;
        return payload;
      } catch {
        return null;
      }
    }

    function hasRecoverableAutosave() {
      const payload = getPayload();
      if (!payload) return false;
      return Number(payload.savedAt) > getLastManualSaveAt();
    }

    function updateRestoreButton(buttonEl) {
      if (!buttonEl) return;
      buttonEl.disabled = !hasRecoverableAutosave();
    }

    async function runAutosave(reason = "interval") {
      if (!enabled || busy || !dirty) return false;
      busy = true;
      setBadge("Autosaving...", "saving");

      try {
        const data = await buildSnapshot();
        const savedAt = Date.now();
        const payload = { version: 1, reason, savedAt, data };
        localStorage.setItem(autosaveKey, JSON.stringify(payload));
        dirty = false;
        setBadge(`Autosaved ${formatClock(savedAt)}`);
        return true;
      } catch (err) {
        console.warn("[celstomp] autosave failed:", err);
        setBadge("Autosave failed", "error");
        return false;
      } finally {
        busy = false;
      }
    }

    function wireDirtyTracking() {
      if (wired) return;
      wired = true;

      const pointerSelector = pointerSelectors.join(",");
      const valueSelector = valueSelectors.join(",");

      if (pointerSelector) {
        document.addEventListener("pointerup", (e) => {
          const t = e.target;
          if (t && typeof t.closest === "function" && t.closest(pointerSelector)) markDirty();
        }, true);
      }

      if (valueSelector) {
        document.addEventListener("change", (e) => {
          const t = e.target;
          if (t && typeof t.closest === "function" && t.closest(valueSelector)) markDirty();
        }, true);

        document.addEventListener("input", (e) => {
          const t = e.target;
          if (t && typeof t.closest === "function" && t.closest(valueSelector)) markDirty();
        }, true);
      }

      window.addEventListener("beforeunload", (e) => {
        if (!enabled || !dirty) return;
        e.preventDefault();
        e.returnValue = "";
      });

      if (intervalId) window.clearInterval(intervalId);
      intervalId = window.setInterval(() => {
        void runAutosave("interval");
      }, intervalMs);

      document.addEventListener("visibilitychange", () => {
        if (document.hidden) void runAutosave("visibilitychange");
      });
    }

    function promptRecovery({ source = "autosave-prompt" } = {}) {
      try {
        const payload = getPayload();
        if (!payload) return false;
        const savedAt = Number(payload.savedAt || 0);
        if (savedAt <= getLastManualSaveAt()) return false;

        const ok = window.confirm(
          `A newer autosave was found from ${new Date(savedAt).toLocaleString()}.\n\nRestore it now?`
        );
        if (!ok) {
          setBadge("Unsaved draft", "dirty");
          return false;
        }

        onRestorePayload(payload, source);
        return true;
      } catch (err) {
        console.warn("[celstomp] autosave recovery check failed:", err);
        return false;
      }
    }

    function restoreLatest(source = "autosave-button") {
      const payload = getPayload();
      if (!payload) return false;
      onRestorePayload(payload, source);
      return true;
    }

    function setEnabled(next) {
      enabled = !!next;
      if (!enabled) {
        setBadge("Autosave Off", "");
        return;
      }
      setBadge(dirty ? "Unsaved" : "Autosave On", dirty ? "dirty" : "");
    }

    function isEnabled() {
      return !!enabled;
    }

    function setIntervalMs(nextMs) {
      const ms = Math.max(5000, Number(nextMs || intervalMs));
      intervalMs = ms;
      if (wired) {
        if (intervalId) window.clearInterval(intervalId);
        intervalId = window.setInterval(() => {
          void runAutosave("interval");
        }, intervalMs);
      }
    }

    function getIntervalMs() {
      return intervalMs;
    }

    return {
      setBadge,
      markDirty,
      markClean,
      setManualSaveAt,
      getPayload,
      updateRestoreButton,
      wireDirtyTracking,
      promptRecovery,
      restoreLatest,
      runAutosave,
      setEnabled,
      isEnabled,
      setIntervalMs,
      getIntervalMs,
    };
  }

  window.CelstompAutosave = { createController };
})();
