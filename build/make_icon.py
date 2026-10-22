#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""生成应用图标：1024x1024 PNG（electron-builder 会自动转换为 ico/icns）。"""
from PIL import Image, ImageDraw

SIZE = 1024
img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))

# 背景竖向渐变（深蓝 -> 亮蓝）
pixels = img.load()
for y in range(SIZE):
    t = y / (SIZE - 1)
    r = int(28 + (16 - 28) * t)
    g = int(110 + (70 - 110) * t)
    b = int(230 + (210 - 230) * t)
    for x in range(SIZE):
        pixels[x, y] = (r, g, b, 255)

# 圆角遮罩
mask = Image.new('L', (SIZE, SIZE), 0)
md = ImageDraw.Draw(mask)
md.rounded_rectangle([0, 0, SIZE - 1, SIZE - 1], radius=190, fill=255)
img.putalpha(mask)

d = ImageDraw.Draw(img)

# 白色播放三角
d.polygon([(390, 300), (390, 724), (720, 512)], fill=(255, 255, 255, 240))

# 底部进度条（模拟刷课进度）
d.rounded_rectangle([300, 790, 724, 848], radius=29, fill=(255, 255, 255, 110))
d.rounded_rectangle([300, 790, 560, 848], radius=29, fill=(255, 255, 255, 235))

img.save('build/icon.png')
print('saved build/icon.png', img.size)
