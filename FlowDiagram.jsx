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
            shadowOpacity: 75,
            gradientAmount: 20
        },
        {
            name: "Simulink Modern",
            nodeFill: [1, 1, 1],
            nodeStroke: [0, 0, 0],
            connectorColor: [0, 0, 0],
            textColor: [0, 0, 0],
            shadowOpacity: 0,
            gradientAmount: 0
        },
        {
            name: "Stylized",
            nodeFill: DEFAULT_NODE_FILL,
            nodeStroke: DEFAULT_NODE_STROKE,
            connectorColor: DEFAULT_CONNECTOR_COLOR,
            textColor: DEFAULT_TEXT_COLOR,
            shadowOpacity: 0,
            gradientAmount: 0
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
    var lastPanelSelection = "";

    function buildUI(host) {
        var panel = (host instanceof Panel)
            ? host
            : new Window("palette", SCRIPT_NAME, undefined, { resizeable: true });

        panel.orientation = "column";
        panel.alignChildren = ["fill", "top"];
        panel.spacing = 5;
        panel.margins = 8;

        var nodeButtons = panel.add("group");
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

        var nodeStyleRow = panel.add("group");
        nodeStyleRow.orientation = "row";
        nodeStyleRow.alignChildren = ["left", "center"];
        addRowLabel(
            nodeStyleRow,
            "Fill",
            "Node fill color; edits the theme, or overrides selected nodes"
        );
        var nodeFillSwatch = addSwatch(
            nodeStyleRow,
            "Choose node fill color",
            selectedNodeFill
        );
        addRowLabel(
            nodeStyleRow,
            "Border",
            "Node border color; edits the theme, or overrides selected nodes"
        );
        var nodeStrokeSwatch = addSwatch(
            nodeStyleRow,
            "Choose node border color",
            selectedNodeStroke
        );
        var gradientTip =
            "Gradient shading amount, 0 to 100; edits the theme, or " +
            "overrides selected nodes";
        addRowLabel(nodeStyleRow, "Gradient %", gradientTip);
        var gradientInput = nodeStyleRow.add(
            "edittext",
            undefined,
            String(readGradientAmountSetting())
        );
        gradientInput.characters = 4;
        gradientInput.helpTip = gradientTip;
        fixControlSize(gradientInput, 36, 24);

        addDividerRule(panel);

        var pathRow = panel.add("group");
        pathRow.orientation = "row";
        pathRow.alignChildren = ["left", "center"];
        var typeInput = addRouteTiles(pathRow,
            ROUTE_ITEMS[settingDropdownIndex("route", ROUTE_ITEMS, 1)]);
        addRowLabel(pathRow, "Color", "Connector color");
        var colorButton = addSwatch(
            pathRow,
            "Choose connector color",
            selectedColor
        );
        var portTip =
            "Ports attach at each side's midpoint; slide them afterward " +
            "with the wire's Start/End Port Offset controls in Effect " +
            "Controls, watching it move live";
        var sideRow = panel.add("group");
        sideRow.orientation = "row";
        sideRow.alignChildren = ["left", "center"];
        addRowLabel(
            sideRow,
            "From",
            "Side the wire leaves the first node from"
        );
        var startSideInput = sideRow.add("dropdownlist", undefined, SIDE_ITEMS);
        startSideInput.selection = settingDropdownIndex(
            "startSide",
            SIDE_ITEMS,
            0
        );
        fixControlSize(startSideInput, 82, 24);
        startSideInput.helpTip = portTip;
        addRowLabel(sideRow, "\u2192", portTip);
        var endSideInput = sideRow.add("dropdownlist", undefined, SIDE_ITEMS);
        endSideInput.selection = settingDropdownIndex("endSide", SIDE_ITEMS, 4);
        fixControlSize(endSideInput, 82, 24);
        endSideInput.helpTip = "Side the wire enters the second node";

        var numberRow = panel.add("group");
        numberRow.orientation = "row";
        numberRow.alignChildren = ["left", "center"];
        addRowLabel(numberRow, "W", "Stroke width, px");
        var strokeInput = numberRow.add(
            "edittext",
            undefined,
            String(readNumberSetting("strokeWidth", DEFAULT_STROKE_WIDTH))
        );
        strokeInput.characters = 3;
        fixControlSize(strokeInput, 36, 24);
        strokeInput.helpTip = "Stroke width, px";
        addArrowheadSizeIcon(numberRow);
        var headInput = numberRow.add(
            "edittext",
            undefined,
            String(readNumberSetting("headSize", DEFAULT_HEAD_SIZE))
        );
        headInput.characters = 3;
        fixControlSize(headInput, 36, 24);
        headInput.helpTip = "Arrowhead size, px";
        var arrowCheck = numberRow.add("checkbox", undefined, "Arrow");
        arrowCheck.value =
            settingDropdownIndex("arrowhead", ARROWHEAD_ITEMS, 0) === 0;
        arrowCheck.helpTip = "Draw an arrowhead at the wire's destination";
        addRowLabel(numberRow, "Dur (s)", "Draw-on duration in seconds");
        var durationInput = numberRow.add(
            "edittext",
            undefined,
            String(readNumberSetting("duration", DEFAULT_DURATION))
        );
        durationInput.characters = 3;
        fixControlSize(durationInput, 36, 24);
        durationInput.helpTip = "Draw-on duration in seconds";

        addDividerRule(panel);

        var themeRow = panel.add("group");
        themeRow.orientation = "row";
        themeRow.alignChildren = ["left", "center"];
        var presetNames = themePresetNames();
        var presetDropdown = themeRow.add(
            "dropdownlist",
            undefined,
            presetNames
        );
        // The dropdown is a command input for Apply, not a state readout, so
        // it is deliberately not persisted: remembering the last-applied
        // preset made it pose as "the current theme" while the color and
        // gradient fields (persisted independently) drifted away from it.
        presetDropdown.selection = 1;
        fixControlSize(presetDropdown, 124, 26);
        presetDropdown.helpTip =
            "Theme preset; selecting alone changes nothing, Apply to all restyles the diagram";
        var applyPresetButton = themeRow.add("button", undefined, "Apply to all");
        applyPresetButton.helpTip =
            "Apply this style to every generated node and wire in the comp, " +
            "replacing individual color and shading overrides";
        var actionRow = panel.add("group");
        actionRow.orientation = "row";
        actionRow.alignment = ["fill", "top"];
        actionRow.alignChildren = ["left", "center"];
        var connectButton = actionRow.add("button", undefined, "Connect");
        fixControlSize(connectButton, 110, 26);
        connectButton.helpTip =
            "Connect selected nodes; Option/Alt-click connects every unique pair";
        styleAccentButton(connectButton);
        var reverseButton = actionRow.add("button", undefined, "Reverse");
        fixControlSize(reverseButton, 68, 26);
        reverseButton.helpTip = "Reverse selected connector directions";
        var bakeButton = actionRow.add("button", undefined, "Bake");
        fixControlSize(bakeButton, 52, 26);
        bakeButton.helpTip =
            "Freeze expressions on selected generated layers " +
            "(all generated layers if none are selected)";

        ui = {
            type: typeInput,
            startSide: startSideInput,
            endSide: endSideInput,
            stroke: strokeInput,
            head: headInput,
            arrowhead: arrowCheck,
            duration: durationInput,
            gradient: gradientInput,
            colorButton: colorButton,
            nodeFillSwatch: nodeFillSwatch,
            nodeStrokeSwatch: nodeStrokeSwatch
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

        nodeFillSwatch.addEventListener("mousedown", function () {
            var picked = $.colorPicker();
            if (picked >= 0) {
                selectedNodeFill = integerToRgb(picked);
                setSwatchColor(nodeFillSwatch, selectedNodeFill, false);
                saveColorSetting("nodeFill", selectedNodeFill);
                applyNodeColorChoice({ fill: selectedNodeFill });
            }
        });
        nodeStrokeSwatch.addEventListener("mousedown", function () {
            var picked = $.colorPicker();
            if (picked >= 0) {
                selectedNodeStroke = integerToRgb(picked);
                setSwatchColor(nodeStrokeSwatch, selectedNodeStroke, false);
                saveColorSetting("nodeStroke", selectedNodeStroke);
                applyNodeColorChoice({ stroke: selectedNodeStroke });
            }
        });
        gradientInput.onChange = function () {
            var amount = parseFloat(gradientInput.text);
            if (isNaN(amount)) {
                gradientInput.text = String(readGradientAmountSetting());
                return;
            }
            amount = Math.max(0, Math.min(100, amount));
            gradientInput.text = String(amount);
            saveSetting("gradientAmount", amount);
            applyNodeColorChoice({ gradient: amount });
        };

        colorButton.addEventListener("mousedown", function () {
            var picked = $.colorPicker();
            if (picked >= 0) {
                selectedColor = integerToRgb(picked);
                selectedColorIsMixed = false;
                setSwatchColor(colorButton, selectedColor, false);
                saveColorSetting("connectorColor", selectedColor);
                applyConnectorColorChoice(selectedColor);
            }
        });

        strokeInput.onChange = function () {
            updateNumberControl(strokeInput, "Stroke width", "strokeWidth");
        };
        headInput.onChange = function () {
            updateNumberControl(headInput, "Arrowhead size", "headSize");
        };
        durationInput.onChange = function () {
            updateNumberControl(durationInput, "Duration", "duration");
        };
        typeInput.onChange = function () {
            updateDropdownControl(typeInput, "route");
        };
        startSideInput.onChange = function () {
            updateDropdownControl(startSideInput, "startSide");
        };
        endSideInput.onChange = function () {
            updateDropdownControl(endSideInput, "endSide");
        };
        arrowCheck.onClick = function () {
            if (isSyncingControls) {
                return;
            }
            var choice = arrowCheck.value
                ? ARROWHEAD_ITEMS[0]
                : ARROWHEAD_ITEMS[1];
            saveSetting("arrowhead", choice);
            updateSelectedConnectors({ arrowhead: choice });
        };
        connectButton.onClick = createConnectorFromSelection;
        reverseButton.onClick = reverseSelectedConnectors;
        bakeButton.onClick = bakeGeneratedLayers;
        panel.onActivate = syncControlsFromSelection;
        // The capture-phase "focus" listener was removed: it re-ran the refresh
        // far too aggressively -- including at moments AE has a modal open (e.g.
        // New Composition), which AE forbids ("Cannot run a script while a modal
        // dialog is waiting"), wedging the panel and blanking its custom-drawn
        // controls. onActivate and selection polling load settings without
        // entering that fragile modal focus path.

        panel.onResizing = panel.onResize = function () {
            try { this.layout.resize(); } catch (resizeError) {}
        };
        panel.onClose = stopSelectionTracker;

        panel.layout.layout(true);
        startSelectionTracker();
        return panel;
    }

    function fixControlSize(control, width, height) {
        control.preferredSize = [width, height];
        control.minimumSize = [width, height];
        control.maximumSize = [width, height];
    }

    /*__ROUTE_ICON_DATA_BEGIN__*/
    var ROUTE_ICON_B64 = {
        "Straight_normal": "iVBORw0KGgoAAAANSUhEUgAAACoAAAAaCAYAAADBuc72AAABGUlEQVR42uXYoQ6DMBSF4T4NILFISHDVWCwajcUyi8Zi0bzSHqHb36RLQ8aY2NZLtqSZ2JJ9OfSeDpS6v+I4vuR5fi3L0khamLAph8yyzCRJYqIoErUwYbNY1BKRPhajImKpSLcwfhWqtT5caZqGhYJY1/VwtW0rM9Gu6x7IZVlkQP3F9A7DYIHTNFn0OI6yoE3T2PS2CYqBkhrpkSJpkqr/eXAok+z24jzPpqqqp98LCq3r2l5ikGBf1U8QKJeVHwbIe1EUsgqfxEjF1Q2DI+5kYljYgyD7vn/rlPkpFJDrRKCAxZ31e50oBspwuE5kWLadGBzqdyIp7nVicKjbi0edGBzKoHyyE0X+cf5P6Glu7k5zu3yWBxA3pym0/AtyCC4AAAAASUVORK5CYII=",
        "Orthogonal_normal": "iVBORw0KGgoAAAANSUhEUgAAACoAAAAaCAYAAADBuc72AAAA80lEQVR42u3YoQ6DMBAG4D4NIGuRJalD1/IOaGwts2gsFs0r7RFu+5t0mYIB4yihJCcIAb60vXKHEO8jTdOHUuqptaaQAibYhEfmeU5ZllGSJEEFTLA5LNRHI5umobquSUq5CQujwBAfPTLWWpqmiYZhoKqqVt8PIwsUUZYldV33AeP8NKgxxk3xXPR977AIwIui4Id6wJoA/hTo3IuRwX69juP483plgyLbkfkeuHYHYIMieXANo7lli2KDIskw7Vufy75GIzRCIzRC7wht2/bvRcYhUNSNS6Xbd+z5AgVRON8HytHc7e1EXXN3mXb5Kj8gXhPVzLr7az+RAAAAAElFTkSuQmCC",
        "Straight_hover": "iVBORw0KGgoAAAANSUhEUgAAACoAAAAaCAYAAADBuc72AAABG0lEQVR42uXYoQ6DMBSF4T4WBoPGo7Hg0UiCmUHj0Wg8Gs077BE6/iZ3acg2Jrb1ki1pJrZkXw69pwNjtleappe6rq9N01hNCxM2I8iiKGwcxzaKIlULEzaHRa0R6WMxGiLWipSF8avQPM8PV5IkYaEg1nU9XG3b6ky067o7clkWHVB/bZNrh2FwwGmaHHocR13QbWpdevsE1UBJjfRIkTRJ1f88OJRJlr04z7Mty/Lh94JCq6pylxgk2Ff1EwTKZeWHAfKeZZmuwicxUpG6YXDUnUwMC3sQZN/3b50yP4UCkk4ECljdWf+sE9VAGQ7pRIZl34nBoX4nkuKzTgwOlb141InBoQzKJztR5R/n/4Se5ubuNLfLZ3kAcQOwcOscTYxwxAAAAABJRU5ErkJggg==",
        "Orthogonal_hover": "iVBORw0KGgoAAAANSUhEUgAAACoAAAAaCAYAAADBuc72AAAA9ElEQVR42u3YoQ6EMAwG4D3WzAwaj55lHj1JMGfQeDQaj57mHe4RevxLIKfggKNAGEkFIcCXbR0tQgxHHMcva+07z3O6UsAEmxiRaZqSUoqklJcKmGDzWKiPRpZlSUVRUBRFm7AwCgzx0SNTVRX1fU9d11GWZavvh5EFitBaU9M0Exjnp0GNMX6K56JtW49FAJ4kCT90BKwJ4E+Bzr14yN5pvTrnfl6vbFBkOzJ/BK7dAdigSB5cw2hu2aLYoEgyTPvW57Kv0QAN0AAN0CdC67r+e5FxCBR141Lp9h17vkCXKJyfA+Vo7vZ2or65u027fJcfEB/YCQS98wW80AAAAABJRU5ErkJggg==",
        "Straight_selected": "iVBORw0KGgoAAAANSUhEUgAAACoAAAAaCAYAAADBuc72AAABG0lEQVR42uXYIQ+CQBjG8ft8REYmkwhkMlUSgU6mQoZKJpMJfoTT/23nbkzEoN7LdHtn0M3fHu6eE5S6v9I0vXRddx3HUUsaTNiURVZVpcMw1EEQiBpM2AwWtUSki8WoiFgq0g7Gr0KzLDucKIr8QkGs63o4dV3LTLRpmgdyWRYZUHfiONZ93xvgNE0GPQyDLGhZlia9bYJioKRGeqRImqTqfu4dyk62a3GeZ53n+dPveYUWRWEuMUiwr+rHC5TLyg8D5D1JElmFT2KkYuuGjSPuZGKzsAZBtm371inzUygg24lAAYs76/c6UQyUzWE7kc2y7UTvULcTSXGvE71D7Vo86kTvUDbKJztR5B/n/4Se5ubuNLfLZ3kAcQOncAw2LQJVfAAAAABJRU5ErkJggg==",
        "Orthogonal_selected": "iVBORw0KGgoAAAANSUhEUgAAACoAAAAaCAYAAADBuc72AAAA9ElEQVR42u3YoQ6DMBAG4D4fkqDRVQh0NXYOgUdjW00tGo1G7BFu+5uUTLEB44BQkhOEAF/aXrlDiPeRZdlDa/201tKZAibYhEeWZUlxHFMURacKmGBzWKj3RtZ1TVVVUZIkq7AwCgzx3iPTNA2N40h931NRFIvvh5EFisjznNq2ncA4PwyqlHJTPBdd1zksAnApJT/UA5YE8IdA516cpum0Xodh+Hm9skGR7ch8D1y6A7BBkTy4htFcs0WxQZFkmPa1z2VfowEaoAEaoHeEGmP+XmTsAkXd+K10+4wtX6BTFM73gXI0d1s7UdfcXaZdvsoPiBczEyU10pfovgAAAABJRU5ErkJggg=="
    };
    var HEAD_SIZE_ICON_B64 = "iVBORw0KGgoAAAANSUhEUgAAAA4AAAAOCAYAAAAfSC3RAAAAX0lEQVR42mM4fPgwAzkYmZMAxA3kaNwPxP+B+D7UEJI0ngfifqgBIL4DsRr3Q9kKQLweasB6KJ8ojTDsgOQFkEsEiNWIHHAgv7+H+Z9mGkl2KsmBQ3Z0kJUAyE5yJGEAqgDoaBp0WKQAAAAASUVORK5CYII=";
    /*__ROUTE_ICON_DATA_END__*/

    function panelIconImage(data, filename) {
        if (!data) return null;
        var binary = base64ToBinary(data);
        try { return ScriptUI.newImage(binary); } catch (binaryError) {}
        try {
            var file = new File(Folder.temp.fsName + "/fd_" + filename + ".png");
            file.encoding = "BINARY";
            if (!file.open("w")) return null;
            try { file.write(binary); } finally { file.close(); }
            return ScriptUI.newImage(file);
        } catch (fileError) { return null; }
    }

    function addRouteTiles(parent, initialValue) {
        var controller = { selection: null, routeButtons: [], onChange: null };
        var group = parent.add("group");
        group.orientation = "row";
        group.alignChildren = ["left", "center"];
        group.spacing = 4;
        var i;
        for (i = 0; i < ROUTE_ITEMS.length; i += 1) {
            addRouteTile(group, controller, ROUTE_ITEMS[i]);
        }
        setRouteTileValue(controller, initialValue);
        return controller;
    }

    function addRouteTile(parent, controller, route) {
        var images = {};
        var states = ["normal", "hover", "selected"];
        var i;
        for (i = 0; i < states.length; i += 1) {
            var key = route + "_" + states[i];
            images[states[i]] = panelIconImage(ROUTE_ICON_B64[key], key);
        }
        var button;
        if (images.normal && images.selected) {
            button = parent.add("iconbutton", undefined, images.normal,
                { style: "toolbutton", toggle: true });
            button.onDraw = function (state) {
                try {
                    this.graphics.drawImage(this.value ? images.selected
                        : (state && state.mouseOver && images.hover ? images.hover : images.normal), 0, 0);
                } catch (drawError) {}
            };
            fixControlSize(button, 42, 26);
        } else {
            // A readable native radio remains usable when icon loading fails.
            button = parent.add("radiobutton", undefined, route === "Straight" ? "Straight" : "Elbow");
        }
        button.helpTip = route === "Straight" ? "Straight connector" : "Elbow connector";
        button.routeValue = route;
        controller.routeButtons.push(button);
        button.onClick = function () {
            setRouteTileValue(controller, route);
            if (controller.onChange !== null) controller.onChange();
        };
    }

    function setRouteTileValue(controller, value) {
        controller.selection = null;
        var i;
        for (i = 0; i < controller.routeButtons.length; i += 1) {
            var button = controller.routeButtons[i];
            button.value = button.routeValue === value;
            if (button.value) controller.selection = { text: value, index: i };
            // Programmatic radio changes need an explicit ScriptUI repaint.
            button.visible = false;
            button.visible = true;
        }
    }

    function addArrowheadSizeIcon(parent) {
        var image = panelIconImage(HEAD_SIZE_ICON_B64, "head_size");
        var icon = image ? parent.add("image", undefined, image)
            : parent.add("statictext", undefined, "\u25B7");
        fixControlSize(icon, 14, 14);
        icon.helpTip = "Arrowhead size, pixels";
        return icon;
    }

    function addRowLabel(parent, text, helpTip) {
        var label = parent.add("statictext", undefined, text);
        label.helpTip = helpTip;
        return label;
    }

    function addSwatch(parent, helpTip, initialColor) {
        var swatch = parent.add("group");
        fixControlSize(swatch, 32, 24);
        swatch.helpTip = helpTip;
        setSwatchColor(swatch, initialColor, false);
        return swatch;
    }

    function addDividerRule(parent) {
        var rule = parent.add("panel");
        rule.alignment = ["fill", "top"];
        rule.preferredSize.height = 2;
        rule.minimumSize.height = 2;
        rule.maximumSize.height = 2;
    }

    function styleAccentButton(button) {
        // ScriptUI has no native colored button, so the one accent (Connect,
        // the app's primary action) is custom-painted. Script-painted
        // controls blank while an AE modal is open -- accepted as inherent
        // (see HANDOFF-panel-rendering.md); the button keeps working.
        button.onDraw = function (drawState) {
            try {
                var g = this.graphics;
                var shade = [0.21, 0.50, 0.72];
                if (drawState && drawState.leftButtonPressed) {
                    shade = [0.16, 0.40, 0.58];
                } else if (drawState && drawState.mouseOver) {
                    shade = [0.25, 0.57, 0.80];
                }
                g.newPath();
                g.rectPath(0, 0, this.size[0], this.size[1]);
                g.fillPath(g.newBrush(g.BrushType.SOLID_COLOR, shade));
                var font = ScriptUI.newFont(
                    g.font.name,
                    ScriptUI.FontStyle.BOLD,
                    g.font.size
                );
                var extent = g.measureString(this.text, font);
                g.drawString(
                    this.text,
                    g.newPen(g.PenType.SOLID_COLOR, [1, 1, 1], 1),
                    Math.round((this.size[0] - extent[0]) / 2),
                    Math.round((this.size[1] - extent[1]) / 2),
                    font
                );
            } catch (drawError) {
                // A failed paint must still leave a clickable button.
            }
        };
    }

    // Regenerate with tools/make_icons.py; it splices between the markers.
    /*__ICON_DATA_BEGIN__*/
    var NODE_ICON_B64 = {
        rounded: "iVBORw0KGgoAAAANSUhEUgAAABoAAAAYCAYAAADkgu3FAAAAyElEQVR42mNggAJXV9cAIG6gMg5gQAZAgfm2trb/zczMqIpBZoLMhvsEJKCmpkYTDLUsAGRRA8h2WlkEMhtkxwiyyNDK/n9c55L/mXP2EYVBakF6SLLIPbHof/2RD2BcsuE6QUtAamDqQXqJsgjkKpCGyl2P/9v4RRAdRCC1ID0gvcg+w2kRKAhAikmxBNkykF6QGQQtggUFuZEPC2qiLEJWSCpG1z84LKJL0NEtMdAtedMtw9K1CBqtJoi1iD5VOd0aJ/RqbgEAemL0xmaykREAAAAASUVORK5CYII=",
        rectangle: "iVBORw0KGgoAAAANSUhEUgAAABoAAAAYCAYAAADkgu3FAAAAf0lEQVR42mNggAJXV9cAIG6gMg5gQAZAgfm2trb/zczMqIpBZoLMhvsEJKCmpkYTDLUsAGRRA8h2WlkEMhtkx6hF1LMoqLT7f+acfRRhkBkELQIprNz1mGxLYHqJsghZIakYXf+oRaMWDaLkTbcMO1qoDkqL6FOV061xQq/mFgBSwvPu4ok+wgAAAABJRU5ErkJggg==",
        square: "iVBORw0KGgoAAAANSUhEUgAAABoAAAAYCAYAAADkgu3FAAAAhklEQVR42mNggAJXV9cAIG6gMg5gQAZAgfm2trb/zczMqIpBZoLMhvsEJKCmpkYTDLUsAGRRA8h2WlkEMhtkB06LbPwiyMIkWQTSUH/kA1kY3TKiLPLNriPaJyC1ZFuELShwYVx6Ri0atWjUouFmEd2KIJoXqnSrJmhV8dGnKqdb44RezS0AVUn+Sof3UOMAAAAASUVORK5CYII=",
        circle: "iVBORw0KGgoAAAANSUhEUgAAABoAAAAYCAYAAADkgu3FAAABAUlEQVR42mNggAJXV9cAIG6gMg5gQAZAgfm2trb/zczMqIpBZoLMhvsEJKCmpkYTDLUsAGRRA8h2WlkEMhtkB1EW6RgY//fNrvufPHnj/8w5+8AYxAaJgeSoYhHIsMpdj//XH/kAxiUbroMxjA+SA6mhyKK4ziVww90Ti1BcD2KDxGCWgtSSZRHIlSAD8padwhs8IDmQGpBabD7DaxFIMyhIQK4lFAcw9SC1ID3o6vFaBPMNKGiITV0gtdh8hdciUIoCaSLGN8i+AukB6SXaIlDyBQUFqXkGpAekd/BZRLego1tioFvypluGpWsRRNdCla7VBDUrPvpU5XRrnNCruQUAyff4SgJF7bEAAAAASUVORK5CYII=",
        diamond: "iVBORw0KGgoAAAANSUhEUgAAABoAAAAYCAYAAADkgu3FAAAA40lEQVR42mNggAJXV9cAIG6gMg5gQAZAgfm2trb/zczMqIpBZoLMhvsEJKCmpkYTDLUsAGRRA8h2YjTpGBj/j6ifAcYgNjF6QGaD7CDaIpDBectO/a8/8gGMQWxiLCPJIkMre7glcZ1LwBhmGUiOKhaZu/j8r9z1GGywb3YdXBzEBomB5EBqKLLIxi8Cbol7YhGGPEgMZhlILVkWEWMIMY7BaxGxwUIoePFaREpE40sweC0C5Q9Ski6+LAAya+AtolvQ0TUx0DV50zXD0rUIomuhStdqgloVH32qcro1TujV3AIAzL8EiQIe51EAAAAASUVORK5CYII=",
        triangle: "iVBORw0KGgoAAAANSUhEUgAAABoAAAAYCAYAAADkgu3FAAAAyklEQVR42mNggAJXV9cAIG6gMg5gQAZAgfm2trb/zczMqIpBZoLMhvsEJKCmpkYTDLUsAGRRA8h2WlkEMhtkB1aLDK3s/2fO2fc/qLT7v46BMe0ssvGL+F9/5AMYV+56TJGFRFkUUT/jf8mG6xRZSJRFIBrEd08sQrEQ5ABQ8FLdIhhGthCE4zqXELSQLIuQLQQlFmIspMgiZHWELKSKRbgsBMXh0LSI5kFH88RA8+RN8wxLtyKI5oUq3aoJWlV89KnK6dY4oVdzCwDoGPeSMxWmMAAAAABJRU5ErkJggg==",
        hexagon: "iVBORw0KGgoAAAANSUhEUgAAABoAAAAYCAYAAADkgu3FAAAA50lEQVR42mNggAJXV9cAIG6gMg5gQAZAgfm2trb/zczMqIpBZoLMhvsEJKCmpkYTDLUsAGRRA8h2WlkEMhtkB0GLbPwiiMIUWRRU2v2//sgHojBILVkWGVrZgw0o2XCdoG9AakBqQXpItihzzj6wZnzBghy8ILUgPSRZ5BSeCtaYPHkj0ZEOUgvSA9JLlEU6Bsb/K3c9BmMQm1iLcOnDaVFE/Qywy3yz60hOyiA9IL0gM/BaBEsAectOkZ1vQHqRE8bAWkS3oKNrYqBb8qZrhqVrEUS3QpWu1QS1Kz76VOV0a5zQq7kFAC5CACUTvrorAAAAAElFTkSuQmCC",
        dot: "iVBORw0KGgoAAAANSUhEUgAAABoAAAAYCAYAAADkgu3FAAAAkElEQVR42mNggAJXV9cAIG6gMg5gQAZAgfm2trb/zczMqIpBZoLMhvsEJKCmpkYTDLUsAGRRA8h2WlkEMhtkx6hFw8gicxef/8mTN/6vP/IBjEFskBhVLQIZWLnrMdwSGAaJEbKMJIuQfYKOQXJUswiXJTA89CyiW9DRLTHQLXmPFkEjxyL6VOV0a5zQq7kFAMCEzw6InBE8AAAAAElFTkSuQmCC"
    };
    var NODE_ICON_HOVER_B64 = {
        rounded: "iVBORw0KGgoAAAANSUhEUgAAABoAAAAYCAYAAADkgu3FAAAAyElEQVR42mNggIK8KRsCgLiByjiAARkABebH1Uz675dSSlUMMhNkNtwnIAF9EyuaYKhlASCLGkC208oikNkgO0aQRbYegf9Lp63/37zyGFEYpBakhySLIvMa/s+/8BWMJ+65R9ASkBqYepBeoiwCuQqkYcaxl/+9ozOJDiKQWpAekF5kn+G0CBQEIMWkWIJsGUgvyAyCFsGCgtzIhwU1URYhKyQVo+sfHBbRJejolhjolrzplmHpWgSNVhPEWkSfqpxujRN6NbcA6Pq7iWGgLV8AAAAASUVORK5CYII=",
        rectangle: "iVBORw0KGgoAAAANSUhEUgAAABoAAAAYCAYAAADkgu3FAAAAgElEQVR42mNggIK8KRsCgLiByjiAARkABebH1Uz675dSSlUMMhNkNtwnIAF9EyuaYKhlASCLGkC208oikNkgO0Ytop5F6U0z/jevPEYRBplB0CKQwhnHXpJtCUwvURYhKyQVo+sftWjUokGUvOmWYUcL1UFpEX2qcro1TujV3AIASza6mQLI5nYAAAAASUVORK5CYII=",
        square: "iVBORw0KGgoAAAANSUhEUgAAABoAAAAYCAYAAADkgu3FAAAAh0lEQVR42mNggIK8KRsCgLiByjiAARkABebH1Uz675dSSlUMMhNkNtwnIAF9EyuaYKhlASCLGkC208oikNkgO3Ba5B2dSRYmySKQhvkXvpKF0S0jyqKEih6ifQJSS7ZF2IICF8alZ9SiUYtGLRpuFtGtCKJ5oUq3aoJWFR99qnK6NU7o1dwCALDtxXEZcKHOAAAAAElFTkSuQmCC",
        circle: "iVBORw0KGgoAAAANSUhEUgAAABoAAAAYCAYAAADkgu3FAAABAklEQVR42mNggIK8KRsCgLiByjiAARkABebH1Uz675dSSlUMMhNkNtwnIAF9EyuaYKhlASCLGkC208oikNkgO4iyyMzO7X9CRc//mvm7/zevPAbGIDZIDCRHFYtAhs049vL//AtfwXjinntgDOOD5EBqKLKodNp6uOGReQ0orgexQWIwS0FqybII5EqQAV2bL+ENHpAcSA1ILTaf4bUIpBkUJCDXEooDmHqQWpAedPV4LYL5BhQ0xKYukFpsvsJrEShFgTQR4xtkX4H0gPQSbREo+YKCgtQ8A9ID0jv4LKJb0NEtMdAtedMtw9K1CKJroUrXaoKaFR99qnK6NU7o1dwCAK72vyW1oee8AAAAAElFTkSuQmCC",
        diamond: "iVBORw0KGgoAAAANSUhEUgAAABoAAAAYCAYAAADkgu3FAAAA40lEQVR42mNggIK8KRsCgLiByjiAARkABebH1Uz675dSSlUMMhNkNtwnIAF9EyuaYKhlASCLGkC2E6PJzM7tf17PYjAGsYnRAzIbZAfRFoEM7tp86f/8C1/BGMQmxjKSLLL1CIRbUjptPRjDLAPJUcUil8DY/zOOvQQbnFDRAxcHsUFiIDmQGoos8o7OhFsSmdeAIQ8Sg1kGUkuWRcQYQoxj8FpEbLAQCl68FpES0fgSDF6LQPmDlKSLLwuAzBp4i+gWdHRNDHRN3nTNsHQtguhaqNK1mqBWxUefqpxujRN6NbcA7gXLlRUdWhoAAAAASUVORK5CYII=",
        triangle: "iVBORw0KGgoAAAANSUhEUgAAABoAAAAYCAYAAADkgu3FAAAAy0lEQVR42mNggIK8KRsCgLiByjiAARkABebH1Uz675dSSlUMMhNkNtwnIAF9EyuaYKhlASCLGkC208oikNkgO7BaZOsR+L955bH/6U0z/pvZudHOIu/ozP/zL3wF4xnHXlJkIVEW5fUs/j9xzz2KLCTKIhAN4kfmNaBYCHIAKHipbhEMI1sIwqXT1hO0kCyLkC0EJRZiLKTIImR1hCykikW4LATF4dC0iOZBR/PEQPPkTfMMS7ciiOaFKt2qCVpVfPSpyunWOKFXcwsAMCW+f9ZUFd4AAAAASUVORK5CYII=",
        hexagon: "iVBORw0KGgoAAAANSUhEUgAAABoAAAAYCAYAAADkgu3FAAAA6ElEQVR42mNggIK8KRsCgLiByjiAARkABebH1Uz675dSSlUMMhNkNtwnIAF9EyuaYKhlASCLGkC208oikNkgOwha5B2dSRSmyKL0phn/51/4ShQGqSXLIluPQLABE/fcI+gbkBqQWpAeki1qXnkMrBlfsCAHL0gtSA9JFgWlloA11szfTXSkg9SC9ID0EmWRmZ3b/xnHXoIxiE2sRbj04bQor2cx2GUJFT0kJ2WQHpBekBl4LYIlgK7Nl8jONyC9yAljYC2iW9DRNTHQLXnTNcPStQiiW6FK12qC2hUffapyujVO6NXcAgA7ZsctLxSScwAAAABJRU5ErkJggg==",
        dot: "iVBORw0KGgoAAAANSUhEUgAAABoAAAAYCAYAAADkgu3FAAAAkElEQVR42mNggIK8KRsCgLiByjiAARkABebH1Uz675dSSlUMMhNkNtwnIAF9EyuaYKhlASCLGkC208oikNkgO0YtGkYWuQTG/q+Zv/v//AtfwRjEBolR1SKQgTOOvYRbAsMgMUKWkWQRsk/QMUiOahbhsgSGh55FdAs6uiUGuiXv0SJo5FhEn6qcbo0TejW3ANzelVnIEqkvAAAAAElFTkSuQmCC"
    };
    /*__ICON_DATA_END__*/

    function base64ToBinary(input) {
        var keyStr =
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
        var output = "";
        var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
        var i = 0;
        input = input.replace(/[^A-Za-z0-9+\/=]/g, "");
        while (i < input.length) {
            enc1 = keyStr.indexOf(input.charAt(i++));
            enc2 = keyStr.indexOf(input.charAt(i++));
            enc3 = keyStr.indexOf(input.charAt(i++));
            enc4 = keyStr.indexOf(input.charAt(i++));
            chr1 = (enc1 << 2) | (enc2 >> 4);
            chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
            chr3 = ((enc3 & 3) << 6) | enc4;
            output += String.fromCharCode(chr1);
            if (enc3 !== 64) { output += String.fromCharCode(chr2); }
            if (enc4 !== 64) { output += String.fromCharCode(chr3); }
        }
        return output;
    }

    function nodeIconImage(kind, hover) {
        // Icons are baked PNGs (embedded base64) decoded to a temp file and
        // loaded as ScriptUI images. The whole tile look (background, border,
        // glyph) is in the PNG; addNodeIconButton paints it with onDraw so
        // the native toolbutton's rounded chrome never draws around it.
        try {
            var data = hover
                ? NODE_ICON_HOVER_B64[kind]
                : NODE_ICON_B64[kind];
            if (!data) { return undefined; }
            var file = new File(
                Folder.temp.fsName + "/fd_node_icon_" + kind +
                    (hover ? "_hover" : "") + ".png"
            );
            file.encoding = "BINARY";
            if (file.open("w")) {
                file.write(base64ToBinary(data));
                file.close();
            }
            return ScriptUI.newImage(file);
        } catch (iconError) {
            return undefined;
        }
    }

    function setSwatchColor(swatch, rgb, isMixed) {
        // Native background fill (no onDraw) so swatches survive modal dialogs.
        try {
            var g = swatch.graphics;
            swatch.graphics.backgroundColor = g.newBrush(
                g.BrushType.SOLID_COLOR,
                isMixed ? [0.5, 0.5, 0.5] : rgb
            );
        } catch (swatchError) {}
    }

    function addNodeIconButton(parent, kind, label) {
        var image = nodeIconImage(kind, false);
        var hoverImage = nodeIconImage(kind, true);
        var button;
        if (image) {
            button = parent.add(
                "iconbutton", undefined, image, { style: "toolbutton" }
            );
            // onDraw replaces all native painting: no rounded toolbutton
            // chrome around the tile, no OS focus ring. Cost, accepted per
            // HANDOFF-panel-rendering.md: script-painted tiles blank behind
            // a modal dialog and repaint when it closes.
            button.onDraw = function (drawState) {
                try {
                    this.graphics.drawImage(
                        drawState && drawState.mouseOver && hoverImage
                            ? hoverImage
                            : image,
                        0,
                        0
                    );
                } catch (tileDrawError) {}
            };
        } else {
            // Fallback when "Allow Scripts to Write Files" is off (no temp PNG):
            // draw the shape with onDraw. Works, but blanks during modal dialogs.
            button = parent.add("button", undefined, "");
            button.onDraw = makeNodeIconDraw(kind);
        }
        button.preferredSize = [26, 24];
        button.minimumSize = [26, 24];
        button.maximumSize = [26, 24];
        button.helpTip = kind === "dot"
            ? label + ": create an unlabeled junction marker"
            : label + ": click for unlabeled; Option/Alt-click for labeled";
        return button;
    }

    function makeNodeIconDraw(kind) {
        return function () {
            var graphics = this.graphics;
            var width = this.size[0];
            var height = this.size[1];
            var left = 6;
            var top = 5;
            var right = width - 6;
            var bottom = height - 5;
            var centerX = width / 2;
            var centerY = height / 2;
            // Accent blue matching the baked PNG icons (tools/make_icons.py).
            var pen = graphics.newPen(
                graphics.PenType.SOLID_COLOR, [0.50, 0.77, 0.94], 1.5
            );
            var brush = graphics.newBrush(
                graphics.BrushType.SOLID_COLOR, [0.13, 0.18, 0.23]
            );
            graphics.drawOSControl();
            drawNodeIconPath(
                graphics, kind, left, top, right, bottom, centerX, centerY
            );
            graphics.fillPath(brush);
            drawNodeIconPath(
                graphics, kind, left, top, right, bottom, centerX, centerY
            );
            graphics.strokePath(pen);
        };
    }

    function drawNodeIconPath(
        graphics, kind, left, top, right, bottom, centerX, centerY
    ) {
        graphics.newPath();
        if (kind === "circle") {
            graphics.ellipsePath(left + 1, top, right - left - 2, bottom - top);
        } else if (kind === "dot") {
            graphics.ellipsePath(centerX - 4, centerY - 4, 8, 8);
        } else if (kind === "rounded") {
            graphics.ellipsePath(left, top + 2, right - left, bottom - top - 4);
        } else if (kind === "rectangle") {
            graphics.rectPath(left, top + 3, right - left, bottom - top - 6);
        } else if (kind === "square") {
            graphics.rectPath(centerX - 6, centerY - 6, 12, 12);
        } else if (kind === "diamond") {
            drawPolygonPath(graphics, [
                [centerX, top], [right, centerY], [centerX, bottom], [left, centerY]
            ]);
        } else if (kind === "triangle") {
            drawPolygonPath(graphics, [
                [left, top], [right, centerY], [left, bottom]
            ]);
        } else {
            drawPolygonPath(graphics, [
                [left, centerY], [left + 4, top], [right - 4, top],
                [right, centerY], [right - 4, bottom], [left + 4, bottom]
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

        // The gradient must be added before the fill: shape contents render
        // top-of-list in front, and reordering afterward with moveTo trips
        // AE's internal stream verification.
        if (kind !== "dot") {
            addNodeGradient(contents);
        }

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

    // Gradient color stops cannot be set through scripting, so the shading
    // overlay keeps the default white-to-black ramp and sits above the
    // theme-linked fill; the block's hue keeps coming from Node Fill, and
    // Gradient Amount only drives the overlay's opacity. Callers must add
    // the gradient directly after the path, before the fill.
    function addNodeGradient(contents) {
        var gradient = contents.addProperty("ADBE Vector Graphic - G-Fill");
        gradient.name = "Node Gradient";
        gradient.property("ADBE Vector Grad Start Pt").expression =
            gradientPointExpression(false);
        gradient.property("ADBE Vector Grad End Pt").expression =
            gradientPointExpression(true);
        var opacity = gradient.property("ADBE Vector Fill Opacity");
        opacity.setValue(readGradientAmountSetting());
        opacity.expression = themeSliderExpression("Gradient Amount");
        return gradient;
    }

    function ensureNodeGradient(contents) {
        var existing = findDirectChild(
            contents,
            "Node Gradient",
            "ADBE Vector Graphic - G-Fill"
        );
        if (existing !== null) {
            return existing;
        }
        // Upgrading a node generated before the gradient feature: the overlay
        // must sit above the fill, but shape contents cannot be reordered in
        // place (Property.moveTo trips AE's internal stream verification), so
        // capture the paint stack, remove it, and rebuild it in order. Color
        // expressions and stroke width survive; other manual tweaks to these
        // two entries (dashes, opacity) do not.
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
        var fillState = null;
        var strokeState = null;
        if (fill !== null) {
            var fillColor = fill.property("ADBE Vector Fill Color");
            fillState = {
                color: fillColor.value,
                expression: fillColor.expression
            };
        }
        if (stroke !== null) {
            var strokeColor = stroke.property("ADBE Vector Stroke Color");
            strokeState = {
                color: strokeColor.value,
                expression: strokeColor.expression,
                width: stroke.property("ADBE Vector Stroke Width").value,
                join: stroke.property("ADBE Vector Stroke Line Join").value
            };
        }
        if (fill !== null) {
            fill.remove();
        }
        if (strokeState !== null) {
            // Reacquire after removing the fill; the old stroke handle is stale.
            findDirectChild(contents, "Node Border", "ADBE Vector Graphic - Stroke").remove();
        }
        addNodeGradient(contents);
        if (fillState !== null) {
            var newFill = contents.addProperty("ADBE Vector Graphic - Fill");
            newFill.name = "Node Fill";
            var newFillColor = newFill.property("ADBE Vector Fill Color");
            newFillColor.setValue(fillState.color);
            if (fillState.expression !== "") {
                newFillColor.expression = fillState.expression;
            }
        }
        if (strokeState !== null) {
            var newStroke = contents.addProperty(
                "ADBE Vector Graphic - Stroke"
            );
            newStroke.name = "Node Border";
            var newStrokeColor = newStroke.property(
                "ADBE Vector Stroke Color"
            );
            newStrokeColor.setValue(strokeState.color);
            if (strokeState.expression !== "") {
                newStrokeColor.expression = strokeState.expression;
            }
            newStroke.property("ADBE Vector Stroke Width").setValue(
                strokeState.width
            );
            newStroke.property("ADBE Vector Stroke Line Join").setValue(
                strokeState.join
            );
        }
        // Later addProperty calls invalidate the original gradient handle too.
        return findDirectChild(contents, "Node Gradient", "ADBE Vector Graphic - G-Fill");
    }

    function gradientPointExpression(isEnd) {
        return "var r = thisLayer.sourceRectAtTime(time, false);\n" +
            "[r.left + r.width / 2, r.top" +
            (isEnd ? " + r.height" : "") + "];";
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
            // Facing ports must share the available gap rather than overshoot
            // each other when their nodes are closer than two clearance lengths.
            "  var gapX = (p3[0] - p0[0]) * ns[0];",
            "  var gapY = (p3[1] - p0[1]) * ns[1];",
            "  if (ns[0] !== 0 && ns[0] === -ne[0] && gapX >= 0) clearance = Math.min(clearance, gapX / 2);",
            "  if (ns[1] !== 0 && ns[1] === -ne[1] && gapY >= 0) clearance = Math.min(clearance, gapY / 2);",
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
            restoreBlankControlsToDefaults();
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
            var arrowChoice = commonText(values, "arrowhead");
            if (arrowChoice !== null) {
                ui.arrowhead.value = arrowChoice === ARROWHEAD_ITEMS[0];
            }
            var color = commonColor(values, "color");
            if (color === null) {
                selectedColorIsMixed = true;
            } else {
                selectedColor = color;
                selectedColorIsMixed = false;
            }
            setSwatchColor(ui.colorButton, selectedColor, selectedColorIsMixed);
        } finally {
            isSyncingControls = false;
        }
        } catch (syncError) {
            isSyncingControls = false;
        }
    }

    function restoreBlankControlsToDefaults() {
        if (ui === null) {
            return;
        }
        isSyncingControls = true;
        try {
            var fields = [ui.stroke, ui.head, ui.duration];
            var keys = ["strokeWidth", "headSize", "duration"];
            var fallbacks = [DEFAULT_STROKE_WIDTH, DEFAULT_HEAD_SIZE, DEFAULT_DURATION];
            var i;
            for (i = 0; i < fields.length; i += 1) {
                var value = parseFloat(fields[i].text);
                if (!isFinite(value) || value <= 0) {
                    var restored = readNumberSetting(keys[i], fallbacks[i]);
                    fields[i].text = String(isFinite(restored) && restored > 0
                        ? restored : fallbacks[i]);
                }
            }
            if (ui.type.selection === null) {
                setDropdownValue(ui.type, ROUTE_ITEMS[1]);
            }
            if (ui.startSide.selection === null) {
                setDropdownValue(ui.startSide, SIDE_ITEMS[0]);
            }
            if (ui.endSide.selection === null) {
                setDropdownValue(ui.endSide, SIDE_ITEMS[4]);
            }
            if (selectedColorIsMixed) {
                selectedColorIsMixed = false;
                setSwatchColor(ui.colorButton, selectedColor, false);
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
        if (
            strokeWidth === null ||
            headSize === null ||
            duration === null
        ) {
            return null;
        }
        // A blank dropdown is a leftover "<Mixed>" indicator from a prior
        // selection, not a real choice. Fall back to the same defaults the panel
        // builds with, so Connect always has usable values instead of blocking
        // with an alert.
        // Ports build at each side's midpoint; offsets are tuned afterward on
        // the wire's own Start/End Port Offset controls in Effect Controls.
        return {
            route: ui.type.selection ? ui.type.selection.text : ROUTE_ITEMS[1],
            startSide: ui.startSide.selection
                ? ui.startSide.selection.text
                : SIDE_ITEMS[0],
            endSide: ui.endSide.selection
                ? ui.endSide.selection.text
                : SIDE_ITEMS[4],
            startOffset: 0,
            endOffset: 0,
            arrowhead: ui.arrowhead.value
                ? ARROWHEAD_ITEMS[0]
                : ARROWHEAD_ITEMS[1],
            strokeWidth: strokeWidth,
            headSize: headSize,
            duration: duration,
            color: selectedColor
        };
    }

    function syncPanelSelection(comp) {
        // Replaces the manual reload button. Only refresh on a changed selection,
        // and keep this passive polling safe during AE modal/restore operations.
        try {
            var signature = String(comp.id) + ":" + nodeIds(comp.selectedLayers).join(",");
            if (signature !== lastPanelSelection) {
                syncControlsFromSelection();
                lastPanelSelection = signature;
            }
        } catch (selectionError) {}
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
            lastPanelSelection = "";
            return;
        }
        syncPanelSelection(comp);
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
            if (settings.gradient !== undefined) {
                effectValue(theme, "Gradient Amount").setValue(
                    settings.gradient
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

        var failures = [];
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
            effectValue(theme, "Gradient Amount").setValue(
                preset.gradientAmount
            );
            failures = linkCompToTheme(comp);
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
        saveSetting("gradientAmount", preset.gradientAmount);

        if (ui !== null) {
            setSwatchColor(ui.nodeFillSwatch, preset.nodeFill, false);
            setSwatchColor(ui.nodeStrokeSwatch, preset.nodeStroke, false);
            ui.gradient.text = String(preset.gradientAmount);
            setSwatchColor(ui.colorButton, selectedColor, false);
        }
        if (failures.length > 0) {
            alert("The style was applied, but some generated layers could not " +
                "be updated:\n\n" + failures.join("\n"), SCRIPT_NAME);
        }
    }

    function linkCompToTheme(comp) {
        // Apply always restyles the complete generated diagram, regardless of
        // selection. Re-link appearance only; baked geometry stays frozen.
        var failures = [];
        var i;
        for (i = 1; i <= comp.numLayers; i += 1) {
            var layer = comp.layer(i);
            try {
                if (isNodeLayer(layer)) {
                    linkNodeToTheme(layer);
                } else if (layer.comment === CONNECTOR_TAG) {
                    linkConnectorToTheme(layer);
                }
            } catch (error) {
                failures.push(layer.name + ": " + error.toString());
            }
        }
        return failures;
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
            if (!isDotNode(node)) {
                // Nodes generated before the gradient feature gain the
                // overlay here when a preset is applied.
                ensureNodeGradient(contents)
                    .property("ADBE Vector Fill Opacity")
                    .expression = themeSliderExpression("Gradient Amount");
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
        // Bake also freezes paint expressions, so restoring only the color
        // control would leave the visible stroke and arrowhead unchanged.
        var group = findDirectChild(
            connector.property("ADBE Root Vectors Group"),
            "Connector Geometry", "ADBE Vector Group"
        );
        if (group === null) return;
        var contents = group.property("ADBE Vectors Group");
        var stroke = findDirectChild(contents, "Connector Stroke", "ADBE Vector Graphic - Stroke");
        if (stroke !== null) {
            stroke.property("ADBE Vector Stroke Color").expression =
                "effect(\"Connector Color\")(\"Color\");";
        }
        var head = findDirectChild(contents, "Arrowhead", "ADBE Vector Group");
        if (head !== null) {
            var fill = findDirectChild(head.property("ADBE Vectors Group"),
                "Arrowhead Fill", "ADBE Vector Graphic - Fill");
            if (fill !== null) {
                fill.property("ADBE Vector Fill Color").expression =
                    "effect(\"Connector Color\")(\"Color\");";
            }
        }
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
                        "re-linked except for appearance by applying a preset.",
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
        if (!isFinite(step) || step <= 0) {
            throw new Error("Bake sampling requires a positive frame duration.");
        }
        var sampleIndex = 0;
        var t = startTime;
        // Avoid accumulated rounding error and always include the exact final
        // keyframe, including when draw-on timing falls between comp frames.
        while (t < endTime - 0.0000001) {
            times.push(t);
            values.push(prop.valueAtTime(t, false));
            sampleIndex += 1;
            t = startTime + sampleIndex * step;
        }
        times.push(endTime);
        values.push(prop.valueAtTime(endTime, false));
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
                if (settings.gradient !== undefined && !isDotNode(nodes[i])) {
                    var gradientOpacity = ensureNodeGradient(contents)
                        .property("ADBE Vector Fill Opacity");
                    gradientOpacity.expression = "";
                    gradientOpacity.setValue(settings.gradient);
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
        if (dropdown.routeButtons !== undefined) {
            setRouteTileValue(dropdown, value);
            return;
        }
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
            // Theme layers created before the gradient feature lack the
            // Gradient Amount control; add it so presets and node
            // expressions keep working in older comps.
            var existingEffects = existing.property("ADBE Effect Parade");
            if (existingEffects.property("Gradient Amount") === null) {
                addSliderControl(
                    existingEffects,
                    "Gradient Amount",
                    readGradientAmountSetting()
                );
            }
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
        addSliderControl(
            effects,
            "Gradient Amount",
            readGradientAmountSetting()
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

    function readGradientAmountSetting() {
        var value = parseFloat(readSetting("gradientAmount"));
        if (isNaN(value)) {
            return 0;
        }
        return Math.max(0, Math.min(100, value));
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
