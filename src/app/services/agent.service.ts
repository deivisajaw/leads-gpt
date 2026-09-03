import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http'; // Import HttpClient
import { ApiConfigService } from './api-config.service';
import { fetchWithTimeout } from './http-timeout';
import { Observable } from 'rxjs'; // Import Observable

export interface Agent {
  id: number
  name: string
  agentType: "voice" | "text" | "sms"
  agentDirection?: "INBOUND" | "OUTBOUND";
  language: string
  agentSystemName: string
  purpose: string
  description?: string
  instructions?: string
  prompt: string
  voice: string
  openingLine: string
  createDate: string
  updateDate?: string
  processed?: boolean; 

  elevenLabsVoiceId?: string;
  voiceName?: string;
  voiceGender?: string;
  voiceAccent?: string;

  whatsappNumber?: string;
  calToken?: string;       // kept for backward compat - no longer populated from backend
  calEventType?: string;   // kept for backward compat - no longer populated from backend
  companyPhoneNumberId?: number;
  hasCalendarIntegration?: boolean;
  hasInstagramIntegration?: boolean;
  companyPhoneNumberNumber?: string;
  voicemailMessage?: string;
}

export interface Voice {
  id: number;
  name: string;
  elevenLabsVoiceId: string;
  previewUrl: string;
  gender: string;
  accent: string;
}

export interface PhoneNumber {
  id: number;
  companyData: number;
  twilioPhone: string;
  agent?: number;
}

@Injectable({
  providedIn: 'root'
})
export class AgentService {

  constructor(private apiConfig: ApiConfigService, private http: HttpClient) {} // Inject HttpClient

  triggerTestCallWebhook(payload: { agentId: number; contactPhone: string; contactName: string; contactEmail?: string }): Observable<any> {
    const url = this.apiConfig.aiTestCallmeWebhookUrl;
    return this.http.post(url, payload);
  }

  async getAgents(): Promise<Agent[]> {
    const response = await this.fetchData('com.ajawmrp3.apps.prospectingai.web.AgentController:getAgents', {});
    return response.agents || [];
  }

  async getAgentById(id: number): Promise<{ agent: Agent; error: boolean; }> {
    return this.fetchData('com.ajawmrp3.apps.prospectingai.web.AgentController:getAgentDetails', { _id: id });
  }

  async createAgent(agentData: any): Promise<any> {
    return this.fetchData('com.ajawmrp3.apps.prospectingai.web.AgentController:saveAgent', agentData);
  }

  async deleteAgent(agentId: number): Promise<any> {
    return this.fetchData('com.ajawmrp3.apps.prospectingai.web.AgentController:deleteAgent', { _id: agentId });
  }

  async freeUpAgent(agentId: number): Promise<void> {
    const response = await fetchWithTimeout(this.apiConfig.freeUpAgentUrl, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId })
    });

    if (!response.ok) {
      let errorMsg = `HTTP ${response.status}`;
      try {
        const rawText = await response.text();
        if (rawText) {
          const body = JSON.parse(rawText);
          errorMsg = body?.error || errorMsg;
        }
      } catch (_) { /* empty body */ }
      throw new Error(errorMsg);
    }
    // Success: { "success": "the voice agent was successfully deleted" }
    // No further action needed — caller handles success flow
  }

  async getVoices(): Promise<Voice[]> {
    const response = await this.fetchData('com.ajawmrp3.apps.prospectingai.web.AgentController:getVoices', {});
    return response.voices || []; 
  }

  async getPhoneNumbers(): Promise<PhoneNumber[]> {
    const response = await this.fetchData('com.ajawmrp3.apps.prospectingai.web.AgentController:getPhoneNumbers', {});
    return response.phones || []; 
  }

  async getCalendarIntegrationStatus(agentId: number): Promise<boolean> {
    const response = await this.fetchData('com.ajawmrp3.apps.prospectingai.web.AgentController:getAgentDetails', { _id: agentId });
    return response?.agent?.hasCalendarIntegration ?? false;
  }

  async getInstagramIntegrationStatus(agentId: number): Promise<boolean> {
    const response = await this.fetchData('com.ajawmrp3.apps.prospectingai.web.AgentController:getAgentDetails', { _id: agentId });
    return response?.agent?.hasInstagramIntegration ?? false;
  }

  private async fetchData(action: string, data: any): Promise<any> {
    const token = localStorage.getItem('csrfToken');
    if (!token) {
      throw new Error('No authentication token found');
    }

    const response = await fetchWithTimeout(`${this.apiConfig.baseUrl}/ws/action`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': token
      },
      body: JSON.stringify({ action, data })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    // Axelor wraps errors as: { status: 0, data: [{ info: { message: '...' } }] }
    // when a transaction fails — data is an array instead of the expected object.
    if (Array.isArray(result.data)) {
      const firstError = result.data[0];
      const msg = firstError?.info?.message || firstError?.message || 'Transaction error';
      throw new Error(msg);
    }

    if (result.data?.error) {
      throw new Error(result.data?.message || 'Unknown error');
    }
    return result.data;
  }
}