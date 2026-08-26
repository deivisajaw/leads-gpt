import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CompanyDataService } from '../../services/company-data.service';
import { TranslateModule } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { ConfirmationModalComponent } from '../../components/shared/confirmation-modal/confirmation-modal.component';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-my-plan',
  standalone: true,
  imports: [CommonModule, TranslateModule, ConfirmationModalComponent],
  templateUrl: './my-plan.component.html',
  styleUrls: ['./my-plan.component.css']
})
export class MyPlanComponent implements OnInit {
  planData: any = null;
  isLoading = true;
  error: string | null = null;
  leaveSuccessMessage: string | null = null;
  showLeaveConfirmationModal = false;
  leaveError: string | null = null; // New property for modal error

  // Pagination properties
  currentPage = 1;
  itemsPerPage = 10; // You can adjust this value
  pagedCreditHistory: any[] = [];
  totalPages = 0;

  constructor(
    private companyDataService: CompanyDataService,
    private router: Router,
    private authService: AuthService
  ) { }

  ngOnInit(): void {
    this.loadPlanDetails();
  }

  async loadPlanDetails(): Promise<void> {
    this.isLoading = true;
    this.error = null;
    try {
      this.planData = await this.companyDataService.getUserPlanDetails();
      if (this.planData && this.planData.creditHistory) {
        this.calculatePagination();
        this.paginateCreditHistory();
      }
    } catch (err: any) {
      this.error = err.message || 'Failed to load plan details.';
    } finally {
      this.isLoading = false;
    }
  }

  calculatePagination(): void {
    if (this.planData && this.planData.creditHistory) {
      this.totalPages = Math.ceil(this.planData.creditHistory.length / this.itemsPerPage);
      this.currentPage = 1;
    } else {
      this.totalPages = 0;
      this.currentPage = 0;
    }
  }

  paginateCreditHistory(): void {
    if (this.planData && this.planData.creditHistory) {
      const startIndex = (this.currentPage - 1) * this.itemsPerPage;
      const endIndex = startIndex + this.itemsPerPage;
      this.pagedCreditHistory = this.planData.creditHistory.slice(startIndex, endIndex);
    } else {
      this.pagedCreditHistory = [];
    }
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.paginateCreditHistory();
    }
  }

  nextPage(): void {
    this.goToPage(this.currentPage + 1);
  }

  previousPage(): void {
    this.goToPage(this.currentPage - 1);
  }

  // Step 1: Open confirmation modal
  onLeaveTeam(): void {
    this.leaveError = null; // Clear previous errors when opening modal
    this.showLeaveConfirmationModal = true;
  }

  // Step 3: Handle confirmation
  async handleLeaveTeamConfirm(): Promise<void> {
    // Do NOT close modal here. It will close on success.
    this.isLoading = true;
    this.error = null;
    this.leaveError = null; // Clear previous errors
    try {
      const response = await this.companyDataService.leaveCompanyTeam();
      this.planData = null; // Clear the data to hide the main view
      this.leaveSuccessMessage = response.message || 'You have successfully left the team. You will be redirected in 5 seconds.';
      this.showLeaveConfirmationModal = false; // Close modal on success
      
      setTimeout(() => {
        this.leaveSuccessMessage = null; // Clear success message after 5 seconds
        this.router.navigate(['/redeem-code']);
      }, 5000);

      this.authService.refreshUserProfile(); // Refresh user profile after successful leave

    } catch (err: any) {
      this.leaveError = err.message || 'Failed to leave the team.'; // Set error for modal
      // Do NOT close modal on error
    } finally {
      this.isLoading = false;
    }
  }

  // Step 2: Handle cancellation
  handleLeaveTeamCancel(): void {
    this.showLeaveConfirmationModal = false;
  }
}

