#!/usr/bin/env python3
"""Genera las casas de los planetas de Atlas Terrenos (ilustraciones procedurales vistas desde arriba).

    pip install pillow numpy
    python3 tools/make-planet-houses.py

Crea en images/ las casas de cada mundo (6 por planeta) en 4 tamaños, igual que las de la Tierra:
  <mundo>-<casa>.webp (768) · -m (512) · -s (256) · -t (128)
Para cambiar alguna por una imagen tuya, sustituye esos 4 archivos con el mismo nombre. No hay que tocar código.
La lista de casas por mundo (WORLD_HOUSES) está en app.js y en server.js: deben coincidir con HOUSES de abajo.
"""
import math
import os
import sys
import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'images')
S = 1536          # lienzo de trabajo (se reduce a 768)
C = S // 2

# ---------- lista de casas por mundo: (nombre del archivo, tipo, variante) ----------
HOUSES = {
    'luna': [('cupula', 'domes', 'a'), ('base-apolo', 'flagbase', ''), ('granja-solar', 'solar', ''),
             ('radiotelescopio', 'dish', ''), ('mina-regolito', 'mine', ''), ('puerto-lunar', 'pad', '')],
    'marte': [('cupula-marciana', 'domes', 'green'), ('invernadero', 'greenhouse', ''), ('base-rover', 'rover', ''),
              ('mina-roja', 'mine', ''), ('torre-radio', 'dish', ''), ('puerto-marte', 'pad', '')],
    'mercurio': [('base-crater', 'mine', 'base'), ('escudo-solar', 'solar', 'big'), ('observatorio', 'domes', 'obs'),
                 ('mina-metal', 'mine', ''), ('antena-solar', 'dish', ''), ('estacion-polar', 'lab', '')],
    'venus': [('ciudad-aerostato', 'balloon', ''), ('plataforma-nube', 'platform', 'tanks'), ('laboratorio-acido', 'lab', ''),
              ('globo-dorado', 'balloon', 'single'), ('torre-nubes', 'platform', 'dish'), ('puerto-aereo', 'platform', 'pad')],
    'jupiter': [('plataforma-flotante', 'platform', 'tanks'), ('globo-gas', 'balloon', 'single'), ('refineria-hidrogeno', 'platform', 'refinery'),
                ('observatorio-tormenta', 'platform', 'dish'), ('ciudad-nube', 'balloon', ''), ('puerto-nubes', 'platform', 'pad')],
    'saturno': [('plataforma-anillos', 'platform', 'dish'), ('ciudad-flotante', 'balloon', ''), ('globo-anillo', 'balloon', 'single'),
                ('laboratorio-gas', 'platform', 'lab'), ('refineria-saturno', 'platform', 'refinery'), ('puerto-saturno', 'platform', 'pad')],
    'urano': [('cristal-hielo', 'crystal', ''), ('plataforma-azul', 'platform', 'tanks'), ('globo-hielo', 'balloon', 'single'),
              ('estacion-eje', 'platform', 'lab'), ('refineria-metano', 'platform', 'refinery'), ('puerto-urano', 'platform', 'pad')],
    'neptuno': [('plataforma-tormenta', 'platform', 'dish'), ('globo-azul', 'balloon', 'single'), ('refineria-diamante', 'platform', 'refinery'),
                ('ciudad-neptuno', 'balloon', ''), ('laboratorio-frio', 'platform', 'lab'), ('puerto-neptuno', 'platform', 'pad')],
    'pluton': [('cupula-hielo', 'domes', 'ice'), ('base-corazon', 'lab', 'ice'), ('criolaboratorio', 'crystal', 'lab'),
               ('mina-nitrogeno', 'mine', 'ice'), ('sonda-horizontes', 'probe', ''), ('refugio-polar', 'greenhouse', 'ice')],
}

# colores del suelo / de las nubes de cada mundo: base, claro, oscuro
GROUND = {
    'luna': ((142, 142, 142), (176, 176, 176), (98, 98, 98)),
    'marte': ((172, 92, 56), (205, 128, 84), (118, 56, 34)),
    'mercurio': ((150, 140, 128), (186, 176, 162), (96, 88, 80)),
    'venus': ((228, 168, 64), (248, 214, 128), (190, 118, 36)),
    'jupiter': ((214, 178, 130), (240, 216, 172), (160, 100, 60)),
    'saturno': ((228, 208, 152), (246, 234, 190), (180, 148, 94)),
    'urano': ((152, 222, 228), (206, 246, 246), (96, 176, 188)),
    'neptuno': ((64, 100, 220), (128, 164, 255), (28, 48, 140)),
    'pluton': ((196, 168, 148), (240, 232, 220), (120, 88, 74)),
}
GAS = {'venus', 'jupiter', 'saturno', 'urano', 'neptuno'}
GLASS = {'luna': (160, 220, 255), 'marte': (255, 200, 150), 'mercurio': (255, 230, 160), 'pluton': (200, 235, 255)}


# ---------- utilidades ----------
def smooth_noise(seed, cells, size=S):
    r = np.random.default_rng(seed)
    a = r.random((cells, cells)).astype(np.float32)
    im = Image.fromarray((a * 255).astype(np.uint8)).resize((size, size), Image.BICUBIC)
    return np.asarray(im, dtype=np.float32) / 255.0


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def shade(c, k):
    return tuple(max(0, min(255, int(v * k))) for v in c)


def make_ground(world, seed):
    base, light, dark = GROUND[world]
    n = 0.55 * smooth_noise(seed, 6) + 0.3 * smooth_noise(seed + 1, 18) + 0.15 * smooth_noise(seed + 2, 60)
    n = (n - n.min()) / (n.max() - n.min())
    if world in GAS:   # nubes: bandas onduladas
        yy = np.linspace(0, 1, S)[:, None] * np.ones((1, S))
        xx = np.ones((S, 1)) * np.linspace(0, 1, S)[None, :]
        warp = (smooth_noise(seed + 7, 5) - 0.5) * 0.35
        bands = 0.5 + 0.5 * np.sin((yy + warp) * 2 * math.pi * 5 + smooth_noise(seed + 8, 9) * 3)
        n = 0.55 * bands + 0.45 * n
    n = n[..., None]
    lo = np.array(dark, dtype=np.float32)
    mid = np.array(base, dtype=np.float32)
    hi = np.array(light, dtype=np.float32)
    t = np.clip(n, 0, 1)
    arr = np.where(t < 0.5, lo + (mid - lo) * (t * 2), mid + (hi - mid) * ((t - 0.5) * 2))
    grain = (np.random.default_rng(seed + 3).random((S, S, 1)) - 0.5) * 14
    arr = np.clip(arr + grain, 0, 255).astype(np.uint8)
    img = Image.fromarray(arr, 'RGB').convert('RGBA')
    if world not in GAS:   # cráteres y piedras
        d = ImageDraw.Draw(img, 'RGBA')
        r = np.random.default_rng(seed + 5)
        for _ in range(26):
            x, y, rad = r.integers(0, S), r.integers(0, S), int(r.integers(20, 90))
            d.ellipse([x - rad, y - rad, x + rad, y + rad], fill=shade(dark, 0.85) + (70,))
            d.arc([x - rad, y - rad, x + rad, y + rad], 200, 340, fill=light + (150,), width=max(3, rad // 12))
        for _ in range(140):
            x, y, rad = r.integers(0, S), r.integers(0, S), int(r.integers(4, 12))
            d.ellipse([x - rad, y - rad, x + rad, y + rad], fill=shade(dark, 0.7) + (180,))
    return img.filter(ImageFilter.GaussianBlur(1.2))


def shadow(img, drawfn, off=(26, 34), blur=20, alpha=120):
    m = Image.new('L', img.size, 0)
    drawfn(ImageDraw.Draw(m))
    m = m.filter(ImageFilter.GaussianBlur(blur))
    m = ImageChops.offset(m, off[0], off[1])
    black = Image.new('RGBA', img.size, (10, 8, 14, 0))
    black.putalpha(m.point(lambda v: int(v * alpha / 255)))
    img.alpha_composite(black)


def radial(size, c_in, c_out, light=(-0.35, -0.4)):
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    cx, cy = size / 2 * (1 + light[0] * 0.5), size / 2 * (1 + light[1] * 0.5)
    d = np.clip(np.hypot(xx - cx, yy - cy) / (size * 0.62), 0, 1)[..., None]
    a, b = np.array(c_in, np.float32), np.array(c_out, np.float32)
    return Image.fromarray((a + (b - a) * d).astype(np.uint8), 'RGB').convert('RGBA')


def ball(img, cx, cy, r, c_in, c_out, rim=None, alpha=255):
    shadow(img, lambda d: d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=255), off=(int(r * .12), int(r * .16)), blur=int(r * .1) + 4, alpha=110)
    g = radial(2 * r, c_in, c_out)
    m = Image.new('L', (2 * r, 2 * r), 0)
    ImageDraw.Draw(m).ellipse([0, 0, 2 * r - 1, 2 * r - 1], fill=alpha)
    g.putalpha(m)
    img.alpha_composite(g, (cx - r, cy - r))
    if rim:
        ImageDraw.Draw(img).ellipse([cx - r, cy - r, cx + r, cy + r], outline=rim, width=max(3, r // 28))


def rrect(img, box, fill, outline=None, rad=18, sh=True, width=4):
    if sh:
        shadow(img, lambda d: d.rounded_rectangle(box, rad, fill=255), off=(16, 22), blur=14, alpha=110)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle(box, rad, fill=fill, outline=outline, width=width)


def tube(img, p, q, w=36, col=(214, 218, 224)):
    shadow(img, lambda d: d.line([p, q], fill=255, width=w), off=(12, 16), blur=8, alpha=100)
    d = ImageDraw.Draw(img)
    d.line([p, q], fill=shade(col, .7), width=w)
    d.line([p, q], fill=col, width=w - 10)


def panel(img, box, cols=4, rows=3, col=(36, 70, 150)):
    x0, y0, x1, y1 = box
    rrect(img, box, shade(col, .8), outline=(210, 214, 222), rad=6, width=5)
    d = ImageDraw.Draw(img, 'RGBA')
    for i in range(1, cols):
        d.line([(x0 + (x1 - x0) * i / cols, y0 + 4), (x0 + (x1 - x0) * i / cols, y1 - 4)], fill=(200, 215, 240, 200), width=3)
    for j in range(1, rows):
        d.line([(x0 + 4, y0 + (y1 - y0) * j / rows), (x1 - 4, y0 + (y1 - y0) * j / rows)], fill=(200, 215, 240, 200), width=3)
    d.polygon([(x0 + 8, y0 + 8), (x0 + (x1 - x0) * .55, y0 + 8), (x0 + 8, y0 + (y1 - y0) * .5)], fill=(255, 255, 255, 40))


def dome(img, cx, cy, r, glass, inner=None):
    ball(img, cx, cy, r + 10, (225, 228, 235), (150, 156, 168))   # aro metálico
    g = radial(2 * r, tuple(min(255, v + 40) for v in glass), shade(glass, .55))
    m = Image.new('L', (2 * r, 2 * r), 0)
    ImageDraw.Draw(m).ellipse([0, 0, 2 * r - 1, 2 * r - 1], fill=235)
    g.putalpha(m)
    img.alpha_composite(g, (cx - r, cy - r))
    d = ImageDraw.Draw(img, 'RGBA')
    if inner:   # edificios dentro
        rs = np.random.default_rng(cx * 7 + cy)
        for _ in range(7):
            a, rr = rs.random() * 6.28, rs.random() * r * .55
            x, y, w = cx + math.cos(a) * rr, cy + math.sin(a) * rr, int(r * (.1 + rs.random() * .12))
            d.rounded_rectangle([x - w, y - w, x + w, y + w], 6, fill=inner + (230,))
    for k in range(8):   # nervios
        a = k * math.pi / 4
        d.line([(cx, cy), (cx + math.cos(a) * r, cy + math.sin(a) * r)], fill=(255, 255, 255, 90), width=4)
    for f in (.35, .68):
        d.ellipse([cx - r * f, cy - r * f, cx + r * f, cy + r * f], outline=(255, 255, 255, 70), width=4)
    d.ellipse([cx - r * .62, cy - r * .7, cx - r * .12, cy - r * .32], fill=(255, 255, 255, 80))


def dish(img, cx, cy, r, col=(226, 230, 236)):
    ball(img, cx, cy, r, tuple(min(255, v + 20) for v in col), shade(col, .62), rim=(255, 255, 255))
    d = ImageDraw.Draw(img, 'RGBA')
    for f in (.25, .5, .75):
        d.ellipse([cx - r * f, cy - r * f, cx + r * f, cy + r * f], outline=(90, 96, 110, 120), width=4)
    for k in range(12):
        a = k * math.pi / 6
        d.line([(cx, cy), (cx + math.cos(a) * r, cy + math.sin(a) * r)], fill=(90, 96, 110, 110), width=3)
    ex, ey = cx + r * .75, cy + r * .75   # brazo y receptor
    d.line([(cx, cy), (ex, ey)], fill=(60, 64, 74, 255), width=8)
    d.ellipse([ex - 18, ey - 18, ex + 18, ey + 18], fill=(230, 80, 60, 255))
    d.ellipse([cx - 16, cy - 16, cx + 16, cy + 16], fill=(70, 74, 86, 255))


def pad(img, cx, cy, r, ship=True):
    ball(img, cx, cy, r, (92, 96, 106), (52, 56, 66), rim=(230, 200, 60))
    d = ImageDraw.Draw(img, 'RGBA')
    d.ellipse([cx - r * .78, cy - r * .78, cx + r * .78, cy + r * .78], outline=(240, 240, 240, 200), width=7)
    for k in range(12):
        a = k * math.pi / 6
        x, y = cx + math.cos(a) * r * .9, cy + math.sin(a) * r * .9
        d.ellipse([x - 9, y - 9, x + 9, y + 9], fill=(255, 190, 60, 255))
    if ship:   # cohete visto desde arriba
        d.polygon([(cx, cy - r * .5), (cx - r * .14, cy + r * .08), (cx + r * .14, cy + r * .08)], fill=(236, 238, 242, 255))
        d.polygon([(cx - r * .14, cy), (cx - r * .46, cy + r * .42), (cx - r * .1, cy + r * .2)], fill=(214, 70, 60, 255))
        d.polygon([(cx + r * .14, cy), (cx + r * .46, cy + r * .42), (cx + r * .1, cy + r * .2)], fill=(214, 70, 60, 255))
        d.ellipse([cx - r * .07, cy - r * .12, cx + r * .07, cy + r * .02], fill=(70, 120, 200, 255))
    else:
        d.text((cx - 30, cy - 40), 'H', fill=(240, 240, 240, 220), font=None)
        d.rectangle([cx - 8, cy - r * .4, cx + 8, cy + r * .4], fill=(240, 240, 240, 200))
        d.rectangle([cx - r * .3, cy - 8, cx + r * .3, cy + 8], fill=(240, 240, 240, 200))


# ---------- tipos de casa ----------
def k_domes(img, world, v):
    glass = GLASS.get(world, (170, 220, 255))
    if v == 'green':
        glass = (150, 235, 170)
    if v == 'obs':
        dome(img, C, C, 300, (196, 204, 214))
        d = ImageDraw.Draw(img, 'RGBA')
        d.rectangle([C - 26, C - 300, C + 26, C + 300], fill=(20, 24, 34, 230))   # rendija del telescopio
        return
    tube(img, (C - 220, C + 150), (C + 230, C + 170))
    tube(img, (C + 40, C - 160), (C + 230, C + 170))
    dome(img, C - 110, C + 120, 250, glass, inner=(236, 232, 224))
    dome(img, C + 270, C + 190, 150, glass, inner=(236, 232, 224))
    dome(img, C + 130, C - 250, 170, glass, inner=(120, 190, 120) if v == 'green' else (236, 232, 224))


def k_flagbase(img, world, v):
    d = ImageDraw.Draw(img, 'RGBA')
    shadow(img, lambda m: m.polygon([(C - 150, C - 60), (C - 60, C - 160), (C + 60, C - 160), (C + 150, C - 60), (C + 150, C + 60), (C + 60, C + 160), (C - 60, C + 160), (C - 150, C + 60)], fill=255), blur=22)
    d.polygon([(C - 150, C - 60), (C - 60, C - 160), (C + 60, C - 160), (C + 150, C - 60), (C + 150, C + 60), (C + 60, C + 160), (C - 60, C + 160), (C - 150, C + 60)], fill=(214, 176, 70, 255), outline=(150, 120, 40, 255))
    for k in range(8):
        a = k * math.pi / 4 + math.pi / 8
        d.line([(C, C), (C + math.cos(a) * 160, C + math.sin(a) * 160)], fill=(160, 126, 44, 255), width=5)
    ball(img, C, C, 70, (240, 240, 244), (160, 164, 174))
    for a in (0, 90, 180, 270):   # patas
        x, y = C + math.cos(math.radians(a)) * 230, C + math.sin(math.radians(a)) * 230
        ball(img, int(x), int(y), 32, (230, 230, 234), (130, 134, 144))
    # bandera
    d.line([(C + 330, C - 250), (C + 330, C - 80)], fill=(240, 240, 240, 255), width=7)
    d.rectangle([C + 330, C - 250, C + 440, C - 190], fill=(214, 60, 60, 255))
    for i in range(6):   # huellas
        d.ellipse([C - 340 + i * 38, C + 300 + (i % 2) * 22, C - 316 + i * 38, C + 336 + (i % 2) * 22], fill=(70, 70, 70, 130))


def k_solar(img, world, v):
    big = v == 'big'
    cols, rows = (3, 4) if big else (3, 3)
    pw, ph, gap = (300, 250, 30) if big else (300, 300, 36)
    x0 = C - (cols * pw + (cols - 1) * gap) // 2
    y0 = C - (rows * ph + (rows - 1) * gap) // 2
    for i in range(cols):
        for j in range(rows):
            if not big and i == 1 and j == 1:
                continue
            panel(img, (x0 + i * (pw + gap), y0 + j * (ph + gap), x0 + i * (pw + gap) + pw, y0 + j * (ph + gap) + ph))
    if not big:
        rrect(img, (C - 130, C - 130, C + 130, C + 130), (232, 234, 240), outline=(120, 126, 140), rad=22)
        ball(img, C, C, 60, (255, 200, 80), (200, 130, 30))


def k_dish(img, world, v):
    rrect(img, (C - 330, C + 120, C - 110, C + 300), (228, 230, 236), outline=(120, 126, 140), rad=18)
    dish(img, C + 60, C - 40, 380)
    tube(img, (C - 110, C + 200), (C + 120, C + 260), 28)


def k_pad(img, world, v):
    pad(img, C, C - 40, 420)
    rrect(img, (C - 380, C + 380, C - 60, C + 540), (232, 234, 240), outline=(120, 126, 140), rad=20)
    rrect(img, (C + 60, C + 380, C + 380, C + 540), (232, 234, 240), outline=(120, 126, 140), rad=20)


def k_mine(img, world, v):
    base, light, dark = GROUND[world]
    d = ImageDraw.Draw(img, 'RGBA')
    cx, cy = C - 70, C + 30
    for i, f in enumerate((1, .8, .6, .42, .26)):   # terrazas del pozo
        rx, ry = 430 * f, 360 * f
        col = lerp(light, dark, i / 4)
        d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=col + (255,), outline=shade(dark, .6) + (255,), width=5)
    d.ellipse([cx - 60, cy - 50, cx + 60, cy + 50], fill=(18, 14, 18, 255))
    if v == 'ice':
        d.ellipse([cx - 120, cy - 100, cx + 120, cy + 100], fill=(200, 240, 255, 220))
    # grúa y cinta
    rrect(img, (C + 250, C - 330, C + 470, C - 120), (236, 170, 40), outline=(120, 84, 20), rad=16)
    d.line([(C + 330, C - 230), (cx, cy)], fill=(70, 74, 84, 255), width=14)
    for k in range(5):
        d.line([(C + 330 - k * 50, C - 230 + k * 30), (C + 360 - k * 50, C - 200 + k * 30)], fill=(250, 220, 90, 255), width=6)
    rrect(img, (C + 230, C + 160, C + 400, C + 250), (240, 240, 244), outline=(120, 126, 140), rad=14)   # camión
    ball(img, C + 250, C + 270, 22, (40, 40, 44), (10, 10, 14))
    ball(img, C + 380, C + 270, 22, (40, 40, 44), (10, 10, 14))
    if v == 'base':
        dome(img, C + 350, C + 330, 150, (255, 230, 160), inner=(236, 232, 224))


def k_greenhouse(img, world, v):
    ice = v == 'ice'
    glass = (200, 235, 255) if ice else (150, 235, 170)
    for j, y in enumerate((C - 330, C - 60, C + 210)):
        rrect(img, (C - 420, y, C + 420, y + 220), (226, 232, 238), outline=(150, 160, 172), rad=40)
        d = ImageDraw.Draw(img, 'RGBA')
        d.rounded_rectangle([C - 400, y + 20, C + 400, y + 200], 34, fill=glass + (230,))
        for i in range(10):
            xx = C - 360 + i * 80
            d.line([(xx, y + 24), (xx, y + 196)], fill=(255, 255, 255, 120), width=4)
            if not ice:
                d.ellipse([xx - 20, y + 80, xx + 20, y + 120], fill=(46, 150, 70, 255))
    tube(img, (C - 410, C - 220), (C - 410, C + 320), 30)


def k_rover(img, world, v):
    rrect(img, (C - 420, C - 300, C - 90, C - 70), (234, 236, 242), outline=(120, 126, 140), rad=26)
    ball(img, C - 255, C - 185, 64, (255, 210, 120), (200, 130, 40))
    pad(img, C + 190, C - 150, 200, ship=False)
    d = ImageDraw.Draw(img, 'RGBA')
    for k in range(10):   # rodadas
        d.line([(C - 120 + k * 30, C + 190 + (k % 2) * 6), (C - 100 + k * 30, C + 190 + (k % 2) * 6)], fill=(60, 40, 30, 120), width=10)
        d.line([(C - 120 + k * 30, C + 270 + (k % 2) * 6), (C - 100 + k * 30, C + 270 + (k % 2) * 6)], fill=(60, 40, 30, 120), width=10)
    rrect(img, (C + 180, C + 170, C + 440, C + 300), (240, 240, 244), outline=(120, 126, 140), rad=16)
    for x in (C + 200, C + 310, C + 420):
        for y in (C + 160, C + 310):
            ball(img, x, y, 24, (50, 50, 56), (12, 12, 16))
    d.polygon([(C + 380, C + 190), (C + 430, C + 190), (C + 430, C + 280), (C + 380, C + 280)], fill=(70, 120, 200, 255))
    dish(img, C + 270, C + 235, 40)


def k_lab(img, world, v):
    ice = v == 'ice'
    body = (236, 242, 248) if ice else (230, 232, 238)
    for a in (0, 90, 180, 270):   # brazos con paneles
        dx, dy = math.cos(math.radians(a)), math.sin(math.radians(a))
        tube(img, (C, C), (int(C + dx * 330), int(C + dy * 330)), 60, body)
        px, py = int(C + dx * 470), int(C + dy * 470)
        if dx != 0:
            panel(img, (px - 80, py - 230, px + 80, py + 230), 2, 4)
        else:
            panel(img, (px - 230, py - 80, px + 230, py + 80), 4, 2)
    ball(img, C, C, 170, (255, 255, 255), shade(body, .7), rim=(150, 160, 172))
    ball(img, C, C, 90, (120, 190, 255) if ice else (255, 200, 90), (60, 100, 170) if ice else (190, 120, 30))


def k_crystal(img, world, v):
    d = ImageDraw.Draw(img, 'RGBA')
    r = np.random.default_rng(11)
    items = [(C, C, 360)] + [(C + math.cos(a) * 330, C + math.sin(a) * 300, 150 + r.integers(0, 90)) for a in np.linspace(0, 6.28, 6, endpoint=False)]
    for (x, y, s) in sorted(((float(a), float(b), float(c)) for a, b, c in items), key=lambda t: -t[2]):
        shadow(img, lambda m, x=x, y=y, s=s: m.regular_polygon((x, y, s), 6, fill=255), off=(20, 28), blur=16, alpha=110)
        for k in range(6):   # caras de cristal
            a0, a1 = math.pi / 3 * k, math.pi / 3 * (k + 1)
            pts = [(x, y), (x + math.cos(a0) * s, y + math.sin(a0) * s), (x + math.cos(a1) * s, y + math.sin(a1) * s)]
            t = .5 + .5 * math.cos(a0 + 1.2)
            d.polygon(pts, fill=lerp((150, 215, 245), (236, 250, 255), t) + (235,), outline=(255, 255, 255, 200))
        d.regular_polygon((x, y, s * .22), 6, fill=(255, 255, 255, 190))
    if v == 'lab':
        dome(img, C + 380, C + 400, 110, (200, 235, 255), inner=(236, 232, 224))


def k_balloon(img, world, v):
    base, light, dark = GROUND[world]
    tint = lerp((255, 255, 255), base, .35)
    single = v == 'single'
    d = ImageDraw.Draw(img, 'RGBA')
    if single:
        r = 440
        ball(img, C, C - 40, r, tuple(min(255, c + 30) for c in tint), shade(tint, .62))
        for k in range(14):   # gajos
            a = k * math.pi / 7
            d.line([(C, C - 40), (C + math.cos(a) * r, C - 40 + math.sin(a) * r)], fill=(255, 255, 255, 110), width=5)
        ball(img, C, C - 40, 82, (240, 240, 244), (130, 134, 146), rim=(60, 64, 74))
        d.ellipse([C - 150, C - 260, C - 40, C - 190], fill=(255, 255, 255, 80))
        return
    ball(img, C, C, 470, (232, 236, 242), (140, 146, 160), rim=(90, 96, 110))   # anillo ciudad
    ball(img, C, C, 330, tuple(min(255, c + 30) for c in tint), shade(tint, .65))
    for k in range(10):
        a = k * math.pi / 5
        d.line([(C, C), (C + math.cos(a) * 330, C + math.sin(a) * 330)], fill=(255, 255, 255, 100), width=5)
    for k in range(8):
        a = k * math.pi / 4 + .3
        x, y = C + math.cos(a) * 400, C + math.sin(a) * 400
        d.rounded_rectangle([x - 34, y - 34, x + 34, y + 34], 10, fill=(250, 250, 252, 255), outline=(110, 116, 130, 255), width=4)
    ball(img, C, C, 100, (246, 246, 250), (140, 146, 160), rim=(70, 74, 86))


def k_platform(img, world, v):
    d = ImageDraw.Draw(img, 'RGBA')
    shadow(img, lambda m: m.regular_polygon((C, C, 520), 8, fill=255), off=(24, 34), blur=26, alpha=120)
    d.regular_polygon((C, C, 520), 8, rotation=22.5, fill=(98, 104, 118, 255), outline=(230, 232, 238, 255))
    d.regular_polygon((C, C, 470), 8, rotation=22.5, fill=(152, 158, 172, 255), outline=(60, 64, 76, 255))
    for k in range(8):   # luces
        a = math.radians(22.5 + k * 45)
        d.ellipse([C + math.cos(a) * 500 - 12, C + math.sin(a) * 500 - 12, C + math.cos(a) * 500 + 12, C + math.sin(a) * 500 + 12], fill=(255, 190, 60, 255))
    if v == 'tanks':
        for (x, y) in ((C - 180, C - 170), (C + 180, C - 170), (C - 180, C + 190), (C + 180, C + 190)):
            ball(img, x, y, 130, (246, 248, 252), (150, 156, 168), rim=(90, 96, 110))
        rrect(img, (C - 70, C - 70, C + 70, C + 70), (236, 170, 40), outline=(120, 84, 20), rad=14)
    elif v == 'refinery':
        for i, x in enumerate((C - 270, C - 90, C + 90)):
            ball(img, x, C - 120, 80, (246, 248, 252), (150, 156, 168))
            tube(img, (x, C - 40), (x, C + 190), 26, (200, 120, 60))
        rrect(img, (C - 330, C + 190, C + 330, C + 340), (236, 234, 230), outline=(120, 126, 140), rad=16)
        ball(img, C + 300, C - 260, 50, (255, 160, 40), (220, 60, 20))
        d.polygon([(C + 300, C - 380), (C + 255, C - 270), (C + 345, C - 270)], fill=(255, 190, 70, 235))
    elif v == 'dish':
        dish(img, C, C - 30, 330)
        rrect(img, (C - 200, C + 330, C + 200, C + 430), (236, 234, 230), outline=(120, 126, 140), rad=16)
    elif v == 'lab':
        dome(img, C - 100, C - 60, 220, (170, 220, 255), inner=(236, 232, 224))
        panel(img, (C + 130, C - 330, C + 440, C - 120), 3, 2)
        panel(img, (C + 130, C + 40, C + 440, C + 250), 3, 2)
        tube(img, (C + 100, C), (C + 190, C), 30)
    elif v == 'pad':
        pad(img, C, C, 380, ship=False)


def k_probe(img, world, v):
    d = ImageDraw.Draw(img, 'RGBA')
    dish(img, C - 60, C - 100, 400, (240, 232, 214))
    shadow(img, lambda m: m.polygon([(C + 80, C + 120), (C + 360, C + 120), (C + 220, C + 400)], fill=255), blur=14)
    d.polygon([(C + 80, C + 120), (C + 360, C + 120), (C + 220, C + 400)], fill=(214, 176, 70, 255), outline=(150, 120, 40, 255))
    d.rectangle([C - 360, C + 330, C - 130, C + 380], fill=(60, 64, 76, 255))
    ball(img, C - 440, C + 355, 38, (220, 224, 230), (120, 126, 140))


KINDS = {'domes': k_domes, 'flagbase': k_flagbase, 'solar': k_solar, 'dish': k_dish, 'pad': k_pad, 'mine': k_mine, 'greenhouse': k_greenhouse,
         'rover': k_rover, 'lab': k_lab, 'crystal': k_crystal, 'balloon': k_balloon, 'platform': k_platform, 'probe': k_probe}


def render(world, name, kind, var, idx):
    img = make_ground(world, 1000 + idx * 17 + len(world) * 31)
    KINDS[kind](img, world, var)
    # bordecito suave para que se note la parcela
    out = img.convert('RGB').resize((768, 768), Image.LANCZOS)
    base = f'{world}-{name}'
    out.save(os.path.join(OUT, base + '.webp'), quality=88, method=6)
    for suf, px in (('m', 512), ('s', 256), ('t', 128)):
        out.resize((px, px), Image.LANCZOS).save(os.path.join(OUT, f'{base}-{suf}.webp'), quality=86, method=6)
    return out


def main():
    # la Luna usa imágenes propias (images/luna-*.webp): no se regeneran salvo que se pida a propósito (python3 tools/make-planet-houses.py luna)
    only = sys.argv[1:] or [w for w in HOUSES if w != 'luna']
    os.makedirs(OUT, exist_ok=True)
    for w in only:
        for i, (name, kind, var) in enumerate(HOUSES[w]):
            render(w, name, kind, var, i)
            print('ok', f'{w}-{name}')


if __name__ == '__main__':
    main()
