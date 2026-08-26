import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CompanyDataService, InvitationCode } from '../../../services/company-data.service';

@Component({
  selector: 'app-view-generated-codes-modal',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './view-generated-codes-modal.component.html',
  styleUrls: ['./view-generated-codes-modal.component.css']
})
export class ViewGeneratedCodesModalComponent implements OnChanges {
  @Input() showModal: boolean = false;
  @Output() close = new EventEmitter<void>();

  isLoading: boolean = false;
  error: string | null = null;
  codes: InvitationCode[] = [];

  constructor(private companyDataService: CompanyDataService,
              private translate: TranslateService 
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['showModal'] && changes['showModal'].currentValue === true) {
      this.fetchCodes();
    }
  }

  async fetchCodes(): Promise<void> {
    this.isLoading = true;
    this.error = null;
    this.codes = [];
    try {
      this.codes = await this.companyDataService.getGeneratedCodes();
    } catch (err: any) {
      this.error = err.message || this.translate.instant('VIEW_GENERATED_CODES_MODAL.ERROR_FETCHING_CODES'); 
    } finally {
      this.isLoading = false;
    }
  }

  onClose(): void {
    this.close.emit();
  }

  stringify(obj: any): string {
    return JSON.stringify(obj);
  }
}
