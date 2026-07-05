# Icon-tile toggles in ScriptUI (After Effects panels)

A portable recipe for replacing checkbox text with clickable picture tiles
in any ScriptUI panel, as built for Archive Slideshow v0.6. Copy this file
into other repos that want the same treatment.

## The three pieces

1. **Icons are PNGs embedded in the .jsx as binary strings.** ScriptUI's
   `ScriptUI.newImage()` accepts the raw PNG bytes as a string, so a
   single-file script needs no sidecar images. Escape every byte outside
   printable ASCII as `\xNN` (plus `\\` and `\"`). Keep a generator script
   in the repo (`tools/make_icons.py` here renders tiles from simple
   rect/line geometry — no imaging libraries) and splice its output between
   marker comments:

   ```js
   var ICON_PNG = {};
   /*__ICON_DATA_BEGIN__*/
   /*__ICON_DATA_END__*/
   ```

   Wrap `ScriptUI.newImage(data)` in try/catch with a temp-file fallback
   (write the bytes to `Folder.temp`, `newImage(file)`), and a labeled
   checkbox as the last-resort control so an image failure never costs a
   control.

2. **Bake the whole tile into the PNG — background, border, and glyph —
   in two states** (normal and selected). Selection then reads as a
   color/contrast change of the whole tile, matching how design mocks are
   drawn, and no ScriptUI styling is needed. Render both states from one
   palette table so they can't drift apart.

3. **Use `iconbutton` with `toggle: true`, but take over drawing with
   `onDraw`.** This is the load-bearing trick:

   ```js
   var b = group.add("iconbutton", undefined, offImage,
       { style: "toolbutton", toggle: true });
   b.value = initiallyChecked;
   b.iconOff = offImage;
   b.iconOn = onImage;
   b.preferredSize = [TILE_W, TILE_H];
   b.onDraw = function () {
       try {
           this.graphics.drawImage(
               this.value === true ? this.iconOn : this.iconOff, 0, 0);
       } catch (e) {}
   };
   ```

## Why onDraw instead of swapping .image

Letting the native toolbutton render the tile fails three ways at once
(all observed in AE 2026):

- **Double outline** — the toolbutton draws its own rounded chrome around
  a tile that already has a baked border. Bloated, unclean.
- **Focus ring** — clicking flashes the OS light-blue focus outline.
- **Stale state** — assigning `.image` after creation repaints
  unreliably, so tiles stop toggling visually even though `.value` is
  correct.

A custom `onDraw` replaces *all* native painting: no chrome, no focus
ring, and the paint always derives from `this.value`. Repaint on the
button's own clicks is guaranteed because ScriptUI re-invokes `onDraw`
for every mouse/state transition on that control.

## The one gotcha: programmatic state changes don't repaint

If code changes another control's `.value` (radio groups, all/none
buttons, presets), that control won't re-run `onDraw` on its own. Force
it by flicking visibility:

```js
control.visible = false;
control.visible = true;
```

## Radio groups

Same tiles; in each button's `onClick`, set every sibling's `.value`
(true only for the clicked one) and `repaintTile()` the siblings that
changed. Never let the group go empty — re-clicking the active tile
keeps it selected.

## Sizing and taste notes

- 32×24 px tiles read well in a docked AE panel; 40×30 feels bloated.
  Author glyphs in one coordinate box and scale at render time.
- Names and one-line descriptions go in `helpTip` — the tooltip carries
  the words so the panel stays visual.
- A colored button (e.g. an accent-colored primary Build button) is the
  same idea applied to a plain `button`: custom `onDraw` with
  `rectPath`/`fillPath` + `drawString`, with hover/pressed colors from
  `drawState.mouseOver` / `drawState.leftButtonPressed`. ScriptUI has no
  native colored button.
- Small uppercase category headings: `statictext` with
  `graphics.foregroundColor` and a 9pt bold `ScriptUI.newFont`, inside
  try/catch since graphics styling can be host-dependent.
