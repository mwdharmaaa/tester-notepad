import os
from PIL import Image, ImageDraw

def create_icon(size):
    # Create image with RGBA
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Outer padding
    pad = max(1, int(size * 0.06))
    r = max(2, int(size * 0.22))
    
    # Gradient background / rounded box
    # Primary slate/indigo background
    draw.rounded_rectangle(
        [pad, pad, size - pad, size - pad],
        radius=r,
        fill=(30, 41, 59, 255), # slate-800
        outline=(99, 102, 241, 255), # indigo-500
        width=max(1, int(size * 0.05))
    )
    
    # Notepad page inside
    page_left = int(size * 0.22)
    page_top = int(size * 0.18)
    page_right = int(size * 0.78)
    page_bottom = int(size * 0.82)
    page_r = max(1, int(size * 0.08))
    
    draw.rounded_rectangle(
        [page_left, page_top, page_right, page_bottom],
        radius=page_r,
        fill=(248, 250, 252, 255), # slate-50
        outline=(203, 213, 225, 255),
        width=max(1, int(size * 0.03))
    )
    
    # Note lines
    line_x1 = int(size * 0.32)
    line_x2 = int(size * 0.68)
    line_h = max(1, int(size * 0.05))
    
    # Line 1 (Indigo header line)
    draw.rounded_rectangle(
        [line_x1, int(size * 0.30), int(size * 0.55), int(size * 0.30) + line_h],
        radius=max(1, int(line_h / 2)),
        fill=(99, 102, 241, 255) # Indigo
    )
    
    # Line 2 (Email line)
    draw.rounded_rectangle(
        [line_x1, int(size * 0.42), line_x2, int(size * 0.42) + line_h],
        radius=max(1, int(line_h / 2)),
        fill=(148, 163, 184, 255) # Slate-400
    )
    
    # Line 3 (Password dots/line)
    dots_y = int(size * 0.54)
    dot_r = max(1, int(size * 0.03))
    for i in range(4):
        cx = line_x1 + i * int(size * 0.09) + dot_r
        draw.ellipse([cx - dot_r, dots_y - dot_r, cx + dot_r, dots_y + dot_r], fill=(16, 185, 129, 255)) # Emerald dots
    
    # Line 4 (Notes line)
    draw.rounded_rectangle(
        [line_x1, int(size * 0.66), int(size * 0.60), int(size * 0.66) + line_h],
        radius=max(1, int(line_h / 2)),
        fill=(203, 213, 225, 255)
    )
    
    # Small key/badge indicator in bottom-right corner
    badge_r = max(2, int(size * 0.16))
    bx = size - pad - badge_r
    by = size - pad - badge_r
    draw.ellipse(
        [bx - badge_r, by - badge_r, bx + badge_r, by + badge_r],
        fill=(16, 185, 129, 255), # Emerald-500
        outline=(15, 23, 42, 255), # Slate-900 border
        width=max(1, int(size * 0.03))
    )
    
    return img

def main():
    icons_dir = os.path.join(os.path.dirname(__file__), "icons")
    os.makedirs(icons_dir, exist_ok=True)
    for s in [16, 32, 48, 128]:
        img = create_icon(s)
        path = os.path.join(icons_dir, f"icon{s}.png")
        img.save(path, "PNG")
        print(f"Generated {path} ({s}x{s})")

if __name__ == "__main__":
    main()
