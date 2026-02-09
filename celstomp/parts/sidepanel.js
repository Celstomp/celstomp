document.getElementById('part-sidepanel').innerHTML = `
  <div id="islandSidePanel" class="islandSidePanel" aria-hidden="true">
    <div class="islandSideHeader">Side Panel</div>
    <div class="islandSideBody" id="islandSideBody">
      <div class="islandSideGrid">
        <button id="saveProj">Save</button>
        <button id="loadProj">Load</button>
        <button id="restoreAutosave" title="Restore latest autosaved draft" disabled>Restore Draft</button>
        <div id="saveStateBadge" class="saveStateBadge" role="status" aria-live="polite">Saved</div>
        <button id="pickColorTool">Pick Color Tool</button>
        <button id="addPaletteColor">Add Color</button>
        <button id="fillCurrent">Fill current cel</button>
        <button id="fillAll">Fill all cels</button>
        <button id="clearAllBtn" type="button" class="danger">Clear All</button>

        <label class="chip"><input id="autofillToggle" type="checkbox" unchecked /> Autofill on draw</label>

        <div class="layerControls">
          <button id="soloLayerBtn" class="miniBtn" title="Solo Layer">Solo</button>
          <button id="showAllLayersBtn" class="miniBtn" title="Show All">All</button>
        </div>

        <label class="sideSelectRow" for="stabilizationLevel">
          <span>Stabilization Level</span>
          <select id="stabilizationLevel">
            <option value="0">0</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5" selected>5</option>
            <option value="6">6</option>
            <option value="7">7</option>
            <option value="8">8</option>
            <option value="9">9</option>
            <option value="10">10</option>
          </select>
        </label>

        <div id="penControls" hidden>
          <label class="sideSelectRow" for="pressureSize">
            <span>Pen Pressure Size</span>
            <input id="pressureSize" type="checkbox" checked />
          </label>
          <label class="sideSelectRow" for="pressureOpacity">
            <span>Pen Pressure Opacity</span>
            <input id="pressureOpacity" type="checkbox" />
          </label>
          <label class="sideSelectRow" for="pressureTilt">
            <span>Pen Tilt</span>
            <input id="pressureTilt" type="checkbox" />
          </label>
        </div>

        <button id="fitView" title="Reset size &amp; recenter">Recenter Canvas</button>
        <button id="exportMP4">Export MP4 </button>
        <button id="exportImgSeqBtn" class="button">Export Img Seq </button>

        <div class="paletteControls">
          <button id="newPaletteBtn" class="miniBtn">New Palette</button>
          <button id="exportPaletteBtn" class="miniBtn">Export</button>
          <button id="importPaletteBtn" class="miniBtn">Import</button>
        </div>

      </div>

      <div id="paletteBar" class="paletteBar" aria-label="Saved colors"></div>
    </div>
  </div>
`;
