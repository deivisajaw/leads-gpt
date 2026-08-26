import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-payment-link-modal',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './payment-link-modal.component.html',
  styleUrls: ['./payment-link-modal.component.css']
})
export class PaymentLinkModalComponent {

  @Input() paymentUrl: string = '';
  @Output() close = new EventEmitter<void>();

  constructor() { }

  openPaymentLink(): void {
    window.open(this.paymentUrl, '_blank');
    this.close.emit();
  }

  closeModal(): void {
    this.close.emit();
  }
}
