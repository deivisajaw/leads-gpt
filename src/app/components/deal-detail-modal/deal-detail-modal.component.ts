import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Deal, DealNote } from '../../services/deals.service';
import { DealsService } from '../../services/deals.service';
import { NotificationService } from '../../services/notification.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-deal-detail-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './deal-detail-modal.component.html',
  styleUrls: ['./deal-detail-modal.component.css'],
})
export class DealDetailModalComponent {
  @Input() deal: Deal | null = null;
  @Output() closeModal = new EventEmitter<void>();

  noteForm: FormGroup;
  isSubmitting = false;

  constructor(
    private fb: FormBuilder,
    private dealsService: DealsService,
    private notificationService: NotificationService,
    private translate: TranslateService
  ) {
    this.noteForm = this.fb.group({ noteText: ['', Validators.required] });
  }

  onClose(): void { this.closeModal.emit(); }

  async addNote(): Promise<void> {
    if (this.noteForm.invalid || !this.deal) return;
    this.isSubmitting = true;
    const noteText: string = this.noteForm.value.noteText;
    try {
      const newNote: DealNote = await this.dealsService.addDealNote(this.deal.id, noteText);
      if (newNote && this.deal) {
        this.deal.notes.unshift(newNote);
        this.notificationService.showSuccess(
          this.translate.instant('DEAL_DETAIL_MODAL.NOTE_ADDED_SUCCESS'));
      }
      this.noteForm.reset();
    } catch (err: any) {
      console.error('Error al añadir la nota:', err);
      this.notificationService.showError(
        this.translate.instant('DEAL_DETAIL_MODAL.ERROR_ADDING_NOTE',
          { errorMessage: err.message || '' }));
    } finally {
      this.isSubmitting = false;
    }
  }
}