import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiConfigService } from './api-config.service';
import { from, Observable } from 'rxjs';

export type AbandonedCheckoutStatus = 'PLANNED' | 'IN_PROGRESS' | 'STOPED';
export type FollowupType = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export interface AbandonedCheckoutAgent {
  id: number;
  name: string;
}

export interface AbandonedCheckout {
  id: number;
  shopifyShopName: string;
  shopifyClientId?: string;
  timeZone?: string;
  startDate?: string;
  daysOfWeek?: string;
  startTime?: string;
  endTime?: string;
  startTime2?: string;
  endTime2?: string;
  startTime3?: string;
  endTime3?: string;
  abandonedCheckoutStatus: AbandonedCheckoutStatus;
  messageGeneratorPrompt?: string;
  skipPromptGeneration?: boolean;
  agent?: number;
  agentName?: string;
  processed?: boolean;
  error?: string;
  followupsCount?: number;
}

export interface AbandonedCheckoutFollowup {
  id: number;
  abandonedCheckout: number;
  shopifyCheckoutId: string;
  customerId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  country?: string;
  followupType: FollowupType;
  callDate?: string;
  shoppingCartJson?: any;
  productDetailsJson?: any;
  success?: boolean;
}

export interface AbandonedCheckoutFollowupsResponse {
  error: boolean;
  followups: AbandonedCheckoutFollowup[];
  offset: number;
  limit: number;
  fetched: number;
  total: number;
}

@Injectable({
  providedIn: 'root'
})
export class AbandonedCheckoutService {

  constructor(private apiConfig: ApiConfigService, private http: HttpClient) {}

  createAbandonedCheckoutOnWebhook(abandonedCheckoutId: number): Observable<any> {
    const url = this.apiConfig.abandonedCheckoutCreatorUrl;
    const payload = { abandonedCheckoutId: abandonedCheckoutId };
    return this.http.post(url, payload);
  }

  async getAbandonedCheckouts(): Promise<AbandonedCheckout[]> {
    const response = await this.fetchData(
      'com.ajawmrp3.apps.prospectingai.web.AbandonedCheckoutController:getAbandonedCheckouts',
      {}
    );
    return response.abandonedCheckouts || [];
  }

  async getAbandonedCheckoutDetails(abandonedCheckoutId: number): Promise<AbandonedCheckout> {
    const response = await this.fetchData(
      'com.ajawmrp3.apps.prospectingai.web.AbandonedCheckoutController:getAbandonedCheckoutDetails',
      { _id: abandonedCheckoutId }
    );
    return response.abandonedCheckout;
  }

  async getAbandonedCheckoutFollowups(
    abandonedCheckoutId: number,
    offset: number = 0,
    limit: number = 25,
    contact?: string,
    type?: string
  ): Promise<AbandonedCheckoutFollowupsResponse> {
    const data: any = {
      _id: abandonedCheckoutId,
      _offset: offset,
      _limit: limit,
    };

    if (contact) data._contact = contact;
    if (type) data._type = type;

    const response = await this.fetchData(
      'com.ajawmrp3.apps.prospectingai.web.AbandonedCheckoutController:getAbandonedCheckoutFollowups',
      data
    );
    return response;
  }

  async getAbandonedCheckoutFollowupDetails(followupId: number): Promise<AbandonedCheckoutFollowup> {
    const response = await this.fetchData(
      'com.ajawmrp3.apps.prospectingai.web.AbandonedCheckoutController:getAbandonedCheckoutFollowupDetails',
      { _id: followupId }
    );
    return response.followup;
  }

  async saveAbandonedCheckout(data: any): Promise<any> {
    return this.fetchData(
      'com.ajawmrp3.apps.prospectingai.web.AbandonedCheckoutController:saveAbandonedCheckout',
      data
    );
  }

  async getVoiceOutboundAgents(): Promise<AbandonedCheckoutAgent[]> {
    const response = await this.fetchData(
      'com.ajawmrp3.apps.prospectingai.web.AbandonedCheckoutController:getVoiceOutboundAgents',
      {}
    );
    return response.agents || [];
  }

  private async fetchData(action: string, data: any): Promise<any> {
    const token = localStorage.getItem('csrfToken');
    if (!token) {
      throw new Error('No authentication token found');
    }

    const response = await fetch(`${this.apiConfig.baseUrl}/ws/action`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': token
      },
      body: JSON.stringify({ action, data })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (result && result.data && Array.isArray(result.data) && result.data.length > 0 && result.data[0].info && result.data[0].info.message) {
      throw new Error(result.data[0].info.message);
    }

    if (result.error) {
      throw new Error(result.error.message || 'Unknown error');
    }
    return result.data;
  }
}
