import { Injectable } from '@angular/core';
import { ApiConfigService } from './api-config.service';

@Injectable({
  providedIn: 'root'
})
export class AxelorApiService {

  constructor(private apiConfig: ApiConfigService) {}

  async callAction(action: string, data: any): Promise<any> {
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