import { CommonModule, Location } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import {
  AbandonedCheckoutService,
  AbandonedCheckout,
  AbandonedCheckoutFollowup
} from '../../services/abandoned-checkout.service';

@Component({
  selector: 'app-abandoned-checkout-detail',
  standalone: true,
  templateUrl: './abandoned-checkout-detail.component.html',
  styleUrls: ['./abandoned-checkout-detail.component.css'],
  imports: [CommonModule, FormsModule, RouterModule, TranslateModule]
})
export class AbandonedCheckoutDetailComponent implements OnInit {

  abandonedCheckoutId = 0;
  abandonedCheckout: AbandonedCheckout | null = null;

  followups: AbandonedCheckoutFollowup[] = [];
  isLoadingHeader = false;
  isLoadingFollowups = false;

  currentPage = 1;
  itemsPerPage = 25;
  totalResults = 0;

  searchContact = '';
  filterType = '';

  constructor(
    private route: ActivatedRoute,
    private location: Location,
    private abandonedCheckoutService: AbandonedCheckoutService
  ) { }

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.abandonedCheckoutId = +params['id'];
      this.loadHeader();
      this.loadFollowups();
    });
  }

  async loadHeader(): Promise<void> {
    this.isLoadingHeader = true;
    try {
      this.abandonedCheckout = await this.abandonedCheckoutService.getAbandonedCheckoutDetails(
        this.abandonedCheckoutId
      );
    } catch (error) {
      console.error('Error loading abandoned checkout header:', error);
      this.abandonedCheckout = null;
    } finally {
      this.isLoadingHeader = false;
    }
  }

  async loadFollowups(page: number = this.currentPage): Promise<void> {
    this.isLoadingFollowups = true;
    this.currentPage = page;
    const offset = (this.currentPage - 1) * this.itemsPerPage;

    try {
      const result = await this.abandonedCheckoutService.getAbandonedCheckoutFollowups(
        this.abandonedCheckoutId,
        offset,
        this.itemsPerPage,
        this.searchContact || undefined,
        this.filterType || undefined
      );

      if (result.error) {
        this.followups = [];
        this.totalResults = 0;
      } else {
        this.followups = result.followups;
        this.totalResults = result.total;
      }
    } catch (error) {
      console.error('Error loading followups:', error);
      this.followups = [];
      this.totalResults = 0;
    } finally {
      this.isLoadingFollowups = false;
    }
  }

  onSearch(): void {
    this.loadFollowups(1);
  }

  onFilterChange(): void {
    this.loadFollowups(1);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.loadFollowups(page);
    }
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalResults / this.itemsPerPage));
  }

  getStartIndex(): number {
    return this.followups.length > 0 ? (this.currentPage - 1) * this.itemsPerPage + 1 : 0;
  }

  getEndIndex(): number {
    return Math.min(this.currentPage * this.itemsPerPage, this.totalResults);
  }

  fullName(followup: AbandonedCheckoutFollowup): string {
    const parts = [followup.firstName, followup.lastName].filter(p => !!p);
    return parts.length > 0 ? parts.join(' ') : '-';
  }

  formatDate(dateString: string | undefined): string {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString();
  }

  // Este componente se abre siempre desde el listado — volver usa el historial real del
  // navegador, no una ruta fija.
  goBack(): void {
    this.location.back();
  }
}
