#!/usr/bin/env python3
"""Genera las imágenes de los planetas de Atlas Terrenos (ilustraciones procedurales, sin descargar nada).

    pip install pillow numpy
    python3 tools/make-planets.py

Crea en images/planetas/:
  <mundo>.webp       dibujo redondo con sombra (botones, cartel del viaje y planetas que se cruzan por el camino)
  mapa-<mundo>.jpg   textura cuadrada en Mercator (la que se pone sobre el mapa de cada planeta; mundos.js la carga sola)
Mundos: mercurio venus tierra luna marte jupiter saturno urano neptuno pluton.
La Tierra, la Luna y Marte no necesitan mapa-*.jpg: usan el mapa real (la Luna y Marte, teselas de la NASA vía el servidor).
"""
import os
import sys
import numpy as np
from PIL import Image, ImageFilter

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'images', 'planetas')
W, H = 2048, 1024          # textura equirectangular de trabajo
SPRITE = 384               # tamaño del dibujo redondo
MAP_PX = 2048              # lado del mapa Mercator
rng = np.random.default_rng(20261107)


# ---------- ruido periódico (sin costuras al dar la vuelta) ----------
def fnoise(beta=2.0, shape=(H, W), seed=None):
    r = np.random.default_rng(seed) if seed is not None else rng
    f = np.fft.fft2(r.standard_normal(shape))
    fy = np.fft.fftfreq(shape[0])[:, None]
    fx = np.fft.fftfreq(shape[1])[None, :]
    k = np.sqrt(fx * fx + fy * fy); k[0, 0] = 1
    n = np.real(np.fft.ifft2(f / k ** (beta / 2)))
    n -= n.mean(); n /= (n.std() + 1e-9)
    return n


def norm01(a):
    lo, hi = np.percentile(a, 1), np.percentile(a, 99)
    return np.clip((a - lo) / (hi - lo + 1e-9), 0, 1)


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


LAT = (0.5 - (np.arange(H) + 0.5) / H)[:, None] * np.pi          # +π/2 arriba
LON = ((np.arange(W) + 0.5) / W - 0.5)[None, :] * 2 * np.pi
LATD = np.degrees(LAT) * np.ones((1, W))
LOND = np.degrees(LON) * np.ones((H, 1))


def craters(n, rmin, rmax, depth=1.0, seed=1, power=2.2):
    """Mapa de altura con cráteres (radios en grados). Se envuelve en longitud."""
    r = np.random.default_rng(seed)
    h = np.zeros((H, W))
    for _ in range(n):
        R = rmin + (rmax - rmin) * r.random() ** power
        lat0 = np.degrees(np.arcsin(r.uniform(-0.97, 0.97)))
        lon0 = r.uniform(-180, 180)
        py = int((90 - lat0) / 180 * H)
        px = int((lon0 + 180) / 360 * W)
        ry = int(R / 180 * H * 1.6) + 2
        rx = int(R / 360 * W * 1.6 / max(0.25, np.cos(np.radians(lat0)))) + 2
        rx = min(rx, W // 2 - 1)
        ys = np.arange(py - ry, py + ry + 1)
        xs = np.arange(px - rx, px + rx + 1)
        ysc = np.clip(ys, 0, H - 1)
        xsw = xs % W
        la = np.radians(90 - (ysc + 0.5) / H * 180)[:, None]
        dlon = ((xs + 0.5) / W * 360 - 180 - lon0)[None, :]
        dlon = (dlon + 180) % 360 - 180
        dlat = (90 - (ysc + 0.5) / H * 180 - lat0)[:, None]
        d = np.sqrt((dlon * np.cos(la)) ** 2 + dlat ** 2) / R
        prof = np.where(d < 1, -(1 - d ** 2) * 0.9, 0.0)                    # cuenco
        prof += 0.55 * np.exp(-((d - 1.0) / 0.14) ** 2)                      # borde elevado
        prof += 0.12 * np.exp(-((d - 1.5) / 0.4) ** 2) * (d > 1)            # eyecciones
        h[np.ix_(ysc, xsw)] += prof * depth * min(1.0, 0.35 + R / rmax)
    return h


def shade(height, strength=6.0):
    """Relieve por luz desde arriba a la izquierda."""
    gy, gx = np.gradient(height)
    s = (-gx - gy) * strength
    return np.clip(0.5 + s, 0, 1)


def ramp(t, stops):
    """t en 0..1 → color RGB (0..1) interpolando entre paradas [(pos, '#rrggbb'), ...]."""
    pos = np.array([p for p, _ in stops], float)
    cols = np.array([[int(c[i:i + 2], 16) / 255 for i in (1, 3, 5)] for _, c in stops])
    return np.stack([np.interp(t, pos, cols[:, k]) for k in range(3)], -1)


def hexrgb(c):
    return np.array([int(c[i:i + 2], 16) / 255 for i in (1, 3, 5)])


def blob(lon0, lat0, rlon, rlat, soft=0.25):
    d = np.sqrt(((((LOND - lon0) + 180) % 360 - 180) / rlon) ** 2 + ((LATD - lat0) / rlat) ** 2)
    return 1 - smooth(1 - soft, 1 + soft, d)


# ---------- texturas ----------
def tex_mercurio():
    base = fnoise(2.6, seed=11); fine = fnoise(1.4, seed=12)
    alb = 0.5 + 0.10 * base + 0.05 * fine
    h = craters(520, 0.6, 11, 1.0, seed=3) + 0.15 * base
    col = ramp(np.clip(alb, 0, 1), [(0, '#4f4943'), (0.5, '#8c8479'), (1, '#c9c0b3')])
    return col * (0.55 + 0.9 * shade(h, 7))[..., None]


def tex_luna():
    base = fnoise(2.8, seed=21); fine = fnoise(1.3, seed=22)
    m = fnoise(3.3, seed=23) + 0.35 * fnoise(2.0, seed=24)
    maria = smooth(-0.1, 0.35, m - np.percentile(m, 62))                  # ~38 % de la superficie son mares oscuros
    maria *= smooth(70, 55, np.abs(LATD))
    alb = 0.78 + 0.06 * base + 0.035 * fine - 0.50 * maria
    h = craters(650, 0.5, 12, 1.0, seed=5) * (1 - 0.6 * maria) + 0.1 * base - 0.25 * maria
    col = ramp(np.clip(alb, 0, 1), [(0, '#1f2024'), (0.3, '#4a4b50'), (0.6, '#9a9a9c'), (1, '#e9e8e4')])
    return col * (0.6 + 0.8 * shade(h, 6))[..., None]


def tex_marte():
    b1 = norm01(fnoise(2.6, seed=31)); b2 = norm01(fnoise(1.6, seed=32)); b3 = norm01(fnoise(3.4, seed=33))
    dark = smooth(0.52, 0.72, b3 * 0.7 + b1 * 0.3)
    dark *= smooth(60, 40, np.abs(LATD))
    h = craters(260, 0.8, 9, 0.7, seed=7) + 0.35 * fnoise(2.2, seed=34)
    col = ramp(0.2 + 0.6 * b1 * 0.7 + 0.3 * b2, [(0, '#6f2c14'), (0.5, '#b4562c'), (1, '#e69a63')])
    col = col * (1 - dark[..., None]) + hexrgb('#4d2417') * dark[..., None] * (0.7 + 0.5 * b2[..., None])
    # un cañón largo (tipo Valles Marineris)
    cy = np.exp(-(((LATD + 8 + 3 * np.sin(np.radians(LOND) * 2)) / 2.2) ** 2)) * smooth(-95, -70, LOND) * (1 - smooth(-30, -5, LOND))
    col = col * (1 - 0.5 * cy[..., None])
    col = col * (0.6 + 0.8 * shade(h, 5))[..., None]
    ice = smooth(78 + 3 * fnoise(2, seed=35), 84 + 3 * fnoise(2, seed=36), np.abs(LATD))
    return col * (1 - ice[..., None]) + hexrgb('#f6f1ec') * ice[..., None]


def tex_venus():
    warp = fnoise(3.0, seed=41) * 6; warp2 = fnoise(3.2, seed=42) * 8
    bands = np.sin(np.radians(LATD * 2 + warp * 5 + warp2 * 2) * 3)
    sw = 0.25 * norm01(fnoise(3.2, seed=43)) + 0.75 * norm01(bands)
    return ramp(sw, [(0, '#c48a35'), (0.45, '#e8b75a'), (0.8, '#f6dc96'), (1, '#fff3cc')])


def tex_tierra():
    cont = fnoise(2.9, seed=51) + 0.45 * fnoise(1.8, seed=52)
    land = smooth(-0.04, 0.04, cont - np.percentile(cont, 69))          # ~31 % de tierra, como la real
    elev = norm01(fnoise(2.0, seed=53))
    dry = norm01(fnoise(2.6, seed=54)) + 0.5 * (1 - np.abs(np.sin(np.radians(LATD * 1.0 + 8))) ** 0.5) - 0.25
    depth = smooth(-0.5, 0.6, cont - np.percentile(cont, 69))           # cerca de la costa el agua es más clara
    ocean = ramp(0.25 + 0.5 * (1 - (1 - depth)) * 0.0 + 0.55 * depth, [(0, '#08265c'), (0.5, '#1a5fb4'), (1, '#4fb0ea')])
    green = ramp(elev, [(0, '#2f7d3a'), (0.5, '#5aa349'), (1, '#8a8a52')])
    desert = ramp(elev, [(0, '#c9a45a'), (1, '#9a6d3a')])
    k = smooth(0.5, 0.75, dry)[..., None]
    landc = (green * (1 - k) + desert * k) * (0.8 + 0.4 * shade(elev * 0.3, 8))[..., None]
    col = ocean * (1 - land[..., None]) + landc * land[..., None]
    ice = smooth(72 + 4 * fnoise(2, seed=56), 80 + 4 * fnoise(2, seed=57), np.abs(LATD))
    col = col * (1 - ice[..., None]) + hexrgb('#f4f8fb') * ice[..., None]
    cl = norm01(fnoise(2.5, seed=58)) * 0.7 + norm01(fnoise(1.5, seed=59)) * 0.3
    cl = smooth(0.55, 0.82, cl) * 0.85
    return col * (1 - cl[..., None]) + np.array([1, 1, 1]) * cl[..., None]


def gas(seed, stops, nbands, warp_amp, contrast=1.0, fine=0.05):
    w = fnoise(3.0, seed=seed) * warp_amp
    w2 = fnoise(2.4, seed=seed + 1) * warp_amp * 0.35
    lat = LATD + w + w2
    b = 0.5 + 0.5 * np.sin(np.radians(lat) * nbands * 2.0 + 1.3 * np.sin(np.radians(lat) * 3.1))
    b = b * 0.93 + 0.07 * norm01(fnoise(2.2, seed=seed + 2))
    b = np.clip(0.5 + (b - 0.5) * contrast, 0, 1) + fine * (norm01(fnoise(1.6, seed=seed + 3)) - 0.5)
    return ramp(np.clip(b, 0, 1), stops)


def tex_jupiter():
    col = gas(61, [(0, '#8a5a35'), (0.3, '#b87b4b'), (0.55, '#e4c8a0'), (0.8, '#f2e3c8'), (1, '#c99567')], 5.2, 4, 1.15)
    spot = blob(20, -22, 20, 9, 0.35)
    ring = blob(20, -22, 27, 13, 0.5) - spot
    col = col * (1 - 0.35 * np.clip(ring, 0, 1)[..., None])
    return col * (1 - spot[..., None]) + hexrgb('#b8462b') * spot[..., None] * (0.85 + 0.2 * norm01(fnoise(1.5, seed=66))[..., None])


def tex_saturno():
    return gas(71, [(0, '#a98748'), (0.4, '#cfae6c'), (0.75, '#ecd9a0'), (1, '#f6ecc9')], 4.0, 4, 0.9, 0.08)


def tex_urano():
    return gas(81, [(0, '#6fc0c8'), (0.5, '#9fe0e4'), (1, '#d3f6f6')], 2.4, 2.5, 0.6, 0.04)


def tex_neptuno():
    col = gas(91, [(0, '#142c9a'), (0.5, '#2f56e0'), (1, '#8db0ff')], 3.2, 3, 1.0, 0.05)
    spot = blob(-60, -22, 16, 8, 0.4)
    col = col * (1 - spot[..., None]) + hexrgb('#0a1355') * spot[..., None]
    for lat0, lon0 in [(-45, 20), (35, -140), (-10, 110)]:   # nubes altas blancas
        c = blob(lon0, lat0, 14, 2.2, 0.5)
        col = col * (1 - 0.7 * c[..., None]) + np.array([1, 1, 1]) * 0.7 * c[..., None]
    return col


def tex_pluton():
    b = norm01(fnoise(2.6, seed=101)); f = norm01(fnoise(1.4, seed=102))
    col = ramp(0.25 + 0.5 * b + 0.15 * f, [(0, '#4a3226'), (0.45, '#9a7a62'), (1, '#d9bfa6')])
    dark = blob(95, -12, 40, 13, 0.5) * (0.6 + 0.4 * norm01(fnoise(1.8, seed=103)))
    col = col * (1 - 0.65 * dark[..., None]) + hexrgb('#2f1f18') * 0.65 * dark[..., None]
    # el «corazón» (Tombaugh Regio + Sputnik Planitia)
    heart = np.maximum(blob(150, 25, 18, 14, 0.35), blob(168, 12, 14, 17, 0.35))
    heart = np.maximum(heart, blob(158, 4, 14, 14, 0.4))
    heart = np.clip(heart * (0.9 + 0.2 * norm01(fnoise(1.6, seed=104))), 0, 1)
    col = col * (1 - heart[..., None]) + hexrgb('#f8efe2') * heart[..., None]
    h = craters(120, 0.8, 7, 0.4, seed=9)
    return col * (0.75 + 0.5 * shade(h, 5))[..., None]


MAPS = {'mercurio', 'venus', 'jupiter', 'saturno', 'urano', 'neptuno', 'pluton'}   # los que no tienen teselas reales
TEX = {'mercurio': tex_mercurio, 'venus': tex_venus, 'tierra': tex_tierra, 'luna': tex_luna, 'marte': tex_marte,
       'jupiter': tex_jupiter, 'saturno': tex_saturno, 'urano': tex_urano, 'neptuno': tex_neptuno, 'pluton': tex_pluton}
# (longitud central, inclinación del eje en grados, brillo de atmósfera, color de atmósfera, lado visible)
LOOK = {
    'mercurio': (40, 0, 0.0, None), 'venus': (0, 0, 0.35, '#ffd98a'), 'tierra': (10, 18, 0.55, '#7fc4ff'),
    'luna': (0, 0, 0.0, None), 'marte': (60, 12, 0.22, '#ffb27a'), 'jupiter': (20, 3, 0.15, '#f0d2a8'),
    'saturno': (0, 0, 0.12, '#f3e8c4'), 'urano': (0, 0, 0.3, '#bff3f4'), 'neptuno': (-40, 8, 0.35, '#7aa6ff'),
    'pluton': (160, 0, 0.12, '#cdbcd8'),
}


def bilinear(img, lat, lon):
    """img (H,W,3) equirectangular; lat/lon en radianes (matrices)."""
    ys = (0.5 - lat / np.pi) * H - 0.5
    xs = ((lon / (2 * np.pi)) % 1.0) * W - 0.5
    y0 = np.clip(np.floor(ys).astype(int), 0, H - 2); fy = np.clip(ys - y0, 0, 1)[..., None]
    x0 = np.floor(xs).astype(int); fx = (xs - x0)[..., None]
    x0 %= W; x1 = (x0 + 1) % W
    a = img[y0, x0] * (1 - fx) + img[y0, x1] * fx
    b = img[y0 + 1, x0] * (1 - fx) + img[y0 + 1, x1] * fx
    return a * (1 - fy) + b * fy


def sphere_sprite(name, tex):
    lon0, tilt, atm, atm_col = LOOK[name]
    S = SPRITE * 2                                          # se dibuja al doble y se reduce (bordes suaves)
    ring = name == 'saturno'
    R = 0.62 if ring else 0.92                              # Saturno deja sitio a los anillos
    u = (np.arange(S) + 0.5) / S * 2 - 1
    X, Y = np.meshgrid(u / R, -u / R)
    r2 = X * X + Y * Y
    inside = r2 <= 1
    Z = np.sqrt(np.clip(1 - r2, 0, 1))
    t = np.radians(tilt)                                    # inclinación del eje (giro en el plano de la imagen)
    Xr = X * np.cos(t) + Y * np.sin(t); Yr = -X * np.sin(t) + Y * np.cos(t)
    lat = np.arcsin(np.clip(Yr, -1, 1)); lon = np.arctan2(Xr, Z) + np.radians(lon0)
    rgb = bilinear(tex, lat, lon)
    L = np.array([-0.55, 0.6, 0.58]); L /= np.linalg.norm(L)
    lam = np.clip(X * L[0] + Y * L[1] + Z * L[2], 0, 1)
    light = 0.16 + 0.95 * lam ** 0.85
    rgb = rgb * light[..., None]
    if atm > 0:                                              # brillo de la atmósfera en el borde
        rim = (1 - Z) ** 3
        rgb = rgb + hexrgb(atm_col) * (atm * rim * (0.35 + 0.9 * lam))[..., None]
    out = np.zeros((S, S, 4))
    out[..., :3] = np.clip(rgb, 0, 1)
    out[..., 3] = inside.astype(float)
    if atm > 0:                                              # halo exterior suave
        d = np.sqrt(r2)
        halo = np.clip(1 - (d - 1) / 0.06, 0, 1) * (d > 1) * atm * 0.5
        out[..., :3] = np.where((d > 1)[..., None], hexrgb(atm_col), out[..., :3])
        out[..., 3] = np.maximum(out[..., 3], halo)
    img = Image.fromarray((out * 255).astype(np.uint8), 'RGBA')
    if ring:
        img = add_rings(img, S, R)
    return img.resize((SPRITE, SPRITE), Image.LANCZOS)


def add_rings(planet, S, R):
    """Anillos de Saturno: una parte pasa por detrás del planeta y otra por delante."""
    yy, xx = np.mgrid[0:S, 0:S]
    cx = cy = S / 2
    ang = np.radians(-18)
    dx = (xx - cx) / (S / 2); dy = (yy - cy) / (S / 2)
    rx = dx * np.cos(ang) - dy * np.sin(ang)
    ry = dx * np.sin(ang) + dy * np.cos(ang)
    q = np.sqrt(rx ** 2 + (ry / 0.30) ** 2)                 # elipse (anillo visto algo de canto)
    rr = q / 0.97                                            # 0.97 → los anillos llegan casi al borde
    prof = np.zeros_like(rr)
    prof += ((rr > 0.62) & (rr < 0.70)) * 0.55
    prof += ((rr > 0.72) & (rr < 0.88)) * 1.0
    prof += ((rr > 0.90) & (rr < 0.96)) * 0.7
    grain = 0.88 + 0.12 * np.sin(rr * 160)
    shade_c = ramp(np.clip((rr - 0.6) / 0.4, 0, 1), [(0, '#a98d5a'), (0.5, '#e3cd96'), (1, '#c7ad74')])
    a = np.clip(prof * 0.92, 0, 1)
    ringimg = np.zeros((S, S, 4))
    ringimg[..., :3] = shade_c * grain[..., None]
    ringimg[..., 3] = a
    front = (ry > 0)[..., None]                              # mitad delantera (abajo del eje)
    back = Image.fromarray((np.where(front, 0, ringimg) * 255).astype(np.uint8), 'RGBA')
    frontimg = Image.fromarray((np.where(front, ringimg, 0) * 255).astype(np.uint8), 'RGBA')
    # sombra del planeta sobre los anillos de atrás: ya la tapa el planeta al ir encima
    base = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    base.alpha_composite(back)
    base.alpha_composite(planet)
    base.alpha_composite(frontimg)
    return base


def mercator_map(tex):
    """Equirectangular (W×H) → cuadrado Mercator (±85.051°) para la capa de imagen de MapLibre."""
    n = MAP_PX
    ys = (np.arange(n) + 0.5) / n
    lat = np.arctan(np.sinh(np.pi * (1 - 2 * ys)))           # radianes
    lon = ((np.arange(n) + 0.5) / n - 0.5) * 2 * np.pi
    LA, LO = np.meshgrid(lat, lon, indexing='ij')
    return bilinear(tex, LA, LO)


def main():
    os.makedirs(OUT, exist_ok=True)
    names = sys.argv[1:] or list(TEX)
    for n in names:
        print('·', n, flush=True)
        tex = np.clip(TEX[n](), 0, 1)
        sphere_sprite(n, tex).save(os.path.join(OUT, n + '.webp'), quality=88, method=6)
        if n in MAPS:
            m = (mercator_map(tex) * 255).astype(np.uint8)
            Image.fromarray(m, 'RGB').save(os.path.join(OUT, 'mapa-' + n + '.jpg'), quality=80, optimize=True, progressive=True)
    print('Listo →', os.path.abspath(OUT))


if __name__ == '__main__':
    main()
