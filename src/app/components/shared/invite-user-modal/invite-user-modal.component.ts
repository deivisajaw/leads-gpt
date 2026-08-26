import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CompanyDataService } from '../../../services/company-data.service';

@Component({
  selector: 'app-invite-user-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './invite-user-modal.component.html',
  styleUrls: ['./invite-user-modal.component.css']
})
export class InviteUserModalComponent {
  @Input() showModal: boolean = false;
  @Output() close = new EventEmitter<void>();
  @Output() inviteSuccess = new EventEmitter<string>();

  userEmail: string = '';
  expiresAt: string = '';
  isLoading: boolean = false;
  errorMessage: string | null = null;

  constructor(private companyDataService: CompanyDataService,
              private translate: TranslateService 
  ) {}

  get isEmailValid(): boolean {
    if (!this.userEmail) {
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(this.userEmail);
  }

  async onInvite(): Promise<void> {
    if (!this.isEmailValid) {
      this.errorMessage = this.translate.instant('INVITE_USER_MODAL.ERROR_INVALID_EMAIL'); 
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;

    try {
      await this.companyDataService.generateInvitationCode(this.userEmail, this.expiresAt);
      this.inviteSuccess.emit(this.userEmail);
      this.onClose();
    } catch (e: any) {
      this.errorMessage = e.message || this.translate.instant('INVITE_USER_MODAL.ERROR_UNEXPECTED');
    } finally {
      this.isLoading = false;
    }
  }

  onClose(): void {
    this.userEmail = '';
    this.expiresAt = '';
    this.isLoading = false;
    this.errorMessage = null;
    this.close.emit();
  }
}