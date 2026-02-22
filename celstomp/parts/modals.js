document.getElementById('part-modals').innerHTML = `
  <div id="hiddenToggles" style="display:none">
    <button id="toggleOnion" type="button">Onion: Off</button>
    <label><input id="tlTransparency" type="checkbox"> Trans</label>
  </div>

  <input id="loadFileInp" type="file" accept=".json,application/json"
    style="position:fixed; left:-9999px; width:1px; height:1px; opacity:0;" />

  <div id="homeModalBackdrop" class="modalBackdrop" hidden></div>
  <div id="homeModal" class="modalCard homeModal" role="dialog" aria-modal="true" aria-labelledby="homeModalTitle" hidden>
    <div id="homeDraftBanner" class="homeDraftBanner" hidden>
      Draft available. You can restore it now.
    </div>
    <h3 id="homeModalTitle">Welcome to Celstomp</h3>
    <p>Start by creating a project or loading one from disk.</p>
    <label class="sideSelectRow" for="createAspectSelect">
      <span>Canvas Aspect</span>
      <select id="createAspectSelect">
        <option value="16:9">16:9 (1920x1080)</option>
        <option value="4:3">4:3 (1600x1200)</option>
        <option value="3:2">3:2 (1800x1200)</option>
        <option value="2:3">2:3 (1200x1800)</option>
        <option value="1:1">1:1 (1200x1200)</option>
        <option value="9:16">9:16 (1080x1920)</option>
      </select>
    </label>
    <div class="modalActions homeActions">
      <button id="homeNewProjectBtn" type="button">New Project</button>
      <button id="homeOpenProjectBtn" type="button">Open Project</button>
      <button id="homeRestoreDraftBtn" type="button" disabled>Restore Draft</button>
    </div>
    <div class="homeRecentHead">Recent Projects</div>
    <div id="homeRecentList" class="homeRecentList" aria-live="polite"></div>
  </div>

  <div id="mobileGateBackdrop" class="modalBackdrop" hidden></div>
  <div id="mobileGateModal" class="modalCard mobileGateCard" role="dialog" aria-modal="true" aria-labelledby="mobileGateTitle" aria-describedby="mobileGateBody" hidden>
    <h3 id="mobileGateTitle">Use desktop or tablet for the best experience</h3>
    <p id="mobileGateBody">This app works best on desktop and iPads/tablets. Some features may not work well on phones.</p>
    <div class="modalActions">
      <button id="mobileGateBackBtn" type="button" class="mobileGateSecondary">Go back</button>
      <button id="mobileGateContinueBtn" type="button">Continue anyway</button>
    </div>
  </div>

  <div id="shortcutsModalBackdrop" class="modalBackdrop" hidden></div>
  <div id="shortcutsModal" class="modalCard" role="dialog" aria-modal="true" aria-labelledby="shortcutsModalTitle" hidden>
    <h3 id="shortcutsModalTitle">Keyboard Shortcuts</h3>
    <div class="shortcutsGrid">
      <div class="shortcutSection">
        <h4>Tools</h4>
        <div class="shortcutRow"><kbd>1</kbd><span>Brush</span></div>
        <div class="shortcutRow"><kbd>2</kbd><span>Eraser</span></div>
        <div class="shortcutRow"><kbd>3</kbd><span>Line</span></div>
        <div class="shortcutRow"><kbd>4</kbd><span>Fill Brush</span></div>
        <div class="shortcutRow"><kbd>5</kbd><span>Fill Eraser</span></div>
        <div class="shortcutRow"><kbd>6</kbd><span>Lasso Fill</span></div>
        <div class="shortcutRow"><kbd>7</kbd><span>Lasso Erase</span></div>
        <div class="shortcutRow"><kbd>8</kbd><span>Rect Select</span></div>
        <div class="shortcutRow"><kbd>9</kbd><span>Eyedropper</span></div>
      </div>
      <div class="shortcutSection">
        <h4>Navigation</h4>
        <div class="shortcutRow"><kbd>←</kbd><span>Prev Frame</span></div>
        <div class="shortcutRow"><kbd>→</kbd><span>Next Frame</span></div>
        <div class="shortcutRow"><kbd>↑</kbd><span>Next Cel</span></div>
        <div class="shortcutRow"><kbd>↓</kbd><span>Prev Cel</span></div>
        <div class="shortcutRow"><kbd>Q</kbd><span>Prev Cel</span></div>
        <div class="shortcutRow"><kbd>W</kbd><span>Next Cel</span></div>
        <div class="shortcutRow"><kbd>E</kbd><span>Prev Frame</span></div>
        <div class="shortcutRow"><kbd>R</kbd><span>Next Frame</span></div>
      </div>
      <div class="shortcutSection">
        <h4>Selection</h4>
        <div class="shortcutRow"><kbd>H</kbd><span>Flip Horizontal</span></div>
        <div class="shortcutRow"><kbd>V</kbd><span>Flip Vertical</span></div>
        <div class="shortcutRow"><kbd>Del</kbd><span>Delete Selection</span></div>
      </div>
      <div class="shortcutSection">
        <h4>Actions</h4>
        <div class="shortcutRow"><kbd>Space</kbd><span>Play/Pause</span></div>
        <div class="shortcutRow"><kbd>Ctrl+Z</kbd><span>Undo</span></div>
        <div class="shortcutRow"><kbd>Ctrl+Y</kbd><span>Redo</span></div>
        <div class="shortcutRow"><kbd>Ctrl+Shift+Z</kbd><span>Redo</span></div>
        <div class="shortcutRow"><kbd>F</kbd><span>Fill Current Frame</span></div>
        <div class="shortcutRow"><kbd>O</kbd><span>Toggle Onion</span></div>
      </div>
      <div class="shortcutSection">
        <h4>Brush</h4>
        <div class="shortcutRow"><kbd>[</kbd><span>Decrease Size</span></div>
        <div class="shortcutRow"><kbd>]</kbd><span>Increase Size</span></div>
        <div class="shortcutRow"><kbd>Shift + Draw</kbd><span>Straight Line</span></div>
      </div>
      <div class="shortcutSection">
        <h4>Help</h4>
        <div class="shortcutRow"><kbd>?</kbd><span>Toggle This Panel</span></div>
      </div>
    </div>
    <div class="modalActions">
      <button id="tutorialReplayBtn" type="button">Replay Tutorial</button>
      <button id="shortcutsCloseBtn" type="button">Close</button>
    </div>
  </div>

  <div id="tutorialModalBackdrop" class="modalBackdrop" hidden></div>
  <div id="tutorialHighlight" aria-hidden="true" hidden></div>
  <div id="tutorialModal" class="modalCard tutorialCard" role="dialog" aria-modal="true" aria-labelledby="tutorialStepTitle" hidden>
    <h3 id="tutorialStepTitle">Welcome to Celstomp</h3>
    <p id="tutorialStepBody">This short tour highlights the essentials so you can animate quickly.</p>
    <p id="tutorialStepCounter" class="tutorialStepCounter">1 / 5</p>
    <p id="tutorialStepHint" class="tutorialStepHint"></p>
    <div class="modalActions">
      <button id="tutorialBackBtn" type="button">Back</button>
      <button id="tutorialSkipBtn" type="button">Skip</button>
      <button id="tutorialNextBtn" type="button">Next</button>
    </div>
  </div>

  <div id="onionOptionsStash" aria-hidden="true">
    <div id="onionOptionsBlock">
      <div class="subhead">Onion Options</div>

      <div class="row">
        <label for="onionPrevColor">Prev tint</label>
        <input id="onionPrevColor" type="color" value="#4080ff" />
      </div>

      <div class="row">
        <label for="onionNextColor">Next tint</label>
        <input id="onionNextColor" type="color" value="#40ff78" />
      </div>

      <div class="rangeRow">
        <label for="onionAlpha">Opacity</label>
        <input id="onionAlpha" min="5" max="80" type="range" value="50" />
        <span class="val" id="onionAlphaVal">50</span>%
      </div>

      <div class="row">
        <label for="onionBlendMode">Blend</label>
        <select id="onionBlendMode">
          <option value="normal" selected>Normal</option>
          <option value="multiply">Multiply</option>
          <option value="overlay">Overlay</option>
        </select>
      </div>

      <div class="row">
        <label class="chip"><input id="keepOnionPlaying" type="checkbox" /> Keep onion on play</label>
        <label class="chip"><input id="keepTransPlaying" type="checkbox" /> Keep transparency on play</label>
      </div>

      <button id="toggleTransparency">Transparency: Off</button>
    </div>
  </div>

  <div id="onionCtxMenu" aria-hidden="true"></div>

  <div id="clearAllModalBackdrop" class="modalBackdrop" hidden></div>
  <div id="clearAllModal" class="modalCard" role="dialog" aria-modal="true" aria-labelledby="clearAllModalTitle" hidden>
    <h3 id="clearAllModalTitle">Clear All</h3>
    <p>This will clear all frames and layers and reset undo history.</p>
    <div class="modalActions">
      <button id="clearAllCancelBtn" type="button">Cancel</button>
      <button id="clearAllConfirmBtn" type="button" class="danger">Clear</button>
    </div>
  </div>

  <div id="exportImgSeqModalBackdrop" class="modalBackdrop" hidden></div>
  <div id="exportImgSeqModal" class="modalCard" role="dialog" aria-modal="true" aria-labelledby="exportImgSeqModalTitle" hidden>
    <h3 id="exportImgSeqModalTitle">Export Image Sequence</h3>
    <p>PNG image sequence export settings.</p>
    <label class="chip"><input id="exportImgSeqTransparency" type="checkbox" /> Enable transparency</label>
    <div class="modalActions">
      <button id="exportImgSeqCancelBtn" type="button">Cancel</button>
      <button id="exportImgSeqConfirmBtn" type="button">Export</button>
    </div>
  </div>

  <div id="exportGifModalBackdrop" class="modalBackdrop" hidden></div>
  <div id="exportGifModal" class="modalCard" role="dialog" aria-modal="true" aria-labelledby="exportGifModalTitle" hidden>
    <h3 id="exportGifModalTitle">Export GIF</h3>
    <p>Animated GIF export settings.</p>
    <label class="sideSelectRow" for="exportGifFps">
      <span>FPS</span>
      <input id="exportGifFps" type="number" min="1" max="60" step="1" value="12" inputmode="numeric" />
    </label>
    <label class="sideSelectRow" for="exportGifQuality">
      <span>Quality</span>
      <select id="exportGifQuality">
        <option value="high" selected>High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
    </label>
    <label class="sideSelectRow" for="exportGifScale">
      <span>Scale</span>
      <select id="exportGifScale">
        <option value="1" selected>100%</option>
        <option value="0.75">75%</option>
        <option value="0.5">50%</option>
      </select>
    </label>
    <label class="sideSelectRow" for="exportGifFrameStep">
      <span>Frame step</span>
      <select id="exportGifFrameStep">
        <option value="1" selected>1 (All)</option>
        <option value="2">2</option>
        <option value="3">3</option>
      </select>
    </label>
    <label class="chip"><input id="exportGifTransparency" type="checkbox" /> Enable transparency</label>
    <label class="chip"><input id="exportGifLoop" type="checkbox" checked /> Loop animation</label>
    <div class="modalActions">
      <button id="exportGifCancelBtn" type="button">Cancel</button>
      <button id="exportGifConfirmBtn" type="button">Export</button>
    </div>
  </div>

  <div id="autosaveIntervalModalBackdrop" class="modalBackdrop" hidden></div>
  <div id="autosaveIntervalModal" class="modalCard" role="dialog" aria-modal="true" aria-labelledby="autosaveIntervalModalTitle" hidden>
    <h3 id="autosaveIntervalModalTitle">Autosave Interval</h3>
    <p>Set autosave interval in minutes.</p>
    <label class="sideSelectRow" for="autosaveIntervalMinutesInput">
      <span>Minutes</span>
      <input id="autosaveIntervalMinutesInput" type="number" min="1" max="120" step="1" value="1" inputmode="numeric" />
    </label>
    <div class="modalActions">
      <button id="autosaveIntervalCancelBtn" type="button">Cancel</button>
      <button id="autosaveIntervalConfirmBtn" type="button">Apply</button>
    </div>
  </div>
`;
