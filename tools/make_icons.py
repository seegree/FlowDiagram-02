#!/usr/bin/env python3
"""Render the panel's node-shape icon tiles and splice them into
FlowDiagram.jsx between the __ICON_DATA_BEGIN__/__ICON_DATA_END__ markers.

Stdlib only. The whole tile is baked into the PNG — rounded background,
1 px border, and glyph — in two states (normal, hover), because letting the
native toolbutton paint adds its own rounded chrome around the tile (see
docs/scriptui-icon-tiles.md); the panel draws these with onDraw instead.
Glyph geometry mirrors drawNodeIconPath() in FlowDiagram.jsx (the vector
fallback), so the baked icons and the fallback stay in step.

Usage:
    python3 tools/make_icons.py            # regenerate + splice in place
    python3 tools/make_icons.py --sheet X  # also write a contact sheet PNG
"""

import base64
import math
import struct
import sys
import zlib
from pathlib import Path

W, H = 26, 24
STROKE = 1.7
TILE_RADIUS = 3.0
SUPER = 4  # supersampling factor per axis

# One palette table for both states so they can't drift apart. Glyph blue is
# the light variant of the Connect accent (styleAccentButton) so it reads on
# AE's dark chrome.
PALETTES = {
    "normal": {"bg": (38, 38, 38), "border": (69, 69, 69),
               "glyph": (127, 196, 240)},
    "hover": {"bg": (47, 52, 58), "border": (110, 148, 176),
              "glyph": (159, 208, 245)},
}

SHAPES = {
    "rounded": ("rbox", (13, 12), (8, 5), 4.0),
    "rectangle": ("box", (13, 12), (8, 4)),
    "square": ("box", (13, 12), (6.5, 6.5)),
    "circle": ("circle", (13, 12), 7.0),
    "diamond": ("poly", [(13, 4), (22, 12), (13, 20), (4, 12)]),
    "triangle": ("poly", [(6.5, 5), (21, 12), (6.5, 19)]),
    "hexagon": ("poly", [(4.5, 12), (8.5, 5.5), (17.5, 5.5),
                         (21.5, 12), (17.5, 18.5), (8.5, 18.5)]),
    "dot": ("fillcircle", (13, 12), 4.0),
}

ORDER = ["rounded", "rectangle", "square", "circle",
         "diamond", "triangle", "hexagon", "dot"]


def sd_round_box(px, py, cx, cy, bx, by, r):
    qx = abs(px - cx) - (bx - r)
    qy = abs(py - cy) - (by - r)
    outside = math.hypot(max(qx, 0.0), max(qy, 0.0))
    inside = min(max(qx, qy), 0.0)
    return outside + inside - r


def seg_dist(px, py, ax, ay, bx, by):
    vx, vy = bx - ax, by - ay
    wx, wy = px - ax, py - ay
    t = max(0.0, min(1.0, (wx * vx + wy * vy) / (vx * vx + vy * vy)))
    return math.hypot(px - (ax + t * vx), py - (ay + t * vy))


def glyph_covered(shape, px, py):
    kind = shape[0]
    if kind == "circle":
        (cx, cy), r = shape[1], shape[2]
        return abs(math.hypot(px - cx, py - cy) - r) <= STROKE / 2.0
    if kind == "fillcircle":
        (cx, cy), r = shape[1], shape[2]
        return math.hypot(px - cx, py - cy) <= r
    if kind == "box":
        (cx, cy), (bx, by) = shape[1], shape[2]
        return abs(sd_round_box(px, py, cx, cy, bx, by, 0.0)) <= STROKE / 2.0
    if kind == "rbox":
        (cx, cy), (bx, by), r = shape[1], shape[2], shape[3]
        return abs(sd_round_box(px, py, cx, cy, bx, by, r)) <= STROKE / 2.0
    if kind == "poly":
        pts = shape[1]
        best = 1e9
        for i in range(len(pts)):
            ax, ay = pts[i]
            bx, by = pts[(i + 1) % len(pts)]
            best = min(best, seg_dist(px, py, ax, ay, bx, by))
        return best <= STROKE / 2.0
    raise ValueError(kind)


def render_tile(shape, palette):
    """RGBA rows: rounded tile bg + 1px border + glyph, AA by supersampling."""
    rows = []
    step = 1.0 / SUPER
    cx, cy = W / 2.0, H / 2.0
    bx, by = W / 2.0 - 0.5, H / 2.0 - 0.5
    for y in range(H):
        row = bytearray()
        for x in range(W):
            acc = [0.0, 0.0, 0.0, 0.0]
            for sy in range(SUPER):
                for sx in range(SUPER):
                    px = x + (sx + 0.5) * step
                    py = y + (sy + 0.5) * step
                    sd = sd_round_box(px, py, cx, cy, bx, by, TILE_RADIUS)
                    if sd > 0:
                        continue  # outside the rounded tile: transparent
                    if glyph_covered(shape, px, py):
                        color = palette["glyph"]
                    elif sd >= -1.0:
                        color = palette["border"]
                    else:
                        color = palette["bg"]
                    acc[0] += color[0]
                    acc[1] += color[1]
                    acc[2] += color[2]
                    acc[3] += 255.0
            n = SUPER * SUPER
            alpha = acc[3] / n
            if alpha > 0:
                row += bytes((round(acc[0] * 255.0 / acc[3]),
                              round(acc[1] * 255.0 / acc[3]),
                              round(acc[2] * 255.0 / acc[3]),
                              round(alpha)))
            else:
                row += b"\x00\x00\x00\x00"
        rows.append(bytes(row))
    return rows


def write_png(rows, width, height):
    def chunk(tag, data):
        payload = tag + data
        return (struct.pack(">I", len(data)) + payload
                + struct.pack(">I", zlib.crc32(payload) & 0xFFFFFFFF))

    raw = b"".join(b"\x00" + row for row in rows)
    return (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 9))
            + chunk(b"IEND", b""))


def contact_sheet(state_rows, path, scale=8):
    """One row per state, nearest-neighbor upscaled, for eyeballing."""
    pad = 4
    sheet_w = (W + pad) * len(ORDER) + pad
    sheet_h = (H + pad) * len(state_rows) + pad
    bg = (29, 29, 29, 255)
    grid = [[bg] * sheet_w for _ in range(sheet_h)]
    for s, icons in enumerate(state_rows):
        for i, rows in enumerate(icons):
            ox = pad + i * (W + pad)
            oy = pad + s * (H + pad)
            for y in range(H):
                for x in range(W):
                    r, g, b, a = rows[y][4 * x:4 * x + 4]
                    if a:
                        f = a / 255.0
                        grid[oy + y][ox + x] = (
                            round(r * f + bg[0] * (1 - f)),
                            round(g * f + bg[1] * (1 - f)),
                            round(b * f + bg[2] * (1 - f)), 255)
    out_rows = []
    for y in range(sheet_h):
        row = bytearray()
        for x in range(sheet_w):
            row += bytes(grid[y][x])
        big = bytearray()
        for x in range(sheet_w):
            big += row[4 * x:4 * x + 4] * scale
        out_rows.extend([bytes(big)] * scale)
    Path(path).write_bytes(write_png(out_rows, sheet_w * scale, sheet_h * scale))


def js_dict(var_name, entries):
    lines = ["    var %s = {" % var_name]
    for i, (name, encoded) in enumerate(entries):
        comma = "" if i == len(entries) - 1 else ","
        lines.append('        %s: "%s"%s' % (name, encoded, comma))
    lines.append("    };")
    return "\n".join(lines)


def main():
    jsx = Path(__file__).resolve().parent.parent / "FlowDiagram.jsx"
    sheets = []
    dicts = []
    for state, var_name in (("normal", "NODE_ICON_B64"),
                            ("hover", "NODE_ICON_HOVER_B64")):
        icons = []
        entries = []
        for name in ORDER:
            rows = render_tile(SHAPES[name], PALETTES[state])
            icons.append(rows)
            entries.append(
                (name, base64.b64encode(write_png(rows, W, H)).decode("ascii")))
        sheets.append(icons)
        dicts.append(js_dict(var_name, entries))

    source = jsx.read_text()
    begin = "/*__ICON_DATA_BEGIN__*/"
    end = "/*__ICON_DATA_END__*/"
    head, rest = source.split(begin, 1)
    _, tail = rest.split(end, 1)
    jsx.write_text(head + begin + "\n" + "\n".join(dicts) + "\n    " + end + tail)
    print("Spliced %d icons x 2 states into %s" % (len(ORDER), jsx.name))

    if "--sheet" in sys.argv:
        sheet = sys.argv[sys.argv.index("--sheet") + 1]
        contact_sheet(sheets, sheet)
        print("Contact sheet: %s" % sheet)


if __name__ == "__main__":
    main()
