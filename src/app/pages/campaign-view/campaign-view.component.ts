import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CampaignService, Campaign, Lead } from '../../services/campaign.service';

@Component({
  selector: 'app-campaign-view',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './campaign-view.component.html',
  styleUrl: './campaign-view.component.css'
})
export class CampaignViewComponent implements OnInit {
  private campaignService = inject(CampaignService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  campaign: Campaign | null = null;
  isLoading: boolean = true;
  errorMessage: string | null = null;

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const campaignId = params.get('id');
      if (campaignId) {
        this.loadCampaignDetails(+campaignId);
      } else {
        this.errorMessage = 'ID de campaña no proporcionado.';
        this.isLoading = false;
      }
    });
  }

  async loadCampaignDetails(id: number): Promise<void> {
    this.errorMessage = null;
    this.isLoading = true;
    this.campaign = null;

    try {
      const responseData = await this.campaignService.getCampaignDetails(id);
      if (responseData) {
        this.campaign = responseData;
      } else {
        this.errorMessage = 'Campaña no encontrada o datos vacíos.';
      }
    } catch (err: any) {
      console.error('Error loading campaign details:', err);
      this.errorMessage = `Ha ocurrido un error: ${err.message || 'Error desconocido del backend.'}`;
    } finally {
      this.isLoading = false;
    }
  }

  goBack(): void {
    this.router.navigate(['/campaigns']);
  }

  getCampaignTypeIcon(type: string | undefined): string {
    switch (type?.toLowerCase()) {
      case 'whatsapp':
        return 'fab fa-whatsapp';
      case 'email':
        return 'fas fa-envelope';
      case 'voice':
        return 'fas fa-phone';
      case 'sms':
        return 'fas fa-sms';
      default:
        return 'fas fa-bullhorn'; 
    }
  }

  getCampaignStatusText(status: string | undefined): string {
    switch (status?.toLowerCase()) {
      case 'planned':
        return 'Planeada';
      case 'in_progress':
        return 'En Ejecución';
      case 'finished':
        return 'Finalizada';
      case 'cancelled':
        return 'Cancelada';
      default:
        return 'Desconocido';
    }
  }

  getDaysOfWeekDisplay(daysOfWeekJson: string | undefined): string {
    if (!daysOfWeekJson) return 'N/A';
    try {
      const days = JSON.parse(daysOfWeekJson);
      if (Array.isArray(days)) {
        const dayMap: { [key: string]: string } = {
          monday: 'Lunes', tuesday: 'Martes', wednesday: 'Miércoles',
          thursday: 'Jueves', friday: 'Viernes', saturday: 'Sábado', sunday: 'Domingo'
        };
        return days.map(day => dayMap[day.toLowerCase()] || day).join(', ');
      }
    } catch (e) {
      return daysOfWeekJson.split(',').map(day => day.trim()).join(', ');
    }
    return 'N/A';
  }

  getLeadsCount(leads: any[] | undefined): number {
    return leads ? leads.length : 0;
  }

  getContactedLeadsCount(leads: Lead[] | undefined): number {
    return leads ? leads.filter(lead => lead.contacted).length : 0;
  }
}
