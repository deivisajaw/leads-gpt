import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { CompanyDataService } from '../../../services/company-data.service';
import { LoadingModalComponent } from '../loading-modal/loading-modal.component'; 

@Component({
  selector: 'app-edit-company-info-modal',
  standalone: true,
  imports: [CommonModule, TranslateModule, ReactiveFormsModule, LoadingModalComponent],
  templateUrl: './edit-company-info-modal.component.html',
  styleUrls: ['./edit-company-info-modal.component.css']
})
export class EditCompanyInfoModalComponent implements OnInit {
  @Input() showModal: boolean = false;
  @Input() companyId: number | null = null;
  @Input() currentCompanyName: string = '';
  @Input() currentCreditDistributionMode: string = '';
  @Input() currentMinCreditsGuaranteed: number | null | undefined = undefined; 

  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<any>(); 

  companyForm!: FormGroup;
  creditDistributionModes: string[] = ['MANUAL', 'AUTO_EQUITABLE', 'AUTO_RULE_BASED'];
  errorMessage: string | null = null;
  isLoading: boolean = false;

  constructor(private companyDataService: CompanyDataService,
              private translate: TranslateService) {}

  ngOnInit(): void {
    this.companyForm = new FormGroup({
      companyName: new FormControl(this.currentCompanyName, Validators.required),
      creditDistributionMode: new FormControl(this.currentCreditDistributionMode, Validators.required),
      minCreditsGuaranteed: new FormControl(this.currentMinCreditsGuaranteed, [Validators.min(0)]) 
    });

    this.companyForm.get('creditDistributionMode')?.valueChanges.subscribe(mode => {
      this.updateMinCreditsGuaranteedValidation(mode);
    });

    this.updateMinCreditsGuaranteedValidation(this.currentCreditDistributionMode);
  }

  ngOnChanges(): void {
    if (this.companyForm) {
      this.companyForm.patchValue({
        companyName: this.currentCompanyName,
        creditDistributionMode: this.currentCreditDistributionMode,
        minCreditsGuaranteed: this.currentMinCreditsGuaranteed 
      });
    
      this.updateMinCreditsGuaranteedValidation(this.currentCreditDistributionMode);
    }
  }

  private updateMinCreditsGuaranteedValidation(mode: string): void {
    const minCreditsControl = this.companyForm.get('minCreditsGuaranteed');
    if (minCreditsControl) {
      if (mode === 'AUTO_RULE_BASED') {
        minCreditsControl.setValidators([Validators.required, Validators.min(0)]);
        minCreditsControl.enable(); 
      } else {
        minCreditsControl.clearValidators();
        minCreditsControl.disable(); 
        minCreditsControl.setValue(0); 
      }
      minCreditsControl.updateValueAndValidity();
    }
  }

  async onSave(): Promise<void> {
    this.errorMessage = null;
    if (this.companyForm.invalid) {
      this.errorMessage = this.translate.instant('EDIT_COMPANY_INFO_MODAL.ERROR_FILL_ALL_FIELDS'); 
      return;
    }

    if (this.companyId === null) {
      this.errorMessage = this.translate.instant('EDIT_COMPANY_INFO_MODAL.ERROR_COMPANY_ID_MISSING');
      return;
    }

    this.isLoading = true;
    try {
      const formValue = this.companyForm.getRawValue();
      const minCredits = formValue.minCreditsGuaranteed ?? 0;

      const updatedCompanyData = await this.companyDataService.updateCompanyData(
        this.companyId,
        formValue.companyName,
        formValue.creditDistributionMode,
        minCredits 
      );

      this.save.emit(updatedCompanyData); 
      this.close.emit(); 
    } catch (error: any) {
      this.errorMessage = error.message || this.translate.instant('EDIT_COMPANY_INFO_MODAL.ERROR_UNEXPECTED_SAVE'); 
    } finally {
      this.isLoading = false;
    }
  }

  onClose(): void {
    this.close.emit();
    this.errorMessage = null; 
    this.companyForm.reset(); 
  }
}