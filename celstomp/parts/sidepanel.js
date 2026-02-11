document.getElementById('part-sidepanel').innerHTML = `
  <div id="islandSidePanel" class="islandSidePanel" aria-hidden="true">
    <div class="islandSideHeader">Side Panel</div>
      <div class="islandSideBody" id="islandSideBody">
        <section id="toolSettingsSection" class="sideSection" hidden>
          <div class="sideSectionHead">
            <div id="toolSettingsTitle" class="sideSectionTitle">Brushes</div>
          </div>

          <section class="toolFold" data-fold="brushes">
            <button id="toolFoldBrushesBtn" class="toolFoldBtn" type="button" aria-expanded="true" aria-controls="toolFoldBrushesBody">Brushes</button>
            <div id="toolFoldBrushesBody" class="toolFoldBody">
              <div id="brushShapeSeg" class="brushShapeSeg" role="radiogroup" aria-label="Brush shape selector"></div>
            </div>
          </section>

          <section class="toolFold" data-fold="settings">
            <button id="toolFoldSettingsBtn" class="toolFoldBtn" type="button" aria-expanded="true" aria-controls="toolFoldSettingsBody">Brush Settings</button>
            <div id="toolFoldSettingsBody" class="toolFoldBody">
              <label class="sideRangeRow" for="brushSizeRange">
                <span>Size</span>
                <div class="sideRangeControls">
                  <input id="brushSizeRange" type="range" min="1" max="400" step="1" value="3" />
                  <input id="brushSizeNum" type="number" min="1" max="400" step="1" value="3" inputmode="numeric" />
                </div>
              </label>

              <label class="sideRangeRow" for="toolOpacityRange">
                <span>Opacity</span>
                <div class="sideRangeControls sideRangeSolo">
                  <input id="toolOpacityRange" type="range" min="1" max="100" step="1" value="100" />
                </div>
              </label>

              <label class="sideRangeRow" for="toolAngleRange">
                <span>Angle</span>
                <div class="sideRangeControls sideRangeSolo">
                  <input id="toolAngleRange" type="range" min="-90" max="90" step="1" value="0" />
                </div>
              </label>
            </div>
          </section>

          <div id="brushShapeTooltip" class="brushShapeTooltip" hidden></div>

          <input id="eraserSize" type="hidden" value="100" />
        </section>

        <div class="islandSideGrid">
          <button id="fillCurrent">Fill current cel</button>
          <button id="fillAll">Fill all cels</button>

        <label class="chip"><input id="autofillToggle" type="checkbox" unchecked /> Autofill on draw</label>
        <label class="chip"><input id="trianglePickerToggle" type="checkbox" /> Triangle Picker</label>

        <div class="layerControls">
          <button id="soloLayerBtn" class="miniBtn" title="Solo Layer">Solo</button>
          <button id="showAllLayersBtn" class="miniBtn" title="Show All">All</button>
        </div>

        <button id="fitView" title="Reset size &amp; recenter">Recenter Canvas</button>

        <div class="paletteControls">
          <button id="addPaletteColor" class="miniBtn">Add Color</button>
          <button id="newPaletteBtn" class="miniBtn">New</button>
          <button id="exportPaletteBtn" class="miniBtn">Export</button>
          <button id="importPaletteBtn" class="miniBtn">Import</button>
        </div>

      </div>

      <div id="paletteBar" class="paletteBar" aria-label="Saved colors"></div>
    </div>
  </div>
`;
