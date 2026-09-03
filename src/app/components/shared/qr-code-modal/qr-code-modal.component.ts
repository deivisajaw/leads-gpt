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
            // get() en vez de instant(): instant() devuelve la CLAVE si el archivo de
    // idioma todavía no llegó, y nada en el arranque espera a que llegue.
    this.translate.get('QR_CODE_MODAL.DEFAULT_MESSAGE').subscribe(v => this.message = v);
        }
    }

    closeModal() {
        this.close.emit();
    }
}