import { Component, OnInit, inject, OnDestroy, ElementRef, ViewChild, NgZone } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CampaignService, CallOutcome } from '../../services/campaign.service'; 
import { SafeHtmlPipe } from '../../pipes/safe-html.pipe';
import { TranslateModule } from '@ngx-translate/core';
import { FormatTimePipe } from '../../pipes/format-time.pipe';

export interface Recording {
  id: number;
  dateTime: string; 
  contactName: string; 
  contactPhone: string; 
  type: 'inbound' | 'outbound'; 
  agentName: string; 
  companyPhoneNumber: string; 
  outcome: CallOutcome; 
  duration: string; 
  
  // Campos para el panel lateral
  recordingUrl?: string;
  transcription?: string;
  summary?: string;
  calLink?: string;
  appointmentDate?: string;
}

@Component({
  selector: 'app-campaign-recordings-view',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, DatePipe, SafeHtmlPipe, TranslateModule, FormatTimePipe],
  templateUrl: './campaign-recordings-view.component.html',
  styleUrl: './campaign-recordings-view.component.css'
})
export class CampaignRecordingsViewComponent implements OnInit, OnDestroy {
  @ViewChild('waveformCanvas') waveformCanvasRef!: ElementRef<HTMLCanvasElement>;
  
  @ViewChild('audioPlayer')
  set audioPlayerRef(ref: ElementRef<HTMLAudioElement> | undefined) {
    if (ref) {
      this.audioPlayer = ref.nativeElement;
      this.initializePlayer();
    }
  }

  @ViewChild('filterContactInput') filterContactInput!: ElementRef<HTMLInputElement>;

  private campaignService = inject(CampaignService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private ngZone = inject(NgZone); // Inyectar NgZone
  private debounceTimer: any;

  campaignId: number | null = null;
  campaignName: string = 'Campaña'; 
  isLoading: boolean = true;
  errorMessage: string | null = null;

  recordings: Recording[] = [];
  filteredRecordings: Recording[] = [];

  filterContact: string = '';
  filterOutcome: string = '';
  filterType: string = '';

  currentPage: number = 1;
  limit: number = 10; // Renamed from itemsPerPage for consistency
  totalPages: number = 1;
  totalRecords: number = 0; // Added totalRecords property

  // --- Propiedades para el Panel Lateral ---
  isPanelOpen: boolean = false;
  selectedRecording: Recording | null = null;
  activeTab: string = 'overview'; // 'overview' o 'transcript'

  // Audio Player Properties
  private audioPlayer!: HTMLAudioElement;
  private isPlayerInitialized = false;
  isPlaying = false;
  duration = 0;
  currentTime = 0;

  // Waveform Properties
  private waveformBars: number[] = [];
  private animationFrameId: number | null = null;

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.campaignId = +id;
        this.loadCampaignDetails(this.campaignId);
        this.loadRecordings(this.campaignId, 1); // Load first page
      } else {
        this.errorMessage = 'ID de campaña no proporcionado.';
        this.isLoading = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.stopWaveformAnimation();
    if (this.audioPlayer && this.isPlayerInitialized) {
      this.audioPlayer.removeEventListener('timeupdate', this.onTimeUpdate.bind(this));
      this.audioPlayer.removeEventListener('loadedmetadata', this.onLoadedMetadata.bind(this));
      this.audioPlayer.removeEventListener('ended', this.onEnded.bind(this));
      this.audioPlayer.removeEventListener('play', this.onPlayPause.bind(this));
      this.audioPlayer.removeEventListener('pause', this.onPlayPause.bind(this));
    }
    if (this.debounceTimer) { // Clear debounce timer on destroy
      clearTimeout(this.debounceTimer);
    }
  }

  initializePlayer(): void {
    if (this.isPlayerInitialized || !this.audioPlayer) {
      return;
    }
    this.audioPlayer.addEventListener('timeupdate', this.onTimeUpdate.bind(this));
    this.audioPlayer.addEventListener('loadedmetadata', this.onLoadedMetadata.bind(this));
    this.audioPlayer.addEventListener('ended', this.onEnded.bind(this));
    this.audioPlayer.addEventListener('play', this.onPlayPause.bind(this));
    this.audioPlayer.addEventListener('pause', this.onPlayPause.bind(this));
    this.isPlayerInitialized = true;
  }

  async loadCampaignDetails(id: number): Promise<void> {
    try {
      const campaign = await this.campaignService.getCampaignDetails(id);
      this.campaignName = campaign.name;
    } catch (error) {
      console.error('Error loading campaign details:', error);
      this.errorMessage = 'No se pudo cargar el nombre de la campaña.';
    }
  }

  async loadRecordings(campaignId: number, page: number = 1): Promise<void> {
    console.log('CampaignRecordingsViewComponent: loadRecordings - START', { page, filterContact: this.filterContact, filterOutcome: this.filterOutcome, filterType: this.filterType });
    const activeElement = document.activeElement; // Store active element
    const isFilterContactFocused = this.filterContactInput?.nativeElement === activeElement;

    this.isLoading = true;
    this.errorMessage = null;
    this.currentPage = page;
    const offset = (this.currentPage - 1) * this.limit;

    try {
      const response = await this.campaignService.getCallsByCampaign(
        campaignId,
        offset,
        this.limit,
        this.filterContact,
        this.filterOutcome,
        this.filterType
      );
      console.log('CampaignRecordingsViewComponent: loadRecordings - API Response', response);
      
      const calls = response.calls || [];

      this.totalRecords = response.total || 0;
      this.totalPages = Math.ceil(this.totalRecords / this.limit);

      this.recordings = calls.map((call: any) => ({
        id: call.id,
        dateTime: this.formatDateTime(call.startedAt),
        contactName: call.customerName || 'N/A',
        contactPhone: call.customerPhone || 'N/A',
        type: call.direction?.toLowerCase() === 'outbound' ? 'outbound' : 'inbound',
        agentName: call.agentName || 'AJAW AI',
        companyPhoneNumber: call.companyPhoneNumber || 'N/A',
        outcome: call.outcome || 'ANSWERED_NO_OUTCOME',
        duration: this.formatDuration(call.durationMs),
        
        // Campos para el panel
        recordingUrl: call.recordingUrl,
        transcription: call.transcription,
        summary: call.summary,
        calLink: call.calLink,
        appointmentDate: call.appointmentDate ? this.formatDateTime(call.appointmentDate) : undefined,
      }));
      this.filteredRecordings = this.recordings; // Server-side filtering, so just assign
    } catch (error) {
      console.error('CampaignRecordingsViewComponent: Error loading recordings:', error);
      this.errorMessage = 'No se pudieron cargar las grabaciones de la campaña.';
      this.recordings = [];
      this.filteredRecordings = [];
    } finally {
      this.isLoading = false;
      console.log('CampaignRecordingsViewComponent: loadRecordings - END');
      // Restore focus if it was on the filterContact input
      if (isFilterContactFocused && this.filterContactInput) {
        this.ngZone.runOutsideAngular(() => { // Run outside Angular to prevent extra change detection
          setTimeout(() => { // Use setTimeout to ensure DOM is updated
            this.filterContactInput.nativeElement.focus();
          }, 0);
        });
      }
    }
  }

  onFilterChange(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      if (this.campaignId) {
        this.loadRecordings(this.campaignId, 1);
      }
    }, 300);
  }

  goToPage(page: number): void {
    if (this.campaignId && page >= 1 && page <= this.totalPages) {
      this.loadRecordings(this.campaignId, page);
    }
  }

  nextPage(): void {
    if (this.campaignId && this.currentPage < this.totalPages) {
      this.loadRecordings(this.campaignId, this.currentPage + 1);
    }
  }

  prevPage(): void {
    if (this.campaignId && this.currentPage > 1) {
      this.loadRecordings(this.campaignId, this.currentPage - 1);
    }
  }

  get startRecord(): number {
    return this.totalRecords === 0 ? 0 : (this.currentPage - 1) * this.limit + 1;
  }

  get endRecord(): number {
    const end = this.currentPage * this.limit;
    return end > this.totalRecords ? this.totalRecords : end;
  }

  goBackToCampaign(): void {
    this.router.navigate(['/campaigns', this.campaignId]);
  }

  openPanel(recording: Recording): void {
    this.selectedRecording = recording;
    this.isPanelOpen = true;
    this.activeTab = 'overview';
    setTimeout(() => {
      if (this.audioPlayer && this.selectedRecording?.recordingUrl) {
        this.audioPlayer.src = this.selectedRecording.recordingUrl;
        this.audioPlayer.load();
        this.generateWaveform();
      }
    }, 0);
  }

  closePanel(): void {
    this.isPanelOpen = false;
    this.selectedRecording = null;
    this.stopWaveformAnimation();
    if (this.audioPlayer) {
      this.audioPlayer.pause();
      this.audioPlayer.currentTime = 0;
      this.audioPlayer.src = '';
      this.isPlaying = false;
      this.currentTime = 0;
      this.duration = 0;
    }
  }

  // --- Métodos del reproductor ---
  async togglePlayPause() {
    if (!this.audioPlayer || !this.isPlayerInitialized) return;
    if (!this.audioPlayer.src) return;

    if (this.isPlaying) {
      this.audioPlayer.pause();
    } else {
      try {
        await this.audioPlayer.play();
      } catch (err) {
        console.error('Error playing audio:', err);
      }
    }
  }

  private onTimeUpdate(): void {
    this.ngZone.run(() => {
      this.currentTime = this.audioPlayer.currentTime;
    });
  }

  private onLoadedMetadata(): void {
    this.ngZone.run(() => {
      this.duration = this.audioPlayer.duration;
      this.drawWaveform(); // Draw once metadata is loaded
    });
  }

  private onEnded(): void {
    this.ngZone.run(() => {
      this.audioPlayer.currentTime = 0;
      this.drawWaveform();
    });
  }
  
  private onPlayPause(): void {
    this.ngZone.run(() => {
      this.isPlaying = !this.audioPlayer.paused;
      if (this.isPlaying) {
        this.startWaveformAnimation();
      } else {
        this.stopWaveformAnimation();
      }
    });
  }

  rewind(): void {
    if (this.audioPlayer) this.audioPlayer.currentTime = Math.max(0, this.audioPlayer.currentTime - 5);
  }

  forward(): void {
    if (this.audioPlayer) this.audioPlayer.currentTime = Math.min(this.duration, this.audioPlayer.currentTime + 5);
  }

  // --- Waveform Methods ---
  generateWaveform(): void {
    if (!this.waveformCanvasRef) return;
    const barCount = 100;
    this.waveformBars = [];
    for (let i = 0; i < barCount; i++) {
      this.waveformBars.push(Math.random() * 0.7 + 0.3);
    }
    this.drawWaveform();
  }

  drawWaveform(): void {
    if (!this.waveformCanvasRef) return;
    const canvas = this.waveformCanvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    
    const barCount = this.waveformBars.length;
    const barWidth = width / barCount;
    const centerY = height / 2;
    
    const playedColor = '#007bff';
    const unplayedColor = '#b0bec5';

    const progress = (this.duration > 0) ? (this.currentTime / this.duration) : 0;
    const playedBars = Math.floor(barCount * progress);

    this.waveformBars.forEach((heightVariation, i) => {
      const barHeight = (height * 0.6 * heightVariation);
      const x = i * barWidth;
      const y = centerY - barHeight / 2;
      
      ctx.fillStyle = i < playedBars ? playedColor : unplayedColor;
      ctx.fillRect(x, y, barWidth - 1, barHeight);
    });
  }

  startWaveformAnimation(): void {
    if (this.animationFrameId) return;
    const animate = () => {
      this.drawWaveform();
      this.animationFrameId = requestAnimationFrame(animate);
    };
    this.animationFrameId = requestAnimationFrame(animate);
  }

  stopWaveformAnimation(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  // --- Helper & Display Methods ---
  private formatDuration(ms: number): string {
    if (isNaN(ms) || ms < 0) return '00:00';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  private formatDateTime(isoString: string): string {
    if (!isoString) return 'N/A';
    try {
      const date = new Date(isoString);
      return new DatePipe('en-US').transform(date, 'dd/MM/yyyy, hh:mm a') || 'N/A';
    } catch (e) {
      return 'N/A';
    }
  }

  getOutcomeBadgeClass(outcome: CallOutcome): string {
    switch (outcome) {
      case 'APPOINTMENT_SET': return 'badge-success';
      case 'INTERESTED': return 'badge-primary';
      case 'CALLBACK_REQUESTED': return 'badge-info';
      case 'VOICEMAIL': return 'badge-info-light';
      case 'ANSWERED_NO_OUTCOME': return 'badge-secondary';
      case 'NO_ANSWER': return 'badge-warning';
      case 'BUSY': return 'badge-warning-light';
      case 'NOT_INTERESTED': return 'badge-danger';
      case 'DO_NOT_CALL': return 'badge-danger-dark';
      case 'WRONG_NUMBER': return 'badge-danger-light';
      case 'TECHNICAL_ERROR': return 'badge-danger-light';
      case 'CALL_DROPPED': return 'badge-danger-light';
      case 'LANGUAGE_NOT_SUPPORTED': return 'badge-warning';
      default: return 'badge-secondary';
    }
  }

  getOutcomeDisplayText(outcome: CallOutcome): string {
    return `outcomes.${outcome.toLowerCase()}`;
  }

  setActiveTab(tabName: string): void {
    this.activeTab = tabName;
  }

  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).then(() => {
      console.log('ID copiado!');
    });
  }

  downloadAudio(): void {
    console.log('downloadAudio triggered');
  }

  rateConversation(rating: 'up' | 'down'): void {
    console.log(`rateConversation triggered with: ${rating}`);
  }

  trackByRecordingId(index: number, recording: Recording): number {
    return recording.id;
  }
}