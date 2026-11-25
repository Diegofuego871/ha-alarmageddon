"""
Bilder der README verkleinern: PNG aus tests/panel/readme-shots.mjs auf eine Palette mit 256 Farben (Bildschirmfotos einer
Oberfläche haben wenige Farben; die Dateien werden so um ein Mehrfaches kleiner, ohne sichtbaren Verlust).

Seit 1.89.0 mit Prüfung: bis 1.88.0 lief jedes Bild durch MEDIANCUT; das legt seltene Farben mit häufigen zusammen, ein kleiner grüner
Punkt (HealthCheck-Dienste, "antwortet") wurde grau. Jetzt rechnet das Skript je Bild mehrere Verfahren, misst je Pixel die grösste
Abweichung eines Farbkanals vom Original und nimmt das Verfahren mit der kleinsten; liegt auch sie über MAX_ERROR, bleibt das Bild ohne
Palette (verlustfrei, nur neu komprimiert). Eine verlorene Farbe fällt so nie mehr unbemerkt durch.

Aufruf im Wurzelverzeichnis: `python scripts/optimize_images.py` (braucht Pillow). Mit Dateinamen nur diese Bilder
(`python scripts/optimize_images.py codes-de.png codes-en.png`).
"""

from __future__ import annotations

import io
import pathlib
import sys

from PIL import Image, ImageChops

ROOT = pathlib.Path(__file__).resolve().parents[1] / "docs" / "img"
# Grösste erlaubte Abweichung eines Farbkanals (0 bis 255); darunter ist kein Unterschied zu sehen
MAX_ERROR = 16
METHODS = {"maxcoverage": Image.Quantize.MAXCOVERAGE, "fastoctree": Image.Quantize.FASTOCTREE, "mediancut": Image.Quantize.MEDIANCUT}


def max_error(original: Image.Image, other: Image.Image) -> int:
    """Grösste Abweichung eines Farbkanals über alle Pixel."""
    red, green, blue = ImageChops.difference(original, other.convert("RGB")).split()
    return max(ImageChops.lighter(ImageChops.lighter(red, green), blue).getextrema())


def encoded(image: Image.Image) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()


def optimize(path: pathlib.Path) -> str:
    before = path.stat().st_size
    original = Image.open(path).convert("RGB")
    candidates = []
    for name, method in METHODS.items():
        quantized = original.quantize(colors=256, method=method, dither=Image.Dither.NONE)
        data = encoded(quantized)
        candidates.append((max_error(original, quantized), len(data), name, data))
    error, size, name, data = min(candidates)
    if error > MAX_ERROR:
        data = encoded(original)
        name = f"verlustfrei (beste Palette {name} wich um {error} ab)"
        error = 0
    path.write_bytes(data)
    return f"{path.name}: {before // 1024} kB -> {len(data) // 1024} kB, {name}, Abweichung {error}"


def main() -> None:
    names = sys.argv[1:]
    paths = [ROOT / name for name in names] if names else sorted(ROOT.glob("*.png"))
    for path in paths:
        print(optimize(path), flush=True)


if __name__ == "__main__":
    main()
