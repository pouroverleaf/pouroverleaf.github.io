"""Generate a site-percolation logo for pouroverleaf.

A disc-shaped square grid of cells. Each cell is filled at random:
  - cells inside the letters of TEXT (set along the top arc) with probability --p-text (0.710),
  - all other cells with probability --p (0.318).
The square-lattice percolation threshold is ~0.593, so letter cells join into large clusters
while background cells stay in small ones. Clusters of at least --min-cluster cells are drawn
in the accent colour; smaller ones in a muted shade. The word appears from cluster structure.

Usage: python3 tools/percolation_logo.py [--palette mocha-mauve] [--seed 7] [--out static/img/logo]
"""
import argparse
import math

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage

# Catppuccin (https://catppuccin.com/palette): Mocha is dark, Latte is light.
# (background, big clusters, small clusters, ring)
PALETTES = {
    "mocha-mauve": ("#1e1e2e", "#cba6f7", "#45475a", "#f5e0dc"),
    "mocha-green": ("#1e1e2e", "#a6e3a1", "#45475a", "#f5e0dc"),
    "mocha-peach": ("#1e1e2e", "#fab387", "#45475a", "#f5e0dc"),
    "latte-mauve": ("#eff1f5", "#8839ef", "#bcc0cc", "#4c4f69"),
    "latte-green": ("#eff1f5", "#40a02b", "#bcc0cc", "#4c4f69"),
}
FONT = "/System/Library/Fonts/Supplemental/Arial Black.ttf"


def text_mask(n, text, font_path, radius, size, spacing, ss=8):
    """Rasterise TEXT along the top arc of an n x n grid. Returns a boolean n x n mask."""
    W = n * ss
    img = Image.new("L", (W, W), 0)
    font = ImageFont.truetype(font_path, int(size * W))
    c, R = W / 2, radius * W
    widths = [font.getlength(ch) for ch in text]
    gap = spacing * size * W
    total = sum(widths) + gap * (len(text) - 1)
    theta = -math.pi / 2 - (total / R) / 2  # start angle so the word is centred at 12 o'clock
    for ch, w in zip(text, widths):
        mid = theta + (w / 2) / R
        glyph = Image.new("L", (int(w * 2) + 4, int(size * W * 2)), 0)
        ImageDraw.Draw(glyph).text((glyph.width / 2, glyph.height / 2), ch, font=font, fill=255, anchor="ms")
        glyph = glyph.rotate(-math.degrees(mid + math.pi / 2), resample=Image.BICUBIC, expand=True)
        x, y = c + R * math.cos(mid), c + R * math.sin(mid)
        img.paste(255, (int(x - glyph.width / 2), int(y - glyph.height / 2)), glyph)
        theta += (w + gap) / R
    small = np.asarray(img.resize((n, n), Image.BOX), dtype=float) / 255
    return small > 0.5


def lattice(n, p, p_text, mask, seed, min_cluster):
    rng = np.random.default_rng(seed)
    y, x = np.mgrid[:n, :n] + 0.5
    disc = (x - n / 2) ** 2 + (y - n / 2) ** 2 <= (n / 2) ** 2
    filled = (rng.random((n, n)) < np.where(mask, p_text, p)) & disc
    labels, k = ndimage.label(filled)
    sizes = np.bincount(labels.ravel())
    sizes[0] = 0
    big = sizes[labels] >= min_cluster
    return disc, filled, big & filled


def svg(disc, filled, big, palette, cell=10, gap=1.0):
    BG, HI, LO, RING = PALETTES[palette]
    n = disc.shape[0]
    pad = cell * 1.5
    size = n * cell + 2 * pad
    c = size / 2
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" width="{size}" height="{size}">',
           f'<circle cx="{c}" cy="{c}" r="{c}" fill="{BG}"/>',
           f'<circle cx="{c}" cy="{c}" r="{c - pad/2}" fill="none" stroke="{RING}" stroke-width="{cell*0.3}"/>',
           f'<g transform="translate({pad},{pad})">']
    s = cell - gap
    for i in range(n):
        for j in range(n):
            if filled[i, j]:
                x, y = j * cell + gap / 2, i * cell + gap / 2
                out.append(f'<rect x="{x}" y="{y}" width="{s}" height="{s}" fill="{HI if big[i, j] else LO}"/>')
    out.append("</g></svg>")
    return "\n".join(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--p", type=float, default=0.318, help="fill probability outside the letters")
    ap.add_argument("--p-text", type=float, default=0.710, help="fill probability inside the letters")
    ap.add_argument("--n", type=int, default=300, help="grid cells across the disc")
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--palette", choices=PALETTES, default="mocha-mauve")
    ap.add_argument("--text", default="pouroverleaf")
    ap.add_argument("--font", default=FONT)
    ap.add_argument("--text-radius", type=float, default=0.33, help="baseline radius, fraction of grid width")
    ap.add_argument("--text-size", type=float, default=0.155, help="font size, fraction of grid width")
    ap.add_argument("--spacing", type=float, default=0.05, help="extra letter gap, fraction of font size")
    ap.add_argument("--min-cluster", type=int, default=60, help="clusters this big or larger get the accent colour")
    ap.add_argument("--out", default="static/img/logo")
    a = ap.parse_args()

    mask = text_mask(a.n, a.text, a.font, a.text_radius, a.text_size, a.spacing)
    disc, filled, big = lattice(a.n, a.p, a.p_text, mask, a.seed, a.min_cluster)
    with open(a.out + ".svg", "w") as f:
        f.write(svg(disc, filled, big, a.palette))
    print(f"p={a.p} p_text={a.p_text} seed={a.seed} text_cells={mask.sum()} "
          f"accent_cells={big.sum()} -> {a.out}.svg")


if __name__ == "__main__":
    main()
