import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CompanyMember } from '../../../services/company-data.service';

@Component({
  selector: 'app-edit-priority-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './edit-priority-modal.component.html',
  styleUrls: ['./edit-priority-modal.component.css']
})
export class EditPriorityModalComponent implements OnChanges {
  @Input() showModal: boolean = false;
  @Input() member: CompanyMember | null = null;
  @Input() currentPriority: number = 0;
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<number>();

  newPriority: number = 0;
  errorMessage: string | null = null;
  isLoading: boolean = false; 

  constructor(private translate: TranslateService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['showModal'] && changes['showModal'].currentValue === true) {
      this.newPriority = this.currentPriority; 
      this.errorMessage = null; 
      this.isLoading = false; 
    } else if (changes['currentPriority'] && changes['currentPriority'].currentValue !== changes['currentPriority'].previousValue && this.showModal) {
      this.newPriority = changes['currentPriority'].currentValue;
    }
  }

  onSave(): void {
    this.errorMessage = null;

    if (this.newPriority === null || isNaN(this.newPriority)) {
      this.errorMessage = this.translate.instant('EDIT_PRIORITY_MODAL.ERROR_INVALID_NUMBER'); 
      return;
    }

    if (!Number.isInteger(this.newPriority)) {
      this.errorMessage = this.translate.instant('EDIT_PRIORITY_MODAL.ERROR_NOT_INTEGER'); 
      return;
    }

    if (this.newPriority < 0) { 
      this.errorMessage = this.translate.instant('EDIT_PRIORITY_MODAL.ERROR_NEGATIVE_NUMBER');
      return;
    }

    this.save.emit(this.newPriority);
  }

  onClose(): void {
    this.errorMessage = null; 
    this.isLoading = false; 
    this.close.emit();
  }

  setLoading(loading: boolean): void {
    this.isLoading = loading;
  }

  setErrorMessage(message: string | null): void {
    this.errorMessage = message;
  }
}
