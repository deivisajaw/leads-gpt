import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { MyListCompanyService, SavedCompany } from '../../services/my-list-company.service';
import { ExportService } from '../../services/export.service';

@Component({
  selector: 'app-my-list-company',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TranslateModule],
  templateUrl: './my-list-company.component.html',
  styleUrl: './my-list-company.component.css'
})
export class MyListCompanyComponent implements OnInit {

  companies: SavedCompany[] = [];
  searchQuery = '';
  isLoading = false;
  currentView: 'grid' | 'card' = 'grid';
  currentViewText = 'Grid view';
  currentPage = 1;
  itemsPerPage = 25;
  totalResultsInServer = 0;

  showViewDropdown = false;
  showExportDropdown = false;

  public rowsRevealed = false;

  private searchDebounce: any = null;

  constructor(
    private myListCompanyService: MyListCompanyService,
    private router: Router,
    private exportService: ExportService 
  ) {
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.dropdown-wrapper')) {
        this.closeAllDropdowns();
      }
    });
  }

  ngOnInit() {
    this.loadCompanies();
  }

  async loadCompanies(page: number = this.currentPage) {
    this.isLoading = true;
    this.currentPage = page;
    const offset = (this.currentPage - 1) * this.itemsPerPage;

    try {
      const result = await this.myListCompanyService.getMyCompanies(
        offset,
        this.itemsPerPage,
        this.searchQuery.trim()
      );
      if (result.error) {
        console.error('Error loading companies:', result.message);
        this.companies = [];
        this.totalResultsInServer = 0;
      } else {
        this.companies = result.companies;
        this.totalResultsInServer = result.total ?? result.companies.length;
      }
    } catch (error) {
      console.error('Error loading companies:', error);
      this.companies = [];
      this.totalResultsInServer = 0;
    } finally {
      this.isLoading = false;
      this.rowsRevealed = false;
      setTimeout(() => { this.rowsRevealed = true; }, 0);
    }
  }

  onSearch() {
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => {
      this.loadCompanies(1);
    }, 350);
  }

  changeView(view: 'grid' | 'card') {
    this.currentView = view;
    this.currentViewText = view === 'grid' ? 'Grid view' : 'Card view';
  }

  viewCompanyDetails(companyId: number) {
    this.router.navigate(['/company-details', companyId]);
  }

  refreshList() {
    this.loadCompanies();
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.loadCompanies(page);
    }
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  }

  toggleDropdown(dropdownName: string) {
    this.showViewDropdown = false;
    this.showExportDropdown = false;

    switch (dropdownName) {
      case 'view':
        this.showViewDropdown = true;
        break;
      case 'export':
        this.showExportDropdown = true;
        break;
    }
  }

  closeAllDropdowns() {
    this.showViewDropdown = false;
    this.showExportDropdown = false;
  }

  get totalPages(): number {
    return Math.ceil(this.totalResultsInServer / this.itemsPerPage);
  }

  getStartIndex(): number {
    return this.companies.length > 0 ? (this.currentPage - 1) * this.itemsPerPage + 1 : 0;
  }

  getEndIndex(): number {
    return Math.min(this.currentPage * this.itemsPerPage, this.totalResultsInServer);
  }

  exportToCSV(): void {
    const dataToExport = this.companies.map(({ additionalInfo, address, categoryName, city, countryCode, description, descriptionMd, error, errorDescription, id, neighborhood, openingHours, permanentlyClosed, phoneUnformatted, postalCode, savedOn, state, street, title, website }
      ) => ({
          id,
          title,
          categoryName,
          countryCode,
          city,
          state,
          street,
          address,
          postalCode,
          phoneUnformatted,
          openingHours,
          permanentlyClosed,
          website,
          description,
          descriptionMd,
          error,
          errorDescription,
          neighborhood,
          additionalInfo,
          savedOn: this.formatDate(savedOn)
    }));
    this.exportService.exportToCsv(dataToExport, 'my-company-list');
  }
  
  exportToExcel(): void {
    const dataToExport = this.companies.map(({ additionalInfo, address, categoryName, city, countryCode, description, descriptionMd, error, errorDescription, id, neighborhood, openingHours, permanentlyClosed, phoneUnformatted, postalCode, savedOn, state, street, title, website }
      ) => ({
          id,
          title,
          categoryName,
          countryCode,
          city,
          state,
          street,
          address,
          postalCode,
          phoneUnformatted,
          openingHours,
          permanentlyClosed,
          website,
          description,
          descriptionMd,
          error,
          errorDescription,
          neighborhood,
          additionalInfo,
          savedOn: this.formatDate(savedOn) 
    }));
    this.exportService.exportToExcel(dataToExport, 'my-company-list');
  }
}