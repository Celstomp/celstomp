(function () {
    'use strict';

    const tools = [
        { id: 'tool-brush', val: 'brush', label: 'Brush', checked: true },
        { id: 'tool-eraser', val: 'eraser', label: 'Eraser' },
        { id: 'tool-fillbrush', val: 'fill-brush', label: 'Fill Brush' },
        { id: 'tool-filleraser', val: 'fill-eraser', label: 'Eraser Fill' },
        { id: 'tool-lassoFill', val: 'lasso-fill', label: 'Lasso Fill' },
        { id: 'tool-lassoErase', val: 'lasso-erase', label: 'Lasso Erase' },
        { id: 'tool-rectSelect', val: 'rect-select', label: 'Rect Select' },
        { id: 'tool-eyedropper', val: 'eyedropper', label: 'Eyedropper' }
    ];

    const toolContainer = document.getElementById('toolSeg');
    if (toolContainer) {
        const frag = document.createDocumentFragment();
        tools.forEach(t => {
            const inp = document.createElement('input');
            inp.type = 'radio';
            inp.name = 'tool';
            inp.id = t.id;
            inp.value = t.val;
            inp.dataset.tool = t.val;
            if (t.checked) inp.checked = true;

            const lbl = document.createElement('label');
            lbl.htmlFor = t.id;
            lbl.dataset.tool = t.val;
            lbl.textContent = t.label;

            if (t.val === 'brush') lbl.id = 'toolBrushLabel';
            if (t.val === 'eraser') lbl.id = 'toolEraserLabel';

            frag.appendChild(inp);
            frag.appendChild(lbl);
        });
        toolContainer.replaceChildren(frag);
    }

    const brushes = [
        { id: 'shape-circle', val: 'circle', label: 'Circle', checked: true },
        { id: 'shape-square', val: 'square', label: 'Square' },
        { id: 'shape-diamond', val: 'diamond', label: 'Diamond' },
        { id: 'shape-oval-h', val: 'oval-h', label: 'Horizontal oval' },
        { id: 'shape-oval-v', val: 'oval-v', label: 'Vertical oval' },
        { id: 'shape-rect-h', val: 'rect-h', label: 'Rectangle horizontal' },
        { id: 'shape-rect-v', val: 'rect-v', label: 'Rectangle vertical' },
        { id: 'shape-triangle', val: 'triangle', label: 'Triangle' }
    ];
    const brushesContainer = document.getElementById('brushShapeSeg');
    if (brushesContainer) {
        const frag = document.createDocumentFragment();
        brushes.forEach(t => {
            const inp = document.createElement('input');
            inp.type = 'radio';
            inp.name = 'brushShape';
            inp.id = t.id;
            inp.value = t.val;
            inp.dataset.brushShape = t.val;
            if (t.checked) inp.checked = true;

            const lbl = document.createElement('label');
            lbl.htmlFor = t.id;
            lbl.dataset.brushShape = t.val;
            lbl.setAttribute('aria-label', t.label);
            lbl.textContent = '';

            frag.appendChild(inp);
            frag.appendChild(lbl);
        });
        brushesContainer.replaceChildren(frag);
    }

    const layers = [
        { id: 'bt-sketch-layer', val: 'sketch', label: 'SKETCH', swatchId: 'swatches-sketch' },
        { id: 'bt-line', val: 'line', label: 'LINE', swatchId: 'swatches-line', checked: true },
        { id: 'bt-color', val: 'shade', label: 'SHADE', swatchId: 'swatches-shade' },
        { id: 'bt-sketch', val: 'color', label: 'COLOR', swatchId: 'swatches-color' },
        { id: 'bt-fill', val: 'fill', label: 'FILL', swatchId: 'swatches-fill' },
        { id: 'bt-paper', val: 'paper', label: 'PAPER', swatchId: 'swatches-paper' }
    ];

    const layerContainer = document.getElementById('layerSeg');
    if (layerContainer) {
        const frag = document.createDocumentFragment();
        layers.forEach(l => {
            const inp = document.createElement('input');
            inp.type = 'radio';
            inp.name = 'btype';
            inp.id = l.id;
            inp.value = l.val;
            if (l.checked) inp.checked = true;

            const lbl = document.createElement('label');
            lbl.htmlFor = l.id;

            const spanName = document.createElement('span');
            spanName.className = 'layerName';
            spanName.textContent = l.label;

            const spanSwatch = document.createElement('span');
            spanSwatch.className = 'layerSwatches';
            spanSwatch.id = l.swatchId;

            lbl.appendChild(spanName);
            lbl.appendChild(spanSwatch);

            frag.appendChild(inp);
            frag.appendChild(lbl);
        });
        layerContainer.replaceChildren(frag);
    }

})();
