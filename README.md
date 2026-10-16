# Flow Diagram for After Effects

Flow Diagram is a dockable ScriptUI panel for Adobe After Effects 2025. It
creates editable native shape and text layers for simple animated flow
diagrams.

## Install

1. Quit After Effects.
2. Copy `FlowDiagram.jsx` into the After Effects `Scripts/ScriptUI Panels`
   folder.
3. Restart After Effects.
4. Open **Window > Flow Diagram**.

Typical macOS location:

```text
/Applications/Adobe After Effects 2025/Scripts/ScriptUI Panels/
```

Typical Windows location:

```text
C:\Program Files\Adobe\Adobe After Effects 2025\Support Files\Scripts\ScriptUI Panels\
```

## Create Nodes

Available nodes are **Rounded**, **Rectangle**, **Square**, **Circle**,
**Diamond**, **Triangle**, **Hexagon**, and **Dot**. Triangles are equilateral
and point to the right. Dots are compact junction markers. Node choices use
compact shape icons; hover an icon to see its name and modifier behavior.

Normal clicks create a single unlabeled shape layer. Hold **Option** on macOS
or **Alt** on Windows while clicking a node button to create the labeled,
auto-sizing version with the text `Node`. Dots remain unlabeled.

For labeled nodes, edit the visible text layer normally. Text wraps at 200 px
and the node resizes through native expressions. Rounded, rectangular, and
polygon nodes grow around the text with 24 px horizontal and 16 px vertical
padding. Circles and squares preserve equal width and height.

Labeled nodes consist of:

- An editable shape layer
- A parented paragraph text layer
- A hidden guide text layer used to measure unwrapped text width

Unlabeled nodes are single native shape layers. All generated layers keep
working without the panel.

Panel defaults — colors, route, sides, stroke width, arrowhead settings, and
duration — persist across After Effects sessions.

## Theme

The first generated layer in a composition also creates a hidden **FD Theme**
guide layer holding native color and shadow controls (Node Fill, Node Border,
Connector Color, Text Color, Shadow Opacity, Gradient Amount). New nodes and
connectors follow
the theme through expressions, so editing the theme restyles the whole diagram
live, and theme values are keyframeable for animated restyles. Do not rename
the FD Theme layer; the expressions reference it by name.

The panel's Fill, Border, and connector Color swatches are theme-aware:

- With nothing relevant selected, picking a color edits the theme, updating
  every theme-linked layer at once.
- With generated nodes or connectors selected, picking a color overrides just
  those layers, detaching them from the theme.

**Apply to all** sets the chosen preset on the entire generated diagram and removes
individual appearance overrides, so all generated nodes and wires follow the
theme again. Select objects afterward to customize them again. Each node carries a Node Shadow effect whose
opacity follows the theme's Shadow Opacity slider (0 by default).

### Gradient Shading

Each node (except dots) carries a **Node Gradient** shape group entry: a
vertical white-to-black gradient rendered above the theme-linked fill, acting
as a shading overlay. The block's hue keeps coming from Node Fill, so
presets, theme edits, and overrides work unchanged. The gradient's start and
end points are expression-tied to the node's own bounds, so the ramp always
spans the shape top to bottom and tracks auto-sizing, resizing, and
non-uniform scale.

The panel's **Gradient %** field follows the same selection rules as the
color swatches: with nothing relevant selected it edits the theme's Gradient
Amount slider (restyling every linked node), and with nodes selected it
overrides just those nodes — which is how a diagram gets gradients on some
blocks but not others. Applying a preset replaces those overrides and also
adds the gradient entry to nodes generated before this feature existed.

After Effects does not expose gradient color stops to scripting, so the
overlay's stops stay at their default white-to-black ramp; they remain
manually editable per node via **Edit Gradient** in the timeline.

### Presets

The Theme row offers three preset palettes. Selecting one in the dropdown
changes nothing on its own; **Apply to all** commits it to the comp's FD Theme
layer. The dropdown always opens on Simulink Modern; it is a command
input for Apply, not a readout of the comp's current theme:

- **Simulink Classic** — white blocks, black borders, wires, and text, with
  block drop shadows and subtle gradient shading, matching the classic
  Simulink look.
- **Simulink Modern** — the same monochrome palette without shadows or
  gradients.
- **Stylized** — the default dark motion-graphics palette.

Applying a preset restyles every generated node and connector in the current
composition, including objects with individual color, gradient, text-color,
or shadow overrides. It works regardless of selection and becomes the default
for new comps. The operation is one Undo step. Objects can be customized again
using the panel after applying the preset. Theme values are ordinary keyframeable controls, so a
restyle can also be animated by keyframing the FD Theme layer's effects.

## Connect Nodes

1. Select two or more generated nodes.
2. Choose the path route (Straight or Orthogonal) and optional From/To side
   overrides. New wires default to From Auto and To Left, entering blocks
   Simulink-style from the left.
3. Click **Connect**.

With exactly two nodes, the panel tracks selection order while it is open. If
selection history is unavailable, it falls back to After Effects'
selected-layer order.

With three or more nodes, normal **Connect** creates a nearest-neighbor chain.
It starts at the leftmost/topmost node, favors short connections, and penalizes
backward or upward travel to produce a general left-to-right, top-to-bottom
flow.

Hold **Option** on macOS or **Alt** on Windows while clicking **Connect** to
create a complete graph. Every unique node pair receives one connector,
oriented left-to-right when horizontal separation dominates and top-to-bottom
when vertical separation dominates.

Use **Reverse Direction** on selected connectors to adjust any direction that
is not the desired result.

### Branching Signals

To branch one signal to several destinations, place a **Dot** where the
signal splits, connect the source to the dot, then connect the dot to each
destination. Connectors treat dots as junction points:

- Wires attach to a dot's center, ignoring side and offset settings on that
  end.
- A wire ending on a dot defaults to no arrowhead; arrows belong on final
  destinations. The Arrowhead menu remains editable afterward.
- Dots follow the theme's Connector Color, so junctions read as part of the
  wire.

Connectors:

- Attach to node edges and update continuously as nodes move or scale
- Recalculate automatic sides and elbow routes
- Use sharp orthogonal corners
- Are placed behind their connected nodes
- Animate with Trim Paths and a following triangle arrowhead
- Store node references and style controls as native Effect Controls

Auto routing favors right-to-left flow for primarily horizontal layouts and
bottom-to-top flow for primarily vertical layouts. It does not perform
collision avoidance.

## Edit Connectors

Select one or more generated connectors and change panel controls to update
them. The panel automatically loads shared values when the selection changes or the
panel is activated; no manual load button is needed.

Available controls:

- Straight / elbow route tiles (hover for names)
- From and To side overrides, including Center
- Stroke width (W)
- Path color
- Arrowhead size (triangle glyph beside its value) and the Arrow checkbox
- Duration in seconds (Dur)

Wires build with their ports at each side's midpoint. To attach several
wires to the same side at distinct points, like block ports, slide each
wire's **Start Port Offset** and **End Port Offset** controls (-50 to 50,
percent of the side length) in Effect Controls after building — the wire
moves live as the value scrubs.

Connector animation uses Easy Ease by default.
Arrowheads default to On. The native Arrowhead menu remains editable in Effect
Controls after creation.

When a mixed connector selection is cleared, mixed numeric fields restore saved
positive defaults so the next Connect operation has usable width, head size,
and duration values.

Facing orthogonal ports reduce their clearance in narrow gaps, avoiding a
backtracking route when nodes are close together. Port offsets and the existing
routing around destination nodes remain supported.

Changing duration preserves the first Trim Paths keyframe and moves the ending
keyframe. Reversing swaps start and end nodes and side overrides while
preserving style and animation timing. Connectors that still use their
generated "A to B" name are renamed to match the new direction; custom names
are left untouched.

Connector Effect Controls remain editable after creation, even when the panel
is not installed.

## Bake

**Bake** freezes the expressions on selected generated layers — or, with
nothing selected and after confirmation, on every generated layer in the
comp. Node sizes, colors, text styling, and connector paths become static
values; the arrowhead's ride along the draw-on animation is converted to
keyframes, so the animation survives. Sampling includes the exact final draw-on
keyframe, even when it falls between composition frames. Use it on finished or
very large diagrams to recover preview performance. Baked layers no longer follow nodes
or the theme; applying a preset can re-link appearance afterward, including
connector stroke and arrowhead colors, but geometry stays frozen.

## MVP Limits

- Generated nodes and connectors are 2D.
- Node rotation is not supported.
- Non-uniform node scaling is supported.
- Connectors have one destination arrowhead.
- Orthogonal routing prioritizes reliable attachment over collision avoidance.

## Reference

Built against the community-maintained
[After Effects Scripting Guide](https://ae-scripting.docsforadobe.dev/) and
[After Effects Expression Reference](https://ae-expressions.docsforadobe.dev/).

## Regression Checks

Run `node tools/test-regressions.cjs` for host-independent checks of narrow-gap
routing, scaled nodes, port offsets, dots, destination detours, recovery after
mixed selections, exact Bake endpoint sampling, and diagram-wide preset
application over manual and panel appearance overrides. These checks execute the
production functions with minimal host mocks; visual verification in After
Effects is still required.

## Panel Icon Assets

`python3 tools/make_route_icons.py --sheet /tmp/fd-route-icons.png` regenerates
the neutral route tiles (normal, hover, selected) and arrowhead-size glyph,
splices them into the single-file panel, and writes a contact sheet. The
generator uses only the Python standard library. Route tiles stay mutually
exclusive; a mixed connector selection leaves neither selected. If PNG loading
fails, native Straight/Elbow radios and a triangle character remain usable.

The visual controls and swatches have fixed preferred/minimum/maximum sizes,
so they remain left-packed in a wide dock. Color swatches are flat patches.
