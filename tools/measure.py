"""
Measure where the model actually sits in a capture.

Pure stdlib PNG reader (no PIL on this machine). Prints, for a given
column band, the first and last rows that contain a pixel brighter than a
threshold — which for a black studio is the top and bottom of the subject.

  python measure.py shot.png --x0 60 --x1 330 --y1 560
"""

import argparse
import struct
import zlib


def read_png(path):
    with open(path, "rb") as fh:
        data = fh.read()
    assert data[:8] == b"\x89PNG\r\n\x1a\n", "not a png"
    pos = 8
    idat = b""
    width = height = bitdepth = colortype = None
    while pos < len(data):
        (length,) = struct.unpack(">I", data[pos : pos + 4])
        kind = data[pos + 4 : pos + 8]
        body = data[pos + 8 : pos + 8 + length]
        if kind == b"IHDR":
            width, height, bitdepth, colortype, _, _, interlace = struct.unpack(">IIBBBBB", body)
            assert interlace == 0, "interlaced png"
        elif kind == b"IDAT":
            idat += body
        elif kind == b"IEND":
            break
        pos += 12 + length
    assert bitdepth == 8, f"bit depth {bitdepth}"
    channels = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[colortype]
    raw = zlib.decompress(idat)
    stride = width * channels
    out = bytearray(height * stride)
    prev = bytearray(stride)
    at = 0
    for y in range(height):
        f = raw[at]
        at += 1
        line = bytearray(raw[at : at + stride])
        at += stride
        if f == 1:
            for i in range(channels, stride):
                line[i] = (line[i] + line[i - channels]) & 0xFF
        elif f == 2:
            for i in range(stride):
                line[i] = (line[i] + prev[i]) & 0xFF
        elif f == 3:
            for i in range(stride):
                left = line[i - channels] if i >= channels else 0
                line[i] = (line[i] + ((left + prev[i]) >> 1)) & 0xFF
        elif f == 4:
            for i in range(stride):
                a = line[i - channels] if i >= channels else 0
                b = prev[i]
                c = prev[i - channels] if i >= channels else 0
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[i] = (line[i] + pr) & 0xFF
        out[y * stride : (y + 1) * stride] = line
        prev = line
    return width, height, channels, out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("path")
    ap.add_argument("--x0", type=int, default=0)
    ap.add_argument("--x1", type=int, default=10**6)
    ap.add_argument("--y0", type=int, default=0)
    ap.add_argument("--y1", type=int, default=10**6)
    ap.add_argument("--threshold", type=int, default=64, help="luma above which a pixel counts as subject")
    ap.add_argument("--min-run", type=int, default=6, help="lit pixels a row needs before it counts")
    args = ap.parse_args()

    w, h, ch, px = read_png(args.path)
    x1 = min(args.x1, w - 1)
    y1 = min(args.y1, h - 1)
    rows = []
    left, right = w, -1
    for y in range(args.y0, y1 + 1):
        base = y * w * ch
        lit = 0
        for x in range(args.x0, x1 + 1):
            i = base + x * ch
            luma = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) // 1000
            if luma >= args.threshold:
                lit += 1
                if x < left:
                    left = x
                if x > right:
                    right = x
        if lit >= args.min_run:
            rows.append(y)
    print(f"image {w}x{h} channels={ch}")
    if not rows:
        print("nothing above threshold in that window")
        return
    print(f"subject rows {rows[0]}..{rows[-1]}  height {rows[-1] - rows[0] + 1}px")
    print(f"subject cols {left}..{right}  width {right - left + 1}px")


if __name__ == "__main__":
    main()
