import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import {
  AbandonedCheckoutService,
  AbandonedCheckout,
  AbandonedCheckoutAgent,
  AbandonedCheckoutStatus
} from '../../services/abandoned-checkout.service';
import { NotificationService } from '../../services/notification.service';

interface TimezoneOption {
  label: string;
  value: string;
}

@Component({
  selector: 'app-abandoned-checkout-form',
  standalone: true,
  templateUrl: './abandoned-checkout-form.component.html',
  styleUrls: ['./abandoned-checkout-form.component.css'],
  imports: [CommonModule, FormsModule, TranslateModule]
})
export class AbandonedCheckoutFormComponent implements OnInit, OnChanges {

  @Input() visible = false;
  @Input() editingRecord: AbandonedCheckout | null = null;

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<{ isNew: boolean; abandonedCheckoutId?: number }>();

  showValidationErrors = false;

  availableAgents: AbandonedCheckoutAgent[] = [];
  selectedAgentId: number | null = null;

  shopifyShopName = '';
  shopifyClientId = '';
  shopifyClientSecret = '';

  startDate = '';
  timezone: string | null = 'America/Bogota';

  availableTimezones: TimezoneOption[] = [];
  timeOptions: string[] = [];

  startTime: string | null = '09:00 AM';
  endTime: string | null = '06:00 PM';
  startTime2: string | null = null;
  endTime2: string | null = null;
  startTime3: string | null = null;
  endTime3: string | null = null;

  weekDays: any = {
    monday: true, tuesday: true, wednesday: true, thursday: true,
    friday: true, saturday: true, sunday: true
  };

  messageGeneratorPrompt = '';
  skipPromptGeneration = true;
  status: AbandonedCheckoutStatus = 'PLANNED';

  workflowStatus: { inProgress: boolean; message: string } = { inProgress: false, message: '' };

  constructor(
    private abandonedCheckoutService: AbandonedCheckoutService,
    private notificationService: NotificationService
  ) { }

  ngOnInit(): void {
    this.initializeTimezones();
    this.generateTimeOptions();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && this.visible) {
      this.showValidationErrors = false;
      this.loadAgents();
      if (this.editingRecord) {
        this.populateFromRecord();
      } else {
        this.resetForm();
      }
    }
  }

  private async populateFromRecord(): Promise<void> {
    if (!this.editingRecord) return;
    const detail = await this.abandonedCheckoutService.getAbandonedCheckoutDetails(this.editingRecord.id);

    this.shopifyShopName = detail.shopifyShopName;
    this.shopifyClientId = detail.shopifyClientId || '';
    this.shopifyClientSecret = '';
    this.selectedAgentId = detail.agent || null;
    this.startDate = detail.startDate || '';
    this.timezone = detail.timeZone || 'America/Bogota';
    this.startTime = this.convertToAMPM(detail.startTime) || '09:00 AM';
    this.endTime = this.convertToAMPM(detail.endTime) || '06:00 PM';
    this.startTime2 = this.convertToAMPM(detail.startTime2);
    this.endTime2 = this.convertToAMPM(detail.endTime2);
    this.startTime3 = this.convertToAMPM(detail.startTime3);
    this.endTime3 = this.convertToAMPM(detail.endTime3);
    this.messageGeneratorPrompt = detail.messageGeneratorPrompt || '';
    this.skipPromptGeneration = detail.skipPromptGeneration ?? true;
    this.status = detail.abandonedCheckoutStatus;

    const selectedDays: string[] = detail.daysOfWeek ? JSON.parse(detail.daysOfWeek) : [];
    this.weekDays = {
      monday: selectedDays.includes('monday'),
      tuesday: selectedDays.includes('tuesday'),
      wednesday: selectedDays.includes('wednesday'),
      thursday: selectedDays.includes('thursday'),
      friday: selectedDays.includes('friday'),
      saturday: selectedDays.includes('saturday'),
      sunday: selectedDays.includes('sunday')
    };
  }

  async loadAgents(): Promise<void> {
    try {
      this.availableAgents = await this.abandonedCheckoutService.getVoiceOutboundAgents();
    } catch (error) {
      console.error('Error loading agents:', error);
      this.availableAgents = [];
    }
  }

  initializeTimezones(): void {
    this.availableTimezones = [
      { label: '(GMT-12:00) International Date Line West', value: 'Etc/GMT+12' },
      { label: '(GMT-11:00) Midway Island, Samoa', value: 'Pacific/Midway' },
      { label: '(GMT-10:00) Hawaii', value: 'Pacific/Honolulu' },
      { label: '(GMT-09:00) Alaska', value: 'America/Anchorage' },
      { label: '(GMT-08:00) Pacific Time (US & Canada)', value: 'America/Los_Angeles' },
      { label: '(GMT-07:00) Mountain Time (US & Canada)', value: 'America/Denver' },
      { label: '(GMT-06:00) Central Time (US & Canada), Mexico City', value: 'America/Mexico_City' },
      { label: '(GMT-05:00) Eastern Time (US & Canada)', value: 'America/New_York' },
      { label: '(GMT-05:00) Bogota, Lima, Quito', value: 'America/Bogota' },
      { label: '(GMT-04:00) Atlantic Time (Canada), Caracas, La Paz', value: 'America/Caracas' },
      { label: '(GMT-03:30) Newfoundland', value: 'America/St_Johns' },
      { label: '(GMT-03:00) Buenos Aires, Georgetown', value: 'America/Argentina/Buenos_Aires' },
      { label: '(GMT-02:00) Mid-Atlantic', value: 'Etc/GMT+2' },
      { label: '(GMT-01:00) Azores, Cape Verde Is.', value: 'Atlantic/Azores' },
      { label: '(GMT+00:00) Greenwich Mean Time : Dublin, Edinburgh, Lisbon, London', value: 'Europe/London' },
      { label: '(GMT+01:00) Amsterdam, Berlin, Bern, Rome, Stockholm, Vienna', value: 'Europe/Berlin' },
      { label: '(GMT+02:00) Athens, Bucharest, Istanbul', value: 'Europe/Athens' },
      { label: '(GMT+03:00) Moscow, St. Petersburg, Volgograd', value: 'Europe/Moscow' },
      { label: '(GMT+03:30) Tehran', value: 'Asia/Tehran' },
      { label: '(GMT+04:00) Abu Dhabi, Muscat, Baku, Tbilisi', value: 'Asia/Dubai' },
      { label: '(GMT+04:30) Kabul', value: 'Asia/Kabul' },
      { label: '(GMT+05:00) Ekaterinburg, Islamabad, Karachi, Tashkent', value: 'Asia/Karachi' },
      { label: '(GMT+05:30) Chennai, Kolkata, Mumbai, New Delhi', value: 'Asia/Kolkata' },
      { label: '(GMT+05:45) Kathmandu', value: 'Asia/Kathmandu' },
      { label: '(GMT+06:00) Almaty, Novosibirsk', value: 'Asia/Almaty' },
      { label: '(GMT+06:30) Yangon (Rangoon)', value: 'Asia/Yangon' },
      { label: '(GMT+07:00) Bangkok, Hanoi, Jakarta', value: 'Asia/Bangkok' },
      { label: '(GMT+08:00) Beijing, Chongqing, Hong Kong, Urumqi', value: 'Asia/Shanghai' },
      { label: '(GMT+08:30) Eucla', value: 'Australia/Eucla' },
      { label: '(GMT+09:00) Osaka, Sapporo, Tokyo', value: 'Asia/Tokyo' },
      { label: '(GMT+09:30) Darwin', value: 'Australia/Darwin' },
      { label: '(GMT+10:00) Canberra, Melbourne, Sydney', value: 'Australia/Sydney' },
      { label: '(GMT+11:00) Magadan, Solomon Is., New Caledonia', value: 'Pacific/Guadalcanal' },
      { label: '(GMT+12:00) Auckland, Wellington, Fiji, Kamchatka', value: 'Pacific/Auckland' }
    ];
  }

  generateTimeOptions(): void {
    this.timeOptions = [];
    for (let i = 0; i < 24; i++) {
      const hour = i % 12 === 0 ? 12 : i % 12;
      const ampm = i < 12 ? 'AM' : 'PM';
      this.timeOptions.push(`${hour.toString().padStart(2, '0')}:00 ${ampm}`);
    }
  }

  private convertTo24Hour(time: string | undefined | null): string | null {
    if (!time) return null;
    const [timePart, ampm] = time.split(' ');
    let [hours, minutes] = timePart.split(':');
    let h = parseInt(hours, 10);
    if (ampm === 'PM' && h !== 12) h += 12;
    else if (ampm === 'AM' && h === 12) h = 0;
    return `${h.toString().padStart(2, '0')}:${minutes.padStart(2, '0')}`;
  }

  private convertToAMPM(time24: string | undefined | null): string | null {
    if (!time24) return null;
    const [hours, minutes] = time24.split(':');
    let h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h ? h : 12;
    return `${h.toString().padStart(2, '0')}:${minutes.padStart(2, '0')} ${ampm}`;
  }

  private resetForm(): void {
    this.shopifyShopName = '';
    this.shopifyClientId = '';
    this.shopifyClientSecret = '';
    this.selectedAgentId = null;
    this.startDate = '';
    this.timezone = 'America/Bogota';
    this.startTime = '09:00 AM';
    this.endTime = '06:00 PM';
    this.startTime2 = null;
    this.endTime2 = null;
    this.startTime3 = null;
    this.endTime3 = null;
    this.messageGeneratorPrompt = '';
    this.skipPromptGeneration = true;
    this.status = 'PLANNED';
    this.weekDays = {
      monday: true, tuesday: true, wednesday: true, thursday: true,
      friday: true, saturday: true, sunday: true
    };
  }

  isAnyDaySelected(): boolean {
    return Object.values(this.weekDays).some(day => day === true);
  }

  isFormValid(): boolean {
    if (!this.shopifyShopName) return false;
    if (!this.selectedAgentId) return false;
    if (!this.startDate || !this.timezone) return false;
    if (!this.startTime || !this.endTime) return false;
    if (!this.isAnyDaySelected()) return false;
    return true;
  }

  async save(): Promise<void> {
    if (!this.isFormValid()) {
      this.showValidationErrors = true;
      this.notificationService.showError('Por favor completa los campos requeridos.');
      return;
    }

    const payload: any = {
      shopifyShopName: this.shopifyShopName,
      shopifyClientId: this.shopifyClientId,
      timeZone: this.timezone,
      startDate: this.startDate,
      startTime: this.convertTo24Hour(this.startTime),
      endTime: this.convertTo24Hour(this.endTime),
      startTime2: this.convertTo24Hour(this.startTime2),
      endTime2: this.convertTo24Hour(this.endTime2),
      startTime3: this.convertTo24Hour(this.startTime3),
      endTime3: this.convertTo24Hour(this.endTime3),
      daysOfWeek: JSON.stringify(Object.keys(this.weekDays).filter(day => this.weekDays[day])),
      abandonedCheckoutStatus: this.status,
      messageGeneratorPrompt: this.messageGeneratorPrompt,
      skipPromptGeneration: this.skipPromptGeneration,
      _agent: this.selectedAgentId
    };

    if (this.shopifyClientSecret) {
      payload.shopifyClientSecret = this.shopifyClientSecret;
    }

    if (this.editingRecord) {
      payload._id = this.editingRecord.id;
    }

    try {
      const response = await this.abandonedCheckoutService.saveAbandonedCheckout(payload);
      const isNew = !this.editingRecord;
      this.notificationService.showSuccess(
        isNew ? 'Registro creado exitosamente.' : 'Registro actualizado exitosamente.'
      );

      const abandonedCheckoutId = response?.abandonedCheckoutId;

      if (isNew && abandonedCheckoutId) {
        await this.triggerWorkflow(abandonedCheckoutId);
      }

      this.saved.emit({ isNew, abandonedCheckoutId });
    } catch (error: any) {
      console.error('Error saving abandoned checkout:', error);
      this.notificationService.showError(`Error al guardar el registro: ${error.message}`);
    }
  }

  private triggerWorkflow(abandonedCheckoutId: number): Promise<void> {
    this.workflowStatus = { inProgress: true, message: 'Configurando el seguimiento...' };

    return new Promise((resolve) => {
      this.abandonedCheckoutService.createAbandonedCheckoutOnWebhook(abandonedCheckoutId).subscribe({
        next: (webhookResponse: any) => {
          this.notificationService.showSuccess(
            webhookResponse?.success || 'El workflow de seguimiento se configuro correctamente.'
          );
          this.workflowStatus = { inProgress: false, message: '' };
          resolve();
        },
        error: (error) => {
          console.error('Error al llamar al workflow:', error);
          const errorMessage = error.error?.error || error.message || 'Ocurrio un error desconocido.';
          this.notificationService.showError(`Error en el workflow: ${errorMessage}`);
          this.workflowStatus = { inProgress: false, message: '' };
          resolve();
        }
      });
    });
  }

  close(): void {
    this.closed.emit();
  }
}