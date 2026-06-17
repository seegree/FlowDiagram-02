#target aftereffects
#targetengine "flowDiagramPanel"

(function flowDiagramPanel(thisObj) {
    var SCRIPT_NAME = "Flow Diagram";
    var NODE_TAG = "Flow Diagram Node";
    var TEXT_TAG = "Flow Diagram Text";
    var MEASURE_TAG = "Flow Diagram Measure";
    var CONNECTOR_TAG = "Flow Diagram Connector";

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

    var selectedColor = DEFAULT_CONNECTOR_COLOR;
    var selectedColorIsMixed = false;
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
        panel.spacing = 8;
        panel.margins = 12;

        var nodePanel = panel.add("panel", undefined, "Create Node");
        nodePanel.orientation = "column";
        nodePanel.alignChildren = ["fill", "top"];
        nodePanel.spacing = 6;
        nodePanel.margins = 10;

        var nodeButtons = nodePanel.add("group");
        nodeButtons.orientation = "row";
        nodeButtons.alignChildren = ["fill", "center"];
        var rectangleButton = nodeButtons.add("button", undefined, "Rounded");
        var circleButton = nodeButtons.add("button", undefined, "Circle");
        var diamondButton = nodeButtons.add("button", undefined, "Diamond");

        var connectorPanel = panel.add("panel", undefined, "Connector");
        connectorPanel.orientation = "column";
        connectorPanel.alignChildren = ["fill", "top"];
        connectorPanel.spacing = 6;
        connectorPanel.margins = 10;

        var typeRow = addDropdownRow(
            connectorPanel,
            "Route",
            ["Straight", "Orthogonal"],
            1
        );
        var startSideRow = addDropdownRow(
            connectorPanel,
            "Start side",
            ["Auto", "Top", "Right", "Bottom", "Left"],
            0
        );
        var endSideRow = addDropdownRow(
            connectorPanel,
            "End side",
            ["Auto", "Top", "Right", "Bottom", "Left"],
            0
        );
        var strokeRow = addNumberRow(
            connectorPanel,
            "Stroke width",
            DEFAULT_STROKE_WIDTH
        );
        var headRow = addNumberRow(
            connectorPanel,
            "Arrowhead size",
            DEFAULT_HEAD_SIZE
        );
        var durationRow = addNumberRow(
            connectorPanel,
            "Duration (seconds)",
            DEFAULT_DURATION
        );
        var easingRow = addDropdownRow(
            connectorPanel,
            "Easing",
            ["Linear", "Easy Ease", "Ease In", "Ease Out"],
            1
        );

        var colorRow = connectorPanel.add("group");
        colorRow.orientation = "row";
        colorRow.alignChildren = ["left", "center"];
        var colorLabel = colorRow.add("statictext", undefined, "Color");
        colorLabel.preferredSize.width = 110;
        var colorButton = colorRow.add("button", undefined, "");
        colorButton.preferredSize = [48, 22];
        colorButton.helpTip = "Choose connector color";
        var colorValue = colorRow.add("statictext", undefined, rgbToHex(selectedColor));
        colorValue.characters = 9;
        var refreshButton = colorRow.add("button", undefined, "\u21BB");
        refreshButton.preferredSize = [24, 22];
        refreshButton.minimumSize = [24, 22];
        refreshButton.maximumSize = [24, 22];
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

        var connectButton = panel.add("button", undefined, "Connect");
        connectButton.alignment = ["fill", "top"];
        connectButton.preferredSize.height = 34;
        var reverseButton = panel.add("button", undefined, "Reverse Direction");
        reverseButton.alignment = ["fill", "top"];
        var repairButton = panel.add("button", undefined, "Repair Selected");
        repairButton.alignment = ["fill", "top"];
        repairButton.helpTip =
            "Repair expressions and native controls on selected generated connectors";

        var helpText = panel.add(
            "statictext",
            undefined,
            "Select two generated nodes in start-to-end order, then Connect. " +
                "Connector controls update selected generated connectors.",
            { multiline: true }
        );
        helpText.alignment = ["fill", "top"];
        helpText.preferredSize.height = 46;

        ui = {
            type: typeRow.input,
            startSide: startSideRow.input,
            endSide: endSideRow.input,
            stroke: strokeRow.input,
            head: headRow.input,
            duration: durationRow.input,
            easing: easingRow.input,
            colorButton: colorButton,
            colorValue: colorValue
        };

        rectangleButton.onClick = function () {
            createNode("rounded");
        };
        circleButton.onClick = function () {
            createNode("circle");
        };
        diamondButton.onClick = function () {
            createNode("diamond");
        };

        colorButton.onClick = function () {
            var picked = $.colorPicker();
            if (picked >= 0) {
                selectedColor = integerToRgb(picked);
                selectedColorIsMixed = false;
                colorValue.text = rgbToHex(selectedColor);
                colorButton.notify("onDraw");
                updateSelectedConnectors({ color: selectedColor });
            }
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
        easingRow.input.onChange = function () {
            updateDropdownControl(easingRow.input, "easing");
        };

        connectButton.onClick = createConnectorFromSelection;
        reverseButton.onClick = reverseSelectedConnectors;
        repairButton.onClick = repairSelectedConnectors;
        refreshButton.onClick = syncControlsFromSelection;
        panel.onActivate = syncControlsFromSelection;
        panel.addEventListener("focus", syncControlsFromSelection, true);

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
        labelControl.preferredSize.width = 110;
        var input = row.add("edittext", undefined, String(defaultValue));
        input.characters = 8;
        return { row: row, input: input };
    }

    function addDropdownRow(parent, label, items, selectedIndex) {
        var row = parent.add("group");
        row.orientation = "row";
        row.alignChildren = ["left", "center"];
        var labelControl = row.add("statictext", undefined, label);
        labelControl.preferredSize.width = 110;
        var input = row.add("dropdownlist", undefined, items);
        input.selection = selectedIndex;
        input.preferredSize.width = 118;
        return { row: row, input: input };
    }

    function updateNumberControl(control, label, propertyName) {
        if (isSyncingControls) {
            return;
        }
        var value = parsePositiveNumber(control.text, label, true);
        if (value !== null) {
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
        var settings = {};
        settings[propertyName] = control.selection.text;
        updateSelectedConnectors(settings);
    }

    function createNode(kind) {
        var comp = activeComp();
        if (comp === null) {
            alert("Open a composition before creating a node.", SCRIPT_NAME);
            return;
        }

        app.beginUndoGroup("Create Flow Diagram Node");
        var shapeLayer = null;
        var textLayer = null;
        var measureLayer = null;

        try {
            shapeLayer = comp.layers.addShape();
            shapeLayer.name = uniqueLayerName(comp, nodeDisplayName(kind));
            shapeLayer.comment = NODE_TAG + "|" + kind;
            shapeLayer.label = 9;

            textLayer = comp.layers.addBoxText([MAX_TEXT_WIDTH, 80]);
            textLayer.name = uniqueLayerName(comp, shapeLayer.name + " Text");
            textLayer.comment = TEXT_TAG;
            configureNodeText(textLayer);

            measureLayer = comp.layers.addText("Node");
            measureLayer.name = uniqueLayerName(comp, shapeLayer.name + " Measure");
            measureLayer.comment = MEASURE_TAG;
            configureMeasureText(measureLayer, textLayer);

            textLayer.parent = shapeLayer;
            measureLayer.parent = shapeLayer;
            setLayerPosition(textLayer, [0, 0]);
            setLayerPosition(measureLayer, [0, 0]);

            var effects = shapeLayer.property("ADBE Effect Parade");
            addLayerControl(effects, "Node Text", textLayer);
            addLayerControl(effects, "Text Measure", measureLayer);
            addNodeGeometry(shapeLayer, kind);

            var offset = (nodeCreationCount % 8) * 28;
            setLayerPosition(
                shapeLayer,
                [comp.width / 2 + offset, comp.height / 2 + offset]
            );
            nodeCreationCount += 1;

            textLayer.moveBefore(shapeLayer);
            measureLayer.moveAfter(textLayer);

            deselectAllLayers(comp);
            shapeLayer.selected = true;
            trackedNodeOrder = [shapeLayer];
            previousNodeIds = [layerId(shapeLayer)];
        } catch (error) {
            removeLayerQuietly(measureLayer);
            removeLayerQuietly(textLayer);
            removeLayerQuietly(shapeLayer);
            alert("The node could not be created.\n\n" + error.toString(), SCRIPT_NAME);
        } finally {
            app.endUndoGroup();
        }
    }

    function configureNodeText(textLayer) {
        var sourceText = textLayer.property("ADBE Text Properties")
            .property("ADBE Text Document");
        var document = sourceText.value;
        document.text = "Node";
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

        var transform = textLayer.property("ADBE Transform Group");
        transform.property("ADBE Anchor Point").expression =
            "var r = sourceRectAtTime(time, false);\n" +
            "[r.left + r.width / 2, r.top + r.height / 2];";
    }

    function configureMeasureText(measureLayer, textLayer) {
        var sourceText = measureLayer.property("ADBE Text Properties")
            .property("ADBE Text Document");
        var document = sourceText.value;
        document.text = "Node";
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

    function addNodeGeometry(shapeLayer, kind) {
        var root = shapeLayer.property("ADBE Root Vectors Group");
        var group = root.addProperty("ADBE Vector Group");
        group.name = "Node Geometry";
        var contents = group.property("ADBE Vectors Group");
        var dimensionsExpression = nodeDimensionsExpression(kind);
        var shapeProperty;

        if (kind === "rounded") {
            shapeProperty = contents.addProperty("ADBE Vector Shape - Rect");
            shapeProperty.name = "Node Shape";
            shapeProperty.property("ADBE Vector Rect Size").expression =
                dimensionsExpression;
            shapeProperty.property("ADBE Vector Rect Roundness").setValue(20);
        } else if (kind === "circle") {
            shapeProperty = contents.addProperty("ADBE Vector Shape - Ellipse");
            shapeProperty.name = "Node Shape";
            shapeProperty.property("ADBE Vector Ellipse Size").expression =
                dimensionsExpression;
        } else {
            shapeProperty = contents.addProperty("ADBE Vector Shape - Group");
            shapeProperty.name = "Node Shape";
            shapeProperty.property("ADBE Vector Shape").expression =
                dimensionsExpression +
                "\nvar w = d[0];\n" +
                "var h = d[1];\n" +
                "createPath([[0,-h/2],[w/2,0],[0,h/2],[-w/2,0]]," +
                "[[0,0],[0,0],[0,0],[0,0]]," +
                "[[0,0],[0,0],[0,0],[0,0]],true);";
        }

        var fill = contents.addProperty("ADBE Vector Graphic - Fill");
        fill.name = "Node Fill";
        fill.property("ADBE Vector Fill Color").setValue(DEFAULT_NODE_FILL);

        var stroke = contents.addProperty("ADBE Vector Graphic - Stroke");
        stroke.name = "Node Border";
        stroke.property("ADBE Vector Stroke Color").setValue(DEFAULT_NODE_STROKE);
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

        if (kind === "circle") {
            return base + "\nvar diameter = Math.max(w, h);\n[diameter, diameter];";
        }
        if (kind === "diamond") {
            return base + "\nvar d = [w * 2, h * 2];";
        }
        return base + "\n[w, h];";
    }

    function createConnectorFromSelection() {
        var comp = activeComp();
        if (comp === null) {
            alert("Open a composition and select two generated nodes.", SCRIPT_NAME);
            return;
        }

        var selectedNodes = selectedGeneratedNodes(comp);
        if (selectedNodes.length !== 2) {
            alert(
                "Select exactly two generated nodes.\n\n" +
                "Select the start node first, then add the destination node.",
                SCRIPT_NAME
            );
            return;
        }

        var orderedNodes = orderedSelectedNodes(selectedNodes);
        var settings = readUiSettings();
        if (settings === null) {
            return;
        }

        app.beginUndoGroup("Connect Flow Diagram Nodes");
        var connector = null;
        try {
            connector = createConnector(
                comp,
                orderedNodes[0],
                orderedNodes[1],
                settings
            );
            deselectAllLayers(comp);
            connector.selected = true;
        } catch (error) {
            removeLayerQuietly(connector);
            alert(
                "The connector could not be created.\n\n" + error.toString(),
                SCRIPT_NAME
            );
        } finally {
            app.endUndoGroup();
        }
    }

    function createConnector(comp, startNode, endNode, settings) {
        if (startNode.threeDLayer || endNode.threeDLayer) {
            throw new Error("Flow Diagram connectors support 2D nodes only.");
        }

        var connector = comp.layers.addShape();
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
            ["Straight", "Orthogonal"],
            dropdownIndex(["Straight", "Orthogonal"], settings.route)
        );
        addDropdownControl(
            effects,
            "Start Side",
            ["Auto", "Top", "Right", "Bottom", "Left"],
            dropdownIndex(
                ["Auto", "Top", "Right", "Bottom", "Left"],
                settings.startSide
            )
        );
        addDropdownControl(
            effects,
            "End Side",
            ["Auto", "Top", "Right", "Bottom", "Left"],
            dropdownIndex(
                ["Auto", "Top", "Right", "Bottom", "Left"],
                settings.endSide
            )
        );
        addSliderControl(effects, "Stroke Width", settings.strokeWidth);
        addSliderControl(effects, "Arrowhead Size", settings.headSize);
        addColorControl(effects, "Connector Color", settings.color);

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
        applyEasing(trimEnd, settings.easing);

        var head = contents.addProperty("ADBE Vector Group");
        head.name = "Arrowhead";
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
            "function resolvedSide(choice, fromLayer, toLayer) {",
            "  return choice === 1 ? autoSide(fromLayer, toLayer) : choice;",
            "}",
            "function edge(layer, side) {",
            "  var r = layer.sourceRectAtTime(time, true);",
            "  if (side === 2) return layer.toComp([r.left + r.width/2, r.top]);",
            "  if (side === 3) return layer.toComp([r.left + r.width, r.top + r.height/2]);",
            "  if (side === 4) return layer.toComp([r.left + r.width/2, r.top + r.height]);",
            "  return layer.toComp([r.left, r.top + r.height/2]);",
            "}",
            "function normal(side) {",
            "  if (side === 2) return [0,-1];",
            "  if (side === 3) return [1,0];",
            "  if (side === 4) return [0,1];",
            "  return [-1,0];",
            "}",
            "function add(p, n, amount) { return [p[0]+n[0]*amount, p[1]+n[1]*amount]; }",
            "function local(p) { return fromComp(p); }",
            "function same(p, q) { return Math.abs(p[0]-q[0]) < 0.01 && Math.abs(p[1]-q[1]) < 0.01; }",
            "function clean(points) {",
            "  var result = [];",
            "  for (var i = 0; i < points.length; i++) {",
            "    if (result.length === 0 || !same(result[result.length-1], points[i])) result.push(points[i]);",
            "  }",
            "  return result;",
            "}",
            "",
            "var ss = resolvedSide(startChoice, a, b);",
            "var es = resolvedSide(endChoice, b, a);",
            "var p0 = edge(a, ss);",
            "var p3 = edge(b, es);",
            "var points = [p0, p3];",
            "if (route === 2) {",
            "  var ns = normal(ss);",
            "  var ne = normal(es);",
            "  var s1 = add(p0, ns, clearance);",
            "  var e1 = add(p3, ne, clearance);",
            "  points = [p0, s1];",
            "  var startHorizontal = ns[0] !== 0;",
            "  var endHorizontal = ne[0] !== 0;",
            "  if (startHorizontal && endHorizontal) {",
            "    var mx;",
            "    if (ns[0] === ne[0]) mx = ns[0] > 0 ? Math.max(s1[0],e1[0])+clearance : Math.min(s1[0],e1[0])-clearance;",
            "    else mx = (s1[0]+e1[0])/2;",
            "    points.push([mx,s1[1]], [mx,e1[1]]);",
            "  } else if (!startHorizontal && !endHorizontal) {",
            "    var my;",
            "    if (ns[1] === ne[1]) my = ns[1] > 0 ? Math.max(s1[1],e1[1])+clearance : Math.min(s1[1],e1[1])-clearance;",
            "    else my = (s1[1]+e1[1])/2;",
            "    points.push([s1[0],my], [e1[0],my]);",
            "  } else if (startHorizontal) {",
            "    points.push([e1[0],s1[1]]);",
            "  } else {",
            "    points.push([s1[0],e1[1]]);",
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

        transform.property("ADBE Vector Position").expression =
            "var p = " + pathReference + ";\n" +
            "var progress = Math.max(0, Math.min(1, " + trimReference + " / 100));\n" +
            "var points = p.points();\n" +
            "if (points.length < 2) {\n" +
            "  [0, 0];\n" +
            "} else {\n" +
            "  var direction = p.tangentOnPath(progress);\n" +
            "  p.pointOnPath(progress) + normalize(direction) * " +
            strokeReference + ";\n" +
            "}";
        transform.property("ADBE Vector Rotation").expression =
            "var p = " + pathReference + ";\n" +
            "var progress = Math.max(0, Math.min(1, " + trimReference + " / 100));\n" +
            "var points = p.points();\n" +
            "if (points.length < 2) {\n" +
            "  0;\n" +
            "} else {\n" +
            "  var direction = p.tangentOnPath(progress);\n" +
            "  radiansToDegrees(Math.atan2(direction[1], direction[0]));\n" +
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
        if (settings.color !== undefined) {
            effectValue(connector, "Connector Color").setValue(settings.color);
        }
        if (settings.route !== undefined) {
            effectValue(connector, "Route").setValue(
                dropdownIndex(["Straight", "Orthogonal"], settings.route)
            );
        }
        if (settings.startSide !== undefined) {
            effectValue(connector, "Start Side").setValue(
                dropdownIndex(
                    ["Auto", "Top", "Right", "Bottom", "Left"],
                    settings.startSide
                )
            );
        }
        if (settings.endSide !== undefined) {
            effectValue(connector, "End Side").setValue(
                dropdownIndex(
                    ["Auto", "Top", "Right", "Bottom", "Left"],
                    settings.endSide
                )
            );
        }

        var trimEnd = connectorTrimEnd(connector);
        if (settings.duration !== undefined) {
            var currentEasing = inferEasing(trimEnd);
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
            applyEasing(trimEnd, currentEasing);
        }
        if (settings.easing !== undefined) {
            applyEasing(trimEnd, settings.easing);
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
        var startLayerIndex = startControl.value;
        startControl.setValue(endControl.value);
        endControl.setValue(startLayerIndex);

        var startSide = effectValue(connector, "Start Side");
        var endSide = effectValue(connector, "End Side");
        var startSideValue = startSide.value;
        startSide.setValue(endSide.value);
        endSide.setValue(startSideValue);
    }

    function repairSelectedConnectors() {
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

        app.beginUndoGroup("Repair Flow Diagram Connectors");
        try {
            var i;
            for (i = 0; i < connectors.length; i += 1) {
                repairConnector(connectors[i]);
            }
            alert(
                connectors.length === 1
                    ? "The selected connector was repaired."
                    : connectors.length + " selected connectors were repaired.",
                SCRIPT_NAME
            );
        } catch (error) {
            alert(
                "The selected connector could not be repaired.\n\n" +
                    error.toString(),
                SCRIPT_NAME
            );
        } finally {
            app.endUndoGroup();
        }
    }

    function repairConnector(connector) {
        var effects = connector.property("ADBE Effect Parade");
        var dropdownNames = ["Route", "Start Side", "End Side"];
        var dropdownIndexValue = 0;
        var i;

        for (i = 1; i <= effects.numProperties; i += 1) {
            var effect = effects.property(i);
            if (
                effect.matchName === "ADBE Dropdown Control" &&
                dropdownIndexValue < dropdownNames.length
            ) {
                effect.name = dropdownNames[dropdownIndexValue];
                dropdownIndexValue += 1;
            }
        }
        if (dropdownIndexValue !== dropdownNames.length) {
            throw new Error("The connector is missing one or more route controls.");
        }

        var group = findDirectChild(
            connector.property("ADBE Root Vectors Group"),
            "Connector Geometry",
            "ADBE Vector Group"
        );
        if (group === null) {
            throw new Error("The connector is missing Connector Geometry.");
        }
        var contents = group.property("ADBE Vectors Group");
        var pathGroup = findDirectChild(
            contents,
            "Connector Path",
            "ADBE Vector Shape - Group"
        );
        var head = findDirectChild(
            contents,
            "Arrowhead",
            "ADBE Vector Group"
        );
        if (pathGroup === null || head === null) {
            throw new Error("The connector is missing its path or arrowhead.");
        }

        pathGroup.property("ADBE Vector Shape").expression =
            connectorPathExpression();
        pathGroup.property("ADBE Vector Shape").expressionEnabled = true;
        applyConnectorArrowheadExpressions(head);
    }

    function syncControlsFromSelection() {
        if (ui === null) {
            return;
        }
        var comp = activeComp();
        if (comp === null) {
            return;
        }
        var connectors = selectedConnectors(comp);
        if (connectors.length === 0) {
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
            ui.duration.text = displayNumber(commonNumber(values, "duration"));
            setDropdownValue(ui.type, commonText(values, "route"));
            setDropdownValue(ui.startSide, commonText(values, "startSide"));
            setDropdownValue(ui.endSide, commonText(values, "endSide"));
            setDropdownValue(ui.easing, commonText(values, "easing"));

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
    }

    function readConnectorSettings(connector) {
        var trimEnd = connectorTrimEnd(connector);
        return {
            route: dropdownName(
                ["Straight", "Orthogonal"],
                effectValue(connector, "Route").value
            ),
            startSide: dropdownName(
                ["Auto", "Top", "Right", "Bottom", "Left"],
                effectValue(connector, "Start Side").value
            ),
            endSide: dropdownName(
                ["Auto", "Top", "Right", "Bottom", "Left"],
                effectValue(connector, "End Side").value
            ),
            strokeWidth: effectValue(connector, "Stroke Width").value,
            headSize: effectValue(connector, "Arrowhead Size").value,
            color: effectValue(connector, "Connector Color").value,
            duration: trimEnd.numKeys >= 2
                ? trimEnd.keyTime(trimEnd.numKeys) - trimEnd.keyTime(1)
                : 0,
            easing: inferEasing(trimEnd)
        };
    }

    function readUiSettings() {
        var strokeWidth = parsePositiveNumber(ui.stroke.text, "Stroke width");
        var headSize = parsePositiveNumber(ui.head.text, "Arrowhead size");
        var duration = parsePositiveNumber(ui.duration.text, "Duration");
        if (
            strokeWidth === null ||
            headSize === null ||
            duration === null
        ) {
            return null;
        }
        if (
            ui.type.selection === null ||
            ui.startSide.selection === null ||
            ui.endSide.selection === null ||
            ui.easing.selection === null ||
            selectedColorIsMixed
        ) {
            alert(
                "Choose concrete values for all mixed connector settings.",
                SCRIPT_NAME
            );
            return null;
        }
        return {
            route: ui.type.selection.text,
            startSide: ui.startSide.selection.text,
            endSide: ui.endSide.selection.text,
            strokeWidth: strokeWidth,
            headSize: headSize,
            duration: duration,
            easing: ui.easing.selection.text,
            color: selectedColor
        };
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
        if (kind === "circle") {
            return "Circle Node";
        }
        if (kind === "diamond") {
            return "Diamond Node";
        }
        return "Rounded Node";
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

    function layerId(layer) {
        try {
            return String(layer.id);
        } catch (error) {
            return layer.name + "|" + layer.index;
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
