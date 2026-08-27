import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CampaignService, CampaignCreationData, Lead, Campaign, Agent, TimezoneOption } from '../../services/campaign.service';
import { NotificationService } from '../../services/notification.service';
import { OnboardingService } from "../../services/onboarding.service";
import { ApiConfigService } from '../../services/api-config.service';

@Component({
  selector: 'app-campaigns',
  standalone: true,
  templateUrl: './campaigns.component.html',
  styleUrls: ['./campaigns.component.css'],
  imports: [CommonModule, FormsModule, RouterModule]
})
export class CampaignsComponent implements OnInit {

  campaigns: Campaign[] = [];

  // Metricas presentacionales calculadas sobre las campanas ya cargadas (no toca API)
  get totalCampaigns(): number { return this.campaigns.length; }
  get activeCampaigns(): number { return this.campaigns.filter(c => c.status === 'in_progress').length; }
  get totalRegisteredLeads(): number { return this.campaigns.reduce((s, c) => s + (c.registeredLeadsCount || 0), 0); }
  get totalConnectedLeads(): number { return this.campaigns.reduce((s, c) => s + (c.connectedLeadsCount || 0), 0); }
  get totalMeetings(): number { return this.campaigns.reduce((s, c) => s + (c.scheduledMeetingsCount || 0), 0); }

  // Filtros presentacionales (mismo patron que la pagina de Agentes)
  filterSearchText = '';
  filterCampaignType = '';
  filterCampaignStatus = '';

  get filteredCampaigns(): Campaign[] {
    const q = this.filterSearchText.trim().toLowerCase();
    return this.campaigns.filter(c => {
      const matchesText = !q || (c.name || '').toLowerCase().includes(q) || (c.agentName || '').toLowerCase().includes(q);
      const matchesType = !this.filterCampaignType || (c.campaignType || '').toLowerCase() === this.filterCampaignType;
      const matchesStatus = !this.filterCampaignStatus || (c.status || '').toLowerCase() === this.filterCampaignStatus;
      return matchesText && matchesType && matchesStatus;
    });
  }

  currentStep = 1;
  selectedCampaignType: string | null = null;
  selectedLeads: Lead[] = [];
  currentTargeting: string | null = null;
  isCampaignModalVisible = false;
  isLeadsSelectionModalVisible = false;
  isConfirmationModalVisible = false;
  activeTab = 'leads';
  leadsSelectionTitle = '';
  leadsToSelect: Lead[] | { people: Lead[], companies: Lead[] } = [];
  editingCampaign: Campaign | null = null;

  availableAgents: Agent[] = [];
  selectedAgentId: number | null = null;

  campaignName = '';
  startDate = '';
  endDate = '';

  availableTimezones: TimezoneOption[] = [];
  timeOptions: string[] = [];
  startTime2: string | null = null;
  endTime2: string | null = null;
  startTime3: string | null = null;
  endTime3: string | null = null;
  interval: number | null = null;

  timezone: string | null = 'America/Bogota';
  startTime: string | null = '09:00 AM';
  endTime: string | null = '06:00 PM';
  weekDays: any = {
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: true,
    sunday: true
  };

  tempSelectedLeads: Lead[] = [];
  campaignData: CampaignCreationData = { people: [], companies: [] };

  isUpdating = false;
  updatingCampaignId: number | null = null;
  alertMessage: { type: 'success' | 'error', text: string } | null = null;

  workflowStatus: { inProgress: boolean; message: string; campaignId: number | null } = {
    inProgress: false,
    message: '',
    campaignId: null
  };

  showValidationErrors: boolean = false;

  constructor(
    private campaignService: CampaignService,
    private notificationService: NotificationService,
    private onboardingService: OnboardingService,
    private apiConfig: ApiConfigService
  ) { }


  ngOnInit(): void {
    this.loadCampaigns();
    this.loadCampaignData();
    this.loadAgentsData();
    this.initializeTimezones();
    this.generateTimeOptions();
  }

  async loadCampaigns() {
    try {
      const fetchedCampaigns = await this.campaignService.getCampaigns();
      this.campaigns = fetchedCampaigns.map(campaign => ({
        ...campaign,
        processed: campaign.processed ?? false
      }));
    } catch (error) {
      console.error('Error loading campaigns:', error);
      this.campaigns = [];
    }
  }

  async loadCampaignData() {
    this.campaignData = await this.campaignService.getCampaignCreationData();
  }

  async loadAgentsData() {
    try {
      this.availableAgents = await this.campaignService.getAgents();
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
      const time = `${hour.toString().padStart(2, '0')}:00 ${ampm}`;
      this.timeOptions.push(time);
    }
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

  async showCampaignModal(campaign: Campaign | null = null): Promise<void> {
    if (campaign) {
      this.editingCampaign = campaign;
      const detailedCampaign = await this.campaignService.getCampaignDetails(campaign.id);

      this.campaignName = detailedCampaign.name;
      this.selectedCampaignType = detailedCampaign.campaignType ? detailedCampaign.campaignType.toLowerCase() : null;
      this.selectedAgentId = detailedCampaign.agent || null;
      this.startDate = detailedCampaign.startDate;
      this.endDate = detailedCampaign.endDate;
      this.timezone = detailedCampaign.timezone || 'America/Bogota';
      this.startTime = this.convertToAMPM(detailedCampaign.startTime);
      this.endTime = this.convertToAMPM(detailedCampaign.endTime);
      this.startTime2 = this.convertToAMPM(detailedCampaign.startTime2);
      this.endTime2 = this.convertToAMPM(detailedCampaign.endTime2);
      this.startTime3 = this.convertToAMPM(detailedCampaign.startTime3);
      this.endTime3 = this.convertToAMPM(detailedCampaign.endTime3);
      this.interval = detailedCampaign.period ? +detailedCampaign.period : null;
      this.selectedLeads = detailedCampaign.leads || [];

      this.weekDays = {
        monday: false,
        tuesday: false,
        wednesday: false,
        thursday: false,
        friday: false,
        saturday: false,
        sunday: false
      };
      if (detailedCampaign.daysOfWeek) {
        try {
          const days = JSON.parse(detailedCampaign.daysOfWeek);
          if (Array.isArray(days)) {
            days.forEach(day => {
              const dayKey = day.trim().toLowerCase();
              if (this.weekDays.hasOwnProperty(dayKey)) {
                this.weekDays[dayKey] = true;
              }
            });
          }
        } catch (e) {
          console.error('Could not parse daysOfWeek as JSON, falling back to comma-separated:', detailedCampaign.daysOfWeek, e);
          detailedCampaign.daysOfWeek.split(',').forEach(day => {
            const dayKey = day.trim().toLowerCase();
            if (this.weekDays.hasOwnProperty(dayKey)) {
              this.weekDays[dayKey] = true;
            }
          });
        }
      }
    } else {
      this.resetForm();
    }
    this.isCampaignModalVisible = true;
    this.currentStep = 1;
    this.showValidationErrors = false;
  }

  hideCampaignModal(): void {
    this.isCampaignModalVisible = false;
    this.editingCampaign = null;
    this.showValidationErrors = false;
  }

  showLeadsSelectionModal(title: string, data: Lead[] | { people: Lead[], companies: Lead[] }): void {
    this.leadsSelectionTitle = title;
    this.leadsToSelect = data;
    this.tempSelectedLeads = [...this.selectedLeads];
    this.isLeadsSelectionModalVisible = true;
  }

  hideLeadsSelectionModal(): void {
    this.isLeadsSelectionModalVisible = false;
  }

  showConfirmationModal(): void {
    if (!this.isStep1Valid()) {
      this.showValidationErrors = true;
      this.notificationService.showError('Por favor, complete los campos requeridos del Paso 1.');
      this.currentStep = 1;
      return;
    }
    if (!this.isStep2Valid()) {
      this.showValidationErrors = true;
      this.notificationService.showError('Por favor, complete los campos requeridos de las pestañas Leads y Programar.');

      if (this.selectedLeads.length === 0) {
        this.activeTab = 'leads';
      } else {
        this.activeTab = 'schedule';
      }
      return;
    }
    this.isConfirmationModalVisible = true;
  }

  hideConfirmationModal(): void {
    this.isConfirmationModalVisible = false;
  }

  compareWithId(id1: number | string, id2: number | string): boolean {
    return id1 != null && id2 != null && String(id1) === String(id2);
  }

  resetForm(): void {
    this.campaignName = '';
    this.selectedCampaignType = null;
    this.selectedLeads = [];
    this.tempSelectedLeads = [];
    this.currentTargeting = null;
    this.currentStep = 1;
    this.activeTab = 'leads';
    this.editingCampaign = null;
    this.selectedAgentId = null;
    this.startDate = '';
    this.endDate = '';

    this.timezone = 'America/Bogota';
    this.startTime = '09:00 AM';
    this.endTime = '06:00 PM';
    this.startTime2 = null;
    this.endTime2 = null;
    this.startTime3 = null;
    this.endTime3 = null;
    this.interval = null;
    this.weekDays = {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: true,
      sunday: true
    };
    this.showValidationErrors = false;
  }

  goToStep(stepNumber: number): void {
    if (stepNumber === 2 && !this.isStep1Valid()) {
      this.showValidationErrors = true;
      this.notificationService.showError('Por favor, complete los campos requeridos del Paso 1.');
      return;
    }
    this.currentStep = stepNumber;
  }

  switchTab(tabName: string): void {
    this.activeTab = tabName;
  }

  selectCampaignType(type: string): void {
    this.selectedCampaignType = type;
  }

  handleTargetingChange(value: string): void {
    this.currentTargeting = value;
    let title = '';
    let data: Lead[] | { people: Lead[], companies: Lead[] } = [];
    if (value === 'people') {
      title = 'Seleccionar Personas';
      data = this.campaignData.people;
    } else if (value === 'companies') {
      title = 'Seleccionar Empresas';
      data = this.campaignData.companies;
    } else if (value === 'both') {
      title = 'Seleccionar Personas y Empresas';
      data = {
        people: this.campaignData.people,
        companies: this.campaignData.companies,
      };
    } else if (value === 'csv') {
      this.triggerCsvUpload();
      return;
    }
    this.showLeadsSelectionModal(title, data);
  }

  toggleLeadSelection(item: Lead): void {
    const index = this.tempSelectedLeads.findIndex(lead => lead.id === item.id);
    if (index > -1) {
      this.tempSelectedLeads.splice(index, 1);
    } else {
      this.tempSelectedLeads.push(item);
    }
  }

  isLeadSelected(item: Lead): boolean {
    return this.tempSelectedLeads.some(lead => lead.id === item.id);
  }

  selectAllLeads(): void {
    let allLeads: Lead[] = [];
    if (Array.isArray(this.leadsToSelect)) {
      allLeads = this.leadsToSelect;
    } else {
      if (this.leadsToSelect.people) {
        allLeads.push(...this.leadsToSelect.people);
      }
      if (this.leadsToSelect.companies) {
        allLeads.push(...this.leadsToSelect.companies);
      }
    }
    this.tempSelectedLeads = [...new Map(allLeads.map(item => [item['id'], item])).values()];
  }

  deselectAllLeads(): void {
    this.tempSelectedLeads = [];
  }

  confirmLeadsSelection(): void {
    this.selectedLeads = [...this.tempSelectedLeads];
    this.hideLeadsSelectionModal();
  }

  removeLeadFromPreview(leadId: string): void {
    if (confirm('¿Estás seguro de que quieres eliminar este lead?')) {
      this.selectedLeads = this.selectedLeads.filter(
        (lead) => lead.id !== leadId
      );
    }
  }

  clearAllLeads(): void {
    this.selectedLeads = [];
  }

  triggerCsvUpload(): void {
    document.getElementById('csv-file-input')?.click();
  }

  handleFileUpload(event: any): void {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      const text = e.target.result;
      const lines = text.split('\n').map((line: string) => line.trim());
      const header = lines[0].split(',').map((h: string) => h.trim());

      if (header.join(',') !== 'name,phone,email') {
        this.notificationService.showError('El archivo CSV debe tener las columnas: name,phone,email');
        return;
      }

      const leads: Lead[] = lines.slice(1).map((line: string, index: number) => {
        const [name, phone, email] = line.split(',');
        return {
          id: `csv-${Date.now()}-${index}`,
          name,
          phone,
          email,
          type: 'csv',
        };
      });

      this.showLeadsSelectionModal('Seleccionar Leads de CSV', leads);
    };
    reader.readAsText(file);
  }

  isStep1Valid(): boolean {
    return !!this.campaignName && !!this.selectedCampaignType && this.selectedAgentId !== null;
  }

  isStep2Valid(): boolean {
    if (this.selectedLeads.length === 0) {
      return false;
    }

    if (!this.timezone || !this.startDate || !this.endDate) {
      return false;
    }

    if (!this.startTime || !this.endTime) {
      return false;
    }

    if (this.interval === null || this.interval <= 0) {
      return false;
    }

    const anyDaySelected = Object.values(this.weekDays).some(day => day === true);
    if (!anyDaySelected) {
      return false;
    }

    return true;
  }

  async publishCampaign(): Promise<void> {
    this.hideConfirmationModal();

    if (!this.isStep1Valid() || !this.isStep2Valid()) {
      this.showValidationErrors = true;
      this.notificationService.showError('Por favor, complete todos los campos requeridos y asegúrese de que la campaña sea válida.');

      if (!this.isStep1Valid()) {
        this.currentStep = 1;
      } else if (!this.isStep2Valid()) {
        this.currentStep = 2;
        if (this.selectedLeads.length === 0) {
          this.activeTab = 'leads';
        } else {
          this.activeTab = 'schedule';
        }
      }
      return;
    }

    const convertTo24Hour = (time: string | undefined | null): string | null => {
      if (!time) return null;
      const [timePart, ampm] = time.split(' ');
      let [hours, minutes] = timePart.split(':');
      let h = parseInt(hours, 10);

      if (ampm === 'PM' && h !== 12) {
        h += 12;
      } else if (ampm === 'AM' && h === 12) {
        h = 0;
      }
      return `${h.toString().padStart(2, '0')}:${minutes.padStart(2, '0')}`;
    };

    const campaignPayload = {
      name: this.campaignName,
      campaignType: this.selectedCampaignType?.toUpperCase(),
      leads: this.selectedLeads.map(lead => ({ type: lead.type, originalLeadId: lead.id, name: lead.name, phone: lead.phone, email: lead.email })),
      startDate: this.startDate,
      endDate: this.endDate,
      timezone: this.timezone,
      startTime: convertTo24Hour(this.startTime),
      endTime: convertTo24Hour(this.endTime),
      startTime2: convertTo24Hour(this.startTime2),
      endTime2: convertTo24Hour(this.endTime2),
      startTime3: convertTo24Hour(this.startTime3),
      endTime3: convertTo24Hour(this.endTime3),
      _period: this.interval,
      daysOfWeek: JSON.stringify(Object.keys(this.weekDays).filter(day => this.weekDays[day])),
      _agent: this.selectedAgentId
    };

    try {
      let response: any;
      if (this.editingCampaign) {
        response = await this.campaignService.createCampaign({ ...campaignPayload, _id: this.editingCampaign.id });
        this.notificationService.showSuccess('¡Campaña actualizada exitosamente!');
      } else {
        response = await this.campaignService.createCampaign(campaignPayload);
        this.notificationService.showSuccess('¡Campaña publicada exitosamente!');
        this.onboardingService.completeOnboardingStepByKey('CREATE_CAMPAIGN');
      }

      const campaignId = response?.campaignId || response?.data?.campaignId;
      if (campaignId) {
        const campaignIndex = this.campaigns.findIndex(c => c.id === campaignId);
        if (campaignIndex !== -1) {
          this.campaigns[campaignIndex].processed = false;
        }
      }

      this.loadCampaigns();
      this.hideCampaignModal();

      if (campaignId) {

        if (this.selectedCampaignType === 'voice') {
          this.workflowStatus = {
            inProgress: true,
            message: `Configurando campaña AI: ${this.campaignName}...`,
            campaignId: campaignId
          };

          this.campaignService.createCampaignOnWebhook(campaignId).subscribe({
            next: () => {
              this.notificationService.showSuccess(`Workflow para la campaña '${this.campaignName}' completado exitosamente.`);
              const updatedCampaignIndex = this.campaigns.findIndex(c => c.id === campaignId);
              if (updatedCampaignIndex !== -1) {
                this.campaigns[updatedCampaignIndex] = { ...this.campaigns[updatedCampaignIndex], processed: true };
              }
              this.workflowStatus = { inProgress: false, message: '', campaignId: null };
            },
            error: (error) => {
              console.error('Error al llamar al workflow de creación de campaña:', error);
              const errorMessage = error.error?.error || error.error?.message || error.message || 'Ocurrió un error desconocido.';
              this.notificationService.showError(`Error en el workflow: ${errorMessage}`);
              this.workflowStatus = { inProgress: false, message: '', campaignId: null };
            }
          });

        } else if (this.selectedCampaignType === 'sms') {
          this.workflowStatus = {
            inProgress: true,
            message: `Configurando campaña de SMS: ${this.campaignName}...`,
            campaignId: campaignId
          };

          this.campaignService.createSmsCampaignOnWebhook(campaignId).subscribe({
            next: () => {
              this.notificationService.showSuccess(`Workflow para la campaña SMS '${this.campaignName}' completado exitosamente.`);
              const updatedCampaignIndex = this.campaigns.findIndex(c => c.id === campaignId);
              if (updatedCampaignIndex !== -1) {
                this.campaigns[updatedCampaignIndex] = { ...this.campaigns[updatedCampaignIndex], processed: true };
              }
              this.workflowStatus = { inProgress: false, message: '', campaignId: null };
            },
            error: (error) => {
              console.error('Error al llamar al workflow de creación de campaña SMS:', error);
              const errorMessage = error.error?.error || error.error?.message || error.message || 'Ocurrió un error desconocido.';
              this.notificationService.showError(`Error en el workflow de SMS: ${errorMessage}`);
              this.workflowStatus = { inProgress: false, message: '', campaignId: null };
            }
          });
        }
        // Si el tipo es 'email' u otro aún no soportado, no se llama ningún webhook.

      } else {
        console.warn("La respuesta del servidor no incluyó un campaignId. No se ejecutará el webhook.");
      }

    } catch (error: any) {
      console.error('Error publishing campaign:', error);
      this.notificationService.showError(`Error al publicar la campaña: ${error.message}`);
    }
  }

  async changeStatus(campaign: Campaign, event: any): Promise<void> {
    const newStatus = event.target.value;
    const oldStatus = campaign.status;

    if (this.isUpdating) {
      event.target.value = oldStatus;
      return;
    }

    this.isUpdating = true;
    this.updatingCampaignId = campaign.id;
    this.alertMessage = null;
    campaign.status = newStatus;

    try {
      await this.campaignService.updateCampaignStatus(campaign.id, newStatus);
      this.alertMessage = { type: 'success', text: `El estado de la campaña '${campaign.name}' se actualizó a '${newStatus}' correctamente.` };
    } catch (error) {
      campaign.status = oldStatus;
      this.alertMessage = { type: 'error', text: 'Error al actualizar el estado. Por favor, inténtalo de nuevo.' };
      console.error('Error updating status:', error);
    } finally {
      this.isUpdating = false;
      this.updatingCampaignId = null;
      setTimeout(() => this.alertMessage = null, 5000);
    }
  }

  editCampaign(campaign: Campaign): void {
    this.showCampaignModal(campaign);
  }

  async deleteCampaign(campaignId: number): Promise<void> {

    if (confirm('¿Estás seguro de que quieres eliminar esta campaña?')) {
      try {
        await this.campaignService.deleteCampaign(campaignId);
        this.notificationService.showSuccess('Campaign eliminada con exito');
        this.loadCampaigns();
      } catch (error) {
        this.notificationService.showError('Error el eliminar la campaign, si la campaign tiene registros asociados como por ejemplo llamadas no podras eliminarla, elimina las llamadas primero y otros registros asociados');
        console.error('Error deleting campaign:', error);
      }
      finally {
        setTimeout(() => this.alertMessage = null, 5000);
      }
    }
  }

  isArray(obj: any): boolean {
    return Array.isArray(obj);
  }

  isLeadsObject(obj: any): obj is { people: Lead[], companies: Lead[] } {
    return obj && typeof obj === 'object' && 'people' in obj && 'companies' in obj;
  }

  getLeadTypeIcon(type: string): string {
    if (type === 'people') {
      return 'fas fa-user';
    } else if (type === 'company') {
      return 'fas fa-building';
    }
    return '';
  }

  get leadsToSelectArray(): Lead[] {
    if (Array.isArray(this.leadsToSelect)) {
      return this.leadsToSelect;
    }
    return [];
  }

  isAnyDaySelected(): boolean {
    return Object.values(this.weekDays).some(day => day === true);
  }

  getBadgeClass(campaignType: string | undefined | null): string {
    const baseClass = 'campaign-type-badge';
    let typeClass = 'badge-default'; // Start with default

    if (campaignType) {
      switch (campaignType.toUpperCase()) {
        case 'VOICE':
          typeClass = 'badge-VOICE';
          break;
        case 'WHATSAPP':
          typeClass = 'badge-WHATSAPP';
          break;
        case 'EMAIL':
          typeClass = 'badge-EMAIL';
          break;
        case 'SMS':
          typeClass = 'badge-SMS';
          break;
      }
    }

    return `${baseClass} ${typeClass}`;
  }

}