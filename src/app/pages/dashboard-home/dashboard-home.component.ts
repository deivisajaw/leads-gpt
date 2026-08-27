import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { Subscription, Observable, map } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../services/auth.service';
import { FormsModule } from '@angular/forms';
import {
  DashboardService,
  DashboardData,
  DealMetrics,
  DealStageMetric,
  AcademicVideo,
  FunnelStep
} from '../../services/dashboard.service';
import { OnboardingWidgetComponent } from '../../components/onboarding-widget/onboarding-widget.component';
import { VideoModalComponent } from '../../components/shared/video-modal/video-modal.component';

// Imports para graficos
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';
import { Chart, CategoryScale, LinearScale, BarController, BarElement, Tooltip, Legend, ArcElement, DoughnutController } from 'chart.js';

// Registrar componentes de Chart.js
Chart.register(
  CategoryScale,
  LinearScale,
  BarController,
  BarElement,
  Tooltip,
  Legend,
  ArcElement,
  DoughnutController
);

@Component({
  selector: 'app-dashboard-home',
  standalone: true,
  imports: [CommonModule, TranslateModule, FormsModule, RouterModule, BaseChartDirective, OnboardingWidgetComponent, VideoModalComponent],
  templateUrl: './dashboard-home.component.html',
  styleUrls: ['./dashboard-home.component.css']
})
export class DashboardHomeComponent implements OnInit, OnDestroy {

  username: string | undefined;
  public hideOnboarding$: Observable<boolean | undefined>;
  private userProfileSubscription: Subscription | undefined;

  public dashboardData: DashboardData | null = null;
  public isLoading = true;
  public hasError = false;
  public activityTab: 'deals' | 'notes' = 'deals';
  public academicVideos$: Observable<AcademicVideo[]>;

  // Chart properties...
  public barChartOptions: ChartConfiguration['options'] = { responsive: true, maintainAspectRatio: false, scales: { x: { stacked: false, title: { display: true, text: 'Campaña' } }, y: { stacked: false, beginAtZero: true, max: 100, title: { display: true, text: 'Tasa (%)' } } }, plugins: { legend: { display: true, position: 'bottom', }, tooltip: { callbacks: { label: function (context: any) { let label = context.dataset.label || ''; if (label) { label += ': '; } if (context.parsed.y !== null) { label += context.parsed.y + '%'; } return label; } } } } };
  public barChartLabels: string[] = [];
  public barChartType: ChartType = 'bar';
  public barChartLegend = true;
  public barChartData: ChartData<'bar'> = { labels: [], datasets: [] };

  public funnelChartOptions: ChartConfiguration['options'] = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'right', }, tooltip: { callbacks: { label: function (context: any) { const label = context.label || ''; if (context.parsed) { return `${label}: ${context.parsed} leads`; } return label; } } } } };
  public funnelChartLabels: string[] = [];
  public funnelChartData: ChartData<'doughnut'> = { labels: [], datasets: [] };
  public funnelChartType: ChartType = 'doughnut';

  // Deal metrics bar chart
  public dealBarChartData: any = { labels: [], datasets: [] };
  public dealBarChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => ' $' + (ctx.parsed.y ?? 0).toLocaleString('es-CO', { minimumFractionDigits: 0 })
        }
      }
    },
    scales: {
      x: { grid: { display: false } },
      y: {
        beginAtZero: true,
        ticks: {
          callback: (v: any) => '$' + Number(v).toLocaleString('es-CO', { notation: 'compact' as any })
        }
      }
    }
  };
  public dealBarChartType: any = 'bar';

  showWelcomeVideo = false;
  videoUrl = 'videos/welcome.mp4';

  constructor(
    private authService: AuthService,
    private translate: TranslateService,
    private router: Router,
    private dashboardService: DashboardService
  ) {
    this.hideOnboarding$ = this.authService.userProfile$.pipe(
      map(profile => profile?.hideOnboardingWidget)
    );
    this.academicVideos$ = this.dashboardService.getAcademicVideos();
  }

  ngOnInit(): void {
    this.userProfileSubscription = this.authService.userProfile$.subscribe(profile => {
      this.username = profile?.username;
      if (profile && profile.userId) {
        const hasSeen = this.getHasSeenWelcomeVideoLocally(profile.userId);
        this.showWelcomeVideo = !hasSeen;
      } else {
        this.showWelcomeVideo = false;
      }
    });
    this.loadDashboardData();
  }

  ngOnDestroy(): void {
    if (this.userProfileSubscription) {
      this.userProfileSubscription.unsubscribe();
    }
  }
 
  loadDashboardData(): void {
    this.isLoading = true;         
    this.hasError = false;        
    this.dashboardService.getDashboardMetrics().subscribe({
      next: (response) => {
        if (!response.error && response.data) {          
          console.log(response.data)
          this.dashboardData = response.data;
          if (this.dashboardData.campaignPerformance) {
            const labels = this.dashboardData.campaignPerformance.map(c => c.campaignName);
            const openRates = this.dashboardData.campaignPerformance.map(c => c.openRate);
            const clickRates = this.dashboardData.campaignPerformance.map(c => c.clickRate);
            const replyRates = this.dashboardData.campaignPerformance.map(c => c.replyRate);
            this.barChartData = {
              labels: labels,
              datasets: [
                {
                  data: openRates,
                  label: 'Tasa de Apertura',
                  backgroundColor: 'rgba(120, 113, 251, 0.9)',
                  borderColor: 'rgba(120, 113, 251, 1)',
                  borderWidth: 2,
                  borderRadius: 6,
                },
                {
                  data: clickRates,
                  label: 'Tasa de Clics',
                  backgroundColor: 'rgba(91, 79, 229, 0.9)',
                  borderColor: 'rgba(91, 79, 229, 1)',
                  borderWidth: 2,
                  borderRadius: 6,
                },
                {
                  data: replyRates,
                  label: 'Tasa de Respuestas',
                  backgroundColor: 'rgba(37, 31, 149, 0.9)',
                  borderColor: 'rgba(37, 31, 149, 1)',
                  borderWidth: 2,
                  borderRadius: 6,
                }
              ]

            };
          }
          // Build deal amount chart from dealMetrics
          if (this.dashboardData.dealMetrics?.stageBreakdown) {
            const openStages = this.dashboardData.dealMetrics.stageBreakdown
              .filter((s: DealStageMetric) => s.stageType === 'open' && s.count > 0)
              .sort((a: DealStageMetric, b: DealStageMetric) => b.totalAmount - a.totalAmount);
            this.dealBarChartData = {
              labels: openStages.map((s: DealStageMetric) => s.stageLabel),
              datasets: [{
                data: openStages.map((s: DealStageMetric) => s.totalAmount),
                backgroundColor: 'rgba(91, 79, 229, 0.9)',
                borderRadius: 6,
                borderSkipped: false,
              }]
            };
          }

          if (this.dashboardData.conversionFunnel && this.dashboardData.conversionFunnel.length > 0) {
            const funnelLabels = this.dashboardData.conversionFunnel.map(step => step.name);
            const funnelCounts = this.dashboardData.conversionFunnel.map(step => step.count);
            this.funnelChartData = {
              labels: funnelLabels,
              datasets: [
                {
                  data: funnelCounts,
                  backgroundColor: [
                    'rgba(37, 31, 149, 0.95)',
                    'rgba(91, 79, 229, 0.95)',
                    'rgba(120, 113, 251, 0.95)',
                    'rgba(165, 160, 252, 0.95)',
                    'rgba(210, 207, 253, 0.95)'
                  ],
                  borderColor: [
                    'rgba(37, 31, 149, 1)',
                    'rgba(91, 79, 229, 1)',
                    'rgba(120, 113, 251, 1)',
                    'rgba(165, 160, 252, 1)',
                    'rgba(210, 207, 253, 1)'
                  ],
                  borderWidth: 2,
                  hoverBorderColor: '#0f172a',
                  hoverBorderWidth: 3,
                }
              ]

            };
          }
        } else {
          console.error('Error loading dashboard data:', response.message);
          this.hasError = true;    
        }
        this.isLoading = false;    
      },
      error: (err) => {
        console.error('HTTP error loading dashboard data:', err);
        this.hasError = true;     
        this.isLoading = false;    
      }
    });
  }

  formatDate(date: Date): string {
    if (!date) return '';
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(date).toLocaleDateString('es-ES', options);
  }

  // Guia de inicio re-abrible (solo vista; no resetea pasos en backend)
  showGuide = false;

  toggleGuide(): void {
    this.showGuide = !this.showGuide;
    if (this.showGuide) {
      setTimeout(() => {
        document.getElementById('onboarding-band')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    }
  }

  // Presentacional: pasos del embudo con % relativo al primer paso (estilo Shopify).
  // Cacheado por referencia: devolver un array nuevo en cada ciclo de change detection
  // hace que *ngFor reconstruya el DOM en loop (congela la pagina).
  private _funnelStepsCache: { src: FunnelStep[]; steps: Array<{ name: string; count: number; pct: number }> } | null = null;

  get funnelSteps(): Array<{ name: string; count: number; pct: number }> {
    const src = this.dashboardData?.conversionFunnel || [];
    if (this._funnelStepsCache && this._funnelStepsCache.src === src) {
      return this._funnelStepsCache.steps;
    }
    const base = src.length > 0 ? Math.max(src[0].count, 1) : 1;
    const steps = src.map(s => ({
      name: s.name,
      count: s.count,
      pct: Math.round((s.count / base) * 1000) / 10
    }));
    this._funnelStepsCache = { src, steps };
    return steps;
  }

  goToPeople(): void { this.router.navigate(['/people']); }
  goToCompany(): void { this.router.navigate(['/companies']); }
  goToDeals(): void { this.router.navigate(['/deals']); }

  isNumber(value: any): boolean {
    return !isNaN(value) && typeof value !== 'boolean' && value !== null && value !== '';
  }

  public getStageClass(stage: string): string {
    if (!stage) {
      return 'badge-default';
    }
    const stageClass = stage.toLowerCase().replace(/_/g, '-');
    return `badge-${stageClass}`;
  }

  closeVideoModal() {
    this.showWelcomeVideo = false;
    if (this.authService.currentUserProfile?.userId) {
      this.updateUserWelcomeVideoStatusLocally(this.authService.currentUserProfile.userId, true);
    }
  }

  handleVideoCtaClick() {
    this.closeVideoModal();
    this.router.navigate(['/companies']);
  }

  private WELCOME_VIDEO_STATUS_KEY = 'welcomeVideoStatusByUser';

  private getWelcomeVideoStatusMap(): { [userId: number]: boolean } {
    const stored = localStorage.getItem(this.WELCOME_VIDEO_STATUS_KEY);
    return stored ? JSON.parse(stored) : {};
  }

  private updateUserWelcomeVideoStatusLocally(userId: number, status: boolean): void {
    const statusMap = this.getWelcomeVideoStatusMap();
    statusMap[userId] = status;
    localStorage.setItem(this.WELCOME_VIDEO_STATUS_KEY, JSON.stringify(statusMap));
  }

  private getHasSeenWelcomeVideoLocally(userId: number): boolean {
    const statusMap = this.getWelcomeVideoStatusMap();
    return statusMap[userId] || false;
  }
}
