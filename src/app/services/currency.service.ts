import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * Moneda de VISUALIZACIÓN.
 *
 * Importante: el cobro real siempre ocurre en USD (Stripe). Esto solo sirve
 * para que el cliente vea el precio aproximado en su moneda y entienda cuánto
 * va a pagar. Por eso todo precio convertido se muestra con "≈" y con la
 * aclaración de que se cobra en dólares.
 */
export interface AppCurrency {
  code: string;
  symbol: string;
  name: string;      // nombre para mostrar
  flag: string;
  /** Monedas sin decimales de uso común (se redondean a entero). */
  noDecimals?: boolean;
  zones?: string[];
}

export const CURRENCIES: AppCurrency[] = [
  { code: 'USD', symbol: '$',   name: 'Dólar estadounidense', flag: '🇺🇸',
    zones: ['America/New_York','America/Chicago','America/Denver','America/Los_Angeles','America/Phoenix'] },
  { code: 'COP', symbol: '$',   name: 'Peso colombiano', flag: '🇨🇴', noDecimals: true, zones: ['America/Bogota'] },
  { code: 'MXN', symbol: '$',   name: 'Peso mexicano', flag: '🇲🇽', zones: ['America/Mexico_City','America/Monterrey','America/Tijuana','America/Cancun'] },
  { code: 'BRL', symbol: 'R$',  name: 'Real brasileño', flag: '🇧🇷',
    zones: ['America/Sao_Paulo','America/Fortaleza','America/Recife','America/Bahia','America/Manaus','America/Belem'] },
  { code: 'ARS', symbol: '$',   name: 'Peso argentino', flag: '🇦🇷', noDecimals: true, zones: ['America/Argentina/Buenos_Aires','America/Argentina/Cordoba'] },
  { code: 'CLP', symbol: '$',   name: 'Peso chileno', flag: '🇨🇱', noDecimals: true, zones: ['America/Santiago'] },
  { code: 'PEN', symbol: 'S/',  name: 'Sol peruano', flag: '🇵🇪', zones: ['America/Lima'] },
  { code: 'EUR', symbol: '€',   name: 'Euro', flag: '🇪🇺',
    zones: ['Europe/Madrid','Europe/Paris','Europe/Berlin','Europe/Rome','Europe/Amsterdam','Europe/Lisbon','Europe/Vienna','Europe/Dublin'] },
  { code: 'GBP', symbol: '£',   name: 'Libra esterlina', flag: '🇬🇧', zones: ['Europe/London'] },
  { code: 'CAD', symbol: 'C$',  name: 'Dólar canadiense', flag: '🇨🇦', zones: ['America/Toronto','America/Vancouver','America/Montreal'] },
  { code: 'JPY', symbol: '¥',   name: 'Yen japonés', flag: '🇯🇵', noDecimals: true, zones: ['Asia/Tokyo'] },
  { code: 'CNY', symbol: '¥',   name: 'Yuan chino', flag: '🇨🇳', zones: ['Asia/Shanghai','Asia/Chongqing'] },
  { code: 'KRW', symbol: '₩',   name: 'Won surcoreano', flag: '🇰🇷', noDecimals: true, zones: ['Asia/Seoul'] },
  { code: 'INR', symbol: '₹',   name: 'Rupia india', flag: '🇮🇳', zones: ['Asia/Kolkata','Asia/Calcutta'] },
  { code: 'AED', symbol: 'د.إ', name: 'Dírham (EAU)', flag: '🇦🇪', zones: ['Asia/Dubai'] },
];

/**
 * En Safari privado (o con cookies bloqueadas) localStorage LANZA excepción.
 * Este servicio es providedIn:'root', así que un error aquí tumbaría el
 * arranque de toda la app. Por eso todo acceso va envuelto.
 */
function safeGet(k: string): string | null {
  try { return localStorage.getItem(k); } catch { return null; }
}
function safeSet(k: string, v: string): void {
  try { localStorage.setItem(k, v); } catch { /* sin almacenamiento: seguimos en memoria */ }
}

const RATES_URL = 'https://open.er-api.com/v6/latest/USD';
const CACHE_KEY = 'ajawRates';
const CACHE_HOURS = 12;

@Injectable({ providedIn: 'root' })
export class CurrencyService {
  private rates: Record<string, number> = { USD: 1 };
  private ratesDate = '';
  private currencySubject: BehaviorSubject<string>;
  public currency$: BehaviorSubject<string>;

  constructor() {
    const saved = safeGet('currency');
    const codes = CURRENCIES.map(c => c.code);
    const initial = (saved && codes.includes(saved)) ? saved : this.detect();
    this.currencySubject = new BehaviorSubject<string>(initial);
    this.currency$ = this.currencySubject;
    this.loadRates();
  }

  /** Detecta la moneda por zona horaria del equipo (sin backend ni IP). */
  detect(fallback = 'USD'): string {
    try {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const hit = CURRENCIES.find(c => c.zones?.includes(zone));
      if (hit) return hit.code;
      // por región, si la zona exacta no está listada
      if (zone?.startsWith('Europe/')) return 'EUR';
    } catch { /* noop */ }
    return fallback;
  }

  get current(): string { return this.currencySubject.getValue(); }

  setCurrency(code: string): void {
    safeSet('currency', code);
    this.currencySubject.next(code);
  }

  info(code = this.current): AppCurrency {
    return CURRENCIES.find(c => c.code === code) ?? CURRENCIES[0];
  }

  /** Tipos de cambio con caché de 12 h; si falla la red, seguimos en USD. */
  private async loadRates(): Promise<void> {
    try {
      const raw = safeGet(CACHE_KEY);
      if (raw) {
        const c = JSON.parse(raw);
        if (Date.now() - c.ts < CACHE_HOURS * 3600_000) {
          this.rates = c.rates; this.ratesDate = c.date; return;
        }
      }
    } catch { /* noop */ }

    try {
      const r = await fetch(RATES_URL);
      const j = await r.json();
      if (j?.result === 'success' && j.rates) {
        this.rates = j.rates;
        this.ratesDate = (j.time_last_update_utc || '').slice(0, 16);
        safeSet(CACHE_KEY, JSON.stringify({
          ts: Date.now(), rates: this.rates, date: this.ratesDate
        }));
      }
    } catch { /* si no hay red, se muestra solo USD */ }
  }

  get rateDate(): string { return this.ratesDate; }

  /** ¿Tenemos tipo de cambio para la moneda elegida? */
  canConvert(code = this.current): boolean {
    return code !== 'USD' && !!this.rates[code];
  }

  /** Convierte un monto en USD a la moneda de visualización. */
  convert(usd: number, code = this.current): number | null {
    const rate = this.rates[code];
    if (!rate) return null;
    return usd * rate;
  }

  /** Formatea un monto ya convertido, con separadores locales. */
  format(amount: number, code = this.current): string {
    const cur = this.info(code);
    const decimals = cur.noDecimals || amount >= 1000 ? 0 : 2;
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency', currency: code,
        minimumFractionDigits: decimals, maximumFractionDigits: decimals
      }).format(amount);
    } catch {
      return `${cur.symbol}${amount.toLocaleString(undefined, { maximumFractionDigits: decimals })}`;
    }
  }

  /** "≈ $1.268.096 COP" — o cadena vacía si no aplica conversión. */
  approx(usd: number, code = this.current): string {
    if (!this.canConvert(code)) return '';
    const v = this.convert(usd, code);
    if (v === null) return '';
    return `≈ ${this.format(v, code)} ${code}`;
  }
}
