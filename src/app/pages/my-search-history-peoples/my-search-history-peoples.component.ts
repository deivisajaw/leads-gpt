import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { PeopleService, PeopleSearchHistoryItem, PeopleSearchHistoryResponse } from '../../services/people.service';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-my-search-history-peoples',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TranslateModule],
  templateUrl: './my-search-history-peoples.component.html',
  styleUrl: './my-search-history-peoples.component.css'
})
export class MySearchHistoryPeoplesComponent implements OnInit, OnDestroy {
  historyItems: PeopleSearchHistoryItem[] = [];
  filteredHistoryItems: PeopleSearchHistoryItem[] = [];
  searchQuery = '';
  isLoading = false;
  currentPage = 1;
  itemsPerPage = 25;
  totalResultsInServer = 0;
  currentSortOrder = 'createdOn_desc';

  showSortDropdown = false;

  // Dispara el efecto de aparición de filas (rowin) un tick después de pintar, ver CSS .rowin.
  public rowsRevealed = false;

  private routerSubscription!: Subscription;

  constructor(
    private peopleService: PeopleService,
    private router: Router
  ) {
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.dropdown-wrapper')) {
        this.closeAllDropdowns();
      }
    });
  }

  ngOnInit() {
    this.loadHistory();
    this.routerSubscription = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.loadHistory();
    });
  }

  ngOnDestroy(): void {
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
  }

  async loadHistory(page: number = this.currentPage, sortBy: string = this.currentSortOrder) {
    this.isLoading = true;
    this.currentPage = page;
    this.currentSortOrder = sortBy;
    const offset = (this.currentPage - 1) * this.itemsPerPage;

    try {
      const result: PeopleSearchHistoryResponse = await this.peopleService.getMySearchHistoryPeoples(
        offset,
        this.itemsPerPage,
        this.currentSortOrder
      );

      if (result.error) {
        console.error('Error loading people search history:', result.message);
        this.historyItems = [];
        this.filteredHistoryItems = [];
        this.totalResultsInServer = 0;
      } else {
        this.historyItems = result.history;
        this.totalResultsInServer = result.total;
        this.applyLocalSearch(); // Apply local search after loading new page
      }
    } catch (error) {
      console.error('Error loading people search history:', error);
      this.historyItems = [];
      this.filteredHistoryItems = [];
      this.totalResultsInServer = 0;
    } finally {
      this.isLoading = false;
    }
  }

  onSearch() {
    this.currentPage = 1;
    this.applyLocalSearch();
  }

  applyLocalSearch() {
    if (!this.searchQuery.trim()) {
      this.filteredHistoryItems = [...this.historyItems];
    } else {
      const query = this.searchQuery.toLowerCase();
      this.filteredHistoryItems = this.historyItems.filter(item =>
        item.searchString.toLowerCase().includes(query)
      );
    }
    this.rowsRevealed = false;
    setTimeout(() => { this.rowsRevealed = true; }, 0);
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.loadHistory(page);
    }
  }

  onSortChange(sortBy: string) {
    this.currentSortOrder = sortBy;
    this.loadHistory(1, sortBy); // Reload history from page 1 with new sort order
    this.closeAllDropdowns();
  }

  viewDetails(searchId: number) {
    this.router.navigate(['/my-history-search-people-details', searchId]);
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  }

  toggleDropdown(dropdownName: string) {
    if (dropdownName === 'sort') {
      this.showSortDropdown = !this.showSortDropdown;
    }
  }

  closeAllDropdowns() {
    this.showSortDropdown = false;
  }

  get totalPages(): number {
    return Math.ceil(this.totalResultsInServer / this.itemsPerPage);
  }

  getStartIndex(): number {
    return this.filteredHistoryItems.length > 0 ? (this.currentPage - 1) * this.itemsPerPage + 1 : 0;
  }

  getEndIndex(): number {
    return Math.min(this.currentPage * this.itemsPerPage, this.totalResultsInServer);
  }

  getFormattedTotal(): string {
    return this.totalResultsInServer.toLocaleString();
  }
}