import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { CompanyDataService } from '../../services/company-data.service';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-redeem-invitation-code',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './redeem-invitation-code.component.html',
  styleUrls: ['./redeem-invitation-code.component.css']
})
export class RedeemInvitationCodeComponent implements OnInit {
  invitationCode: string = '';
  isLoading: boolean = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;

  constructor(private companyDataService: CompanyDataService, private router: Router, private authService: AuthService) {}

  get isCodeValid(): boolean {
    const isValid = this.invitationCode.trim().length > 0;
    return isValid;
  }

  ngOnInit(): void {
    // Any initialization logic if needed
  }

  async onRedeemCode(): Promise<void> {
    if (!this.isCodeValid) {
      this.errorMessage = 'Invitation code is required.'; // TODO: Translate
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;
    this.successMessage = null;

    try {
      const response = await this.companyDataService.redeemInvitationCode(this.invitationCode);
      this.successMessage = response.message || 'Code redeemed successfully!'; // TODO: Translate
      this.invitationCode = ''; // Clear form

      // Clear success message after 5 seconds
      setTimeout(() => {
        this.successMessage = null;
      }, 5000);

      // Refresh user profile and redirect after 5 seconds
      setTimeout(async () => { // Make the callback async
        await this.authService.refreshUserProfile(); // Await the profile refresh
        this.router.navigate(['/my-plan']); // Redirect to my-plan
      }, 5000);

    } catch (error: any) {
      this.errorMessage = error.message || 'Failed to redeem invitation code.'; // TODO: Translate
    } finally {
      this.isLoading = false;
    }
  }
}
