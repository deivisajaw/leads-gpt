import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-payment-link-modal',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './payment-link-modal.component.html',
  styleUrls: ['./payment-link-modal.component.css']
})
export class PaymentLinkModalComponent implements OnInit {

  // Al generarse el link lo abrimos de una vez; el modal queda como respaldo
  // por si el navegador bloquea la pestana (popup blocker).
  autoOpened = false;

  ngOnInit(): void {
    if (this.paymentUrl) {
      const win = window.open(this.paymentUrl, '_blank');
      this.autoOpened = !!win && !win.closed;
    }
  }


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
