# Muro di ricordi — web app per matrimoni

**In produzione:** https://wedding-app.pernagaetano.workers.dev

Web app per il matrimonio: gli ospiti entrano inquadrando un QR, dicono il loro nome
e caricano foto e video. Gli originali restano intatti; le anteprime le genera il
telefono, così non serve nessuna transcodifica lato server.

Tutto gira su Cloudflare: un solo Worker (Hono) che serve la SPA React, parla con
D1 per i dati e con R2 per i media.

## Sviluppo

```bash
pnpm install
pnpm wrangler d1 migrations apply wedding-app --local
pnpm wrangler dev --port 8799     # API + assets
pnpm dev                          # opzionale: Vite con hot reload, fa da proxy al Worker
```

I segreti locali stanno in `.dev.vars` (non versionato).

## Deploy

```bash
pnpm wrangler d1 create wedding-app      # copia il database_id in wrangler.jsonc
pnpm wrangler r2 bucket create wedding-media
pnpm wrangler d1 migrations apply wedding-app --remote

pnpm wrangler secret put TOKEN_EVENTO       # finisce nel QR
pnpm wrangler secret put SEGRETO_COOKIE     # firma i cookie: stringa lunga a caso
pnpm wrangler secret put SEGRETO_ADMIN      # apre /sposi

pnpm deploy
```

Il QR va generato sull'indirizzo `https://<app>/?k=<TOKEN_EVENTO>`.

## Recupero degli originali a fine festa

Il traffico in uscita da R2 è gratuito:

```bash
rclone sync r2:wedding-media ./originali -P
```


## Risorse su Cloudflare

| Cosa | Nome |
|---|---|
| Worker | `wedding-app` |
| Database D1 | `wedding-app` |
| Bucket R2 | `wedding-media` |

I tre segreti (`TOKEN_EVENTO`, `SEGRETO_COOKIE`, `SEGRETO_ADMIN`) stanno nei
secret del Worker. **`SEGRETO_COOKIE` non va cambiato a festa iniziata**: le
sessioni degli ospiti sono firmate con quello e decadrebbero tutte insieme.

## Materiale da stampare

`qr/segnaposto.html` — quattro cartoncini per foglio A4, apri e stampa. Non è
versionato: contiene il token che apre l'app.

Per rigenerare il QR dopo un cambio di token:

```bash
pnpm dlx qrcode -o qr/accesso.png -w 1200 "https://wedding-app.pernagaetano.workers.dev/?k=<TOKEN>"
```

## Costi

R2 resta dentro il piano gratuito tranne lo spazio: ~0,60 $/mese per 50 GB.
Workers richiede il piano a 5 $/mese, perché 63 ospiti che aggiornano il muro
ogni 8 secondi per una serata fanno circa 170.000 richieste e il piano gratuito
si ferma a 100.000 al giorno.
