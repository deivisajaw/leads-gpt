import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { ApiConfigService } from './api-config.service';
import { catchError, map } from 'rxjs/operators';

// Interfaces para los datos de analíticas (ejemplos)
export interface CampaignPerformance {
  campaignName: string;
  emailsSent: number;
  emailsOpened: number;
  emailsClicked: number;
  replies: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
}

export interface ConversionFunnelStep {
  name: string;
  count: number;
}

export interface SearchActivity {
  searchString: string;
  leadsFound: number;
  leadsSaved: number;
  creditsSpent: number;
}

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {

  constructor(private http: HttpClient, private apiConfig: ApiConfigService) { }

  private getCsrfToken(): string {
    const token = localStorage.getItem('csrfToken');
    if (!token) {
      console.error('CSRF token not found');
      throw new Error('CSRF token not found');
    }
    return token;
  }

  // Método para obtener el rendimiento de campañas
  getCampaignPerformance(limit: number = 3): Observable<CampaignPerformance[]> {
    const token = this.getCsrfToken();
    const action = 'com.ajawmrp3.apps.prospectingai.service.AnalyticsService:getCampaignPerformance';
    const body = { action, data: { limit } };

    return this.http.post<any>(`${this.apiConfig.baseUrl}/ws/action`, body, {
      headers: { 'X-CSRF-Token': token },
      withCredentials: true // <-- AÑADIDO
    }).pipe(
      map(response => {
        if (response.data && !response.data.error) {
          return response.data as CampaignPerformance[];
        } else {
          console.error('Backend error in getCampaignPerformance:', response.data?.message);
          return [];
        }
      }),
      catchError(error => {
        console.error('HTTP error in getCampaignPerformance:', error);
        return of([]);
      })
    );
  }

  // Método para obtener datos del embudo de conversión
  getConversionFunnel(): Observable<ConversionFunnelStep[]> {
    const token = this.getCsrfToken();
    const action = 'com.ajawmrp3.apps.prospectingai.service.AnalyticsService:getConversionFunnel';
    const body = { action, data: {} };

    return this.http.post<any>(`${this.apiConfig.baseUrl}/ws/action`, body, {
      headers: { 'X-CSRF-Token': token },
      withCredentials: true // <-- AÑADIDO
    }).pipe(
      map(response => {
        if (response.data && !response.data.error) {
          return response.data as ConversionFunnelStep[];
        } else {
          console.error('Backend error in getConversionFunnel:', response.data?.message);
          return [];
        }
      }),
      catchError(error => {
        console.error('HTTP error in getConversionFunnel:', error);
        return of([]);
      })
    );
  }

  // Método para obtener la actividad de búsqueda
  getSearchActivity(): Observable<SearchActivity[]> {
    const token = this.getCsrfToken();
    const action = 'com.ajawmrp3.apps.prospectingai.service.AnalyticsService:getSearchActivity';
    const body = { action, data: {} };

    return this.http.post<any>(`${this.apiConfig.baseUrl}/ws/action`, body, {
      headers: { 'X-CSRF-Token': token },
      withCredentials: true 
    }).pipe(
      map(response => {
        if (response.data && !response.data.error) {
          return response.data as SearchActivity[];
        } else {
          console.error('Backend error in getSearchActivity:', response.data?.message);
          return [];
        }
      }),
      catchError(error => {
        console.error('HTTP error in getSearchActivity:', error);
        return of([]);
      })
    );
  }
}