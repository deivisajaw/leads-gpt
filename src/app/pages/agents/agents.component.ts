import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from "@angular/common"
import { FormsModule } from "@angular/forms"
import { RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AgentService, Agent, Voice, PhoneNumber } from '../../services/agent.service';

import { QrCodeModalComponent } from '../../components/shared/qr-code-modal/qr-code-modal.component';
import { ApiConfigService } from '../../services/api-config.service';
import { OnboardingService } from '../../services/onboarding.service';

export interface AlertMessage {
  type: "success" | "error"
  key: string
  params?: Record<string, any>
}

export interface TestMessage {
  role: "user" | "agent"
  content: string
}


@Component({
  selector: "app-agents",
  standalone: true,
  templateUrl: "./agents.component.html",
  styleUrls: ["./agents.component.css"],
  imports: [CommonModule, FormsModule, QrCodeModalComponent, RouterModule, TranslateModule],
})
export class AgentsComponent implements OnInit {
  private agentService = inject(AgentService);
  private translate = inject(TranslateService);

  agents: Agent[] = []

  // ── Grid filters (search + type + direction, work independently or combined) ──
  filterSearchText = ""
  filterAgentType: "" | "voice" | "text" | "sms" = ""
  filterAgentDirection: "" | "INBOUND" | "OUTBOUND" = ""

  get filteredAgents(): Agent[] {
    const query = this.filterSearchText.trim().toLowerCase();
    return this.agents.filter(agent => {
      const matchesSearch = !query
        || (agent.name || "").toLowerCase().includes(query)
        || (agent.agentSystemName || "").toLowerCase().includes(query);
      const matchesType = !this.filterAgentType
        || (agent.agentType || "").toLowerCase() === this.filterAgentType;
      const matchesDirection = !this.filterAgentDirection
        || agent.agentDirection === this.filterAgentDirection;
      return matchesSearch && matchesType && matchesDirection;
    });
  }

  currentStep = 1
  isAgentModalVisible = false;
  isConfirmModalVisible = false;
  editingAgent: Agent | null = null;

  alertMessage: AlertMessage | null = null
  isUpdating = false
  updatingAgentId: number | null = null

  agentName = ""
  selectedAgentType: "voice" | "text" | "sms" | null = null
  selectedAgentDirection: "INBOUND" | "OUTBOUND" | null = null
  agentLanguage = ""
  agentSystemName = ""
  agentPurpose = ""
  agentDescription =
    "A structured guide for handling customer inquiries related to product sizing, shipping, costs, and city coverage in a professional and solution-oriented manner. It includes response guidelines, conversation flow, objection handling, and constraints to ensure accurate and efficient customer interactions."
  agentInstructions = ""
  agentPrompt = ""

  // ── Website AI Analysis ──────────────────────────────────────────────────
  showWebsiteModal = false;
  websiteUrl = '';
  isAnalyzingWebsite = false;
  websiteAnalysisError: string | null = null;
  websiteAnalysisProgress: string | null = null;
  // agentVoice = "" 

  voiceOptions: Voice[] = [];
  filteredVoiceOptions: Voice[] = [];
  isVoicesLoading = false;
  selectedVoiceName: string | null = null;
  selectedVoiceElevenLabsId: string | null = null;

  // Custom voice dropdown properties
  isVoiceDropdownOpen = false;
  voiceSearchTerm = '';
  private currentPreview: HTMLAudioElement | null = null;
  playingPreviewUrl: string | null = null;

  phoneNumbers: PhoneNumber[] = [];
  selectedPhoneNumberId: number | null = null;
  isPhoneNumbersLoading = false;

  get filteredPhoneNumbers(): PhoneNumber[] {
    if (!this.editingAgent) {
      return this.phoneNumbers.filter(p => !p.agent);
    } else {
      return this.phoneNumbers.filter(p => !p.agent || p.agent === this.editingAgent!.id);
    }
  }

  agentWhatsappNumber = "";

  agentOpeningLine = ""
  agentVoicemailMessage = ""

  testMessages: TestMessage[] = []
  testMessageInput = ""
  isVoiceActive = false
  voiceStatusText = "Presiona el botón para iniciar una conversación de voz"

  voicePurposeOptions = [
    "Schedule Meetings",
    "Meeting Confirmation Call",
    "Customer Service & Support",
    "Lead Qualification Call",
    "Send Reminders",
    "Debt Collection Call",
    "Other",
  ]

  textPurposeOptions = [
    "Ecommerce Sales Agent",
    "Set Up My Own Assistant",
    "Qualify Inbound Leads",
    "Support Sales Inquiries In My Ecommerce",
    "Customer Services And Support",
    "Website Q&A Assistant",
    "Schedule Meetings",
    "Confirmations",
    "Reminders",
  ]

  languageOptions = [
    { value: "es", label: "Español" },
    { value: "en", label: "English" },
  ]

  // voiceOptions = [ // Replaced by dynamic voiceOptions
  //   "Voz 1", "Voz 2", "Voz 3", "Voz 4", "Voz 5", "Voz 6", "Voz 7", "Voz 8", "Voz 9", "Voz 10"
  // ]

  purposeDisplayMap: { [key: string]: string } = {
    "schedule_meetings": "Schedule Meetings",
    "meeting_confirmation": "Meeting Confirmation Call",
    "customer_service": "Customer Service & Support",
    "lead_qualification": "Lead Qualification Call",
    "send_reminders": "Send Reminders",
    "debt_collection": "Debt Collection Call",
    "other": "Other",
    "ecommerce_sales": "Ecommerce Sales Agent",
    "setup_assistant": "Set Up My Own Assistant",
    "qualify_leads": "Qualify Inbound Leads",
    "support_sales": "Support Sales Inquiries In My Ecommerce",
    "customer_services": "Customer Services And Support",
    "website_qa": "Website Q&A Assistant",
    "confirmations": "Confirmations, Reminders"
  };

  // Instruction templates
  instructionTemplates = [
    {
      title: "Customer Service Template",
      content: `### Role
* You are a friendly AI Sales Agent assisting customers on {{Company Name}}'s eCommerce website.
* Your name is {{AI Agent Name}}.
* You have access to a knowledge base with product information, reviews, and website content to provide customers with detailed, personalized assistance.
* Your goal is to understand customer needs, use the knowledge base to recommend products, answer questions, and guide customers through the purchase process.

### Objective
* Help customers find products that suit their preferences by leveraging the vector store to provide relevant, accurate, and personalized product recommendations.

### Conversational Flow
1. Greeting:
   * Welcome the customer and introduce yourself.
   - Example: "Hi! Welcome to {{Company Name}}. I'm {{AI Agent Name}}, your virtual assistant. How can I assist you today?"

2. Understanding Needs:
   * Ask the customer what they are looking for and use the vector store to find relevant products.`,
    },
    {
      title: "Lead Qualification Template",
      content: `### Role
* You are a professional lead qualification agent for {{Company Name}}.
* Your name is {{AI Agent Name}}.
* Your goal is to qualify potential customers and gather important information about their needs and budget.

### Objective
* Identify qualified leads and schedule follow-up meetings with the sales team.

### Qualification Criteria
* Budget range
* Timeline for purchase
* Decision-making authority
* Specific needs and pain points`,
    },
  ]

  isQrModalVisible = false;
  qrCodeUrl = '';

  // Google Calendar integration - popup with polling
  calendarPopupRef: Window | null = null;
  calendarPollingAgentId: number | null = null;
  calendarPollingInterval: any = null;
  isCalendarPolling = false;

  // Post-create prompt asking if user wants to connect Google Calendar
  isConnectCalendarPromptVisible = false;
  pendingCalendarAgentId: number | null = null;

  workflowStatus: { inProgress: boolean; message: string; agentId: number | null } = {
    inProgress: false,
    message: '',
    agentId: null
  };

  // Properties for Test Call Modal
  isTestCallModalVisible: boolean = false;
  testCallAgentId: number | null = null;
  testCallContactPhone: string = '';
  testCallContactName: string = '';
  testCallContactEmail: string = '';
  isTestCallLoading: boolean = false;
  showTestCallValidationErrors: boolean = false;

  // ── Instagram Integration ────────────────────────────────────────────────
  useInstagramIntegration = false;

  instagramWorkflowError: string | null = null;

  // Post-create Instagram prompt
  isInstagramPromptVisible = false;
  pendingInstagramAgentId: number | null = null;

  useWhatsappStepOption = false;

  constructor(
    private apiConfig: ApiConfigService,
    private onboardingService: OnboardingService
  ) { }

  ngOnInit(): void {
    this.loadAgents()
    this.testMessages = [{ role: "agent", content: this.translate.instant("AGENTS.TEST_CHAT.DEFAULT_GREETING") }]
  }

  async loadAgents(): Promise<void> {
    try {
      this.agents = await this.agentService.getAgents();
    } catch (err) {
      console.error("Error loading agents:", err);
      this.showAlert("error", "AGENTS.ALERT.LOAD_AGENTS_ERROR");
    }
  }

  async loadVoices(): Promise<void> {
    if (this.voiceOptions.length > 0) {
      return;
    }
    this.isVoicesLoading = true;
    try {
      const voices = await this.agentService.getVoices();
      this.voiceOptions = voices.sort((a, b) => a.name.localeCompare(b.name));
      this.filteredVoiceOptions = [...this.voiceOptions];
    } catch (err: any) {
      console.error("Error loading voices:", err);
      this.showAlert("error", err.message || "AGENTS.ALERT.LOAD_VOICES_ERROR");
    } finally {
      this.isVoicesLoading = false;
    }
  }

  async loadPhoneNumbers(): Promise<void> {
    this.isPhoneNumbersLoading = true;
    try {
      this.phoneNumbers = await this.agentService.getPhoneNumbers();
    } catch (err: any) {
      console.error("Error loading phone numbers:", err);
      this.showAlert("error", err.message || "AGENTS.ALERT.LOAD_PHONE_NUMBERS_ERROR");
    } finally {
      this.isPhoneNumbersLoading = false;
    }
  }

  async showAgentModal(agent: Agent | null = null): Promise<void> {
    await this.loadVoices();
    await this.loadPhoneNumbers();

    if (agent) {
      this.editingAgent = agent
      this.agentName = agent.name
      this.selectedAgentType = agent.agentType.toLowerCase() as "voice" | "text";
      this.selectedAgentDirection = agent.agentDirection || null;
      this.agentLanguage = agent.language
      this.agentSystemName = agent.agentSystemName
      this.agentPurpose = agent.purpose
      this.agentInstructions = agent.instructions || ""
      this.agentDescription = agent.description || ""
      this.agentPrompt = agent.prompt
      // this.agentVoice = agent.voice // Replaced by selectedVoiceName
      this.selectedVoiceName = agent.voice; // Set selected voice by name
      // Find the elevenLabsVoiceId for editing
      const selectedVoice = this.voiceOptions.find(v => v.name === agent.voice);
      this.selectedVoiceElevenLabsId = selectedVoice ? selectedVoice.elevenLabsVoiceId : null;
      this.selectedPhoneNumberId = (agent as any).companyPhoneNumber || agent.companyPhoneNumberId || null;

      this.agentWhatsappNumber = agent.whatsappNumber || "";
      this.agentOpeningLine = agent.openingLine
      this.agentVoicemailMessage = agent.voicemailMessage || "";
      this.useInstagramIntegration = agent.hasInstagramIntegration ?? false;
    } else {
      this.resetForm()
    }
    this.isAgentModalVisible = true
    this.currentStep = 1
  }

  hideAgentModal(): void {
    this.isAgentModalVisible = false
    this.editingAgent = null
    this.currentStep = 1
    this.resetForm()
  }

  hideQrModal(): void {
    this.isQrModalVisible = false;
    this.qrCodeUrl = '';
    this.loadAgents();
    // If Calendar prompt was deferred while QR was open, show it now
    if (this.pendingCalendarAgentId !== null) {
      this.isConnectCalendarPromptVisible = true;
    }
  }

  compareWithId(id1: number | string, id2: number | string): boolean {
    return id1 != null && id2 != null && String(id1) === String(id2);
  }

  resetForm(): void {
    this.agentName = ""
    this.selectedAgentType = null
    this.selectedAgentDirection = null
    this.agentLanguage = ""
    this.agentSystemName = ""
    this.agentPurpose = ""
    this.agentDescription =
      "A structured guide for handling customer inquiries related to product sizing, shipping, costs, and city coverage in a professional and solution-oriented manner. It includes response guidelines, conversation flow, objection handling, and constraints to ensure accurate and efficient customer interactions."
    this.agentInstructions = ""
    this.agentPrompt = ""
    // this.agentVoice = "" 
    this.selectedVoiceName = null;
    this.selectedVoiceElevenLabsId = null;
    this.isVoiceDropdownOpen = false;
    this.voiceSearchTerm = '';
    this.playingPreviewUrl = null;
    this.selectedPhoneNumberId = null;

    this.agentWhatsappNumber = "";
    this.agentOpeningLine = "Hola hablo con {{contactFirstName}}?"
    this.agentVoicemailMessage = "";
    this.useInstagramIntegration = false;
    this.instagramWorkflowError = null;
    this.useWhatsappStepOption = false;
    this.testMessages = [{ role: "agent", content: "¡Hola! Soy tu nuevo agente. ¿En qué puedo ayudarte hoy?" }]
    this.testMessageInput = ""
    this.isVoiceActive = false
    this.voiceStatusText = "Presiona el botón para iniciar una conversación de voz"
  }

  // Custom Voice Dropdown Methods
  toggleVoiceDropdown(): void {
    this.isVoiceDropdownOpen = !this.isVoiceDropdownOpen;
    if (this.isVoiceDropdownOpen) {
      this.voiceSearchTerm = '';
      this.filterVoices();
    }
  }

  filterVoices(): void {
    if (!this.voiceSearchTerm) {
      this.filteredVoiceOptions = [...this.voiceOptions];
    } else {
      const searchTerm = this.voiceSearchTerm.toLowerCase();
      this.filteredVoiceOptions = this.voiceOptions.filter(
        voice =>
          voice.name.toLowerCase().includes(searchTerm) ||
          voice.gender.toLowerCase().includes(searchTerm) ||
          voice.accent.toLowerCase().includes(searchTerm)
      );
    }
  }

  selectVoice(voice: Voice): void {
    this.selectedVoiceName = voice.name;
    this.selectedVoiceElevenLabsId = voice.elevenLabsVoiceId;
    this.isVoiceDropdownOpen = false;
  }

  playVoicePreview(event: MouseEvent, url: string): void {
    event.stopPropagation();

    if (this.currentPreview && !this.currentPreview.paused) {
      this.currentPreview.pause();
      this.playingPreviewUrl = null;
      if (this.currentPreview.src === url) {
        return;
      }
    }

    this.currentPreview = new Audio(url);
    this.playingPreviewUrl = url;

    this.currentPreview.play().catch(e => {
      console.error("Error playing audio:", e);
      this.playingPreviewUrl = null;
    });

    this.currentPreview.onended = () => {
      this.playingPreviewUrl = null;
    };
  }

  // Step Navigation
  goToNextStep(): void {
    if (this.canProceedToNextStep() && this.currentStep < 3) {
      this.currentStep++
    }
  }

  goToPreviousStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--
    }
  }

  selectAgentType(type: "voice" | "text" | "sms"): void {
    if (
      (this.useInstagramIntegration || this.useWhatsappStepOption) &&
      type !== 'text'
    ) {
      return;
    }

    this.selectedAgentType = type;
    this.agentPurpose = "";

    if (type === 'sms') {
      this.selectedAgentDirection = 'OUTBOUND';
    }
    else if (type === 'text') {
      this.selectedAgentDirection = 'INBOUND';
    }
  }

  selectAgentDirection(direction: "INBOUND" | "OUTBOUND"): void {
    if (
      (this.useInstagramIntegration || this.useWhatsappStepOption) &&
      direction !== 'INBOUND'
    ) {
      return;
    }

    if (this.selectedAgentType === 'sms' && direction !== 'OUTBOUND') {
      return;
    }

    if (this.selectedAgentType === 'text' && direction !== 'INBOUND') {
      return;
    }

    this.selectedAgentDirection = direction;
  }

  onInstagramToggleChange(): void {
    if (this.useInstagramIntegration) {
      this.useWhatsappStepOption = false;
      this.selectedAgentType = 'text';
      this.selectedAgentDirection = 'INBOUND';
      this.agentPurpose = '';
    }
  }

  onWhatsappStepOptionChange(): void {
    if (this.useWhatsappStepOption) {
      this.useInstagramIntegration = false;
      this.selectedAgentType = 'text';
      this.selectedAgentDirection = 'INBOUND';
      this.agentPurpose = '';
    }
  }

  // Purpose Options
  get currentPurposeOptions(): string[] {
    return this.selectedAgentType === "voice" ? this.voicePurposeOptions : this.textPurposeOptions
  }

  // Template Management
  selectTemplate(template: any): void {
    this.agentInstructions = template.content
  }

  // Agent Testing
  sendTestMessage(): void {
    if (this.testMessageInput.trim()) {
      this.testMessages.push({ role: "user", content: this.testMessageInput })

      // Simulate agent response
      setTimeout(() => {
        const responses = [
          this.translate.instant("AGENTS.TEST_CHAT.SIM_RESPONSE_1"),
          this.translate.instant("AGENTS.TEST_CHAT.SIM_RESPONSE_2"),
          this.translate.instant("AGENTS.TEST_CHAT.SIM_RESPONSE_3"),
          this.translate.instant("AGENTS.TEST_CHAT.SIM_RESPONSE_4"),
        ]
        const randomResponse = responses[Math.floor(Math.random() * responses.length)]
        this.testMessages.push({ role: "agent", content: randomResponse })
      }, 1000)

      this.testMessageInput = ""
    }
  }

  toggleVoiceTest(): void {
    this.isVoiceActive = !this.isVoiceActive
    if (this.isVoiceActive) {
      this.voiceStatusText = "Conversación de voz activa... Habla ahora"
      // Here you would integrate with your voice API
      setTimeout(() => {
        this.voiceStatusText = "Procesando tu mensaje de voz..."
      }, 2000)
    } else {
      this.voiceStatusText = this.translate.instant("AGENTS.VOICE_STATUS.IDLE");
    }
  }

  // Test Call Modal Methods
  openTestCallModal(agentId: number): void {
    this.testCallAgentId = agentId;
    this.testCallContactPhone = '';
    this.testCallContactName = '';
    this.testCallContactEmail = '';
    this.isTestCallLoading = false;
    this.showTestCallValidationErrors = false;
    this.isTestCallModalVisible = true;
  }

  closeTestCallModal(): void {
    this.isTestCallModalVisible = false;
    this.testCallAgentId = null;
    this.testCallContactPhone = '';
    this.testCallContactName = '';
    this.testCallContactEmail = '';
    this.isTestCallLoading = false;
    this.showTestCallValidationErrors = false;
  }

  isTestCallFormValid(): boolean {
    return !!this.testCallContactPhone && !!this.testCallContactName;
  }

  async triggerTestCall(): Promise<void> {
    if (!this.isTestCallFormValid()) {
      this.showTestCallValidationErrors = true;
      this.showAlert("error", "AGENTS.ALERT.TEST_CALL_REQUIRED_FIELDS");
      return;
    }

    this.isTestCallLoading = true;
    this.showTestCallValidationErrors = false;

    const payload = {
      agentId: this.testCallAgentId!,
      contactPhone: this.testCallContactPhone,
      contactName: this.testCallContactName,
      contactEmail: this.testCallContactEmail || undefined // Only send if not empty
    };

    try {
      const response = await this.agentService.triggerTestCallWebhook(payload).toPromise(); // Convert Observable to Promise

      if (response && response.success) {
        this.showAlert("success", response.success);
      } else if (response && response.error) {
        this.showAlert("error", response.error);
      } else {
        this.showAlert("error", "AGENTS.ALERT.TEST_CALL_UNEXPECTED_RESPONSE");
      }
    } catch (error: any) {
      console.error('Error al realizar la llamada de prueba:', error);
      const errorMessage =
        error.error?.error ||
        error.message ||
        this.translate.instant("AGENTS.ERRORS.TEST_CALL_UNKNOWN");
      this.showAlert("error", "AGENTS.ALERT.TEST_CALL_ERROR", { message: errorMessage });
    } finally {
      this.isTestCallLoading = false;
      this.closeTestCallModal();
    }
  }

  // Agent CRUD Operations
  openSaveConfirmModal(): void {
    if (!this.canProceedToNextStep()) {
      this.showAlert("error", "AGENTS.ALERT.REQUIRED_FIELDS");
      return;
    }
    this.isConfirmModalVisible = true;
  }

  cancelSave(): void {
    this.isConfirmModalVisible = false;
  }

  async confirmAndSave(): Promise<void> {
    const agentData = {
      _name: this.agentName,
      _agentType: this.selectedAgentType!.toUpperCase(),
      _agentDirection: this.selectedAgentDirection,
      _language: this.agentLanguage,
      _agentSystemName: this.agentSystemName,
      _purpose: this.agentPurpose,
      _description: this.agentDescription,
      _instructions: this.agentInstructions,
      _prompt: this.agentPrompt,
      _voice: this.selectedVoiceName,
      _elevenLabsVoiceId: this.selectedVoiceElevenLabsId,
      _whatsappNumber: this.agentWhatsappNumber,
      _openingLine: this.agentOpeningLine,
      _voicemailMessage: this.agentVoicemailMessage,
      _companyPhoneNumber: this.selectedPhoneNumberId,
      _id: this.editingAgent ? this.editingAgent.id : undefined,
      _hasInstagramIntegration: this.useInstagramIntegration && this.selectedAgentType === 'text' && this.selectedAgentDirection === 'INBOUND'
    };
    const agentType = this.selectedAgentType;
    const agentName = this.agentName;
    const isEditing = !!this.editingAgent;

    this.isConfirmModalVisible = false;

    try {
      const saveResponse = await this.agentService.createAgent(agentData);

      if (saveResponse && saveResponse.agentId) {
        this.showAlert(
          "success",
          isEditing ? "AGENTS.ALERT.UPDATED_SUCCESS" : "AGENTS.ALERT.CREATED_SUCCESS"
        );
        this.hideAgentModal();
        this.loadAgents();
        this.onboardingService.completeOnboardingStepByKey('CREATE_AGENT');

        if (agentType === 'voice') {
          // VOICE → voiceBotCreatorUrl
          this.workflowStatus = {
            inProgress: true,
            message: this.translate.instant("AGENTS.WORKFLOW.CONFIGURING", { agentName: agentName }),
            agentId: saveResponse.agentId
          };
          await this.triggerVoiceBotWorkflow(saveResponse.agentId);
        }
        else if (agentType === 'sms') {
          this.workflowStatus = {
            inProgress: true,
            message: this.translate.instant("AGENTS.WORKFLOW.CONFIGURING", { agentName: agentName }),
            agentId: saveResponse.agentId
          };
          await this.triggerSmsBotWorkflow(saveResponse.agentId);
        }
        else if (agentType === 'text' && agentData._hasInstagramIntegration) {
          // TEXT + Instagram activo → instagramBotCreatorUrl ÚNICAMENTE
          // workflowStatus se activa dentro de triggerInstagramWorkflow cuando se llame
          if (!isEditing) {
            this.pendingInstagramAgentId = saveResponse.agentId;
          } else {
            this.triggerInstagramWorkflow(saveResponse.agentId);
          }
        }
        else if (agentType === 'text') {
          // TEXT sin Instagram → textBotCreatorUrl
          this.workflowStatus = {
            inProgress: true,
            message: this.translate.instant("AGENTS.WORKFLOW.CONFIGURING", { agentName: agentName }),
            agentId: saveResponse.agentId
          };
          await this.triggerTextBotWorkflow(saveResponse.agentId);
        }

        // Prompt to connect Google Calendar only when creating a new agent.
        // If QR modal is open (WhatsApp text-bot flow), defer Calendar prompt
        // until QR is closed — handled in hideQrModal().
        if (!isEditing) {
          this.pendingCalendarAgentId = saveResponse.agentId;
          if (!this.isQrModalVisible) {
            // No QR open (voice agent or text without QR) — show immediately
            this.isConnectCalendarPromptVisible = true;
          }
          // If QR is open, hideQrModal() will show Calendar prompt when user closes QR
        }
      } else {
        throw new Error(this.translate.instant("AGENTS.ERRORS.MISSING_AGENT_ID"));
      }
    } catch (err: any) {
      console.error("Error saving agent:", err);
      this.showAlert("error", "AGENTS.ALERT.SAVE_ERROR", { message: err.message });
    }
  }

  editAgent(agent: Agent): void {
    this.showAgentModal(agent)
  }

  async deleteAgent(agentId: number): Promise<void> {
    if (confirm(this.translate.instant("AGENTS.CONFIRM.DELETE_AGENT"))) {
      this.workflowStatus = {
        inProgress: true,
        message: this.translate.instant('AGENTS.DELETE.IN_PROGRESS'),
        agentId: agentId
      };
      try {
        // Step 1: Free up external resources via n8n webhook.
        // If this fails the local DB record is NOT deleted.
        await this.agentService.freeUpAgent(agentId);

        // Step 2: Delete from local DB only after external cleanup succeeded.
        await this.agentService.deleteAgent(agentId);

        this.showAlert("success", "AGENTS.ALERT.DELETE_SUCCESS");
        this.loadAgents();
      } catch (err: any) {
        console.error('[deleteAgent] Error:', err);
        this.showAlert("error", "AGENTS.ALERT.DELETE_ERROR", { message: err.message });
      } finally {
        this.workflowStatus = { inProgress: false, message: '', agentId: null };
      }
    }
  }

  canProceedToNextStep(): boolean {
    switch (this.currentStep) {
      case 1:
        const baseStep1 = !!(this.agentName && this.selectedAgentType && this.selectedAgentDirection);

        if (this.selectedAgentType === 'text') {
          return baseStep1 && (this.useInstagramIntegration || this.useWhatsappStepOption);
        }

        return baseStep1;
      case 2: {
        const baseConditions = !!(this.agentLanguage && this.agentSystemName && this.agentPurpose);
        if (this.selectedAgentType === 'voice') {
          return baseConditions && !!this.selectedVoiceName && !!this.selectedPhoneNumberId;
        }

        if (this.selectedAgentType === 'sms') {
          return baseConditions && !!this.selectedPhoneNumberId;
        }

        if (this.selectedAgentType === 'text') {
          // Instagram agents are text+INBOUND but don't require a WhatsApp number
          if (this.useInstagramIntegration) {
            return baseConditions;
          }
          return baseConditions && !!this.agentWhatsappNumber;
        }

        return false;
      }
      case 3: {
        if (this.selectedAgentType === 'sms') {
          return !!this.agentPrompt;
        }
        const baseConditions = !!(this.agentPrompt && this.agentOpeningLine);
        if (this.selectedAgentType === 'voice') {
          return baseConditions && !!this.agentVoicemailMessage;
        }
        return baseConditions;
      }
      default:
        return true;
    }
  }

  getAgentTypeIcon(type: string): string {
    if (type === "voice") return "fas fa-microphone";
    if (type === "sms") return "fas fa-sms";
    return "fas fa-comments";
  }

  getPurposeDisplayText(purposeKey: string): string {
    return this.purposeDisplayMap[purposeKey] || purposeKey;
  }

  showAlert(type: "success" | "error", key: string, params?: Record<string, any>): void {
    this.alertMessage = { type, key, params }
    setTimeout(() => {
      this.alertMessage = null
    }, 5000)
  }

  private async triggerTextBotWorkflow(agentId: number): Promise<void> {
    try {
      const response = await fetch(this.apiConfig.textBotCreatorUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ agentId: agentId })
      });

      // El webhook usa 404 para errores de negocio con body JSON — leer antes de fallar
      if (response.status === 404) {
        let errorMsg = response.statusText;
        try {
          const rawText = await response.text();
          if (rawText) {
            const errorBody = JSON.parse(rawText);
            errorMsg = errorBody?.error || errorMsg;
          }
        } catch (_) { /* body vacío o no JSON */ }
        throw new Error(errorMsg);
      }

      if (!response.ok) {
        throw new Error(`Error del servidor del workflow: ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type");

      if (contentType && contentType.includes("application/json")) {
        const result = await response.json();
        if (result.error) {
          throw new Error(result.error);
        }
        const successMessage = result.success || `Workflow para agente ${agentId} completado.`;
        this.showAlert("success", successMessage);
        // Update agent processed status in the grid
        const agentIndex = this.agents.findIndex(a => a.id === agentId);
        if (agentIndex !== -1) {
          this.agents[agentIndex].processed = true;
        }

      } else if (contentType && contentType.includes("image")) {
        const imageBlob = await response.blob();
        this.qrCodeUrl = URL.createObjectURL(imageBlob);
        this.isQrModalVisible = true;

      } else {
        throw new Error("Formato de respuesta no reconocido por el workflow.");
      }

    } catch (error: any) {
      // Intentionally NOT rethrowing — a text-bot workflow failure must not
      // block the Instagram workflow nor the Calendar/Instagram prompts.
      console.error('Error al llamar al workflow de creación de text-bot:', error);
      this.showAlert("error", "AGENTS.ALERT.WORKFLOW_ERROR", { message: error.message });
    } finally {
      this.workflowStatus = { inProgress: false, message: '', agentId: null };
    }
  }

  private async triggerVoiceBotWorkflow(agentId: number): Promise<void> {
    try {
      const response = await fetch(this.apiConfig.voiceBotCreatorUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ agentId: agentId })
      });

      // El webhook usa 404 para errores de negocio con body JSON
      if (response.status === 404) {
        let errorMsg = response.statusText;
        try {
          const rawText = await response.text();
          if (rawText) {
            const errorBody = JSON.parse(rawText);
            errorMsg = errorBody?.error || errorMsg;
          }
        } catch (_) { /* body vacío o no JSON */ }
        throw new Error(errorMsg);
      }

      if (!response.ok) {
        throw new Error(`Error del servidor del workflow de voz: ${response.statusText}`);
      }

      const result = await response.json();

      if (result && typeof result.success === 'string') {
        const successMessage = result.success || `Workflow para agente de voz ${agentId} completado.`;
        this.showAlert("success", successMessage);
        // Update agent processed status in the grid
        const agentIndex = this.agents.findIndex(a => a.id === agentId);
        if (agentIndex !== -1) {
          this.agents[agentIndex].processed = true;
        }
      } else {
        throw new Error("Formato de respuesta no reconocido por el workflow de voz.");
      }

    } catch (error: any) {
      console.error('Error al llamar al workflow de creación de voice-bot:', error);
      this.showAlert("error", "AGENTS.ALERT.WORKFLOW_VOICE_ERROR", { message: error.message });
    } finally {
      this.workflowStatus = { inProgress: false, message: '', agentId: null };
    }
  }
  // ── Instagram Workflow ─────────────────────────────────────────────────────

  private async triggerInstagramWorkflow(agentId: number): Promise<void> {
    this.workflowStatus = {
      inProgress: true,
      message: this.translate.instant('AGENTS.INSTAGRAM.WORKFLOW.CONFIGURING'),
      agentId: agentId
    };
    this.instagramWorkflowError = null;

    try {
      const response = await fetch(this.apiConfig.instagramBotCreatorUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId })
      });

      if (response.status === 404) {
        // Specific business errors returned by the n8n workflow
        // Safe parse: body may be empty on some 404 responses
        let errorMsg = 'AGENTS.INSTAGRAM.WORKFLOW.UNKNOWN_ERROR';
        try {
          const rawText = await response.text();
          if (rawText) {
            const errorBody = JSON.parse(rawText);
            errorMsg = errorBody?.error || errorMsg;
          }
        } catch (_) { /* body was empty or not JSON — keep default message */ }
        this.instagramWorkflowError = errorMsg;
        this.showAlert('error', 'AGENTS.INSTAGRAM.WORKFLOW.ERROR', { message: this.instagramWorkflowError });
        // pendingInstagramAgentId is already cleared before calling this method.
        // Store it again so acceptInstagramPrompt can retry.
        this.pendingInstagramAgentId = agentId;
        this.isInstagramPromptVisible = true;
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Success: the workflow returns the Instagram OAuth authorization URL
      const result = await response.json();

      if (result?.authorizationUrl) {
        // Open the Instagram OAuth consent popup with the authorization URL
        this.openInstagramOAuthPopup(result.authorizationUrl, agentId);
      } else if (result?.success) {
        this.showAlert('success', 'AGENTS.INSTAGRAM.WORKFLOW.SUCCESS');
        const idx = this.agents.findIndex(a => a.id === agentId);
        if (idx !== -1) { this.agents[idx] = { ...this.agents[idx], hasInstagramIntegration: true }; }
      } else {
        throw new Error('AGENTS.INSTAGRAM.WORKFLOW.UNEXPECTED_RESPONSE');
      }

    } catch (error: any) {
      console.error('Error triggering Instagram workflow:', error);
      this.instagramWorkflowError = error.message;
      this.showAlert('error', 'AGENTS.INSTAGRAM.WORKFLOW.ERROR', { message: error.message });
    } finally {
      this.workflowStatus = { inProgress: false, message: '', agentId: null };
    }
  }

  private instagramPopupRef: Window | null = null;
  private instagramPollingInterval: any = null;

  openInstagramOAuthPopup(redirectUrl: string, agentId: number): void {
    const opts = 'width=600,height=700,scrollbars=yes,resizable=yes,top=100,left=200';
    this.instagramPopupRef = window.open(redirectUrl, 'instagram-oauth', opts);

    if (!this.instagramPopupRef) {
      // Popup blocked — open in new tab
      window.open(redirectUrl, '_blank');
      this.showAlert('error', 'AGENTS.INSTAGRAM.POPUP_BLOCKED');
      return;
    }

    // NOTE: No polling implemented yet.
    // hasInstagramIntegration is a configuration flag (intent), not a connection status.
    // A real connection status field will be added to the backend in a future iteration.
    // The popup stays open until the user closes it manually.
    this.showAlert('success', 'AGENTS.INSTAGRAM.POPUP_OPENED');
  }

  private _triggerPendingInstagramIfNeeded(): void {
    if (this.pendingInstagramAgentId !== null) {
      const agentId = this.pendingInstagramAgentId;
      this.pendingInstagramAgentId = null;
      this.triggerInstagramWorkflow(agentId);
    }
  }

  acceptInstagramPrompt(): void {
    // Retry the Instagram workflow
    if (this.pendingInstagramAgentId) {
      this.isInstagramPromptVisible = false;
      this.triggerInstagramWorkflow(this.pendingInstagramAgentId);
    }
  }

  declineInstagramPrompt(): void {
    this.isInstagramPromptVisible = false;
    this.pendingInstagramAgentId = null;
    this.instagramWorkflowError = null;
  }

  stopInstagramPolling(): void {
    // No polling interval — polling disabled until backend implements
    // a real connection status field separate from hasInstagramIntegration.
    if (this.instagramPopupRef && !this.instagramPopupRef.closed) {
      this.instagramPopupRef.close();
    }
    this.instagramPopupRef = null;
  }

  // ── Google Calendar Integration ─────────────────────────────────────────

  openCalendarPopup(agentId: number): void {
    // Close any existing popup/polling before starting a new one
    this.stopCalendarPolling();

    const url = `https://n8n.ajaw.ai/webhook/connect-google?agentId=${agentId}`;
    const opts = 'width=600,height=700,scrollbars=yes,resizable=yes,top=100,left=200';
    this.calendarPopupRef = window.open(url, 'google-calendar-oauth', opts);
    this.calendarPollingAgentId = agentId;

    if (!this.calendarPopupRef) {
      // Popup was blocked - fall back to new tab
      window.open(url, '_blank');
      this.showAlert('error', 'AGENTS.CALENDAR.POPUP_BLOCKED');
      return;
    }

    this.isCalendarPolling = true;

    // Poll every 3 seconds, max 120 seconds (40 attempts)
    let attempts = 0;
    this.calendarPollingInterval = setInterval(async () => {
      attempts++;
      if (attempts >= 40) {
        this.stopCalendarPolling();
        return;
      }
      try {
        const response = await this.agentService.getAgentById(agentId);
        if (response && response.agent && response.agent.hasCalendarIntegration) {
          const idx = this.agents.findIndex(a => a.id === agentId);
          if (idx !== -1) {
            this.agents[idx] = { ...this.agents[idx], hasCalendarIntegration: true };
          }
          if (this.calendarPopupRef && !this.calendarPopupRef.closed) {
            this.calendarPopupRef.close();
          }
          this.stopCalendarPolling();
          this.showAlert('success', 'AGENTS.CALENDAR.CONNECTED_SUCCESS');
        }
      } catch (e) {
        console.error('Error polling calendar integration status:', e);
      }
    }, 3000);
  }

  stopCalendarPolling(): void {
    if (this.calendarPollingInterval) {
      clearInterval(this.calendarPollingInterval);
      this.calendarPollingInterval = null;
    }
    this.calendarPopupRef = null;
    this.calendarPollingAgentId = null;
    this.isCalendarPolling = false;
  }

  acceptConnectCalendar(): void {
    const agentId = this.pendingCalendarAgentId;
    this.isConnectCalendarPromptVisible = false;
    this.pendingCalendarAgentId = null;
    if (agentId) {
      this.openCalendarPopup(agentId);
    }
    // Calendar handled — now trigger Instagram workflow if pending
    this._triggerPendingInstagramIfNeeded();
  }

  declineConnectCalendar(): void {
    this.isConnectCalendarPromptVisible = false;
    this.pendingCalendarAgentId = null;
    // Calendar handled — now trigger Instagram workflow if pending
    this._triggerPendingInstagramIfNeeded();
  }

  // ── Website AI Analysis ────────────────────────────────────────────────────

  openWebsiteModal(): void {
    this.websiteUrl = '';
    this.websiteAnalysisError = null;
    this.showWebsiteModal = true;
  }

  closeWebsiteModal(): void {
    this.showWebsiteModal = false;
    this.isAnalyzingWebsite = false;
    this.websiteAnalysisError = null;
  }

  async analyzeWebsite(): Promise<void> {
    if (!this.websiteUrl?.trim()) {
      this.websiteAnalysisError = 'Por favor ingresa una URL valida.';
      return;
    }

    this.isAnalyzingWebsite = true;
    this.websiteAnalysisError = null;
    this.websiteAnalysisProgress = 'Visitando tu sitio web...';

    // Mensaje de progreso progresivo para que el usuario no piense que se colgó
    const progressMessages = [
      { delay: 8000, msg: 'Extrayendo informacion del sitio...' },
      { delay: 25000, msg: 'Analizando contenido con IA...' },
      { delay: 55000, msg: 'Redactando descripcion y prompt, esto puede tardar un momento...' },
      { delay: 90000, msg: 'Casi listo, finalizando...' },
    ];

    const progressTimers: any[] = [];
    progressMessages.forEach(({ delay, msg }) => {
      progressTimers.push(setTimeout(() => {
        if (this.isAnalyzingWebsite) {
          this.websiteAnalysisProgress = msg;
        }
      }, delay));
    });

    const clearTimers = () => progressTimers.forEach(t => clearTimeout(t));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minutos

    try {
      const response = await fetch(this.apiConfig.promptGeneratorUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-company-prompt-gen': '37S99uon45wXR4jgxoS7FX1XgmpQHz4m'
        },
        body: JSON.stringify({
          url: this.websiteUrl.trim(),
          language: this.agentLanguage || 'es'
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      let result: any;
      try {
        result = await response.json();
      } catch (_) {
        throw new Error('La respuesta del servidor no es valida.');
      }

      if (!response.ok || result?.error) {
        throw new Error(result?.error || `HTTP ${response.status}`);
      }

      if (result.description) {
        this.agentDescription = result.description;
      }
      if (result.salesPrompt) {
        this.agentPrompt = result.salesPrompt;
      }

      this.closeWebsiteModal();

    } catch (e: any) {
      clearTimeout(timeoutId);
      if (e.name === 'AbortError') {
        this.websiteAnalysisError = 'El analisis tardo demasiado. Intenta de nuevo o ingresa la descripcion manualmente.';
      } else {
        this.websiteAnalysisError = e.message || 'Error al analizar el sitio web. Intenta de nuevo.';
      }
    } finally {
      clearTimers();
      this.isAnalyzingWebsite = false;
      this.websiteAnalysisProgress = null;
    }
  }

  private async triggerSmsBotWorkflow(agentId: number): Promise<void> {
    try {
      const response = await fetch(this.apiConfig.smsBotCreatorUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ agentId: agentId })
      });

      // El webhook usa 404 para errores de negocio con body JSON
      if (response.status === 404) {
        let errorMsg = response.statusText;
        try {
          const rawText = await response.text();
          if (rawText) {
            const errorBody = JSON.parse(rawText);
            errorMsg = errorBody?.error || errorMsg;
          }
        } catch (_) { /* body vacío o no JSON */ }
        throw new Error(errorMsg);
      }

      if (!response.ok) {
        throw new Error(`Error del servidor del workflow de SMS: ${response.statusText}`);
      }

      const result = await response.json();

      if (result && typeof result.success === 'string') {
        const successMessage = result.success || `Workflow para agente de SMS ${agentId} completado.`;
        this.showAlert("success", successMessage);
        const agentIndex = this.agents.findIndex(a => a.id === agentId);
        if (agentIndex !== -1) {
          this.agents[agentIndex].processed = true;
        }
      } else {
        throw new Error("Formato de respuesta no reconocido por el workflow de SMS.");
      }

    } catch (error: any) {
      console.error('Error al llamar al workflow de creación de sms-bot:', error);
      this.showAlert("error", "AGENTS.ALERT.WORKFLOW_SMS_ERROR", { message: error.message });
    } finally {
      this.workflowStatus = { inProgress: false, message: '', agentId: null };
    }
  }
}