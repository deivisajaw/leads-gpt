import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MeetingService, GoogleCalendarEvent } from '../../services/meeting.service';

@Component({
  selector: 'app-meeting-detail',
  standalone: true,
  imports: [CommonModule, TranslateModule, RouterModule],
  templateUrl: './meeting-detail.component.html',
  styleUrl: './meeting-detail.component.css'
})
export class MeetingDetailComponent implements OnInit {

  private route     = inject(ActivatedRoute);
  private router    = inject(Router);
  private translate = inject(TranslateService);
  public  svc       = inject(MeetingService);

  meeting:  GoogleCalendarEvent | null = null;
  isLoading = true;
  error: string | null = null;

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('uid');
    if (!id) {
      this.error     = this.translate.instant('MEETINGS.DETAIL.ERROR.NO_UID');
      this.isLoading = false;
      return;
    }
    await this.load(id);
  }

  async load(id: string) {
    this.isLoading = true;
    this.error     = null;
    try {
      this.meeting = await this.svc.getEventById(id);
      if (!this.meeting) {
        this.error = this.translate.instant('MEETINGS.DETAIL.ERROR.NOT_FOUND');
      }
    } catch (e: any) {
      this.error = e.message || this.translate.instant('MEETINGS.DETAIL.ERROR.LOAD');
    } finally {
      this.isLoading = false;
    }
  }

  goBack(): void {
    this.router.navigate(['/meetings']);
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

  statusClass(status: string): string {
    const map: Record<string, string> = {
      confirmed:  'chip-accepted',
      tentative:  'chip-pending',
      cancelled:  'chip-cancelled'
    };
    return map[status] ?? 'chip-rejected';
  }

  attendeeStatusKey(status?: string): string {
    const map: Record<string, string> = {
      accepted:  'MEETINGS.DETAIL.ATTENDEE_STATUS.ACCEPTED',
      pending:   'MEETINGS.DETAIL.ATTENDEE_STATUS.PENDING',
      declined:  'MEETINGS.DETAIL.ATTENDEE_STATUS.DECLINED',
      tentative: 'MEETINGS.DETAIL.ATTENDEE_STATUS.TENTATIVE'
    };
    return map[status ?? ''] ?? 'MEETINGS.DETAIL.ATTENDEE_STATUS.PENDING';
  }
}