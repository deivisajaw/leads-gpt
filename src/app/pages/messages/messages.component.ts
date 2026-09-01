import { Component, OnInit, OnDestroy, inject, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DealsService, Deal } from '../../services/deals.service';
import {
  MessageService,
  ChatwootInbox,
  ChatwootMessage,
  ContactConversationGroup
} from '../../services/message.service';


export type GroupWithInbox = ContactConversationGroup & {
  inboxId: number;
  inboxName: string;
  channelKey: string;
};

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TranslateModule],
  templateUrl: './messages.component.html',
  styleUrl: './messages.component.css'
})
export class MessagesComponent implements OnInit, OnDestroy {

  @ViewChild('inboxScroll') inboxScrollRef!: ElementRef<HTMLDivElement>;

  public svc = inject(MessageService);
  private i18n = inject(TranslateService);
  private dealsSvc = inject(DealsService);

  // ── State ─────────────────────────────────────────────────────────────────
  isLoadingInit  = true;
  isLoadingConvs = false;
  isLoadingMsgs  = false;
  initError:  string | null = null;
  convError:  string | null = null;
  noChannels = false;
  showContext = true;

  inboxes:       ChatwootInbox[]            = [];
  selectedInbox: ChatwootInbox | null       = null;

  contactGroups:  GroupWithInbox[] = [];
  filteredGroups: GroupWithInbox[] = [];
  selectedGroup:  GroupWithInbox | null = null;

  // deals emparejados por teléfono/email para mostrar el valor de cada chat
  private dealsByKey = new Map<string, Deal>();
  /** Dígitos completos del teléfono del trato, para descartar falsos positivos. */
  private dealPhoneFull = new Map<string, string>();

  // progreso, racha e historial
  resolvedToday = 0;
  streak = 0;
  bestDayCount = 0;
  bestDayLabel = '';
  week: Array<{ label: string; count: number; today: boolean }> = [];
  showStreakPanel = false;
  soundOn = true;
  private readonly statsKey = 'ajawInboxStats';

  // celebración al resolver
  celebrating = false;
  celebrationText = '';
  confetti: Array<{ dx: number; dy: number; delay: number; dur: number;
                    rot: number; w: number; h: number; color: string; round: boolean }> = [];
  resolvingKey: string | null = null;

  // llegada de mensajes nuevos
  private pollId: any = null;
  newSinceLastLook = 0;

  allMode = true;                 // "Todos los canales" activo
  failedInboxes: string[] = [];   // canales que no respondieron

  messages: ChatwootMessage[] = [];

  searchQuery  = '';
  statusFilter: 'all' | 'open' | 'resolved' | 'pending' = 'all';

  // ── AI / HUMANO — mismo concepto que el label en Chatwoot ──
  // Al pasar a Humano se pausa el agente y la conversación queda asignada a la persona.
  aiPaused = new Set<string>();
  assignedTo = new Map<string, string>();

  isAiOn(key?: string): boolean {
    return !!key && !this.aiPaused.has(key);
  }

  toggleAi(key?: string, humanName = 'Giuliano Gomez'): void {
    if (!key) return;
    if (this.aiPaused.has(key)) {
      this.aiPaused.delete(key);
      this.assignedTo.delete(key);
    } else {
      this.aiPaused.add(key);
      this.assignedTo.set(key, humanName);
    }
  }

  assignedName(key?: string): string {
    return (key && this.assignedTo.get(key)) || '';
  }

  countByStatus(status: 'open' | 'pending' | 'resolved'): number {
    return this.contactGroups.filter(g => this.getFirstStatus(g) === status).length;
  }

  agentInitial(name?: string): string {
    return (name ?? '?').charAt(0).toUpperCase();
  }

  agentColor(name?: string): string {
    if (name === 'Anna')    return '#d6249f';   // Instagram
    if (name === 'Manacor') return '#5b4fe5';   // SMS
    return '#25d366';                            // WhatsApp
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  async ngOnInit() {
    this.isLoadingInit = true;
    this.initError = null;
    this.noChannels = false;
    try {
      const hasCredentials = await this.svc.initChatwootCredentials();
      if (!hasCredentials) {
        this.noChannels = true;
        return;
      }
      this.inboxes = await this.svc.getInboxes();
      if (this.inboxes.length === 0) {
        this.noChannels = true;
        return;
      }
      await this.selectAllInboxes();
      this.loadProgress();
      try { this.soundOn = localStorage.getItem('ajawInboxSound') !== '0'; } catch { /* noop */ }
      this.loadDeals();
      this.startLivePolling();
    } catch (e: any) {
      this.initError = e.message || 'Error al inicializar';
    } finally {
      this.isLoadingInit = false;
    }
  }

  // ── Inbox selection ───────────────────────────────────────────────────────

  scrollInboxes(dir: 'left' | 'right') {
    const el = this.inboxScrollRef?.nativeElement;
    if (el) el.scrollBy({ left: dir === 'right' ? 200 : -200, behavior: 'smooth' });
  }

  async selectAllInboxes() {
    this.allMode = true;
    this.selectedInbox = null;
    this.selectedGroup = null;
    this.messages = [];
    this.searchQuery = '';
    await this.loadConversations();
  }

  async selectInbox(inbox: ChatwootInbox) {
    if (!this.allMode && this.selectedInbox?.id === inbox.id) return;
    this.allMode = false;
    this.selectedInbox  = inbox;
    this.contactGroups  = [];
    this.filteredGroups = [];
    this.selectedGroup  = null;
    this.messages       = [];
    this.searchQuery    = '';
    await this.loadConversations();
  }

  // ── Conversations ─────────────────────────────────────────────────────────

  async loadConversations(silent = false) {
    if (!this.allMode && !this.selectedInbox) return;

    if (!silent) this.isLoadingConvs = true;
    this.convError = null;
    this.failedInboxes = [];
    if (!silent) {
      this.contactGroups  = [];
      this.filteredGroups = [];
      this.selectedGroup  = null;
      this.messages       = [];
    }

    // qué canales consultar: todos, o solo el elegido
    const targets = this.allMode ? this.inboxes : [this.selectedInbox!];

    try {
      // Siempre pedimos 'all' y filtramos localmente para que los contadores
      // de cada pestaña sean reales. Un canal caído no tumba la bandeja.
      const results = await Promise.allSettled(
        targets.map(inbox => this.svc.getConversationsGroupedByContact(inbox.id, 'all'))
      );

      const merged: GroupWithInbox[] = [];
      results.forEach((r, i) => {
        const inbox = targets[i];
        if (r.status === 'fulfilled') {
          r.value.forEach(g => merged.push({
            ...g,
            inboxId: inbox.id,
            inboxName: inbox.name,
            channelKey: this.inboxChannelKey(inbox)
          }));
        } else {
          this.failedInboxes.push(inbox.name);
        }
      });

      merged.sort((a, b) => b.lastActivity - a.lastActivity);
      this.contactGroups = merged;

      // solo es error total si NINGÚN canal respondió
      if (merged.length === 0 && this.failedInboxes.length === targets.length) {
        this.convError = 'Ningún canal respondió';
      }
      this.applyFilter();
    } catch (e: any) {
      this.convError = e.message || 'Error al cargar conversaciones';
    } finally {
      this.isLoadingConvs = false;
    }
  }

  onStatusChange(status: 'all' | 'open' | 'resolved' | 'pending') {
    this.statusFilter = status;
    this.applyFilter();
  }

  onSearch(event: Event) {
    this.searchQuery = (event.target as HTMLInputElement).value;
    this.applyFilter();
  }

  applyFilter() {
    let list = this.contactGroups;

    if (this.statusFilter !== 'all') {
      list = list.filter(g => this.getFirstStatus(g) === this.statusFilter);
    }

    const q = this.searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(g =>
        g.contact.name.toLowerCase().includes(q) ||
        (g.contact.email ?? '').toLowerCase().includes(q) ||
        (g.contact.phone_number ?? '').toLowerCase().includes(q) ||
        // permite filtrar rápido escribiendo el agente/canal: "129", "IG", "SMS"…
        g.inboxName.toLowerCase().includes(q) ||
        g.conversations.some(c => c.last_message?.content?.toLowerCase().includes(q))
      );
    }

    this.filteredGroups = list;
  }

  // ── Contact selection → messages ──────────────────────────────────────────

  /** El mismo contacto (ej. "WhatsApp connector") existe en varios canales,
   *  así que la identidad de una fila es canal + contacto, no solo el contacto. */
  /** Fotos de perfil que vienen de Chatwoot (meta.sender.thumbnail).
   *  Si una URL falla (expirada / 404) caemos a las iniciales. */
  private avatarFailed = new Set<string>();

  hasAvatar(url?: string | null): boolean {
    return !!url && url.trim() !== '' && !this.avatarFailed.has(url);
  }

  onAvatarError(url?: string | null): void {
    if (url) this.avatarFailed.add(url);
  }

  groupKey(g: GroupWithInbox | null): string {
    return g ? `${g.inboxId}:${g.contact.id}` : '';
  }

  isSelected(g: GroupWithInbox): boolean {
    return this.groupKey(this.selectedGroup) === this.groupKey(g);
  }

  async selectGroup(group: GroupWithInbox) {
    this.selectedGroup = group;
    this.messages = [];
    this.isLoadingMsgs = true;
    try {
      this.messages = await this.svc.getMessagesForContact(group);
    } catch (e: any) {
      console.error('Error loading messages:', e);
    } finally {
      this.isLoadingMsgs = false;
    }
  }

  ngOnDestroy() {
    if (this.pollId) clearTimeout(this.pollId);
  }

  // ── Deals: valor real de cada conversación ────────────────────────────────

  /** Solo dígitos. */
  private digits(v?: string | null): string {
    return (v ?? '').replace(/\D/g, '');
  }

  /**
   * Clave de teléfono para emparejar conversación ↔ trato.
   *
   * Usamos los últimos 10 dígitos porque el mismo contacto puede estar guardado
   * con o sin indicativo. Pero eso solo NO basta: +57 314 798 2468 (Colombia) y
   * +1 314 798 2468 (EE.UU.) terminan igual y mostrarían el trato equivocado.
   * Por eso, cuando ambos números traen indicativo, exigimos que coincida todo.
   */
  private norm(v?: string | null): string {
    const d = this.digits(v);
    return d.length >= 8 ? d.slice(-10) : '';   // números muy cortos no se indexan
  }

  private async loadDeals() {
    try {
      const deals = await this.dealsSvc.getDeals();
      deals.forEach(d => {
        const phone = this.norm(d.contact?.phone);
        const email = (d.contact?.email ?? '').toLowerCase().trim();
        if (phone) {
          this.dealsByKey.set('p:' + phone, d);
          this.dealPhoneFull.set('p:' + phone, this.digits(d.contact?.phone));
        }
        if (email) this.dealsByKey.set('e:' + email, d);
      });
    } catch { /* si falla, el chat simplemente no muestra valor */ }
  }

  dealFor(g: GroupWithInbox): Deal | undefined {
    const email = (g.contact.email ?? '').toLowerCase().trim();
    // el email es identificador fuerte: va primero
    const byEmail = email ? this.dealsByKey.get('e:' + email) : undefined;
    if (byEmail) return byEmail;

    const key = this.norm(g.contact.phone_number);
    if (!key) return undefined;
    const byPhone = this.dealsByKey.get('p:' + key);
    if (!byPhone) return undefined;

    // Si ambos números incluyen indicativo, tienen que coincidir completos.
    // Evita cruzar un +57 con un +1 que terminan en los mismos 10 dígitos.
    const full = this.digits(g.contact.phone_number);
    const dealFull = this.dealPhoneFull.get('p:' + key) ?? '';
    if (full.length > 10 && dealFull.length > 10 && full !== dealFull) return undefined;

    return byPhone;
  }

  dealAmount(g: GroupWithInbox): string | null {
    const d = this.dealFor(g);
    if (!d?.amount) return null;
    return '$' + Number(d.amount).toLocaleString('es-CO');
  }

  /** Suma del pipeline visible en la bandeja — el número que motiva. */
  get pipelineValue(): string {
    const total = this.filteredGroups.reduce((sum, g) => {
      const d = this.dealFor(g);
      return sum + (d?.amount ? Number(d.amount) : 0);
    }, 0);
    return '$' + total.toLocaleString('es-CO');
  }

  // ── Progreso del día ──────────────────────────────────────────────────────

  private dayKey(d = new Date()): string {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  private readStats(): { days: Record<string, number> } {
    try { const raw = localStorage.getItem(this.statsKey); if (raw) return JSON.parse(raw); }
    catch { /* modo privado */ }
    return { days: {} };
  }

  private writeStats(st: { days: Record<string, number> }) {
    try { localStorage.setItem(this.statsKey, JSON.stringify(st)); } catch { /* noop */ }
  }

  private loadProgress() {
    const st = this.readStats();
    this.resolvedToday = st.days[this.dayKey()] || 0;
    this.recomputeStats(st);
  }

  private bumpProgress() {
    const st = this.readStats();
    const k = this.dayKey();
    st.days[k] = (st.days[k] || 0) + 1;
    this.resolvedToday = st.days[k];
    this.writeStats(st);
    this.recomputeStats(st);
  }

  /** Racha = días consecutivos con al menos una resuelta. */
  private recomputeStats(st: { days: Record<string, number> }) {
    const days = st.days || {};
    let streak = 0;
    const cur = new Date();
    if (!days[this.dayKey(cur)]) cur.setDate(cur.getDate() - 1);
    while (days[this.dayKey(cur)]) { streak++; cur.setDate(cur.getDate() - 1); }
    this.streak = streak;

    let bk = '', bc = 0;
    Object.entries(days).forEach(([k, v]) => { if (v > bc) { bc = v; bk = k; } });
    this.bestDayCount = bc;
    this.bestDayLabel = bk ? new Date(bk + 'T12:00:00').toLocaleDateString('es-CO', { day:'numeric', month:'short' }) : '';

    const names = ['D','L','M','M','J','V','S'];
    const todayK = this.dayKey();
    this.week = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      const k = this.dayKey(d);
      return { label: names[d.getDay()], count: days[k] || 0, today: k === todayK };
    });
  }

  get weekTotal(): number { return this.week.reduce((s, d) => s + d.count, 0); }

  // ── Impacto real de la IA (lo que le importa a un equipo de ventas) ──

  /** Personas distintas que la IA está atendiendo en la bandeja. */
  get peopleHandled(): number {
    const ids = new Set(this.contactGroups.map(g => g.contact.id));
    return ids.size;
  }

  /** Conversaciones totales que lleva la IA. */
  get conversationsHandled(): number {
    return this.contactGroups.reduce((n, g) => n + g.conversations.length, 0);
  }

  /** Cuántas lleva un humano (IA en pausa) vs la IA. */
  get handledByHuman(): number {
    return this.contactGroups.filter(g => !this.isAiOn(this.groupKey(g))).length;
  }

  get handledByAi(): number {
    return Math.max(0, this.contactGroups.length - this.handledByHuman);
  }

  /** Tratos ganados que salieron de estas conversaciones (sin repetir). */
  private wonDeals(): Deal[] {
    const seen = new Map<number, Deal>();
    this.contactGroups.forEach(g => {
      const d = this.dealFor(g);
      if (d && d.stageType === 'won') seen.set(d.id, d);
    });
    return Array.from(seen.values());
  }

  get dealsWon(): number { return this.wonDeals().length; }

  get dealsWonValue(): string {
    const total = this.wonDeals().reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
    return '$' + total.toLocaleString('es-CO');
  }

  /** Estimación: ~15 min de trabajo humano por conversación atendida. */
  private readonly MIN_PER_CONV = 15;

  get hoursSaved(): string {
    const mins = this.conversationsHandled * this.MIN_PER_CONV;
    if (mins < 60) return `${mins} min`;
    const h = mins / 60;
    return `${h >= 10 ? Math.round(h) : h.toFixed(1)} h`;
  }

  get weekHoursSaved(): string {
    const mins = this.weekTotal * this.MIN_PER_CONV;
    if (mins < 60) return `${mins} min`;
    const h = mins / 60;
    return `${h >= 10 ? Math.round(h) : h.toFixed(1)} h`;
  }
  get weekMax(): number { return Math.max(1, ...this.week.map(d => d.count)); }

  toggleSound() {
    this.soundOn = !this.soundOn;
    try { localStorage.setItem('ajawInboxSound', this.soundOn ? '1' : '0'); } catch { /* noop */ }
  }

  // ── sonido sintetizado (sin archivos) ──
  private audioCtx: AudioContext | null = null;

  private tone(freq: number, at: number, dur: number, gain = 0.06, type: OscillatorType = 'sine') {
    if (!this.audioCtx) return;
    const ctx = this.audioCtx;
    const osc = ctx.createOscillator(), vol = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + at);
    vol.gain.setValueAtTime(0, ctx.currentTime + at);
    vol.gain.linearRampToValueAtTime(gain, ctx.currentTime + at + 0.012);
    vol.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + dur);
    osc.connect(vol); vol.connect(ctx.destination);
    osc.start(ctx.currentTime + at); osc.stop(ctx.currentTime + at + dur + 0.02);
  }

  private playSound(big: boolean) {
    if (!this.soundOn) return;
    try {
      this.audioCtx = this.audioCtx || new (window.AudioContext || (window as any).webkitAudioContext)();
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
      if (big) { this.tone(659.25,0,0.16,0.05); this.tone(783.99,0.09,0.16,0.05); this.tone(1046.5,0.18,0.30,0.055); }
      else { this.tone(880,0,0.09,0.035,'triangle'); }
    } catch { /* sin audio, seguimos */ }
  }

  // ── Live: entran conversaciones nuevas solas ──────────────────────────────

  /**
   * Sondeo con retroceso progresivo.
   *
   * Cada ciclo consulta TODOS los canales conectados (10 canales = 10 peticiones).
   * A 30 s fijos serían ~1.200 peticiones/hora por pestaña abierta contra
   * chat.ajaw.ai. Con retroceso, una bandeja tranquila baja a una consulta cada
   * 4 min; en cuanto entra algo nuevo vuelve al ritmo rápido.
   */
  private readonly POLL_MIN = 45_000;
  private readonly POLL_MAX = 240_000;
  private pollEvery = this.POLL_MIN;

  private startLivePolling() {
    if (this.pollId) clearTimeout(this.pollId);
    const tick = async () => {
      await this.checkForNew();
      this.pollId = setTimeout(tick, this.pollEvery);
    };
    this.pollId = setTimeout(tick, this.pollEvery);
  }

  private async checkForNew() {
    // si la pestaña está en segundo plano no gastamos peticiones
    if (this.isLoadingConvs || document.hidden) return;

    const known = new Set(this.contactGroups.map(g => this.groupKey(g)));
    await this.loadConversations(true);
    const fresh = this.contactGroups.filter(g => !known.has(this.groupKey(g)));

    if (fresh.length > 0) {
      fresh.forEach(g => (g as any).isNew = true);
      this.newSinceLastLook += fresh.length;
      setTimeout(() => fresh.forEach(g => (g as any).isNew = false), 6000);
      this.pollEvery = this.POLL_MIN;                       // hay movimiento → rápido
    } else {
      this.pollEvery = Math.min(this.pollEvery * 1.5, this.POLL_MAX);  // silencio → más lento
    }
  }

  clearNewFlag() { this.newSinceLastLook = 0; }

  // ── Resolver / reabrir ────────────────────────────────────────────────────

  isResolving = false;

  /** Marca como resuelta (o reabre) TODAS las conversaciones del contacto en ese canal. */
  async toggleResolved(group: GroupWithInbox) {
    if (this.isResolving) return;
    const resolving = this.getFirstStatus(group) !== 'resolved';
    const next: 'resolved' | 'open' = resolving ? 'resolved' : 'open';

    this.isResolving = true;
    this.resolvingKey = this.groupKey(group);
    try {
      await Promise.all(
        group.conversations.map(c => this.svc.setConversationStatus(c.id, next))
      );
      // reflejamos el cambio localmente para no recargar toda la bandeja
      group.conversations.forEach(c => c.status = next);
      if (next === 'resolved') {
        group.totalUnread = 0;
        (group as any).justResolved = true;
        this.bumpProgress();
        this.celebrate(group);
        setTimeout(() => { (group as any).justResolved = false; this.applyFilter(); }, 600);
      }
      this.applyFilter();
    } catch (e: any) {
      this.convError = e.message || this.i18n.instant('MESSAGES.ACTION_FAILED');
    } finally {
      this.isResolving = false;
      this.resolvingKey = null;
    }
  }

  /** Papelitos: se generan una vez por celebración, sin librerías. */
  /** Estallido corto alrededor de la pastilla (no ocupa la pantalla). */
  private makeConfetti(n = 20) {
    const palette = ['#7871fb', '#251f95', '#34d399', '#f7ca5e', '#ec4899', '#38bdf8', '#fb923c'];
    this.confetti = Array.from({ length: n }, (_, i) => {
      const angle = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;  // reparto radial
      const dist  = 48 + Math.random() * 58;   // radio corto, discreto
      return {
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist * 0.7 - 12,    // apenas hacia arriba
        delay: Math.random() * 0.08,
        dur: 0.75 + Math.random() * 0.35,
        rot: (Math.random() - 0.5) * 700,
        w: 3 + Math.random() * 2,
        h: 7 + Math.random() * 5,
        color: palette[i % palette.length],
        round: Math.random() > 0.85
      };
    });
  }

  /** Resolver es frecuente: feedback corto siempre, confeti solo en hitos. */
  private celebrate(group: GroupWithInbox) {
    const amount = this.dealAmount(group);
    const pending = this.contactGroups.filter(g => this.getFirstStatus(g) !== 'resolved').length;

    const isFirstOfDay = this.resolvedToday === 1;
    const isTenth      = this.resolvedToday % 10 === 0;
    const isInboxZero  = pending === 0;
    const hasMoney     = !!this.dealFor(group)?.amount;
    // recompensa variable: además de los hitos, a veces cae de sorpresa.
    // Lo impredecible es lo que mantiene vivo el efecto.
    const surprise     = Math.random() < 0.22;
    const bigMoment    = isInboxZero || isFirstOfDay || isTenth || hasMoney || surprise;

    const t = (k: string, p?: any) => this.i18n.instant('MESSAGES.' + k, p);

    if (isInboxZero)             this.celebrationText = t('CEL_INBOX_ZERO', { count: this.resolvedToday });
    else if (hasMoney && amount) this.celebrationText = t('CEL_MONEY', { amount, count: this.resolvedToday });
    else if (isTenth)            this.celebrationText = t('CEL_TENTH', { count: this.resolvedToday });
    else if (isFirstOfDay)       this.celebrationText = t('CEL_FIRST');
    else if (surprise) {
      const wins = ['WIN_1','WIN_2','WIN_3','WIN_4'];
      this.celebrationText = t('CEL_DEFAULT', {
        cheer: t(wins[Math.floor(Math.random() * wins.length)]),
        count: this.resolvedToday
      });
    }
    else {
      const cheers = ['CHEER_1','CHEER_2','CHEER_3','CHEER_4'];
      this.celebrationText = t('CEL_DEFAULT', {
        cheer: t(cheers[this.resolvedToday % cheers.length]),
        count: this.resolvedToday
      });
    }

    if (bigMoment) this.makeConfetti(isInboxZero ? 28 : 20);
    else this.confetti = [];
    this.playSound(bigMoment);

    this.celebrating = true;
    setTimeout(() => { this.celebrating = false; this.confetti = []; }, bigMoment ? 2600 : 1600);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  totalConversations(): number {
    return this.contactGroups.reduce((s, g) => s + g.conversations.length, 0);
  }

  totalUnread(): number {
    return this.contactGroups.reduce((s, g) => s + g.totalUnread, 0);
  }

  hasUnread(group: GroupWithInbox): boolean {
    return group.totalUnread > 0;
  }

  getLastMessagePreview(group: GroupWithInbox): string {
    const last = [...group.conversations].sort((a, b) => b.updated_at - a.updated_at)[0];
    return last?.last_message?.content || 'Sin mensajes';
  }

  getFirstStatus(group: GroupWithInbox): string {
    return group.conversations.find(c => c.status === 'open')?.status
      ?? group.conversations[0]?.status ?? 'open';
  }

  getConvStatusSummary(group: GroupWithInbox): string {
    const counts: Record<string, number> = {};
    group.conversations.forEach(c => counts[c.status] = (counts[c.status] || 0) + 1);
    return Object.entries(counts).map(([s, n]) => `${n} ${this.svc.statusLabel(s)}`).join(' · ');
  }

  channelIconByKey(key: string): string {
    if (key === 'whatsapp')  return 'fab fa-whatsapp';
    if (key === 'instagram') return 'fab fa-instagram';
    if (key === 'sms')       return 'fas fa-comment-sms';
    if (key === 'email')     return 'fas fa-envelope';
    if (key === 'web')       return 'fas fa-globe';
    return 'fas fa-comments';
  }

  /**
   * En Chatwoot casi todos los inboxes llegan como "Channel::Api", así que el
   * canal real se deduce del nombre del inbox (AjawAI 129 WA, AjawAI IG, ... SMS).
   */
  inboxChannelKey(inbox: ChatwootInbox | null): string {
    const t = inbox?.channel_type ?? '';
    const n = (inbox?.name ?? '').toUpperCase();

    if (t.includes('Instagram') || /\bIG\b|INSTAGRAM/.test(n)) return 'instagram';
    if (t.includes('Whatsapp')  || /\bWA\b|WHATSAPP/.test(n))  return 'whatsapp';
    if (t.includes('Sms') || t.includes('Twilio') || /\bSMS\b/.test(n)) return 'sms';
    if (t.includes('Email')) return 'email';
    if (t.includes('Web'))   return 'web';
    return 'whatsapp';
  }

  /** "AjawAI 129 WA" -> "129" · "AjawAI IG" -> "IG" · "AjawAI SMS" -> "SMS" */
  inboxShortLabel(inbox: ChatwootInbox): string {
    const raw = (inbox.name ?? '').replace(/ajaw\s*ai/ig, '').trim();
    const tokens = raw.split(/[\s\-_]+/).filter(Boolean);
    const num = tokens.find(t => /^\d+$/.test(t));
    if (num) return num;
    const word = tokens.find(t => /^[A-Za-z]+$/.test(t));
    if (word) return word.slice(0, 3).toUpperCase();
    return (inbox.name ?? '?').charAt(0).toUpperCase();
  }

  channelLabel(key: string): string {
    if (key === 'instagram') return 'Instagram';
    if (key === 'whatsapp')  return 'WhatsApp';
    if (key === 'sms')       return 'SMS';
    if (key === 'email')     return 'Email';
    if (key === 'web')       return 'Web';
    return 'Canal';
  }

  inboxChannelIcon(inbox: ChatwootInbox | null): string {
    if (!inbox) return 'fas fa-comments';
    if (inbox.channel_type?.includes('Whatsapp')) return 'fab fa-whatsapp';
    if (inbox.channel_type?.includes('Instagram')) return 'fab fa-instagram';
    if (inbox.channel_type?.includes('Sms'))      return 'fas fa-comment-sms';
    if (inbox.channel_type?.includes('Api'))      return 'fas fa-plug';
    if (inbox.channel_type?.includes('Email'))    return 'fas fa-envelope';
    if (inbox.channel_type?.includes('Web'))      return 'fas fa-globe';
    return 'fas fa-comments';
  }
}
