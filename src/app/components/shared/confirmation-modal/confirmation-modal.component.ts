import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-confirmation-modal',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './confirmation-modal.component.html',
  styleUrls: ['./confirmation-modal.component.css']
})
export class ConfirmationModalComponent {
  @Input() showModal: boolean = false;
  @Input() title: string = 'CONFIRMATION_MODAL.DEFAULT_TITLE'; 
  @Input() message: string = 'CONFIRMATION_MODAL.DEFAULT_MESSAGE'; 
  @Input() isLoading: boolean = false;
  @Input() errorMessage: string | null = null;
  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  onConfirm(): void {
    this.confirm.emit();
  }

  onCancel(): void {
    this.cancel.emit();
  }
}
