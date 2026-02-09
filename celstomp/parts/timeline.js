document.getElementById('part-timeline').innerHTML = `
  <section id="timeline">
    <div id="timelineHeader">

      <button id="tlMobLeftBtn" class="tlMobArrow tlMobLeft" type="button" aria-label="Toggle timeline info"
        aria-expanded="false">▴</button>
      <button id="tlMobRightBtn" class="tlMobArrow tlMobRight" type="button" aria-label="Toggle timeline options"
        aria-expanded="false">▴</button>


      <div class="left">
        <strong>Timeline</strong>
        <span class="badge" id="timeCounter">0s+0f</span>
        <span class="badge">Loop <input id="loopToggle" type="checkbox" checked
            style="vertical-align:middle; margin-left:6px;" /></span>
        <button id="insertFrameBtn" class="miniBtn" title="Insert Frame">+</button>
        <button id="deleteFrameBtn" class="miniBtn danger" title="Delete Frame">−</button>
        <input id="gotoFrameInput" type="number" min="1" class="gotoFrameInput" placeholder="Frame #"
            title="Jump to frame" />
        <button id="gotoFrameBtn" class="miniBtn">Go</button>
      </div>


      <div class="center" id="tlHeaderCenter">
        <button id="tlPrevCel">◀︎ Cel</button>
        <button id="tlPrevFrame">◀︎ Frame</button>
        <button id="tlPlayToggle">▶︎ / ⏸</button>
        <button id="tlNextFrame">Frame ▶︎</button>
        <button id="tlNextCel">Cel ▶︎</button>
      </div>

      <div class="right">

        <label><input id="tlOnion" type="checkbox" /> Onion</label>
        <button id="tlDupCel">Duplicate Cel</button>

        <label for="tlSnap">Snap (frames)</label>
        <input id="tlSnap" type="number" min="1" style="width:70px;" />
        <label><input id="tlPlaySnapped" type="checkbox" /> Play snapped</label>

        <label for="tlSeconds">Seconds</label>
        <input id="tlSeconds" type="number" min="1" style="width:70px;" />

        <label for="tlFps">FPS</label>
        <input id="tlFps" type="number" min="1" style="width:70px;" />

        <button id="zoomTimelineOut" class="miniBtn" title="Zoom Out">−</button>
        <span class="timelineZoom">Zoom</span>
        <button id="zoomTimelineIn" class="miniBtn" title="Zoom In">+</button>

        <button id="hideTimelineBtn">—</button>
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
