/**
 * Icone disegnate a tratto, spessore 1.6: si accordano al peso leggero del
 * Cormorant senza fare blocco nero in fondo allo schermo. Prima erano
 * caratteri tipografici (▦ ✎), che cambiano faccia da un telefono all'altro.
 */
type Props = { className?: string }

const comune = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

/** Ricordi: due fotografie sovrapposte, come un mazzetto di stampe. */
export function IconaRicordi({ className }: Props) {
  return (
    <svg {...comune} className={className} aria-hidden="true">
      <rect x="7.5" y="3.5" width="13" height="13" rx="2.5" />
      <path d="M7.5 7.5H5A1.5 1.5 0 0 0 3.5 9v9.5A2 2 0 0 0 5.5 20.5H15a1.5 1.5 0 0 0 1.5-1.5v-2.5" />
      <circle cx="11.5" cy="7.8" r="1.4" />
      <path d="M20.5 13.2l-3.1-3a1.5 1.5 0 0 0-2.1 0l-4.3 4.2" />
    </svg>
  )
}

/** Messaggi: un biglietto piegato, non una nuvoletta da chat. */
export function IconaMessaggi({ className }: Props) {
  return (
    <svg {...comune} className={className} aria-hidden="true">
      <path d="M4 6.5A2 2 0 0 1 6 4.5h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9.5L5 20v-3.5a2 2 0 0 1-1-1.7z" />
      <path d="M8.5 9h7M8.5 12h4.5" />
    </svg>
  )
}

/** Il pulsante centrale: una macchina fotografica. */
export function IconaFotocamera({ className }: Props) {
  return (
    <svg {...comune} strokeWidth={1.5} className={className} aria-hidden="true">
      <path d="M3.5 8.5a2 2 0 0 1 2-2h1.8a1 1 0 0 0 .83-.45l.94-1.4a1 1 0 0 1 .83-.45h4.2a1 1 0 0 1 .83.45l.94 1.4a1 1 0 0 0 .83.45h1.8a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
      <circle cx="12" cy="12.6" r="3.5" />
    </svg>
  )
}

/** Nel foglio: scegliere dal telefono. */
export function IconaGalleria({ className }: Props) {
  return (
    <svg {...comune} className={className} aria-hidden="true">
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <circle cx="8.7" cy="9.3" r="1.6" />
      <path d="M3.7 16.2l4.4-4.2a1.6 1.6 0 0 1 2.2 0l3.5 3.4M13.4 14l2.3-2.2a1.6 1.6 0 0 1 2.2 0l2.4 2.3" />
    </svg>
  )
}

/** L'invito ad aggiungere l'app alla schermata iniziale. */
export function IconaInstalla({ className }: Props) {
  return (
    <svg {...comune} className={className} aria-hidden="true">
      <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
      <path d="M12 7.5v6.5M9.4 11.6L12 14.2l2.6-2.6" />
    </svg>
  )
}
