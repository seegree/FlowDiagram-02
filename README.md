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
Connector Color, Text Color, Shadow Opacity). New nodes and connectors follow
the theme through expressions, so editing the theme restyles the whole diagram
live, and theme values are keyframeable for animated restyles. Do not rename
the FD Theme layer; the expressions reference it by name.

The panel's Fill, Border, and connector Color swatches are theme-aware:

- With nothing relevant selected, picking a color edits the theme, updating
  every theme-linked layer at once.
- With generated nodes or connectors selected, picking a color overrides just
  those layers, detaching them from the theme.

**Use Theme** re-links selected nodes and connectors to the theme, removing
any overrides. Each node carries a Node Shadow effect whose opacity follows
the theme's Shadow Opacity slider (0 by default).

### Presets

The Theme panel offers three preset palettes applied to the FD Theme layer:

- **Simulink Classic** — white blocks, black borders, wires, and text, with
  block drop shadows, matching the classic Simulink look.
- **Simulink Modern** — the same monochrome palette without shadows.
- **Stylized** — the default dark motion-graphics palette.

Applying a preset updates every theme-linked layer live and becomes the
default for new comps. Theme values are ordinary keyframeable controls, so a
restyle can also be animated by keyframing the FD Theme layer's effects.

## Connect Nodes

1. Select two or more generated nodes.
2. Choose Straight or Orthogonal and optional side overrides.
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
them. The refresh button loads shared values from the current selection.

Available controls:

- Route
- Start and end side overrides, including Center
- Start and end port offsets (-50 to 50, percent of the side length), so
  several connectors can attach to the same side at distinct points, like
  block ports
- Stroke width
- Color
- Arrowhead size
- Arrowhead On/Off
- Duration

Connector animation uses Easy Ease by default.
Arrowheads default to On. The native Arrowhead menu remains editable in Effect
Controls after creation.

Changing duration preserves the first Trim Paths keyframe and moves the ending
keyframe. Reversing swaps start and end nodes and side overrides while
preserving style and animation timing. Connectors that still use their
generated "A to B" name are renamed to match the new direction; custom names
are left untouched.

Connector Effect Controls remain editable after creation, even when the panel
is not installed.

## Import a Simulink Model

**Import .slx** reads a Simulink model file and rebuilds its root system as
generated nodes and connectors: every block becomes a labeled node placed by
its model position (scaled to fit the comp), and every signal line becomes a
connector wired output-side to input-side, with port offsets spreading
multiple inputs or outputs along a block's edge. Gain blocks import as
triangles, Sum and Product as circles, Inports and Outports as rounded
nodes, Switches as diamonds, and everything else as rectangles. Connector
style (route, stroke, duration, arrowheads) comes from the current panel
settings, and everything arrives theme-linked, so presets and restyles apply
normally after import.

Notes and limits:

- Unzipping uses the system shell, so **Allow Scripts to Write Files and
  Access Network** must be enabled in Scripting & Expressions preferences.
- Only the root system imports; subsystem contents are not entered.
- Branched signal lines import as one connector per destination; junction
  dots are not placed automatically.
- Simulink's own wire waypoints are ignored; routing follows the panel's
  Straight/Orthogonal setting.

## Bake

**Bake** freezes the expressions on selected generated layers — or, with
nothing selected and after confirmation, on every generated layer in the
comp. Node sizes, colors, text styling, and connector paths become static
values; the arrowhead's ride along the draw-on animation is converted to
keyframes, so the animation survives. Use it on finished or very large
diagrams to recover preview performance. Baked layers no longer follow nodes
or the theme; **Use Theme** can re-link colors afterward, but geometry stays
frozen.

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
