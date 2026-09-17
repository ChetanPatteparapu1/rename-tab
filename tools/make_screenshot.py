#!/usr/bin/env python3
"""Turn a screenshot into a Chrome Web Store screenshot.

The store wants 1280x800 or 640x400, and a 24-bit PNG with no alpha channel.
macOS screenshots are always RGBA, which is why they get rejected. This resizes
the capture to fit, centres it on an opaque background, and writes a plain RGB
PNG that the store accepts.

    ./tools/make_screenshot.py ~/Desktop/shot.png store-assets/screenshot-1.png

Only the standard library is used, so there is nothing to install.
"""

import struct
import subprocess
import sys
import tempfile
import zlib
from pathlib import Path

CANVAS = (1280, 800)
MARGIN = 48
BACKGROUND = (0x4F, 0x46, 0xE5)  # the extension's indigo


def fail(message):
    print(message, file=sys.stderr)
    raise SystemExit(1)


def read_png(path):
    """Decode a non-interlaced 8 or 16 bit greyscale/RGB PNG, with or without alpha."""
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        fail(f"{path} is not a PNG")

    width = height = depth = color_type = interlace = None
    compressed = bytearray()
    pos = 8
    while pos < len(data):
        length = struct.unpack(">I", data[pos : pos + 4])[0]
        tag = data[pos + 4 : pos + 8]
        chunk = data[pos + 8 : pos + 8 + length]
        if tag == b"IHDR":
            width, height, depth, color_type, _, _, interlace = struct.unpack(
                ">IIBBBBB", chunk
            )
        elif tag == b"IDAT":
            compressed += chunk
        elif tag == b"IEND":
            break
        pos += 12 + length

    if interlace:
        fail("interlaced PNGs are not supported; re-save the screenshot")
    if color_type == 3:
        fail("palette PNGs are not supported; re-save the screenshot")

    channels = {0: 1, 2: 3, 4: 2, 6: 4}[color_type]
    sample_bytes = depth // 8
    pixel_bytes = channels * sample_bytes
    stride = width * pixel_bytes

    raw = zlib.decompress(bytes(compressed))
    rows = []
    previous = bytearray(stride)
    offset = 0
    for _ in range(height):
        filter_type = raw[offset]
        offset += 1
        line = bytearray(raw[offset : offset + stride])
        offset += stride

        if filter_type == 1:
            for x in range(pixel_bytes, stride):
                line[x] = (line[x] + line[x - pixel_bytes]) & 0xFF
        elif filter_type == 2:
            for x in range(stride):
                line[x] = (line[x] + previous[x]) & 0xFF
        elif filter_type == 3:
            for x in range(stride):
                left = line[x - pixel_bytes] if x >= pixel_bytes else 0
                line[x] = (line[x] + ((left + previous[x]) >> 1)) & 0xFF
        elif filter_type == 4:
            for x in range(stride):
                left = line[x - pixel_bytes] if x >= pixel_bytes else 0
                up = previous[x]
                upleft = previous[x - pixel_bytes] if x >= pixel_bytes else 0
                estimate = left + up - upleft
                da, db, dc = (
                    abs(estimate - left),
                    abs(estimate - up),
                    abs(estimate - upleft),
                )
                if da <= db and da <= dc:
                    line[x] = (line[x] + left) & 0xFF
                elif db <= dc:
                    line[x] = (line[x] + up) & 0xFF
                else:
                    line[x] = (line[x] + upleft) & 0xFF
        elif filter_type != 0:
            fail(f"unknown PNG filter {filter_type}")

        rows.append(bytes(line))
        previous = line

    return width, height, depth, channels, rows


def to_rgba(rows, width, depth, channels):
    """Normalise any supported pixel layout to 8-bit RGBA tuples per row."""
    step = depth // 8
    out = []
    for line in rows:
        pixels = []
        for x in range(width):
            base = x * channels * step
            samples = [line[base + i * step] for i in range(channels)]  # high byte if 16-bit
            if channels == 1:
                r = g = b = samples[0]
                a = 255
            elif channels == 2:
                r = g = b = samples[0]
                a = samples[1]
            elif channels == 3:
                r, g, b = samples
                a = 255
            else:
                r, g, b, a = samples
            pixels.append((r, g, b, a))
        out.append(pixels)
    return out


def write_rgb_png(path, width, height, rows):
    """Write colour type 2: 8-bit RGB, no alpha, which is what the store requires."""
    raw = bytearray()
    for row in rows:
        raw.append(0)  # filter: none
        for r, g, b in row:
            raw += bytes((r, g, b))

    def chunk(tag, payload):
        return (
            struct.pack(">I", len(payload))
            + tag
            + payload
            + struct.pack(">I", zlib.crc32(tag + payload) & 0xFFFFFFFF)
        )

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")
    path.write_bytes(png)


def main():
    if len(sys.argv) < 2:
        fail("usage: make_screenshot.py <source image> [destination.png]")

    source = Path(sys.argv[1]).expanduser()
    if not source.exists():
        fail(f"{source} does not exist")
    destination = Path(sys.argv[2] if len(sys.argv) > 2 else "store-assets/screenshot.png")
    destination.parent.mkdir(parents=True, exist_ok=True)

    canvas_w, canvas_h = CANVAS
    with tempfile.TemporaryDirectory() as workdir:
        resized = Path(workdir) / "resized.png"

        # sips reads anything the Mac can open, and handles the resampling.
        probe = subprocess.run(
            ["sips", "-g", "pixelWidth", "-g", "pixelHeight", str(source)],
            capture_output=True,
            text=True,
        )
        numbers = [int(word) for word in probe.stdout.split() if word.isdigit()]
        if len(numbers) < 2:
            fail(f"could not read the size of {source}")
        source_w, source_h = numbers[0], numbers[1]

        scale = min(
            (canvas_w - 2 * MARGIN) / source_w,
            (canvas_h - 2 * MARGIN) / source_h,
            1.0,
        )
        longest = round(max(source_w, source_h) * scale)
        subprocess.run(
            ["sips", "-s", "format", "png", "-Z", str(longest), str(source), "--out", str(resized)],
            capture_output=True,
        )
        if not resized.exists():
            fail("sips could not convert that file")

        width, height, depth, channels, rows = read_png(resized)

    pixels = to_rgba(rows, width, depth, channels)

    # Flatten onto an opaque background, which both removes the alpha channel and
    # keeps rounded window corners from turning black.
    br, bg, bb = BACKGROUND
    canvas = [[(br, bg, bb)] * canvas_w for _ in range(canvas_h)]
    left = (canvas_w - width) // 2
    top = (canvas_h - height) // 2

    for y, row in enumerate(pixels):
        target = canvas[top + y]
        for x, (r, g, b, a) in enumerate(row):
            if a == 255:
                target[left + x] = (r, g, b)
            elif a:
                target[left + x] = (
                    (r * a + br * (255 - a)) // 255,
                    (g * a + bg * (255 - a)) // 255,
                    (b * a + bb * (255 - a)) // 255,
                )

    write_rgb_png(destination, canvas_w, canvas_h, canvas)
    print(f"{destination}  {canvas_w}x{canvas_h}  24-bit RGB, no alpha")


if __name__ == "__main__":
    main()
