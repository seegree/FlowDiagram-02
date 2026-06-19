#target aftereffects
#targetengine "flowDiagramPanel"

(function flowDiagramPanel(thisObj) {
    var SCRIPT_NAME = "Flow Diagram";
    var NODE_TAG = "Flow Diagram Node";
    var TEXT_TAG = "Flow Diagram Text";
    var MEASURE_TAG = "Flow Diagram Measure";
    var CONNECTOR_TAG = "Flow Diagram Connector";
    var THEME_TAG = "Flow Diagram Theme";
    var THEME_LAYER_NAME = "FD Theme";

    var MAX_TEXT_WIDTH = 200;
    var H_PADDING = 24;
    var V_PADDING = 16;
    var MIN_NODE_WIDTH = 96;
    var MIN_NODE_HEIGHT = 64;
    var DEFAULT_STROKE_WIDTH = 6;
    var DEFAULT_HEAD_SIZE = 24;
    var DEFAULT_DURATION = 1;
    var DEFAULT_CONNECTOR_COLOR = [0.35, 0.75, 1];
    var DEFAULT_NODE_FILL = [0.10, 0.15, 0.23];
    var DEFAULT_NODE_STROKE = [0.35, 0.65, 0.90];
    var DEFAULT_TEXT_COLOR = [1, 1, 1];

    var THEME_PRESETS = [
        {
            name: "Simulink Classic",
            nodeFill: [1, 1, 1],
            nodeStroke: [0, 0, 0],
            connectorColor: [0, 0, 0],
            textColor: [0, 0, 0],
            shadowOpacity: 75
        },
        {
            name: "Simulink Modern",
            nodeFill: [1, 1, 1],
            nodeStroke: [0, 0, 0],
            connectorColor: [0, 0, 0],
            textColor: [0, 0, 0],
            shadowOpacity: 0
        },
        {
            name: "Stylized",
            nodeFill: DEFAULT_NODE_FILL,
            nodeStroke: DEFAULT_NODE_STROKE,
            connectorColor: DEFAULT_CONNECTOR_COLOR,
            textColor: DEFAULT_TEXT_COLOR,
            shadowOpacity: 0
        }
    ];

    var SETTINGS_SECTION = "Flow Diagram";
    var ROUTE_ITEMS = ["Straight", "Orthogonal"];
    var SIDE_ITEMS = ["Auto", "Top", "Right", "Bottom", "Left", "Center"];
    var ARROWHEAD_ITEMS = ["On", "Off"];

    var selectedColor = readColorSetting(
        "connectorColor",
        DEFAULT_CONNECTOR_COLOR
    );
    var selectedColorIsMixed = false;
    var selectedNodeFill = readColorSetting("nodeFill", DEFAULT_NODE_FILL);
    var selectedNodeStroke = readColorSetting(
        "nodeStroke",
        DEFAULT_NODE_STROKE
    );
    var isSyncingControls = false;
    var trackedNodeOrder = [];
    var previousNodeIds = [];
    var nodeCreationCount = 0;
    var ui = null;

    function buildUI(host) {
        var panel = (host instanceof Panel)
            ? host
            : new Window("palette", SCRIPT_NAME, undefined, { resizeable: true });

        panel.orientation = "column";
        panel.alignChildren = ["fill", "top"];
        panel.spacing = 5;
        panel.margins = 8;

        var nodePanel = panel.add("panel", undefined, "Nodes");
        nodePanel.orientation = "column";
        nodePanel.alignChildren = ["fill", "top"];
        nodePanel.spacing = 4;
        nodePanel.margins = 7;

        var nodeButtons = nodePanel.add("group");
        nodeButtons.orientation = "row";
        nodeButtons.alignChildren = ["center", "center"];
        nodeButtons.spacing = 2;
        var roundedButton = addNodeIconButton(nodeButtons, "rounded", "Rounded");
        var rectangleButton = addNodeIconButton(
            nodeButtons,
            "rectangle",
            "Rectangle"
        );
        var squareButton = addNodeIconButton(nodeButtons, "square", "Square");
        var circleButton = addNodeIconButton(nodeButtons, "circle", "Circle");
        var diamondButton = addNodeIconButton(nodeButtons, "diamond", "Diamond");
        var triangleButton = addNodeIconButton(
            nodeButtons,
            "triangle",
            "Triangle"
        );
        var hexagonButton = addNodeIconButton(nodeButtons, "hexagon", "Hexagon");
        var dotButton = addNodeIconButton(nodeButtons, "dot", "Dot");

        var nodeFillRow = addColorRow(
            nodePanel,
            "Fill",
            selectedNodeFill,
            "Choose node fill color"
        );
        var nodeStrokeRow = addColorRow(
            nodePanel,
            "Border",
            selectedNodeStroke,
            "Choose node border color"
        );

        var connectorPanel = panel.add("panel", undefined, "Connector");
        connectorPanel.orientation = "column";
        connectorPanel.alignChildren = ["fill", "top"];
        connectorPanel.spacing = 4;
        connectorPanel.margins = 7;

        var typeRow = addDropdownRow(
            connectorPanel,
            "Route",
            ROUTE_ITEMS,
            settingDropdownIndex("route", ROUTE_ITEMS, 1)
        );
        var startSideRow = addDropdownRow(
            connectorPanel,
            "Start side",
            SIDE_ITEMS,
            settingDropdownIndex("startSide", SIDE_ITEMS, 0)
        );
        var endSideRow = addDropdownRow(
            connectorPanel,
            "End side",
            SIDE_ITEMS,
            settingDropdownIndex("endSide", SIDE_ITEMS, 0)
        );
        var startOffsetRow = addNumberRow(
            connectorPanel,
            "Start offset %",
            readOffsetSetting("startOffset", 0)
        );
        startOffsetRow.input.helpTip =
            "Slide the start point along its side, -50 to 50";
        var endOffsetRow = addNumberRow(
            connectorPanel,
            "End offset %",
            readOffsetSetting("endOffset", 0)
        );
        endOffsetRow.input.helpTip =
            "Slide the end point along its side, -50 to 50";
        var strokeRow = addNumberRow(
            connectorPanel,
            "Stroke width",
            readNumberSetting("strokeWidth", DEFAULT_STROKE_WIDTH)
        );
        var headRow = addNumberRow(
            connectorPanel,
            "Arrowhead size",
            readNumberSetting("headSize", DEFAULT_HEAD_SIZE)
        );
        var arrowheadRow = addDropdownRow(
            connectorPanel,
            "Arrowhead",
            ARROWHEAD_ITEMS,
            settingDropdownIndex("arrowhead", ARROWHEAD_ITEMS, 0)
        );
        var durationRow = addNumberRow(
            connectorPanel,
            "Duration (seconds)",
            readNumberSetting("duration", DEFAULT_DURATION)
        );
        var colorRow = connectorPanel.add("group");
        colorRow.orientation = "row";
        colorRow.alignChildren = ["left", "center"];
        var colorLabel = colorRow.add("statictext", undefined, "Color");
        colorLabel.preferredSize.width = 88;
        var colorButton = colorRow.add("button", undefined, "");
        colorButton.preferredSize = [38, 20];
        colorButton.helpTip = "Choose connector color";
        var colorValue = colorRow.add("statictext", undefined, rgbToHex(selectedColor));
        colorValue.characters = 7;
        var refreshButton = colorRow.add("button", undefined, "\u21BB");
        refreshButton.preferredSize = [22, 20];
        refreshButton.minimumSize = [22, 20];
        refreshButton.maximumSize = [22, 20];
        refreshButton.helpTip = "Load settings from selected connectors";

        colorButton.onDraw = function () {
            var graphics = this.graphics;
            graphics.drawOSControl();
            if (selectedColorIsMixed) {
                drawMixedSwatch(graphics, this.size[0], this.size[1]);
            } else {
                graphics.rectPath(4, 4, this.size[0] - 8, this.size[1] - 8);
                graphics.fillPath(
                    graphics.newBrush(graphics.BrushType.SOLID_COLOR, selectedColor)
                );
            }
            graphics.rectPath(4, 4, this.size[0] - 8, this.size[1] - 8);
            graphics.strokePath(
                graphics.newPen(
                    graphics.PenType.SOLID_COLOR,
                    [0.25, 0.25, 0.25],
                    1
                )
            );
        };

        var themePanel = panel.add("panel", undefined, "Theme");
        themePanel.orientation = "row";
        themePanel.alignChildren = ["left", "center"];
        themePanel.spacing = 4;
        themePanel.margins = 7;
        var presetNames = themePresetNames();
        var presetDropdown = themePanel.add(
            "dropdownlist",
            undefined,
            presetNames
        );
        presetDropdown.selection = settingDropdownIndex(
            "themePreset",
            presetNames,
            presetNames.length - 1
        );
        presetDropdown.preferredSize.width = 140;
        var applyPresetButton = themePanel.add("button", undefined, "Apply");
        applyPresetButton.helpTip =
            "Apply the preset palette to this comp's FD Theme layer";

        var connectButton = panel.add("button", undefined, "Connect");
        connectButton.alignment = ["fill", "top"];
        connectButton.preferredSize.height = 28;
        connectButton.helpTip =
            "Connect selected nodes; Option/Alt-click connects every unique pair";
        var actionRow = panel.add("group");
        actionRow.orientation = "row";
        actionRow.alignment = ["fill", "top"];
        actionRow.alignChildren = ["fill", "center"];
        var reverseButton = actionRow.add("button", undefined, "Reverse");
        reverseButton.helpTip = "Reverse selected connector directions";
        var themeButton = actionRow.add("button", undefined, "Use Theme");
        themeButton.helpTip =
            "Re-link selected nodes and connectors to the FD Theme layer";
        var bakeButton = actionRow.add("button", undefined, "Bake");
        bakeButton.helpTip =
            "Freeze expressions on selected generated layers " +
            "(all generated layers if none are selected)";
        var importButton = panel.add("button", undefined, "Import .slx");
        importButton.alignment = ["fill", "top"];
        importButton.helpTip =
            "Build a flow diagram from a Simulink .slx model";

        ui = {
            type: typeRow.input,
            startSide: startSideRow.input,
            endSide: endSideRow.input,
            startOffset: startOffsetRow.input,
            endOffset: endOffsetRow.input,
            stroke: strokeRow.input,
            head: headRow.input,
            arrowhead: arrowheadRow.input,
            duration: durationRow.input,
            colorButton: colorButton,
            colorValue: colorValue,
            nodeFillRow: nodeFillRow,
            nodeStrokeRow: nodeStrokeRow
        };

        applyPresetButton.onClick = function () {
            if (presetDropdown.selection === null) {
                return;
            }
            applyThemePreset(THEME_PRESETS[presetDropdown.selection.index]);
        };

        roundedButton.onClick = function () {
            createNode("rounded", !isAltDown());
        };
        rectangleButton.onClick = function () {
            createNode("rectangle", !isAltDown());
        };
        squareButton.onClick = function () {
            createNode("square", !isAltDown());
        };
        circleButton.onClick = function () {
            createNode("circle", !isAltDown());
        };
        diamondButton.onClick = function () {
            createNode("diamond", !isAltDown());
        };
        triangleButton.onClick = function () {
            createNode("triangle", !isAltDown());
        };
        hexagonButton.onClick = function () {
            createNode("hexagon", !isAltDown());
        };
        dotButton.onClick = function () {
            createNode("dot", true);
        };

        nodeFillRow.button.onClick = function () {
            var picked = $.colorPicker();
            if (picked >= 0) {
                selectedNodeFill = integerToRgb(picked);
                nodeFillRow.setColor(selectedNodeFill);
                saveColorSetting("nodeFill", selectedNodeFill);
                applyNodeColorChoice({ fill: selectedNodeFill });
            }
        };
        nodeStrokeRow.button.onClick = function () {
            var picked = $.colorPicker();
            if (picked >= 0) {
                selectedNodeStroke = integerToRgb(picked);
                nodeStrokeRow.setColor(selectedNodeStroke);
                saveColorSetting("nodeStroke", selectedNodeStroke);
                applyNodeColorChoice({ stroke: selectedNodeStroke });
            }
        };

        colorButton.onClick = function () {
            var picked = $.colorPicker();
            if (picked >= 0) {
                selectedColor = integerToRgb(picked);
                selectedColorIsMixed = false;
                colorValue.text = rgbToHex(selectedColor);
                colorButton.notify("onDraw");
                saveColorSetting("connectorColor", selectedColor);
                applyConnectorColorChoice(selectedColor);
            }
        };

        startOffsetRow.input.onChange = function () {
            updateOffsetControl(
                startOffsetRow.input,
                "Start offset",
                "startOffset"
            );
        };
        endOffsetRow.input.onChange = function () {
            updateOffsetControl(
                endOffsetRow.input,
                "End offset",
                "endOffset"
            );
        };
        strokeRow.input.onChange = function () {
            updateNumberControl(
                strokeRow.input,
                "Stroke width",
                "strokeWidth"
            );
        };
        headRow.input.onChange = function () {
            updateNumberControl(
                headRow.input,
                "Arrowhead size",
                "headSize"
            );
        };
        durationRow.input.onChange = function () {
            updateNumberControl(
                durationRow.input,
                "Duration",
                "duration"
            );
        };
        typeRow.input.onChange = function () {
            updateDropdownControl(typeRow.input, "route");
        };
        startSideRow.input.onChange = function () {
            updateDropdownControl(startSideRow.input, "startSide");
        };
        endSideRow.input.onChange = function () {
            updateDropdownControl(endSideRow.input, "endSide");
        };
        arrowheadRow.input.onChange = function () {
            updateDropdownControl(arrowheadRow.input, "arrowhead");
        };
        connectButton.onClick = createConnectorFromSelection;
        reverseButton.onClick = reverseSelectedConnectors;
        themeButton.onClick = relinkSelectionToTheme;
        bakeButton.onClick = bakeGeneratedLayers;
        importButton.onClick = importSlxModel;
        // Windows ScriptUI does not reliably repaint custom-drawn controls after
        // a modal dialog closes, so the hand-drawn shape icons and color swatches
        // can stay blank (the Mac repaints them automatically). Force them to
        // redraw whenever the panel reactivates or is manually refreshed.
        var customDrawnControls = [
            roundedButton, rectangleButton, squareButton, circleButton,
            diamondButton, triangleButton, hexagonButton, dotButton,
            colorButton, nodeFillRow.button, nodeStrokeRow.button
        ];
        function redrawCustomControls() {
            for (var ci = 0; ci < customDrawnControls.length; ci += 1) {
                try {
                    customDrawnControls[ci].notify("onDraw");
                } catch (redrawError) {}
            }
        }
        function refreshPanel() {
            redrawCustomControls();
            syncControlsFromSelection();
        }
        refreshButton.onClick = refreshPanel;
        panel.onActivate = refreshPanel;
        // The capture-phase "focus" listener was removed: it re-ran the refresh
        // far too aggressively -- including at moments AE has a modal open (e.g.
        // New Composition), which AE forbids ("Cannot run a script while a modal
        // dialog is waiting"), wedging the panel and blanking its custom-drawn
        // controls. onActivate plus the manual refresh (R) button cover the same
        // need without firing during those modal moments.

        panel.onResizing = panel.onResize = function () {
            this.layout.resize();
        };
        panel.onClose = stopSelectionTracker;

        panel.layout.layout(true);
        startSelectionTracker();
        return panel;
    }

    function addNumberRow(parent, label, defaultValue) {
        var row = parent.add("group");
        row.orientation = "row";
        row.alignChildren = ["left", "center"];
        var labelControl = row.add("statictext", undefined, label);
        labelControl.preferredSize.width = 88;
        var input = row.add("edittext", undefined, String(defaultValue));
        input.characters = 6;
        return { row: row, input: input };
    }

    function addDropdownRow(parent, label, items, selectedIndex) {
        var row = parent.add("group");
        row.orientation = "row";
        row.alignChildren = ["left", "center"];
        var labelControl = row.add("statictext", undefined, label);
        labelControl.preferredSize.width = 88;
        var input = row.add("dropdownlist", undefined, items);
        input.selection = selectedIndex;
        input.preferredSize.width = 104;
        return { row: row, input: input };
    }

    function addColorRow(parent, label, initialColor, helpTip) {
        var currentColor = initialColor;
        var row = parent.add("group");
        row.orientation = "row";
        row.alignChildren = ["left", "center"];
        var labelControl = row.add("statictext", undefined, label);
        labelControl.preferredSize.width = 88;
        var button = row.add("button", undefined, "");
        button.preferredSize = [38, 20];
        button.helpTip = helpTip;
        var value = row.add("statictext", undefined, rgbToHex(currentColor));
        value.characters = 7;

        button.onDraw = function () {
            var graphics = this.graphics;
            graphics.drawOSControl();
            graphics.rectPath(4, 4, this.size[0] - 8, this.size[1] - 8);
            graphics.fillPath(
                graphics.newBrush(graphics.BrushType.SOLID_COLOR, currentColor)
            );
            graphics.rectPath(4, 4, this.size[0] - 8, this.size[1] - 8);
            graphics.strokePath(
                graphics.newPen(
                    graphics.PenType.SOLID_COLOR,
                    [0.25, 0.25, 0.25],
                    1
                )
            );
        };

        return {
            row: row,
            button: button,
            value: value,
            setColor: function (color) {
                currentColor = color;
                value.text = rgbToHex(color);
                button.notify("onDraw");
            }
        };
    }

    function addNodeIconButton(parent, kind, label) {
        var button = parent.add("button", undefined, "");
        button.preferredSize = [26, 24];
        button.minimumSize = [26, 24];
        button.maximumSize = [26, 24];
        button.helpTip = kind === "dot"
            ? label + ": create an unlabeled junction marker"
            : label + ": click for unlabeled; Option/Alt-click for labeled";

        button.onDraw = function () {
            var graphics = this.graphics;
            var width = this.size[0];
            var height = this.size[1];
            var left = 6;
            var top = 5;
            var right = width - 6;
            var bottom = height - 5;
            var centerX = width / 2;
            var centerY = height / 2;
            var pen = graphics.newPen(
                graphics.PenType.SOLID_COLOR,
                [0.82, 0.86, 0.92],
                1.5
            );
            var brush = graphics.newBrush(
                graphics.BrushType.SOLID_COLOR,
                [0.25, 0.48, 0.68]
            );

            graphics.drawOSControl();
            drawNodeIconPath(
                graphics,
                kind,
                left,
                top,
                right,
                bottom,
                centerX,
                centerY
            );
            graphics.fillPath(brush);
            drawNodeIconPath(
                graphics,
                kind,
                left,
                top,
                right,
                bottom,
                centerX,
                centerY
            );
            graphics.strokePath(pen);
        };
        return button;
    }

    function drawNodeIconPath(
        graphics,
        kind,
        left,
        top,
        right,
        bottom,
        centerX,
        centerY
    ) {
        graphics.newPath();
        if (kind === "circle") {
            graphics.ellipsePath(left + 1, top, right - left - 2, bottom - top);
        } else if (kind === "dot") {
            graphics.ellipsePath(centerX - 4, centerY - 4, 8, 8);
        } else if (kind === "rounded") {
            graphics.ellipsePath(
                left,
                top + 2,
                right - left,
                bottom - top - 4
            );
        } else if (kind === "rectangle") {
            graphics.rectPath(left, top + 3, right - left, bottom - top - 6);
        } else if (kind === "square") {
            graphics.rectPath(centerX - 6, centerY - 6, 12, 12);
        } else if (kind === "diamond") {
            drawPolygonPath(graphics, [
                [centerX, top],
                [right, centerY],
                [centerX, bottom],
                [left, centerY]
            ]);
        } else if (kind === "triangle") {
            drawPolygonPath(graphics, [
                [left, top],
                [right, centerY],
                [left, bottom]
            ]);
        } else {
            drawPolygonPath(graphics, [
                [left, centerY],
                [left + 4, top],
                [right - 4, top],
                [right, centerY],
                [right - 4, bottom],
                [left + 4, bottom]
            ]);
        }
    }

    function drawPolygonPath(graphics, points) {
        graphics.moveTo(points[0][0], points[0][1]);
        var i;
        for (i = 1; i < points.length; i += 1) {
            graphics.lineTo(points[i][0], points[i][1]);
        }
        graphics.closePath();
    }

    function updateNumberControl(control, label, propertyName) {
        if (isSyncingControls) {
            return;
        }
        var value = parsePositiveNumber(control.text, label, true);
        if (value !== null) {
            saveSetting(propertyName, value);
            var settings = {};
            settings[propertyName] = value;
            updateSelectedConnectors(settings);
        }
    }

    function updateOffsetControl(control, label, propertyName) {
        if (isSyncingControls) {
            return;
        }
        var value = parseOffsetNumber(control.text, label, true);
        if (value !== null) {
            saveSetting(propertyName, value);
            var settings = {};
            settings[propertyName] = value;
            updateSelectedConnectors(settings);
        }
    }

    function updateDropdownControl(control, propertyName) {
        if (
            isSyncingControls ||
            control.selection === null
        ) {
            return;
        }
        saveSetting(propertyName, control.selection.text);
        var settings = {};
        settings[propertyName] = control.selection.text;
        updateSelectedConnectors(settings);
    }

    function createNode(kind, shapeOnly) {
        var comp = activeComp();
        if (comp === null) {
            alert("Open a composition before creating a node.", SCRIPT_NAME);
            return;
        }

        app.beginUndoGroup("Create Flow Diagram Node");
        try {
            ensureThemeLayer(comp);
            var offset = (nodeCreationCount % 8) * 28;
            var shapeLayer = buildNode(
                comp,
                kind,
                shapeOnly,
                "Node",
                [comp.width / 2 + offset, comp.height / 2 + offset]
            );
            nodeCreationCount += 1;

            deselectAllLayers(comp);
            shapeLayer.selected = true;
            trackedNodeOrder = [shapeLayer];
            previousNodeIds = [layerId(shapeLayer)];
        } catch (error) {
            alert(
                "The node could not be created.\n\n" + error.toString(),
                SCRIPT_NAME
            );
        } finally {
            app.endUndoGroup();
        }
    }

    function buildNode(comp, kind, shapeOnly, labelText, position) {
        var shapeLayer = null;
        var textLayer = null;
        var measureLayer = null;

        try {
            shapeLayer = comp.layers.addShape();
            shapeLayer.name = uniqueLayerName(comp, nodeDisplayName(kind));
            shapeLayer.comment =
                NODE_TAG + "|" + kind + (shapeOnly ? "|shape-only" : "");
            shapeLayer.label = 9;
            var effects = shapeLayer.property("ADBE Effect Parade");
            addSliderControl(effects, "Node Type", nodeKindCode(kind));
            addNodeShadow(effects);

            if (!shapeOnly) {
                textLayer = comp.layers.addBoxText([MAX_TEXT_WIDTH, 80]);
                textLayer.name = uniqueLayerName(comp, shapeLayer.name + " Text");
                textLayer.comment = TEXT_TAG;
                configureNodeText(textLayer, labelText);

                measureLayer = comp.layers.addText(labelText);
                measureLayer.name = uniqueLayerName(
                    comp,
                    shapeLayer.name + " Measure"
                );
                measureLayer.comment = MEASURE_TAG;
                configureMeasureText(measureLayer, textLayer, labelText);

                textLayer.parent = shapeLayer;
                measureLayer.parent = shapeLayer;
                setLayerPosition(textLayer, [0, 0]);
                setLayerPosition(measureLayer, [0, 0]);

                addLayerControl(effects, "Node Text", textLayer);
                addLayerControl(effects, "Text Measure", measureLayer);
            }

            addNodeGeometry(shapeLayer, kind, shapeOnly);
            if (!shapeOnly && kind === "triangle") {
                textLayer.property("ADBE Transform Group")
                    .property("ADBE Position")
                    .expression =
                        "var r = parent.sourceRectAtTime(time, true);\n" +
                        "[-r.width / 6, 0];";
            }

            setLayerPosition(shapeLayer, position);

            if (!shapeOnly) {
                textLayer.moveBefore(shapeLayer);
                measureLayer.moveAfter(textLayer);
            }
            return shapeLayer;
        } catch (error) {
            removeLayerQuietly(measureLayer);
            removeLayerQuietly(textLayer);
            removeLayerQuietly(shapeLayer);
            throw error;
        }
    }

    function configureNodeText(textLayer, labelText) {
        var sourceText = textLayer.property("ADBE Text Properties")
            .property("ADBE Text Document");
        var document = sourceText.value;
        document.text = labelText;
        setArialFont(document);
        document.fontSize = 32;
        document.applyFill = true;
        document.fillColor = DEFAULT_TEXT_COLOR;
        document.applyStroke = false;
        document.justification = ParagraphJustification.CENTER_JUSTIFY;
        document.autoLeading = true;
        try {
            document.boxTextSize = [MAX_TEXT_WIDTH, 80];
            document.boxVerticalAlignment = BoxVerticalAlignment.TOP;
            document.boxAutoFitPolicy = BoxAutoFitPolicy.HEIGHT_PRECISE_BOUNDS;
        } catch (textApiError) {
            // AE 2025 supports these properties; retain the initial box as fallback.
        }
        sourceText.setValue(document);
        sourceText.expression = themeTextExpression();

        var transform = textLayer.property("ADBE Transform Group");
        transform.property("ADBE Anchor Point").expression =
            "var r = sourceRectAtTime(time, false);\n" +
            "[r.left + r.width / 2, r.top + r.height / 2];";
    }

    function configureMeasureText(measureLayer, textLayer, labelText) {
        var sourceText = measureLayer.property("ADBE Text Properties")
            .property("ADBE Text Document");
        var document = sourceText.value;
        document.text = labelText;
        setArialFont(document);
        document.fontSize = 32;
        document.applyFill = true;
        document.fillColor = DEFAULT_TEXT_COLOR;
        document.applyStroke = false;
        sourceText.setValue(document);

        var effects = measureLayer.property("ADBE Effect Parade");
        addLayerControl(effects, "Visible Text", textLayer);
        sourceText.expression =
            "var t = effect(\"Visible Text\")(\"Layer\");\n" +
            "var d = t.text.sourceText;\n" +
            "d.style.setText(d.toString());";
        measureLayer.property("ADBE Transform Group")
            .property("ADBE Opacity")
            .setValue(0);
        measureLayer.shy = true;
        measureLayer.guideLayer = true;
    }

    function addNodeShadow(effects) {
        var shadow = effects.addProperty("ADBE Drop Shadow");
        shadow.name = "Node Shadow";
        shadow.property("ADBE Drop Shadow-0002").expression =
            themeSliderExpression("Shadow Opacity");
        shadow.property("ADBE Drop Shadow-0004").setValue(5);
        shadow.property("ADBE Drop Shadow-0005").setValue(10);
        return shadow;
    }

    function addNodeGeometry(shapeLayer, kind, shapeOnly) {
        var root = shapeLayer.property("ADBE Root Vectors Group");
        var group = root.addProperty("ADBE Vector Group");
        group.name = "Node Geometry";
        var contents = group.property("ADBE Vectors Group");
        var dimensionsExpression = shapeOnly
            ? null
            : nodeDimensionsExpression(kind);
        var dimensions = defaultNodeDimensions(kind);
        var shapeProperty;

        if (
            kind === "rounded" ||
            kind === "rectangle" ||
            kind === "square"
        ) {
            shapeProperty = contents.addProperty("ADBE Vector Shape - Rect");
            shapeProperty.name = "Node Shape";
            if (shapeOnly) {
                shapeProperty.property("ADBE Vector Rect Size").setValue(dimensions);
            } else {
                shapeProperty.property("ADBE Vector Rect Size").expression =
                    dimensionsExpression;
            }
            shapeProperty.property("ADBE Vector Rect Roundness").setValue(
                kind === "rounded" ? 20 : 0
            );
        } else if (kind === "circle" || kind === "dot") {
            shapeProperty = contents.addProperty("ADBE Vector Shape - Ellipse");
            shapeProperty.name = "Node Shape";
            if (shapeOnly) {
                shapeProperty.property("ADBE Vector Ellipse Size").setValue(dimensions);
            } else {
                shapeProperty.property("ADBE Vector Ellipse Size").expression =
                    dimensionsExpression;
            }
        } else {
            shapeProperty = contents.addProperty("ADBE Vector Shape - Group");
            shapeProperty.name = "Node Shape";
            if (shapeOnly) {
                shapeProperty.property("ADBE Vector Shape").setValue(
                    makeNodePolygon(kind, dimensions[0], dimensions[1])
                );
            } else {
                var pathExpression;
                if (kind === "triangle") {
                    pathExpression =
                        "createPath([[-w/2,-h/2],[w/2,0],[-w/2,h/2]]," +
                        "[[0,0],[0,0],[0,0]]," +
                        "[[0,0],[0,0],[0,0]],true);";
                } else if (kind === "hexagon") {
                    pathExpression =
                        "createPath([[-w/2,0],[-w/4,-h/2],[w/4,-h/2]," +
                        "[w/2,0],[w/4,h/2],[-w/4,h/2]]," +
                        "[[0,0],[0,0],[0,0],[0,0],[0,0],[0,0]]," +
                        "[[0,0],[0,0],[0,0],[0,0],[0,0],[0,0]],true);";
                } else {
                    pathExpression =
                        "createPath([[0,-h/2],[w/2,0],[0,h/2],[-w/2,0]]," +
                        "[[0,0],[0,0],[0,0],[0,0]]," +
                        "[[0,0],[0,0],[0,0],[0,0]],true);";
                }
                shapeProperty.property("ADBE Vector Shape").expression =
                    dimensionsExpression +
                    "\nvar w = d[0];\n" +
                    "var h = d[1];\n" +
                    pathExpression;
            }
        }

        // Dots are wire junctions, so they take the connector color rather
        // than the node palette.
        var fillThemeControl = kind === "dot" ? "Connector Color" : "Node Fill";
        var strokeThemeControl =
            kind === "dot" ? "Connector Color" : "Node Border";

        var fill = contents.addProperty("ADBE Vector Graphic - Fill");
        fill.name = "Node Fill";
        var fillColor = fill.property("ADBE Vector Fill Color");
        fillColor.setValue(kind === "dot" ? selectedColor : selectedNodeFill);
        fillColor.expression = themeColorExpression(fillThemeControl);

        var stroke = contents.addProperty("ADBE Vector Graphic - Stroke");
        stroke.name = "Node Border";
        var strokeColor = stroke.property("ADBE Vector Stroke Color");
        strokeColor.setValue(
            kind === "dot" ? selectedColor : selectedNodeStroke
        );
        strokeColor.expression = themeColorExpression(strokeThemeControl);
        stroke.property("ADBE Vector Stroke Width").setValue(3);
        stroke.property("ADBE Vector Stroke Line Join").setValue(2);
    }

    function nodeDimensionsExpression(kind) {
        var base =
            "var t = effect(\"Node Text\")(\"Layer\");\n" +
            "var m = effect(\"Text Measure\")(\"Layer\");\n" +
            "var tr = t.sourceRectAtTime(time, false);\n" +
            "var mr = m.sourceRectAtTime(time, false);\n" +
            "var w = Math.max(" + MIN_NODE_WIDTH + ", Math.min(" +
                MAX_TEXT_WIDTH + ", mr.width) + " + (H_PADDING * 2) + ");\n" +
            "var h = Math.max(" + MIN_NODE_HEIGHT + ", tr.height + " +
                (V_PADDING * 2) + ");";

        if (kind === "circle" || kind === "square") {
            return base + "\nvar diameter = Math.max(w, h);\n[diameter, diameter];";
        }
        if (kind === "diamond") {
            return base + "\nvar s = Math.max(w, h) * 2;\nvar d = [s, s];";
        }
        if (kind === "triangle") {
            return base +
                "\nvar side = Math.max(h * 2, (w * 2) / (Math.sqrt(3) / 2));" +
                "\nvar d = [side * Math.sqrt(3) / 2, side];";
        }
        if (kind === "hexagon") {
            // Regular hexagon: with points left/right and flat top/bottom, the
            // bounding height must be width * sqrt(3)/2 for all six edges to be
            // equal length (each edge then = width/2).
            return base +
                "\nvar s = Math.max(w, h) * 1.5;" +
                "\nvar d = [s, s * Math.sqrt(3) / 2];";
        }
        return base + "\n[w, h];";
    }

    function defaultNodeDimensions(kind) {
        if (kind === "circle") {
            return [120, 120];
        }
        if (kind === "square") {
            return [120, 120];
        }
        if (kind === "rectangle") {
            return [180, 100];
        }
        if (kind === "dot") {
            return [24, 24];
        }
        if (kind === "diamond") {
            return [180, 180];
        }
        if (kind === "triangle") {
            var side = 180;
            return [side * Math.sqrt(3) / 2, side];
        }
        if (kind === "hexagon") {
            return [180, 180 * Math.sqrt(3) / 2];
        }
        return [160, 96];
    }

    function makeNodePolygon(kind, width, height) {
        var shape = new Shape();
        if (kind === "triangle") {
            shape.vertices = [
                [-width / 2, -height / 2],
                [width / 2, 0],
                [-width / 2, height / 2]
            ];
            shape.inTangents = [[0, 0], [0, 0], [0, 0]];
            shape.outTangents = [[0, 0], [0, 0], [0, 0]];
        } else if (kind === "hexagon") {
            shape.vertices = [
                [-width / 2, 0],
                [-width / 4, -height / 2],
                [width / 4, -height / 2],
                [width / 2, 0],
                [width / 4, height / 2],
                [-width / 4, height / 2]
            ];
            shape.inTangents = [
                [0, 0],
                [0, 0],
                [0, 0],
                [0, 0],
                [0, 0],
                [0, 0]
            ];
            shape.outTangents = [
                [0, 0],
                [0, 0],
                [0, 0],
                [0, 0],
                [0, 0],
                [0, 0]
            ];
        } else {
            shape.vertices = [
                [0, -height / 2],
                [width / 2, 0],
                [0, height / 2],
                [-width / 2, 0]
            ];
            shape.inTangents = [[0, 0], [0, 0], [0, 0], [0, 0]];
            shape.outTangents = [[0, 0], [0, 0], [0, 0], [0, 0]];
        }
        shape.closed = true;
        return shape;
    }

    function createConnectorFromSelection() {
        var comp = activeComp();
        if (comp === null) {
            alert("Open a composition and select generated nodes.", SCRIPT_NAME);
            return;
        }

        var selectedNodes = selectedGeneratedNodes(comp);
        if (selectedNodes.length < 2) {
            alert(
                "Select at least two generated nodes.",
                SCRIPT_NAME
            );
            return;
        }

        var settings = readUiSettings();
        if (settings === null) {
            return;
        }
        var connectAll = isAltDown();
        var pairs = connectorPairs(
            selectedNodes,
            connectAll,
            comp.time
        );

        app.beginUndoGroup(
            connectAll
                ? "Connect All Flow Diagram Nodes"
                : "Connect Flow Diagram Nodes"
        );
        var connectors = [];
        try {
            ensureThemeLayer(comp);
            var i;
            for (i = 0; i < pairs.length; i += 1) {
                connectors.push(
                    createConnector(
                        comp,
                        pairs[i][0],
                        pairs[i][1],
                        settings
                    )
                );
            }
            deselectAllLayers(comp);
            for (i = 0; i < connectors.length; i += 1) {
                connectors[i].selected = true;
            }
        } catch (error) {
            var cleanupIndex;
            for (cleanupIndex = 0; cleanupIndex < connectors.length; cleanupIndex += 1) {
                removeLayerQuietly(connectors[cleanupIndex]);
            }
            alert(
                "The connectors could not be created.\n\n" + error.toString(),
                SCRIPT_NAME
            );
        } finally {
            app.endUndoGroup();
        }
    }

    function connectorPairs(nodes, connectAll, sampleTime) {
        if (connectAll) {
            return completeGraphPairs(nodes, sampleTime);
        }
        if (nodes.length === 2) {
            var ordered = orderedSelectedNodes(nodes);
            return [[ordered[0], ordered[1]]];
        }
        return nearestFlowPairs(nodes, sampleTime);
    }

    function completeGraphPairs(nodes, sampleTime) {
        var entries = nodePositionEntries(nodes, sampleTime);
        var pairs = [];
        var i;
        var j;
        for (i = 0; i < entries.length; i += 1) {
            for (j = i + 1; j < entries.length; j += 1) {
                pairs.push(orientedPair(entries[i], entries[j]));
            }
        }
        return pairs;
    }

    function nearestFlowPairs(nodes, sampleTime) {
        var remaining = nodePositionEntries(nodes, sampleTime);
        remaining.sort(compareFlowEntries);
        var current = remaining.shift();
        var pairs = [];

        while (remaining.length > 0) {
            var bestIndex = 0;
            var bestScore = flowDistanceScore(current, remaining[0]);
            var i;
            for (i = 1; i < remaining.length; i += 1) {
                var score = flowDistanceScore(current, remaining[i]);
                if (score < bestScore) {
                    bestScore = score;
                    bestIndex = i;
                }
            }
            var next = remaining.splice(bestIndex, 1)[0];
            pairs.push([current.layer, next.layer]);
            current = next;
        }
        return pairs;
    }

    function nodePositionEntries(nodes, sampleTime) {
        var entries = [];
        var i;
        for (i = 0; i < nodes.length; i += 1) {
            entries.push({
                layer: nodes[i],
                position: nodeCompPosition(nodes[i], sampleTime)
            });
        }
        return entries;
    }

    function nodeCompPosition(layer, sampleTime) {
        try {
            return layer.sourcePointToComp([0, 0]);
        } catch (sourcePointError) {
            var position = layer.property("ADBE Transform Group")
                .property("ADBE Position")
                .valueAtTime(sampleTime, false);
            return [position[0], position[1]];
        }
    }

    function compareFlowEntries(first, second) {
        var xDifference = first.position[0] - second.position[0];
        if (Math.abs(xDifference) > 0.001) {
            return xDifference;
        }
        return first.position[1] - second.position[1];
    }

    function orientedPair(first, second) {
        var dx = second.position[0] - first.position[0];
        var dy = second.position[1] - first.position[1];
        if (Math.abs(dx) >= Math.abs(dy)) {
            return dx >= 0
                ? [first.layer, second.layer]
                : [second.layer, first.layer];
        }
        return dy >= 0
            ? [first.layer, second.layer]
            : [second.layer, first.layer];
    }

    function flowDistanceScore(fromEntry, toEntry) {
        var dx = toEntry.position[0] - fromEntry.position[0];
        var dy = toEntry.position[1] - fromEntry.position[1];
        var distance = Math.sqrt(dx * dx + dy * dy);
        var backwardPenalty = dx < 0 ? Math.abs(dx) * 4 : 0;
        var upwardPenalty =
            Math.abs(dx) < Math.abs(dy) && dy < 0
                ? Math.abs(dy) * 2
                : 0;
        return distance + backwardPenalty + upwardPenalty;
    }

    function createConnector(comp, startNode, endNode, settings) {
        if (startNode.threeDLayer || endNode.threeDLayer) {
            throw new Error("Flow Diagram connectors support 2D nodes only.");
        }

        var connector = comp.layers.addShape();
        try {
            connector.name = uniqueLayerName(
                comp,
                startNode.name + " to " + endNode.name
            );
            connector.comment = CONNECTOR_TAG;
            connector.label = 11;
            configureIdentityTransform(connector);

        var effects = connector.property("ADBE Effect Parade");
        addLayerControl(effects, "Start Node", startNode);
        addLayerControl(effects, "End Node", endNode);
        addDropdownControl(
            effects,
            "Route",
            ROUTE_ITEMS,
            dropdownIndex(ROUTE_ITEMS, settings.route)
        );
        addDropdownControl(
            effects,
            "Start Side",
            SIDE_ITEMS,
            dropdownIndex(SIDE_ITEMS, settings.startSide)
        );
        addDropdownControl(
            effects,
            "End Side",
            SIDE_ITEMS,
            dropdownIndex(SIDE_ITEMS, settings.endSide)
        );
        addSliderControl(effects, "Start Port Offset", settings.startOffset);
        addSliderControl(effects, "End Port Offset", settings.endOffset);
        addSliderControl(effects, "Stroke Width", settings.strokeWidth);
        addSliderControl(effects, "Arrowhead Size", settings.headSize);
        // Junction dots are pass-through points, so a wire ending on one
        // defaults to no arrowhead; arrows belong on final destinations.
        var arrowheadSetting = isDotNode(endNode) ? "Off" : settings.arrowhead;
        addDropdownControl(
            effects,
            "Arrowhead",
            ARROWHEAD_ITEMS,
            dropdownIndex(ARROWHEAD_ITEMS, arrowheadSetting)
        );
        var colorControl = addColorControl(
            effects,
            "Connector Color",
            settings.color
        );
        colorControl.property(1).expression =
            themeColorExpression("Connector Color");

        var root = connector.property("ADBE Root Vectors Group");
        var group = root.addProperty("ADBE Vector Group");
        group.name = "Connector Geometry";
        var contents = group.property("ADBE Vectors Group");

        var pathGroup = contents.addProperty("ADBE Vector Shape - Group");
        pathGroup.name = "Connector Path";
        pathGroup.property("ADBE Vector Shape").expression =
            connectorPathExpression();

        var stroke = contents.addProperty("ADBE Vector Graphic - Stroke");
        stroke.name = "Connector Stroke";
        stroke.property("ADBE Vector Stroke Color").expression =
            "effect(\"Connector Color\")(\"Color\");";
        stroke.property("ADBE Vector Stroke Width").expression =
            "effect(\"Stroke Width\")(\"Slider\");";
        stroke.property("ADBE Vector Stroke Line Cap").setValue(1);
        stroke.property("ADBE Vector Stroke Line Join").setValue(1);

        var trim = contents.addProperty("ADBE Vector Filter - Trim");
        trim.name = "Draw On";
        trim.property("ADBE Vector Trim Start").setValue(0);
        trim.property("ADBE Vector Trim Offset").setValue(0);
        var trimEnd = trim.property("ADBE Vector Trim End");
        trimEnd.setValueAtTime(comp.time, 0);
        trimEnd.setValueAtTime(comp.time + settings.duration, 100);
        applyEasing(trimEnd, "Easy Ease");

        var head = contents.addProperty("ADBE Vector Group");
        head.name = "Arrowhead";
        head.property("ADBE Vector Transform Group")
            .property("ADBE Vector Group Opacity")
            .expression =
                "Math.round(effect(\"Arrowhead\")(\"Menu\").value) === 1 ? 100 : 0;";
        var headContents = head.property("ADBE Vectors Group");
        var headPath = headContents.addProperty("ADBE Vector Shape - Group");
        headPath.name = "Arrowhead Path";
        headPath.property("ADBE Vector Shape").expression =
            "var s = effect(\"Arrowhead Size\")(\"Slider\");\n" +
            "createPath([[0,0],[-s,s*0.55],[-s,-s*0.55]]," +
            "[[0,0],[0,0],[0,0]],[[0,0],[0,0],[0,0]],true);";
        var headFill = headContents.addProperty("ADBE Vector Graphic - Fill");
        headFill.name = "Arrowhead Fill";
        headFill.property("ADBE Vector Fill Color").expression =
            "effect(\"Connector Color\")(\"Color\");";
        applyConnectorArrowheadExpressions(head);

            moveConnectorBehindNodes(connector, startNode, endNode);
            return connector;
        } catch (error) {
            removeLayerQuietly(connector);
            throw error;
        }
    }

    function connectorPathExpression() {
        return [
            "var a = effect(\"Start Node\")(\"Layer\");",
            "var b = effect(\"End Node\")(\"Layer\");",
            "var route = Math.round(effect(\"Route\")(\"Menu\").value);",
            "var startChoice = Math.round(effect(\"Start Side\")(\"Menu\").value);",
            "var endChoice = Math.round(effect(\"End Side\")(\"Menu\").value);",
            "var clearance = 24;",
            "",
            "function center(layer) {",
            "  return layer.toComp([0, 0]);",
            "}",
            "function autoSide(fromLayer, toLayer) {",
            "  var p = center(fromLayer);",
            "  var q = center(toLayer);",
            "  var dx = q[0] - p[0];",
            "  var dy = q[1] - p[1];",
            "  if (Math.abs(dx) >= Math.abs(dy)) {",
            "    return dx >= 0 ? 3 : 5;",
            "  }",
            "  return dy >= 0 ? 4 : 2;",
            "}",
            "function nodeKind(layer) {",
            "  var k = 0;",
            "  try { k = Math.round(layer.effect(\"Node Type\")(\"Slider\").value); } catch (error) {}",
            "  return k;",
            "}",
            "function resolvedSide(choice, fromLayer, toLayer) {",
            "  if (nodeKind(fromLayer) === 7) return 6;",
            "  return choice === 1 ? autoSide(fromLayer, toLayer) : choice;",
            "}",
            "function edge(layer, side, offset) {",
            "  if (side === 6) return center(layer);",
            "  var r = layer.sourceRectAtTime(time, true);",
            "  var f = Math.max(-50, Math.min(50, offset)) / 100;",
            "  var ox = (side === 2 || side === 4) ? r.width * f : 0;",
            "  var oy = (side === 3 || side === 5) ? r.height * f : 0;",
            "  var kind = nodeKind(layer);",
            "  if (kind === 4) {",
            "    if (side === 2) return layer.toComp([r.left + r.width/2 + ox, r.top + r.height/4]);",
            "    if (side === 3) return layer.toComp([r.left + r.width, r.top + r.height/2 + oy]);",
            "    if (side === 4) return layer.toComp([r.left + r.width/2 + ox, r.top + r.height*3/4]);",
            "    return layer.toComp([r.left, r.top + r.height/2 + oy]);",
            "  }",
            "  if (side === 2) return layer.toComp([r.left + r.width/2 + ox, r.top]);",
            "  if (side === 3) return layer.toComp([r.left + r.width, r.top + r.height/2 + oy]);",
            "  if (side === 4) return layer.toComp([r.left + r.width/2 + ox, r.top + r.height]);",
            "  return layer.toComp([r.left, r.top + r.height/2 + oy]);",
            "}",
            "function normal(side) {",
            "  if (side === 2) return [0,-1];",
            "  if (side === 3) return [1,0];",
            "  if (side === 4) return [0,1];",
            "  return [-1,0];",
            "}",
            "function routeNormal(side, fromLayer, toLayer) {",
            "  return normal(side === 6 ? autoSide(fromLayer, toLayer) : side);",
            "}",
            "function add(p, n, amount) { return [p[0]+n[0]*amount, p[1]+n[1]*amount]; }",
            "function local(p) { return fromComp(p); }",
            "function same(p, q) { return Math.abs(p[0]-q[0]) < 0.01 && Math.abs(p[1]-q[1]) < 0.01; }",
            "function bbox(layer) {",
            "  var r = layer.sourceRectAtTime(time, true);",
            "  var c0 = layer.toComp([r.left, r.top]);",
            "  var c1 = layer.toComp([r.left + r.width, r.top]);",
            "  var c2 = layer.toComp([r.left + r.width, r.top + r.height]);",
            "  var c3 = layer.toComp([r.left, r.top + r.height]);",
            "  var minx = Math.min(Math.min(c0[0],c1[0]), Math.min(c2[0],c3[0]));",
            "  var maxx = Math.max(Math.max(c0[0],c1[0]), Math.max(c2[0],c3[0]));",
            "  var miny = Math.min(Math.min(c0[1],c1[1]), Math.min(c2[1],c3[1]));",
            "  var maxy = Math.max(Math.max(c0[1],c1[1]), Math.max(c2[1],c3[1]));",
            "  return [minx, miny, maxx, maxy];",
            "}",
            "function segHits(p, q, box) {",
            "  if (Math.abs(p[1]-q[1]) < 0.01) {",
            "    if (p[1] <= box[1] || p[1] >= box[3]) return false;",
            "    return Math.max(p[0],q[0]) > box[0] && Math.min(p[0],q[0]) < box[2];",
            "  }",
            "  if (p[0] <= box[0] || p[0] >= box[2]) return false;",
            "  return Math.max(p[1],q[1]) > box[1] && Math.min(p[1],q[1]) < box[3];",
            "}",
            "function corHits(s, c, e, ba, bb) {",
            "  return segHits(s,c,ba) || segHits(s,c,bb) || segHits(c,e,ba) || segHits(c,e,bb);",
            "}",
            "function clean(points) {",
            "  var result = [];",
            "  for (var i = 0; i < points.length; i++) {",
            "    if (result.length === 0 || !same(result[result.length-1], points[i])) result.push(points[i]);",
            "  }",
            "  return result;",
            "}",
            "",
            "var startOffset = 0;",
            "var endOffset = 0;",
            "try { startOffset = effect(\"Start Port Offset\")(\"Slider\").value; } catch (error) {}",
            "try { endOffset = effect(\"End Port Offset\")(\"Slider\").value; } catch (error) {}",
            "var ss = resolvedSide(startChoice, a, b);",
            "var es = resolvedSide(endChoice, b, a);",
            "var p0 = edge(a, ss, startOffset);",
            "var p3 = edge(b, es, endOffset);",
            "var points = [p0, p3];",
            "if (route === 2) {",
            "  var ns = routeNormal(ss, a, b);",
            "  var ne = routeNormal(es, b, a);",
            "  var s1 = add(p0, ns, clearance);",
            "  var e1 = add(p3, ne, clearance);",
            "  points = [p0, s1];",
            "  var ca = center(a);",
            "  var cb = center(b);",
            "  var endFacing = ne[0]*(ca[0]-cb[0]) + ne[1]*(ca[1]-cb[1]);",
            "  if (endFacing < 0) {",
            "    var eb = bbox(b);",
            "    var ex0 = eb[0]-clearance, ey0 = eb[1]-clearance, ex1 = eb[2]+clearance, ey1 = eb[3]+clearance;",
            "    if (ne[0] !== 0) {",
            "      var safeY = (s1[1] < ey0) ? s1[1] : ((s1[1] > ey1) ? s1[1] : ((s1[1]-ey0 < ey1-s1[1]) ? ey0 : ey1));",
            "      points.push([s1[0], safeY], [e1[0], safeY]);",
            "    } else {",
            "      var safeX = (s1[0] < ex0) ? s1[0] : ((s1[0] > ex1) ? s1[0] : ((s1[0]-ex0 < ex1-s1[0]) ? ex0 : ex1));",
            "      points.push([safeX, s1[1]], [safeX, e1[1]]);",
            "    }",
            "  } else {",
            "    var startHorizontal = ns[0] !== 0;",
            "    var endHorizontal = ne[0] !== 0;",
            "    if (startHorizontal && endHorizontal) {",
            "      var mx;",
            "      if (ns[0] === ne[0]) mx = ns[0] > 0 ? Math.max(s1[0],e1[0])+clearance : Math.min(s1[0],e1[0])-clearance;",
            "      else mx = (s1[0]+e1[0])/2;",
            "      points.push([mx,s1[1]], [mx,e1[1]]);",
            "    } else if (!startHorizontal && !endHorizontal) {",
            "      var my;",
            "      if (ns[1] === ne[1]) my = ns[1] > 0 ? Math.max(s1[1],e1[1])+clearance : Math.min(s1[1],e1[1])-clearance;",
            "      else my = (s1[1]+e1[1])/2;",
            "      points.push([s1[0],my], [e1[0],my]);",
            "    } else {",
            "      var def = startHorizontal ? [e1[0],s1[1]] : [s1[0],e1[1]];",
            "      var alt = startHorizontal ? [s1[0],e1[1]] : [e1[0],s1[1]];",
            "      var ba = bbox(a); var bb = bbox(b);",
            "      var defBad = corHits(s1, def, e1, ba, bb);",
            "      var altBad = corHits(s1, alt, e1, ba, bb);",
            "      points.push((defBad && !altBad) ? alt : def);",
            "    }",
            "  }",
            "  points.push(e1, p3);",
            "}",
            "for (var j = 0; j < points.length; j++) points[j] = local(points[j]);",
            "points = clean(points);",
            "var zeros = [];",
            "for (var k = 0; k < points.length; k++) zeros.push([0,0]);",
            "createPath(points, zeros, zeros, false);"
        ].join("\n");
    }

    function applyConnectorArrowheadExpressions(headGroup) {
        var transform = headGroup.property("ADBE Vector Transform Group");
        var pathReference =
            "content(\"Connector Geometry\").content(\"Connector Path\").path";
        var trimReference =
            "content(\"Connector Geometry\").content(\"Draw On\").end";
        var strokeReference = "effect(\"Stroke Width\")(\"Slider\")";

        // While the connector is fully drawn, anchor the head to the path's
        // actual last vertex and last-segment direction (from points()) instead
        // of arc-length sampling. On long multi-elbow routes the arc-length
        // window can be longer than the short final approach segment, so it
        // straddles the last corner and yields a diagonal direction, which
        // shifts and rotates the head off the line end. Vertex math is exact and
        // immune to corners or path length. The arc-length window is only used
        // mid draw-on so the head still rides the leading edge during animation.
        transform.property("ADBE Vector Position").expression =
            "var p = " + pathReference + ";\n" +
            "var progress = Math.max(0, Math.min(1, " + trimReference + " / 100));\n" +
            "var pts = p.points();\n" +
            "if (pts.length < 2) {\n" +
            "  [0, 0];\n" +
            "} else {\n" +
            "  var sw = " + strokeReference + ";\n" +
            "  if (progress >= 0.999) {\n" +
            "    var last = pts[pts.length - 1];\n" +
            "    var prev = pts[pts.length - 2];\n" +
            "    var dir = last - prev;\n" +
            "    last + normalize(dir) * sw;\n" +
            "  } else {\n" +
            "    var step = 0.002;\n" +
            "    var tEnd = Math.min(1, progress + step);\n" +
            "    var tStart = Math.max(0, tEnd - step);\n" +
            "    var dir = p.pointOnPath(tEnd) - p.pointOnPath(tStart);\n" +
            "    p.pointOnPath(progress) + normalize(dir) * sw;\n" +
            "  }\n" +
            "}";
        transform.property("ADBE Vector Rotation").expression =
            "var p = " + pathReference + ";\n" +
            "var progress = Math.max(0, Math.min(1, " + trimReference + " / 100));\n" +
            "var pts = p.points();\n" +
            "if (pts.length < 2) {\n" +
            "  0;\n" +
            "} else {\n" +
            "  if (progress >= 0.999) {\n" +
            "    var last = pts[pts.length - 1];\n" +
            "    var prev = pts[pts.length - 2];\n" +
            "    var dir = last - prev;\n" +
            "    radiansToDegrees(Math.atan2(dir[1], dir[0]));\n" +
            "  } else {\n" +
            "    var step = 0.002;\n" +
            "    var tEnd = Math.min(1, progress + step);\n" +
            "    var tStart = Math.max(0, tEnd - step);\n" +
            "    var dir = p.pointOnPath(tEnd) - p.pointOnPath(tStart);\n" +
            "    radiansToDegrees(Math.atan2(dir[1], dir[0]));\n" +
            "  }\n" +
            "}";
    }

    function updateSelectedConnectors(settings) {
        var comp = activeComp();
        if (comp === null) {
            return;
        }

        var connectors = selectedConnectors(comp);
        if (connectors.length === 0) {
            return;
        }

        app.beginUndoGroup("Update Flow Diagram Connector");
        try {
            var i;
            for (i = 0; i < connectors.length; i += 1) {
                updateConnector(connectors[i], settings);
            }
        } catch (error) {
            alert(
                "The selected connector could not be updated.\n\n" + error.toString(),
                SCRIPT_NAME
            );
        } finally {
            app.endUndoGroup();
        }
    }

    function updateConnector(connector, settings) {
        if (settings.strokeWidth !== undefined) {
            effectValue(connector, "Stroke Width").setValue(settings.strokeWidth);
        }
        if (settings.headSize !== undefined) {
            effectValue(connector, "Arrowhead Size").setValue(settings.headSize);
        }
        if (settings.startOffset !== undefined) {
            effectValue(connector, "Start Port Offset").setValue(
                settings.startOffset
            );
        }
        if (settings.endOffset !== undefined) {
            effectValue(connector, "End Port Offset").setValue(
                settings.endOffset
            );
        }
        if (settings.color !== undefined) {
            var colorProperty = effectValue(connector, "Connector Color");
            colorProperty.expression = "";
            colorProperty.setValue(settings.color);
        }
        if (settings.arrowhead !== undefined) {
            effectValue(connector, "Arrowhead").setValue(
                dropdownIndex(ARROWHEAD_ITEMS, settings.arrowhead)
            );
        }
        if (settings.route !== undefined) {
            effectValue(connector, "Route").setValue(
                dropdownIndex(ROUTE_ITEMS, settings.route)
            );
        }
        if (settings.startSide !== undefined) {
            effectValue(connector, "Start Side").setValue(
                dropdownIndex(SIDE_ITEMS, settings.startSide)
            );
        }
        if (settings.endSide !== undefined) {
            effectValue(connector, "End Side").setValue(
                dropdownIndex(SIDE_ITEMS, settings.endSide)
            );
        }

        var trimEnd = connectorTrimEnd(connector);
        if (settings.duration !== undefined) {
            var startTime = trimEnd.numKeys > 0
                ? trimEnd.keyTime(1)
                : connector.containingComp.time;
            while (trimEnd.numKeys > 1) {
                trimEnd.removeKey(trimEnd.numKeys);
            }
            if (trimEnd.numKeys === 0) {
                trimEnd.setValueAtTime(startTime, 0);
            }
            trimEnd.setValueAtTime(startTime + settings.duration, 100);
            applyEasing(trimEnd, "Easy Ease");
        }
    }

    function reverseSelectedConnectors() {
        var comp = activeComp();
        if (comp === null) {
            alert("Open a composition and select generated connectors.", SCRIPT_NAME);
            return;
        }
        var connectors = selectedConnectors(comp);
        if (connectors.length === 0) {
            alert("Select one or more generated connectors.", SCRIPT_NAME);
            return;
        }

        app.beginUndoGroup("Reverse Flow Diagram Connectors");
        try {
            var i;
            for (i = 0; i < connectors.length; i += 1) {
                reverseConnector(connectors[i]);
            }
        } catch (error) {
            alert(
                "The selected connector could not be reversed.\n\n" + error.toString(),
                SCRIPT_NAME
            );
        } finally {
            app.endUndoGroup();
        }
    }

    function reverseConnector(connector) {
        var startControl = effectValue(connector, "Start Node");
        var endControl = effectValue(connector, "End Node");
        var startNode = layerFromControlValue(connector, startControl.value);
        var endNode = layerFromControlValue(connector, endControl.value);
        var startLayerIndex = startControl.value;
        startControl.setValue(endControl.value);
        endControl.setValue(startLayerIndex);

        var startSide = effectValue(connector, "Start Side");
        var endSide = effectValue(connector, "End Side");
        var startSideValue = startSide.value;
        startSide.setValue(endSide.value);
        endSide.setValue(startSideValue);

        var startOffset = effectValue(connector, "Start Port Offset");
        var endOffset = effectValue(connector, "End Port Offset");
        var startOffsetValue = startOffset.value;
        startOffset.setValue(endOffset.value);
        endOffset.setValue(startOffsetValue);

        // Rename only when the layer still uses its generated name, so a
        // custom name chosen by the user survives reversing.
        if (
            startNode !== null &&
            endNode !== null &&
            connector.name.indexOf(startNode.name + " to " + endNode.name) === 0
        ) {
            connector.name = uniqueLayerName(
                connector.containingComp,
                endNode.name + " to " + startNode.name
            );
        }
    }

    function layerFromControlValue(connector, value) {
        if (typeof value === "number") {
            return value > 0
                ? connector.containingComp.layer(value)
                : null;
        }
        return (value === undefined || value === null) ? null : value;
    }

    function syncControlsFromSelection() {
        // Runs on every panel activate/focus event, which can fire at fragile
        // moments: while a modal dialog is open (New Composition settings, an
        // alert), or against torn-down controls as the panel is reopened. AE
        // throws there ("Object is invalid" / "Cannot run a script while a
        // modal dialog is waiting"). An uncaught throw here aborts the panel
        // repaint (blanking every custom-drawn button/swatch) and wedges the
        // engine, so a passive refresh must swallow everything.
        try {
        if (ui === null) {
            return;
        }
        var comp = activeComp();
        if (comp === null) {
            return;
        }
        var connectors = selectedConnectors(comp);
        if (connectors.length === 0) {
            // Nothing to read from. Don't leave a control stuck on a blank
            // "<Mixed>" state from a previous selection -- restore concrete
            // defaults so the panel never lingers blank and Connect stays usable.
            restoreBlankDropdownsToDefaults();
            return;
        }

        var values = [];
        var i;
        for (i = 0; i < connectors.length; i += 1) {
            try {
                values.push(readConnectorSettings(connectors[i]));
            } catch (error) {
                // Ignore connectors whose native structure was manually removed.
            }
        }
        if (values.length === 0) {
            return;
        }

        isSyncingControls = true;
        try {
            ui.stroke.text = displayNumber(commonNumber(values, "strokeWidth"));
            ui.head.text = displayNumber(commonNumber(values, "headSize"));
            ui.startOffset.text = displayNumber(
                commonNumber(values, "startOffset")
            );
            ui.endOffset.text = displayNumber(
                commonNumber(values, "endOffset")
            );
            ui.duration.text = displayNumber(commonNumber(values, "duration"));
            setDropdownValue(ui.type, commonText(values, "route"));
            setDropdownValue(ui.startSide, commonText(values, "startSide"));
            setDropdownValue(ui.endSide, commonText(values, "endSide"));
            setDropdownValue(ui.arrowhead, commonText(values, "arrowhead"));
            var color = commonColor(values, "color");
            if (color === null) {
                selectedColorIsMixed = true;
                ui.colorValue.text = "<Mixed>";
            } else {
                selectedColor = color;
                selectedColorIsMixed = false;
                ui.colorValue.text = rgbToHex(selectedColor);
            }
            ui.colorButton.notify("onDraw");
        } finally {
            isSyncingControls = false;
        }
        } catch (syncError) {
            isSyncingControls = false;
        }
    }

    function restoreBlankDropdownsToDefaults() {
        if (ui === null) {
            return;
        }
        isSyncingControls = true;
        try {
            if (ui.type.selection === null) {
                setDropdownValue(ui.type, ROUTE_ITEMS[1]);
            }
            if (ui.startSide.selection === null) {
                setDropdownValue(ui.startSide, SIDE_ITEMS[0]);
            }
            if (ui.endSide.selection === null) {
                setDropdownValue(ui.endSide, SIDE_ITEMS[0]);
            }
            if (ui.arrowhead.selection === null) {
                setDropdownValue(ui.arrowhead, ARROWHEAD_ITEMS[0]);
            }
            if (selectedColorIsMixed) {
                selectedColorIsMixed = false;
                ui.colorValue.text = rgbToHex(selectedColor);
                ui.colorButton.notify("onDraw");
            }
        } finally {
            isSyncingControls = false;
        }
    }

    function readConnectorSettings(connector) {
        var trimEnd = connectorTrimEnd(connector);
        return {
            route: dropdownName(
                ROUTE_ITEMS,
                effectValue(connector, "Route").value
            ),
            startSide: dropdownName(
                SIDE_ITEMS,
                effectValue(connector, "Start Side").value
            ),
            endSide: dropdownName(
                SIDE_ITEMS,
                effectValue(connector, "End Side").value
            ),
            arrowhead: dropdownName(
                ARROWHEAD_ITEMS,
                effectValue(connector, "Arrowhead").value
            ),
            strokeWidth: effectValue(connector, "Stroke Width").value,
            headSize: effectValue(connector, "Arrowhead Size").value,
            startOffset: effectValue(connector, "Start Port Offset").value,
            endOffset: effectValue(connector, "End Port Offset").value,
            color: effectValue(connector, "Connector Color").value,
            duration: trimEnd.numKeys >= 2
                ? trimEnd.keyTime(trimEnd.numKeys) - trimEnd.keyTime(1)
                : 0
        };
    }

    function readUiSettings() {
        var strokeWidth = parsePositiveNumber(ui.stroke.text, "Stroke width");
        var headSize = parsePositiveNumber(ui.head.text, "Arrowhead size");
        var duration = parsePositiveNumber(ui.duration.text, "Duration");
        var startOffset = parseOffsetNumber(
            ui.startOffset.text,
            "Start offset"
        );
        var endOffset = parseOffsetNumber(ui.endOffset.text, "End offset");
        if (
            strokeWidth === null ||
            headSize === null ||
            duration === null ||
            startOffset === null ||
            endOffset === null
        ) {
            return null;
        }
        // A blank dropdown is a leftover "<Mixed>" indicator from a prior
        // selection, not a real choice. Fall back to the same defaults the panel
        // builds with, so Connect always has usable values instead of blocking
        // with an alert.
        return {
            route: ui.type.selection ? ui.type.selection.text : ROUTE_ITEMS[1],
            startSide: ui.startSide.selection
                ? ui.startSide.selection.text
                : SIDE_ITEMS[0],
            endSide: ui.endSide.selection
                ? ui.endSide.selection.text
                : SIDE_ITEMS[0],
            startOffset: startOffset,
            endOffset: endOffset,
            arrowhead: ui.arrowhead.selection
                ? ui.arrowhead.selection.text
                : ARROWHEAD_ITEMS[0],
            strokeWidth: strokeWidth,
            headSize: headSize,
            duration: duration,
            color: selectedColor
        };
    }

    function importSlxModel() {
        var comp = activeComp();
        if (comp === null) {
            alert("Open a composition before importing.", SCRIPT_NAME);
            return;
        }
        var settings = readUiSettings();
        if (settings === null) {
            return;
        }
        var slxFile = File.openDialog("Choose a Simulink .slx model");
        if (slxFile === null) {
            return;
        }
        if (!/\.slx$/i.test(slxFile.name)) {
            alert("Choose a .slx file.", SCRIPT_NAME);
            return;
        }

        var model = null;
        try {
            model = readSlxModel(slxFile);
        } catch (error) {
            alert(
                "The model could not be read.\n\n" + error.toString(),
                SCRIPT_NAME
            );
            return;
        }
        if (model === null || model.blocks.length === 0) {
            alert(
                "No blocks with positions were found in the model's root " +
                    "system.",
                SCRIPT_NAME
            );
            return;
        }
        buildImportedDiagram(comp, model, settings);
    }

    function readSlxModel(slxFile) {
        var tempFolder = new Folder(
            Folder.temp.fsName + "/FlowDiagramSlx_" + new Date().getTime()
        );
        if (!tempFolder.create()) {
            throw new Error("A temporary folder could not be created.");
        }
        unzipArchive(slxFile, tempFolder);

        var candidates = [
            "simulink/systems/system_root.xml",
            "simulink/blockdiagram.xml"
        ];
        var i;
        for (i = 0; i < candidates.length; i += 1) {
            var xmlFile = new File(tempFolder.fsName + "/" + candidates[i]);
            if (!xmlFile.exists) {
                continue;
            }
            var model = parseSlxSystem(readTextFile(xmlFile));
            if (model !== null && model.blocks.length > 0) {
                return model;
            }
        }
        throw new Error(
            "No root system XML was found inside the archive."
        );
    }

    function unzipArchive(archiveFile, destinationFolder) {
        var command;
        if ($.os.indexOf("Windows") !== -1) {
            command = "powershell -NoProfile -Command \"Expand-Archive " +
                "-LiteralPath '" + archiveFile.fsName + "' " +
                "-DestinationPath '" + destinationFolder.fsName +
                "' -Force\"";
        } else {
            command = "unzip -o '" +
                archiveFile.fsName.replace(/'/g, "'\\''") + "' -d '" +
                destinationFolder.fsName.replace(/'/g, "'\\''") + "'";
        }
        try {
            system.callSystem(command);
        } catch (error) {
            throw new Error(
                "The archive could not be unzipped. Enable Preferences > " +
                    "Scripting & Expressions > Allow Scripts to Write " +
                    "Files and Access Network, then try again."
            );
        }
        var marker = new Folder(destinationFolder.fsName + "/simulink");
        if (!marker.exists) {
            throw new Error(
                "The file does not look like a Simulink .slx archive."
            );
        }
    }

    function readTextFile(file) {
        file.encoding = "UTF8";
        if (!file.open("r")) {
            throw new Error("The file could not be opened: " + file.fsName);
        }
        var text = file.read();
        file.close();
        return text;
    }

    function parseSlxSystem(xmlText) {
        var cleaned = String(xmlText)
            .replace(/^\uFEFF/, "")
            .replace(/<\?xml[^>]*\?>/, "");
        var root;
        try {
            root = new XML(cleaned);
        } catch (xmlError) {
            return null;
        }

        var systemElement;
        if (String(root.localName()) === "System") {
            systemElement = root;
        } else {
            var systems = root.descendants("System");
            if (systems.length() === 0) {
                return null;
            }
            systemElement = systems[0];
        }

        var blocks = [];
        var blockBySid = {};
        var blockElements = systemElement.elements("Block");
        var i;
        for (i = 0; i < blockElements.length(); i += 1) {
            var blockElement = blockElements[i];
            var positionText = blockParameter(blockElement, "Position");
            if (positionText === null) {
                continue;
            }
            var corners = parseNumberList(positionText);
            if (corners.length < 4) {
                continue;
            }
            var block = {
                sid: String(blockElement.attribute("SID")),
                name: String(blockElement.attribute("Name")),
                blockType: String(blockElement.attribute("BlockType")),
                center: [
                    (corners[0] + corners[2]) / 2,
                    (corners[1] + corners[3]) / 2
                ]
            };
            blocks.push(block);
            blockBySid[block.sid] = block;
        }

        var rawConnections = [];
        var lineElements = systemElement.elements("Line");
        for (i = 0; i < lineElements.length(); i += 1) {
            collectLineConnections(lineElements[i], null, rawConnections);
        }

        var connections = [];
        var inCounts = {};
        var outCounts = {};
        for (i = 0; i < rawConnections.length; i += 1) {
            var connection = rawConnections[i];
            if (
                connection.src === null ||
                connection.dst === null ||
                blockBySid[connection.src.sid] === undefined ||
                blockBySid[connection.dst.sid] === undefined
            ) {
                continue;
            }
            connections.push(connection);
            if (
                inCounts[connection.dst.sid] === undefined ||
                connection.dst.port > inCounts[connection.dst.sid]
            ) {
                inCounts[connection.dst.sid] = connection.dst.port;
            }
            if (
                outCounts[connection.src.sid] === undefined ||
                connection.src.port > outCounts[connection.src.sid]
            ) {
                outCounts[connection.src.sid] = connection.src.port;
            }
        }

        return {
            blocks: blocks,
            connections: connections,
            inCounts: inCounts,
            outCounts: outCounts
        };
    }

    function collectLineConnections(lineElement, inheritedSrc, connections) {
        var src = inheritedSrc;
        var srcText = blockParameter(lineElement, "Src");
        if (srcText !== null) {
            src = parseLineEndpoint(srcText);
        }
        var dstText = blockParameter(lineElement, "Dst");
        if (dstText !== null) {
            connections.push({
                src: src,
                dst: parseLineEndpoint(dstText)
            });
        }
        var branches = lineElement.elements("Branch");
        var i;
        for (i = 0; i < branches.length(); i += 1) {
            collectLineConnections(branches[i], src, connections);
        }
    }

    function parseLineEndpoint(text) {
        var parts = String(text).split("#");
        if (parts.length < 2) {
            return null;
        }
        var portParts = parts[1].split(":");
        var port = portParts.length > 1
            ? parseInt(portParts[1], 10)
            : 1;
        if (isNaN(port)) {
            port = 1;
        }
        return { sid: parts[0], port: port };
    }

    function blockParameter(element, name) {
        var pElements = element.elements("P");
        var i;
        for (i = 0; i < pElements.length(); i += 1) {
            if (String(pElements[i].attribute("Name")) === name) {
                return String(pElements[i]);
            }
        }
        return null;
    }

    function parseNumberList(text) {
        var parts = String(text).replace(/[\[\]]/g, "").split(",");
        var numbers = [];
        var i;
        for (i = 0; i < parts.length; i += 1) {
            var value = parseFloat(parts[i]);
            if (!isNaN(value)) {
                numbers.push(value);
            }
        }
        return numbers;
    }

    function buildImportedDiagram(comp, model, settings) {
        app.beginUndoGroup("Import Simulink Model");
        var created = 0;
        var wires = 0;
        try {
            ensureThemeLayer(comp);
            var bounds = modelBounds(model.blocks);
            var spanX = Math.max(bounds.maxX - bounds.minX, 1);
            var spanY = Math.max(bounds.maxY - bounds.minY, 1);
            var scale = Math.min(
                (comp.width - 240) / spanX,
                (comp.height - 240) / spanY
            );
            scale = Math.max(1, Math.min(scale, 4));
            var midX = (bounds.minX + bounds.maxX) / 2;
            var midY = (bounds.minY + bounds.maxY) / 2;

            var layersBySid = {};
            var i;
            for (i = 0; i < model.blocks.length; i += 1) {
                var block = model.blocks[i];
                var label = block.name !== ""
                    ? block.name
                    : block.blockType;
                layersBySid[block.sid] = buildNode(
                    comp,
                    nodeKindForBlockType(block.blockType),
                    false,
                    label,
                    [
                        (block.center[0] - midX) * scale + comp.width / 2,
                        (block.center[1] - midY) * scale + comp.height / 2
                    ]
                );
                created += 1;
            }

            for (i = 0; i < model.connections.length; i += 1) {
                var connection = model.connections[i];
                createConnector(
                    comp,
                    layersBySid[connection.src.sid],
                    layersBySid[connection.dst.sid],
                    importedWireSettings(settings, model, connection)
                );
                wires += 1;
            }
            deselectAllLayers(comp);
        } catch (error) {
            alert(
                "The import stopped after " + created + " blocks and " +
                    wires + " signals.\n\n" + error.toString(),
                SCRIPT_NAME
            );
            return;
        } finally {
            app.endUndoGroup();
        }
        alert(
            "Imported " + created + " blocks and " + wires + " signals.",
            SCRIPT_NAME
        );
    }

    function importedWireSettings(settings, model, connection) {
        return {
            route: settings.route,
            startSide: "Right",
            endSide: "Left",
            startOffset: portOffsetPercent(
                connection.src.port,
                model.outCounts[connection.src.sid]
            ),
            endOffset: portOffsetPercent(
                connection.dst.port,
                model.inCounts[connection.dst.sid]
            ),
            arrowhead: settings.arrowhead,
            strokeWidth: settings.strokeWidth,
            headSize: settings.headSize,
            duration: settings.duration,
            color: settings.color
        };
    }

    function portOffsetPercent(port, portCount) {
        var count = (portCount === undefined || portCount < 1)
            ? 1
            : portCount;
        if (count === 1) {
            return 0;
        }
        return ((port - (count + 1) / 2) / (count + 1)) * 100;
    }

    function nodeKindForBlockType(blockType) {
        if (blockType === "Gain") {
            return "triangle";
        }
        if (blockType === "Sum" || blockType === "Product") {
            return "circle";
        }
        if (blockType === "Inport" || blockType === "Outport") {
            return "rounded";
        }
        if (blockType === "Switch" || blockType === "ManualSwitch") {
            return "diamond";
        }
        return "rectangle";
    }

    function modelBounds(blocks) {
        var bounds = {
            minX: blocks[0].center[0],
            maxX: blocks[0].center[0],
            minY: blocks[0].center[1],
            maxY: blocks[0].center[1]
        };
        var i;
        for (i = 1; i < blocks.length; i += 1) {
            bounds.minX = Math.min(bounds.minX, blocks[i].center[0]);
            bounds.maxX = Math.max(bounds.maxX, blocks[i].center[0]);
            bounds.minY = Math.min(bounds.minY, blocks[i].center[1]);
            bounds.maxY = Math.max(bounds.maxY, blocks[i].center[1]);
        }
        return bounds;
    }

    function startSelectionTracker() {
        stopSelectionTracker();
        $.global.__flowDiagramTrackSelection = trackSelection;
        $.global.__flowDiagramTrackerTask = app.scheduleTask(
            "$.global.__flowDiagramTrackSelection()",
            250,
            true
        );
    }

    function stopSelectionTracker() {
        if (
            $.global.__flowDiagramTrackerTask !== undefined &&
            $.global.__flowDiagramTrackerTask !== null
        ) {
            try {
                app.cancelTask($.global.__flowDiagramTrackerTask);
            } catch (error) {
                // The task may already have ended during application shutdown.
            }
        }
        $.global.__flowDiagramTrackerTask = null;
    }

    function trackSelection() {
        var comp = activeComp();
        if (comp === null) {
            trackedNodeOrder = [];
            previousNodeIds = [];
            return;
        }
        if (!trackedNodesAlive()) {
            trackedNodeOrder = [];
            previousNodeIds = [];
        }
        var nodes = selectedGeneratedNodes(comp);
        var ids = nodeIds(nodes);

        if (nodes.length === 1) {
            if (
                previousNodeIds.length !== 1 ||
                previousNodeIds[0] !== ids[0]
            ) {
                trackedNodeOrder = [nodes[0]];
            }
        } else if (nodes.length === 2) {
            if (trackedNodeOrder.length === 1) {
                var firstId = layerId(trackedNodeOrder[0]);
                var added = null;
                var i;
                for (i = 0; i < nodes.length; i += 1) {
                    if (layerId(nodes[i]) !== firstId) {
                        added = nodes[i];
                    }
                }
                if (added !== null) {
                    trackedNodeOrder = [trackedNodeOrder[0], added];
                }
            } else if (!sameIdSet(nodeIds(trackedNodeOrder), ids)) {
                trackedNodeOrder = [nodes[0], nodes[1]];
            }
        } else {
            trackedNodeOrder = [];
        }
        previousNodeIds = ids;
    }

    function orderedSelectedNodes(selectedNodes) {
        if (
            trackedNodesAlive() &&
            trackedNodeOrder.length === 2 &&
            sameIdSet(nodeIds(trackedNodeOrder), nodeIds(selectedNodes))
        ) {
            return [trackedNodeOrder[0], trackedNodeOrder[1]];
        }
        return [selectedNodes[0], selectedNodes[1]];
    }

    function selectedGeneratedNodes(comp) {
        var layers = comp.selectedLayers;
        var nodes = [];
        var seen = {};
        var i;
        for (i = 0; i < layers.length; i += 1) {
            var node = resolveNodeLayer(layers[i]);
            if (node !== null && !seen[layerId(node)]) {
                seen[layerId(node)] = true;
                nodes.push(node);
            }
        }
        return nodes;
    }

    function applyNodeColorChoice(settings) {
        var comp = activeComp();
        if (comp === null) {
            return;
        }
        if (selectedGeneratedNodes(comp).length > 0) {
            updateSelectedNodesAppearance(settings);
        } else {
            updateThemeColors(settings);
        }
    }

    function applyConnectorColorChoice(color) {
        var comp = activeComp();
        if (comp === null) {
            return;
        }
        if (selectedConnectors(comp).length > 0) {
            updateSelectedConnectors({ color: color });
        } else {
            updateThemeColors({ connectorColor: color });
        }
    }

    function updateThemeColors(settings) {
        var comp = activeComp();
        if (comp === null) {
            return;
        }
        app.beginUndoGroup("Update Flow Diagram Theme");
        try {
            var theme = ensureThemeLayer(comp);
            if (settings.fill !== undefined) {
                effectValue(theme, "Node Fill").setValue(settings.fill);
            }
            if (settings.stroke !== undefined) {
                effectValue(theme, "Node Border").setValue(settings.stroke);
            }
            if (settings.connectorColor !== undefined) {
                effectValue(theme, "Connector Color").setValue(
                    settings.connectorColor
                );
            }
        } finally {
            app.endUndoGroup();
        }
    }

    function themePresetNames() {
        var names = [];
        var i;
        for (i = 0; i < THEME_PRESETS.length; i += 1) {
            names.push(THEME_PRESETS[i].name);
        }
        return names;
    }

    function applyThemePreset(preset) {
        var comp = activeComp();
        if (comp === null) {
            alert("Open a composition to apply a theme preset.", SCRIPT_NAME);
            return;
        }

        app.beginUndoGroup("Apply Flow Diagram Theme Preset");
        try {
            var theme = ensureThemeLayer(comp);
            effectValue(theme, "Node Fill").setValue(preset.nodeFill);
            effectValue(theme, "Node Border").setValue(preset.nodeStroke);
            effectValue(theme, "Connector Color").setValue(
                preset.connectorColor
            );
            effectValue(theme, "Text Color").setValue(preset.textColor);
            effectValue(theme, "Shadow Opacity").setValue(
                preset.shadowOpacity
            );
        } catch (error) {
            alert(
                "The theme preset could not be applied.\n\n" +
                    error.toString(),
                SCRIPT_NAME
            );
            return;
        } finally {
            app.endUndoGroup();
        }

        selectedNodeFill = preset.nodeFill;
        selectedNodeStroke = preset.nodeStroke;
        selectedColor = preset.connectorColor;
        selectedColorIsMixed = false;
        saveColorSetting("nodeFill", preset.nodeFill);
        saveColorSetting("nodeStroke", preset.nodeStroke);
        saveColorSetting("connectorColor", preset.connectorColor);
        saveColorSetting("textColor", preset.textColor);
        saveSetting("shadowOpacity", preset.shadowOpacity);
        saveSetting("themePreset", preset.name);

        if (ui !== null) {
            ui.nodeFillRow.setColor(preset.nodeFill);
            ui.nodeStrokeRow.setColor(preset.nodeStroke);
            ui.colorValue.text = rgbToHex(preset.connectorColor);
            ui.colorButton.notify("onDraw");
        }
    }

    function relinkSelectionToTheme() {
        var comp = activeComp();
        if (comp === null) {
            alert(
                "Open a composition and select generated layers.",
                SCRIPT_NAME
            );
            return;
        }
        var nodes = selectedGeneratedNodes(comp);
        var connectors = selectedConnectors(comp);
        if (nodes.length === 0 && connectors.length === 0) {
            alert(
                "Select generated nodes or connectors to re-link.",
                SCRIPT_NAME
            );
            return;
        }

        app.beginUndoGroup("Re-link Flow Diagram Theme");
        try {
            ensureThemeLayer(comp);
            var i;
            for (i = 0; i < nodes.length; i += 1) {
                linkNodeToTheme(nodes[i]);
            }
            for (i = 0; i < connectors.length; i += 1) {
                linkConnectorToTheme(connectors[i]);
            }
        } catch (error) {
            alert(
                "The selection could not be re-linked.\n\n" + error.toString(),
                SCRIPT_NAME
            );
        } finally {
            app.endUndoGroup();
        }
    }

    function linkNodeToTheme(node) {
        var group = findDirectChild(
            node.property("ADBE Root Vectors Group"),
            "Node Geometry",
            "ADBE Vector Group"
        );
        if (group !== null) {
            var contents = group.property("ADBE Vectors Group");
            var fill = findDirectChild(
                contents,
                "Node Fill",
                "ADBE Vector Graphic - Fill"
            );
            var stroke = findDirectChild(
                contents,
                "Node Border",
                "ADBE Vector Graphic - Stroke"
            );
            var fillThemeControl = isDotNode(node)
                ? "Connector Color"
                : "Node Fill";
            var strokeThemeControl = isDotNode(node)
                ? "Connector Color"
                : "Node Border";
            if (fill !== null) {
                fill.property("ADBE Vector Fill Color").expression =
                    themeColorExpression(fillThemeControl);
            }
            if (stroke !== null) {
                stroke.property("ADBE Vector Stroke Color").expression =
                    themeColorExpression(strokeThemeControl);
            }
        }

        var effects = node.property("ADBE Effect Parade");
        var shadow = effects.property("Node Shadow");
        if (shadow !== null) {
            shadow.property("ADBE Drop Shadow-0002").expression =
                themeSliderExpression("Shadow Opacity");
        }

        var textLayer = nodeTextLayer(node);
        if (textLayer !== null) {
            textLayer.property("ADBE Text Properties")
                .property("ADBE Text Document")
                .expression = themeTextExpression();
        }
    }

    function linkConnectorToTheme(connector) {
        effectValue(connector, "Connector Color").expression =
            themeColorExpression("Connector Color");
    }

    function bakeGeneratedLayers() {
        var comp = activeComp();
        if (comp === null) {
            alert("Open a composition to bake.", SCRIPT_NAME);
            return;
        }

        var nodes = selectedGeneratedNodes(comp);
        var connectors = selectedConnectors(comp);
        if (nodes.length === 0 && connectors.length === 0) {
            var i;
            for (i = 1; i <= comp.numLayers; i += 1) {
                var layer = comp.layer(i);
                if (isNodeLayer(layer)) {
                    nodes.push(layer);
                } else if (layer.comment === CONNECTOR_TAG) {
                    connectors.push(layer);
                }
            }
            if (nodes.length === 0 && connectors.length === 0) {
                alert(
                    "This composition has no generated layers to bake.",
                    SCRIPT_NAME
                );
                return;
            }
            if (
                !confirm(
                    "Bake all " + (nodes.length + connectors.length) +
                        " generated layers in \"" + comp.name + "\"?\n\n" +
                        "Baking freezes their expressions, so they stop " +
                        "following nodes and the theme. This cannot be " +
                        "re-linked except for colors via Use Theme.",
                    false,
                    SCRIPT_NAME
                )
            ) {
                return;
            }
        }

        app.beginUndoGroup("Bake Flow Diagram Layers");
        try {
            var index;
            for (index = 0; index < connectors.length; index += 1) {
                bakeConnector(comp, connectors[index]);
            }
            for (index = 0; index < nodes.length; index += 1) {
                bakeNode(nodes[index]);
            }
        } catch (error) {
            alert(
                "The layers could not be baked.\n\n" + error.toString(),
                SCRIPT_NAME
            );
        } finally {
            app.endUndoGroup();
        }
    }

    function bakeNode(node) {
        freezeLayerExpressions(node);
        var textLayer = nodeTextLayer(node);
        if (textLayer !== null) {
            freezeLayerExpressions(textLayer);
        }
        var measureLayer = nodeMeasureLayer(node);
        if (measureLayer !== null) {
            freezeLayerExpressions(measureLayer);
        }
    }

    function bakeConnector(comp, connector) {
        // The arrowhead rides the draw-on animation, so its transform must
        // be baked to keyframes before the static freeze pass.
        var trimEnd = null;
        try {
            trimEnd = connectorTrimEnd(connector);
        } catch (missingStructureError) {
            trimEnd = null;
        }
        var group = findDirectChild(
            connector.property("ADBE Root Vectors Group"),
            "Connector Geometry",
            "ADBE Vector Group"
        );
        var head = group === null
            ? null
            : findDirectChild(
                group.property("ADBE Vectors Group"),
                "Arrowhead",
                "ADBE Vector Group"
            );
        if (head !== null && trimEnd !== null && trimEnd.numKeys >= 2) {
            var transform = head.property("ADBE Vector Transform Group");
            var startTime = trimEnd.keyTime(1);
            var endTime = trimEnd.keyTime(trimEnd.numKeys);
            bakeExpressionToKeyframes(
                transform.property("ADBE Vector Position"),
                startTime,
                endTime,
                comp.frameDuration
            );
            bakeExpressionToKeyframes(
                transform.property("ADBE Vector Rotation"),
                startTime,
                endTime,
                comp.frameDuration
            );
        }
        freezeLayerExpressions(connector);
    }

    function bakeExpressionToKeyframes(prop, startTime, endTime, step) {
        if (prop === null || prop.expression === "") {
            return;
        }
        var times = [];
        var values = [];
        var t = startTime;
        while (t <= endTime + step / 2) {
            times.push(t);
            values.push(prop.valueAtTime(t, false));
            t += step;
        }
        prop.expression = "";
        prop.setValuesAtTimes(times, values);
    }

    function freezeLayerExpressions(layer) {
        freezePropertyTree(layer);
    }

    function freezePropertyTree(propertyGroup) {
        var i;
        for (i = 1; i <= propertyGroup.numProperties; i += 1) {
            var prop = propertyGroup.property(i);
            if (prop.propertyType === PropertyType.PROPERTY) {
                freezeExpression(prop);
            } else {
                freezePropertyTree(prop);
            }
        }
    }

    function freezeExpression(prop) {
        if (
            prop === null ||
            !prop.canSetExpression ||
            prop.expression === ""
        ) {
            return;
        }
        var frozen = prop.value;
        prop.expression = "";
        try {
            prop.setValue(frozen);
        } catch (error) {
            // Some property types refuse setValue; removing the expression
            // already leaves them at their static value.
        }
    }

    function nodeMeasureLayer(node) {
        var effect = node.property("ADBE Effect Parade")
            .property("Text Measure");
        if (effect === null) {
            return null;
        }
        return layerFromControlValue(node, effect.property(1).value);
    }

    function nodeTextLayer(node) {
        var effect = node.property("ADBE Effect Parade").property("Node Text");
        if (effect === null) {
            return null;
        }
        return layerFromControlValue(node, effect.property(1).value);
    }

    function updateSelectedNodesAppearance(settings) {
        var comp = activeComp();
        if (comp === null) {
            return;
        }
        var nodes = selectedGeneratedNodes(comp);
        if (nodes.length === 0) {
            return;
        }

        app.beginUndoGroup("Update Flow Diagram Nodes");
        try {
            var i;
            for (i = 0; i < nodes.length; i += 1) {
                var group = findDirectChild(
                    nodes[i].property("ADBE Root Vectors Group"),
                    "Node Geometry",
                    "ADBE Vector Group"
                );
                if (group === null) {
                    continue;
                }
                var contents = group.property("ADBE Vectors Group");
                var fill = findDirectChild(
                    contents,
                    "Node Fill",
                    "ADBE Vector Graphic - Fill"
                );
                var stroke = findDirectChild(
                    contents,
                    "Node Border",
                    "ADBE Vector Graphic - Stroke"
                );
                if (settings.fill !== undefined && fill !== null) {
                    var fillColor = fill.property("ADBE Vector Fill Color");
                    fillColor.expression = "";
                    fillColor.setValue(settings.fill);
                }
                if (settings.stroke !== undefined && stroke !== null) {
                    var strokeColor = stroke.property(
                        "ADBE Vector Stroke Color"
                    );
                    strokeColor.expression = "";
                    strokeColor.setValue(settings.stroke);
                }
            }
        } finally {
            app.endUndoGroup();
        }
    }

    function resolveNodeLayer(layer) {
        if (isNodeLayer(layer)) {
            return layer;
        }
        if (
            (layer.comment === TEXT_TAG || layer.comment === MEASURE_TAG) &&
            layer.parent !== null &&
            isNodeLayer(layer.parent)
        ) {
            return layer.parent;
        }
        return null;
    }

    function nodeKindFromComment(layer) {
        if (!isNodeLayer(layer)) {
            return "";
        }
        var parts = layer.comment.split("|");
        return parts.length > 1 ? parts[1] : "";
    }

    function isDotNode(layer) {
        return nodeKindFromComment(layer) === "dot";
    }

    function isNodeLayer(layer) {
        return layer !== null &&
            layer.comment !== null &&
            layer.comment.indexOf(NODE_TAG + "|") === 0;
    }

    function selectedConnectors(comp) {
        var result = [];
        var layers = comp.selectedLayers;
        var i;
        for (i = 0; i < layers.length; i += 1) {
            if (layers[i].comment === CONNECTOR_TAG) {
                result.push(layers[i]);
            }
        }
        return result;
    }

    function moveConnectorBehindNodes(connector, startNode, endNode) {
        var comp = connector.containingComp;
        var bottom = startNode.index > endNode.index ? startNode : endNode;
        var i;
        for (i = 1; i <= comp.numLayers; i += 1) {
            var layer = comp.layer(i);
            if (
                (layer.parent === startNode || layer.parent === endNode) &&
                layer.index > bottom.index
            ) {
                bottom = layer;
            }
        }
        connector.moveAfter(bottom);
    }

    function connectorTrimEnd(connector) {
        var group = findDirectChild(
            connector.property("ADBE Root Vectors Group"),
            "Connector Geometry",
            "ADBE Vector Group"
        );
        if (group === null) {
            throw new Error("Missing Connector Geometry.");
        }
        var trim = findDirectChild(
            group.property("ADBE Vectors Group"),
            "Draw On",
            "ADBE Vector Filter - Trim"
        );
        if (trim === null) {
            throw new Error("Missing Draw On.");
        }
        return trim.property("ADBE Vector Trim End");
    }

    function addLayerControl(effects, name, layer) {
        var effect = effects.addProperty("ADBE Layer Control");
        effect.name = name;
        effect.property(1).setValue(layer.index);
        return effect;
    }

    function addSliderControl(effects, name, value) {
        var effect = effects.addProperty("ADBE Slider Control");
        effect.name = name;
        effect.property(1).setValue(value);
        return effect;
    }

    function addColorControl(effects, name, value) {
        var effect = effects.addProperty("ADBE Color Control");
        effect.name = name;
        effect.property(1).setValue(value);
        return effect;
    }

    function addDropdownControl(effects, name, items, selectedIndex) {
        var effect = effects.addProperty("ADBE Dropdown Control");
        var effectIndex = effect.propertyIndex;
        effect.property(1).setPropertyParameters(items);

        // setPropertyParameters replaces the menu object and invalidates related
        // references. Reacquire the effect before naming it or setting its value.
        effect = effects.property(effectIndex);
        effect.name = name;
        var menu = effect.property(1);
        menu.setValue(selectedIndex);
        return effect;
    }

    function setArialFont(document) {
        try {
            document.font = "ArialMT";
        } catch (arialError) {
            try {
                document.font = "Arial";
            } catch (fallbackError) {
                // Keep AE's current default if Arial is unavailable.
            }
        }
    }

    function effectValue(layer, name) {
        var effect = layer.property("ADBE Effect Parade").property(name);
        if (effect === null) {
            throw new Error("Missing " + name + " control.");
        }
        return effect.property(1);
    }

    function configureIdentityTransform(layer) {
        var transform = layer.property("ADBE Transform Group");
        transform.property("ADBE Anchor Point").setValue([0, 0]);
        transform.property("ADBE Position").setValue([0, 0]);
        transform.property("ADBE Scale").setValue([100, 100]);
        transform.property("ADBE Rotate Z").setValue(0);
    }

    function setLayerPosition(layer, value) {
        layer.property("ADBE Transform Group")
            .property("ADBE Position")
            .setValue(value);
    }

    function applyEasing(property, preset) {
        if (property.numKeys < 2) {
            return;
        }
        var firstKey = 1;
        var lastKey = property.numKeys;
        var linear = KeyframeInterpolationType.LINEAR;
        var bezier = KeyframeInterpolationType.BEZIER;
        var ease = new KeyframeEase(0, 33.333);

        if (preset === "Linear") {
            property.setInterpolationTypeAtKey(firstKey, linear, linear);
            property.setInterpolationTypeAtKey(lastKey, linear, linear);
        } else if (preset === "Ease In") {
            property.setInterpolationTypeAtKey(firstKey, linear, linear);
            property.setInterpolationTypeAtKey(lastKey, bezier, bezier);
            property.setTemporalEaseAtKey(lastKey, [ease], [ease]);
        } else if (preset === "Ease Out") {
            property.setInterpolationTypeAtKey(firstKey, bezier, bezier);
            property.setTemporalEaseAtKey(firstKey, [ease], [ease]);
            property.setInterpolationTypeAtKey(lastKey, linear, linear);
        } else {
            property.setInterpolationTypeAtKey(firstKey, bezier, bezier);
            property.setTemporalEaseAtKey(firstKey, [ease], [ease]);
            property.setInterpolationTypeAtKey(lastKey, bezier, bezier);
            property.setTemporalEaseAtKey(lastKey, [ease], [ease]);
        }
    }

    function inferEasing(property) {
        if (property.numKeys < 2) {
            return "Linear";
        }
        var firstIsBezier =
            property.keyOutInterpolationType(1) === KeyframeInterpolationType.BEZIER;
        var lastIsBezier =
            property.keyInInterpolationType(property.numKeys) ===
            KeyframeInterpolationType.BEZIER;
        if (firstIsBezier && lastIsBezier) {
            return "Easy Ease";
        }
        if (firstIsBezier) {
            return "Ease Out";
        }
        if (lastIsBezier) {
            return "Ease In";
        }
        return "Linear";
    }

    function activeComp() {
        var comp = app.project ? app.project.activeItem : null;
        return comp instanceof CompItem ? comp : null;
    }

    function nodeDisplayName(kind) {
        if (kind === "rectangle") {
            return "Rectangle Node";
        }
        if (kind === "square") {
            return "Square Node";
        }
        if (kind === "circle") {
            return "Circle Node";
        }
        if (kind === "dot") {
            return "Dot Node";
        }
        if (kind === "diamond") {
            return "Diamond Node";
        }
        if (kind === "triangle") {
            return "Triangle Node";
        }
        if (kind === "hexagon") {
            return "Hexagon Node";
        }
        return "Rounded Node";
    }

    function nodeKindCode(kind) {
        if (kind === "circle") {
            return 2;
        }
        if (kind === "diamond") {
            return 3;
        }
        if (kind === "triangle") {
            return 4;
        }
        if (kind === "square") {
            return 5;
        }
        if (kind === "rectangle") {
            return 6;
        }
        if (kind === "dot") {
            return 7;
        }
        if (kind === "hexagon") {
            return 8;
        }
        return 1;
    }

    function isAltDown() {
        try {
            return ScriptUI.environment.keyboardState.altKey;
        } catch (error) {
            return false;
        }
    }

    function uniqueLayerName(comp, baseName) {
        var name = baseName;
        var suffix = 2;
        while (layerNameExists(comp, name)) {
            name = baseName + " " + suffix;
            suffix += 1;
        }
        return name;
    }

    function layerNameExists(comp, name) {
        var i;
        for (i = 1; i <= comp.numLayers; i += 1) {
            if (comp.layer(i).name === name) {
                return true;
            }
        }
        return false;
    }

    function findDirectChild(parent, name, matchName) {
        var i;
        for (i = 1; i <= parent.numProperties; i += 1) {
            var property = parent.property(i);
            if (
                property.name === name &&
                (matchName === undefined || property.matchName === matchName)
            ) {
                return property;
            }
        }
        return null;
    }

    function parsePositiveNumber(text, label, quiet) {
        var value = parseFloat(text);
        if (isNaN(value) || value <= 0) {
            if (!quiet) {
                alert(label + " must be a number greater than zero.", SCRIPT_NAME);
            }
            return null;
        }
        return value;
    }

    function parseOffsetNumber(text, label, quiet) {
        var value = parseFloat(text);
        if (isNaN(value) || value < -50 || value > 50) {
            if (!quiet) {
                alert(
                    label + " must be a number between -50 and 50.",
                    SCRIPT_NAME
                );
            }
            return null;
        }
        return value;
    }

    function dropdownIndex(items, value) {
        var i;
        for (i = 0; i < items.length; i += 1) {
            if (items[i] === value) {
                return i + 1;
            }
        }
        return 1;
    }

    function dropdownName(items, value) {
        var index = Math.max(1, Math.min(items.length, Math.round(value)));
        return items[index - 1];
    }

    function setDropdownValue(dropdown, value) {
        dropdown.selection = null;
        if (value === null) {
            return;
        }
        var i;
        for (i = 0; i < dropdown.items.length; i += 1) {
            if (dropdown.items[i].text === value) {
                dropdown.selection = i;
                return;
            }
        }
    }

    function commonNumber(values, propertyName) {
        var first = values[0][propertyName];
        var i;
        for (i = 1; i < values.length; i += 1) {
            if (Math.abs(values[i][propertyName] - first) > 0.001) {
                return null;
            }
        }
        return first;
    }

    function commonText(values, propertyName) {
        var first = values[0][propertyName];
        var i;
        for (i = 1; i < values.length; i += 1) {
            if (values[i][propertyName] !== first) {
                return null;
            }
        }
        return first;
    }

    function commonColor(values, propertyName) {
        var first = values[0][propertyName];
        var i;
        var channel;
        for (i = 1; i < values.length; i += 1) {
            for (channel = 0; channel < 3; channel += 1) {
                if (
                    Math.abs(values[i][propertyName][channel] - first[channel]) >
                    0.001
                ) {
                    return null;
                }
            }
        }
        return first;
    }

    function displayNumber(value) {
        if (value === null) {
            return "--";
        }
        return String(Math.round(value * 1000) / 1000);
    }

    function findThemeLayer(comp) {
        var i;
        for (i = 1; i <= comp.numLayers; i += 1) {
            if (comp.layer(i).comment === THEME_TAG) {
                return comp.layer(i);
            }
        }
        return null;
    }

    function ensureThemeLayer(comp) {
        var existing = findThemeLayer(comp);
        if (existing !== null) {
            return existing;
        }
        var theme = comp.layers.addNull();
        theme.name = THEME_LAYER_NAME;
        theme.comment = THEME_TAG;
        theme.shy = true;
        theme.guideLayer = true;
        theme.enabled = false;
        theme.moveToEnd();
        var effects = theme.property("ADBE Effect Parade");
        addColorControl(effects, "Node Fill", selectedNodeFill);
        addColorControl(effects, "Node Border", selectedNodeStroke);
        addColorControl(effects, "Connector Color", selectedColor);
        addColorControl(
            effects,
            "Text Color",
            readColorSetting("textColor", DEFAULT_TEXT_COLOR)
        );
        addSliderControl(
            effects,
            "Shadow Opacity",
            readShadowOpacitySetting()
        );
        return theme;
    }

    function themeColorExpression(controlName) {
        return "var c = value;\n" +
            "try {\n" +
            "  c = thisComp.layer(\"" + THEME_LAYER_NAME + "\")" +
            ".effect(\"" + controlName + "\")(\"Color\");\n" +
            "} catch (error) {}\n" +
            "c;";
    }

    function themeSliderExpression(controlName) {
        return "var v = value;\n" +
            "try {\n" +
            "  v = thisComp.layer(\"" + THEME_LAYER_NAME + "\")" +
            ".effect(\"" + controlName + "\")(\"Slider\");\n" +
            "} catch (error) {}\n" +
            "v;";
    }

    function themeTextExpression() {
        return "var s = text.sourceText.style;\n" +
            "try {\n" +
            "  s = s.setFillColor(thisComp.layer(\"" + THEME_LAYER_NAME +
            "\").effect(\"Text Color\")(\"Color\"));\n" +
            "} catch (error) {}\n" +
            "s;";
    }

    function saveSetting(key, value) {
        try {
            app.settings.saveSetting(SETTINGS_SECTION, key, String(value));
        } catch (error) {
            // Settings persistence is best-effort.
        }
    }

    function saveColorSetting(key, rgb) {
        saveSetting(key, rgb[0] + "," + rgb[1] + "," + rgb[2]);
    }

    function readSetting(key) {
        try {
            if (app.settings.haveSetting(SETTINGS_SECTION, key)) {
                return app.settings.getSetting(SETTINGS_SECTION, key);
            }
        } catch (error) {
            // Fall through to the caller's default.
        }
        return null;
    }

    function readNumberSetting(key, fallback) {
        var value = parseFloat(readSetting(key));
        return (isNaN(value) || value <= 0) ? fallback : value;
    }

    function readShadowOpacitySetting() {
        var value = parseFloat(readSetting("shadowOpacity"));
        if (isNaN(value)) {
            return 0;
        }
        return Math.max(0, Math.min(100, value));
    }

    function readOffsetSetting(key, fallback) {
        var value = parseFloat(readSetting(key));
        if (isNaN(value)) {
            return fallback;
        }
        return Math.max(-50, Math.min(50, value));
    }

    function readColorSetting(key, fallback) {
        var text = readSetting(key);
        if (text === null) {
            return fallback;
        }
        var parts = text.split(",");
        if (parts.length !== 3) {
            return fallback;
        }
        var rgb = [
            parseFloat(parts[0]),
            parseFloat(parts[1]),
            parseFloat(parts[2])
        ];
        if (isNaN(rgb[0]) || isNaN(rgb[1]) || isNaN(rgb[2])) {
            return fallback;
        }
        return rgb;
    }

    function settingDropdownIndex(key, items, fallbackIndex) {
        var value = readSetting(key);
        var i;
        for (i = 0; i < items.length; i += 1) {
            if (items[i] === value) {
                return i;
            }
        }
        return fallbackIndex;
    }

    function integerToRgb(value) {
        return [
            ((value >> 16) & 255) / 255,
            ((value >> 8) & 255) / 255,
            (value & 255) / 255
        ];
    }

    function rgbToHex(rgb) {
        function channelToHex(channel) {
            var value = Math.round(channel * 255).toString(16).toUpperCase();
            return value.length === 1 ? "0" + value : value;
        }
        return "#" +
            channelToHex(rgb[0]) +
            channelToHex(rgb[1]) +
            channelToHex(rgb[2]);
    }

    function drawMixedSwatch(graphics, width, height) {
        var x = 4;
        var y = 4;
        var innerWidth = width - 8;
        var innerHeight = height - 8;
        var halfWidth = innerWidth / 2;
        var halfHeight = innerHeight / 2;
        var light = graphics.newBrush(
            graphics.BrushType.SOLID_COLOR,
            [0.72, 0.72, 0.72]
        );
        var dark = graphics.newBrush(
            graphics.BrushType.SOLID_COLOR,
            [0.42, 0.42, 0.42]
        );
        fillRectangle(graphics, x, y, halfWidth, halfHeight, light);
        fillRectangle(graphics, x + halfWidth, y, halfWidth, halfHeight, dark);
        fillRectangle(graphics, x, y + halfHeight, halfWidth, halfHeight, dark);
        fillRectangle(
            graphics,
            x + halfWidth,
            y + halfHeight,
            halfWidth,
            halfHeight,
            light
        );
    }

    function fillRectangle(graphics, x, y, width, height, brush) {
        graphics.rectPath(x, y, width, height);
        graphics.fillPath(brush);
    }

    function layerIsAlive(layer) {
        try {
            // Even comparing an invalidated AE object reference (e.g. a layer
            // removed since it was cached in the persistent engine) throws
            // "Object is invalid", so the whole check must be inside try/catch.
            return layer !== null && layer !== undefined && layer.index > 0;
        } catch (error) {
            return false;
        }
    }

    function trackedNodesAlive() {
        var i;
        for (i = 0; i < trackedNodeOrder.length; i += 1) {
            if (!layerIsAlive(trackedNodeOrder[i])) {
                return false;
            }
        }
        return true;
    }

    function layerId(layer) {
        try {
            return String(layer.id);
        } catch (error) {
            try {
                return layer.name + "|" + layer.index;
            } catch (error2) {
                return "invalid";
            }
        }
    }

    function nodeIds(nodes) {
        var ids = [];
        var i;
        for (i = 0; i < nodes.length; i += 1) {
            ids.push(layerId(nodes[i]));
        }
        return ids;
    }

    function sameIdSet(first, second) {
        if (first.length !== second.length) {
            return false;
        }
        var found = {};
        var i;
        for (i = 0; i < first.length; i += 1) {
            found[first[i]] = true;
        }
        for (i = 0; i < second.length; i += 1) {
            if (!found[second[i]]) {
                return false;
            }
        }
        return true;
    }

    function deselectAllLayers(comp) {
        var i;
        for (i = 1; i <= comp.numLayers; i += 1) {
            comp.layer(i).selected = false;
        }
    }

    function removeLayerQuietly(layer) {
        if (layer !== null) {
            try {
                layer.remove();
            } catch (error) {
                // The layer may already have been removed with its parent.
            }
        }
    }

    var panel = buildUI(thisObj);
    if (panel instanceof Window) {
        panel.center();
        panel.show();
    }
})(this);
