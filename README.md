# jana-nagyova.cz

Offizielle Website der Schauspielerin Jana Nagyová, Tschechisch (`/`) und Deutsch (`/de/`).
Statische Seiten mit einer 3D-Bühne (Three.js), ausgeliefert über Cloudflare Workers (Static Assets).

## Aufbau

| Pfad | Inhalt |
|------|--------|
| `content/content.json` | Alle Texte, Filmografie, Kontakt, Fotonachweise (DE + CS) |
| `src/scene.js` | 3D-Szene: Fototafeln auf einem drehenden Ring |
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

Die aktuellen Fotos stammen aus dem Profil der Agentur Reset Artists Management. Fotonachweise stehen in der Galerie und im Footer.
