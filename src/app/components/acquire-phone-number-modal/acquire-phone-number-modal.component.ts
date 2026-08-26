import { Component, OnInit, Input, Output, EventEmitter, inject, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PhoneNumberService } from '../../services/phone-number.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core'; 

export interface AvailablePhoneNumber {
  phoneNumber: string;
  friendlyName: string;
}

@Component({
  selector: 'app-acquire-phone-number-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule], 
  templateUrl: './acquire-phone-number-modal.component.html',
  styleUrls: ['./acquire-phone-number-modal.component.css']
})
export class AcquirePhoneNumberModalComponent implements OnInit, OnChanges {
  @Input() showModal = false;
  @Output() close = new EventEmitter<void>();
  @Output() acquireNumber = new EventEmitter<string>();

  private phoneNumberService = inject(PhoneNumberService);
  private translate = inject(TranslateService); // Inject TranslateService

  isLoading = false;
  availableNumbers: AvailablePhoneNumber[] = [];
  selectedNumber: string | null = null;
  errorMessage: string | null = null;

  ngOnInit(): void {
    
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['showModal'] && changes['showModal'].currentValue === true) {
      this.loadAvailableNumbers();
    } else if (changes['showModal'] && changes['showModal'].currentValue === false) {
      this.resetModal();
    }
  }

  async loadAvailableNumbers(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = null;
    this.selectedNumber = null;
    this.availableNumbers = [];

    try {
      const numbers = await this.phoneNumberService.getAvailablePhoneNumbers();
      if (numbers && numbers.length > 0) {
        this.availableNumbers = numbers;
      } else {
        this.errorMessage = this.translate.instant("ACQUIRE_PHONE_NUMBER_MODAL.ERROR_NO_NUMBERS_AVAILABLE");
      }
    } catch (err: any) {
      console.error("Error loading available numbers:", err);
      this.errorMessage = err.message || this.translate.instant("ACQUIRE_PHONE_NUMBER_MODAL.ERROR_LOADING_AVAILABLE_NUMBERS");
    } finally {
      this.isLoading = false;
    }
  }

  selectNumber(number: string): void {
    this.selectedNumber = number;
  }

  confirmAcquire(): void {
    if (this.selectedNumber) {
      this.acquireNumber.emit(this.selectedNumber);
    } else {
      this.errorMessage = this.translate.instant("ACQUIRE_PHONE_NUMBER_MODAL.ERROR_NO_NUMBER_SELECTED");
    }
  }

  closeModal(): void {
    this.close.emit();
  }

  private resetModal(): void {
    this.isLoading = false;
    this.availableNumbers = [];
    this.selectedNumber = null;
    this.errorMessage = null;
  }
}
