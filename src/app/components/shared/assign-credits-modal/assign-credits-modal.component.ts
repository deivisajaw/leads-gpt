import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CompanyMember } from '../../../services/company-data.service'; 

@Component({
  selector: 'app-assign-credits-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './assign-credits-modal.component.html',
  styleUrls: ['./assign-credits-modal.component.css']
})
export class AssignCreditsModalComponent {
  @Input() showModal: boolean = false;
  @Input() member: CompanyMember | null = null;
  @Input() memberCount: number = 0; 
  @Input() maxCredits: number = 0; 
  @Input() initialCredits: number = 0; 
  @Input() titleKey: string = '';
  @Input() messageKey: string = ''; 
  @Output() close = new EventEmitter<void>();
  @Output() assign = new EventEmitter<number>();

  creditsToAssign: number = 0;
  errorMessage: string | null = null;
  isLoading: boolean = false;

  constructor(private translate: TranslateService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['maxCredits']) {
    }
    
    if (changes['showModal'] && changes['showModal'].currentValue === true) {
      this.creditsToAssign = this.initialCredits; 
      this.errorMessage = null; 
    } else if (changes['initialCredits']) {
      this.creditsToAssign = changes['initialCredits'].currentValue; 
    }
  }

  onAssign(): void {
    this.errorMessage = null; 
    
    if (this.creditsToAssign === null || isNaN(this.creditsToAssign)) {
      this.errorMessage = this.translate.instant('ASSIGN_CREDITS_MODAL.ERROR_INVALID_AMOUNT'); 
      return;
    }

    if (!Number.isInteger(this.creditsToAssign)) {
      this.errorMessage = this.translate.instant('ASSIGN_CREDITS_MODAL.ERROR_NOT_INTEGER');
      return;
    }

    if (this.creditsToAssign <= 0) {
      this.errorMessage = this.translate.instant('ASSIGN_CREDITS_MODAL.ERROR_GREATER_THAN_ZERO');
      return;
    }

    if (this.creditsToAssign > this.maxCredits) {
      this.errorMessage = this.translate.instant('ASSIGN_CREDITS_MODAL.ERROR_EXCEEDS_MAX', { maxCredits: this.maxCredits });
      return;
    }

    this.assign.emit(this.creditsToAssign);
  }

  onClose(): void {
    this.creditsToAssign = 0; // Reset input on close
    this.errorMessage = null; // Clear error on close
    this.isLoading = false; // Reset loading on close
    this.close.emit();
  }

  // Method to set loading state from parent
  setLoading(loading: boolean): void {
    this.isLoading = loading;
  }

  // Method to set error message from parent
  setErrorMessage(message: string | null): void {
    this.errorMessage = message;
  }
}
