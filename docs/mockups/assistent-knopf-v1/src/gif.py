# Setzt die Einzelbilder aus shots.mjs zu GIFs zusammen: 0,8 s Ruhe, die Bewegung (40 ms je Bild), 1,2 s Ruhe, endlos wiederholt (im Panel läuft
# sie nur einmal, 5 Sekunden nach dem Laden).
import glob
import os
from PIL import Image

src = "/tmp/assistent-knopf-frames/"
out = os.path.join(os.path.dirname(__file__), "..")
for tag in ("desktop", "handy"):
    for v in ("a", "b", "c"):
        files = sorted(glob.glob(f"{src}{tag}-{v}-*.png"))
        frames = [Image.open(f).convert("RGB") for f in files]
        if not frames:
            continue
        seq = [frames[0]] + frames + [frames[-1]]
        dur = [800] + [40] * len(frames) + [1200]
        pal = [f.quantize(colors=128, method=Image.Quantize.MEDIANCUT) for f in seq]
        pal[0].save(os.path.join(out, f"{v}-{tag}.gif"), save_all=True, append_images=pal[1:], duration=dur, loop=0, disposal=2, optimize=True)
        print(v, tag, len(seq))
