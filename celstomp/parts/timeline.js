document.getElementById('part-timeline').innerHTML = `
  <section id="timeline">
    <div id="timelineHeader">

      <button id="tlMobLeftBtn" class="tlMobArrow tlMobLeft" type="button" aria-label="Toggle timeline info"
        aria-expanded="false">▴</button>
      <button id="tlMobRightBtn" class="tlMobArrow tlMobRight" type="button" aria-label="Toggle timeline options"
        aria-expanded="false">▴</button>


      <div class="left tl-group">
        <strong>Timeline</strong>
        <span class="badge" id="timeCounter">0s+0f</span>
        <span class="badge">Loop <input id="loopToggle" type="checkbox" checked
            style="vertical-align:middle; margin-left:6px;" /></span>
        <div class="tl-btn-group">
          <button id="insertFrameBtn" class="tl-icon-btn" title="Insert Frame">
            <svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
          <button id="deleteFrameBtn" class="tl-icon-btn danger" title="Delete Frame">
            <svg viewBox="0 0 24 24" width="16" height="16"><path d="M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
        </div>
        <input id="gotoFrameInput" type="number" min="1" class="tl-num-input" placeholder="#" title="Jump to frame" />
        <button id="gotoFrameBtn" class="tl-icon-btn" title="Go to frame">
          <svg viewBox="0 0 24 24" width="16" height="16"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>


      <div class="center tl-group" id="tlHeaderCenter">
        <div class="tl-btn-group">
          <button id="tlPrevCel" class="tl-icon-btn" title="Previous Cel">
            <svg viewBox="0 0 24 24" width="16" height="16"><path d="M11 17l-5-5 5-5M18 17l-5-5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <button id="tlPrevFrame" class="tl-icon-btn" title="Previous Frame">
            <svg viewBox="0 0 24 24" width="16" height="16"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <button id="tlPlayToggle" class="tl-icon-btn tl-play-btn" title="Play/Pause">
            <svg class="play-icon" viewBox="0 0 24 24" width="18" height="18"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>
            <svg class="pause-icon" viewBox="0 0 24 24" width="18" height="18" style="display:none"><path d="M6 4h4v16H6zM14 4h4v16h-4z" fill="currentColor"/></svg>
          </button>
          <button id="tlNextFrame" class="tl-icon-btn" title="Next Frame">
            <svg viewBox="0 0 24 24" width="16" height="16"><path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <button id="tlNextCel" class="tl-icon-btn" title="Next Cel">
            <svg viewBox="0 0 24 24" width="16" height="16"><path d="M13 17l5-5-5-5M6 17l5-5-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
      </div>

      <div class="right tl-group">
        <div class="tl-btn-group">
          <label class="tl-chip"><input id="tlOnion" type="checkbox" /> Onion</label>
          <button id="tlDupCel" class="tl-icon-btn" title="Duplicate Cel">
            <svg viewBox="0 0 24 24" width="16" height="16"><rect x="8" y="8" width="12" height="12" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><path d="M4 16V6a2 2 0 012-2h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
        </div>

        <div class="tl-btn-group tl-opts-group">
          <label class="tl-chip"><span>Snap</span><input id="tlSnap" type="number" min="1" class="tl-num-input-sm" /></label>
          <label class="tl-chip"><input id="tlPlaySnapped" type="checkbox" /> Snapped</label>
        </div>

        <div class="tl-btn-group tl-opts-group">
          <label class="tl-chip"><span>Sec</span><input id="tlSeconds" type="number" min="1" class="tl-num-input-sm" /></label>
          <label class="tl-chip"><span>FPS</span><input id="tlFps" type="number" min="1" class="tl-num-input-sm" /></label>
        </div>

        <div class="tl-btn-group">
          <button id="zoomTimelineOut" class="tl-icon-btn" title="Zoom Out">
            <svg viewBox="0 0 24 24" width="16" height="16"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" fill="none"/><path d="M8 11h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
          <button id="zoomTimelineIn" class="tl-icon-btn" title="Zoom In">
            <svg viewBox="0 0 24 24" width="16" height="16"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" fill="none"/><path d="M8 11h6M11 8v6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
        </div>

        <button id="hideTimelineBtn" class="tl-icon-btn" title="Hide Timeline">
          <svg viewBox="0 0 24 24" width="16" height="16"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      </div>
    </div>

    <div id="timelineScroll">
      <div id="playheadMarker"></div>
      <div id="clipStartMarker"></div>
      <div id="clipEndMarker"></div>
      <table id="timelineTable" aria-label="Timeline grid"></table>
    </div>
  </section>


  <button id="showTimelineEdge" class="edge-btn">Show Timeline</button>
`;
