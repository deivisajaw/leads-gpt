import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core'; 

@Component({
    selector: 'app-qr-code-modal',
    standalone: true,
    imports: [CommonModule, TranslateModule],
    templateUrl: './qr-code-modal.component.html',
    styleUrls: ['./qr-code-modal.component.css']
})
export class QrCodeModalComponent {
    @Input() showModal = false;
    @Input() imageUrl = '';
    @Input() message = '';
    @Output() close = new EventEmitter<void>();

    constructor(private translate: TranslateService){
        if (!this.message) {
            this.message = this.translate.instant('QR_CODE_MODAL.DEFAULT_MESSAGE');
        }
    }

    closeModal() {
        this.close.emit();
    }
}