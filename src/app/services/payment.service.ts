import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiConfigService } from './api-config.service';

interface PaymentLinkResponse {
  url: string;
}

@Injectable({
  providedIn: 'root'
})
export class PaymentService {

  constructor(private http: HttpClient, private apiConfig: ApiConfigService) { }

  createPaymentLink(payload: any): Observable<PaymentLinkResponse> {
    const url = `${this.apiConfig.paymentUrl}`;
    return this.http.post<PaymentLinkResponse>(url, payload);
  }
}
