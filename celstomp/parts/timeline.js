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
        <button id="tlPrevCel" class="tl-play-btn" title="Previous Cel">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
        </button>
        <button id="tlPrevFrame" class="tl-play-btn" title="Previous Frame">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
        </button>
        <button id="tlPlayToggle" class="tl-play-btn tl-play-main" title="Play/Pause">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" class="play-icon"><path d="M8 5v14l11-7z"/></svg>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" class="pause-icon" style="display:none;"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
        </button>
        <button id="tlNextFrame" class="tl-play-btn" title="Next Frame">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
        </button>
        <button id="tlNextCel" class="tl-play-btn" title="Next Cel">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
        </button>
      </div>

      <div class="right">

        <div class="tl-group">
          <label><input id="tlOnion" type="checkbox" /> Onion</label>
          <button id="tlDupCel">Duplicate</button>
        </div>

        <div class="tl-group tl-group-tools">
          <button id="tlGridBtn" class="tl-tool-btn" title="Toggle Grid (G)">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="1" y="1" width="5" height="5" fill="none" stroke="currentColor" stroke-width="1"/>
              <rect x="10" y="1" width="5" height="5" fill="none" stroke="currentColor" stroke-width="1"/>
              <rect x="1" y="10" width="5" height="5" fill="none" stroke="currentColor" stroke-width="1"/>
              <rect x="10" y="10" width="5" height="5" fill="none" stroke="currentColor" stroke-width="1"/>
            </svg>
          </button>
          <input id="tlGridSize" type="number" min="8" max="128" class="tl-num" value="32" title="Grid Size" style="width:50px;" />
          <button id="tlGridSnapBtn" class="tl-tool-btn" title="Snap to Grid">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <circle cx="8" cy="8" r="2" fill="none" stroke="currentColor" stroke-width="1.5"/>
              <line x1="8" y1="1" x2="8" y2="4" stroke="currentColor" stroke-width="1.5"/>
              <line x1="8" y1="12" x2="8" y2="15" stroke="currentColor" stroke-width="1.5"/>
              <line x1="1" y1="8" x2="4" y2="8" stroke="currentColor" stroke-width="1.5"/>
              <line x1="12" y1="8" x2="15" y2="8" stroke="currentColor" stroke-width="1.5"/>
            </svg>
          </button>
          <button id="tlRulersBtn" class="tl-tool-btn" title="Toggle Rulers">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <line x1="2" y1="3" x2="14" y2="3" stroke="currentColor" stroke-width="1.5"/>
              <line x1="2" y1="13" x2="14" y2="13" stroke="currentColor" stroke-width="1.5"/>
              <line x1="3" y1="2" x2="3" y2="5" stroke="currentColor" stroke-width="1"/>
              <line x1="3" y1="11" x2="3" y2="14" stroke="currentColor" stroke-width="1"/>
            </svg>
          </button>
          <button id="tlGuideSnapBtn" class="tl-tool-btn" title="Snap to Guides">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <line x1="8" y1="1" x2="8" y2="6" stroke="currentColor" stroke-width="2"/>
              <line x1="8" y1="10" x2="8" y2="15" stroke="currentColor" stroke-width="2"/>
              <line x1="1" y1="8" x2="6" y2="8" stroke="currentColor" stroke-width="2"/>
              <line x1="10" y1="8" x2="15" y2="8" stroke="currentColor" stroke-width="2"/>
            </svg>
          </button>
        </div>

        <div class="tl-group tl-group-guide">
          <button id="addHGuideBtn" class="tl-tool-btn tl-guide-btn" title="Add Horizontal Guide - click on canvas">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" stroke-width="2"/>
              <line x1="8" y1="3" x2="8" y2="13" stroke="currentColor" stroke-width="1" opacity="0.6"/>
              <circle cx="8" cy="8" r="1.5" fill="currentColor"/>
            </svg>
          </button>
          <button id="addVGuideBtn" class="tl-tool-btn tl-guide-btn" title="Add Vertical Guide - click on canvas">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <line x1="8" y1="2" x2="8" y2="14" stroke="currentColor" stroke-width="2"/>
              <line x1="3" y1="8" x2="13" y2="8" stroke="currentColor" stroke-width="1" opacity="0.6"/>
              <circle cx="8" cy="8" r="1.5" fill="currentColor"/>
            </svg>
          </button>
          <button id="clearGuidesBtn" class="tl-tool-btn" title="Clear All Guides">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <line x1="3" y1="3" x2="13" y2="13" stroke="currentColor" stroke-width="2"/>
              <line x1="13" y1="3" x2="3" y2="13" stroke="currentColor" stroke-width="2"/>
            </svg>
          </button>
          <span id="guideModeHint" class="tl-guide-hint" hidden>Click Canvas To Place Guide</span>
        </div>

        <div class="tl-group">
          <label for="tlSeconds">Sec</label>
          <input id="tlSeconds" type="number" min="1" class="tl-num" />

          <label for="tlFps">FPS</label>
          <input id="tlFps" type="number" min="1" class="tl-num" />
          
          <label for="tlSnap">Snap</label>
          <input id="tlSnap" type="number" min="1" class="tl-num" style="width:40px;" />
        </div>

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
