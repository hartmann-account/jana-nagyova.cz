# jana-nagyova.cz

Offizielle Website der Schauspielerin Jana Nagyová, Tschechisch (`/`) und Deutsch (`/de/`).
Statische Seiten, ausgeliefert über Cloudflare Workers (Static Assets). Der Einstieg ist ein
tschechisches Papiertheater in 3D (Three.js): bedrucktes Proszenium mit ihrem Namen, Kulissen in
echter Tiefe und sie selbst als Pappfigur. Ein Klick auf die Figur oder auf die Szenen unter der
Bühne startet einen Bühnenumbau.

## Aufbau

| Pfad | Inhalt |
|------|--------|
| `content/content.json` | Alle Texte, Filmografie, Szenen des Papiertheaters, Kontakt, Fotos (DE + CS) |
| `src/scene.js` | 3D-Bühne: Proszenium, Vorhang, Kulissen, Prospekt, Pappfigur, Licht, Bühnenumbau |
| `src/stage-art.js` | Prozedural gemalte Bühnenbögen im Druckstil (Proszenium, Vorhang, drei Szenen) |
| `src/ui.js` | Navigation, Szenenwahl, Filmografie-Filter und Zeitleiste, Lightbox |
| `src/site.css` | Gestaltung |
| `scripts/build.mjs` | Erzeugt `public/`: Seiten, Schriften (auf benutzte Zeichen reduziert), Skripte |
| `scripts/figure.py` | Erzeugt aus einem Foto die Pappfigur (Freisteller + Umriss mit Kartonkante) |
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
2. In `content/content.json` unter `photos` einen Eintrag mit `id`, Pixelmaßen, Fotograf/in, Jahr,
   Bildunterschrift (`caption`) und Alt-Texten ergänzen.
3. `npm run build`.

## Neue Figur für das Papiertheater

```sh
python3 -m venv .venv && .venv/bin/pip install "rembg[cpu]" onnxruntime pillow numpy scipy scikit-image
.venv/bin/python scripts/figure.py pfad/zum/foto.jpg public/img/figure jana-04
npm run build
```

Am besten eignet sich eine Ganz- oder Dreiviertelfigur vor ruhigem Hintergrund. Die Unterkante darf
abgeschnitten sein, sie verschwindet hinter der Rampe. Danach in `content/content.json` unter
`portraits` einen Eintrag mit `photo`, `scene` (`rink`, `forest` oder `hall`) und den Beschriftungen ergänzen.

Die aktuellen Fotos stammen aus dem Profil der Agentur Reset Artists Management. Für die Freistellung
im Papiertheater sollten die Fotografinnen und Fotografen bzw. die Agentur zustimmen. Fotonachweise
stehen unter jedem Foto, im Hero und im Abspann.
