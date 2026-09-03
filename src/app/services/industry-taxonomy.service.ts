import { Injectable } from '@angular/core';
import { fetchWithTimeout } from './http-timeout';

export interface IndustryGroup {
  key: string;
  icon: string;
  es: string;
  pt: string;
  en: string;
}

export interface Industry {
  key: string;
  group: string;
  es: string;
  pt: string;
  en: string;
}

/** Un grupo con sus industrias, ya listo para pintar. */
export interface IndustrySection {
  key: string;
  icon: string;
  label: string;
  industries: { key: string; label: string }[];
}

/**
 * Las 89 industrias en lenguaje de vendedor, agrupadas en 16 familias.
 *
 * Existe porque la columna `category` de la base trae 29.097 valores distintos
 * ("RETAIL", "Driving school", cadenas CIIU de 200 caracteres…). Eso no se le
 * puede poner a nadie en un filtro. Esta lista va encima de esa columna sin
 * borrarla.
 */
@Injectable({ providedIn: 'root' })
export class IndustryTaxonomyService {
  private cache?: { groups: IndustryGroup[]; industries: Industry[] };
  private inFlight?: Promise<void>;

  /** Se pide una sola vez por sesión; las llamadas simultáneas comparten la misma. */
  private async load(): Promise<void> {
    if (this.cache) return;
    if (this.inFlight) return this.inFlight;

    this.inFlight = (async () => {
      try {
        const res = await fetchWithTimeout('data/industries.json', {}, 15000);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        this.cache = await res.json();
      } catch (e) {
        console.error('No se pudo cargar la taxonomía de industrias:', e);
        // Sin taxonomía el filtro simplemente no aparece; el resto de la
        // pantalla sigue funcionando igual.
        this.cache = { groups: [], industries: [] };
      } finally {
        this.inFlight = undefined;
      }
    })();
    return this.inFlight;
  }

  /** Los 16 grupos con sus industrias, ya en el idioma pedido. */
  async sections(lang: string): Promise<IndustrySection[]> {
    await this.load();
    const { groups = [], industries = [] } = this.cache ?? {};
    const key = (lang === 'pt' || lang === 'es') ? lang : 'en';

    return groups.map(g => ({
      key: g.key,
      icon: g.icon,
      label: (g as any)[key] ?? g.en,
      industries: industries
        .filter(i => i.group === g.key)
        .map(i => ({ key: i.key, label: (i as any)[key] ?? i.en })),
    })).filter(s => s.industries.length > 0);
  }

  /** Etiqueta de una industria suelta, para pintar el chip elegido. */
  async label(industryKey: string, lang: string): Promise<string> {
    await this.load();
    const key = (lang === 'pt' || lang === 'es') ? lang : 'en';
    const found = this.cache?.industries.find(i => i.key === industryKey);
    return found ? ((found as any)[key] ?? found.en) : industryKey;
  }
}
