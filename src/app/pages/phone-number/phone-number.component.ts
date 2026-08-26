import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core'; 

import { AuthService } from '../../services/auth.service';
import { UserProfile } from '../../models/user-profile.model';
import { PhoneNumberService, PhoneNumber } from '../../services/phone-number.service';
import { AcquirePhoneNumberModalComponent } from '../../components/acquire-phone-number-modal/acquire-phone-number-modal.component';
import { OnboardingService } from '../../services/onboarding.service'; 

export interface AlertMessage {
  type: "success" | "error";
  text: string;
}

@Component({
  selector: 'app-phone-number',
  standalone: true,
  imports: [CommonModule, FormsModule, AcquirePhoneNumberModalComponent, TranslateModule], 
  templateUrl: './phone-number.component.html',
  styleUrls: ['./phone-number.component.css']
})
export class PhoneNumberComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private phoneNumberService = inject(PhoneNumberService);
  private translate = inject(TranslateService); // Inject TranslateService
  private onboardingService = inject(OnboardingService); // NEW INJECTION

  phoneNumbers: PhoneNumber[] = [];
  alertMessage: AlertMessage | null = null;
  isAcquireModalVisible = false;
  
  userProfile: UserProfile | null = null;
  companyDataId: number | null = null;
  isUserAdmin = false;
  hasFreeSubscription = false;
  currentPhoneNumbersCount = 0;

  private userProfileSubscription: Subscription | undefined;

  ngOnInit(): void {
    this.userProfileSubscription = this.authService.userProfile$.subscribe(profile => {
      this.userProfile = profile;
      if (profile && profile.companyProfile) {
        this.companyDataId = profile.companyProfile.companyId;
        this.isUserAdmin = this.authService.isAdmin;
        this.hasFreeSubscription = this.authService.hasFreeSubscription;
        this.loadPhoneNumbers();
      } else {
        this.phoneNumbers = [];
        this.currentPhoneNumbersCount = 0;
      }
    });
  }

  ngOnDestroy(): void {
    this.userProfileSubscription?.unsubscribe();
  }

  async loadPhoneNumbers(): Promise<void> {
    if (!this.companyDataId) {
      this.showAlert("error", this.translate.instant("PHONE_NUMBERS.ERROR_COMPANY_ID_MISSING"));
      return;
    }
    try {
      this.phoneNumbers = await this.phoneNumberService.getCompanyPhoneNumbers(this.companyDataId);
      this.currentPhoneNumbersCount = this.phoneNumbers.length;
    } catch (err: any) {
      console.error("Error loading phone numbers:", err);
      this.showAlert("error", err.message || this.translate.instant("PHONE_NUMBERS.ERROR_LOADING_NUMBERS"));
    }
  }

  canRequestNewNumber(): boolean {
    if (!this.isUserAdmin) {
      return false; 
    }
    if (this.hasFreeSubscription) {
      return this.currentPhoneNumbersCount < 1; 
    }
    return true; 
  }

  getNewNumberButtonTooltip(): string {
    if (this.canRequestNewNumber()) {
      return ''; // Button is enabled, no tooltip needed
    }
    if (!this.isUserAdmin) {
      return this.translate.instant("PHONE_NUMBERS.TOOLTIP_NOT_ADMIN");
    }
    if (this.hasFreeSubscription && this.currentPhoneNumbersCount >= 1) {
      return this.translate.instant("PHONE_NUMBERS.TOOLTIP_FREE_PLAN_LIMIT");
    }
    // Fallback, though canRequestNewNumber should cover all disabled states
    return this.translate.instant("PHONE_NUMBERS.TOOLTIP_GENERIC_LIMIT");
  }

  showAcquireModal(): void {
    if (!this.canRequestNewNumber()) {
      this.showAlert("error", this.translate.instant("PHONE_NUMBERS.ERROR_CANNOT_REQUEST_MORE"));
      return;
    }
    this.isAcquireModalVisible = true;
  }

  hideAcquireModal(): void {
    this.isAcquireModalVisible = false;
  }

  async handleAcquireCompletion(selectedNumber: string): Promise<void> {
    this.hideAcquireModal();
    if (!selectedNumber || !this.companyDataId) {
      this.showAlert("error", this.translate.instant("PHONE_NUMBERS.ERROR_NUMBER_OR_COMPANY_MISSING"));
      return;
    }

    try {
      const result = await this.phoneNumberService.acquirePhoneNumber(selectedNumber, this.companyDataId);
      this.showAlert("success", result.success || this.translate.instant("PHONE_NUMBERS.SUCCESS_ACQUIRED", { number: selectedNumber }));

      //this.showAlert("success", this.translate.instant("PHONE_NUMBERS.SUCCESS_ACQUIRED", { number: selectedNumber }));

      this.loadPhoneNumbers(); 
      this.onboardingService.completeOnboardingStepByKey('REQUEST_PHONE_NUMBER');
    } catch (err: any) {
      console.error("Error acquiring phone number:", err);
      this.showAlert("error", err.message || this.translate.instant("PHONE_NUMBERS.ERROR_ACQUIRING_NUMBER"));
    }
  }

  showAlert(type: "success" | "error", text: string): void {
    this.alertMessage = { type, text };
    setTimeout(() => {
      this.alertMessage = null;
    }, 5000);
  }
}
