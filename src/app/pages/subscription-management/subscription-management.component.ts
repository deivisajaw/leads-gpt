import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { UserProfile, SubscriptionProfile, CompanyMember } from '../../models/user-profile.model';
import { EditCompanyInfoModalComponent } from '../../components/shared/edit-company-info-modal/edit-company-info-modal.component';
import { CompanyDataService } from '../../services/company-data.service';

interface CreditTransaction {
  transactionType: string;
  amount: number;
  reason: string;
  transactionDate: string; 
  memberBalanceAfter?: number; 
  triggeredBy?: string; 
  affectedMember?: string;
}

interface SubscriptionGroup  {
  subscriptionName: string;
  isActive?: boolean; 
  transactions: CreditTransaction[];
  subscriptionId: number
}

type GroupedCreditHistoryResponse = SubscriptionGroup[];

@Component({
  selector: 'app-subscription-management',
  standalone: true,
  imports: [CommonModule, TranslateModule, EditCompanyInfoModalComponent],
  templateUrl: './subscription-management.component.html',
  styleUrls: ['./subscription-management.component.css']
})
export class SubscriptionManagementComponent implements OnInit, OnDestroy {
  private profileSubscription: Subscription | undefined;
  userProfile: UserProfile | null = null;
  showInviteUserModal: boolean = false;

  showAssignCreditsModal: boolean = false;
  selectedMemberForCredits: CompanyMember | null = null;

  showEditCompanyInfoModal: boolean = false;
  isAdmin: boolean = false;

  creditHistoryRawData: GroupedCreditHistoryResponse | null = null;
  activeSubscriptionTransactions: CreditTransaction[] = [];
  otherSubscriptionsTransactions: CreditTransaction[] = [];

  isLoadingHistory = true;
  errorHistory: string | null = null;

  currentPageActive = 1;
  itemsPerPageActive = 10;
  pagedActiveHistory: CreditTransaction[] = [];
  totalPagesActive = 0;

  
  currentPageOther = 1;
  itemsPerPageOther = 10;
  pagedOtherHistory: CreditTransaction[] = [];
  totalPagesOther = 0;

  constructor(private authService: AuthService, private router: Router, private companyDataService: CompanyDataService) {}

  ngOnInit(): void {
    this.profileSubscription = this.authService.userProfile$.subscribe(profile => {
      this.userProfile = profile;
      this.isAdmin = profile?.companyProfile?.role === 'ADMIN';
    });
    this.loadCreditHistory(); 
  }

  async loadCreditHistory(): Promise<void> {
    this.isLoadingHistory = true;
    this.errorHistory = null;
    try {
      const response = await this.companyDataService.getCreditHistoryByCompany();
      this.creditHistoryRawData = response.creditHistory; 

      if (this.creditHistoryRawData) {
        this.processCreditHistory(this.creditHistoryRawData);
      }
      this.calculatePagination('active');
      this.paginateHistory('active');
      this.calculatePagination('other');
      this.paginateHistory('other');

    } catch (err: any) {
      this.errorHistory = err.message || 'Failed to load credit history.';
    } finally {
      this.isLoadingHistory = false;
    }
  }

  processCreditHistory(data: GroupedCreditHistoryResponse): void {
    this.activeSubscriptionTransactions = [];
    this.otherSubscriptionsTransactions = [];

    for (const subGroup of data) {
      if (subGroup.isActive === true) {
        this.activeSubscriptionTransactions = subGroup.transactions;
      } else {
        this.otherSubscriptionsTransactions =
          this.otherSubscriptionsTransactions.concat(subGroup.transactions);
      }
    }

    this.activeSubscriptionTransactions.sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime());
    this.otherSubscriptionsTransactions.sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime());
  }

  calculatePagination(type: 'active' | 'other'): void {
    const data = type === 'active' ? this.activeSubscriptionTransactions : this.otherSubscriptionsTransactions;
    const itemsPerPage = type === 'active' ? this.itemsPerPageActive : this.itemsPerPageOther;

    if (type === 'active') {
      this.totalPagesActive = Math.ceil(data.length / itemsPerPage);
      this.currentPageActive = 1;
    }
    else {
      this.totalPagesOther = Math.ceil(data.length / itemsPerPage);
      this.currentPageOther = 1;
    }
  }

  paginateHistory(type: 'active' | 'other'): void {
    const data = type === 'active' ? this.activeSubscriptionTransactions : this.otherSubscriptionsTransactions;
    const currentPage = type === 'active' ? this.currentPageActive : this.currentPageOther;
    const itemsPerPage = type === 'active' ? this.itemsPerPageActive : this.itemsPerPageOther;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;

    if (type === 'active') {
      this.pagedActiveHistory = data.slice(startIndex, endIndex);
    } else {
      this.pagedOtherHistory = data.slice(startIndex, endIndex);
    }
  }

  goToPage(type: 'active' | 'other', page: number): void {
    const totalPages = type === 'active' ? this.totalPagesActive : this.totalPagesOther;
    if (page >= 1 && page <= totalPages) {
      if (type === 'active') {
        this.currentPageActive = page;
      } else {
        this.currentPageOther = page;
      }
      this.paginateHistory(type);
    }
  }

  nextPage(type: 'active' | 'other'): void {
    const currentPage = type === 'active' ? this.currentPageActive : this.currentPageOther;
    this.goToPage(type, currentPage + 1);
  }

  previousPage(type: 'active' | 'other'): void {
    const currentPage = type === 'active' ? this.currentPageActive : this.currentPageOther;
    this.goToPage(type, currentPage - 1);
  }
  
  openEditCompanyInfoModal(): void {
    this.showEditCompanyInfoModal = true;
  }

  onEditCompanyInfoModalClose(): void {
    this.showEditCompanyInfoModal = false;
  }

  onEditCompanyInfoModalSave(updatedCompanyData: any): void {
    
    if (this.userProfile && this.userProfile.companyProfile) {
     
      this.userProfile.companyProfile.companyName = updatedCompanyData.companyName;
      this.userProfile.companyProfile.creditDistributionMode = updatedCompanyData.creditDistributionMode;
      this.userProfile.companyProfile.minCreditsGuaranteed = updatedCompanyData.minCreditsGuaranteed; 

      this.authService.updateCompanyProfileData({
        companyName: updatedCompanyData.companyName,
        creditDistributionMode: updatedCompanyData.creditDistributionMode,
        minCreditsGuaranteed: updatedCompanyData.minCreditsGuaranteed 
      });
    }
    this.showEditCompanyInfoModal = false;
  }

  ngOnDestroy(): void {
    this.profileSubscription?.unsubscribe();
  }

  get currentSubscription(): SubscriptionProfile | null | undefined {
    return this.userProfile?.companyProfile?.subscription;
  }

  changePlan(): void {
    console.log("Action: Change plan");
    alert('Funcionalidad para cambiar de plan no implementada.');
  }

  buyMoreCredits(): void {
    console.log("Action: Buy More Credits");
    alert('Funcionalidad para comprar créditos no implementada.');
  }

  cancelSubscription(): void {
    console.log("Action: Cancel Subscription");
    alert('Funcionalidad para cancelar la suscripción no implementada.');
  }

  goToAdminUsers(): void {
    this.router.navigate(['/admin-users']);
  }

}