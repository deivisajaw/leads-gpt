import { Injectable } from '@angular/core';
import { ApiConfigService } from './api-config.service';
import { fetchWithTimeout } from './http-timeout';

export interface SavedPeople {
  id: number
  name: string
  title: string
  link: string
  snippet: string
  image: string
  description: string
  searchResultStatusSelect: number
  fullName: string
  email: string
  phone: string
  education: string
  experiencies: string
  countryCode: string
  location: string
  about: string
  itemSelected: boolean
  // Campos adicionales para la vista
  avatar: string
  verified: boolean
  savedOn: string
}

export interface SavePeopleResponse {
  error: boolean;
  message: string;
  saved?: number;
  creditsRemaining?: number;
}

export interface MyPeopleResponse {
  error: boolean;
  message?: string;
  peoples: SavedPeople[];
  total?: number;
  offset?: number;
  limit?: number;
  fetched?: number;
}

@Injectable({
  providedIn: 'root'
})
export class MyListPeopleService {

  constructor(private apiConfig: ApiConfigService) {}

  // listIds: opcional — si el usuario elige lista(s) al guardar, se asignan de una vez.
  async savePeopleResults(ids: number[], listIds?: number[]): Promise<SavePeopleResponse> {
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
          action: 'com.ajawmrp3.apps.prospectingai.web.AiSearchController:savePeopleResults',
          data: { _ids: ids, listIds: listIds && listIds.length > 0 ? listIds : undefined }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result.data as SavePeopleResponse;
    } catch (error) {
      console.error('Error saving people:', error);
      return { error: true, message: 'Error saving people' };
    }
  }

  async getMyPeople(offset = 0, limit = 25, query = ''): Promise<MyPeopleResponse> {
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
          action: 'com.ajawmrp3.apps.prospectingai.web.AiSearchController:getMyPeoples',
          data: { offset, limit, query: query || undefined }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result.data as MyPeopleResponse;
    } catch (error) {
      console.error('Error loading people:', error);
      return { error: true, message: 'Error loading people', peoples: [] };
    }
  }

  async getPeopleDetails(id: number): Promise<any> {
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
          action: 'com.ajawmrp3.apps.prospectingai.web.AiSearchController:getPeopleDetails',
          data: { _id : id }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error loading people details:', error);
      return { error: true, message: 'Error loading people details' };
    }
  }

  async saveAllPeopleResults(searchId: number, listIds?: number[]): Promise<SavePeopleResponse> {
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
          action: 'com.ajawmrp3.apps.prospectingai.web.AiSearchController:saveAllPeopleResults',
          data: { _searchId: searchId, listIds: listIds && listIds.length > 0 ? listIds : undefined }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result.data as SavePeopleResponse;
    } catch (error) {
      console.error('Error saving all people:', error);
      return { error: true, message: 'An error occurred while trying to save all people.' };
    }
  }
}