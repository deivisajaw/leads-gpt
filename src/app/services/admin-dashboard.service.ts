import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiConfigService } from './api-config.service';

// Interface for the credit usage breakdown
export interface CreditUsageByMember {
  memberName: string;
  creditsUsed: number;
}

// Main data structure for the Admin Dashboard
export interface AdminDashboardData {
  planName: string;
  subscriptionStatus: string;
  expiryDate: Date;
  seatsUsedVsAvailable: string;
  seatsUsed: number; // Renamed from totalUsers
  newUsersLast30Days: number;
  companyCreditsAvailable: number;
  companyCreditsSpentLast30Days: number;
  // teamLeadsSaved: number; // Removed - backend does not send
  dealsCreatedFromPlatform: number;
  leadToDealConversionRate: string; // Changed from number to string
  totalValueDealsWon: string; // Changed from number to string
  creditBurnRateForecast: string;
  creditUsageByMember: CreditUsageByMember[];
}

@Injectable({
  providedIn: 'root'
})
export class AdminDashboardService {

  constructor(private http: HttpClient, private apiConfig: ApiConfigService) {}

  private getCsrfToken(): string {
    const token = localStorage.getItem('csrfToken');
    if (!token) {
      // This should not happen in a real scenario as it would be caught by guards
      throw new Error('CSRF token not found');
    }
    return token;
  }

  getAdminDashboardMetrics(): Observable<AdminDashboardData | null> {
    const token = this.getCsrfToken();
    const action = 'com.ajawmrp3.apps.prospectingai.web.AdminDashboardController:getAdminDashboardMetrics';
    const body = { action, data: {} };

    return this.http.post<any>(`${this.apiConfig.baseUrl}/ws/action`, body, {
      headers: { 'X-CSRF-Token': token },
      withCredentials: true,
    }).pipe(
      map(response => {
        if (response.data && !response.data.error) {
          // The backend returns the data directly in response.data
          console.log(response.data )
          return response.data as AdminDashboardData;
        } else {
          console.error('Backend error in getAdminDashboardMetrics:', response.data?.message);
          return null; // Return null in case of a structured backend error
        }
      }),
      catchError(error => {
        console.error('HTTP error in getAdminDashboardMetrics:', error);
        return of(null); // On HTTP error, return null
      })
    );
  }
}