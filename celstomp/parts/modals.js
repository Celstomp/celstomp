document.getElementById('part-modals').innerHTML = `
  <div id="hiddenToggles" style="display:none">
    <button id="toggleOnion" type="button">Onion: Off</button>
    <label><input id="tlTransparency" type="checkbox"> Trans</label>
  </div>

  <input id="loadFileInp" type="file" accept=".json,application/json"
    style="position:fixed; left:-9999px; width:1px; height:1px; opacity:0;" />

  <div id="shortcutsModalBackdrop" class="modalBackdrop" hidden></div>
  <div id="shortcutsModal" class="modalCard" role="dialog" aria-modal="true" aria-labelledby="shortcutsModalTitle" hidden>
    <h3 id="shortcutsModalTitle">Keyboard Shortcuts</h3>
    <div class="shortcutsGrid">
      <div class="shortcutSection">
        <h4>Tools</h4>
        <div class="shortcutRow"><kbd>1</kbd><span>Brush</span></div>
        <div class="shortcutRow"><kbd>2</kbd><span>Eraser</span></div>
        <div class="shortcutRow"><kbd>3</kbd><span>Fill Brush</span></div>
        <div class="shortcutRow"><kbd>4</kbd><span>Fill Eraser</span></div>
        <div class="shortcutRow"><kbd>5</kbd><span>Lasso Fill</span></div>
        <div class="shortcutRow"><kbd>6</kbd><span>Lasso Erase</span></div>
        <div class="shortcutRow"><kbd>7</kbd><span>Rect Select</span></div>
        <div class="shortcutRow"><kbd>8</kbd><span>Eyedropper</span></div>
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
        <h4>Actions</h4>
        <div class="shortcutRow"><kbd>Space</kbd><span>Play/Pause</span></div>
        <div class="shortcutRow"><kbd>Ctrl+Z</kbd><span>Undo</span></div>
        <div class="shortcutRow"><kbd>Ctrl+Y</kbd><span>Redo</span></div>
        <div class="shortcutRow"><kbd>Ctrl+Shift+Z</kbd><span>Redo</span></div>
        <div class="shortcutRow"><kbd>Del</kbd><span>Delete Selection/Color</span></div>
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
      <button id="shortcutsCloseBtn" type="button">Close</button>
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
`;
