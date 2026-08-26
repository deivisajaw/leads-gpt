import { Component, OnInit, inject, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import {
  MessageService,
  ChatwootInbox,
  ChatwootMessage,
  ContactConversationGroup
} from '../../services/message.service';

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './messages.component.html',
  styleUrl: './messages.component.css'
})
export class MessagesComponent implements OnInit {

  @ViewChild('inboxScroll') inboxScrollRef!: ElementRef<HTMLDivElement>;

  public svc = inject(MessageService);

  // ── State ─────────────────────────────────────────────────────────────────
  isLoadingInit  = true;
  isLoadingConvs = false;
  isLoadingMsgs  = false;
  initError:  string | null = null;
  convError:  string | null = null;

  inboxes:       ChatwootInbox[]            = [];
  selectedInbox: ChatwootInbox | null       = null;

  contactGroups:  ContactConversationGroup[] = [];
  filteredGroups: ContactConversationGroup[] = [];
  selectedGroup:  ContactConversationGroup | null = null;

  messages: ChatwootMessage[] = [];

  searchQuery  = '';
  statusFilter: 'all' | 'open' | 'resolved' | 'pending' = 'all';

  // ── Init ──────────────────────────────────────────────────────────────────

  async ngOnInit() {
    this.isLoadingInit = true;
    this.initError = null;
    try {
      await this.svc.initChatwootCredentials();
      this.inboxes = await this.svc.getInboxes();
      if (this.inboxes.length === 1) await this.selectInbox(this.inboxes[0]);
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

  async selectInbox(inbox: ChatwootInbox) {
    if (this.selectedInbox?.id === inbox.id) return;
    this.selectedInbox  = inbox;
    this.contactGroups  = [];
    this.filteredGroups = [];
    this.selectedGroup  = null;
    this.messages       = [];
    this.searchQuery    = '';
    await this.loadConversations();
  }

  // ── Conversations ─────────────────────────────────────────────────────────

  async loadConversations() {
    if (!this.selectedInbox) return;
    this.isLoadingConvs = true;
    this.convError = null;
    this.contactGroups  = [];
    this.filteredGroups = [];
    this.selectedGroup  = null;
    this.messages       = [];
    try {
      this.contactGroups = await this.svc.getConversationsGroupedByContact(
        this.selectedInbox.id, this.statusFilter
      );
      this.applyFilter();
    } catch (e: any) {
      this.convError = e.message || 'Error al cargar conversaciones';
    } finally {
      this.isLoadingConvs = false;
    }
  }

  onStatusChange(status: 'all' | 'open' | 'resolved' | 'pending') {
    this.statusFilter = status;
    this.loadConversations();
  }

  onSearch(event: Event) {
    this.searchQuery = (event.target as HTMLInputElement).value;
    this.applyFilter();
  }

  applyFilter() {
    if (!this.searchQuery.trim()) {
      this.filteredGroups = [...this.contactGroups];
      return;
    }
    const q = this.searchQuery.toLowerCase();
    this.filteredGroups = this.contactGroups.filter(g =>
      g.contact.name.toLowerCase().includes(q) ||
      (g.contact.email ?? '').toLowerCase().includes(q) ||
      (g.contact.phone_number ?? '').toLowerCase().includes(q) ||
      g.conversations.some(c => c.last_message?.content?.toLowerCase().includes(q))
    );
  }

  // ── Contact selection → messages ──────────────────────────────────────────

  async selectGroup(group: ContactConversationGroup) {
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

  // ── Helpers ───────────────────────────────────────────────────────────────

  totalConversations(): number {
    return this.contactGroups.reduce((s, g) => s + g.conversations.length, 0);
  }

  totalUnread(): number {
    return this.contactGroups.reduce((s, g) => s + g.totalUnread, 0);
  }

  hasUnread(group: ContactConversationGroup): boolean {
    return group.totalUnread > 0;
  }

  getLastMessagePreview(group: ContactConversationGroup): string {
    const last = [...group.conversations].sort((a, b) => b.updated_at - a.updated_at)[0];
    return last?.last_message?.content || 'Sin mensajes';
  }

  getFirstStatus(group: ContactConversationGroup): string {
    return group.conversations.find(c => c.status === 'open')?.status
      ?? group.conversations[0]?.status ?? 'open';
  }

  getConvStatusSummary(group: ContactConversationGroup): string {
    const counts: Record<string, number> = {};
    group.conversations.forEach(c => counts[c.status] = (counts[c.status] || 0) + 1);
    return Object.entries(counts).map(([s, n]) => `${n} ${this.svc.statusLabel(s)}`).join(' · ');
  }

  inboxChannelIcon(inbox: ChatwootInbox): string {
    if (inbox.channel_type?.includes('Whatsapp')) return 'fa-whatsapp fab';
    if (inbox.channel_type?.includes('Api'))      return 'fa-plug fas';
    if (inbox.channel_type?.includes('Email'))    return 'fa-envelope fas';
    if (inbox.channel_type?.includes('Web'))      return 'fa-globe fas';
    return 'fa-comments fas';
  }
}
