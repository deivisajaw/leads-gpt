import { Injectable } from '@angular/core';
import { ApiConfigService } from './api-config.service';
import { fetchWithTimeout } from './http-timeout';

// ─────────────────────────────────────────────────────────────────────────────
// INTERFACES
// ─────────────────────────────────────────────────────────────────────────────

export interface DealStageConfig {
  id: number;
  code: string;
  label: string;
  color: string;
  sortOrder: number;
  stageType: 'open' | 'won' | 'lost';
  probability: number;
  isDefault: boolean;
  isSystem: boolean;
}

export interface DealContact {
  id: number;
  contactType: 'PEOPLE' | 'COMPANY';
  displayName: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  associatedCompany?: string;
  source: string;
  campaignId?: number;
  campaignName?: string;
  companyDataId?: number;
}

export interface DealNote {
  id: number;
  note: string;
  date: string;
  author?: string;
}

export interface Deal {
  id: number;
  name: string;
  description?: string;
  amount?: number;
  expectedCloseDate?: string;
  createdOn?: string;
  stageConfigId: number;
  stageCode: string;
  stageLabel: string;
  stageColor: string;
  stageType: 'open' | 'won' | 'lost';
  ownerUserId?: number;
  ownerUserFullName?: string;
  campaignId?: number;
  campaignName?: string;
  contact: DealContact;
  companyDataId?: number;
  notes: DealNote[];
}

export interface CreateDealRequest {
  _name: string;
  _description?: string;
  _amount?: number;
  _expectedCloseDate?: string;
  _stageConfigId?: number;
  _stageCode?: string;
  _campaignId?: number;
  _contactId?: number;
  _contactData?: {
    _contactType: 'PEOPLE' | 'COMPANY';
    _displayName: string;
    _email?: string;
    _phone?: string;
    _jobTitle?: string;
    _associatedCompany?: string;
    _source: string;
    _campaignId?: number;
  };
}

export interface CreateStageRequest {
  _label: string;
  _color?: string;
  _stageType?: 'open' | 'won' | 'lost';
  _probability?: number;
}

export interface DealCampaignOption {
  id: number;
  name: string;
  status: string | null;
}

export interface ImportResult {
  error: boolean;
  imported: number;
  errors: { row: number; message: string }[];
  message: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE
// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class DealsService {

  constructor(private apiConfig: ApiConfigService) {}

  // ── Stage Configs ─────────────────────────────────────────────────────────

  async getStageConfigs(): Promise<DealStageConfig[]> {
    const data = await this.fetchData(
      'com.ajawmrp3.apps.prospectingai.web.DealStageConfigController:getStageConfigs', {});
    return this.toArray<DealStageConfig>(data);
  }

  async createStageConfig(data: CreateStageRequest): Promise<DealStageConfig> {
    const result = await this.fetchData(
      'com.ajawmrp3.apps.prospectingai.web.DealStageConfigController:createStageConfig',
      { _stageData: data });
      console.log(result)
    return this.toSingle<DealStageConfig>(result);
  }

  async updateStageConfig(stageId: number, data: Partial<CreateStageRequest>): Promise<DealStageConfig> {
    const result = await this.fetchData(
      'com.ajawmrp3.apps.prospectingai.web.DealStageConfigController:updateStageConfig',
      { _stageId: stageId, _stageData: data });
    return this.toSingle<DealStageConfig>(result);
  }

  async deleteStageConfig(stageId: number): Promise<any> {
    return this.fetchData(
      'com.ajawmrp3.apps.prospectingai.web.DealStageConfigController:deleteStageConfig',
      { _stageId: stageId });
  }

  async reorderStageConfigs(orderedIds: number[]): Promise<any> {
    return this.fetchData(
      'com.ajawmrp3.apps.prospectingai.web.DealStageConfigController:reorderStageConfigs',
      { _orderedIds: orderedIds });
  }

  // ── Deals ─────────────────────────────────────────────────────────────────

  async getDeals(): Promise<Deal[]> {
    const data = await this.fetchData(
      'com.ajawmrp3.apps.prospectingai.web.DealController:getDeals', {});
    return this.toArray<Deal>(data);
  }

  async createDeal(dealData: CreateDealRequest): Promise<Deal> {
    const result = await this.fetchData(
      'com.ajawmrp3.apps.prospectingai.web.DealController:createDeal',
      { _dealData: dealData });
    return this.toSingle<Deal>(result);
  }

  async updateDeal(dealId: number, dealData: Partial<CreateDealRequest>): Promise<Deal> {
    const result = await this.fetchData(
      'com.ajawmrp3.apps.prospectingai.web.DealController:updateDeal',
      { _dealId: dealId, _dealData: dealData });
    return this.toSingle<Deal>(result);
  }

  async updateDealStage(dealId: number, stageConfigId: number): Promise<any> {
    return this.fetchData(
      'com.ajawmrp3.apps.prospectingai.web.DealController:updateDealStage',
      { _dealId: dealId, _stageConfigId: stageConfigId });
  }

  async deleteDeal(dealId: number): Promise<any> {
    return this.fetchData(
      'com.ajawmrp3.apps.prospectingai.web.DealController:deleteDeal',
      { _dealId: dealId });
  }

  async addDealNote(dealId: number, noteText: string): Promise<DealNote> {
    const result = await this.fetchData(
      'com.ajawmrp3.apps.prospectingai.web.DealController:addDealNote',
      { _dealId: dealId, _noteText: noteText });
    return this.toSingle<DealNote>(result);
  }

  async getCampaignsByCompany(): Promise<DealCampaignOption[]> {
    const data = await this.fetchData(
      'com.ajawmrp3.apps.prospectingai.web.DealController:getCampaignsByCompany', {});
    return (data?.campaigns ?? []) as DealCampaignOption[];
  }

  async importDealsFromCsv(csvContent: string): Promise<ImportResult> {
    const result = await this.fetchData(
      'com.ajawmrp3.apps.prospectingai.web.DealController:importDealsFromCsv',
      { _csvContent: csvContent });
    return this.toSingle<ImportResult>(result);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // NORMALIZERS
  // Axelor puede devolver el array de dos formas distintas según el método:
  //   A) result.data = [item1, item2, ...]          → response.setData(List)
  //   B) result.data = { total: N, data: [...] }    → response.setData(Map con "data" key)
  // toArray() maneja ambos casos.
  // toSingle() maneja objetos que pueden venir envueltos en { data: obj }.
  // ─────────────────────────────────────────────────────────────────────────

  private toArray<T>(raw: any): T[] {
    if (!raw) return [];
    // Caso B: { total, data: [...] }
    if (!Array.isArray(raw) && Array.isArray(raw.data)) return raw.data as T[];
    // Caso A: array directo
    if (Array.isArray(raw)) return raw as T[];
    return [];
  }

  private toSingle<T>(raw: any): T {
    if (!raw) return {} as T;
    // Si viene envuelto en { data: obj }
    if (raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data)) return raw.data as T;
    return raw as T;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FETCH — mismo patrón que AgentService
  // ─────────────────────────────────────────────────────────────────────────

  private async fetchData(action: string, data: any): Promise<any> {
    const token = localStorage.getItem('csrfToken');
    if (!token) throw new Error('No authentication token found');

    // fetchWithTimeout aborta si el backend no contesta, para que la pantalla
    // muestre un error en vez de quedarse con el engranaje girando.
    const response = await fetchWithTimeout(`${this.apiConfig.baseUrl}/ws/action`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': token,
      },
      body: JSON.stringify({ action, data }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    if (result.error) throw new Error(result.error.message || 'Unknown error');
    return result.data;
  }
}