import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { ApiConfigService } from './api-config.service';
import { catchError, map } from 'rxjs/operators';

export interface FunnelStep {
  name: string;
  count: number;
}

export interface CampaignPerformanceMetric {
  campaignName: string;
  openRate: number;
  clickRate: number;
  replyRate: number;
}

export interface RecentSearch {
  type: 'AI_SEARCH' | 'LINKEDIN_SEARCH';
  query: string;
  date: Date;
}

export interface RecentDeal {
  id: number;
  name: string;
  stage: string;
  contactName: string;
  date: Date;
}

export interface DealStageMetric {
  stageId: number;
  stageLabel: string;
  stageColor: string;
  stageType: 'open' | 'won' | 'lost';
  count: number;
  totalAmount: number;
}

export interface DealMetrics {
  totalWonAmount: number;
  totalOpenAmount: number;
  wonDealsCount: number;
  openDealsCount: number;
  lostDealsCount: number;
  pendingContactsCount: number;
  avgDealAmount: number;
  stageBreakdown: DealStageMetric[];
}

export interface RecentNote {
  id: number;
  dealName: string;
  noteSnippet: string;
  author: string;
  date: Date;
}

export interface DashboardData {
  totalLeadsFound: number;
  totalLeadsSaved: number;
  creditsAvailable: number;
  activeDeals: number;
  dealsWonLast30Days: number;
  activeCampaigns: number;

  conversionFunnel: FunnelStep[];
  campaignPerformance: CampaignPerformanceMetric[];
  recentSearches: RecentSearch[];
  recentDeals: RecentDeal[];
  recentNotes: RecentNote[];

  dealMetrics?: DealMetrics;
}

export interface DashboardResponse {
  error: boolean;
  message?: string;
  data?: DashboardData;
}

export interface AcademicVideo {
  id: number;
  title: string;
  description: string;
  youtubeId: string;
  displayOrder: number;
  isActive: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {

  constructor(private http: HttpClient, private apiConfig: ApiConfigService) { }

  private getCsrfToken(): string {
    const token = localStorage.getItem('csrfToken');
    if (!token) {
      console.error('CSRF token not found');
      throw new Error('CSRF token not found');
    }
    return token;
  }

  getDashboardMetrics(): Observable<DashboardResponse> {
    const token = this.getCsrfToken();
    const action = 'com.ajawmrp3.apps.prospectingai.service.PlanService:getDashboardMetrics';
    const body = { action, data: {} };

    return this.http.post<any>(`${this.apiConfig.baseUrl}/ws/action`, body, {
      headers: { 'X-CSRF-Token': token },
      withCredentials: true,
    }).pipe(
      map(response => {
        if (response.data && !response.data.error) {
          if (response.data.data?.recentSearches) {
            response.data.data.recentSearches.forEach((item: any) => item.date = new Date(item.date));
          }
          if (response.data.data?.recentDeals) {
            response.data.data.recentDeals.forEach((item: any) => item.date = new Date(item.date));
          }
          if (response.data.data?.recentNotes) {
            response.data.data.recentNotes.forEach((item: any) => item.date = new Date(item.date));
          }

          return { error: false, data: response.data.data as DashboardData };
        } else {
          console.error('Backend error in getDashboardMetrics:', response.data?.message);
          return { error: true, message: response.data?.message || 'Error al cargar metricas del dashboard' };
        }
      }),
      catchError(error => {
        console.error('HTTP error in getDashboardMetrics:', error);
        return of({ error: true, message: 'Error de conexion al cargar metricas del dashboard' });
      })
    );
  }

  public getAcademicVideos(): Observable<AcademicVideo[]> {
    const token = this.getCsrfToken();
    const action = 'com.ajawmrp3.apps.prospectingai.web.AcademicVideoController:getActiveVideos';
    const body = { action, data: {} };

    return this.http.post<any>(`${this.apiConfig.baseUrl}/ws/action`, body, {
      headers: { 'X-CSRF-Token': token },
      withCredentials: true,
    }).pipe(
      map(response => {
        if (response.data && response.data.videos) {
          return response.data.videos as AcademicVideo[];
        }
        if (response.data && response.data.error) {
          console.error('Backend error in getAcademicVideos:', response.data.message);
          return [];
        }
        return [];
      }),
      catchError(error => {
        console.error('HTTP error in getAcademicVideos:', error);
        return of([]);
      })
    );
  }
}
