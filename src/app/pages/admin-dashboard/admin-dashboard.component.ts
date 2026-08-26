import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AdminDashboardService, AdminDashboardData } from '../../services/admin-dashboard.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';
import { Chart, CategoryScale, LinearScale, BarController, BarElement, Tooltip, Legend } from 'chart.js';

Chart.register(
  CategoryScale,
  LinearScale,
  BarController,
  BarElement,
  Tooltip,
  Legend
);

interface AdminDashboardViewData extends AdminDashboardData {
  planNameKey: string;
  subscriptionStatusKey: string;
  creditForecastKey: string;
  creditForecastParams: object;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, TranslateModule, BaseChartDirective],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent implements OnInit, OnDestroy {

  public dashboardData$: Observable<AdminDashboardData | null>;
  public viewData: AdminDashboardViewData | null = null;
  public totalDealsWonValue: number = 0;
  private destroy$ = new Subject<void>();

  public barChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
    plugins: { legend: { display: true, position: 'bottom' }, tooltip: { mode: 'index', intersect: false } }
  };
  public barChartLabels: string[] = [];
  public barChartType: ChartType = 'bar';
  public barChartLegend = true;
  public barChartData: ChartData<'bar'> = { labels: [], datasets: [] };

  constructor(private adminDashboardService: AdminDashboardService, private translate: TranslateService) {
    this.dashboardData$ = this.adminDashboardService.getAdminDashboardMetrics();
  }

  ngOnInit(): void {
    this.dashboardData$
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => {
        if (data) {
          this.processAndSetViewData(data);
        }
      });

    this.translate.onLangChange
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.dashboardData$.pipe(takeUntil(this.destroy$)).subscribe(data => {
          if (data) {
            this.processAndSetViewData(data);
          }
        });
      });
  }

  private processAndSetViewData(data: AdminDashboardData): void {
    const planNameKey = this.getPlanTranslationKey(data.planName);
    const subscriptionStatusKey = this.getStatusTranslationKey(data.subscriptionStatus);
    const { key: creditForecastKey, params: creditForecastParams } = this.getForecastTranslation(data.creditBurnRateForecast);

    this.viewData = {
      ...data,
      planNameKey,
      subscriptionStatusKey,
      creditForecastKey,
      creditForecastParams
    };
    
    this.totalDealsWonValue = parseFloat(data.totalValueDealsWon || '0');
    this.updateChartTranslations(data);
  }

  private getPlanTranslationKey(planName: string): string {
    const planKeys: { [key: string]: string } = {
      'Free': 'PLANS.PLAN_FREE_TITLE',
      'Basic': 'PLANS.PLAN_BASIC_TITLE',
      'Professional': 'PLANS.PLAN_PRO_TITLE',
      'Organization': 'PLANS.PLAN_ORG_TITLE'
    };
    return planKeys[planName] || planName;
  }

  private getStatusTranslationKey(status: string): string {
    const statusKeys: { [key: string]: string } = {
      'Active': 'SUB_MGMT.STATUS_TYPES.ACTIVE',
      'Inactive': 'SUB_MGMT.STATUS_TYPES.INACTIVE',
      'Cancelled': 'SUB_MGMT.STATUS_TYPES.CANCELLED'
    };
    return statusKeys[status] || status;
  }

  private getForecastTranslation(forecast: string): { key: string, params: object } {
    const match = forecast.match(/\d+/);
    if (match) {
      return {
        key: 'ADMIN_DASHBOARD.CREDIT_FORECAST_MESSAGE',
        params: { days: match[0] }
      };
    }
    return { key: 'ADMIN_DASHBOARD.CREDIT_FORECAST_UNAVAILABLE', params: {} };
  }

  updateChartTranslations(data: AdminDashboardData) {
    this.barChartLabels = [this.translate.instant('ADMIN_DASHBOARD.TEAM_ACTIVITY')];
    this.barChartData = {
      labels: this.barChartLabels,
      datasets: [
        { data: [data.newUsersLast30Days], label: this.translate.instant('ADMIN_DASHBOARD.CHART_LABEL_NEW_USERS'), backgroundColor: 'rgba(56, 189, 248, 0.85)' },
        { data: [data.dealsCreatedFromPlatform], label: this.translate.instant('ADMIN_DASHBOARD.CHART_LABEL_DEALS_CREATED'), backgroundColor: 'rgba(236, 72, 153, 0.85)' },
        { data: [data.companyCreditsSpentLast30Days], label: this.translate.instant('ADMIN_DASHBOARD.CHART_LABEL_CREDITS_SPENT'), backgroundColor: 'rgba(250, 204, 21, 0.85)' }
      ]
    };
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}