import { Injectable } from '@angular/core';
import { fetchWithTimeout } from './http-timeout';

// ─────────────────────────────────────────────────────────────────────────────
// INTERFACES
// ─────────────────────────────────────────────────────────────────────────────

export interface ConversationParticipant {
  name: string;
  email?: string;
  speakingPercent?: number;   
  speakingMinutes?: number;   
}

export interface TranscriptSegment {
  speakerName: string;
  text: string;
  timestampSeconds: number;
}

export interface NextStep {
  ownerName: string;
  items: string[];
}

export interface Conversation {
  id: string;
  title: string;
  date: string;               
  durationSeconds: number;
  status: 'completed' | 'processing' | 'failed';
  participants: ConversationParticipant[];
  recordingUrl?: string;      
  thumbnailUrl?: string;
  hostName?: string;
  agentName?: string;
  summary?: string;
  nextSteps?: NextStep[];
  transcript?: TranscriptSegment[];
  tags?: string[];
  meetProvider?: 'google_meet' | 'cal_com' | 'zoom' | 'other';
  meetUrl?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA  —  reemplazar con datos reales cuando se integre Google Meet API
// ─────────────────────────────────────────────────────────────────────────────
const MOCK_CONVERSATIONS: Conversation[] = [];

/*
const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: 'conv-001',
    title: 'Bandwidth <> AJAW TECHNOLOGIES INC',
    date: '2026-02-23T16:32:00.000Z',
    durationSeconds: 1838,
    status: 'completed',
    hostName: 'Giuliano Gomez',
    agentName: 'AJAW LAUREN OUTBOUND',
    meetProvider: 'google_meet',
    meetUrl: 'https://meet.google.com/abc-defg-hij',
    participants: [
      { name: 'Giuliano Gomez',  email: 'giuliano@ajaw.com',      speakingPercent: 17, speakingMinutes: 6  },
      { name: 'Jodianne Smith',  email: 'j.smith@bandwidth.com',  speakingPercent: 21, speakingMinutes: 7  },
      { name: 'Ana Torres',      email: 'a.torres@bandwidth.com', speakingPercent: 12, speakingMinutes: 4  },
    ],
    summary: 'En la conversación se discute en detalle el modelo de precios de Bandwidth con Giuliano Gomez. Jodianne explica que Bandwidth opera con un modelo de facturación postpago con un compromiso mínimo de $3,500 al mes. Este monto es inclusivo del volumen de servicios utilizados, como SMS y llamadas. Jodianne aclara que incluso si el uso de Giuliano no alcanza ese mínimo en un mes determinado, se le seguirá cobrando el monto mínimo de $3,500. Giuliano consulta la posibilidad de comenzar con un plan menor, pero Jodianne confirma que el compromiso mínimo es fijo. También discuten el gasto actual de Giuliano con nuestro proveedor actual, que ronda entre $2,000 y $3,000 mensuales, y su interés en migrar a Bandwidth debido a mejores tarifas.',
    nextSteps: [
      {
        ownerName: 'Giuliano Gomez',
        items: [
          'Enviar la factura y el proceso KYC a Jodianne para evaluación y facilitar la transición a Bandwidth.',
          'Proporcionar las direcciones de la oficina central y el almacén a Jodianne para fines de cumplimiento.',
        ]
      },
      {
        ownerName: 'Jodianne Smith',
        items: [
          'Enviar a Giuliano los detalles sobre los próximos pasos y el proceso para comenzar con Bandwidth.',
        ]
      }
    ],
    transcript: [
      { speakerName: 'Giuliano Gomez', timestampSeconds: 12,  text: 'Hola Jodianne, gracias por unirte. Estaba revisando nuestra factura de nuestro proveedor actual y sinceramente los costos están subiendo bastante.' },
      { speakerName: 'Jodianne Smith', timestampSeconds: 28,  text: 'Entiendo completamente. Bandwidth tiene un modelo postpago con un mínimo mensual de $3,500, todo incluido — SMS y llamadas.' },
      { speakerName: 'Giuliano Gomez', timestampSeconds: 55,  text: '¿Hay alguna opción de empezar con un plan menor? Actualmente gastamos entre $2,000 y $3,000 con nuestro proveedor actual.' },
      { speakerName: 'Jodianne Smith', timestampSeconds: 75,  text: 'El compromiso mínimo es fijo en $3,500, no tenemos planes de menor escala por el momento.' },
      { speakerName: 'Giuliano Gomez', timestampSeconds: 110, text: 'Entendido. Las tarifas siguen siendo más competitivas que nuestro proveedor actual, así que tiene sentido explorar la migración.' },
      { speakerName: 'Ana Torres',     timestampSeconds: 145, text: 'Desde el lado técnico la integración es bastante directa, tenemos SDKs para la mayoría de los stacks.' },
      { speakerName: 'Jodianne Smith', timestampSeconds: 180, text: 'Exacto. Para proceder necesitaríamos el KYC y las direcciones de sus oficinas para el contrato.' },
      { speakerName: 'Giuliano Gomez', timestampSeconds: 210, text: 'Perfecto, los envío esta semana. Muchas gracias a las dos.' },
    ],
    tags: ['pricing', 'bandwidth', 'migration']
  },
  {
    id: 'conv-002',
    title: 'Jake & Giuliano (Week 5 Call)',
    date: '2026-02-09T13:01:00.000Z',
    durationSeconds: 660,
    status: 'completed',
    hostName: 'Giuliano Gomez',
    agentName: 'GGCRACING AGENT',
    meetProvider: 'google_meet',
    participants: [
      { name: 'Giuliano Gomez', email: 'giuliano@ajaw.com',  speakingPercent: 45, speakingMinutes: 5 },
      { name: 'Jake Martínez',  email: 'jake@ggcracing.com', speakingPercent: 55, speakingMinutes: 6 },
    ],
    summary: 'Revisión semanal de avances en la integración del agente de IA para GGC Racing. Se discutieron mejoras al flujo de onboarding y se definieron tareas para la semana 6.',
    nextSteps: [
      {
        ownerName: 'Jake Martínez',
        items: ['Probar el flujo de onboarding actualizado.', 'Confirmar fechas de lanzamiento con el equipo técnico.']
      }
    ],
    transcript: [
      { speakerName: 'Giuliano Gomez', timestampSeconds: 5,  text: 'Jake, arranquemos con el update de esta semana.' },
      { speakerName: 'Jake Martínez',  timestampSeconds: 15, text: 'El flujo de onboarding mejoró bastante, los usuarios están llegando más lejos antes de abandonar.' },
      { speakerName: 'Giuliano Gomez', timestampSeconds: 40, text: 'Excelente. ¿Qué queda pendiente para la semana 6?' },
      { speakerName: 'Jake Martínez',  timestampSeconds: 55, text: 'Confirmar las fechas de lanzamiento y hacer pruebas finales.' },
    ],
    tags: ['weekly', 'ggcracing', 'onboarding']
  },
  {
    id: 'conv-003',
    title: 'Jake & Giuliano (Week 4 Call)',
    date: '2026-02-02T11:46:00.000Z',
    durationSeconds: 2640,
    status: 'completed',
    hostName: 'Giuliano Gomez',
    agentName: 'GGCRACING AGENT',
    meetProvider: 'google_meet',
    participants: [
      { name: 'Giuliano Gomez', email: 'giuliano@ajaw.com',  speakingPercent: 40, speakingMinutes: 18 },
      { name: 'Jake Martínez',  email: 'jake@ggcracing.com', speakingPercent: 60, speakingMinutes: 26 },
    ],
    summary: 'Sesión extensa de revisión técnica y estrategia. Se definió el roadmap de las próximas 4 semanas y se revisaron los KPIs del agente de IA.',
    nextSteps: [
      {
        ownerName: 'Giuliano Gomez',
        items: ['Preparar documento de roadmap para aprobación.', 'Compartir acceso al dashboard de métricas.']
      },
      {
        ownerName: 'Jake Martínez',
        items: ['Revisar y aprobar el roadmap propuesto.']
      }
    ],
    transcript: [
      { speakerName: 'Jake Martínez',  timestampSeconds: 8,  text: 'Antes de empezar quería compartir los números de la semana. Los resultados son bastante positivos.' },
      { speakerName: 'Giuliano Gomez', timestampSeconds: 25, text: 'Perfecto. ¿Qué indicadores viste más destacados?' },
      { speakerName: 'Jake Martínez',  timestampSeconds: 38, text: 'La tasa de conversión subió un 12% y el tiempo promedio de respuesta del agente bajó a 1.8 segundos.' },
      { speakerName: 'Giuliano Gomez', timestampSeconds: 62, text: 'Muy bien. Propongo que esta semana enfoquemos el roadmap en escalar esos resultados.' },
    ],
    tags: ['roadmap', 'kpis', 'ggcracing']
  }
];
*/
// ─────────────────────────────────────────────────────────────────────────────
// SERVICE
// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class ConversationService {

  // ══════════════════════════════════════════════════════════════════════════
  // MOCK  —  datos de prueba mientras no hay integración real
  // ══════════════════════════════════════════════════════════════════════════

  async getConversations(): Promise<Conversation[]> {
    await this.delay(600);
    return [...MOCK_CONVERSATIONS];
  }

  async getConversationById(id: string): Promise<Conversation | null> {
    await this.delay(350);
    return MOCK_CONVERSATIONS.find(c => c.id === id) ?? null;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // REAL — Google Meet API  (descomenta cuando tengas el access token OAuth2)
  // Scope requerido: https://www.googleapis.com/auth/meetings.space.readonly
  // Docs: https://developers.google.com/meet/api/reference/rest
  // ══════════════════════════════════════════════════════════════════════════

  // private readonly GOOGLE_MEET_API = 'https://meet.googleapis.com/v2';
  //
  // async getConversations(): Promise<Conversation[]> {
  //   const token = localStorage.getItem('googleAccessToken'); // o tu AuthService
  //   const response = await fetchWithTimeout(`${this.GOOGLE_MEET_API}/recordings`, {
  //     headers: { Authorization: `Bearer ${token}` }
  //   });
  //   if (!response.ok) throw new Error(`Google Meet API error: ${response.status}`);
  //   const data = await response.json();
  //   return (data.recordings ?? []).map((r: any): Conversation => ({
  //     id:              r.name,
  //     title:           r.space?.title ?? 'Reunión sin título',
  //     date:            r.startTime,
  //     durationSeconds: this.isoToDuration(r.startTime, r.endTime),
  //     status:          'completed',
  //     participants:    [],           // <-- llamar endpoint /participants por separado
  //     recordingUrl:    r.driveDestination?.exportUri,
  //     meetProvider:    'google_meet',
  //     meetUrl:         r.space?.meetingUri,
  //   }));
  // }
  //
  // async getConversationById(id: string): Promise<Conversation | null> {
  //   const token = localStorage.getItem('googleAccessToken');
  //   const resp = await fetchWithTimeout(`${this.GOOGLE_MEET_API}/recordings/${encodeURIComponent(id)}`, {
  //     headers: { Authorization: `Bearer ${token}` }
  //   });
  //   if (!resp.ok) return null;
  //   const r = await resp.json();
  //   return {
  //     id:              r.name,
  //     title:           r.space?.title ?? 'Reunión sin título',
  //     date:            r.startTime,
  //     durationSeconds: this.isoToDuration(r.startTime, r.endTime),
  //     status:          'completed',
  //     participants:    [],
  //     recordingUrl:    r.driveDestination?.exportUri,
  //     meetProvider:    'google_meet',
  //     meetUrl:         r.space?.meetingUri,
  //   };
  // }
  //
  // private isoToDuration(start: string, end: string): number {
  //   return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000);
  // }

  // ══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════════════════════════

  formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const h = Math.floor(m / 60);
    const rem = m % 60;
    return h > 0 ? `${h}h ${rem}m` : `${m}m`;
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es-CO', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  }

  formatShortDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es-CO', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  formatTimestamp(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  getInitials(name: string): string {
    return name.split(' ').slice(0, 2).map(n => n[0] ?? '').join('').toUpperCase();
  }

  avatarColor(name: string): string {
    const p = ['#5b4fe5','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899'];
    let h = 0;
    for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    return p[Math.abs(h) % p.length];
  }

  private delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }
}