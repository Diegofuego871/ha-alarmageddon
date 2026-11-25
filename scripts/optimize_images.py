"""
Bilder der README verkleinern: PNG aus tests/panel/readme-shots.mjs auf eine Palette mit 256 Farben (Bildschirmfotos einer
Oberfläche haben wenige Farben; die Dateien werden so um ein Mehrfaches kleiner, ohne sichtbaren Verlust).

Seit 1.89.0 mit Prüfung: bis 1.88.0 lief jedes Bild durch MEDIANCUT; das legt seltene Farben mit häufigen zusammen, ein kleiner grüner
Punkt (HealthCheck-Dienste, "antwortet") wurde grau. Jetzt rechnet das Skript je Bild mehrere Verfahren, misst je Pixel die grösste
Abweichung eines Farbkanals vom Original und nimmt das Verfahren mit der kleinsten; liegt auch sie über MAX_ERROR, bleibt das Bild ohne
Palette (verlustfrei, nur neu komprimiert). Eine verlorene Farbe fällt so nie mehr unbemerkt durch.

Seit 1.89.1 zählt unter den Verfahren innerhalb MAX_ERROR zuerst die mittlere Abweichung, erst dann die Grösse, und jedes Verfahren rechnet auch
mit einer durch k-means verfeinerten Palette. Die grösste Abweichung allein übersah eine leicht verschobene Farbe auf einer grossen Fläche: das
neutrale Grau der Leisten (239, 240, 240) wurde mit MAXCOVERAGE zu (244, 238, 239), auf jedem Pixel der Fläche, sichtbar rosa. Mit verfeinerter
Palette bleiben die häufigen Farben fast genau (Abweichung 1), die Datei wird kaum grösser.

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
# Durchgänge von k-means, die die Palette verfeinern (0: ohne)
KMEANS = (0, 3)


def errors(original: Image.Image, other: Image.Image) -> tuple[int, float]:
    """Grösste und mittlere Abweichung über alle Pixel (je Pixel der Farbkanal mit der grössten Abweichung)."""
    red, green, blue = ImageChops.difference(original, other.convert("RGB")).split()
    histogram = ImageChops.lighter(ImageChops.lighter(red, green), blue).histogram()
    pixels = sum(histogram)
    worst = max(value for value, count in enumerate(histogram) if count)
    return worst, sum(value * count for value, count in enumerate(histogram)) / pixels


def encoded(image: Image.Image) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()


def optimize(path: pathlib.Path) -> str:
    before = path.stat().st_size
    original = Image.open(path).convert("RGB")
    candidates = []
    for name, method in METHODS.items():
        for rounds in KMEANS:
            quantized = original.quantize(colors=256, method=method, dither=Image.Dither.NONE, kmeans=rounds)
            worst, mean = errors(original, quantized)
            data = encoded(quantized)
            candidates.append((worst, mean, len(data), f"{name}{f' kmeans {rounds}' if rounds else ''}", data))
    fitting = [c for c in candidates if c[0] <= MAX_ERROR]
    if fitting:
        error, mean, _size, name, data = min(fitting, key=lambda c: (round(c[1], 2), c[2]))
    else:
        error, mean, _size, name, _data = min(candidates, key=lambda c: (c[0], c[2]))
        data = encoded(original)
        name = f"verlustfrei (beste Palette {name} wich um {error} ab)"
        error, mean = 0, 0.0
    path.write_bytes(data)
    return f"{path.name}: {before // 1024} kB -> {len(data) // 1024} kB, {name}, Abweichung {error}, im Mittel {mean:.2f}"


def main() -> None:
    names = sys.argv[1:]
    paths = [ROOT / name for name in names] if names else sorted(ROOT.glob("*.png"))
    for path in paths:
        print(optimize(path), flush=True)


if __name__ == "__main__":
    main()
