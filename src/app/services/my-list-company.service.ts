import { Injectable } from '@angular/core';
import { ApiConfigService } from './api-config.service';
import { fetchWithTimeout } from './http-timeout';

export interface SavedCompany {
  id: number;
  title: string;
  categoryName: string;
  city: string;
  state: string;
  countryCode: string;
  website?: string;
  openingHours?: string;
  phoneUnformatted?: string;
  savedOn: string;
  additionalInfo?: string;
  address?: string;
  description?: string;
  descriptionMd?: string;
  error?: string;
  errorDescription?: string;
  neighborhood?: string;
  permanentlyClosed?: string;
  postalCode?: string;
  street?: string;
}

export interface SaveCompanyResponse {
  error: boolean;
  message: string;
  saved?: number;
  creditsRemaining?: number;
}

export interface MyCompaniesResponse {
  error: boolean;
  message?: string;
  companies: SavedCompany[];
  total?: number;
  offset?: number;
  limit?: number;
  fetched?: number;
}

@Injectable({
  providedIn: 'root'
})
export class MyListCompanyService {

  constructor(private apiConfig: ApiConfigService) {}

  // listIds: opcional — si el usuario elige lista(s) al guardar, se asignan de una vez.
  async saveCompanyResults(ids: number[], listIds?: number[]): Promise<SaveCompanyResponse> {
    try {
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
        body: JSON.stringify({
          action: 'com.ajawmrp3.apps.prospectingai.web.AiSearchController:saveCompanyResults',
          data: { _ids: ids, listIds: listIds && listIds.length > 0 ? listIds : undefined }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result.data as SaveCompanyResponse;
    } catch (error) {
      console.error('Error saving companies:', error);
      return { error: true, message: 'Error saving companies' };
    }
  }

  async getMyCompanies(offset = 0, limit = 25, query = ''): Promise<MyCompaniesResponse> {
    try {
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
        body: JSON.stringify({
          action: 'com.ajawmrp3.apps.prospectingai.web.AiSearchController:getMyCompanies',
          data: { offset, limit, query: query || undefined }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result.data as MyCompaniesResponse;
    } catch (error) {
      console.error('Error loading companies:', error);
      return { error: true, message: 'Error loading companies', companies: [] };
    }
  }

  async getCompanyDetails(id: number): Promise<any> {
    try {
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
        body: JSON.stringify({
          action: 'com.ajawmrp3.apps.prospectingai.web.AiSearchController:getCompanyDetails',
          data: { _id : id }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error loading company details:', error);
      return { error: true, message: 'Error loading company details' };
    }
  }

  async saveAllCompanyResults(searchId: number, listIds?: number[]): Promise<SaveCompanyResponse> {
    try {
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
        body: JSON.stringify({
          action: 'com.ajawmrp3.apps.prospectingai.web.AiSearchController:saveAllCompanyResults',
          data: { _searchId: searchId, listIds: listIds && listIds.length > 0 ? listIds : undefined }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result.data as SaveCompanyResponse;
    } catch (error) {
      console.error('Error saving all companies:', error);
      return { error: true, message: 'An error occurred while trying to save all companies.' };
    }
  }
}