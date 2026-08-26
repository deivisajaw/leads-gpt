import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ConversationService, Conversation } from '../../services/conversation.service';

@Component({
  selector: 'app-conversations',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './conversations.component.html',
  styleUrl: './conversations.component.css'
})
export class ConversationsComponent implements OnInit {

  private router    = inject(Router);
  private translate = inject(TranslateService);
  public  svc       = inject(ConversationService);

  conversations:         Conversation[] = [];
  filteredConversations: Conversation[] = [];

  isLoading  = true;
  error: string | null = null;
  searchQuery = '';

  async ngOnInit() {
    await this.load();
  }

  async load() {
    this.isLoading = true;
    this.error = null;
    try {
      // ── MOCK: datos de prueba ──────────────────────────────────────────────
      this.conversations = await this.svc.getConversations();
      // ── REAL: descomenta cuando integres Google Meet ──────────────────────
      // this.conversations = await this.svc.getConversations();
      // ─────────────────────────────────────────────────────────────────────
      this.applyFilter();
    } catch (e: any) {
      this.error = e.message || this.translate.instant('CONVERSATIONS.ERROR.LOAD');
    } finally {
      this.isLoading = false;
    }
  }

  onSearch(event: Event) {
    this.searchQuery = (event.target as HTMLInputElement).value;
    this.applyFilter();
  }

  applyFilter() {
    if (!this.searchQuery.trim()) {
      this.filteredConversations = [...this.conversations];
      return;
    }
    const q = this.searchQuery.toLowerCase();
    this.filteredConversations = this.conversations.filter(c =>
      c.title.toLowerCase().includes(q) ||
      (c.hostName ?? '').toLowerCase().includes(q) ||
      (c.agentName ?? '').toLowerCase().includes(q) ||
      c.participants.some(p => p.name.toLowerCase().includes(q))
    );
  }

  goToDetail(c: Conversation) {
    this.router.navigate(['/conversations', c.id]);
  }
}