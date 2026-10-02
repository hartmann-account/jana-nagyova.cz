# jana-nagyova.cz

Offizielle Website der Schauspielerin Jana Nagyová, Tschechisch (`/`) und Deutsch (`/de/`).
Statische Seiten mit einem 3D-Filmset (Three.js), ausgeliefert über Cloudflare Workers (Static Assets).

## Aufbau

| Pfad | Inhalt |
|------|--------|
| `content/content.json` | Alle Texte, Filmografie, Kontakt, Fotonachweise (DE + CS) |
| `src/scene.js` | 3D-Filmset: Kulissenwand, Scheinwerfer, Kamera, Regiestuhl; sie selbst als freigestelltes Foto mit Tiefenkarte |
| `scripts/figure.py` | Erzeugt Freistellung und Tiefenkarte der Figur (`public/img/figure/`) |
| `src/ui.js` | Navigation, Filmografie-Filter, Lightbox |
| `src/site.css` | Gestaltung |
| `scripts/build.mjs` | Erzeugt `public/` aus Inhalten, Schriften und Skripten |
| `public/` | Fertige Website (wird committet und so deployt) |

## Arbeiten

```sh
npm install
npm run build    # public/ neu erzeugen
npm run dev      # bauen und lokal unter http://localhost:8787 starten
npm run deploy   # bauen und per Wrangler deployen
```

Nach jeder Änderung an `content/` oder `src/` `npm run build` ausführen und `public/` mit committen.
Ein Push auf `main` löst das Deployment über die Cloudflare-Git-Integration aus.

## Neue Fotos

1. Fotos als `public/img/jana-nagyova-NN-1200.{jpg,webp}` und `-640.{jpg,webp}` ablegen (1200 bzw. 640 px Breite).
2. In `content/content.json` unter `photos` einen Eintrag mit `id`, Pixelmaßen, Fotograf/in, Jahr und Alt-Texten ergänzen.
3. `npm run build`.

## Figur im Filmset neu erzeugen

```sh
python3 -m venv .venv && .venv/bin/pip install "rembg[cpu]" onnxruntime pillow numpy scipy huggingface_hub
.venv/bin/python scripts/figure.py pfad/zum/foto.jpg public/img/figure jana-02
npm run build
```

Am besten eignet sich eine Ganz- oder Dreiviertelfigur vor ruhigem Hintergrund. Für ein anderes Motiv in `src/scene.js` Höhe (`H`) und Position der Figur anpassen.

Die aktuellen Fotos stammen aus dem Profil der Agentur Reset Artists Management. Fotonachweise stehen in der Galerie und im Footer.
