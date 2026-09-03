import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

/**
 * El contador de créditos.
 *
 * Estaba copiado a mano en cada pantalla y se fue separando: en Personas y
 * Empresas era una píldora con el engranaje, y en el Historial era un texto
 * suelto con otra etiqueta y otra posición. Ahora es un solo componente, así
 * que se ve igual en todas partes.
 */
@Component({
  selector: 'app-credits-pill',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <div class="credits-pill" [class.pulse]="pulse">
      <span class="coin"><img src="/images/gear_white.png" alt="" class="coin-gear" /></span>
      <b>{{ credits | number }}</b>{{ "SEARCH.CREDITS" | translate }}
    </div>
  `,
  styleUrl: './credits-pill.component.css'
})
export class CreditsPillComponent {
  @Input() credits = 0;
  /** Se enciende un momento cuando el número cambia. */
  @Input() pulse = false;
}
