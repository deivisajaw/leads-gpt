import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Deal, DealNote, DealStageConfig } from '../../services/deals.service';
import { DealsService } from '../../services/deals.service';
import { NotificationService } from '../../services/notification.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

/** Un evento ya interpretado, listo para pintar en la línea de tiempo. */
export interface TimelineEvent {
  id: number;
  kind: 'meeting' | 'ai' | 'call' | 'message' | 'note';
  /** Título corto. Si viene de la nota cruda, es su primera línea. */
  title: string;
  /** Pares etiqueta/valor extraídos del cuerpo (Plan:, Fecha:, etc.). */
  fields: { label: string; value: string; href?: string }[];
  /** Lo que no cayó en un par etiqueta/valor. */
  body: string;
  /** Enlace de videollamada, si lo hay. */
  meetUrl?: string;
  author?: string;
  date: string;
  /** La IA lo escribió (vs. una persona). */
  byAi: boolean;
}

@Component({
  selector: 'app-deal-detail-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './deal-detail-modal.component.html',
  styleUrls: ['./deal-detail-modal.component.css'],
})
export class DealDetailModalComponent {
  @Input() deal: Deal | null = null;
  /**
   * Las etapas reales del tablero, ya ordenadas por sortOrder. Vienen de
   * getStageConfigs() del backend — NO se hardcodean aquí, para que quitar o
   * agregar una etapa en Axelor se refleje solo en la barra de progreso.
   */
  @Input() stages: DealStageConfig[] = [];
  @Output() closeModal = new EventEmitter<void>();

  noteForm: FormGroup;
  isSubmitting = false;

  constructor(
    private fb: FormBuilder,
    private dealsService: DealsService,
    private notificationService: NotificationService,
    private translate: TranslateService
  ) {
    this.noteForm = this.fb.group({ noteText: ['', Validators.required] });
  }

  onClose(): void { this.closeModal.emit(); }

  // ── Barra de etapas ────────────────────────────────────────────────────────

  /** Posición de la etapa del trato dentro de las etapas reales del tablero. */
  get stageIndex(): number {
    if (!this.deal || !this.stages.length) return -1;
    const byId = this.stages.findIndex(s => s.id === this.deal!.stageConfigId);
    if (byId >= 0) return byId;
    // Respaldo por código, por si el trato trae una etapa que ya no está.
    return this.stages.findIndex(s => s.code === this.deal!.stageCode);
  }

  trackStage = (_: number, s: DealStageConfig) => s.id;

  stageState(i: number): 'done' | 'now' | 'todo' {
    const cur = this.stageIndex;
    if (cur < 0) return 'todo';
    return i < cur ? 'done' : i === cur ? 'now' : 'todo';
  }

  // ── Interpretación de las notas ────────────────────────────────────────────

  /**
   * La IA escribe las notas como texto plano con forma de bloque:
   *
   *   Reunión con Camilo Agreda
   *     Email: alguien@correo.com
   *     Plan: AI-Powered Growth Assessment
   *     Fecha: 21 Jul 2026 - 10:30 AM
   *     Enlace de reunión:
   *     https://meet.google.com/xoj-jknj-koj
   *
   * Pintarlo crudo lo convierte en un log ilegible. Aquí lo partimos en
   * título + pares etiqueta/valor + enlace, sin tocar el backend: el campo
   * sigue siendo un `note: string` cualquiera.
   */
  get events(): TimelineEvent[] {
    const notes = this.deal?.notes ?? [];
    return notes.map(n => this.parseNote(n));
  }

  /** ¿La línea es "Etiqueta: valor"? Una URL no lo es, aunque tenga dos puntos. */
  private isLabelLine(line: string): boolean {
    if (/^https?:\/\//i.test(line)) return false;
    return /^[^\s:][^:]{0,29}:/.test(line);
  }

  private parseNote(n: DealNote): TimelineEvent {
    const raw = (n.note || '').replace(/\r/g, '');
    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);

    const title = lines.length ? lines[0] : this.translate.instant('DEAL_DETAIL_MODAL.EV_NOTE');
    const fields: TimelineEvent['fields'] = [];
    const rest: string[] = [];
    let meetUrl: string | undefined;

    const MEET = /meet\.google|zoom\.us|teams\.microsoft|whereby|meet\.jit/;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];

      // 1. Línea que es solo una URL. Si es de videollamada la guardamos para
      //    el botón; si no, va al cuerpo. Nunca se parsea como "etiqueta: valor"
      //    (si no, "https://..." saldría como un campo llamado "https").
      if (/^https?:\/\//i.test(line)) {
        if (MEET.test(line)) meetUrl = line;
        else rest.push(line);
        continue;
      }

      // 2. "Etiqueta: valor". Si el valor viene vacío, la IA suele partirlo en
      //    dos líneas — tomamos la siguiente SOLO si no es otra etiqueta.
      if (this.isLabelLine(line)) {
        const idx = line.indexOf(':');
        const label = line.slice(0, idx).trim();
        let value = line.slice(idx + 1).trim();

        if (!value && i + 1 < lines.length && !this.isLabelLine(lines[i + 1])) {
          value = lines[++i].trim();
        }
        if (!value) continue;                       // etiqueta sin dato: se omite

        // Si el valor resultó ser el enlace de la reunión, no lo repetimos como
        // campo: ya sale como botón "Unirse a la reunión".
        if (/^https?:\/\//i.test(value) && MEET.test(value)) { meetUrl = value; continue; }

        const href = /^https?:\/\//i.test(value) ? value
                   : /^[^@\s]+@[^@\s]+\.\w+$/.test(value) ? 'mailto:' + value
                   : undefined;
        fields.push({ label, value, href });
        continue;
      }

      rest.push(line);
    }

    return {
      id: n.id,
      kind: this.kindOf(raw, n.author),
      title,
      fields,
      body: rest.join(' '),
      meetUrl,
      author: n.author,
      date: n.date,
      byAi: this.isAiAuthor(n.author),
    };
  }

  /** Deducimos el tipo por lo que dice la nota; sin tipo en el backend todavía. */
  private kindOf(raw: string, author?: string): TimelineEvent['kind'] {
    const t = raw.toLowerCase();
    if (/reuni[oó]n|meeting|agend|meet\.google|zoom\.us|calendly/.test(t)) return 'meeting';
    if (/llamada|call|marcaci[oó]n|duraci[oó]n/.test(t)) return 'call';
    if (/whatsapp|mensaje|sms|instagram|respondi/.test(t)) return 'message';
    if (this.isAiAuthor(author)) return 'ai';
    return 'note';
  }

  private isAiAuthor(author?: string): boolean {
    return /\b(ia|ai|bot|agente|ajaw)\b/i.test(author || '');
  }

  trackEvent = (_: number, e: TimelineEvent) => e.id;

  // ── Guardar nota ───────────────────────────────────────────────────────────

  async addNote(): Promise<void> {
    if (this.noteForm.invalid || !this.deal) return;
    this.isSubmitting = true;
    const noteText: string = this.noteForm.value.noteText;
    try {
      const newNote: DealNote = await this.dealsService.addDealNote(this.deal.id, noteText);
      if (newNote && this.deal) {
        this.deal.notes.unshift(newNote);
        this.notificationService.showSuccess(
          this.translate.instant('DEAL_DETAIL_MODAL.NOTE_ADDED_SUCCESS'));
      }
      this.noteForm.reset();
    } catch (err: any) {
      console.error('Error al añadir la nota:', err);
      this.notificationService.showError(
        this.translate.instant('DEAL_DETAIL_MODAL.ERROR_ADDING_NOTE',
          { errorMessage: err.message || '' }));
    } finally {
      this.isSubmitting = false;
    }
  }
}
