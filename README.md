# Rita & Francesco — muro di ricordi

Web app per il matrimonio: gli ospiti entrano inquadrando un QR, dicono il loro nome
e caricano foto e video. Gli originali restano intatti; le anteprime le genera il
telefono, così non serve nessuna transcodifica lato server.

Tutto gira su Cloudflare: un solo Worker (Hono) che serve la SPA React, parla con
D1 per i dati e con R2 per i media.

## Sviluppo

```bash
pnpm install
pnpm wrangler d1 migrations apply rita-francesco --local
pnpm wrangler dev --port 8799     # API + assets
pnpm dev                          # opzionale: Vite con hot reload, fa da proxy al Worker
```

I segreti locali stanno in `.dev.vars` (non versionato).

## Deploy

```bash
pnpm wrangler d1 create rita-francesco      # copia il database_id in wrangler.jsonc
pnpm wrangler r2 bucket create rita-francesco
pnpm wrangler d1 migrations apply rita-francesco --remote

pnpm wrangler secret put TOKEN_EVENTO       # finisce nel QR
pnpm wrangler secret put SEGRETO_COOKIE     # firma i cookie: stringa lunga a caso
pnpm wrangler secret put SEGRETO_ADMIN      # apre /sposi

pnpm deploy
```

Il QR va generato sull'indirizzo `https://<app>/?k=<TOKEN_EVENTO>`.

## Recupero degli originali a fine festa

Il traffico in uscita da R2 è gratuito:

```bash
rclone sync r2:rita-francesco ./originali -P
```
