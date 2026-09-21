#!/usr/bin/env python3
"""Render /api/summary onto a Waveshare e-paper (or any PIL target). No browser needed.

  pip install pillow requests
  python3 scripts/epaper.py http://<host>:4242 dave            # writes summary.png
  python3 scripts/epaper.py http://<host>:4242 dave epd7in5_V2 # pushes to the panel (waveshare lib on sys.path)

Cron it every 10-15 min; e-paper hates fast refresh. Layout is 800x480, scale W/H for your panel.
"""
import sys, requests
from PIL import Image, ImageDraw, ImageFont

HOST, USER = sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "dave"
PANEL = sys.argv[3] if len(sys.argv) > 3 else None
W, H = 800, 480

s = requests.get(f"{HOST}/api/summary?u={USER}", timeout=30).json()
img = Image.new("1", (W, H), 255)
d = ImageDraw.Draw(img)
try:
    big = ImageFont.truetype("DejaVuSans-Bold.ttf", 34); mid = ImageFont.truetype("DejaVuSans-Bold.ttf", 20); small = ImageFont.truetype("DejaVuSans.ttf", 16)
except OSError:
    big = mid = small = ImageFont.load_default()

d.text((16, 10), s["greeting"], font=big, fill=0)
d.text((16, 52), s["date"], font=small, fill=0)
y = 84
# stats: two columns of "label value"
col = 0
for w in s["widgets"]:
    for st in w.get("stats", [])[:2]:
        x = 16 + col * 390
        d.text((x, y), f"{w['title']}: {st['label']}", font=small, fill=0)
        d.text((x, y + 18), str(st["value"]), font=mid, fill=0)
        col += 1
        if col == 2: col = 0; y += 48
        if y > 300: break
y = max(y + 56, 320)
d.line((16, y - 8, W - 16, y - 8), fill=0)
for line in s["attention"][:4]:
    d.text((16, y), "! " + line[:70], font=small, fill=0); y += 20
for line in s["headlines"][:3]:
    d.text((16, y), "- " + line[:70], font=small, fill=0); y += 20

if PANEL:
    import importlib
    epd = importlib.import_module(f"waveshare_epd.{PANEL}").EPD()
    epd.init(); epd.display(epd.getbuffer(img.resize((epd.width, epd.height)))); epd.sleep()
else:
    img.save("summary.png"); print("wrote summary.png")
