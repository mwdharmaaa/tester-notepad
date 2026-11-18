import os
from PIL import Image, ImageDraw

def create_icon(size):
    # Strictly monochrome icon: Black, White, Grays
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    pad = max(1, int(size * 0.06))
    r = max(2, int(size * 0.22))
    
    # Outer dark charcoal / black background with crisp gray border
    draw.rounded_rectangle(
        [pad, pad, size - pad, size - pad],
        radius=r,
        fill=(18, 18, 20, 255),       # #121214
        outline=(82, 82, 91, 255),    # #52525b border
        width=max(1, int(size * 0.05))
    )
    
    # Notepad sheet inside (white / light gray)
    page_left = int(size * 0.22)
    page_top = int(size * 0.18)
    page_right = int(size * 0.78)
    page_bottom = int(size * 0.82)
    page_r = max(1, int(size * 0.08))
    
    draw.rounded_rectangle(
        [page_left, page_top, page_right, page_bottom],
        radius=page_r,
        fill=(244, 244, 245, 255),    # #f4f4f5 pure light
        outline=(212, 212, 216, 255),  # #d4d4d8
        width=max(1, int(size * 0.03))
    )
    
    # Note lines (monochrome grays & black)
    line_x1 = int(size * 0.32)
    line_x2 = int(size * 0.68)
    line_h = max(1, int(size * 0.05))
    
    # Line 1 (Dark gray header line)
    draw.rounded_rectangle(
        [line_x1, int(size * 0.30), int(size * 0.58), int(size * 0.30) + line_h],
        radius=max(1, int(line_h / 2)),
        fill=(24, 24, 27, 255)         # #18181b
    )
    
    # Line 2 (Mid gray line)
    draw.rounded_rectangle(
        [line_x1, int(size * 0.42), line_x2, int(size * 0.42) + line_h],
        radius=max(1, int(line_h / 2)),
        fill=(113, 113, 122, 255)      # #71717a
    )
    
    # Line 3 (Password dots in dark gray)
    dots_y = int(size * 0.54)
    dot_r = max(1, int(size * 0.03))
    for i in range(4):
        cx = line_x1 + i * int(size * 0.09) + dot_r
        draw.ellipse([cx - dot_r, dots_y - dot_r, cx + dot_r, dots_y + dot_r], fill=(39, 39, 42, 255))
    
    # Line 4 (Light gray line)
    draw.rounded_rectangle(
        [line_x1, int(size * 0.66), int(size * 0.62), int(size * 0.66) + line_h],
        radius=max(1, int(line_h / 2)),
        fill=(161, 161, 170, 255)      # #a1a1aa
    )
    
    # Minimalist monochrome badge indicator in bottom-right corner
    badge_r = max(2, int(size * 0.16))
    bx = size - pad - badge_r
    by = size - pad - badge_r
    draw.ellipse(
        [bx - badge_r, by - badge_r, bx + badge_r, by + badge_r],
        fill=(255, 255, 255, 255),    # White
        outline=(18, 18, 20, 255),     # Black border
        width=max(1, int(size * 0.03))
    )
    # Inner dot in the badge
    inner_r = max(1, int(badge_r * 0.45))
    draw.ellipse(
        [bx - inner_r, by - inner_r, bx + inner_r, by + inner_r],
        fill=(18, 18, 20, 255)
    )
    
    return img

def main():
    icons_dir = os.path.join(os.path.dirname(__file__), "icons")
    os.makedirs(icons_dir, exist_ok=True)
    for s in [16, 32, 48, 128]:
        img = create_icon(s)
        path = os.path.join(icons_dir, f"icon{s}.png")
        img.save(path, "PNG")
        print(f"Generated {path} ({s}x{s}) - Monochrome")

if __name__ == "__main__":
    main()
