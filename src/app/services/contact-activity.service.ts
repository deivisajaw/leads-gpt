import { Injectable } from '@angular/core';
import { CampaignService } from './campaign.service';

/** Un toque con el contacto, ya normalizado para pintar. */
export interface ContactTouch {
  kind: 'call';
  /** Título corto ya resuelto: "La IA lo llamó · 2 min 14 s". */
  title: string;
  /** Una línea con lo que pasó; sale del resumen de la llamada. */
  body: string;
  date: string;
  /** Clave i18n del resultado, para pintar el chip. */
  outcomeKey: string;
  /** Resultados que cuentan como buenos, para el color del chip. */
  positive: boolean;
  recordingUrl?: string;
}

@Injectable({ providedIn: 'root' })
export class ContactActivityService {

  constructor(private campaigns: CampaignService) {}

  /** Sólo estos dígitos finales se comparan: los prefijos de país varían. */
  private last(v?: string | null, n = 10): string {
    const d = (v ?? '').replace(/\D/g, '');
    return d.length >= 8 ? d.slice(-n) : '';
  }

  /**
   * Toques que hemos tenido con un contacto, más recientes primero.
   *
   * Hoy sólo llamadas: getCallsByCompany ya acepta un filtro por contacto, así
   * que es una sola petición barata. Los mensajes de WhatsApp viven en otro
   * sistema y traerlos aquí obligaría a recorrer toda la bandeja — se añaden
   * cuando exista un endpoint por contacto, sin cambiar esta firma.
   *
   * Nunca lanza: si el endpoint falla, la ficha se pinta igual y sin franja.
   */
  async forContact(phone?: string | null, name?: string | null): Promise<ContactTouch[]> {
    const needle = (phone || '').trim() || (name || '').trim();
    if (!needle) return [];

    try {
      const res = await this.campaigns.getCallsByCompany(0, 20, needle);
      const calls: any[] = res?.calls ?? [];
      const key = this.last(phone);

      return calls
        // El backend filtra por texto; confirmamos el número para no colar a otro.
        .filter(c => !key || !c.customerPhone || this.last(c.customerPhone) === key)
        .map(c => this.toTouch(c))
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    } catch {
      return [];
    }
  }

  private toTouch(c: any): ContactTouch {
    const dir = String(c.direction || '').toLowerCase();
    const outcome = String(c.outcome || 'ANSWERED_NO_OUTCOME').toUpperCase();
    return {
      kind: 'call',
      title: dir === 'inbound' ? 'ACTIVITY.CALL_IN' : 'ACTIVITY.CALL_OUT',
      body: (c.summary || '').trim(),
      date: c.startedAt || '',
      outcomeKey: 'ACTIVITY.OUTCOME.' + outcome,
      positive: ['APPOINTMENT_SET', 'INTERESTED', 'CALLBACK_REQUESTED'].includes(outcome),
      recordingUrl: c.recordingUrl || undefined,
    };
  }

  /** "2 min 14 s" a partir de los milisegundos que manda el backend. */
  duration(ms?: number): string {
    if (!ms || ms < 1000) return '';
    const s = Math.round(ms / 1000);
    const m = Math.floor(s / 60);
    return m ? `${m} min ${s % 60} s` : `${s} s`;
  }
}
