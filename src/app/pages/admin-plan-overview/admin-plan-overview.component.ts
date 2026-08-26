import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, Subject, of } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TranslateService, TranslateModule } from '@ngx-translate/core';

interface PlanOverviewData {
  planName: string;
  creditsRefreshDate: string;
  usersCount: number;
  bonusCredits: number;
  monthlyTotalPrice: string;
  creditsUsageStartDate: string;
  creditsUsageEndDate: string;
  estimatedRenewalDate: string;
  currentCreditsUsage: number;
  totalCreditsAvailable: number;
  aiWordUsageCurrent: number;
  aiWordUsageLimit: number;
  conversationUsageCurrent: number;
  conversationUsageLimit: number;
  paymentHistory: PaymentRecord[];
  creditsInPlan: number;
}

interface PaymentRecord {
  date: string;
  description: string;
  amount: string;
  status: string;
  invoiceLink: string;
}

interface PlanOverviewViewData extends PlanOverviewData {
  planNameKey: string;
  freePlanSubtitleParams: { date: string };
  featureUsersDetailsParams: { count: number };
  featureCreditsInPlanDetailsParams: { credits: number };
  featureAddonCreditsDetailsParams: { credits: number };
  dateRangeParams: { startDate: string, endDate: string };
  estimatedRenewalParams: { dateTime: string };
  aiWordUsageDescriptionParams: { words: number };
}

@Component({
  selector: 'app-admin-plan-overview',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './admin-plan-overview.component.html',
  styleUrl: './admin-plan-overview.component.css'
})
export class AdminPlanOverviewComponent implements OnInit, OnDestroy {

  public viewData: PlanOverviewViewData | null = null;
  private destroy$ = new Subject<void>();

  public planOverviewData$: Observable<PlanOverviewData> = of({
    planName: 'Free Plan',
    creditsRefreshDate: '2025-08-08',
    usersCount: 1,
    creditsInPlan: 100,
    bonusCredits: 60,
    monthlyTotalPrice: '$0/mo',
    creditsUsageStartDate: '2025-07-08',
    creditsUsageEndDate: '2025-08-08',
    estimatedRenewalDate: '2025-08-08 02:00 AM',
    currentCreditsUsage: 0,
    totalCreditsAvailable: 160,
    aiWordUsageCurrent: 0,
    aiWordUsageLimit: 5000,
    conversationUsageCurrent: 0,
    conversationUsageLimit: 150,
    paymentHistory: [
      { date: '2025-08-08', description: 'Monthly Plan Renewal', amount: '$0.00', status: 'Completed', invoiceLink: '#' },
      { date: '2025-07-08', description: 'Free Plan Activation', amount: '$0.00', status: 'Completed', invoiceLink: '#' },
      { date: '2025-06-15', description: 'Additional Credits Purchase', amount: '$29.99', status: 'Completed', invoiceLink: '#' },
    ]
  });

  constructor(private translate: TranslateService) { }

  ngOnInit(): void {
    this.planOverviewData$
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => {
        if (data) {
          this.processAndSetViewData(data);
        }
      });

    this.translate.onLangChange
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.viewData) {
          this.planOverviewData$.pipe(takeUntil(this.destroy$)).subscribe(data => {
            if (data) {
              this.processAndSetViewData(data);
            }
          });
        }
      });
  }

  private processAndSetViewData(data: PlanOverviewData): void {
    const creditsRefreshDateFormatted = this.formatDate(data.creditsRefreshDate);
    const creditsUsageStartDateFormatted = this.formatDate(data.creditsUsageStartDate);
    const creditsUsageEndDateFormatted = this.formatDate(data.creditsUsageEndDate);
    const estimatedRenewalDateFormatted = this.formatDateTime(data.estimatedRenewalDate);

    this.viewData = {
      ...data,
      planNameKey: this.getPlanNameKey(data.planName),
      freePlanSubtitleParams: { date: creditsRefreshDateFormatted },
      featureUsersDetailsParams: { count: data.usersCount },
      featureCreditsInPlanDetailsParams: { credits: data.creditsInPlan },
      featureAddonCreditsDetailsParams: { credits: data.bonusCredits },
      dateRangeParams: { startDate: creditsUsageStartDateFormatted, endDate: creditsUsageEndDateFormatted },
      estimatedRenewalParams: { dateTime: estimatedRenewalDateFormatted },
      aiWordUsageDescriptionParams: { words: data.aiWordUsageLimit },
    };
  }

  private getPlanNameKey(planName: string): string {
    const planKeys: { [key: string]: string } = {
      'Free Plan': 'ADMIN_PLAN_OVERVIEW.FREE_PLAN_TITLE',
    };
    return planKeys[planName] || planName;
  }

  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString(this.translate.currentLang, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  private formatDateTime(dateTimeString: string): string {
    const date = new Date(dateTimeString);
    return date.toLocaleDateString(this.translate.currentLang, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}