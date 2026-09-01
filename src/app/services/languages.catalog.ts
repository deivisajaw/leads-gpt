/**
 * Catálogo de idiomas de AJAW.
 *
 * `ready: true`  → hay archivo en public/i18n/<code>.json y se puede seleccionar.
 * `ready: false` → aparece en la lista como "próximamente" (no seleccionable),
 *                  así el selector ya muestra el plan sin romper la app.
 *
 * Para activar un idioma: crear public/i18n/<code>.json y poner ready: true.
 */
export interface AppLanguage {
  code: string;      // ISO 639-1 (o variante: es-MX)
  native: string;    // como lo llaman quienes lo hablan
  english: string;   // nombre en inglés, para reconocerlo
  flag: string;
  ready: boolean;
  /** Zonas horarias que sugieren este idioma (detección automática). */
  zones?: string[];
}

export const LANGUAGES: AppLanguage[] = [
  { code: 'es', native: 'Español', english: 'Spanish', flag: '🇪🇸', ready: true,
    zones: ['America/Bogota','America/Mexico_City','America/Lima','America/Santiago',
            'America/Argentina/Buenos_Aires','America/Caracas','America/La_Paz',
            'America/Montevideo','America/Asuncion','America/Guayaquil','America/Panama',
            'America/Guatemala','America/El_Salvador','America/Tegucigalpa','America/Managua',
            'America/Costa_Rica','America/Havana','America/Santo_Domingo','Europe/Madrid'] },

  { code: 'en', native: 'English', english: 'English', flag: '🇺🇸', ready: true,
    zones: ['America/New_York','America/Chicago','America/Denver','America/Los_Angeles',
            'America/Phoenix','America/Toronto','Europe/London','Australia/Sydney',
            'Pacific/Auckland'] },

  { code: 'pt', native: 'Português', english: 'Portuguese', flag: '🇧🇷', ready: true,
    zones: ['America/Sao_Paulo','America/Fortaleza','America/Recife','America/Bahia',
            'America/Manaus','America/Belem','America/Cuiaba','Europe/Lisbon'] },

  // ── en el plan, todavía sin archivo de traducción ──
  { code: 'fr', native: 'Français',  english: 'French',    flag: '🇫🇷', ready: true, zones: ['Europe/Paris','America/Montreal'] },
  { code: 'de', native: 'Deutsch',   english: 'German',    flag: '🇩🇪', ready: true, zones: ['Europe/Berlin','Europe/Vienna','Europe/Zurich'] },
  { code: 'it', native: 'Italiano',  english: 'Italian',   flag: '🇮🇹', ready: true, zones: ['Europe/Rome'] },
  { code: 'ja', native: '日本語',     english: 'Japanese',  flag: '🇯🇵', ready: true, zones: ['Asia/Tokyo'] },
  { code: 'zh', native: '中文',       english: 'Chinese',   flag: '🇨🇳', ready: true, zones: ['Asia/Shanghai','Asia/Hong_Kong','Asia/Taipei','Asia/Macau'] },
  { code: 'ko', native: '한국어',     english: 'Korean',    flag: '🇰🇷', ready: true, zones: ['Asia/Seoul'] },
  { code: 'nl', native: 'Nederlands',english: 'Dutch',     flag: '🇳🇱', ready: true, zones: ['Europe/Amsterdam'] },
  { code: 'ar', native: 'العربية',    english: 'Arabic',    flag: '🇦🇪', ready: true, zones: ['Asia/Dubai','Asia/Riyadh'] },
  { code: 'hi', native: 'हिन्दी',      english: 'Hindi',     flag: '🇮🇳', ready: true, zones: ['Asia/Kolkata'] },
];

/** Idiomas que se escriben de derecha a izquierda. */
export const RTL_CODES = ['ar', 'he', 'fa', 'ur'];
export const isRTL = (code: string) => RTL_CODES.includes(code);

export const READY_LANGUAGES = () => LANGUAGES.filter(l => l.ready);

/**
 * Adivina el idioma sin preguntar ni llamar a ningún servicio:
 * 1) el idioma del navegador, 2) la zona horaria del equipo.
 * Devuelve solo idiomas que ya tienen traducción.
 */
export function detectLanguage(fallback = 'es'): string {
  const ready = READY_LANGUAGES().map(l => l.code);

  try {
    const nav = (navigator.languages?.[0] || navigator.language || '').toLowerCase();
    const base = nav.split('-')[0];
    if (ready.includes(base)) return base;
  } catch { /* noop */ }

  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const byZone = LANGUAGES.find(l => l.ready && l.zones?.includes(zone));
    if (byZone) return byZone.code;
    // por región, si la zona exacta no está en la lista
    if (zone?.startsWith('America/')) return ready.includes('es') ? 'es' : fallback;
    if (zone?.startsWith('Europe/'))  return ready.includes('en') ? 'en' : fallback;
  } catch { /* noop */ }

  return fallback;
}
