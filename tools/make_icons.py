#!/usr/bin/env python3
"""Render the Rename Tab icon set (stdlib only, no image libraries).

Shapes are described in a 0..1 unit square and rasterised with supersampling,
so every size gets clean antialiased edges.
"""

import struct
import zlib
from pathlib import Path

OUT_DIR = Path(__file__).resolve().parent.parent / "extension" / "icons"
SIZES = (16, 32, 48, 128)

INDIGO_TOP = (0x63, 0x66, 0xF1)
INDIGO_BOTTOM = (0x43, 0x38, 0xCA)
WHITE = (0xFF, 0xFF, 0xFF)
AMBER = (0xFB, 0xBF, 0x24)
LAVENDER = (0xC7, 0xD2, 0xFE)


def rounded_rect(px, py, x0, y0, x1, y1, r, round_top=True, round_bottom=True):
    if px < x0 or px > x1 or py < y0 or py > y1:
        return False
    r = min(r, (x1 - x0) / 2, (y1 - y0) / 2)
    corners = []
    if round_top:
        corners += [(x0 + r, y0 + r, px < x0 + r, py < y0 + r),
                    (x1 - r, y0 + r, px > x1 - r, py < y0 + r)]
    if round_bottom:
        corners += [(x0 + r, y1 - r, px < x0 + r, py > y1 - r),
                    (x1 - r, y1 - r, px > x1 - r, py > y1 - r)]
    for cx, cy, in_x, in_y in corners:
        if in_x and in_y:
            return (px - cx) ** 2 + (py - cy) ** 2 <= r * r
    return True


def background(px, py):
    return rounded_rect(px, py, 0.0, 0.0, 1.0, 1.0, 0.225)


def name_field(px, py):
    """The rename affordance: a text field, a caret, and a line of text."""
    return rounded_rect(px, py, 0.115, 0.305, 0.885, 0.695, 0.09)


def caret(px, py):
    return rounded_rect(px, py, 0.215, 0.385, 0.325, 0.615, 0.05)


def text_line(px, py):
    return rounded_rect(px, py, 0.385, 0.435, 0.755, 0.565, 0.065)


LAYERS = [
    (name_field, WHITE),
    (caret, AMBER),
    (text_line, LAVENDER),
]


def gradient(py):
    t = max(0.0, min(1.0, py))
    return tuple(
        round(INDIGO_TOP[i] + (INDIGO_BOTTOM[i] - INDIGO_TOP[i]) * t) for i in range(3)
    )


def render(size, samples):
    step = 1.0 / (size * samples)
    half = step / 2.0
    rows = []
    for y in range(size):
        row = bytearray()
        for x in range(size):
            r = g = b = a = 0.0
            for sy in range(samples):
                py = (y * samples + sy) * step + half
                for sx in range(samples):
                    px = (x * samples + sx) * step + half
                    if not background(px, py):
                        continue
                    colour = gradient(py)
                    for test, layer_colour in LAYERS:
                        if test(px, py):
                            colour = layer_colour
                    r += colour[0]
                    g += colour[1]
                    b += colour[2]
                    a += 255.0
            total = samples * samples
            covered = a / 255.0
            if covered == 0:
                row += b"\x00\x00\x00\x00"
            else:
                row += bytes(
                    (
                        round(r / covered),
                        round(g / covered),
                        round(b / covered),
                        round(a / total),
                    )
                )
        rows.append(bytes(row))
    return rows


def write_png(path, size, rows):
    raw = b"".join(b"\x00" + row for row in rows)

    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    path.write_bytes(png)


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for size in SIZES:
        samples = 8 if size <= 48 else 5
        write_png(OUT_DIR / f"icon{size}.png", size, render(size, samples))
        print(f"icon{size}.png")
    # 128px doubles as the Chrome Web Store listing icon.


if __name__ == "__main__":
    main()
