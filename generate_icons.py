#!/usr/bin/env python3
"""Generate Purrductivity toolbar icons: a curled-up sleeping cat with Zzz.

No dependencies. Renders a smooth master at 384x384 and box-downsamples by
integer factors to 128 / 48 / 16 px PNGs (384 = 3*128 = 8*48 = 24*16).
"""
import zlib, struct

M = 384                      # master size (clean integer multiple of 16/48/128)
CX = M // 2

# palette ---------------------------------------------------------------
TRANSPARENT = (0, 0, 0, 0)
BODY    = (242, 168, 92)     # orange tabby
BELLY   = (250, 212, 170)
OUTLINE = (92, 58, 30)
STRIPE  = (214, 122, 52)
INEAR   = (247, 205, 168)
NOSE    = (224, 120, 140)
EYE     = (74, 51, 34)
ZZZ     = (201, 183, 236)

# master canvas: rows of [r,g,b,a] --------------------------------------
canvas = [[[0, 0, 0, 0] for _ in range(M)] for _ in range(M)]

def px(x, y, color):
    xi, yi = int(x), int(y)
    if 0 <= xi < M and 0 <= yi < M:
        canvas[yi][xi] = [color[0], color[1], color[2], 255]

def ellipse(cx, cy, rx, ry, color):
    for y in range(int(cy - ry), int(cy + ry) + 1):
        for x in range(int(cx - rx), int(cx + rx) + 1):
            if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0:
                px(x, y, color)

def circle(cx, cy, r, color):
    ellipse(cx, cy, r, r, color)

def triangle(p1, p2, p3, color):
    xs = [p1[0], p2[0], p3[0]]; ys = [p1[1], p2[1], p3[1]]
    def sign(a, b, c):
        return (a[0]-c[0])*(b[1]-c[1]) - (b[0]-c[0])*(a[1]-c[1])
    for y in range(int(min(ys)), int(max(ys)) + 1):
        for x in range(int(min(xs)), int(max(xs)) + 1):
            p = (x, y)
            d1, d2, d3 = sign(p, p1, p2), sign(p, p2, p3), sign(p, p3, p1)
            neg = (d1 < 0) or (d2 < 0) or (d3 < 0)
            pos = (d1 > 0) or (d2 > 0) or (d3 > 0)
            if not (neg and pos):
                px(x, y, color)

def rect(x0, y0, x1, y1, color):
    for y in range(int(y0), int(y1) + 1):
        for x in range(int(x0), int(x1) + 1):
            px(x, y, color)

def bezier_tail(color, grow=0):
    # quadratic bezier curl wrapping the front of the loaf, tapering tip
    P0 = (332, 232); P1 = (352, 352); P2 = (196, 348)
    steps = 60
    for i in range(steps + 1):
        t = i / steps
        x = (1-t)**2*P0[0] + 2*(1-t)*t*P1[0] + t*t*P2[0]
        y = (1-t)**2*P0[1] + 2*(1-t)*t*P1[1] + t*t*P2[1]
        r = (30 - 9 * t) + grow
        circle(x, y, r, color)

def draw_z(cx, cy, size, thick, color):
    h = size / 2
    rect(cx - h, cy - h, cx + h, cy - h + thick, color)      # top bar
    rect(cx - h, cy + h - thick, cx + h, cy + h, color)      # bottom bar
    steps = int(size * 1.6)
    for i in range(steps + 1):                                # diagonal
        t = i / steps
        x = (cx + h) + t * (-size)
        y = (cy - h) + t * (size)
        circle(x, y, thick / 2, color)

# --- build the sleeping cat -------------------------------------------
# Zzz first (behind, top-right)
draw_z(286, 150, 34, 8, ZZZ)
draw_z(322, 108, 46, 10, ZZZ)
draw_z(352, 58, 60, 12, ZZZ)

# outline silhouette (drawn slightly larger, behind the fills)
bezier_tail(OUTLINE, grow=7)
triangle((92, 182), (158, 182), (120, 108), OUTLINE)    # left ear
triangle((226, 182), (292, 182), (264, 108), OUTLINE)   # right ear
ellipse(CX, 252, 158, 104, OUTLINE)                     # body

# body fill
ellipse(CX, 252, 151, 97, BODY)
ellipse(CX, 286, 96, 58, BELLY)                         # lighter chest/belly

# ears
triangle((100, 178), (152, 178), (122, 116), BODY)
triangle((232, 178), (284, 178), (262, 116), BODY)
triangle((114, 172), (146, 172), (128, 134), INEAR)
triangle((238, 172), (270, 172), (256, 134), INEAR)

# forehead tabby stripes
rect(CX - 4, 150, CX + 4, 196, STRIPE)
rect(CX - 30, 156, CX - 22, 196, STRIPE)
rect(CX + 22, 156, CX + 30, 196, STRIPE)

# tail (in front of the loaf), with a darker tip
bezier_tail(BODY, grow=0)
circle(196, 348, 22, STRIPE)

# closed, happy sleeping eyes (down-curved crescents)
for ex in (CX - 56, CX + 56):
    ellipse(ex, 244, 26, 16, EYE)        # dark eye
    ellipse(ex, 234, 28, 18, BODY)       # mask the top -> leaves bottom arc

# nose + tiny muzzle line
triangle((CX - 11, 250), (CX + 11, 250), (CX, 266), NOSE)
rect(CX - 2, 266, CX + 2, 280, OUTLINE)

# whiskers
for dy in (256, 268):
    rect(CX - 96, dy, CX - 60, dy + 3, OUTLINE)
    rect(CX + 60, dy, CX + 96, dy + 3, OUTLINE)

# --- downsample + write PNGs ------------------------------------------
def downsample(f):
    n = M // f
    out = [[None] * n for _ in range(n)]
    for oy in range(n):
        for ox in range(n):
            R = G = B = A = 0
            for dy in range(f):
                row = canvas[oy * f + dy]
                for dx in range(f):
                    r, g, b, a = row[ox * f + dx]
                    R += r * a; G += g * a; B += b * a; A += a
            if A == 0:
                out[oy][ox] = (0, 0, 0, 0)
            else:
                out[oy][ox] = (round(R / A), round(G / A), round(B / A), round(A / (f * f)))
    return n, out

def write_png(path, n, pixels):
    def chunk(typ, data):
        return (struct.pack('>I', len(data)) + typ + data
                + struct.pack('>I', zlib.crc32(typ + data) & 0xffffffff))
    raw = bytearray()
    for row in pixels:
        raw.append(0)
        for (r, g, b, a) in row:
            raw += bytes((r, g, b, a))
    ihdr = struct.pack('>IIBBBBB', n, n, 8, 6, 0, 0, 0)
    with open(path, 'wb') as fh:
        fh.write(b'\x89PNG\r\n\x1a\n')
        fh.write(chunk(b'IHDR', ihdr))
        fh.write(chunk(b'IDAT', zlib.compress(bytes(raw), 9)))
        fh.write(chunk(b'IEND', b''))

for size, factor in ((128, 3), (48, 8), (16, 24)):
    n, pixels = downsample(factor)
    write_png(f'icons/icon{size}.png', n, pixels)
    print(f'wrote icons/icon{size}.png ({n}x{n})')
