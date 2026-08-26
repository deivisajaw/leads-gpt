import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { MyListPeopleService, SavedPeople } from '../../services/my-list-people.service';
import { ExportService } from '../../services/export.service';

@Component({
  selector: 'app-my-list-people',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TranslateModule],
  templateUrl: './my-list-people.component.html',
  styleUrl: './my-list-people.component.css'
})
export class MyListPeopleComponent implements OnInit {

  people: SavedPeople[] = [];
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
    private myListPeopleService: MyListPeopleService,
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
    this.loadPeople();
  }

  async loadPeople(page: number = this.currentPage) {
    this.isLoading = true;
    this.currentPage = page;
    const offset = (this.currentPage - 1) * this.itemsPerPage;

    try {
      const result = await this.myListPeopleService.getMyPeople(
        offset,
        this.itemsPerPage,
        this.searchQuery.trim()
      );
      if (result.error) {
        console.error('Error loading people:', result.message);
        this.people = [];
        this.totalResultsInServer = 0;
      } else {
        this.people = result.peoples.map(people => ({
          ...people,
          avatar: people.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(people.name)}&background=5b4fe5&color=fff&size=40`,
          verified: people.email ? true : false,
        }));
        this.totalResultsInServer = result.total ?? result.peoples.length;
      }
    } catch (error) {
      console.error('Error loading people:', error);
      this.people = [];
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
      this.loadPeople(1);
    }, 350);
  }

  changeView(view: 'grid' | 'card') {
    this.currentView = view;
    this.currentViewText = view === 'grid' ? 'Grid view' : 'Card view';
  }

  viewPeopleDetails(peopleId: number) {
    this.router.navigate(['/people-details', peopleId]);
  }

  refreshList() {
    this.loadPeople();
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.loadPeople(page);
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
    return this.people.length > 0 ? (this.currentPage - 1) * this.itemsPerPage + 1 : 0;
  }

  getEndIndex(): number {
    return Math.min(this.currentPage * this.itemsPerPage, this.totalResultsInServer);
  }

  exportToCSV(): void {
    const dataToExport = this.people.map(({ about, countryCode, description, education, email, experiencies, fullName, id, image, link, location, name, phone, savedOn, searchResultStatusSelect, snippet, title }
      ) => ({
          id,
          name,
          title,
          fullName, 
          countryCode, 
          location,
          email,
          phone, 
          image, 
          link, 
          description, 
          education, 
          about, 
          experiencies,
          searchResultStatusSelect, 
          snippet,
          savedOn: this.formatDate(savedOn) 
    }));
    this.exportService.exportToCsv(dataToExport, 'my-people-list');
  }
  
  exportToExcel(): void {
    const dataToExport = this.people.map(({ about, countryCode, description, education, email, experiencies, fullName, id, image, link, location, name, phone, savedOn, searchResultStatusSelect, snippet, title }
      ) => ({
          id,
          name,
          title,
          fullName, 
          countryCode, 
          location,
          email,
          phone, 
          image, 
          link, 
          description, 
          education, 
          about, 
          experiencies,
          searchResultStatusSelect, 
          snippet,
          savedOn: this.formatDate(savedOn) 
    }));
    this.exportService.exportToExcel(dataToExport, 'my-people-list');
  }
}