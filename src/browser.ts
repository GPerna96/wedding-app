/**
 * Che browser stiamo servendo.
 *
 * Serve solo per le istruzioni di installazione: il gesto cambia da browser a
 * browser, e dire "tocca Condividi in Safari" a chi sta usando Chrome manda
 * la gente a cercare una cosa che non c'e'. Dove non riconosciamo nulla, le
 * istruzioni restano generiche invece di sbagliare nome.
 */
export type Browser =
  | 'safari-ios' | 'chrome-ios' | 'firefox-ios' | 'edge-ios'
  | 'chrome-android' | 'samsung' | 'firefox-android' | 'edge-android'
  | 'altro'

export function riconosciBrowser(): Browser {
  const ua = navigator.userAgent
  const iOS = /iphone|ipad|ipod/i.test(ua) ||
    (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)

  if (iOS) {
    // Su iOS ogni browser e' WebKit sotto: si distinguono solo dalla sigla.
    if (/crios/i.test(ua)) return 'chrome-ios'
    if (/fxios/i.test(ua)) return 'firefox-ios'
    if (/edgios/i.test(ua)) return 'edge-ios'
    return 'safari-ios'
  }

  if (/android/i.test(ua)) {
    // Samsung Internet va cercato per primo: dichiara anche Chrome.
    if (/samsungbrowser/i.test(ua)) return 'samsung'
    if (/edga|edg\//i.test(ua)) return 'edge-android'
    if (/firefox|fxios/i.test(ua)) return 'firefox-android'
    if (/chrome|crios/i.test(ua)) return 'chrome-android'
  }

  return 'altro'
}

/** Il nome da scrivere nelle istruzioni, o niente se non ne siamo sicuri. */
export function nomeBrowser(b: Browser): string | null {
  switch (b) {
    case 'safari-ios': return 'Safari'
    case 'chrome-ios':
    case 'chrome-android': return 'Chrome'
    case 'firefox-ios':
    case 'firefox-android': return 'Firefox'
    case 'edge-ios':
    case 'edge-android': return 'Edge'
    case 'samsung': return 'Samsung Internet'
    default: return null
  }
}
