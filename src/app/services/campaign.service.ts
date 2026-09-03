
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiConfigService } from './api-config.service';
import { SavedPeople } from './my-list-people.service';
import { SavedCompany } from './my-list-company.service';
import { from, Observable } from 'rxjs';
import { fetchWithTimeout } from './http-timeout';

export type CampaignStatus = 'planned' | 'in_progress' | 'finished' | 'cancelled';

export type CallOutcome =
  | 'ANSWERED_NO_OUTCOME'
  | 'VOICEMAIL'
  | 'NO_ANSWER'
  | 'APPOINTMENT_SET'
  | 'NOT_INTERESTED'
  | 'INTERESTED'
  | 'CALLBACK_REQUESTED'
  | 'WRONG_NUMBER'
  | 'BUSY'
  | 'TECHNICAL_ERROR'
  | 'DO_NOT_CALL'
  | 'LANGUAGE_NOT_SUPPORTED'
  | 'CALL_DROPPED';

export interface Agent {
  id: number;
  name: string;
}

export interface Campaign {
  id: number;
  name: string;
  registeredLeadsCount: number;
  connectedLeadsCount: number;
  scheduledMeetingsCount: number;
  status: CampaignStatus;
  startDate: string;
  endDate: string;
  timezone?: string;
  startTime?: string;
  endTime?: string;
  startTime2?: string;
  endTime2?: string;
  startTime3?: string;
  endTime3?: string;
  period?: number;
  campaignType?: string;
  daysOfWeek?: string;
  agent?: number;
  agentName?: string;
  leads?: Lead[];
  processed?: boolean;
}

export interface Lead {
  id: string;
  type: 'people' | 'company' | 'csv';
  name: string;
  phone: string;
  email: string;
  contacted?: boolean;
}

export interface CampaignCreationData {
  people: Lead[];
  companies: Lead[];
}

export interface TimezoneOption {
  label: string;
  value: string;
}


export interface CallMetrics {
  totalCalls: number;
  appointmentsSet: number;
  answeredCalls: number;
  interestedCalls: number;
  totalDurationMs: number;
  avgDurationMs: number;
}

@Injectable({
  providedIn: 'root'
})
export class CampaignService {

  constructor(private apiConfig: ApiConfigService, private http: HttpClient) { }

  createCampaignOnWebhook(campaignId: number): Observable<any> {
    const url = this.apiConfig.voiceCampaignCreatorUrl;
    const payload = { campaignId: campaignId };
    return this.http.post(url, payload);
  }

  async getCampaigns(): Promise<Campaign[]> {
    const response = await this.fetchData('com.ajawmrp3.apps.prospectingai.web.CampaignaiController:getCampaigns', {});
    return response.campaigns || [];
  }

  async getAgents(): Promise<Agent[]> {
    const response = await this.fetchData('com.ajawmrp3.apps.prospectingai.web.CampaignaiController:getAgents', {});
    return response.agents || [];
  }

  async getCampaignDetails(campaignId: number): Promise<Campaign> {
    const response = await this.fetchData('com.ajawmrp3.apps.prospectingai.web.CampaignaiController:getCampaignDetails', { _id: campaignId });
    return response.campaign;
  }

  async getCallsByCampaign(
    campaignId: number,
    offset: number = 0,
    limit: number = 25,
    contact?: string,
    outcome?: string,
    type?: string
  ): Promise<any> {
    const data: any = {
      _id: campaignId,
      _offset: offset,
      _limit: limit,
    };

    if (contact) data._contact = contact;
    if (outcome) data._outcome = outcome;
    if (type) data._type = type;

    const response = await this.fetchData('com.ajawmrp3.apps.prospectingai.web.CampaignaiController:getCallsByCampaign', data);
    return response;
  }

  async getCallsByCompany(
    offset: number = 0,
    limit: number = 25,
    contact?: string,
    outcome?: string,
    type?: string
  ): Promise<any> {
    const data: any = {
      _offset: offset,
      _limit: limit,
    };

    if (contact) data._contact = contact;
    if (outcome) data._outcome = outcome;
    if (type) data._type = type;

    const response = await this.fetchData('com.ajawmrp3.apps.prospectingai.web.CampaignaiController:getCallsByCompany', data);
    return response;
  }

  async createCampaign(campaignData: any): Promise<any> {
    return this.fetchData('com.ajawmrp3.apps.prospectingai.web.CampaignaiController:saveCampaign', campaignData);
  }

  async updateCampaign(campaignData: any): Promise<any> {
    return this.fetchData('com.ajawmrp3.apps.prospectingai.web.CampaignaiController:updateCampaignStatus', campaignData);
  }

  async deleteCampaign(campaignId: number): Promise<any> {
    const result = await this.fetchData('com.ajawmrp3.apps.prospectingai.web.CampaignaiController:deleteCampaign', { _id: campaignId });
    console.log(result)
    return result;
  }

  updateCampaignStatus(campaignId: number, status: CampaignStatus): Observable<any> {
    const promise = this.fetchData('com.ajawmrp3.apps.prospectingai.web.CampaignaiController:updateCampaignStatus', { _id: campaignId, status });
    return from(promise);
  }

  async getCampaignCreationData(): Promise<CampaignCreationData> {
    try {
      const [peopleResponse, companyResponse] = await Promise.all([
        this.getMyPeople(),
        this.getMyCompanies()
      ]);

      const peopleLeads: Lead[] = peopleResponse.peoples.map(p => ({
        id: p.id.toString(),
        type: 'people',
        name: p.name,
        phone: p.phone,
        email: p.email
      }));

      const companyLeads: Lead[] = companyResponse.companies.map(c => ({
        id: c.id.toString(),
        type: 'company',
        name: c.title,
        phone: c.phoneUnformatted || '',
        email: ''
      }));

      return {
        people: peopleLeads,
        companies: companyLeads
      };
    } catch (error) {
      console.error('Error loading campaign creation data:', error);
      return { people: [], companies: [] };
    }
  }

  private async getMyPeople(): Promise<{ peoples: SavedPeople[] }> {
    return this.fetchData('com.ajawmrp3.apps.prospectingai.web.AiSearchController:getMyPeoples', {});
  }

  private async getMyCompanies(): Promise<{ companies: SavedCompany[] }> {
    return this.fetchData('com.ajawmrp3.apps.prospectingai.web.AiSearchController:getMyCompanies', {});
  }


  async getCallsMetricsByCompany(): Promise<CallMetrics> {
    const response = await this.fetchData(
      'com.ajawmrp3.apps.prospectingai.web.CampaignaiController:getCallsMetricsByCompany',
      {}
    );
    return response.metrics as CallMetrics;
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

  createSmsCampaignOnWebhook(campaignId: number): Observable<any> {
    const url = this.apiConfig.smsCampaignCreatorUrl;
    const payload = { campaignId: campaignId };
    return this.http.post(url, payload);
  }
}
