import { Component, OnInit, inject, OnDestroy, ElementRef, ViewChild, NgZone } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CampaignService, CallOutcome, CallMetrics } from '../../services/campaign.service';
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
  companyName?: string;
  campaignName?: string;
}

@Component({
  selector: 'app-calls',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SafeHtmlPipe, TranslateModule, FormatTimePipe],
  templateUrl: './calls.component.html',
  styleUrl: './calls.component.css'
})
export class CallsComponent implements OnInit, OnDestroy {
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
  private ngZone = inject(NgZone);
  private debounceTimer: any; // Added debounceTimer

  companyName: string = 'Company';
  isLoading: boolean = true;
  errorMessage: string | null = null;

  // Metricas
  metrics: CallMetrics | null = null;
  isLoadingMetrics: boolean = false;
  readonly skeletonItems = [1, 2, 3, 4, 5, 6];

  recordings: Recording[] = [];
  filteredRecordings: Recording[] = [];

  filterContact: string = '';
  filterOutcome: string = '';
  filterType: string = '';

  isPanelOpen: boolean = false;
  selectedRecording: Recording | null = null;
  activeTab: string = 'overview';

  // Audio Player Properties
  private audioPlayer!: HTMLAudioElement;
  private isPlayerInitialized = false;
  isPlaying = false;
  duration = 0;
  currentTime = 0;

  // Waveform Properties
  private waveformBars: number[] = [];
  private animationFrameId: number | null = null;

  offset = 0;
  limit = 25;
  hasMore = true;
  currentPage = 1;
  totalRecords = 0;
  totalPages = 0;

  // Sort
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  ngOnInit(): void {
    //console.log('CallsComponent: ngOnInit');
    this.loadRecordings(1);
    this.loadMetrics();
  }

  ngOnDestroy(): void {
    console.log('CallsComponent: ngOnDestroy');
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

  async loadMetrics(): Promise<void> {
    this.isLoadingMetrics = true;
    try {
      this.metrics = await this.campaignService.getCallsMetricsByCompany();
    } catch (e) {
      console.error('Error loading metrics:', e);
    } finally {
      this.isLoadingMetrics = false;
    }
  }

  async loadRecordings(page: number = 1): Promise<void> {
    //console.log('CallsComponent: loadRecordings - START', { page, filterContact: this.filterContact, filterOutcome: this.filterOutcome, filterType: this.filterType });
    const activeElement = document.activeElement; // Store active element
    const isFilterContactFocused = this.filterContactInput?.nativeElement === activeElement;
    //console.log('CallsComponent: loadRecordings - Focus state at START:', { activeElementId: activeElement?.id, isFilterContactFocused });

    this.isLoading = true;
    this.errorMessage = null;

    this.currentPage = page;
    this.offset = (this.currentPage - 1) * this.limit;

    try {
      const response = await this.campaignService.getCallsByCompany(
        this.offset,
        this.limit,
        this.filterContact,
        this.filterOutcome,
        this.filterType
      );
      //console.log('CallsComponent: loadRecordings - API Response', response);

      this.companyName = response.companyName || 'Company';

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
        recordingUrl: call.recordingUrl,
        transcription: call.transcription,
        summary: call.summary,
        calLink: call.calLink,
        campaignName: call.campaignName,
        appointmentDate: call.appointmentDate
          ? this.formatDateTime(call.appointmentDate)
          : undefined
      }));



      this.recordings.sort((a, b) => {
        if (a.dateTime === 'N/A' && b.dateTime === 'N/A') return 0;
        if (a.dateTime === 'N/A') return 1;
        if (b.dateTime === 'N/A') return -1;

        const parse = (value: string) => {
          const [datePart, timePart, ampm] = value.split(/[,\s]+/);
          const [day, month, year] = datePart.split('/').map(Number);

          let [hour, minute] = timePart.split(':').map(Number);
          if (ampm === 'PM' && hour !== 12) hour += 12;
          if (ampm === 'AM' && hour === 12) hour = 0;

          return new Date(year, month - 1, day, hour, minute).getTime();
        };

        return parse(b.dateTime) - parse(a.dateTime); // más reciente primero
      });

      this.filteredRecordings = [...this.recordings];

    } catch (error) {
      console.error('CallsComponent: Error loading recordings:', error);
      this.errorMessage = 'No se pudieron cargar las grabaciones de la company.';
    } finally {
      this.isLoading = false;
      //console.log('CallsComponent: loadRecordings - END');
      // Restore focus if it was on the filterContact input
      if (isFilterContactFocused && this.filterContactInput) {
        this.ngZone.runOutsideAngular(() => { // Run outside Angular to prevent extra change detection
          setTimeout(() => { // Use setTimeout to ensure DOM is updated
            this.filterContactInput.nativeElement.focus();
            //console.log('CallsComponent: Focus restored to filterContactInput', this.filterContactInput.nativeElement.id);
          }, 0);
        });
      } else {
        //console.log('CallsComponent: Focus not restored (input not focused or not found)');
      }
    }
  }

  onFilterChange(): void {
    //console.log('CallsComponent: onFilterChange triggered', { filterContact: this.filterContact, filterOutcome: this.filterOutcome, filterType: this.filterType, activeElementId: document.activeElement?.id });
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      //console.log('CallsComponent: Debounce timer finished, calling loadRecordings(1)');
      this.loadRecordings(1);
    }, 300);
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.loadRecordings(this.currentPage + 1);
    }
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.loadRecordings(this.currentPage - 1);
    }
  }

  get startRecord(): number {
    return this.totalRecords === 0 ? 0 : (this.currentPage - 1) * this.limit + 1;
  }

  get endRecord(): number {
    const end = this.currentPage * this.limit;
    return end > this.totalRecords ? this.totalRecords : end;
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

  formatMs(ms: number): string {
    if (!ms || ms <= 0) return '0m 0s';
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  trackByRecordingId(index: number, recording: Recording): number {
    return recording.id;
  }

  // ── Sort ──────────────────────────────────────────────────────────────────

  sortBy(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.applySortToFiltered();
  }

  private applySortToFiltered(): void {
    const col = this.sortColumn;
    const dir = this.sortDirection === 'asc' ? 1 : -1;

    this.filteredRecordings = [...this.filteredRecordings].sort((a, b) => {
      let valA: any = (a as any)[col];
      let valB: any = (b as any)[col];

      // Nulls always last
      if (valA == null && valB == null) return 0;
      if (valA == null) return 1;
      if (valB == null) return -1;

      if (valA === 'N/A' && valB === 'N/A') return 0;
      if (valA === 'N/A') return 1;
      if (valB === 'N/A') return -1;

      // Duration: "MM:SS" -> compare as total seconds
      if (col === 'duration') {
        const toSec = (d: string) => {
          const [m, s] = d.split(':').map(Number);
          return m * 60 + s;
        };
        return (toSec(valA) - toSec(valB)) * dir;
      }

      // dateTime: already formatted "dd/MM/yyyy, hh:mm a" — compare raw strings
      // (alphabetical sort works correctly for this fixed format)
      if (typeof valA === 'string' && typeof valB === 'string') {
        return valA.localeCompare(valB, undefined, { sensitivity: 'base' }) * dir;
      }

      // Numbers
      return (valA - valB) * dir;
    });
  }

  getSortIcon(column: string): string {
    if (this.sortColumn !== column) return 'fa-sort';
    return this.sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
  }
}