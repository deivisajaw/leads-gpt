import { Injectable } from '@angular/core';
import { ApiConfigService } from './api-config.service';
import { fetchWithTimeout } from './http-timeout';

@Injectable({
  providedIn: 'root'
})
export class PlanService {

  constructor(private apiConfig: ApiConfigService) { }

  async getPlans(): Promise<any> {
    const token = localStorage.getItem('csrfToken');
    if (!token) {
      throw new Error('No authentication token found');
    }

    try {
      const response = await fetchWithTimeout(`${this.apiConfig.baseUrl}/ws/action`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': token
        },
        body: JSON.stringify({
          action: 'com.ajawmrp3.apps.prospectingai.web.PlanController:getPlanes',
          data: {}
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result.data;

    } catch (error) {
      console.error('Error fetching plans:', error);
      throw error;
    }
  }
}
