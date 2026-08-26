import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-distribute-credits-input-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './distribute-credits-input-modal.component.html',
  styleUrls: ['./distribute-credits-input-modal.component.css']
})
export class DistributeCreditsInputModalComponent implements OnChanges {
  @Input() showModal = false;
  @Input() maxCredits = 0;
  @Input() distributionMode: 'equitable' | 'rule-based' = 'equitable';
  @Input() serverError: string | null = null;
  @Input() isLoading = false; // Now an Input
  @Output() close = new EventEmitter<void>();
  @Output() distribute = new EventEmitter<number>();

  creditsToDistribute: number = 0;
  errorMessage: string | null = null;

  constructor(private translate: TranslateService) { }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['serverError'] && changes['serverError'].currentValue) {
      this.errorMessage = this.serverError;
    }
    // Reset component state when it's opened
    if (changes['showModal'] && changes['showModal'].currentValue === true) {
      this.creditsToDistribute = this.maxCredits;
      this.errorMessage = null; 
    }
  }

  onDistribute(): void {
    this.errorMessage = null;
    if (this.creditsToDistribute <= 0) {
       this.errorMessage = this.translate.instant('DISTRIBUTE_CREDITS_INPUT_MODAL.ERROR_AMOUNT_GREATER_THAN_ZERO');
      return;
    }
    if (this.creditsToDistribute > this.maxCredits) {
      this.errorMessage = this.translate.instant('DISTRIBUTE_CREDITS_INPUT_MODAL.ERROR_AMOUNT_EXCEEDS_MAX', { maxCredits: this.maxCredits });
      return;
    }
    
    this.distribute.emit(this.creditsToDistribute);
  }

  onClose(): void {
    this.close.emit();
  }
}

