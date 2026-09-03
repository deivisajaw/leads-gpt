import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { CompaniesService, Company, CompanySearchResult } from '../../services/companies.service';
import { MyListCompanyService } from '../../services/my-list-company.service'; // Import MyListCompanyService
import { SavedListService, SavedListSummary } from '../../services/saved-list.service';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { CreditsPillComponent } from '../../components/shared/credits-pill/credits-pill.component';
import { OnboardingService } from "../../services/onboarding.service"; // NEW IMPORT

@Component({
  selector: 'app-my-history-search-company-details',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TranslateModule, CreditsPillComponent],
  templateUrl: './my-history-search-company-details.component.html',
  styleUrl: './my-history-search-company-details.component.css'
})
export class MyHistorySearchCompanyDetailsComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('selectionBarPortal') selectionBarPortalRef?: ElementRef<HTMLElement>;
  @ViewChild('confirmModalPortal') confirmModalPortalRef?: ElementRef<HTMLElement>;
  searchId: number = 0;
  searchDetails: CompanySearchResult | null = null;
  isLoading = false;
  currentPage = 1;
  itemsPerPage = 25;
  totalResultsInServer = 0;
  currentSortOrder = 'title_asc';
  currentQuery = ''; // To display the search string

  showSortDropdown = false;

  // Dispara el efecto de aparición de filas (rowin) un tick después de pintar, ver CSS .rowin.
  public rowsRevealed = false;

  private pollingInterval: any;
  private pollTimeout: any;
  public isPolling: boolean = false;
  /** La búsqueda seguía corriendo cuando dejamos de preguntar. */
  public pollTimedOut = false;

  private routeSubscription!: Subscription;

  selectedCompanies: number[] = []; // Added property
  selectAllChecked = false; // Added property

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
    private companiesService: CompaniesService,
    private myListCompanyService: MyListCompanyService,
    private savedListService: SavedListService,
    private authService: AuthService,
    private notificationService: NotificationService,
    private onboardingService: OnboardingService, // NEW INJECTION
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

  public confirmListFilter = '';

  public get filteredAvailableLists(): SavedListSummary[] {
    const q = this.confirmListFilter.trim().toLowerCase();
    if (!q) return this.availableLists;
    return this.availableLists.filter(l => l.name.toLowerCase().includes(q));
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
    this.isLoading = true; // Start loading
    this.currentPage = page;
    this.currentSortOrder = sortBy;
    const offset = (this.currentPage - 1) * this.itemsPerPage;

    try {
      const result: CompanySearchResult = await this.companiesService.getMySearchHistoryCompanyDetails(
        this.searchId,
        offset,
        this.itemsPerPage,
        this.currentSortOrder
      );

      if (result.error) {
        console.error('Error loading company search details:', result.message);
        this.searchDetails = null;
        this.totalResultsInServer = 0;
        this.isLoading = false; // Stop loading on error
        this.stopPolling(); // Ensure polling is stopped
      } else {
        this.searchDetails = result;
        this.currentQuery = result.searchString; // Set the query for display
        this.totalResultsInServer = result.resultsNumber || 0;
        this.rowsRevealed = false;
        setTimeout(() => { this.rowsRevealed = true; }, 0);

        // Handle polling based on search status
        if (result.statusSelect === 1) {
          this.startPolling(); // Polling starts, isLoading remains true
        } else {
          this.stopPolling(); // Stop polling if not in process
          this.isLoading = false; // Stop loading if no polling
        }
      }
    } catch (error) {
      console.error('Error loading company search details:', error);
      this.searchDetails = null;
      this.totalResultsInServer = 0;
      this.isLoading = false; // Stop loading on error
      this.stopPolling(); // Ensure polling is stopped
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
    this.isLoading = false; // Ensure isLoading is reset
  }

  private startPolling() {
    this.stopPolling(); // Ensure any previous poll is stopped

    this.isPolling = true; // Indicate that background polling is active

    // Set a timeout to prevent infinite polling
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
        // Call the details method with current pagination/sort
        const result: CompanySearchResult = await this.companiesService.getMySearchHistoryCompanyDetails(
          this.searchId,
          (this.currentPage - 1) * this.itemsPerPage,
          this.itemsPerPage,
          this.currentSortOrder
        );

        if (result.error) {
          console.error('Error during polling for company search details:', result.message);
          this.stopPolling();
        } else {
          this.searchDetails = result;
          this.currentQuery = result.searchString;
          this.totalResultsInServer = result.resultsNumber || 0;

          // If status is no longer 'in process', stop polling
          if (result.statusSelect !== 1) {
            this.stopPolling();
          }
        }
      } catch (error) {
        console.error("Error during polling for company search details:", error);
        this.stopPolling();
      } finally {
        this.isLoading = false; // Always set isLoading to false after this polling request returns
      }
    }, 5000); // Poll every 5 seconds
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.loadSearchDetails(page);
    }
  }

  onSortChange(sortBy: string) {
    this.currentSortOrder = sortBy;
    this.loadSearchDetails(1, sortBy); // Reload details from page 1 with new sort order
    this.closeAllDropdowns();
  }

  goBack() {
    this.router.navigate(['/my-search-history-companies']);
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
      case 1:
        return 'status-orange';
      case 2:
        return 'status-green';
      case 3:
        return 'status-red';
      default:
        return '';
    }
  }

  getStatusText(status: number | undefined): string {
    switch (status) {
      case 1:
        return 'In process';
      case 2:
        return 'Completed';
      case 3:
        return 'No results';
      default:
        return 'Unknown';
    }
  }

  getFormattedOpeningHours(hoursJson: string): string {
    try {
      const parsed = JSON.parse(hoursJson);
      return parsed.map((entry: any) => `${entry.day.slice(0, 3)}: ${entry.hours}`).join(' | ');
    } catch (e) {
      return 'Invalid format';
    }
  }

  get showSelectionBar(): boolean {
    return this.selectedCompanies.length > 0;
  }

  toggleSelectAll() {
    this.selectAllChecked = !this.selectAllChecked;
    if (this.searchDetails && this.searchDetails.results) {
      if (this.selectAllChecked) {
        this.selectedCompanies = this.searchDetails.results.map(company => company.id);
      } else {
        this.selectedCompanies = [];
      }
    }
  }

  toggleCompanySelection(companyId: number) {
    const index = this.selectedCompanies.indexOf(companyId);
    if (index > -1) {
      this.selectedCompanies.splice(index, 1);
    } else {
      this.selectedCompanies.push(companyId);
    }
    if (this.searchDetails && this.searchDetails.results) {
      this.selectAllChecked = this.selectedCompanies.length === this.searchDetails.results.length;
    }
  }

  closeSelectionBar() {
    this.selectedCompanies = [];
    this.selectAllChecked = false;
  }

  // ─── Modal de confirmación (seleccionados / todos), con listas opcionales ───

  // El botón "Añadir a mi lista" de la barra de selección ya no guarda directo: pide
  // confirmación (con listas opcionales) primero, igual que "Agregar Todos".
  addToMyList(): void {
    if (this.selectedCompanies.length === 0) {
      this.notificationService.showError("No hay empresas seleccionadas");
      return;
    }
    this.confirmModalMode = 'selected';
    this.confirmSelectedListIds.clear();
    this.confirmNewListName = '';
    this.confirmListFilter = '';
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
    this.confirmListFilter = '';
    this.showConfirmModal = true;
  }

  closeConfirmModal() {
    this.showConfirmModal = false;
  }

  get confirmModalTitle(): string {
    return this.confirmModalMode === 'all' ? '¿Agregar todos los resultados?' : '¿Agregar seleccionados?';
  }

  get confirmModalCount(): number {
    return this.confirmModalMode === 'all' ? this.totalResultsInServer : this.selectedCompanies.length;
  }

  get confirmModalMessage(): string {
    const n = this.confirmModalCount;
    return `Esto usará ${n} crédito${n === 1 ? '' : 's'}.`;
  }

  // Se llama desde el botón "Confirmar" del modal (sirve para los dos modos).
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
    const creditsNeeded = this.selectedCompanies.length; // 1 crédito por empresa

    if (creditsNeeded === 0) {
      this.notificationService.showError("No hay empresas seleccionadas");
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
      const result = await this.myListCompanyService.saveCompanyResults(this.selectedCompanies, listIds);

      if (result.error) {
        this.notificationService.showError(result.message || "Ocurrió un error al guardar.");
      } else {
        this.notificationService.showSuccess(`${result.saved} empresas añadidas a tu lista.`);

        if (result.creditsRemaining !== undefined) {
          this.authService.updateCurrentUserCredits(result.creditsRemaining);
        }

        this.selectedCompanies = [];
        this.selectAllChecked = false;
        this.showConfirmModal = false;
        this.onboardingService.completeOnboardingStepByKey('SAVE_LEAD'); // NEW: Complete step on successful save
      }
    } catch (error) {
      console.error("Error adding companies to list:", error);
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
      const result = await this.myListCompanyService.saveAllCompanyResults(this.searchId, listIds);

      if (result.error) {
        this.notificationService.showError(result.message || "Ocurrió un error al guardar.");
      } else {
        this.notificationService.showSuccess(`${result.saved} empresas añadidas a tu lista.`);

        if (result.creditsRemaining !== undefined) {
          this.authService.updateCurrentUserCredits(result.creditsRemaining);
        }

        this.selectedCompanies = [];
        this.selectAllChecked = false;
        this.showConfirmModal = false;
        this.onboardingService.completeOnboardingStepByKey('SAVE_LEAD');
      }
    } catch (error) {
      console.error("Error adding all companies to list:", error);
      this.notificationService.showError("Ocurrió un error de conexión al intentar guardar.");
    } finally {
      this.isSavingAll = false;
    }
  }

  /** El nombre de la fila lleva a la ficha completa de la empresa. */
  openCompany(companyId: number): void {
    this.router.navigate(['/company-details', companyId]);
  }

  /** Volver a preguntar por una búsqueda que se pasó del tope de sondeo. */
  reloadSearch(): void {
    this.pollTimedOut = false;
    this.loadSearchDetails();
  }
}