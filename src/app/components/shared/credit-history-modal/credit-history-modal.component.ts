import { Component, OnInit, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CompanyDataService } from '../../../services/company-data.service';

interface CreditTransactionHistory {
  triggeredByUser: string;
  planName: string;
  transactionType: string;
  transactionDate: string;
  amount: number;
  reason: string;
  memberBalanceAfter: number;
}

@Component({
  selector: 'app-credit-history-modal',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './credit-history-modal.component.html',
  styleUrl: './credit-history-modal.component.css'
})
export class CreditHistoryModalComponent implements OnInit, OnChanges {
  @Input() showModal: boolean = false;
  @Input() memberId: number | null = null;
  @Input() memberName: string = '';
  @Output() close = new EventEmitter<void>();

  historyData: CreditTransactionHistory[] = [];
  isLoading: boolean = false;
  error: string | null = null;

  constructor(private companyDataService: CompanyDataService,
              private translate: TranslateService 
  ) { }

  ngOnInit(): void {
    if (this.showModal && this.memberId) {
      this.fetchCreditHistory();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['showModal'] && changes['showModal'].currentValue === true && this.memberId) {
      this.fetchCreditHistory();
    } else if (changes['memberId'] && changes['memberId'].currentValue !== changes['memberId'].previousValue && this.showModal) {
      this.fetchCreditHistory();
    }
  }

  async fetchCreditHistory(): Promise<void> {
    if (!this.memberId) {
      this.error = this.translate.instant('CREDIT_HISTORY_MODAL.ERROR_MEMBER_ID_MISSING'); 
      return;
    }

    this.isLoading = true;
    this.error = null;
    try {
      const response = await this.companyDataService.getMemberCreditHistory(this.memberId);
      this.historyData = response.history as CreditTransactionHistory[];
    } catch (err: any) {
      this.error = err.message || this.translate.instant('CREDIT_HISTORY_MODAL.ERROR_LOADING_HISTORY'); 
    }
    finally {
      this.isLoading = false;
    }
  }

  onClose(): void {
    this.close.emit();
    this.historyData = []; 
    this.error = null;
  }
}