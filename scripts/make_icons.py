from PIL import Image, ImageDraw
import os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICON_DIR = os.path.join(BASE, "public", "icons")
os.makedirs(ICON_DIR, exist_ok=True)

BG = (255, 179, 71)      # naranja calido
STAR = (255, 255, 255)
ACCENT = (58, 143, 255)  # azul


def rounded_square(size, radius_ratio=0.22):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    radius = int(size * radius_ratio)
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=BG)

    cx, cy = size / 2, size / 2
    r_outer = size * 0.30
    r_inner = size * 0.13
    import math
    points = []
    for i in range(10):
        angle = -math.pi / 2 + i * math.pi / 5
        r = r_outer if i % 2 == 0 else r_inner
        points.append((cx + r * math.cos(angle), cy + r * math.sin(angle)))
    draw.polygon(points, fill=STAR)

    dot_r = size * 0.06
    draw.ellipse([cx - dot_r, cy - dot_r, cx + dot_r, cy + dot_r], fill=ACCENT)
    return img


for size in (192, 512):
    img = rounded_square(size)
    img.save(os.path.join(ICON_DIR, f"icon-{size}.png"))

print("iconos generados")
