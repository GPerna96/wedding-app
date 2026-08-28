# Muro di ricordi — web app per matrimoni

**In produzione:** https://wedding-app.pernagaetano.workers.dev

Gli invitati entrano inquadrando un QR, dicono il loro nome e caricano foto e
video. Nessuna registrazione, nessuna password. Gli originali restano intatti;
le anteprime le genera il telefono, così non serve nessuna transcodifica lato
server. Il muro è comune: ognuno vede quello che caricano gli altri.

Tutto su Cloudflare: un solo Worker (Hono) serve la SPA React, parla con D1 per
i dati e con R2 per i media.

## Come funziona l'accesso

Il QR porta un token dell'evento. Il server lo verifica e rilascia un cookie
firmato HMAC che dura un anno: l'invitato non deve più fare nulla. Senza token
valido tutte le API rispondono 401, compresi i file dei media.

Su iOS un'app aggiunta alla schermata Home ha uno spazio dati separato da
Safari e non eredita i cookie. Per questo il manifest lo genera il Worker: se
chi lo chiede ha già una sessione, l'indirizzo di partenza si porta dietro un
biglietto usa e getta che la riapre. Il biglietto si brucia al primo utilizzo e
sta nel frammento dell'indirizzo, che non lascia mai il browser.

## Sviluppo

```bash
pnpm install
pnpm wrangler d1 migrations apply wedding-app --local
pnpm wrangler dev --port 8799     # API + assets
pnpm dev                          # opzionale: Vite con ricarica, proxy al Worker
```

I segreti locali stanno in `.dev.vars` (non versionato).

## Deploy

```bash
pnpm deploy          # compila la SPA e pubblica
```

Le risorse su Cloudflare:

| Cosa | Nome |
|---|---|
| Worker | `wedding-app` |
| Database D1 | `wedding-app` |
| Bucket R2 | `wedding-media` |

Tre segreti nel Worker: `TOKEN_EVENTO` (finisce nel QR), `SEGRETO_COOKIE`
(firma le sessioni), `SEGRETO_ADMIN` (apre i comandi degli sposi).

**`SEGRETO_COOKIE` non va cambiato a festa iniziata**: le sessioni degli
invitati sono firmate con quello e decadrebbero tutte insieme.

## Materiale da stampare

```bash
pnpm qr "https://wedding-app.pernagaetano.workers.dev/?k=<TOKEN>"
```

Produce `qr/` con tre varianti vettoriali e un PNG. La cartella non è
versionata: il codice apre l'app. C'è anche `qr/segnaposto.html`, quattro
cartoncini per foglio A4, da aprire e stampare.

## Gli sposi

Entrano come tutti gli altri, poi usano "Accesso sposi" in fondo alla pagina e
scrivono `SEGRETO_ADMIN`. Da quel momento la stessa app mostra in più:

- la barra per scaricare **tutti gli originali** in un archivio unico
- un interruttore per nascondere una foto agli invitati
- i contenuti già nascosti, per poterli rimettere in mostra

L'archivio si costruisce mentre viene scaricato, quindi regge decine di GB, ma
un'interruzione fa ricominciare da capo. Per il recupero definitivo conviene
`rclone`, che riprende da dove si era fermato (R2 non fa pagare il traffico in
uscita):

```bash
rclone sync r2:wedding-media ./originali -P
```

## Da non fare durante la festa

**Non svuotare la tabella `ospiti`.** Il cookie di ogni invitato punta a una
riga di quella tabella: cancellarla lascia i cookie validi ma orfani, e tutti
si ritrovano di colpo davanti al benvenuto, con il QR ormai lontano dal tavolo.

Per togliere di mezzo un contenuto si usano i comandi degli sposi, che
nascondono senza toccare le sessioni. `CONFERMA=si pnpm db:azzera-tutto`
esiste per svuotare tutto prima dell'evento, e va lanciato solo allora.

Un caricamento interrotto lascia file su R2 che nessuna riga nomina più:
`/api/sposi/deposito` li conta, `/api/sposi/pulisci-orfani` li rimuove (chiede
in anticipo quanti aspettarsi, per non fare danni se il database fosse vuoto).

## Costi

R2 resta nel piano gratuito tranne lo spazio: circa 0,60 $/mese per 50 GB.
Workers richiede il piano a 5 $/mese, perché 63 invitati che aggiornano il muro
ogni 8 secondi per una serata fanno circa 170.000 richieste e il piano gratuito
si ferma a 100.000 al giorno.
