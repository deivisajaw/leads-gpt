import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { SavedListService } from '../../services/saved-list.service';
import { NotificationService } from '../../services/notification.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-my-list-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TranslateModule],
  templateUrl: './my-list-detail.component.html',
  styleUrl: './my-list-detail.component.css'
})
export class MyListDetailComponent implements OnInit, OnDestroy {

  listId!: number;
  listName = '';
  listDescription = '';
  companiesCount = 0;
  peopleCount = 0;

  activeTab: 'companies' | 'people' = 'companies';

  companies: any[] = [];
  people: any[] = [];
  isLoading = false;
  public rowsRevealed = false;

  searchQuery = '';
  currentPage = 1;
  itemsPerPage = 25;
  totalResultsInServer = 0;
  private searchDebounce: any = null;

  // ─── Picker: agregar elementos ya guardados a esta lista ───
  public showPickerModal = false;
  public pickerItems: any[] = [];
  public pickerSelectedIds = new Set<number>();
  public isLoadingPicker = false;
  public isAddingFromPicker = false;

  private routeSubscription!: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private savedListService: SavedListService,
    private notificationService: NotificationService
  ) {}

  ngOnInit() {
    this.routeSubscription = this.route.params.subscribe(params => {
      this.listId = +params['id'];
      this.loadList();
    });
  }

  ngOnDestroy() {
    if (this.routeSubscription) this.routeSubscription.unsubscribe();
  }

  async loadList() {
    // La info de nombre/descripción/conteos viene de getMySavedLists (no hay un
    // getSavedList individual) — la buscamos por id ahí.
    const res = await this.savedListService.getMySavedLists();
    if (!res.error) {
      const found = res.lists.find(l => l.id === this.listId);
      if (found) {
        this.listName = found.name;
        this.listDescription = found.description;
        this.companiesCount = found.companiesCount;
        this.peopleCount = found.peopleCount;
      } else {
        this.notificationService.showError('Esta lista no existe o fue borrada.');
        this.router.navigate(['/my-lists']);
        return;
      }
    }
    this.loadContent();
  }

  goBack() {
    this.router.navigate(['/my-lists']);
  }

  switchTab(tab: 'companies' | 'people') {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    this.currentPage = 1;
    this.searchQuery = '';
    this.loadContent();
  }

  async loadContent(page: number = this.currentPage) {
    this.isLoading = true;
    this.currentPage = page;
    const offset = (this.currentPage - 1) * this.itemsPerPage;

    try {
      if (this.activeTab === 'companies') {
        const res = await this.savedListService.getSavedListCompanies(this.listId, offset, this.itemsPerPage, this.searchQuery.trim());
        if (res.error) {
          this.notificationService.showError(res.message || 'Error al cargar las empresas de la lista.');
          this.companies = [];
          this.totalResultsInServer = 0;
        } else {
          this.companies = res.companies;
          this.totalResultsInServer = res.total ?? res.companies.length;
        }
      } else {
        const res = await this.savedListService.getSavedListPeoples(this.listId, offset, this.itemsPerPage, this.searchQuery.trim());
        if (res.error) {
          this.notificationService.showError(res.message || 'Error al cargar las personas de la lista.');
          this.people = [];
          this.totalResultsInServer = 0;
        } else {
          this.people = res.peoples;
          this.totalResultsInServer = res.total ?? res.peoples.length;
        }
      }
    } catch (error) {
      this.notificationService.showError('Error de conexión al cargar la lista.');
    } finally {
      this.isLoading = false;
      this.rowsRevealed = false;
      setTimeout(() => { this.rowsRevealed = true; }, 0);
    }
  }

  onSearch() {
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => {
      this.loadContent(1);
    }, 350);
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.loadContent(page);
    }
  }

  get totalPages(): number {
    return Math.ceil(this.totalResultsInServer / this.itemsPerPage);
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  }

  viewCompanyDetails(companyId: number) {
    this.router.navigate(['/company-details', companyId]);
  }

  viewPeopleDetails(peopleId: number) {
    this.router.navigate(['/people-details', peopleId]);
  }

  // ─── Quitar de la lista (no borra el guardado, solo la relación con esta lista) ───

  async removeFromList(item: any) {
    try {
      const res = this.activeTab === 'companies'
        ? await this.savedListService.removeCompanyFromList(this.listId, item.id)
        : await this.savedListService.removePeopleFromList(this.listId, item.id);

      if (res.error) {
        this.notificationService.showError(res.message || 'No se pudo quitar el elemento de la lista.');
      } else {
        this.notificationService.showSuccess('Elemento quitado de la lista.');
        if (this.activeTab === 'companies') this.companiesCount = Math.max(0, this.companiesCount - 1);
        else this.peopleCount = Math.max(0, this.peopleCount - 1);
        this.loadContent();
      }
    } catch (error) {
      this.notificationService.showError('Error de conexión al quitar el elemento.');
    }
  }

  // ─── Picker: "Agregar elementos" — elige entre tus guardados los que aún no están aquí ───

  async openPicker() {
    this.pickerSelectedIds.clear();
    this.showPickerModal = true;
    this.isLoadingPicker = true;
    try {
      const res = this.activeTab === 'companies'
        ? await this.savedListService.getUnassignedCompaniesForList(this.listId, 0, 100)
        : await this.savedListService.getUnassignedPeoplesForList(this.listId, 0, 100);

      if (res.error) {
        this.notificationService.showError(res.message || 'No se pudieron cargar tus guardados.');
        this.pickerItems = [];
      } else {
        this.pickerItems = this.activeTab === 'companies' ? (res as any).companies : (res as any).peoples;
      }
    } catch (error) {
      this.notificationService.showError('Error de conexión al cargar tus guardados.');
      this.pickerItems = [];
    } finally {
      this.isLoadingPicker = false;
    }
  }

  closePicker() {
    this.showPickerModal = false;
  }

  togglePickerItem(id: number) {
    if (this.pickerSelectedIds.has(id)) this.pickerSelectedIds.delete(id);
    else this.pickerSelectedIds.add(id);
  }

  async confirmPicker() {
    const ids = Array.from(this.pickerSelectedIds);
    if (ids.length === 0) {
      this.notificationService.showError('Selecciona al menos un elemento.');
      return;
    }

    this.isAddingFromPicker = true;
    try {
      const res = this.activeTab === 'companies'
        ? await this.savedListService.addCompaniesToList(this.listId, ids)
        : await this.savedListService.addPeopleToList(this.listId, ids);

      if (res.error) {
        this.notificationService.showError(res.message || 'No se pudieron agregar los elementos.');
      } else {
        this.notificationService.showSuccess(`${res.added} elemento${res.added === 1 ? '' : 's'} agregado${res.added === 1 ? '' : 's'} a la lista.`);
        if (this.activeTab === 'companies') this.companiesCount += res.added || 0;
        else this.peopleCount += res.added || 0;
        this.showPickerModal = false;
        this.loadContent();
      }
    } catch (error) {
      this.notificationService.showError('Error de conexión al agregar los elementos.');
    } finally {
      this.isAddingFromPicker = false;
    }
  }
}
