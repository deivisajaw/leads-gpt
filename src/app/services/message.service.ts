import { Injectable, inject } from '@angular/core';
import { ApiConfigService } from './api-config.service';
import { fetchWithTimeout } from './http-timeout';

// ─────────────────────────────────────────────────────────────────────────────
// INTERFACES
// ─────────────────────────────────────────────────────────────────────────────

export interface ChatwootInbox {
  id: number;
  name: string;
  channel_type: string;
  phone_number: string | null;
  avatar_url: string;
  webhook_url: string | null;
}

export interface ChatwootContact {
  id: number;
  name: string;
  email: string | null;
  phone_number: string | null;
  avatar_url: string;
}

export interface ChatwootMessage {
  id: number;
  content: string;
  message_type: number; // 0=incoming, 1=outgoing, 2=activity
  created_at: number;
  sender: { name: string; avatar_url: string } | null;
  conversation_id?: number;
}

export interface ChatwootConversation {
  id: number;
  inbox_id: number;
  status: 'open' | 'resolved' | 'pending' | 'snoozed';
  created_at: number;
  updated_at: number;
  unread_count: number;
  contact: ChatwootContact;
  last_message: ChatwootMessage | null;
}

export interface ContactConversationGroup {
  contact: ChatwootContact;
  conversations: ChatwootConversation[];
  lastActivity: number;
  totalUnread: number;
}

// legacy
export interface Conversation {
  id: string; title: string; date: string; durationSeconds: number;
  status: 'completed' | 'processing' | 'failed';
  participants: any[];
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE
// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class MessageService {

  private apiConfig = inject(ApiConfigService);

  // accountId y apiKey resueltos una sola vez
  private chatwootAccountId: number | null = null;
  private chatwootApiKey: string | null = null;

  // legacy
  async getConversationById(id: string): Promise<Conversation | null> { return null; }

  // ── Inicializar credenciales desde el backend ─────────────────────────────

  async initChatwootCredentials(): Promise<boolean> {
    // 1. Obtener agentes del backend — solo necesitamos el chatwootApiKey de uno
    const raw = await this.fetchData(
      'com.ajawmrp3.apps.prospectingai.web.ConversationController:getAgentsForConversations', {}
    );
    console.log(raw)
    const agents: any[] = raw?.agents ?? [];
    if (agents.length === 0) return false;

    const apiKey = agents[0].chatwootApiKey;
    if (!apiKey) return false;

    // 2. Llamar a /profile con ese apiKey para obtener el accountId
    const resp = await fetchWithTimeout(this.apiConfig.chatwootProfileUrl, {
      method: 'GET',
      headers: { 'api_access_token': apiKey }
    });
    if (!resp.ok) throw new Error(`Profile HTTP ${resp.status}`);
    const profile = await resp.json();
    const accountId: number = profile?.account_id ?? profile?.accounts?.[0]?.id;
    if (!accountId) throw new Error('accountId not found in profile');

    this.chatwootApiKey    = apiKey;
    this.chatwootAccountId = accountId;
    return true;
  }

  // ── Inboxes — se muestran como "canales" en la UI ─────────────────────────

  async getInboxes(): Promise<ChatwootInbox[]> {
    this.ensureCredentials();
    const url = `${this.apiConfig.chatwootBaseUrl}/api/v1/accounts/${this.chatwootAccountId}/inboxes`;
    const resp = await fetchWithTimeout(url, {
      method: 'GET',
      headers: { 'api_access_token': this.chatwootApiKey! }
    });
    if (!resp.ok) throw new Error(`Inboxes HTTP ${resp.status}`);
    const data = await resp.json();
    return (data?.payload ?? []).map((i: any) => ({
      id:           i.id,
      name:         i.name,
      channel_type: i.channel_type,
      phone_number: i.phone_number ?? null,
      avatar_url:   i.avatar_url ?? '',
      webhook_url:  i.webhook_url ?? null
    }));
  }

  // ── Conversaciones filtradas por inbox_id ─────────────────────────────────

  async getConversationsGroupedByContact(
    inboxId: number,
    status: 'open' | 'resolved' | 'pending' | 'all' = 'all',
    page = 1
  ): Promise<ContactConversationGroup[]> {
    this.ensureCredentials();

    const url = `${this.apiConfig.chatwootBaseUrl}/api/v1/accounts/${this.chatwootAccountId}/conversations/filter?page=${page}`;

    const body = {
      payload: [
        {
          attribute_key:   'inbox_id',
          filter_operator: 'equal_to',
          values:          [String(inboxId)],
          query_operator:  null
        },
        ...(status !== 'all' ? [{
          attribute_key:   'status',
          filter_operator: 'equal_to',
          values:          [status],
          query_operator:  'AND'
        }] : [])
      ]
    };

    const resp = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'api_access_token': this.chatwootApiKey!
      },
      body: JSON.stringify(body)
    });

    if (!resp.ok) throw new Error(`Filter conversations HTTP ${resp.status}`);
    const data = await resp.json();
    const payload: any[] = data?.payload ?? [];

    const conversations: ChatwootConversation[] = payload.map((c: any) => ({
      id:           c.id,
      inbox_id:     c.inbox_id,
      status:       c.status,
      created_at:   c.created_at,
      updated_at:   c.updated_at,
      unread_count: c.unread_count ?? 0,
      contact: {
        id:           c.meta?.sender?.id ?? 0,
        name:         c.meta?.sender?.name ?? 'Unknown',
        email:        c.meta?.sender?.email ?? null,
        phone_number: c.meta?.sender?.phone_number ?? null,
        avatar_url:   c.meta?.sender?.thumbnail ?? ''
      },
      last_message: c.last_non_activity_message ? {
        id:           c.last_non_activity_message.id,
        content:      c.last_non_activity_message.content ?? '',
        message_type: c.last_non_activity_message.message_type,
        created_at:   c.last_non_activity_message.created_at,
        sender:       c.last_non_activity_message.sender
          ? { name: c.last_non_activity_message.sender.name, avatar_url: c.last_non_activity_message.sender.avatar_url ?? '' }
          : null
      } : null
    }));

    return this.groupByContact(conversations);
  }

  // ── Mensajes de un contacto (todas sus convs en el inbox) ─────────────────

  async getMessagesForContact(
    group: ContactConversationGroup
  ): Promise<ChatwootMessage[]> {
    this.ensureCredentials();

    const results = await Promise.allSettled(
      group.conversations.map(conv => this.fetchConversationMessages(conv.id))
    );

    const all: ChatwootMessage[] = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        all.push(...r.value.map(m => ({ ...m, conversation_id: group.conversations[i].id })));
      }
    });

    return all.sort((a, b) => a.created_at - b.created_at);
  }

  private async fetchConversationMessages(conversationId: number): Promise<ChatwootMessage[]> {
    const url = `${this.apiConfig.chatwootBaseUrl}/api/v1/accounts/${this.chatwootAccountId}/conversations/${conversationId}/messages`;
    const resp = await fetchWithTimeout(url, {
      method: 'GET',
      headers: { 'api_access_token': this.chatwootApiKey! }
    });
    if (!resp.ok) throw new Error(`Messages HTTP ${resp.status}`);
    const data = await resp.json();
    return (data?.payload ?? []).map((m: any) => ({
      id:           m.id,
      content:      m.content ?? '',
      message_type: m.message_type,
      created_at:   m.created_at,
      sender: m.sender ? { name: m.sender.name, avatar_url: m.sender.avatar_url ?? '' } : null
    }));
  }

  /** Cambia el estado de una conversación en Chatwoot (resolved / open / pending). */
  async setConversationStatus(conversationId: number, status: 'resolved' | 'open' | 'pending'): Promise<void> {
    this.ensureCredentials();
    const url = `${this.apiConfig.chatwootBaseUrl}/api/v1/accounts/${this.chatwootAccountId}/conversations/${conversationId}/toggle_status`;
    const resp = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api_access_token': this.chatwootApiKey!
      },
      body: JSON.stringify({ status })
    });
    if (!resp.ok) throw new Error(`Toggle status HTTP ${resp.status}`);
  }

  private groupByContact(conversations: ChatwootConversation[]): ContactConversationGroup[] {
    const map = new Map<number, ContactConversationGroup>();
    for (const conv of conversations) {
      const cid = conv.contact.id;
      if (!map.has(cid)) {
        map.set(cid, { contact: conv.contact, conversations: [], lastActivity: 0, totalUnread: 0 });
      }
      const g = map.get(cid)!;
      g.conversations.push(conv);
      if (conv.updated_at > g.lastActivity) g.lastActivity = conv.updated_at;
      g.totalUnread += conv.unread_count;
    }
    return Array.from(map.values()).sort((a, b) => b.lastActivity - a.lastActivity);
  }

  private ensureCredentials() {
    if (!this.chatwootAccountId || !this.chatwootApiKey) {
      throw new Error('Chatwoot credentials not initialized. Call initChatwootCredentials() first.');
    }
  }

  // ── Formatters ─────────────────────────────────────────────────────────

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es-CO', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  }

  formatUnix(unixTs: number): string {
    return this.formatDate(new Date(unixTs * 1000).toISOString());
  }

  formatUnixShort(unixTs: number): string {
    const d = new Date(unixTs * 1000);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0) return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7)  return d.toLocaleDateString('es-CO', { weekday: 'short' });
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
  }

  formatDuration(seconds: number): string {
    if (!seconds || seconds <= 0) return '—';
    const m = Math.floor(seconds / 60);
    const h = Math.floor(m / 60);
    return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
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
    const palette = ['#5b4fe5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return palette[Math.abs(hash) % palette.length];
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      open: 'Abierta', resolved: 'Resuelta', pending: 'Pendiente', snoozed: 'Pospuesta'
    };
    return map[status] ?? status;
  }

  statusClass(status: string): string {
    const map: Record<string, string> = {
      open: 'status-open', resolved: 'status-resolved',
      pending: 'status-pending', snoozed: 'status-snoozed'
    };
    return map[status] ?? '';
  }

  private async fetchData(action: string, data: any): Promise<any> {
    const token = localStorage.getItem('csrfToken');
    if (!token) throw new Error('No authentication token found');
    const response = await fetchWithTimeout(`${this.apiConfig.baseUrl}/ws/action`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
      body: JSON.stringify({ action, data }),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const result = await response.json();
    if (result.error) throw new Error(result.error.message || 'Unknown error');
    return result.data;
  }
}