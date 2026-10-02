# jana-nagyova.cz

Statische Startseite, ausgeliefert über Cloudflare Workers (Static Assets).

```sh
npm install
npm run dev      # lokal unter http://localhost:8787
npm run deploy   # nach Cloudflare deployen
```

Inhalte liegen in `public/`. Die Domain `jana-nagyova.cz` wird im Cloudflare-Dashboard
unter *Workers & Pages → jana-nagyova-cz → Settings → Domains & Routes* als Custom Domain
hinzugefügt.
