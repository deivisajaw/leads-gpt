import { Injectable } from '@angular/core';
import { ApiConfigService } from './api-config.service';
import { fetchWithTimeout } from './http-timeout';

export interface GoogleCalendarEvent {
  id: string;
  uid: string; // = id (alias for compatibility)
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  updatedAt?: string;
  status: 'confirmed' | 'tentative' | 'cancelled';
  location?: string;
  meetingUrl?: string;
  timeZone?: string;
  attendees: GoogleAttendee[];
  organizer: { name: string; email: string };
  agentId?: number;
  agentName?: string;
  calendarId?: string;
}

export interface GoogleAttendee {
  name: string;
  email: string;
  timeZone?: string;
  attendeeStatus?: 'accepted' | 'pending' | 'declined' | 'tentative';
  role?: 'owner' | 'attendee';
}

export interface MeetingGroup {
  label: string;
  tag: 'today' | 'tomorrow' | 'upcoming';
  meetings: GoogleCalendarEvent[];
}

export interface CalendarIntegrationRef {
  id: number;
  calendarId: string;
  accessToken: string;
  agentName: string | null;
}

export type TokenRefreshResult =
  | { success: true; accessToken: string }
  | { success: false; error: string; isExpired?: boolean };

@Injectable({
  providedIn: 'root'
})
export class MeetingService {

  private cache: GoogleCalendarEvent[] = [];

  /**
   * Cuándo se refrescó por última vez el token de cada calendario.
   *
   * Antes se refrescaban TODOS en cada carga de la pantalla. Con 6 calendarios
   * conectados eso son 6 llamadas al webhook de OAuth que tardan entre 0,6 s y
   * 12,2 s, y la pantalla espera a la más lenta: doce segundos en blanco cada
   * vez que entras. Las peticiones a nuestro propio backend, en comparación,
   * tardan 60 ms.
   *
   * Los tokens de Google duran una hora, así que refrescar como mucho cada 30
   * minutos es seguro y deja la segunda visita en menos de medio segundo.
   */
  private lastRefreshed = new Map<number, number>();
  private static readonly REFRESH_TTL_MS = 30 * 60 * 1000;

  /** Lo último que se cargó en esta sesión, para pintar sin esperar a Google. */
  get cached(): GoogleCalendarEvent[] { return this.cache; }

  constructor(private apiConfig: ApiConfigService) {}

  // ─────────────────────────────────────────────
  // MAIN: load all meetings from all calendars
  // ─────────────────────────────────────────────

  async getAllMeetings(): Promise<GoogleCalendarEvent[]> {
    // 1. Get all active Google CalendarIntegrations from backend
    const integrations = await this.getCalendarIntegrations();
    console.debug('[MeetingService] STEP 1 — integrations from backend:', integrations);
    if (integrations.length === 0) {
      console.warn('[MeetingService] No integrations returned. Check CalendarIntegration records (active=true, provider=GOOGLE).');
      return [];
    }

    const allEvents: GoogleCalendarEvent[] = [];

    await Promise.all(
      integrations.map(async (ci) => {
        try {
          // 2. Refresh token via webhook using the BD record id
          console.debug(`[MeetingService] STEP 2 — refreshing token for id: ${ci.id} calendarId: "${ci.calendarId}"`);
          const refreshedAt = this.lastRefreshed.get(ci.id) ?? 0;
          const stillFresh = Date.now() - refreshedAt < MeetingService.REFRESH_TTL_MS;

          const refreshResult = stillFresh
            ? { success: true as const, accessToken: ci.accessToken }
            : await this.refreshToken(ci.id);
          console.debug(`[MeetingService] STEP 2 — refresh result (cached: ${stillFresh}):`, refreshResult);

          if (refreshResult.success && !stillFresh) {
            this.lastRefreshed.set(ci.id, Date.now());
          }

          if (!refreshResult.success) {
            // Si falla el refresco, se olvida para reintentar en la próxima visita.
            this.lastRefreshed.delete(ci.id);
            console.warn(
              `[MeetingService] Token refresh failed for calendar "${ci.calendarId}":`,
              refreshResult.error
            );
            return;
          }

          // 3. Get fresh integration data from backend (contains updated accessToken)
          console.debug(`[MeetingService] STEP 3 — fetching fresh calendar data for id: ${ci.id}`);
          const freshCi = await this.getCalendarById(ci.id);
          console.debug(`[MeetingService] STEP 3 — freshCi:`, freshCi);
          if (!freshCi || !freshCi.accessToken) {
            console.warn(`[MeetingService] STEP 3 — No fresh data returned for "${ci.calendarId}"`);
            return;
          }

          // 4. Fetch events from Google Calendar using fresh accessToken and calendarId from backend
          console.debug(`[MeetingService] STEP 4 — fetching Google Calendar events for "${freshCi.calendarId}"`);
          const events = await this.fetchGoogleCalendarEvents(
            freshCi.calendarId,
            freshCi.accessToken,
            freshCi.agentName ?? ''
          );
          console.debug(`[MeetingService] STEP 4 — events fetched for "${freshCi.calendarId}":`, events);
          allEvents.push(...events);
        } catch (err) {
          console.error(`[MeetingService] Error processing calendar "${ci.calendarId}":`, err);
        }
      })
    );

    // Deduplicate by id
    const seen = new Set<string>();
    const unique = allEvents.filter(e => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });

    unique.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    this.cache = unique;
    return unique;
  }

  async getEventById(id: string): Promise<GoogleCalendarEvent | null> {
    const cached = this.cache.find(e => e.id === id);
    if (cached) return cached;

    const integrations = await this.getCalendarIntegrations();

    for (const ci of integrations) {
      try {
        const refreshResult = await this.refreshToken(ci.id);
        if (!refreshResult.success) continue;

        const freshCi = await this.getCalendarById(ci.id);
        if (!freshCi || !freshCi.accessToken) continue;

        const events = await this.fetchGoogleCalendarEvents(
          freshCi.calendarId,
          freshCi.accessToken,
          freshCi.agentName ?? ''
        );
        const found = events.find(e => e.id === id);
        if (found) return found;
      } catch (err) {
        console.error(`[MeetingService] Error searching event in calendar "${ci.calendarId}":`, err);
      }
    }
    return null;
  }

  // ─────────────────────────────────────────────
  // BACKEND CALLS
  // ─────────────────────────────────────────────

  private async getCalendarIntegrations(): Promise<CalendarIntegrationRef[]> {
    const data = await this.fetchData(
      'com.ajawmrp3.apps.prospectingai.web.MeetingController:getCalendars',
      {}
    );
    if (!data || data.error) throw new Error(data?.message ?? 'Error al obtener calendarios');
    return (data.calendars ?? []) as CalendarIntegrationRef[];
  }

  private async refreshToken(calendarIntegrationId: number): Promise<TokenRefreshResult> {
    try {
      const response = await fetchWithTimeout(
        `${this.apiConfig.refreshCalendarTokenUrl}?calendarId=${calendarIntegrationId}`,
        { method: 'GET' }
      );

      // Body may be empty (e.g. 200 OK with no content) — parse safely
      const text = await response.text();
      console.debug(`[MeetingService] STEP 2 — refresh raw response (${response.status}):`, text);

      if (!text || !text.trim()) {
        // Empty body — treat as success if HTTP status is 2xx
        if (response.ok) return { success: true, accessToken: '' };
        return { success: false, error: `http_${response.status}` };
      }

      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        // Not valid JSON but response was ok — treat as success
        if (response.ok) return { success: true, accessToken: '' };
        return { success: false, error: 'invalid_json_response' };
      }

      // Webhook responses:
      // { success: "true" }  — string "true"
      // { success: false, error: "..." }
      // { succes: false, error: "invalid_grant" } — note typo "succes" in webhook
      const isSuccess =
        data.success === true  || data.success === 'true' ||
        data.succes  === true  || data.succes  === 'true';

      if (isSuccess) return { success: true, accessToken: '' };

      const error: string = data.error ?? 'unknown_error';
      return { success: false, error, isExpired: error === 'invalid_grant' };
    } catch (err: any) {
      return { success: false, error: err.message ?? 'network_error' };
    }
  }

  private async getCalendarById(id: number): Promise<CalendarIntegrationRef | null> {
    const data = await this.fetchData(
      'com.ajawmrp3.apps.prospectingai.web.MeetingController:getCalendarById',
      { _id: id }
    );
    console.debug('[MeetingService] STEP 3 — raw getCalendarById response:', JSON.stringify(data));
    if (!data || data.error) return null;
    return {
      id:          data.id,
      calendarId:  data.calendarId,
      accessToken: data.accessToken,
      agentName:   data.agentName ?? null
    };
  }

  // ─────────────────────────────────────────────
  // AXELOR ACTION HELPER
  // ─────────────────────────────────────────────

  private async fetchData(action: string, data: any): Promise<any> {
    const token = localStorage.getItem('csrfToken');
    if (!token) throw new Error('No authentication token found');

    const response = await fetchWithTimeout(`${this.apiConfig.baseUrl}/ws/action`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': token
      },
      body: JSON.stringify({ action, data })
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const result = await response.json();
    if (result.error) throw new Error(result.error.message ?? 'Unknown error');
    return result.data;
  }

  // ─────────────────────────────────────────────
  // GOOGLE CALENDAR API
  // ─────────────────────────────────────────────

  private async fetchGoogleCalendarEvents(
    calendarId: string,
    accessToken: string,
    agentName: string
  ): Promise<GoogleCalendarEvent[]> {
    // Fetch from today until 60 days ahead
    const now    = new Date();
    const today  = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const maxDay = new Date(today); maxDay.setDate(maxDay.getDate() + 60);

    const timeMin = today.toISOString().replace(/\.\d{3}Z$/, '.000Z');
    const timeMax = new Date(maxDay.getFullYear(), maxDay.getMonth(), maxDay.getDate(), 23, 59, 59)
                      .toISOString().replace(/\.\d{3}Z$/, '.000Z');

    const baseUrl = this.apiConfig.googleCalendarEventsUrl.replace('{calendarId}', encodeURIComponent(calendarId));
    const params  = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: 'true',
      orderBy:      'startTime',
      maxResults:   '250'
    });
    const url = `${baseUrl}?${params.toString()}`;
    console.debug(`[MeetingService] STEP 4 — Google API URL: ${url}`);

    const response = await fetchWithTimeout(url, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Google Calendar API error ${response.status}: ${errBody}`);
    }

    const data = await response.json();
    console.debug(`[MeetingService] STEP 4 — Raw Google API response:`, data);
    const items: any[] = data.items ?? [];

    return items
      .filter(item => item.status !== 'cancelled')
      .map((item): GoogleCalendarEvent => {
        const startTime = item.start?.dateTime ?? item.start?.date ?? '';
        const endTime   = item.end?.dateTime   ?? item.end?.date   ?? '';

        // Extract meeting URL from conferenceData or location
        let meetingUrl: string | undefined;
        if (item.conferenceData?.entryPoints) {
          const videoEntry = item.conferenceData.entryPoints.find(
            (ep: any) => ep.entryPointType === 'video'
          );
          if (videoEntry) meetingUrl = videoEntry.uri;
        }
        if (!meetingUrl && typeof item.location === 'string' && item.location.startsWith('http')) {
          meetingUrl = item.location;
        }

        // Build attendees
        const attendees: GoogleAttendee[] = (item.attendees ?? []).map((att: any): GoogleAttendee => ({
          name:           att.displayName ?? att.email,
          email:          att.email,
          attendeeStatus: this.mapGoogleResponseStatus(att.responseStatus),
          role:           att.organizer ? 'owner' : 'attendee'
        }));

        // Ensure organizer is in attendees list
        if (item.organizer) {
          const orgEmail = item.organizer.email;
          const orgIdx = attendees.findIndex(a => a.email === orgEmail);
          if (orgIdx === -1) {
            attendees.unshift({
              name:           item.organizer.displayName ?? orgEmail,
              email:          orgEmail,
              attendeeStatus: 'accepted',
              role:           'owner'
            });
          } else {
            attendees[orgIdx].role = 'owner';
          }
        }

        return {
          id:          item.id,
          uid:         item.id, // alias
          title:       item.summary ?? '(Sin título)',
          description: item.description,
          startTime,
          endTime,
          updatedAt:   item.updated,
          status:      item.status ?? 'confirmed',
          location:    (typeof item.location === 'string' && !item.location.startsWith('http'))
                         ? item.location : undefined,
          meetingUrl,
          timeZone:    item.start?.timeZone,
          attendees,
          organizer:   {
            name:  item.organizer?.displayName ?? agentName,
            email: item.organizer?.email ?? ''
          },
          agentName,
          calendarId
        };
      });
  }

  private mapGoogleResponseStatus(status: string): 'accepted' | 'pending' | 'declined' | 'tentative' {
    const map: Record<string, 'accepted' | 'pending' | 'declined' | 'tentative'> = {
      accepted:    'accepted',
      declined:    'declined',
      tentative:   'tentative',
      needsAction: 'pending'
    };
    return map[status] ?? 'pending';
  }

  // ─────────────────────────────────────────────
  // GROUPING & FILTERS (same logic as before)
  // ─────────────────────────────────────────────

  groupMeetings(meetings: GoogleCalendarEvent[]): MeetingGroup[] {
    const { todayStart, tomorrowStart, dayAfterTomorrow } = this.getDateBoundaries();
    const groups: MeetingGroup[] = [];
    const today    = meetings.filter(m => { const s = new Date(m.startTime); return s >= todayStart    && s < tomorrowStart;    });
    const tomorrow = meetings.filter(m => { const s = new Date(m.startTime); return s >= tomorrowStart && s < dayAfterTomorrow; });
    const upcoming = meetings.filter(m => new Date(m.startTime) >= dayAfterTomorrow);
    if (today.length)    groups.push({ label: 'Hoy',      tag: 'today',    meetings: today    });
    if (tomorrow.length) groups.push({ label: 'Mañana',   tag: 'tomorrow', meetings: tomorrow });
    if (upcoming.length) groups.push({ label: 'Próximas', tag: 'upcoming', meetings: upcoming });
    return groups;
  }

  getUpcomingMeetings(meetings: GoogleCalendarEvent[]): GoogleCalendarEvent[] {
    const { todayStart, dayAfterTomorrow } = this.getDateBoundaries();
    return meetings.filter(m => {
      const s = new Date(m.startTime);
      return s >= todayStart && s < dayAfterTomorrow;
    });
  }

  isHappeningNow(m: GoogleCalendarEvent): boolean {
    const now = Date.now();
    return new Date(m.startTime).getTime() <= now && now <= new Date(m.endTime).getTime();
  }

  isSoon(m: GoogleCalendarEvent): boolean {
    const mins = this.minutesUntil(m.startTime);
    return mins > 0 && mins <= 30;
  }

  minutesUntil(dateStr: string): number {
    return Math.round((new Date(dateStr).getTime() - Date.now()) / 60000);
  }

  getDuration(start: string, end: string): string {
    const diff = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
    if (diff >= 60) {
      const h = Math.floor(diff / 60);
      const m = diff % 60;
      return m > 0 ? `${h}h ${m}min` : `${h}h`;
    }
    return `${diff} min`;
  }

  formatTime(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString('es-CO', {
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  }

  formatShortDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('es-CO', {
      weekday: 'short', day: 'numeric', month: 'short'
    });
  }

  formatFullDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('es-CO', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  formatLongDateTime(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('es-CO', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  }

  private getDateBoundaries() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(todayStart); tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const dayAfterTomorrow = new Date(tomorrowStart); dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
    return { todayStart, tomorrowStart, dayAfterTomorrow };
  }
}