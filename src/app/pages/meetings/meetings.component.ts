import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MeetingService, GoogleCalendarEvent, MeetingGroup } from '../../services/meeting.service';

@Component({
  selector: 'app-meetings',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './meetings.component.html',
  styleUrl: './meetings.component.css'
})
export class MeetingsComponent implements OnInit {

  private translate = inject(TranslateService);
  private router    = inject(Router);
  public  svc       = inject(MeetingService);

  meetings:         GoogleCalendarEvent[]   = [];
  filteredMeetings: GoogleCalendarEvent[]   = [];
  meetingGroups:    MeetingGroup[] = [];
  upcomingMeetings: GoogleCalendarEvent[]   = [];

  isLoading        = true;
  error: string | null = null;
  sidebarCollapsed = false;

  activeFilter: 'all' | 'today' | 'tomorrow' | 'upcoming' = 'all';
  searchQuery = '';
  /** Ya hay datos en pantalla y estamos trayendo la versión fresca por detrás. */
  isRefreshing = false;

  async ngOnInit() {
    await this.load();
  }

  async load() {
    // Si ya cargamos en esta sesión, se pinta al instante lo que hay y el
    // refresco ocurre por detrás. Antes la pantalla quedaba en blanco hasta que
    // los 6 webhooks de OAuth terminaban — hasta 12 segundos.
    const previous = this.svc.cached;
    if (previous.length) {
      this.meetings = previous;
      this.upcomingMeetings = this.svc.getUpcomingMeetings(this.meetings);
      this.applyFilter();
    }

    this.isLoading = previous.length === 0;
    this.isRefreshing = previous.length > 0;
    this.error = null;
    try {
      this.meetings         = await this.svc.getAllMeetings();
      this.upcomingMeetings = this.svc.getUpcomingMeetings(this.meetings);
      this.applyFilter();
    } catch (e: any) {
      this.error = e.message || this.translate.instant('MEETINGS.ERROR.LOAD');
    } finally {
      this.isLoading = false;
      this.isRefreshing = false;
    }
  }

  goToDetail(meeting: GoogleCalendarEvent): void {
    this.router.navigate(['/meetings', meeting.id]);
  }

  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  setFilter(f: 'all' | 'today' | 'tomorrow' | 'upcoming') {
    this.activeFilter = f;
    this.applyFilter();
  }

  onSearch(event: Event) {
    this.searchQuery = (event.target as HTMLInputElement).value;
    this.applyFilter();
  }

  applyFilter() {
    let list = [...this.meetings];

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(m =>
        m.title.toLowerCase().includes(q) ||
        m.attendees.some(a => a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q)) ||
        (m.agentName ?? '').toLowerCase().includes(q)
      );
    }

    if (this.activeFilter !== 'all') {
      const now              = new Date();
      const todayStart       = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrowStart    = new Date(todayStart); tomorrowStart.setDate(tomorrowStart.getDate() + 1);
      const dayAfterTomorrow = new Date(tomorrowStart); dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

      list = list.filter(m => {
        const s = new Date(m.startTime);
        if (this.activeFilter === 'today')    return s >= todayStart    && s < tomorrowStart;
        if (this.activeFilter === 'tomorrow') return s >= tomorrowStart && s < dayAfterTomorrow;
        if (this.activeFilter === 'upcoming') return s >= dayAfterTomorrow;
        return true;
      });
    }

    this.filteredMeetings = list;
    this.meetingGroups    = this.svc.groupMeetings(list);
  }

  countByStatus(status: string): number {
    return this.meetings.filter(m => m.status === status).length;
  }

  getInitials(name: string): string {
    return name.split(' ').slice(0, 2).map(n => n[0] ?? '').join('').toUpperCase();
  }

  avatarColor(name: string): string {
    const palette = ['#5b4fe5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return palette[Math.abs(hash) % palette.length];
  }

  statusKey(status: string): string {
    const map: Record<string, string> = {
      confirmed:  'MEETINGS.STATUS.ACCEPTED',
      tentative:  'MEETINGS.STATUS.PENDING',
      cancelled:  'MEETINGS.STATUS.CANCELLED'
    };
    return map[status] ?? status;
  }

  groupLabelKey(tag: string): string {
    const map: Record<string, string> = {
      today:    'MEETINGS.GROUP.TODAY',
      tomorrow: 'MEETINGS.GROUP.TOMORROW',
      upcoming: 'MEETINGS.GROUP.UPCOMING'
    };
    return map[tag] ?? tag;
  }
}