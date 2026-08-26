import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AgentService, Agent } from '../../services/agent.service';
import { ApiConfigService } from '../../services/api-config.service';

export interface AlertMessage {
  type: "success" | "error"
  text: string
}

@Component({
  selector: 'app-agent-view',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule], 
  templateUrl: './agent-view.component.html',
  styleUrl: './agent-view.component.css'
})
export class AgentViewComponent implements OnInit {
  private agentService = inject(AgentService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private apiConfig = inject(ApiConfigService); 

  agent: Agent | null = null;
  hasCalendarIntegration = false;
  alertMessage: AlertMessage | null = null;
  errorMessage: string | null = null; 
  isLoading: boolean = true;

  isTestCallModalVisible: boolean = false;
  testCallAgentId: number | null = null;
  testCallContactPhone: string = '';
  testCallContactName: string = '';
  testCallContactEmail: string = '';
  isTestCallLoading: boolean = false;
  showTestCallValidationErrors: boolean = false;

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const agentId = params.get('id');
      if (agentId) {
        this.loadAgentDetails(+agentId);
      } else {
        this.showAlert('error', 'ID de agente no proporcionado.');
        this.router.navigate(['/agents']); 
      }
    });
  }

  async loadAgentDetails(id: number): Promise<void> {
    this.errorMessage = null; 
    this.isLoading = true; 
    this.agent = null; 

    try {
      const responseData = await this.agentService.getAgentById(id);
      if (responseData && responseData.error) {
        this.errorMessage = `Ha ocurrido un error: ${ (responseData as any).message || 'Error desconocido del backend.'}`;
        this.agent = null; 
      } else if (!responseData || !responseData.agent) { 
        this.errorMessage = 'Agente no encontrado o datos vacíos.';
        this.router.navigate(['/agents']); 
      } else {
        this.agent = responseData.agent; 
        this.hasCalendarIntegration = responseData.agent?.hasCalendarIntegration ?? false;
      }
    } catch (err: any) {
      console.error('Error loading agent details (caught exception):', err);
      const backendErrorMessage = err.message || 'Error desconocido del backend.';
      this.errorMessage = `Ha ocurrido un error: ${backendErrorMessage}`;
      this.agent = null; 
    } finally {
      this.isLoading = false; 
    }
  }

  goBack(): void {
    this.router.navigate(['/agents']);
  }

  showAlert(type: "success" | "error", text: string): void {
    this.alertMessage = { type, text };
    setTimeout(() => {
      this.alertMessage = null;
    }, 5000);
  }

  openTestCallModal(agentId: number): void {
    this.testCallAgentId = agentId;
    this.testCallContactPhone = '';
    this.testCallContactName = '';
    this.testCallContactEmail = '';
    this.isTestCallLoading = false;
    this.showTestCallValidationErrors = false;
    this.isTestCallModalVisible = true;
  }

  closeTestCallModal(): void {
    this.isTestCallModalVisible = false;
    this.testCallAgentId = null;
    this.testCallContactPhone = '';
    this.testCallContactName = '';
    this.testCallContactEmail = '';
    this.isTestCallLoading = false;
    this.showTestCallValidationErrors = false;
  }

  isTestCallFormValid(): boolean {
    return !!this.testCallContactPhone && !!this.testCallContactName;
  }

  // Google Calendar integration - popup with polling (same pattern as agents grid)
  calendarPopupRef: Window | null = null;
  calendarPollingInterval: any = null;
  isCalendarPolling = false;

  openCalendarIntegrationModal(): void {
    if (!this.agent) return;
    this.stopCalendarPolling();

    const url = `https://n8n.ajaw.ai/webhook/connect-google?agentId=${this.agent.id}`;
    const opts = 'width=600,height=700,scrollbars=yes,resizable=yes,top=100,left=200';
    this.calendarPopupRef = window.open(url, 'google-calendar-oauth', opts);

    if (!this.calendarPopupRef) {
      // Popup blocked - fall back to new tab
      window.open(url, '_blank');
      this.showAlert('error', 'AGENTS.CALENDAR.POPUP_BLOCKED');
      return;
    }

    this.isCalendarPolling = true;
    const agentId = this.agent.id;
    let attempts = 0;

    this.calendarPollingInterval = setInterval(async () => {
      attempts++;
      if (attempts >= 40) {
        this.stopCalendarPolling();
        return;
      }
      try {
        const response = await this.agentService.getAgentById(agentId);
        if (response && response.agent && response.agent.hasCalendarIntegration) {
          this.hasCalendarIntegration = true;
          if (this.calendarPopupRef && !this.calendarPopupRef.closed) {
            this.calendarPopupRef.close();
          }
          this.stopCalendarPolling();
          this.showAlert('success', 'AGENTS.CALENDAR.CONNECTED_SUCCESS');
        }
      } catch (e) {
        console.error('Error polling calendar integration status:', e);
      }
    }, 3000);
  }

  stopCalendarPolling(): void {
    if (this.calendarPollingInterval) {
      clearInterval(this.calendarPollingInterval);
      this.calendarPollingInterval = null;
    }
    this.calendarPopupRef = null;
    this.isCalendarPolling = false;
  }

  async triggerTestCall(): Promise<void> {
    if (!this.isTestCallFormValid()) {
      this.showTestCallValidationErrors = true;
      this.showAlert("error", "Por favor, complete el número y nombre de contacto.");
      return;
    }

    this.isTestCallLoading = true;
    this.showTestCallValidationErrors = false;

    const payload = {
      agentId: this.testCallAgentId!,
      contactPhone: this.testCallContactPhone,
      contactName: this.testCallContactName,
      contactEmail: this.testCallContactEmail || undefined
    };

    try {
      const response = await this.agentService.triggerTestCallWebhook(payload).toPromise();

      if (response && response.success) {
        this.showAlert("success", response.success);
      } else if (response && response.error) {
        this.showAlert("error", response.error);
      } else {
        this.showAlert("error", "Respuesta inesperada del webhook de prueba de llamada.");
      }
    } catch (error: any) {
      console.error('Error al realizar la llamada de prueba:', error);
      const errorMessage = error.error?.error || error.message || 'Error desconocido al intentar la llamada de prueba.';
      this.showAlert("error", `Error en la llamada de prueba: ${errorMessage}`);
    } finally {
      this.isTestCallLoading = false;
      this.closeTestCallModal();
    }
  }
}
