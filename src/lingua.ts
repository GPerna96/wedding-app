/**
 * Testi dell'app. L'italiano e' la lingua di casa; le altre servono agli
 * invitati che hanno il telefono impostato diversamente e che, senza, si
 * troverebbero davanti a istruzioni che non capiscono proprio mentre cercano
 * di entrare.
 */
const testi = {
  it: {
    matrimonioDi: 'Il matrimonio di',
    invitoNome: 'Le foto e i video che scatti oggi finiscono tutti qui, insieme a quelli degli altri invitati. Come ti chiami?',
    invitoSenzaCodice: 'Le foto e i video di oggi finiscono tutti qui, insieme a quelli degli altri invitati.',
    tuoNome: 'Il tuo nome',
    entra: 'Entra',
    unAttimo: 'Un attimo…',
    scriviNome: 'Scrivi il tuo nome per entrare.',
    linkNonValido: 'Questo link non è valido. Inquadra di nuovo il QR sul tavolo.',
    qualcosaStorto: 'Qualcosa non ha funzionato. Riprova.',
    inquadraCodice: 'Inquadra il codice',
    qrSulTavolo: 'Trovi il QR sul tuo tavolo.',
    apriFotocamera: 'Apri la fotocamera',
    ancheConFotocamera: "Puoi anche inquadrarlo con la fotocamera del telefono: l'app si apre da sola.",

    ciao: (n: string) => `Ciao ${n}`,
    ricordiFinora: (n: number) => `${n} ricordi finora`,
    primoRicordo: 'Il primo ricordo è tuo',
    ancoraNiente: 'Ancora niente',
    scattaQualcosa: 'Scatta qualcosa e sarai il primo ad apparire su questo muro.',
    preparo: 'Preparo…',
    stoCaricando: 'Sto caricando…',
    nonEAndata: 'Non è andata. Tocca per riprovare.',
    riprova: 'Riprova',

    ricordi: 'Ricordi',
    messaggi: 'Messaggi',
    aggiungiFotoVideo: 'Aggiungi foto o video',
    scattaAdesso: 'Scatta adesso',
    apreLaFotocamera: 'Apre la fotocamera',
    scegliDalTelefono: 'Scegli dal telefono',
    anchePiuFoto: 'Anche più foto insieme',

    dueParole: 'Due parole per loro',
    leLeggeranno: 'Le leggeranno tutte',
    scriviDedica: 'Scrivi la tua dedica…',
    lasciaMessaggio: 'Lascia il messaggio',
    invio: 'Invio…',
    nessunMessaggio: 'Nessun messaggio ancora. Comincia tu.',

    prima: '← Prima',
    dopo: 'Dopo →',
    chiudi: 'Chiudi',

    inquadraSulTavolo: 'Inquadra il codice sul tavolo',
    cercoCodice: 'Cerco il codice…',
    trovato: 'Trovato!',
    codiceSbagliato: 'Questo codice non è quello del matrimonio.',
    permessoNegato: 'Per leggere il codice serve il permesso della fotocamera. Puoi darlo dalle impostazioni del browser.',
    nessunaFotocamera: 'Non trovo una fotocamera su questo dispositivo.',
    fotocameraKo: 'Non riesco ad aprire la fotocamera.',

    tienilaAMano: 'Tienila a portata di mano',
    installaAndroid: 'Aggiungila alla schermata iniziale: si apre come un’app, senza cercare il link.',
    installaIos: 'Tocca Condividi in basso, poi «Aggiungi alla schermata Home».',
    aggiungi: 'Aggiungi',

    adesso: 'adesso',
    minFa: (n: number) => `${n} min fa`,
    oreFa: (n: number) => `${n} h fa`,

    accessoSposi: 'Accesso sposi',
    modoSposi: 'Sei entrato come sposo',
    scaricaTutto: 'Scarica tutti gli originali',
    scaricaAvviato: 'Preparo l’archivio… il salvataggio parte tra poco.',
    nascondi: 'Nascondi',
    mostra: 'Mostra',
    nascosto: 'Nascosto agli invitati',
    scaricaQuesto: 'Scarica originale',
    soloSposi: 'Questa parte è riservata a Rita e Francesco.',
    codice: 'Codice',
    codiceErrato: 'Codice non riconosciuto.',
    annulla: 'Annulla',
  },

  en: {
    matrimonioDi: 'The wedding of',
    invitoNome: "Every photo and video you take today lands here, together with everyone else's. What's your name?",
    invitoSenzaCodice: "Today's photos and videos all land here, together with the other guests'.",
    tuoNome: 'Your name',
    entra: 'Come in',
    unAttimo: 'One moment…',
    scriviNome: 'Type your name to come in.',
    linkNonValido: 'This link is not valid. Scan the QR code on your table again.',
    qualcosaStorto: 'Something went wrong. Please try again.',
    inquadraCodice: 'Scan the code',
    qrSulTavolo: 'You will find the QR code on your table.',
    apriFotocamera: 'Open the camera',
    ancheConFotocamera: "You can also scan it with your phone's camera: the app opens by itself.",

    ciao: (n: string) => `Hello ${n}`,
    ricordiFinora: (n: number) => `${n} memories so far`,
    primoRicordo: 'The first memory is yours',
    ancoraNiente: 'Nothing yet',
    scattaQualcosa: 'Take a photo and you will be the first on this wall.',
    preparo: 'Getting ready…',
    stoCaricando: 'Uploading…',
    nonEAndata: 'That did not work. Tap to try again.',
    riprova: 'Retry',

    ricordi: 'Memories',
    messaggi: 'Messages',
    aggiungiFotoVideo: 'Add photos or videos',
    scattaAdesso: 'Take one now',
    apreLaFotocamera: 'Opens the camera',
    scegliDalTelefono: 'Choose from your phone',
    anchePiuFoto: 'Several at once, if you like',

    dueParole: 'A few words for them',
    leLeggeranno: 'They will read every one',
    scriviDedica: 'Write your message…',
    lasciaMessaggio: 'Leave the message',
    invio: 'Sending…',
    nessunMessaggio: 'No messages yet. Be the first.',

    prima: '← Previous',
    dopo: 'Next →',
    chiudi: 'Close',

    inquadraSulTavolo: 'Point at the code on your table',
    cercoCodice: 'Looking for the code…',
    trovato: 'Found it!',
    codiceSbagliato: 'This is not the wedding code.',
    permessoNegato: 'Reading the code needs camera permission. You can grant it in your browser settings.',
    nessunaFotocamera: 'I cannot find a camera on this device.',
    fotocameraKo: 'I cannot open the camera.',

    tienilaAMano: 'Keep it close at hand',
    installaAndroid: 'Add it to your home screen: it opens like an app, no link to look for.',
    installaIos: 'Tap Share below, then "Add to Home Screen".',
    aggiungi: 'Add',

    adesso: 'just now',
    minFa: (n: number) => `${n} min ago`,
    oreFa: (n: number) => `${n} h ago`,

    accessoSposi: 'Couple’s access',
    modoSposi: 'You are signed in as the couple',
    scaricaTutto: 'Download all originals',
    scaricaAvviato: 'Preparing the archive… the download will start shortly.',
    nascondi: 'Hide',
    mostra: 'Show',
    nascosto: 'Hidden from guests',
    scaricaQuesto: 'Download original',
    soloSposi: 'This part is reserved for Rita and Francesco.',
    codice: 'Code',
    codiceErrato: 'Code not recognised.',
    annulla: 'Cancel',
  },
} as const

export type Lingua = keyof typeof testi

/** Prima corrispondenza fra le preferenze del telefono e cio' che sappiamo dire. */
function scegli(): Lingua {
  const preferite = navigator.languages?.length ? navigator.languages : [navigator.language]
  for (const p of preferite) {
    const base = p.toLowerCase().split('-')[0]
    if (base in testi) return base as Lingua
  }
  return 'it'
}

export const lingua = scegli()
export const t = testi[lingua]

/** Il tag della pagina serve agli screen reader e alla sillabazione. */
document.documentElement.lang = lingua

export function quando(ms: number) {
  const min = Math.floor((Date.now() - ms) / 60000)
  if (min < 1) return t.adesso
  if (min < 60) return t.minFa(min)
  const ore = Math.floor(min / 60)
  if (ore < 24) return t.oreFa(ore)
  return new Date(ms).toLocaleDateString(lingua, { day: 'numeric', month: 'long' })
}
