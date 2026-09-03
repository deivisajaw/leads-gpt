import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ConversationService, Conversation } from '../../services/conversation.service';

export type DetailTab = 'summary' | 'transcript' | 'participants';

@Component({
  selector: 'app-conversation-detail',
  standalone: true,
  imports: [CommonModule, TranslateModule, RouterModule],
  templateUrl: './conversation-detail.component.html',
  styleUrl: './conversation-detail.component.css'
})
export class ConversationDetailComponent implements OnInit {

  private route     = inject(ActivatedRoute);
  private router    = inject(Router);
  private translate = inject(TranslateService);
  public  svc       = inject(ConversationService);

  conversation: Conversation | null = null;
  isLoading   = true;
  error: string | null = null;
  activeTab: DetailTab = 'summary';

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      // get() en vez de instant(): en una carga en frío instant() habría puesto
      // la clave cruda como mensaje de error.
      this.translate.get('CONVERSATIONS.DETAIL.ERROR.NO_ID').subscribe(v => this.error = v);
      this.isLoading = false;
      return;
    }
    await this.load(id);
  }

  async load(id: string) {
    this.isLoading = true;
    this.error = null;
    try {
      // ── MOCK ──────────────────────────────────────────────────────────────
      this.conversation = await this.svc.getConversationById(id);
      // ── REAL: descomenta cuando integres Google Meet ──────────────────────
      // this.conversation = await this.svc.getConversationById(id);
      // ─────────────────────────────────────────────────────────────────────
      if (!this.conversation) {
        this.error = this.translate.instant('CONVERSATIONS.DETAIL.ERROR.NOT_FOUND');
      }
    } catch (e: any) {
      this.error = e.message || this.translate.instant('CONVERSATIONS.DETAIL.ERROR.LOAD');
    } finally {
      this.isLoading = false;
    }
  }

  setTab(tab: DetailTab) { this.activeTab = tab; }

  goBack() { this.router.navigate(['/conversations']); }
}
