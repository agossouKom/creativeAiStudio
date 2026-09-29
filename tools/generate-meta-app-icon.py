#!/usr/bin/env python3
"""Génère l'icône 1024x1024 de l'app Meta (app icon) depuis le favicon du projet.

Décalque de frontend/src/favicon.svg : carré plein (l'icône Meta ne doit ni
avoir de coins arrondis ni de transparence, Meta applique son propre masque),
dégradé indigo -> ciel, « M » blanc, pastille ambre avec éclair.
"""
from PIL import Image, ImageDraw

OUT = "frontend/src/assets/app-icon-1024.png"
SIZE = 1024
SS = 4                      # supersampling : rendu 4096 puis réduction LANCZOS
S = SIZE * SS
U = S / 36.0                # une unité du viewBox SVG = U pixels


def unit(v):
    return v * U


def round_line(draw, points, width, fill):
    """PIL ne dessine ni les jointures ni les extrémités arrondies : on les ajoute."""
    px = [(unit(x), unit(y)) for x, y in points]
    w = width * U
    draw.line(px, fill=fill, width=int(round(w)), joint="curve")
    r = w / 2.0
    for x, y in px:
        draw.ellipse([x - r, y - r, x + r, y + r], fill=fill)


def main():
    # Dégradé diagonal #6366f1 -> #0ea5e9 : les 4 coins d'une image 2x2
    # redimensionnée en bicubique reproduisent exactement l'interpolation
    # linéaire du <linearGradient> du SVG, en une seule opération.
    corners = Image.new("RGB", (2, 2))
    corners.putpixel((0, 0), (0x63, 0x66, 0xF1))
    corners.putpixel((1, 0), (0x0E, 0xA5, 0xE9))
    corners.putpixel((0, 1), (0x0E, 0xA5, 0xE9))
    corners.putpixel((1, 1), (0x0E, 0xA5, 0xE9))
    grad = corners.resize((S, S), Image.BICUBIC)

    img = grad.convert("RGBA")
    draw = ImageDraw.Draw(img)

    # « M » : M6 26 V12 L12.5 21 L18 12 L23.5 21 L30 12 V26
    round_line(draw, [(6, 26), (6, 12), (12.5, 21), (18, 12), (23.5, 21), (30, 12), (30, 26)],
               2.6, (255, 255, 255, 255))

    # Pastille ambre + éclair blanc
    cx, cy, r = unit(29), unit(7), unit(5.5)
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(0xF5, 0x9E, 0x0B, 255))
    round_line(draw, [(30, 4.5), (28, 7.5), (30, 7.5), (28, 10)], 1.5, (255, 255, 255, 255))

    img = img.resize((SIZE, SIZE), Image.LANCZOS).convert("RGB")
    img.save(OUT, "PNG", optimize=True)
    print(f"{OUT} — {img.size[0]}x{img.size[1]} {img.mode}")


if __name__ == "__main__":
    main()
