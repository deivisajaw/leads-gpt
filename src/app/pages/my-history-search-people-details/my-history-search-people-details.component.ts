import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { PeopleService, People, PeopleSearchResult } from '../../services/people.service';
import { MyListPeopleService } from '../../services/my-list-people.service';
import { SavedListService, SavedListSummary } from '../../services/saved-list.service';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { OnboardingService } from "../../services/onboarding.service";
import { CreditsPillComponent } from '../../components/shared/credits-pill/credits-pill.component';

@Component({
  selector: 'app-my-history-search-people-details',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TranslateModule, CreditsPillComponent],
  templateUrl: './my-history-search-people-details.component.html',
  styleUrl: './my-history-search-people-details.component.css'
})
export class MyHistorySearchPeopleDetailsComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('selectionBarPortal') selectionBarPortalRef?: ElementRef<HTMLElement>;
  @ViewChild('confirmModalPortal') confirmModalPortalRef?: ElementRef<HTMLElement>;
  searchId: number = 0;
  searchDetails: PeopleSearchResult | null = null;
  isLoading = false;
  currentPage = 1;
  itemsPerPage = 25;
  totalResultsInServer = 0;
  currentSortOrder = 'name_asc';
  currentQuery = '';

  showSortDropdown = false;

  // Dispara el efecto de aparición de filas (rowin) un tick después de pintar, ver CSS .rowin.
  public rowsRevealed = false;

  private pollingInterval: any;
  private pollTimeout: any;
  public isPolling: boolean = false;
  /** La búsqueda seguía corriendo cuando dejamos de preguntar. */
  public pollTimedOut = false;

  private routeSubscription!: Subscription;

  selectedPeople: number[] = [];
  selectAllChecked = false;

  public creditsRemaining: number = 0;
  private userProfileSubscription!: Subscription;
  public isSaving: boolean = false;

  // ─── Modal de confirmación unificado: sirve tanto para "agregar seleccionados" como para
  // "agregar todos", con selección/creación de listas en los dos casos. ───
  public showConfirmModal: boolean = false;
  public isSavingAll: boolean = false;
  public confirmModalMode: 'selected' | 'all' = 'selected';
  public availableLists: SavedListSummary[] = [];
  public confirmSelectedListIds = new Set<number>();
  public confirmNewListName = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private peopleService: PeopleService,
    private myListPeopleService: MyListPeopleService,
    private savedListService: SavedListService,
    private authService: AuthService,
    private notificationService: NotificationService,
    private onboardingService: OnboardingService,
    private renderer: Renderer2
  ) {
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.dropdown-wrapper')) {
        this.closeAllDropdowns();
      }
    });
  }

  ngOnInit() {
    this.routeSubscription = this.route.params.subscribe(params => {
      this.searchId = +params['id'];
      this.loadSearchDetails();
    });

    this.userProfileSubscription = this.authService.userProfile$.subscribe(profile => {
      if (profile && profile.companyProfile) {
        this.creditsRemaining = profile.companyProfile.creditsAllocated ?? 0;
      }
    });

    this.loadAvailableLists();
  }

  private async loadAvailableLists(): Promise<void> {
    const res = await this.savedListService.getMySavedLists();
    this.availableLists = res.error ? [] : res.lists;
  }

  public toggleConfirmList(listId: number): void {
    if (this.confirmSelectedListIds.has(listId)) this.confirmSelectedListIds.delete(listId);
    else this.confirmSelectedListIds.add(listId);
  }

  ngAfterViewInit(): void {
    // La barra de selección y el modal usan position:fixed pensado para posicionarse contra
    // la ventana del navegador — si algún ancestro fuera "contenedor" de fixed, dejarían de
    // calcularse contra la pantalla. Los movemos a <body> para no depender de eso.
    if (typeof document === 'undefined') return;
    if (this.selectionBarPortalRef) {
      this.renderer.appendChild(document.body, this.selectionBarPortalRef.nativeElement);
    }
    if (this.confirmModalPortalRef) {
      this.renderer.appendChild(document.body, this.confirmModalPortalRef.nativeElement);
    }
  }

  ngOnDestroy(): void {
    if (this.routeSubscription) {
      this.routeSubscription.unsubscribe();
    }
    this.stopPolling();

    if (this.userProfileSubscription) {
      this.userProfileSubscription.unsubscribe();
    }
    this.selectionBarPortalRef?.nativeElement.remove();
    this.confirmModalPortalRef?.nativeElement.remove();
  }

  async loadSearchDetails(page: number = this.currentPage, sortBy: string = this.currentSortOrder) {
    this.isLoading = true;
    this.currentPage = page;
    this.currentSortOrder = sortBy;
    const offset = (this.currentPage - 1) * this.itemsPerPage;

    try {
      const result: PeopleSearchResult = await this.peopleService.getMySearchHistoryPeopleDetails(
        this.searchId,
        offset,
        this.itemsPerPage,
        this.currentSortOrder
      );

      if (result.error) {
        console.error('Error loading people search details:', result.message);
        this.searchDetails = null;
        this.totalResultsInServer = 0;
        this.isLoading = false;
        this.stopPolling();
      } else {
        result.results = result.results.map(people => {
          const mainParts = people.title.split(' | ');
          const nameAndTitleParts = mainParts[0].split(' - ');
          const jobTitle = nameAndTitleParts[1] ? nameAndTitleParts[1].trim() : 'N/A';
          const company = mainParts[1] ? mainParts[1].trim() : 'N/A';

          return {
            ...people,
            jobTitle: jobTitle,
            company: company,
            avatar: people.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(people.name)}&background=5b4fe5&color=fff&size=40`,
            verified: people.email ? true : false
          };
        });

        this.searchDetails = result;
        this.currentQuery = result.searchString;
        this.totalResultsInServer = result.resultsNumber || 0;
        this.rowsRevealed = false;
        setTimeout(() => { this.rowsRevealed = true; }, 0);

        if (result.statusSelect === 1) {
          this.startPolling();
        } else {
          this.stopPolling();
          this.isLoading = false;
        }
      }
    } catch (error) {
      console.error('Error loading people search details:', error);
      this.searchDetails = null;
      this.totalResultsInServer = 0;
      this.isLoading = false;
      this.stopPolling();
    }
  }

  private stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    if (this.pollTimeout) {
      clearTimeout(this.pollTimeout);
      this.pollTimeout = null;
    }
    this.isPolling = false;
    this.isLoading = false;
  }

  private startPolling() {
    this.stopPolling();

    this.isPolling = true;

    // Tope de 2 minutos. Antes se cortaba en silencio y el usuario se quedaba
    // sin saber si la búsqueda seguía o se murió.
    this.pollTimeout = setTimeout(() => {
      const stillRunning = this.searchDetails?.statusSelect === 1;
      this.stopPolling();
      if (stillRunning) this.pollTimedOut = true;
    }, 120000);

    this.pollingInterval = setInterval(async () => {
      // OJO: aquí NO se pone isLoading = true.
      //
      // Antes sí, y como el sondeo corre cada 5 segundos, la pantalla volvía al
      // engranaje de pantalla completa y escondía la tabla una y otra vez. Con
      // una búsqueda que tardaba, se veía como si estuviera colgada para
      // siempre aunque los resultados ya estuvieran ahí. El engranaje grande es
      // sólo para la primera carga; el sondeo se anuncia con isPolling.
      try {
        const result: PeopleSearchResult = await this.peopleService.getMySearchHistoryPeopleDetails(
          this.searchId,
          (this.currentPage - 1) * this.itemsPerPage,
          this.itemsPerPage,
          this.currentSortOrder
        );

        if (result.error) {
          console.error('Error during polling for people search details:', result.message);
          this.stopPolling();
        } else {
          result.results = result.results.map(people => {
            const mainParts = people.title.split(' | ');
            const nameAndTitleParts = mainParts[0].split(' - ');
            const jobTitle = nameAndTitleParts[1] ? nameAndTitleParts[1].trim() : 'N/A';
            const company = mainParts[1] ? mainParts[1].trim() : 'N/A';

            return {
              ...people,
              jobTitle: jobTitle,
              company: company,
              avatar: people.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(people.name)}&background=5b4fe5&color=fff&size=40`,
              verified: people.email ? true : false
            };
          });

          this.searchDetails = result;
          this.currentQuery = result.searchString;
          this.totalResultsInServer = result.resultsNumber || 0;

          if (result.statusSelect !== 1) {
            this.stopPolling();
          }
        }
      } catch (error) {
        console.error("Error during polling for people search details:", error);
        this.stopPolling();
      } finally {
        this.isLoading = false;
      }
    }, 5000);
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.loadSearchDetails(page);
    }
  }

  onSortChange(sortBy: string) {
    this.currentSortOrder = sortBy;
    this.loadSearchDetails(1, sortBy);
    this.closeAllDropdowns();
  }

  goBack() {
    this.router.navigate(['/my-search-history-peoples']);
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
    return this.searchDetails && this.searchDetails.results.length > 0 ? (this.currentPage - 1) * this.itemsPerPage + 1 : 0;
  }

  getEndIndex(): number {
    return Math.min(this.currentPage * this.itemsPerPage, this.totalResultsInServer);
  }

  getFormattedTotal(): string {
    return this.totalResultsInServer.toLocaleString();
  }

  getStatusClass(status: number | undefined): string {
    switch (status) {
      case 1: return 'status-orange';
      case 2: return 'status-green';
      case 3: return 'status-red';
      default: return '';
    }
  }

  getStatusText(status: number | undefined): string {
    switch (status) {
      case 1: return 'In process';
      case 2: return 'Completed';
      case 3: return 'No results';
      default: return 'Unknown';
    }
  }

  get showSelectionBar(): boolean {
    return this.selectedPeople.length > 0;
  }

  toggleSelectAll() {
    this.selectAllChecked = !this.selectAllChecked;
    if (this.searchDetails && this.searchDetails.results) {
      if (this.selectAllChecked) {
        this.selectedPeople = this.searchDetails.results.map(people => people.id);
      } else {
        this.selectedPeople = [];
      }
    }
  }

  togglePeopleSelection(peopleId: number) {
    const index = this.selectedPeople.indexOf(peopleId);
    if (index > -1) {
      this.selectedPeople.splice(index, 1);
    } else {
      this.selectedPeople.push(peopleId);
    }
    if (this.searchDetails && this.searchDetails.results) {
      this.selectAllChecked = this.selectedPeople.length === this.searchDetails.results.length;
    }
  }

  closeSelectionBar() {
    this.selectedPeople = [];
    this.selectAllChecked = false;
  }

  // ─── Modal de confirmación (seleccionados / todos), con listas opcionales ───

  // El botón "Añadir a mi lista" de la barra de selección ya no guarda directo: pide
  // confirmación (con listas opcionales) primero, igual que "Agregar Todos".
  addToMyList(): void {
    if (this.selectedPeople.length === 0) {
      this.notificationService.showError("No hay personas seleccionadas");
      return;
    }
    this.confirmModalMode = 'selected';
    this.confirmSelectedListIds.clear();
    this.confirmNewListName = '';
    this.showConfirmModal = true;
  }

  openAddAllModal() {
    if (this.totalResultsInServer === 0) {
      this.notificationService.showError("No hay resultados disponibles para agregar.");
      return;
    }
    this.confirmModalMode = 'all';
    this.confirmSelectedListIds.clear();
    this.confirmNewListName = '';
    this.showConfirmModal = true;
  }

  closeConfirmModal() {
    this.showConfirmModal = false;
  }

  get confirmModalTitle(): string {
    return this.confirmModalMode === 'all' ? '¿Agregar todos los resultados?' : '¿Agregar seleccionados?';
  }

  get confirmModalCount(): number {
    return this.confirmModalMode === 'all' ? this.totalResultsInServer : this.selectedPeople.length;
  }

  get confirmModalMessage(): string {
    const n = this.confirmModalCount;
    return `Esto usará ${n} crédito${n === 1 ? '' : 's'}.`;
  }

  async confirmModalAction(): Promise<void> {
    const listIds = Array.from(this.confirmSelectedListIds);

    const newName = this.confirmNewListName.trim();
    if (newName) {
      const res = await this.savedListService.createSavedList(newName);
      if (!res.error && res.list) {
        listIds.push(res.list.id);
      } else {
        this.notificationService.showError(res.message || 'No se pudo crear la lista.');
      }
    }

    const finalListIds = listIds.length > 0 ? listIds : undefined;
    if (this.confirmModalMode === 'all') {
      await this.confirmAddAll(finalListIds);
    } else {
      await this.doAddSelectedToMyList(finalListIds);
    }
  }

  private async doAddSelectedToMyList(listIds?: number[]): Promise<void> {
    const creditsNeeded = this.selectedPeople.length;

    if (creditsNeeded === 0) {
      this.notificationService.showError("No hay personas seleccionadas");
      this.showConfirmModal = false;
      return;
    }

    if (this.creditsRemaining < creditsNeeded) {
      this.notificationService.showError(`No tienes créditos suficientes. Necesitas ${creditsNeeded} y tienes ${this.creditsRemaining}.`);
      this.showConfirmModal = false;
      return;
    }

    this.isSaving = true;

    try {
      const result = await this.myListPeopleService.savePeopleResults(this.selectedPeople, listIds);

      if (result.error) {
        this.notificationService.showError(result.message || "Ocurrió un error al guardar.");
      } else {
        this.notificationService.showSuccess(`${result.saved} personas añadidas a tu lista.`);

        if (result.creditsRemaining !== undefined) {
          this.authService.updateCurrentUserCredits(result.creditsRemaining);
        }

        this.selectedPeople = [];
        this.selectAllChecked = false;
        this.showConfirmModal = false;
        this.onboardingService.completeOnboardingStepByKey('SAVE_LEAD');
      }
    } catch (error) {
      console.error("Error adding people to list:", error);
      this.notificationService.showError("Ocurrió un error de conexión al intentar guardar.");
    } finally {
      this.isSaving = false;
    }
  }

  async confirmAddAll(listIds?: number[]): Promise<void> {
    const creditsNeeded = this.totalResultsInServer;

    if (this.creditsRemaining < creditsNeeded) {
      this.notificationService.showError(`No tienes créditos suficientes. Necesitas ${creditsNeeded} y tienes ${this.creditsRemaining}.`);
      this.showConfirmModal = false;
      return;
    }

    this.isSavingAll = true;

    try {
      const result = await this.myListPeopleService.saveAllPeopleResults(this.searchId, listIds);

      if (result.error) {
        this.notificationService.showError(result.message || "Ocurrió un error al guardar.");
      } else {
        this.notificationService.showSuccess(`${result.saved} personas añadidas a tu lista.`);

        if (result.creditsRemaining !== undefined) {
          this.authService.updateCurrentUserCredits(result.creditsRemaining);
        }

        this.selectedPeople = [];
        this.selectAllChecked = false;
        this.showConfirmModal = false;
        this.onboardingService.completeOnboardingStepByKey('SAVE_LEAD');
      }
    } catch (error) {
      console.error("Error adding all people to list:", error);
      this.notificationService.showError("Ocurrió un error de conexión al intentar guardar.");
    } finally {
      this.isSavingAll = false;
    }
  }

  /** El nombre de la fila lleva a la ficha completa de la persona. */
  openPerson(peopleId: number): void {
    this.router.navigate(['/people-details', peopleId]);
  }

  /** Volver a preguntar por una búsqueda que se pasó del tope de sondeo. */
  reloadSearch(): void {
    this.pollTimedOut = false;
    this.loadSearchDetails();
  }
}