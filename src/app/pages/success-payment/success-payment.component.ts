import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { RouterLink } from '@angular/router'; // Importar RouterLink

@Component({
  selector: 'app-success-payment',
  standalone: true,
  imports: [CommonModule, TranslateModule, RouterLink],
  templateUrl: './success-payment.component.html',
  styleUrls: ['./success-payment.component.css']
})
export class SuccessPaymentComponent implements OnInit {

  constructor() { }

  ngOnInit(): void {
    // No polling, just display message as per user's instruction
  }
}
