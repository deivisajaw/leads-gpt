import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, HostListener, NgZone, Renderer2 } from "@angular/core"
import { CommonModule } from "@angular/common"
import { FormsModule } from "@angular/forms"
import { TranslateModule } from '@ngx-translate/core';
import { Router } from "@angular/router"
import { PeopleService, People, PeopleSearchResult, PeopleSearchResponse, PeopleDashboardStats, SuggestedProspect } from "../../services/people.service"
import { MyListPeopleService } from "../../services/my-list-people.service"
import { SavedListService, SavedListSummary } from "../../services/saved-list.service"
import { AuthService } from "../../services/auth.service";
import { Subscription } from "rxjs";
import { NotificationService } from "../../services/notification.service";
import { PlansComponent } from '../plans/plans.component';
import { OnboardingService } from "../../services/onboarding.service";
import { SearchChatComponent, SearchReadyResult } from "../../components/search-chat/search-chat.component";
import { ExportService } from "../../services/export.service";

export interface FacetOption {
  value: string;
  count: number;
}

@Component({
  selector: "app-people",
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, PlansComponent, SearchChatComponent],
  templateUrl: "./people.component.html",
  styleUrl: "./people.component.css",
})
export class PeopleComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('globeCanvas') globeCanvasRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('selectionBarPortal') selectionBarPortalRef?: ElementRef<HTMLElement>;
  @ViewChild('confirmModalPortal') confirmModalPortalRef?: ElementRef<HTMLElement>;

  searchQuery = ""
  currentQuery = ""
  currentCategory = ""
  currentLocation = ""

  isLoading = false;
  currentView: "grid" | "card" | "default" = "grid"
  currentViewText = "Grid view"
  filteredResults: People[] = []
  currentPage = 1
  itemsPerPage = 25
  selectedPeople: number[] = []
  selectAllChecked = false
  totalResults = 0
  currentSearchId: number | null = null

  totalResultsInServer = 0;
  searchStatus = "";
  currentOffset = 0;

  showViewDropdown = false
  showSortDropdown = false

  // ─── Filtros de la barra lateral izquierda ───
  public showFilters = true;
  public showMoreFilters = false;
  public localFilters = {
    name: '',
    jobTitle: '',
    company: '',
    location: ''
  };
  // Facetas calculadas a partir de los resultados de la página actual (chips "Cargo",
  // "Ubicación" y "Estado de email"). NOTA: como el buscador pagina de a 25, estas facetas
  // solo reflejan la página visible, no el total de la búsqueda — para reflejar el total real
  // haría falta un endpoint de facetas en el backend.
  public jobTitleFacetOptions: FacetOption[] = [];
  public locationFacetOptions: FacetOption[] = [];
  public emailFacetOptions: FacetOption[] = [];
  public selectedJobTitleFacets = new Set<string>();
  public selectedLocationFacets = new Set<string>();
  public selectedEmailFacets = new Set<string>();

  // Cada faceta se muestra como chips: los ya seleccionados (con "×" para quitar) y las
  // sugerencias sin seleccionar (chips "+ valor"). Se recalculan solo cuando cambian los datos
  // o la selección — nunca en el template como getter, para no recrear DOM en cada ciclo de
  // change detection (ver el bug que ya tuvimos con quickPrompts en el chat).
  public jobTitleFacetSelected: string[] = [];
  public jobTitleFacetGhost: string[] = [];
  public locationFacetSelected: string[] = [];
  public locationFacetGhost: string[] = [];
  public emailFacetSelected: string[] = [];
  public emailFacetGhost: string[] = [];
  // Acumula filas de todas las páginas visitadas en la búsqueda actual, solo para construir
  // las facetas (no se usa para pintar la tabla). Se reinicia con cada búsqueda nueva.
  private facetSourcePool = new Map<number, People>();

  public displayResults: People[] = [];
  public currentSortOrder: string = 'name_asc';

  // Contador de "Guardados" para el bloque de stats del sidebar — es lo agregado en ESTA sesión
  // (no el total histórico de tu lista, que requeriría otra llamada al backend).
  public sessionSavedCount = 0;

  public creditsRemaining: number = 0;

  // Chip vivo (presentacional): pulso visual cuando cambia el numero de creditos
  creditsPulse = false;
  private _prevCreditsShown: number | null = null;
  private _pulseTimer: ReturnType<typeof setTimeout> | null = null;

  ngDoCheck(): void {
    if (this._prevCreditsShown !== null && this.creditsRemaining !== this._prevCreditsShown) {
      if (this._pulseTimer) { clearTimeout(this._pulseTimer); }
      this.creditsPulse = false;
      requestAnimationFrame(() => { this.creditsPulse = true; });
      this._pulseTimer = setTimeout(() => { this.creditsPulse = false; }, 900);
    }
    this._prevCreditsShown = this.creditsRemaining;
  }
  private userProfileSubscription!: Subscription;

  public searchError: string | null = null;
  public showPlans: boolean = false;
  public isSaving: boolean = false;
  public isSavingAll: boolean = false;
  public savingSingleId: number | null = null;

  // ─── Modal de confirmación genérico (agregar 1 / agregar todos / agregar seleccionados) ───
  // askLists=true muestra el picker de listas: elegir una o varias existentes y/o escribir el
  // nombre de una lista nueva para crearla al confirmar.
  public confirmState: { message: string; confirmLabel: string; askLists: boolean; onConfirm: (listIds?: number[]) => void } | null = null;
  public availableLists: SavedListSummary[] = [];
  public confirmSelectedListIds = new Set<number>();
  public confirmNewListName = '';

  private async loadAvailableLists(): Promise<void> {
    const res = await this.savedListService.getMySavedLists();
    this.availableLists = res.error ? [] : res.lists;
  }

  public confirmListFilter = '';

  public get filteredAvailableLists(): SavedListSummary[] {
    const q = this.confirmListFilter.trim().toLowerCase();
    if (!q) return this.availableLists;
    return this.availableLists.filter(l => l.name.toLowerCase().includes(q));
  }

  private openConfirm(message: string, confirmLabel: string, onConfirm: (listIds?: number[]) => void, askLists = true): void {
    this.confirmSelectedListIds.clear();
    this.confirmNewListName = '';
    this.confirmListFilter = '';
    this.confirmState = { message, confirmLabel, askLists, onConfirm };
  }

  public toggleConfirmList(listId: number): void {
    if (this.confirmSelectedListIds.has(listId)) this.confirmSelectedListIds.delete(listId);
    else this.confirmSelectedListIds.add(listId);
  }

  public async runConfirmed(): Promise<void> {
    const action = this.confirmState?.onConfirm;
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

    this.confirmState = null;
    action?.(listIds.length > 0 ? listIds : undefined);
  }

  public cancelConfirm(): void {
    this.confirmState = null;
  }

  // ─── Revelar email/teléfono por fila (1 crédito cada acción) ───
  public revealingEmailIds = new Set<number>();
  public revealingPhoneIds = new Set<number>();

  // ─── Dashboard stats (barra superior de la vista inicial) — mismas stats combinadas que
  // companies (getStatistics ya suma AiSearch + LinkedinSearch en el backend). ───
  public dashboardStats: PeopleDashboardStats = { leads: 0, searches: 0, phones: 0, emails: 0 };
  public statsLoading = true;

  public suggestedProspects: SuggestedProspect[] = [];
  public suggestedRevealed = false;
  private readonly avatarColors = ['#5b4fe5', '#ec4899', '#3b82f6', '#0ea968'];

  // ─── Globo punteado interactivo de fondo (idéntico al de companies) ───
  private globeCtx: CanvasRenderingContext2D | null = null;
  private globeGradient: CanvasGradient | null = null;
  private globeDots: number[][] = [];
  private landData: Uint8ClampedArray | null = null;
  private landW = 0;
  private landH = 0;
  private maskFailed = false;
  private globeW = 0;
  private globeH = 0;
  private globeR = 0;
  private globeCx = 0;
  private globeCy = 0;
  private rotY = -0.5;
  private rotX = -0.12;
  private velY = 0;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private globeRafId: number | null = null;
  private globeActive = false;
  private globeInited = false;
  private readonly velEpsilon = 0.00004;
  private readonly friction = 0.92;

  // ─── "Manchas" sobre el globo (puramente decorativo, sin datos reales) ───
  private readonly PIN_CITIES: [number, number][] = [
    [4.6, -74.1], [6.2, -75.6], [3.4, -76.5], [10.4, -75.5],
    [-12.0, -77.0], [-33.4, -70.6], [-34.6, -58.4], [-23.5, -46.6],
    [-22.9, -43.2], [19.4, -99.1], [20.7, -103.3], [25.7, -100.3],
    [-0.2, -78.5], [9.0, -79.5],
  ];
  private pins: number[][] = [];

  // Ruta al land-mask usado para dibujar el globo punteado (mismo archivo que companies).
  private readonly landmaskSrc = 'images/earth_landmask_720.png';
  private readonly reducedMotion = typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  private boundOnGlobePointerMove = (e: MouseEvent | TouchEvent) => this.onGlobePointerMove(e);
  private boundOnGlobePointerUp = () => this.onGlobePointerUp();

  constructor(
    private peopleService: PeopleService,
    private myListPeopleService: MyListPeopleService,
    private savedListService: SavedListService,
    private router: Router,
    private authService: AuthService,
    private notificationService: NotificationService,
    private onboardingService: OnboardingService,
    private ngZone: NgZone,
    private renderer: Renderer2,
    private exportService: ExportService
  ) {
    document.addEventListener("click", (event) => {
      const target = event.target as HTMLElement
      if (!target.closest(".dropdown-wrapper")) {
        this.closeAllDropdowns()
      }
    })
  }


  // DEMO version barata del "chip vivo" en tiempo real: refresca el perfil cada 45s
  // para que el saldo (y el pulso) se actualice aunque el consumo pase en el backend.
  // La version propia (websocket/push) queda para Deivis — reemplazar este timer.
  private creditsPollTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.userProfileSubscription = this.authService.userProfile$.subscribe(profile => {
      if (profile && profile.companyProfile) {
        this.creditsRemaining = profile.companyProfile.creditsAllocated ?? 0;
      }
    });

    this.creditsPollTimer = setInterval(() => this.authService.refreshUserProfile(), 45000);

    this.loadDashboardStats();
    this.loadSuggestedProspects();
    this.loadAvailableLists();
  }

  ngAfterViewInit(): void {
    this.initGlobe();
    this.portalFixedElementsToBody();
  }

  // La barra de selección y el modal de confirmación usan position:fixed pensado para
  // posicionarse contra la ventana del navegador — pero si CUALQUIER ancestro (nuestro o de
  // la app que envuelve este componente) tiene transform/filter/perspective/will-change/etc,
  // ese ancestro pasa a ser su "contenedor", y bottom:20px/top:50% dejan de calcularse contra
  // la pantalla. Los movemos una sola vez a <body>, donde no hay ninguna duda posible.
  private portalFixedElementsToBody(): void {
    if (typeof document === 'undefined') return;
    if (this.selectionBarPortalRef) {
      this.renderer.appendChild(document.body, this.selectionBarPortalRef.nativeElement);
    }
    if (this.confirmModalPortalRef) {
      this.renderer.appendChild(document.body, this.confirmModalPortalRef.nativeElement);
    }
  }

  ngOnDestroy(): void {
    if (this.userProfileSubscription) {
      this.userProfileSubscription.unsubscribe();
    }
    if (this.creditsPollTimer) {
      clearInterval(this.creditsPollTimer);
    }
    this.destroyGlobe();
    this.selectionBarPortalRef?.nativeElement.remove();
    this.confirmModalPortalRef?.nativeElement.remove();
  }

  private async loadDashboardStats(): Promise<void> {
    this.statsLoading = true;
    try {
      const res = await this.peopleService.getDashboardStats();
      if (!res.error && res.stats) {
        this.dashboardStats = res.stats;
      }
    } finally {
      this.statsLoading = false;
    }
  }

  private async loadSuggestedProspects(): Promise<void> {
    // Llama a getSuggestedPeopleProspects (LinkedinSearch/LinkedinSearchResults) — es DISTINTO
    // del que usa companies (que ahora usa AiSearchResults). Ver el patch que te pasé.
    try {
      const res = await this.peopleService.getSuggestedProspects(3);
      this.suggestedProspects = res.error ? [] : res.prospects;
    } catch {
      this.suggestedProspects = [];
    }
    this.suggestedRevealed = false;
    setTimeout(() => { this.suggestedRevealed = true; }, 0);
  }

  public getInitials(name: string): string {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(w => w[0])
      .join('')
      .toUpperCase();
  }

  public getAvatarColor(index: number): string {
    return this.avatarColors[index % this.avatarColors.length];
  }

  // Los sugeridos vienen de LinkedinSearchResults (personas reales), así que el "id"
  // corresponde a una persona real — abrimos el MISMO drawer que usan los resultados de
  // búsqueda (openDetail), así "Acceder email"/"Celular" funcionan igual en los dos lugares.
  openSuggestedDetail(p: SuggestedProspect): void {
    const id = typeof p.id === 'string' ? parseInt(p.id, 10) : p.id;
    const asPeople: People = {
      id,
      name: p.name,
      title: '',
      link: '',
      snippet: '',
      image: '',
      description: '',
      searchResultStatusSelect: 0,
      fullName: p.name,
      email: '',
      phone: '',
      education: '',
      experiencies: '',
      countryCode: '',
      location: p.city,
      about: '',
      itemSelected: false,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=5b4fe5&color=fff&size=40`,
      verified: p.verified,
      jobTitle: p.role || '',
      company: p.company || '',
      hasEmailOnFile: undefined,
      hasPhoneOnFile: undefined,
    };
    this.openDetail(asPeople);
  }

  // ─── Pantalla inicial: se pone en blanco (solo header) cuando el chat ya empezó ───
  public chatActive = false;

  onChatStarted(): void {
    this.chatActive = true;
  }

  // ─── Llamado por el chat cuando el agente tiene el query listo ───
  onSearchReady(result: SearchReadyResult): void {
    this.searchQuery = result.query;
    this.currentCategory = result.category;
    this.currentLocation = result.location;
    this.onSearch();
  }

  async onSearch() {
    if (!this.searchQuery.trim() && !this.currentCategory.trim() && !this.currentLocation.trim()) {
      this.resetSearchState();
      return;
    }

    this.searchError = null;
    this.showPlans = false;
    this.filteredResults = [];
    this.displayResults = [];
    this.currentPage = 1;
    this.currentOffset = 0;
    this.selectedPeople = [];
    this.selectAllChecked = false;
    this.facetSourcePool.clear();

    this.isLoading = true;
    this.currentQuery = this.searchQuery;

    try {
      const response = await this.peopleService.runSearchPeople(
        this.currentQuery, 0, this.itemsPerPage, this.currentSortOrder,
        undefined, this.currentCategory, this.currentLocation
      );
      this.processApiResponse(response);
    } catch (error) {
      console.error("Search error:", error);
      this.searchError = "Ocurrio un error inesperado al buscar.";
      this.isLoading = false;
    }
  }

  // ─── Flujo simplificado: solo se consulta nuestro endpoint. Si no hay resultados, se informa
  // y no se dispara ningún webhook externo ni scraping (a diferencia de la versión anterior de
  // este componente). ───
  private processApiResponse(response: PeopleSearchResponse) {
    this.isLoading = false;
    this.searchError = null;
    this.showPlans = false;

    switch (response.status) {
      case 'SUCCESS':
        this.updateStateFromData(response.data);
        this.onboardingService.completeOnboardingStepByKey('FIND_LEADS');
        break;

      case 'SEARCH_NOT_FOUND':
      case 'SEARCH_IN_PROGRESS':
        this.filteredResults = [];
        this.displayResults = [];
        this.totalResultsInServer = 0;
        this.currentSearchId = null;
        this.currentOffset = 0;
        this.searchStatus = "";
        break;

      case 'INSUFFICIENT_CREDITS':
        this.searchError = response.message || "No tienes creditos suficientes.";
        this.showPlans = true;
        break;

      case 'UNAUTHORIZED':
      case 'INVALID_INPUT':
      case 'ERROR':
        this.searchError = response.message || "Ocurrio un error.";
        break;

      default:
        this.searchError = "Respuesta desconocida del servidor.";
        break;
    }
  }

  private updateStateFromData(data: PeopleSearchResult | undefined) {
    if (!data) return;

    // REGLA DE NEGOCIO: el buscador principal NUNCA debe mostrar email/teléfono, sin importar
    // si el backend los trae en la respuesta. Solo se muestran cuando el usuario los solicita
    // explícitamente con "Acceder email"/"Celular" (revealEmail/revealPhone) en esta sesión.
    // Guardamos si el registro TIENE el dato (no el valor) para poder construir la faceta
    // "Estado de email" sin filtrar el dato real.
    //
    // Además se preserva el parseo original de "title" ("Nombre - Cargo | Empresa") para
    // extraer jobTitle/company, tal como ya lo hacía este componente antes.
    const safeResults = Array.isArray(data.results) ? data.results : [];
    this.filteredResults = safeResults.map(people => {
      const mainParts = (people.title || '').split(' | ');
      const nameAndTitleParts = mainParts[0].split(' - ');
      const jobTitle = nameAndTitleParts.length > 1 ? nameAndTitleParts.slice(1).join(' - ').trim() : 'N/A';
      const company = mainParts[1] ? mainParts[1].trim() : 'N/A';

      return {
        ...people,
        jobTitle,
        company,
        avatar: people.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(people.name)}&background=5b4fe5&color=fff&size=40`,
        hasEmailOnFile: !!people.email,
        hasPhoneOnFile: !!people.phone,
        email: '',
        phone: '',
        verified: false,
      };
    });

    this.totalResultsInServer = data.resultsNumber || 0;
    this.currentSearchId = data.searchId || null;
    this.currentOffset = data.offset;
    this.currentSortOrder = data.sortBy || 'name_asc';

    if (data.creditsRemaining !== undefined) {
      this.authService.updateCurrentUserCredits(data.creditsRemaining);
    }

    // Las facetas se construyen acumulando TODAS las páginas que el usuario ya visitó en esta
    // búsqueda (no solo la página actual de 25) — así "Cargo"/"Ubicación" van creciendo a
    // medida que navega.
    for (const person of this.filteredResults) {
      if (!this.facetSourcePool.has(person.id)) {
        this.facetSourcePool.set(person.id, person);
      }
    }

    this.buildFacets();
    this.applyLocalFilters();
  }

  private buildFacets(): void {
    const pool = Array.from(this.facetSourcePool.values());
    this.jobTitleFacetOptions = this.countBy(pool, p => p.jobTitle);
    this.locationFacetOptions = this.countBy(pool, p => p.location);
    // Si el backend nunca manda hasEmailOnFile, todos quedan "undefined" y countBy los descarta
    // (valor vacío) — la faceta simplemente no aparece hasta que el backend la soporte.
    this.emailFacetOptions = this.countBy(pool, p =>
      p.hasEmailOnFile === undefined ? '' : (p.hasEmailOnFile ? 'Con email' : 'Sin email')
    );
    this.recomputeFacetChips();
  }

  // Separa cada faceta en chips "seleccionados" (con ×) y chips "+ sugerencia" sin seleccionar.
  // Se llama solo tras cambios reales de datos o selección, nunca desde el template.
  private recomputeFacetChips(): void {
    this.jobTitleFacetSelected = Array.from(this.selectedJobTitleFacets);
    this.jobTitleFacetGhost = this.jobTitleFacetOptions
      .map(o => o.value)
      .filter(v => !this.selectedJobTitleFacets.has(v));

    this.locationFacetSelected = Array.from(this.selectedLocationFacets);
    this.locationFacetGhost = this.locationFacetOptions
      .map(o => o.value)
      .filter(v => !this.selectedLocationFacets.has(v));

    this.emailFacetSelected = Array.from(this.selectedEmailFacets);
    this.emailFacetGhost = this.emailFacetOptions
      .map(o => o.value)
      .filter(v => !this.selectedEmailFacets.has(v));
  }

  private countBy(items: People[], pick: (p: People) => string | undefined): FacetOption[] {
    const counts = new Map<string, number>();
    for (const item of items) {
      const value = (pick(item) || '').trim();
      if (!value || value === 'N/A') continue;
      counts.set(value, (counts.get(value) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);
  }

  private resetSearchState(keepQueryText = false) {
    const previousQuery = this.currentQuery;
    this.currentQuery = "";
    if (!keepQueryText) {
      this.searchQuery = "";
    } else {
      this.searchQuery = previousQuery;
    }

    this.currentCategory = "";
    this.currentLocation = "";
    this.currentSearchId = null;
    
    this.filteredResults = [];
    this.displayResults = [];
    this.selectedPeople = [];
    this.currentSearchId = null;
    this.totalResultsInServer = 0;
    this.currentOffset = 0;
    this.searchStatus = "";
    this.searchError = null;
    this.showPlans = false;
    this.isLoading = false;
    this.jobTitleFacetOptions = [];
    this.locationFacetOptions = [];
    this.emailFacetOptions = [];
    this.selectedJobTitleFacets.clear();
    this.selectedLocationFacets.clear();
    this.selectedEmailFacets.clear();
    this.jobTitleFacetSelected = [];
    this.jobTitleFacetGhost = [];
    this.locationFacetSelected = [];
    this.locationFacetGhost = [];
    this.emailFacetSelected = [];
    this.emailFacetGhost = [];
    this.facetSourcePool.clear();
    this.sessionSavedCount = 0;
    this.revealingEmailIds.clear();
    this.revealingPhoneIds.clear();
    this.detailPeople = null;
    this.chatActive = false;

    // El globo estaba oculto (display:none) mientras se mostraban resultados; al volver a la
    // vista inicial hay que recalcular sus dimensiones.
    setTimeout(() => this.resizeGlobe(), 0);
  }

  // "Editar búsqueda" / "Nueva búsqueda" en la cabecera de resultados.
  editSearch(): void {
    this.resetSearchState(true);
  }

  newSearch(): void {
    this.resetSearchState(false);
  }

  async goToPage(page: number) {
    if (page < 1 || (!this.currentQuery && !this.currentCategory && !this.currentLocation) || this.isLoading) return;
    const newOffset = (page - 1) * this.itemsPerPage;
    if (newOffset >= this.totalResultsInServer && this.totalResultsInServer > 0) return;

    this.isLoading = true;
    this.currentPage = page;
    this.currentOffset = newOffset;

    try {
      const response = await this.peopleService.runSearchPeople(
        this.currentQuery, newOffset, this.itemsPerPage, this.currentSortOrder,
        this.currentSearchId ?? undefined, this.currentCategory, this.currentLocation
      );
      this.processApiResponse(response);
    } catch (error) {
      console.error("Error loading page:", error);
      this.searchError = "Error al cargar la pagina.";
      this.isLoading = false;
    }
  }

  onKeyPress(event: KeyboardEvent) {
    if (event.key === "Enter") {
      this.currentCategory = "";
      this.currentLocation = "";
      this.onSearch();
    }
  }

  get showSelectionBar(): boolean {
    return this.selectedPeople.length > 0
  }

  changeView(view: "grid" | "card" | "default") {
    this.currentView = view
    switch (view) {
      case "grid": this.currentViewText = "Grid view"; break;
      case "card": this.currentViewText = "Card view"; break;
      case "default": this.currentViewText = "Default view"; break;
    }
  }

  toggleSelectAll() {
    this.selectAllChecked = !this.selectAllChecked
    this.selectedPeople = this.selectAllChecked ? this.displayResults.map(p => p.id) : [];
  }

  togglePeopleSelection(peopleId: number) {
    const index = this.selectedPeople.indexOf(peopleId)
    if (index > -1) {
      this.selectedPeople.splice(index, 1)
    } else {
      this.selectedPeople.push(peopleId)
    }
    this.selectAllChecked = this.displayResults.length > 0 && this.selectedPeople.length === this.displayResults.length;
  }

  // ─── Guardar (individual / seleccionados / todos) — pide confirmación + tags, SIN disparar
  // ningún scraping externo (eso se eliminó a propósito: ya no se llama a
  // apiConfig.scrapingPeopleUrl después de guardar). ───

  addToMyList(): void {
    const creditsNeeded = this.selectedPeople.length;
    if (creditsNeeded === 0) {
      this.notificationService.showError("No hay personas seleccionadas");
      return;
    }
    if (this.creditsRemaining < creditsNeeded) {
      this.notificationService.showError(`No tienes creditos suficientes. Necesitas ${creditsNeeded} y tienes ${this.creditsRemaining}.`);
      return;
    }
    this.openConfirm(
      `¿Añadir ${creditsNeeded} ${creditsNeeded === 1 ? 'persona' : 'personas'} a tu lista? Esto usará ${creditsNeeded} crédito${creditsNeeded === 1 ? '' : 's'}.`,
      'Añadir',
      (listIds) => this.doAddToMyList(listIds)
    );
  }

  private async doAddToMyList(listIds?: number[]): Promise<void> {
    this.isSaving = true;
    try {
      const result = await this.myListPeopleService.savePeopleResults(this.selectedPeople, listIds);
      if (result.error) {
        this.notificationService.showError(result.message || "Error al guardar las personas");
      } else {
        if (result.creditsRemaining !== undefined) {
          this.authService.updateCurrentUserCredits(result.creditsRemaining);
        }
        this.notificationService.showSuccess(`${result.saved} personas anadidas a tu lista.`);
        this.sessionSavedCount += result.saved || 0;
        this.selectedPeople = [];
        this.selectAllChecked = false;
        this.onboardingService.completeOnboardingStepByKey('SAVE_LEAD');
      }
    } catch (error) {
      this.notificationService.showError("Error de conexion al guardar las personas.");
    } finally {
      this.isSaving = false;
    }
  }

  // Acción "+" de una sola fila en la tabla — pide confirmación (con listas opcionales) antes de ejecutar.
  quickAddToList(people: People): void {
    this.openConfirm(
      `¿Añadir "${people.name}" a tu lista? Esto usará 1 crédito.`,
      'Añadir',
      (listIds) => this.doQuickAddToList(people, listIds)
    );
  }

  private async doQuickAddToList(people: People, listIds?: number[]): Promise<void> {
    if (this.savingSingleId !== null) return;
    if (this.creditsRemaining < 1) {
      this.notificationService.showError('No tienes créditos suficientes.');
      return;
    }
    this.savingSingleId = people.id;
    try {
      const result = await this.myListPeopleService.savePeopleResults([people.id], listIds);
      if (result.error) {
        this.notificationService.showError(result.message || 'Error al guardar la persona');
      } else {
        if (result.creditsRemaining !== undefined) {
          this.authService.updateCurrentUserCredits(result.creditsRemaining);
        }
        this.notificationService.showSuccess(`${people.name} añadida a tu lista.`);
        this.sessionSavedCount++;
        this.onboardingService.completeOnboardingStepByKey('SAVE_LEAD');
      }
    } catch (error) {
      this.notificationService.showError('Error de conexión al guardar la persona.');
    } finally {
      this.savingSingleId = null;
    }
  }

  // "Agregar Todos" — pide confirmación (con listas opcionales) antes de ejecutar.
  addAllToMyList(): void {
    if (!this.currentSearchId || this.totalResultsInServer === 0) {
      this.notificationService.showError("No hay una busqueda activa o la busqueda no arrojo resultados.");
      return;
    }
    this.openConfirm(
      `¿Añadir los ${this.totalResultsInServer} resultados de esta búsqueda a tu lista? Esto usará ${this.totalResultsInServer} créditos.`,
      'Añadir todos',
      (listIds) => this.doAddAllToMyList(listIds)
    );
  }

  private async doAddAllToMyList(listIds?: number[]) {
    if (!this.currentSearchId || this.totalResultsInServer === 0) return;
    const creditsNeeded = this.totalResultsInServer;
    if (this.creditsRemaining < creditsNeeded) {
      this.notificationService.showError(`No tienes creditos suficientes. Necesitas ${creditsNeeded} y tienes ${this.creditsRemaining}.`);
      return;
    }
    this.isSavingAll = true;
    try {
      const result = await this.myListPeopleService.saveAllPeopleResults(this.currentSearchId, listIds);
      if (result && result.error === false && typeof result.saved === 'number') {
        if (result.creditsRemaining !== undefined) {
          this.authService.updateCurrentUserCredits(result.creditsRemaining);
        }
        this.notificationService.showSuccess(`${result.saved} nuevas personas anadidas a tu lista.`);
        this.sessionSavedCount += result.saved;
        this.selectedPeople = [];
        this.selectAllChecked = false;
      } else {
        const errorMessage = result?.message || "Ocurrio un error en el servidor. Por favor, intentalo de nuevo.";
        this.notificationService.showError(errorMessage);
      }
    } catch (error) {
      this.notificationService.showError("Error de conexion al guardar todas las personas.");
    } finally {
      this.isSavingAll = false;
    }
  }

  downloadSelected() { this.notificationService.showError(`Downloading ${this.selectedPeople.length} selected people`) }
  viewSelected() { this.notificationService.showError(`Viewing ${this.selectedPeople.length} selected people`) }
  closeSelectionBar() { this.selectedPeople = []; this.selectAllChecked = false; }

  // Exporta los resultados visibles (después de filtros). Igual que my-list-people.component.ts:
  // exporta exactamente los valores que hay en memoria — por eso email/phone salen vacíos
  // salvo que el usuario ya los haya revelado en esta sesión, sin ningún caso especial.
  exportToCsv(): void {
    if (this.displayResults.length === 0) {
      this.notificationService.showError('No hay resultados para exportar.');
      return;
    }
    const dataToExport = this.displayResults.map(
      ({ id, name, fullName, jobTitle, company, location, countryCode, email, phone,
        link, description, education, about, experiencies, snippet }) => ({
        id, name, fullName, jobTitle, company, location, countryCode, email, phone,
        link, description, education, about, experiencies, snippet,
      })
    );
    this.exportService.exportToCsv(dataToExport, 'people-search');
  }

  // ─── Panel de detalle (drawer lateral derecho) ───
  public detailPeople: People | null = null;

  openDetail(people: People): void {
    this.detailPeople = people;
  }

  closeDetail(): void {
    this.detailPeople = null;
  }

  // ─── Revelar email/teléfono por fila (1 crédito por acción) ───
  isRevealingEmail(id: number): boolean { return this.revealingEmailIds.has(id); }
  isRevealingPhone(id: number): boolean { return this.revealingPhoneIds.has(id); }

  async revealEmail(people: People): Promise<void> {
    if (people.email || this.revealingEmailIds.has(people.id)) return;
    if (this.creditsRemaining < 1) {
      this.notificationService.showError('No tienes créditos suficientes.');
      return;
    }
    this.revealingEmailIds.add(people.id);
    try {
      const res = await this.peopleService.revealPeopleEmail(people.id);
      if (res.error || !res.value) {
        this.notificationService.showError(res.message || 'No se pudo obtener el email.');
      } else {
        people.email = res.value;
        if (res.creditsRemaining !== undefined) {
          this.authService.updateCurrentUserCredits(res.creditsRemaining);
        }
      }
    } finally {
      this.revealingEmailIds.delete(people.id);
    }
  }

  async revealPhone(people: People): Promise<void> {
    if (people.phone || this.revealingPhoneIds.has(people.id)) return;
    if (this.creditsRemaining < 1) {
      this.notificationService.showError('No tienes créditos suficientes.');
      return;
    }
    this.revealingPhoneIds.add(people.id);
    try {
      const res = await this.peopleService.revealPeoplePhone(people.id);
      if (res.error || !res.value) {
        this.notificationService.showError(res.message || 'No se pudo obtener el teléfono.');
      } else {
        people.phone = res.value;
        if (res.creditsRemaining !== undefined) {
          this.authService.updateCurrentUserCredits(res.creditsRemaining);
        }
      }
    } finally {
      this.revealingPhoneIds.delete(people.id);
    }
  }

  get totalPages(): number { return Math.ceil(this.totalResultsInServer / this.itemsPerPage) }
  getStartIndex(): number { return this.displayResults.length > 0 ? (this.currentPage - 1) * this.itemsPerPage + 1 : 0; }
  getEndIndex(): number { return Math.min(this.currentPage * this.itemsPerPage, this.totalResultsInServer); }
  getFormattedTotal(): string { return this.totalResultsInServer.toLocaleString() }

  toggleDropdown(dropdownName: string) {
    this.showViewDropdown = dropdownName === 'view' ? !this.showViewDropdown : false;
    this.showSortDropdown = dropdownName === 'sort' ? !this.showSortDropdown : false;
  }

  closeAllDropdowns() {
    this.showViewDropdown = false;
    this.showSortDropdown = false;
  }

  goToUpgradePlan(): void { this.router.navigate(['/upgrade-plan']); }

  public rowsRevealed = false;

  public applyLocalFilters(): void {
    let results = [...this.filteredResults];
    if (this.localFilters.name) results = results.filter(p => p.name?.toLowerCase().includes(this.localFilters.name.toLowerCase()));
    if (this.localFilters.jobTitle) results = results.filter(p => p.jobTitle?.toLowerCase().includes(this.localFilters.jobTitle.toLowerCase()));
    if (this.localFilters.company) results = results.filter(p => p.company?.toLowerCase().includes(this.localFilters.company.toLowerCase()));
    if (this.localFilters.location) results = results.filter(p => p.location?.toLowerCase().includes(this.localFilters.location.toLowerCase()));
    if (this.selectedJobTitleFacets.size > 0) results = results.filter(p => this.selectedJobTitleFacets.has(p.jobTitle));
    if (this.selectedLocationFacets.size > 0) results = results.filter(p => this.selectedLocationFacets.has(p.location));
    if (this.selectedEmailFacets.size > 0) {
      results = results.filter(p => {
        const label = p.hasEmailOnFile === undefined ? '' : (p.hasEmailOnFile ? 'Con email' : 'Sin email');
        return this.selectedEmailFacets.has(label);
      });
    }
    this.displayResults = results;

    // El efecto de aparición (rowin) solo se dispara de forma confiable si la clase que trae
    // la animación se agrega DESPUÉS de que las filas ya se pintaron una vez. Por eso
    // arrancamos en "invisible" (ver CSS .rowin) y activamos .play en el siguiente tick.
    this.rowsRevealed = false;
    setTimeout(() => { this.rowsRevealed = true; }, 0);
  }

  public onFilterChange(): void {
    this.currentPage = 1;
    this.recomputeFacetChips();
    this.applyLocalFilters();
  }

  // Muestra/oculta la barra lateral de filtros (no borra los filtros ya aplicados).
  public toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  public toggleMoreFilters(): void {
    this.showMoreFilters = !this.showMoreFilters;
  }

  public toggleJobTitleFacet(value: string): void {
    if (this.selectedJobTitleFacets.has(value)) this.selectedJobTitleFacets.delete(value);
    else this.selectedJobTitleFacets.add(value);
    this.onFilterChange();
  }

  public toggleLocationFacet(value: string): void {
    if (this.selectedLocationFacets.has(value)) this.selectedLocationFacets.delete(value);
    else this.selectedLocationFacets.add(value);
    this.onFilterChange();
  }

  public toggleEmailFacet(value: string): void {
    if (this.selectedEmailFacets.has(value)) this.selectedEmailFacets.delete(value);
    else this.selectedEmailFacets.add(value);
    this.onFilterChange();
  }

  // Total de filtros activos — alimenta el badge numérico junto a "Ocultar/Mostrar filtros".
  public get activeFilterCount(): number {
    let n = this.selectedJobTitleFacets.size + this.selectedLocationFacets.size + this.selectedEmailFacets.size;
    if (this.localFilters.name) n++;
    if (this.localFilters.jobTitle) n++;
    if (this.localFilters.company) n++;
    if (this.localFilters.location) n++;
    return n;
  }

  public get hasActiveFilters(): boolean {
    return this.activeFilterCount > 0;
  }

  public clearAllFilters(): void {
    this.selectedJobTitleFacets.clear();
    this.selectedLocationFacets.clear();
    this.selectedEmailFacets.clear();
    this.localFilters = { name: '', jobTitle: '', company: '', location: '' };
    this.currentPage = 1;
    this.recomputeFacetChips();
    this.applyLocalFilters();
  }

  public onSortChange(sortBy: string): void { this.currentSortOrder = sortBy; this.goToPage(1); this.closeAllDropdowns(); }

  // ════════════════════════════════════════════════════════════════
  //  Globo punteado interactivo (fondo decorativo de la vista inicial) — idéntico a companies
  // ════════════════════════════════════════════════════════════════

  @HostListener('window:resize')
  onWindowResize(): void {
    this.resizeGlobe();
  }

  private initGlobe(): void {
    const canvas = this.globeCanvasRef?.nativeElement;
    if (!canvas || this.globeInited) return;
    this.globeInited = true;

    this.globeCtx = canvas.getContext('2d');
    this.pins = this.PIN_CITIES.map(([lat, lon]) => this.llToVec(lat, lon));
    this.resizeGlobe();
    this.loadLandmask();

    // Todo lo relacionado al globo (listeners de arrastre + loop de animación) corre FUERA de
    // la zona de Angular: requestAnimationFrame está parcheado por zone.js, así que sin esto
    // cada frame dispararía un ciclo completo de change detection de toda la app y termina
    // congelando el navegador.
    this.ngZone.runOutsideAngular(() => {
      canvas.addEventListener('mousedown', (e) => this.onGlobePointerDown(e));
      canvas.addEventListener('touchstart', (e) => this.onGlobePointerDown(e), { passive: true });
      window.addEventListener('mousemove', this.boundOnGlobePointerMove);
      window.addEventListener('touchmove', this.boundOnGlobePointerMove, { passive: false });
      window.addEventListener('mouseup', this.boundOnGlobePointerUp);
      window.addEventListener('touchend', this.boundOnGlobePointerUp);
    });
  }

  private destroyGlobe(): void {
    if (this.globeRafId !== null) {
      cancelAnimationFrame(this.globeRafId);
      this.globeRafId = null;
    }
    window.removeEventListener('mousemove', this.boundOnGlobePointerMove);
    window.removeEventListener('touchmove', this.boundOnGlobePointerMove);
    window.removeEventListener('mouseup', this.boundOnGlobePointerUp);
    window.removeEventListener('touchend', this.boundOnGlobePointerUp);
  }

  private loadLandmask(): void {
    const img = new Image();
    img.onload = () => {
      try {
        const off = document.createElement('canvas');
        off.width = img.width;
        off.height = img.height;
        const octx = off.getContext('2d');
        if (!octx) throw new Error('no ctx');
        octx.drawImage(img, 0, 0);
        this.landData = octx.getImageData(0, 0, img.width, img.height).data;
        this.landW = img.width;
        this.landH = img.height;
        this.buildGlobeDots();
      } catch {
        this.maskFailed = true;
        this.buildGlobeDots();
      }
      this.startGlobeLoop();
    };
    img.onerror = () => {
      console.warn(`No se pudo cargar el land-mask del globo en "${this.landmaskSrc}". Verifica que earth_landmask_720.png esté copiado en esa ruta pública.`);
      this.maskFailed = true;
      this.buildGlobeDots();
      this.startGlobeLoop();
    };
    img.src = this.landmaskSrc;
  }

  private isLand(latD: number, lonD: number): boolean {
    if (!this.landData) return true;
    const u = (lonD + 180) / 360;
    const v = (90 - latD) / 180;
    const px = Math.min(this.landW - 1, Math.max(0, Math.floor(u * this.landW)));
    const py = Math.min(this.landH - 1, Math.max(0, Math.floor(v * this.landH)));
    const i = (py * this.landW + px) * 4;
    return (this.landData[i] + this.landData[i + 1] + this.landData[i + 2]) < 250;
  }

  private buildGlobeDots(): void {
    this.globeDots = [];
    if (!this.landData && !this.maskFailed) return;
    for (let latD = -82; latD <= 84; latD += 2.0) {
      const lat = latD * Math.PI / 180;
      const n = Math.max(12, Math.round(Math.cos(lat) * 210));
      for (let i = 0; i < n; i++) {
        const lonD = -180 + (i / n) * 360;
        if (this.landData && !this.isLand(latD, lonD)) continue;
        const lon = lonD * Math.PI / 180;
        this.globeDots.push([Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon)]);
      }
    }
  }

  private llToVec(latD: number, lonD: number): number[] {
    const lat = latD * Math.PI / 180;
    const lon = lonD * Math.PI / 180;
    return [Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon)];
  }

  private resizeGlobe(): void {
    const canvas = this.globeCanvasRef?.nativeElement;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.globeW = canvas.clientWidth;
    this.globeH = canvas.clientHeight;
    if (!this.globeW || !this.globeH) return;
    canvas.width = this.globeW * dpr;
    canvas.height = this.globeH * dpr;
    this.globeCtx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.globeR = Math.min(this.globeW, this.globeH) * 0.43;
    this.globeCx = this.globeW / 2;
    this.globeCy = this.globeH / 2;
    this.buildGlobeGradient();
    // Forzamos un render puntual para que no quede en blanco mientras está inactivo (idle).
    this.startGlobeLoop();
  }

  private buildGlobeGradient(): void {
    if (!this.globeCtx) return;
    const g = this.globeCtx.createRadialGradient(
      this.globeCx - this.globeR * 0.35, this.globeCy - this.globeR * 0.4, this.globeR * 0.05,
      this.globeCx, this.globeCy, this.globeR * 1.02
    );
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.82, 'rgba(91,79,229,0.03)');
    g.addColorStop(1, 'rgba(91,79,229,0.08)');
    this.globeGradient = g;
  }

  private project(v: number[]): { x: number; y: number; depth: number } {
    const [x, y, z] = v;
    const x1 = x * Math.cos(this.rotY) + z * Math.sin(this.rotY);
    const z1 = -x * Math.sin(this.rotY) + z * Math.cos(this.rotY);
    const y1 = y;
    const y2 = y1 * Math.cos(this.rotX) - z1 * Math.sin(this.rotX);
    const z2 = y1 * Math.sin(this.rotX) + z1 * Math.cos(this.rotX);
    return { x: this.globeCx + x1 * this.globeR, y: this.globeCy - y2 * this.globeR, depth: z2 };
  }

  private startGlobeLoop(): void {
    if (this.globeActive || !this.globeCtx) return;
    this.globeActive = true;
    this.globeRafId = requestAnimationFrame(() => this.globeFrame());
  }

  private globeFrame(): void {
    const canvas = this.globeCanvasRef?.nativeElement;
    if (!canvas || !this.globeCtx) {
      this.globeActive = false;
      this.globeRafId = null;
      return;
    }

    // El canvas queda oculto (display:none) mientras se muestran resultados. Nos APAGAMOS por
    // completo (ver la historia del bug de congelamiento en companies — este es el fix).
    if (canvas.offsetParent === null) {
      this.globeActive = false;
      this.globeRafId = null;
      return;
    }

    if (!this.globeW && canvas.clientWidth) this.resizeGlobe();

    // Sin auto-rotación: el globo solo gira mientras el usuario arrastra, y luego frena por
    // fricción hasta detenerse.
    if (!this.dragging && Math.abs(this.velY) > this.velEpsilon) {
      this.rotY += this.velY;
      this.velY *= this.friction;
    } else if (!this.dragging) {
      this.velY = 0;
    }

    this.renderGlobeFrame();

    const stillAnimating = this.dragging || Math.abs(this.velY) > this.velEpsilon;
    if (stillAnimating) {
      this.globeRafId = requestAnimationFrame(() => this.globeFrame());
    } else {
      this.globeActive = false;
      this.globeRafId = null;
    }
  }

  private renderGlobeFrame(): void {
    const ctx = this.globeCtx;
    if (!ctx) return;

    ctx.clearRect(0, 0, this.globeW, this.globeH);

    if (this.globeGradient) {
      ctx.fillStyle = this.globeGradient;
      ctx.beginPath();
      ctx.arc(this.globeCx, this.globeCy, this.globeR, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const dot of this.globeDots) {
      const p = this.project(dot);
      if (p.depth < 0.05) continue;
      ctx.fillStyle = `rgba(79,70,229,${0.4 + 0.5 * p.depth})`;
      const s = p.depth > 0.55 ? 1.5 : 1.2;
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }

    this.drawPins();
  }

  private drawPins(): void {
    const ctx = this.globeCtx;
    if (!ctx) return;

    for (const pin of this.pins) {
      const p = this.project(pin);
      if (p.depth < 0.04) continue;

      const baseR = 2.6;
      const glowR = baseR * 5;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR);
      g.addColorStop(0, 'rgba(91,79,229,0.35)');
      g.addColorStop(0.5, 'rgba(91,79,229,0.10)');
      g.addColorStop(1, 'rgba(91,79,229,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(91,79,229,0.9)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, baseR, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private onGlobePointerDown(e: MouseEvent | TouchEvent): void {
    this.dragging = true;
    this.velY = 0;
    this.globeCanvasRef?.nativeElement.classList.add('drag');
    const t = 'touches' in e ? e.touches[0] : e;
    this.lastX = t.clientX;
    this.lastY = t.clientY;
    this.startGlobeLoop();
  }

  private onGlobePointerMove(e: MouseEvent | TouchEvent): void {
    if (!this.dragging) return;
    const t = 'touches' in e ? e.touches[0] : e;
    const dx = t.clientX - this.lastX;
    const dy = t.clientY - this.lastY;
    this.lastX = t.clientX;
    this.lastY = t.clientY;
    this.rotY += dx * 0.006;
    this.rotX = Math.max(-1.2, Math.min(1.2, this.rotX + dy * 0.006));
    this.velY = dx * 0.006;
    if ('touches' in e && e.cancelable) e.preventDefault();
  }

  private onGlobePointerUp(): void {
    this.dragging = false;
    if (this.reducedMotion) {
      this.velY = 0;
    }
    this.globeCanvasRef?.nativeElement.classList.remove('drag');
  }
}