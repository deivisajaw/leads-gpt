import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ViewChild,
  ElementRef,
  HostListener,
  NgZone,
  Renderer2,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { TranslateModule, TranslateService } from "@ngx-translate/core";
import { Router, ActivatedRoute } from "@angular/router";
import {
  CompaniesService,
  Company,
  CompanySearchResult,
  CompanySearchResponse,
  CompanyDashboardStats,
  SuggestedProspect,
} from "../../services/companies.service";
import { MyListCompanyService } from "../../services/my-list-company.service";
import {
  SavedListService,
  SavedListSummary,
} from "../../services/saved-list.service";
import { AuthService } from "../../services/auth.service";
import { Subscription } from "rxjs";
import { NotificationService } from "../../services/notification.service";
import { PlansComponent } from "../plans/plans.component";
import { OnboardingService } from "../../services/onboarding.service";
import { ApiConfigService } from "../../services/api-config.service";
import {
  SearchChatComponent,
  SearchReadyResult,
} from "../../components/search-chat/search-chat.component";
import { ExportService } from "../../services/export.service";
import { CreditsPillComponent } from '../../components/shared/credits-pill/credits-pill.component';
import { IndustryTaxonomyService, IndustrySection } from '../../services/industry-taxonomy.service';

export interface FacetOption {
  value: string;
  count: number;
}

@Component({
  selector: "app-companies",
  standalone: true,
  imports: [CommonModule,
    FormsModule,
    TranslateModule,
    PlansComponent,
    SearchChatComponent,
    CreditsPillComponent],
  templateUrl: "./companies.component.html",
  styleUrl: "./companies.component.css",
})
export class CompaniesComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild("globeCanvas") globeCanvasRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild("selectionBarPortal")
  selectionBarPortalRef?: ElementRef<HTMLElement>;
  @ViewChild("confirmModalPortal")
  confirmModalPortalRef?: ElementRef<HTMLElement>;

  searchQuery = "";
  currentQuery = "";
  currentCategory = "";
  currentLocation = "";
  isLoading = false;
  currentView: "grid" | "card" | "default" = "grid";
  currentViewText = "Grid view";
  filteredResults: Company[] = [];
  currentPage = 1;
  itemsPerPage = 25;
  selectedCompanies: number[] = [];
  selectAllChecked = false;
  totalResults = 0;
  currentSearchId: number | null = null;

  totalResultsInServer = 0;
  searchStatus = "";
  currentOffset = 0;

  showViewDropdown = false;
  showSortDropdown = false;

  // ─── Filtros de la barra lateral izquierda ───
  public showFilters = true;
  public showMoreFilters = false;
  public localFilters = {
    title: "",
    categoryName: "",
    city: "",
    state: "",
    countryCode: "",
  };
  // Facetas calculadas a partir de los resultados de la página actual (chips "Ubicación",
  // "Industria" y "Estado de email"). NOTA: como el buscador pagina de a 25, estas facetas solo
  // reflejan la página visible, no el total de la búsqueda — para reflejar el total real haría
  // falta un endpoint de facetas en el backend.
  public cityFacetOptions: FacetOption[] = [];
  // ── Filtro de industria (taxonomía propia, 16 grupos / 89 industrias) ──
  public industrySections: IndustrySection[] = [];
  public industryOpen = false;
  /** Las secciones arrancan cerradas, como en Apollo: la columna se lee de un vistazo. */
  public showCatFacet = false;
  public showCityFacet = false;
  public showEmailFacet = false;
  public industryQuery = '';
  public selectedIndustryGroups = new Set<string>();
  /** Sector ISIC crudo -> grupo comprador. El 91% de las filas sólo trae eso. */
  private sectorToGroup: Record<string, string> = {};

  /**
   * Filtros que todavía no tienen datos detrás. Se muestran con candado y
   * "Próximamente" en vez de esconderlos: enseñan a dónde va el producto sin
   * prometer un resultado que hoy volvería vacío.
   */
  public readonly lockedFilters: { key: string; icon: string }[] = [
    { key: 'EMPLOYEES',   icon: 'users' },
    { key: 'REVENUE',     icon: 'dollar' },
    { key: 'FUNDING',     icon: 'trending' },
    { key: 'TECH',        icon: 'cpu' },
    { key: 'JOB_POSTS',   icon: 'briefcase' },
    { key: 'INTENT',      icon: 'target' },
    { key: 'CO_LOOKALIKE',icon: 'copy' },
    { key: 'PE_LOOKALIKE',icon: 'userplus' },
  ];

  public categoryFacetOptions: FacetOption[] = [];
  public emailFacetOptions: FacetOption[] = [];
  public selectedCityFacets = new Set<string>();
  public selectedCategoryFacets = new Set<string>();
  public selectedEmailFacets = new Set<string>();

  // Cada faceta se muestra como chips: los ya seleccionados (con "×" para quitar) y hasta 4
  // sugerencias sin seleccionar (chips "+ valor"). Se recalculan solo cuando cambian los datos
  // o la selección — nunca en el template como getter, para no recrear DOM en cada ciclo de
  // change detection (ver el bug que ya tuvimos con quickPrompts).
  public cityFacetSelected: string[] = [];
  public cityFacetGhost: string[] = [];
  public categoryFacetSelected: string[] = [];
  public categoryFacetGhost: string[] = [];
  public emailFacetSelected: string[] = [];
  public emailFacetGhost: string[] = [];
  // Acumula filas de todas las páginas visitadas en la búsqueda actual, solo para construir
  // las facetas (no se usa para pintar la tabla). Se reinicia con cada búsqueda nueva.
  private facetSourcePool = new Map<number, Company>();

  public displayResults: Company[] = [];
  public currentSortOrder: string = "title_asc";

  // Contador de "Guardados" para el bloque de stats del sidebar — es lo agregado en ESTA sesión
  // (no el total histórico de tu lista, que requeriría otra llamada al backend).
  public sessionSavedCount = 0;

  public creditsRemaining: number = 0;

  // Chip vivo (presentacional): pulso visual cuando cambia el numero de creditos
  creditsPulse = false;
  private _prevCreditsShown: number | null = null;
  private _pulseTimer: ReturnType<typeof setTimeout> | null = null;

  ngDoCheck(): void {
    if (
      this._prevCreditsShown !== null &&
      this.creditsRemaining !== this._prevCreditsShown
    ) {
      if (this._pulseTimer) {
        clearTimeout(this._pulseTimer);
      }
      this.creditsPulse = false;
      requestAnimationFrame(() => {
        this.creditsPulse = true;
      });
      this._pulseTimer = setTimeout(() => {
        this.creditsPulse = false;
      }, 900);
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
  public confirmState: {
    message: string;
    confirmLabel: string;
    askLists: boolean;
    onConfirm: (listIds?: number[]) => void;
  } | null = null;
  public availableLists: SavedListSummary[] = [];
  public confirmSelectedListIds = new Set<number>();
  public confirmNewListName = "";

  private async loadAvailableLists(): Promise<void> {
    const res = await this.savedListService.getMySavedLists();
    this.availableLists = res.error ? [] : res.lists;
  }

  public confirmListFilter = "";

  public get filteredAvailableLists(): SavedListSummary[] {
    const q = this.confirmListFilter.trim().toLowerCase();
    if (!q) return this.availableLists;
    return this.availableLists.filter((l) => l.name.toLowerCase().includes(q));
  }

  private openConfirm(
    message: string,
    confirmLabel: string,
    onConfirm: (listIds?: number[]) => void,
    askLists = true,
  ): void {
    this.confirmSelectedListIds.clear();
    this.confirmNewListName = "";
    this.confirmListFilter = "";
    this.confirmState = { message, confirmLabel, askLists, onConfirm };
  }

  public toggleConfirmList(listId: number): void {
    if (this.confirmSelectedListIds.has(listId))
      this.confirmSelectedListIds.delete(listId);
    else this.confirmSelectedListIds.add(listId);
  }

  public async runConfirmed(): Promise<void> {
    const action = this.confirmState?.onConfirm;
    const listIds = Array.from(this.confirmSelectedListIds);

    // Si el usuario escribió el nombre de una lista nueva, la creamos primero y la sumamos.
    const newName = this.confirmNewListName.trim();
    if (newName) {
      const res = await this.savedListService.createSavedList(newName);
      if (!res.error && res.list) {
        listIds.push(res.list.id);
      } else {
        this.notificationService.showError(
          res.message || "No se pudo crear la lista.",
        );
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

  // ─── Dashboard stats (barra superior de la vista inicial) ───
  public dashboardStats: CompanyDashboardStats = {
    leads: 0,
    searches: 0,
    phones: 0,
    emails: 0,
  };
  public statsLoading = true;

  public suggestedProspects: SuggestedProspect[] = [];
  private readonly avatarColors = ["#5b4fe5", "#ec4899", "#3b82f6", "#0ea968"];

  // ─── Globo punteado interactivo de fondo ───
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

  // ─── "Manchas" / destellos de ciudades sobre el globo (puramente decorativo) ───
  // Ciclan un resplandor entre las ciudades principales de Latinoamérica, sin representar
  // datos reales de leads (eso requeriría un endpoint dedicado que aún no existe).
  private readonly PIN_CITIES: [number, number][] = [
    [4.6, -74.1],
    [6.2, -75.6],
    [3.4, -76.5],
    [10.4, -75.5],
    [-12.0, -77.0],
    [-33.4, -70.6],
    [-34.6, -58.4],
    [-23.5, -46.6],
    [-22.9, -43.2],
    [19.4, -99.1],
    [20.7, -103.3],
    [25.7, -100.3],
    [-0.2, -78.5],
    [9.0, -79.5],
  ];
  private pins: number[][] = [];

  // Ruta al land-mask usado para dibujar el globo punteado.
  // Copia earth_landmask_720.png dentro de public/images/ (Angular sirve el contenido de
  // "public" directamente en la raíz, por eso NO se antepone "assets/" aquí).
  // Si prefieres usar src/assets/, cambia esto a 'assets/images/earth_landmask_720.png'.
  private readonly landmaskSrc = "images/earth_landmask_720.png";
  private readonly reducedMotion =
    typeof window !== "undefined" &&
    !!window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  private boundOnGlobePointerMove = (e: MouseEvent | TouchEvent) =>
    this.onGlobePointerMove(e);
  private boundOnGlobePointerUp = () => this.onGlobePointerUp();

  constructor(
    private translate: TranslateService,
    private industryTax: IndustryTaxonomyService,
    private companiesService: CompaniesService,
    private myListCompanyService: MyListCompanyService,
    private savedListService: SavedListService,
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService,
    private notificationService: NotificationService,
    private onboardingService: OnboardingService,
    private apiConfig: ApiConfigService,
    private ngZone: NgZone,
    private renderer: Renderer2,
    private exportService: ExportService,
  ) {
    document.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".dropdown-wrapper")) {
        this.closeAllDropdowns();
      }
    });
  }

  ngOnInit(): void {
    this.userProfileSubscription = this.authService.userProfile$.subscribe(
      (profile) => {
        if (profile && profile.companyProfile) {
          this.creditsRemaining = profile.companyProfile.creditsAllocated ?? 0;
        }
      },
    );

    this.loadDashboardStats();
    this.loadSuggestedProspects();
    this.loadAvailableLists();
    this.loadIndustryTaxonomy().then(() => this.onIndustryQueryChange());

    const companyIdParam = this.route.snapshot.queryParamMap.get("companyId");
    if (companyIdParam) {
      const companyId = Number(companyIdParam);
      if (Number.isFinite(companyId) && companyId > 0) {
        this.loadSingleCompanyFromDirectorio(companyId);
      }
    }
  }

  ngAfterViewInit(): void {
    this.initGlobe();
    this.portalFixedElementsToBody();
  }

  // La barra de selección y el modal de confirmación usan position:fixed pensado para
  // posicionarse contra la ventana del navegador — pero si CUALQUIER ancestro (nuestro o de
  // la app que envuelve este componente) tiene transform/filter/perspective/will-change/etc,
  // ese ancestro pasa a ser su "contenedor", y bottom:20px/top:50% dejan de calcularse contra
  // la pantalla. En vez de perseguir cuál ancestro es el culpable (puede estar fuera de
  // nuestros archivos), los movemos una sola vez a <body>, donde no hay ninguna duda posible.
  private portalFixedElementsToBody(): void {
    if (typeof document === "undefined") return;
    if (this.selectionBarPortalRef) {
      this.renderer.appendChild(
        document.body,
        this.selectionBarPortalRef.nativeElement,
      );
    }
    if (this.confirmModalPortalRef) {
      this.renderer.appendChild(
        document.body,
        this.confirmModalPortalRef.nativeElement,
      );
    }
  }

  ngOnDestroy(): void {
    this.stopSearchPolling();
    if (this.userProfileSubscription) {
      this.userProfileSubscription.unsubscribe();
    }
    this.destroyGlobe();
    this.selectionBarPortalRef?.nativeElement.remove();
    this.confirmModalPortalRef?.nativeElement.remove();
  }

  private async loadDashboardStats(): Promise<void> {
    this.statsLoading = true;
    try {
      const res = await this.companiesService.getCompanyDashboardStats();
      if (!res.error && res.stats) {
        this.dashboardStats = res.stats;
      }
    } finally {
      this.statsLoading = false;
    }
  }

  public suggestedRevealed = false;

  private async loadSuggestedProspects(): Promise<void> {
    // Llama al endpoint real. Hasta que agregues getSuggestedProspects en el controlador/service
    // de Axelor, esto simplemente devuelve un error controlado y la sección de "Personas
    // sugeridas" no se muestra (el *ngIf ya está condicionado a que el array tenga elementos).
    try {
      const res = await this.companiesService.getSuggestedProspects(3);
      this.suggestedProspects = res.error ? [] : res.prospects;
    } catch {
      this.suggestedProspects = [];
    }
    this.suggestedRevealed = false;
    setTimeout(() => {
      this.suggestedRevealed = true;
    }, 0);
  }

  public getInitials(name: string): string {
    return name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase();
  }

  public getAvatarColor(index: number): string {
    return this.avatarColors[index % this.avatarColors.length];
  }

  // Los sugeridos ahora vienen de AiSearchResults (empresas reales, ver
  // getSuggestedProspects en el backend) — así que el "id" corresponde a una company real.
  // Por eso abrimos el MISMO drawer que usan los resultados de búsqueda (openDetail), en vez
  // de un panel aparte: así "Acceder email"/"Celular" funcionan igual en los dos lugares.
  openSuggestedDetail(p: SuggestedProspect): void {
    const id = typeof p.id === "string" ? parseInt(p.id, 10) : p.id;
    const asCompany: Company = {
      id,
      title: p.name,
      categoryName: p.role || "",
      address: "",
      neighborhood: "",
      street: "",
      city: p.city,
      postalCode: "",
      state: "",
      countryCode: "",
      phoneUnformatted: "",
      permanentlyClosed: false,
      openingHours: "",
      website: "",
      additionalInfo: "",
      error: "",
      errorDescription: "",
      description: "",
      descriptionMd: "",
      email: undefined,
      // No sabemos si tiene email/teléfono en archivo (el endpoint de sugeridos no lo manda) —
      // dejamos undefined para que muestre el botón normal de "Acceder email"/"Celular" en vez
      // de "no disponible".
      hasEmailOnFile: undefined,
      hasPhoneOnFile: undefined,
    };
    this.openDetail(asCompany);
  }

  // ─── Pantalla inicial: se pone en blanco (solo header) cuando el chat ya empezó ───
  public chatActive = false;

  onChatStarted(): void {
    this.chatActive = true;
    // Se anota la última búsqueda existente para reconocer la nueva después.
    this.companiesService.getMySearchHistoryCompanies(0, 1, 'createdOn_desc')
      .then(h => { this.searchIdBeforeChat = h?.history?.[0]?.id ?? null; })
      .catch(() => { this.searchIdBeforeChat = null; });
  }

  // ─── Llamado por el chat cuando el agente tiene el query listo ───
  onSearchReady(result: SearchReadyResult): void {
    this.searchQuery = result.query;
    this.currentCategory = result.category;
    this.currentLocation = result.location;

    // El agente dijo que hay que buscar, pero a veces devuelve los tres campos
    // vacios. onSearch() trata eso como "no hay nada que buscar", llama a
    // resetSearchState() y la pantalla se vuelve a la portada — justo lo que se
    // veia: el chat desaparecia y volvia el titulo de inicio, sin resultados.
    //
    // Si el agente pidio buscar, se busca. Como ultimo recurso se usa el texto
    // que escribio el usuario, que siempre lo tenemos.
    const nothingToSearch =
      !this.searchQuery.trim() &&
      !this.currentCategory.trim() &&
      !this.currentLocation.trim();

    if (nothingToSearch) {
      this.searchQuery = (this.lastUserMessage || '').trim();
      if (!this.searchQuery) return;   // sin nada que buscar, no se resetea la pantalla
    }

    // Si la busqueda directa ya esta corriendo o ya trajo filas, no se repite.
    if (this.searchPollTimer || this.filteredResults.length > 0) return;

    this.onSearch();
  }

  /** Lo ultimo que escribio el usuario en el chat. */
  lastUserMessage = '';

  /**
   * El usuario escribio y le dio enter: se busca YA, sin esperar al agente.
   *
   * Antes el unico camino a los resultados pasaba por el agente de chat: el
   * agente tenia que llamar finalize_search para que la pantalla pintara algo.
   * Cuando el agente solo contesta "buscando eso ahora" —cosa que hace seguido—
   * la busqueda se ejecuta, se guarda con sus resultados, y la pantalla se
   * queda vacia para siempre. El usuario espera algo que nunca llega.
   *
   * Un buscador no puede depender de que un modelo se acuerde de llamar una
   * herramienta. Se busca directo con lo que el usuario escribio. El agente
   * sigue ahi para conversar y afinar, pero ya no es el que decide si ves algo.
   */
  onUserAsked(text: string): void {
    this.lastUserMessage = text;
    if (this.isLoading || this.searchPollTimer) return;   // ya hay una en curso
    this.searchQuery = text;
    this.currentCategory = '';
    this.currentLocation = '';
    this.onSearch();
  }

  async onSearch() {
    this.clearDirectorioParamsFromUrl();

    if (
      !this.searchQuery.trim() &&
      !this.currentCategory.trim() &&
      !this.currentLocation.trim()
    ) {
      this.resetSearchState();
      return;
    }

    this.searchError = null;
    this.showPlans = false;
    this.filteredResults = [];
    this.displayResults = [];
    this.currentPage = 1;
    this.currentOffset = 0;
    this.selectedCompanies = [];
    this.selectAllChecked = false;
    this.facetSourcePool.clear();

    this.isLoading = true;
    this.currentQuery = this.searchQuery;

    try {
      const response = await this.companiesService.runSearchCompanies(
        this.currentQuery,
        0,
        this.itemsPerPage,
        this.currentSortOrder,
        undefined,
        this.currentCategory,
        this.currentLocation,
      );

      this.processApiResponse(response);
    } catch (error) {
      console.error("Search error:", error);
      this.searchError = "Ocurrio un error inesperado al buscar.";
      this.isLoading = false;
    }
  }

  // ─── Flujo simplificado: solo se consulta nuestro endpoint. Si no hay resultados, se informa y no se dispara ningún proceso externo. ───
  private processApiResponse(response: CompanySearchResponse) {
    this.isLoading = false;
    this.searchError = null;
    this.showPlans = false;

    switch (response.status) {
      case "SUCCESS":
        this.updateStateFromData(response.data);
        this.onboardingService.completeOnboardingStepByKey("FIND_LEADS");
        break;

      // El scrape corre en el servidor y tarda; mientras tanto responde
      // SEARCH_IN_PROGRESS. Antes esto caía en la MISMA rama que "no
      // encontrado": se borraban los resultados y se tiraba el searchId, así
      // que la pantalla quedaba vacía para siempre aunque la búsqueda
      // terminara con 1.075 empresas. Sólo se veían entrando por Historial.
      case "SEARCH_IN_PROGRESS":
        this.searchStatus = "running";
        this.isLoading = true;
        this.currentSearchId = response.data?.searchId ?? this.currentSearchId;
        // Si el backend no devolvió el id, se toma el de la búsqueda más
        // reciente del historial: es la que acabamos de lanzar. Cuesta una
        // llamada de ~50 ms y sin ella no hay forma de leer el resultado.
        if (this.currentSearchId) {
          this.startSearchPolling();
        } else {
          this.resolveSearchIdThenPoll();
        }
        break;

      case "SEARCH_NOT_FOUND":
        this.filteredResults = [];
        this.displayResults = [];
        this.totalResultsInServer = 0;
        this.currentSearchId = null;
        this.currentOffset = 0;
        this.searchStatus = "";
        break;

      case "INSUFFICIENT_CREDITS":
        this.searchError =
          response.message || "No tienes creditos suficientes.";
        this.showPlans = true;
        break;

      case "UNAUTHORIZED":
      case "INVALID_INPUT":
      case "ERROR":
        this.searchError = response.message || "Ocurrio un error.";
        break;

      default:
        this.searchError = "Respuesta desconocida del servidor.";
        break;
    }
  }

  private updateStateFromData(data: CompanySearchResult | undefined) {
    if (!data) return;

    // REGLA DE NEGOCIO: el buscador principal NUNCA debe mostrar email/teléfono, sin importar
    // si el backend los trae en la respuesta. Solo se muestran cuando el usuario los solicita
    // explícitamente con "Acceder email"/"Celular" (revealEmail/revealPhone) en esta sesión.
    // Guardamos si el registro TIENE el dato (no el valor) para poder construir la faceta
    // "Estado de email" sin filtrar el dato real.
    this.filteredResults = (data.results ?? []).map((c) => ({
      ...c,
      hasEmailOnFile: !!c.email,
      hasPhoneOnFile: !!c.phoneUnformatted,
      email: undefined,
      phoneUnformatted: "",
    }));
    this.totalResultsInServer = data.resultsNumber || 0;
    this.currentSearchId = data.searchId || null;
    this.currentOffset = data.offset;
    this.currentSortOrder = data.sortBy || "title_asc";

    if (data.creditsRemaining !== undefined) {
      this.authService.updateCurrentUserCredits(data.creditsRemaining);
    }

    // Las facetas se construyen acumulando TODAS las páginas que el usuario ya visitó en esta
    // búsqueda (no solo la página actual de 25) — así "Ubicación"/"Industria" van creciendo a
    // medida que navega. Igual sigue siendo un subconjunto del total real hasta que el usuario
    // recorra todas las páginas; una faceta 100% completa requeriría un endpoint dedicado en
    // el backend que devuelva los valores únicos de toda la búsqueda.
    for (const company of this.filteredResults) {
      if (!this.facetSourcePool.has(company.id)) {
        this.facetSourcePool.set(company.id, company);
      }
    }

    this.buildFacets();
    this.applyLocalFilters();
  }

  private buildFacets(): void {
    const pool = Array.from(this.facetSourcePool.values());
    this.cityFacetOptions = this.countBy(pool, (c) => c.city);
    this.categoryFacetOptions = this.countBy(pool, (c) => c.categoryName);
    // Si el backend nunca manda hasEmailOnFile, todos quedan "undefined" y countBy los descarta
    // (valor vacío) — la faceta simplemente no aparece hasta que el backend la soporte.
    this.emailFacetOptions = this.countBy(pool, (c) =>
      c.hasEmailOnFile === undefined
        ? ""
        : c.hasEmailOnFile
          ? "Con email"
          : "Sin email",
    );
    this.recomputeFacetChips();
  }

  // Separa cada faceta en chips "seleccionados" (con ×) y chips "+ sugerencia" sin seleccionar.
  // Se llama solo tras cambios reales de datos o selección, nunca desde el template.
  private recomputeFacetChips(): void {
    this.cityFacetSelected = Array.from(this.selectedCityFacets);
    this.cityFacetGhost = this.cityFacetOptions
      .map((o) => o.value)
      .filter((v) => !this.selectedCityFacets.has(v));

    this.categoryFacetSelected = Array.from(this.selectedCategoryFacets);
    this.categoryFacetGhost = this.categoryFacetOptions
      .map((o) => o.value)
      .filter((v) => !this.selectedCategoryFacets.has(v));

    this.emailFacetSelected = Array.from(this.selectedEmailFacets);
    this.emailFacetGhost = this.emailFacetOptions
      .map((o) => o.value)
      .filter((v) => !this.selectedEmailFacets.has(v));
  }

  private countBy(
    items: Company[],
    pick: (c: Company) => string | undefined,
  ): FacetOption[] {
    const counts = new Map<string, number>();
    for (const item of items) {
      const value = (pick(item) || "").trim();
      if (!value) continue;
      counts.set(value, (counts.get(value) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);
  }

  private resetSearchState(keepQueryText = false) {
    this.clearDirectorioParamsFromUrl();

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
    this.selectedCompanies = [];
    this.currentSearchId = null;
    this.totalResultsInServer = 0;
    this.currentOffset = 0;
    this.searchStatus = "";
    this.searchError = null;
    this.showPlans = false;
    this.isLoading = false;
    this.cityFacetOptions = [];
    this.categoryFacetOptions = [];
    this.emailFacetOptions = [];
    this.selectedCityFacets.clear();
    this.selectedCategoryFacets.clear();
    this.selectedEmailFacets.clear();
    this.cityFacetSelected = [];
    this.cityFacetGhost = [];
    this.categoryFacetSelected = [];
    this.categoryFacetGhost = [];
    this.emailFacetSelected = [];
    this.emailFacetGhost = [];
    this.facetSourcePool.clear();
    this.sessionSavedCount = 0;
    this.revealingEmailIds.clear();
    this.revealingPhoneIds.clear();
    this.detailCompany = null;
    this.detailHours = [];
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
    if (
      page < 1 ||
      (!this.currentQuery && !this.currentCategory && !this.currentLocation) ||
      this.isLoading
    )
      return;

    const newOffset = (page - 1) * this.itemsPerPage;
    if (newOffset >= this.totalResultsInServer && this.totalResultsInServer > 0)
      return;

    this.isLoading = true;
    this.currentPage = page;
    this.currentOffset = newOffset;

    try {
      const response = await this.companiesService.runSearchCompanies(
        this.currentQuery,
        newOffset,
        this.itemsPerPage,
        this.currentSortOrder,
        this.currentSearchId ?? undefined,
        this.currentCategory,
        this.currentLocation,
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
    return this.selectedCompanies.length > 0;
  }

  changeView(view: "grid" | "card" | "default") {
    this.currentView = view;
    switch (view) {
      case "grid":
        this.currentViewText = "Grid view";
        break;
      case "card":
        this.currentViewText = "Card view";
        break;
      case "default":
        this.currentViewText = "Default view";
        break;
    }
  }

  toggleSelectAll() {
    this.selectAllChecked = !this.selectAllChecked;
    this.selectedCompanies = this.selectAllChecked
      ? this.displayResults.map((c) => c.id)
      : [];
  }

  toggleCompanySelection(companyId: number) {
    const index = this.selectedCompanies.indexOf(companyId);
    if (index > -1) {
      this.selectedCompanies.splice(index, 1);
    } else {
      this.selectedCompanies.push(companyId);
    }
    this.selectAllChecked =
      this.displayResults.length > 0 &&
      this.selectedCompanies.length === this.displayResults.length;
  }

  addToMyList(): void {
    const creditsNeeded = this.selectedCompanies.length;
    if (creditsNeeded === 0) {
      this.notificationService.showError("No hay empresas seleccionadas");
      return;
    }
    if (this.creditsRemaining < creditsNeeded) {
      this.notificationService.showError(
        `No tienes creditos suficientes. Necesitas ${creditsNeeded} y tienes ${this.creditsRemaining}.`,
      );
      return;
    }
    this.openConfirm(
      `¿Añadir ${creditsNeeded} ${creditsNeeded === 1 ? "empresa" : "empresas"} a tu lista? Esto usará ${creditsNeeded} crédito${creditsNeeded === 1 ? "" : "s"}.`,
      "Añadir",
      (listIds) => this.doAddToMyList(listIds),
    );
  }

  private async doAddToMyList(listIds?: number[]): Promise<void> {
    this.isSaving = true;
    try {
      const result = await this.myListCompanyService.saveCompanyResults(
        this.selectedCompanies,
        listIds,
      );
      if (result.error) {
        this.notificationService.showError(
          result.message || "Error al guardar las empresas",
        );
      } else {
        if (result.creditsRemaining !== undefined) {
          this.authService.updateCurrentUserCredits(result.creditsRemaining);
        }
        this.notificationService.showSuccess(
          `${result.saved} empresas anadidas a tu lista.`,
        );
        this.sessionSavedCount += result.saved || 0;
        this.selectedCompanies = [];
        this.selectAllChecked = false;
        this.onboardingService.completeOnboardingStepByKey("SAVE_LEAD");
      }
    } catch (error) {
      this.notificationService.showError(
        "Error de conexion al guardar las empresas.",
      );
    } finally {
      this.isSaving = false;
    }
  }

  // Acción "+" de una sola fila en la tabla — pide confirmación (con listas opcionales) antes de ejecutar.
  quickAddToList(company: Company): void {
    this.openConfirm(
      `¿Añadir "${company.title}" a tu lista? Esto usará 1 crédito.`,
      "Añadir",
      (listIds) => this.doQuickAddToList(company, listIds),
    );
  }

  private async doQuickAddToList(
    company: Company,
    listIds?: number[],
  ): Promise<void> {
    if (this.savingSingleId !== null) return;
    if (this.creditsRemaining < 1) {
      this.notificationService.showError("No tienes créditos suficientes.");
      return;
    }
    this.savingSingleId = company.id;
    try {
      const result = await this.myListCompanyService.saveCompanyResults(
        [company.id],
        listIds,
      );
      if (result.error) {
        this.notificationService.showError(
          result.message || "Error al guardar la empresa",
        );
      } else {
        if (result.creditsRemaining !== undefined) {
          this.authService.updateCurrentUserCredits(result.creditsRemaining);
        }
        this.notificationService.showSuccess(
          `${company.title} añadida a tu lista.`,
        );
        this.sessionSavedCount++;
        this.onboardingService.completeOnboardingStepByKey("SAVE_LEAD");
      }
    } catch (error) {
      this.notificationService.showError(
        "Error de conexión al guardar la empresa.",
      );
    } finally {
      this.savingSingleId = null;
    }
  }

  // "Agregar Todos" — pide confirmación (con listas opcionales) antes de ejecutar.
  addAllToMyList(): void {
    if (!this.currentSearchId || this.totalResultsInServer === 0) {
      this.notificationService.showError(
        "No hay una busqueda activa o la busqueda no arrojo resultados.",
      );
      return;
    }
    this.openConfirm(
      `¿Añadir los ${this.totalResultsInServer} resultados de esta búsqueda a tu lista? Esto usará ${this.totalResultsInServer} créditos.`,
      "Añadir todos",
      (listIds) => this.doAddAllToMyList(listIds),
    );
  }

  private async doAddAllToMyList(listIds?: number[]) {
    if (!this.currentSearchId || this.totalResultsInServer === 0) return;
    const creditsNeeded = this.totalResultsInServer;
    if (this.creditsRemaining < creditsNeeded) {
      this.notificationService.showError(
        `No tienes creditos suficientes. Necesitas ${creditsNeeded} y tienes ${this.creditsRemaining}.`,
      );
      return;
    }
    this.isSavingAll = true;
    try {
      const result = await this.myListCompanyService.saveAllCompanyResults(
        this.currentSearchId,
        listIds,
      );
      if (
        result &&
        result.error === false &&
        typeof result.saved === "number"
      ) {
        if (result.creditsRemaining !== undefined) {
          this.authService.updateCurrentUserCredits(result.creditsRemaining);
        }
        this.notificationService.showSuccess(
          `${result.saved} nuevas empresas anadidas a tu lista.`,
        );
        this.sessionSavedCount += result.saved;
        this.selectedCompanies = [];
        this.selectAllChecked = false;
      } else {
        const errorMessage =
          result?.message ||
          "Ocurrio un error en el servidor. Por favor, intentalo de nuevo.";
        this.notificationService.showError(errorMessage);
      }
    } catch (error) {
      this.notificationService.showError(
        "Error de conexion al guardar todas las empresas.",
      );
    } finally {
      this.isSavingAll = false;
    }
  }

  downloadSelected() {
    this.notificationService.showError(
      `Downloading ${this.selectedCompanies.length} selected companies`,
    );
  }
  viewSelected() {
    this.notificationService.showError(
      `Viewing ${this.selectedCompanies.length} selected companies`,
    );
  }
  closeSelectionBar() {
    this.selectedCompanies = [];
    this.selectAllChecked = false;
  }

  // Exporta los resultados visibles (después de filtros). Igual que my-list-company.component.ts:
  // exporta exactamente los valores que hay en memoria — por eso email/phoneUnformatted salen
  // vacíos salvo que el usuario ya los haya revelado en esta sesión, sin ningún caso especial.
  exportToCsv(): void {
    if (this.displayResults.length === 0) {
      this.notificationService.showError("No hay resultados para exportar.");
      return;
    }
    const dataToExport = this.displayResults.map(
      ({
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
        email,
        openingHours,
        permanentlyClosed,
        website,
        description,
        descriptionMd,
        error,
        errorDescription,
        neighborhood,
        additionalInfo,
      }) => ({
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
        email,
        openingHours,
        permanentlyClosed,
        website,
        description,
        descriptionMd,
        error,
        errorDescription,
        neighborhood,
        additionalInfo,
      }),
    );
    this.exportService.exportToCsv(dataToExport, "companies-search");
  }

  // ─── Panel de detalle (drawer lateral derecho) ───
  public detailCompany: Company | null = null;
  public detailHours: { day: string; hours: string }[] = [];

  private readonly DAY_LABELS: Record<string, string> = {
    Monday: "Lunes",
    Tuesday: "Martes",
    Wednesday: "Miércoles",
    Thursday: "Jueves",
    Friday: "Viernes",
    Saturday: "Sábado",
    Sunday: "Domingo",
  };

  // El campo openingHours llega como JSON crudo, ej:
  // [{"day":"Monday","hours":"9:00 AM - 5:00 PM"}, ...] — lo parseamos una sola vez al abrir
  // el panel (no en el template) para no recalcularlo en cada ciclo de change detection.
  private parseOpeningHours(
    raw: string | undefined | null,
  ): { day: string; hours: string }[] {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((item: any) => item && item.day)
        .map((item: any) => ({
          day: this.DAY_LABELS[item.day] || item.day,
          hours: item.hours === "Closed" ? "Cerrado" : item.hours || "—",
        }));
    } catch {
      return [];
    }
  }

  openDetail(company: Company): void {
    this.detailCompany = company;
    this.detailHours = this.parseOpeningHours(company.openingHours);
  }

  closeDetail(): void {
    this.detailCompany = null;
    this.detailHours = [];
  }

  // ─── Revelar email/teléfono por fila (1 crédito por acción) ───
  isRevealingEmail(id: number): boolean {
    return this.revealingEmailIds.has(id);
  }
  isRevealingPhone(id: number): boolean {
    return this.revealingPhoneIds.has(id);
  }

  async revealEmail(company: Company): Promise<void> {
    if (company.email || this.revealingEmailIds.has(company.id)) return;
    if (this.creditsRemaining < 1) {
      this.notificationService.showError("No tienes créditos suficientes.");
      return;
    }
    this.revealingEmailIds.add(company.id);
    try {
      const res = await this.companiesService.revealCompanyEmail(company.id);
      if (res.error || !res.value) {
        this.notificationService.showError(
          res.message || "No se pudo obtener el email.",
        );
      } else {
        company.email = res.value;
        if (res.creditsRemaining !== undefined) {
          this.authService.updateCurrentUserCredits(res.creditsRemaining);
        }
      }
    } finally {
      this.revealingEmailIds.delete(company.id);
    }
  }

  async revealPhone(company: Company): Promise<void> {
    if (company.phoneUnformatted || this.revealingPhoneIds.has(company.id))
      return;
    if (this.creditsRemaining < 1) {
      this.notificationService.showError("No tienes créditos suficientes.");
      return;
    }
    this.revealingPhoneIds.add(company.id);
    try {
      const res = await this.companiesService.revealCompanyPhone(company.id);
      if (res.error || !res.value) {
        this.notificationService.showError(
          res.message || "No se pudo obtener el teléfono.",
        );
      } else {
        company.phoneUnformatted = res.value;
        if (res.creditsRemaining !== undefined) {
          this.authService.updateCurrentUserCredits(res.creditsRemaining);
        }
      }
    } finally {
      this.revealingPhoneIds.delete(company.id);
    }
  }

  get totalPages(): number {
    return Math.ceil(this.totalResultsInServer / this.itemsPerPage);
  }
  getStartIndex(): number {
    return this.displayResults.length > 0
      ? (this.currentPage - 1) * this.itemsPerPage + 1
      : 0;
  }
  getEndIndex(): number {
    return Math.min(
      this.currentPage * this.itemsPerPage,
      this.totalResultsInServer,
    );
  }
  getFormattedTotal(): string {
    return this.totalResultsInServer.toLocaleString();
  }

  toggleDropdown(dropdownName: string) {
    this.showViewDropdown =
      dropdownName === "view" ? !this.showViewDropdown : false;
    this.showSortDropdown =
      dropdownName === "sort" ? !this.showSortDropdown : false;
  }

  closeAllDropdowns() {
    this.showViewDropdown = false;
    this.showSortDropdown = false;
  }

  goToUpgradePlan(): void {
    this.router.navigate(["/upgrade-plan"]);
  }

  public rowsRevealed = false;

  public applyLocalFilters(): void {
    let results = [...this.filteredResults];

    // Industria: se filtra por grupo, que es el nivel que existe en todos los
    // países. Brasil —el 92% de la base— casi nunca trae categoría específica.
    if (this.selectedIndustryGroups.size > 0) {
      results = results.filter((c) => {
        const g = this.groupOfCompany(c);
        return !!g && this.selectedIndustryGroups.has(g);
      });
    }

    if (this.localFilters.title)
      results = results.filter((c) =>
        c.title?.toLowerCase().includes(this.localFilters.title.toLowerCase()),
      );
    if (this.localFilters.categoryName)
      results = results.filter((c) =>
        c.categoryName
          ?.toLowerCase()
          .includes(this.localFilters.categoryName.toLowerCase()),
      );
    if (this.localFilters.city)
      results = results.filter((c) =>
        c.city?.toLowerCase().includes(this.localFilters.city.toLowerCase()),
      );
    if (this.localFilters.state)
      results = results.filter((c) =>
        c.state?.toLowerCase().includes(this.localFilters.state.toLowerCase()),
      );
    if (this.localFilters.countryCode)
      results = results.filter((c) =>
        c.countryCode
          ?.toLowerCase()
          .includes(this.localFilters.countryCode.toLowerCase()),
      );
    if (this.selectedCityFacets.size > 0)
      results = results.filter((c) => this.selectedCityFacets.has(c.city));
    if (this.selectedCategoryFacets.size > 0)
      results = results.filter((c) =>
        this.selectedCategoryFacets.has(c.categoryName),
      );
    if (this.selectedEmailFacets.size > 0) {
      results = results.filter((c) => {
        const label =
          c.hasEmailOnFile === undefined
            ? ""
            : c.hasEmailOnFile
              ? "Con email"
              : "Sin email";
        return this.selectedEmailFacets.has(label);
      });
    }
    this.displayResults = results;

    // El efecto de aparición (rowin) solo se dispara de forma confiable si la clase que trae
    // la animación se agrega DESPUÉS de que las filas ya se pintaron una vez — si la clase ya
    // viene puesta desde el primer render, Angular a veces no la hace reproducir. Por eso
    // arrancamos en "invisible" (ver CSS .rowin) y activamos .play en el siguiente tick.
    this.rowsRevealed = false;
    setTimeout(() => {
      this.rowsRevealed = true;
    }, 0);
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

  public toggleCityFacet(value: string): void {
    if (this.selectedCityFacets.has(value))
      this.selectedCityFacets.delete(value);
    else this.selectedCityFacets.add(value);
    this.onFilterChange();
  }

  public toggleCategoryFacet(value: string): void {
    if (this.selectedCategoryFacets.has(value))
      this.selectedCategoryFacets.delete(value);
    else this.selectedCategoryFacets.add(value);
    this.onFilterChange();
  }

  public toggleEmailFacet(value: string): void {
    if (this.selectedEmailFacets.has(value))
      this.selectedEmailFacets.delete(value);
    else this.selectedEmailFacets.add(value);
    this.onFilterChange();
  }

  // Total de filtros activos — alimenta el badge numérico junto a "Ocultar/Mostrar filtros".
  public get activeFilterCount(): number {
    let n =
      this.selectedCityFacets.size +
      this.selectedCategoryFacets.size +
      this.selectedEmailFacets.size;
    if (this.localFilters.title) n++;
    if (this.localFilters.categoryName) n++;
    n += this.selectedIndustryGroups.size;
    if (this.localFilters.city) n++;
    if (this.localFilters.state) n++;
    if (this.localFilters.countryCode) n++;
    return n;
  }

  public get hasActiveFilters(): boolean {
    return this.activeFilterCount > 0;
  }

  public clearAllFilters(): void {
    this.selectedCityFacets.clear();
    this.selectedCategoryFacets.clear();
    this.selectedEmailFacets.clear();
    this.selectedIndustryGroups.clear();
    this.industryQuery = '';
    this.onIndustryQueryChange();
    this.localFilters = {
      title: "",
      categoryName: "",
      city: "",
      state: "",
      countryCode: "",
    };
    this.currentPage = 1;
    this.recomputeFacetChips();
    this.applyLocalFilters();
  }

  public onSortChange(sortBy: string): void {
    this.currentSortOrder = sortBy;
    this.goToPage(1);
    this.closeAllDropdowns();
  }

  // ════════════════════════════════════════════════════════════════
  //  Globo punteado interactivo (fondo decorativo de la vista inicial)
  // ════════════════════════════════════════════════════════════════

  @HostListener("window:resize")
  onWindowResize(): void {
    this.resizeGlobe();
  }

  private initGlobe(): void {
    const canvas = this.globeCanvasRef?.nativeElement;
    if (!canvas || this.globeInited) return;
    this.globeInited = true;

    this.globeCtx = canvas.getContext("2d");
    this.pins = this.PIN_CITIES.map(([lat, lon]) => this.llToVec(lat, lon));
    this.resizeGlobe();
    this.loadLandmask();

    // Todo lo relacionado al globo (listeners de arrastre + loop de animación) corre FUERA de
    // la zona de Angular: requestAnimationFrame está parcheado por zone.js, así que sin esto
    // cada frame dispararía un ciclo completo de change detection de toda la app y termina
    // congelando el navegador.
    this.ngZone.runOutsideAngular(() => {
      canvas.addEventListener("mousedown", (e) => this.onGlobePointerDown(e));
      canvas.addEventListener("touchstart", (e) => this.onGlobePointerDown(e), {
        passive: true,
      });
      window.addEventListener("mousemove", this.boundOnGlobePointerMove);
      window.addEventListener("touchmove", this.boundOnGlobePointerMove, {
        passive: false,
      });
      window.addEventListener("mouseup", this.boundOnGlobePointerUp);
      window.addEventListener("touchend", this.boundOnGlobePointerUp);
    });
  }

  private destroyGlobe(): void {
    if (this.globeRafId !== null) {
      cancelAnimationFrame(this.globeRafId);
      this.globeRafId = null;
    }
    window.removeEventListener("mousemove", this.boundOnGlobePointerMove);
    window.removeEventListener("touchmove", this.boundOnGlobePointerMove);
    window.removeEventListener("mouseup", this.boundOnGlobePointerUp);
    window.removeEventListener("touchend", this.boundOnGlobePointerUp);
  }

  private loadLandmask(): void {
    const img = new Image();
    img.onload = () => {
      try {
        const off = document.createElement("canvas");
        off.width = img.width;
        off.height = img.height;
        const octx = off.getContext("2d");
        if (!octx) throw new Error("no ctx");
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
      console.warn(
        `No se pudo cargar el land-mask del globo en "${this.landmaskSrc}". Verifica que earth_landmask_720.png esté copiado en esa ruta pública.`,
      );
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
    const px = Math.min(
      this.landW - 1,
      Math.max(0, Math.floor(u * this.landW)),
    );
    const py = Math.min(
      this.landH - 1,
      Math.max(0, Math.floor(v * this.landH)),
    );
    const i = (py * this.landW + px) * 4;
    return this.landData[i] + this.landData[i + 1] + this.landData[i + 2] < 250;
  }

  private buildGlobeDots(): void {
    this.globeDots = [];
    if (!this.landData && !this.maskFailed) return;
    for (let latD = -82; latD <= 84; latD += 2.0) {
      const lat = (latD * Math.PI) / 180;
      const n = Math.max(12, Math.round(Math.cos(lat) * 210));
      for (let i = 0; i < n; i++) {
        const lonD = -180 + (i / n) * 360;
        if (this.landData && !this.isLand(latD, lonD)) continue;
        const lon = (lonD * Math.PI) / 180;
        this.globeDots.push([
          Math.cos(lat) * Math.cos(lon),
          Math.sin(lat),
          -Math.cos(lat) * Math.sin(lon),
        ]);
      }
    }
  }

  private llToVec(latD: number, lonD: number): number[] {
    const lat = (latD * Math.PI) / 180;
    const lon = (lonD * Math.PI) / 180;
    return [
      Math.cos(lat) * Math.cos(lon),
      Math.sin(lat),
      -Math.cos(lat) * Math.sin(lon),
    ];
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
      this.globeCx - this.globeR * 0.35,
      this.globeCy - this.globeR * 0.4,
      this.globeR * 0.05,
      this.globeCx,
      this.globeCy,
      this.globeR * 1.02,
    );
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.82, "rgba(91,79,229,0.03)");
    g.addColorStop(1, "rgba(91,79,229,0.08)");
    this.globeGradient = g;
  }

  private project(v: number[]): { x: number; y: number; depth: number } {
    const [x, y, z] = v;
    const x1 = x * Math.cos(this.rotY) + z * Math.sin(this.rotY);
    const z1 = -x * Math.sin(this.rotY) + z * Math.cos(this.rotY);
    const y1 = y;
    const y2 = y1 * Math.cos(this.rotX) - z1 * Math.sin(this.rotX);
    const z2 = y1 * Math.sin(this.rotX) + z1 * Math.cos(this.rotX);
    return {
      x: this.globeCx + x1 * this.globeR,
      y: this.globeCy - y2 * this.globeR,
      depth: z2,
    };
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
    // completo — antes esta rama seguía reprogramando requestAnimationFrame para siempre, lo
    // que forzaba un reflow del layout (canvas.offsetParent) 60 veces por segundo en segundo
    // plano de forma indefinida y era la causa real del congelamiento. resizeGlobe() se encarga
    // de reactivar el loop (startGlobeLoop) cuando el usuario vuelve a la vista inicial.
    if (canvas.offsetParent === null) {
      this.globeActive = false;
      this.globeRafId = null;
      return;
    }

    if (!this.globeW && canvas.clientWidth) this.resizeGlobe();

    // Sin auto-rotación: el globo solo gira mientras el usuario arrastra, y luego frena por
    // fricción hasta detenerse (no gira solo, igual que en el diseño de referencia).
    if (!this.dragging && Math.abs(this.velY) > this.velEpsilon) {
      this.rotY += this.velY;
      this.velY *= this.friction;
    } else if (!this.dragging) {
      this.velY = 0;
    }

    this.renderGlobeFrame();

    const stillAnimating =
      this.dragging || Math.abs(this.velY) > this.velEpsilon;
    if (stillAnimating) {
      this.globeRafId = requestAnimationFrame(() => this.globeFrame());
    } else {
      // Idle: dejamos de pedir frames hasta el próximo drag o resize.
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

  // "Manchas" estáticas sobre las ciudades principales: puramente decorativo, sin animación
  // cíclica (para no depender de ningún timer corriendo de fondo). Representa presencia en el
  // mapa, no un conteo real de leads — eso requeriría un endpoint dedicado.
  private drawPins(): void {
    const ctx = this.globeCtx;
    if (!ctx) return;

    for (const pin of this.pins) {
      const p = this.project(pin);
      if (p.depth < 0.04) continue;

      const baseR = 2.6;
      const glowR = baseR * 5;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR);
      g.addColorStop(0, "rgba(91,79,229,0.35)");
      g.addColorStop(0.5, "rgba(91,79,229,0.10)");
      g.addColorStop(1, "rgba(91,79,229,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(91,79,229,0.9)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, baseR, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private onGlobePointerDown(e: MouseEvent | TouchEvent): void {
    this.dragging = true;
    this.velY = 0;
    this.globeCanvasRef?.nativeElement.classList.add("drag");
    const t = "touches" in e ? e.touches[0] : e;
    this.lastX = t.clientX;
    this.lastY = t.clientY;
    this.startGlobeLoop();
  }

  private onGlobePointerMove(e: MouseEvent | TouchEvent): void {
    if (!this.dragging) return;
    const t = "touches" in e ? e.touches[0] : e;
    const dx = t.clientX - this.lastX;
    const dy = t.clientY - this.lastY;
    this.lastX = t.clientX;
    this.lastY = t.clientY;
    this.rotY += dx * 0.006;
    this.rotX = Math.max(-1.2, Math.min(1.2, this.rotX + dy * 0.006));
    this.velY = dx * 0.006;
    if ("touches" in e && e.cancelable) e.preventDefault();
  }

  private onGlobePointerUp(): void {
    this.dragging = false;
    if (this.reducedMotion) {
      this.velY = 0;
    }
    this.globeCanvasRef?.nativeElement.classList.remove("drag");
  }

  private async loadSingleCompanyFromDirectorio(
    companyId: number,
  ): Promise<void> {
    this.isLoading = true;
    this.searchError = null;
    this.showPlans = false;

    const result = await this.companiesService.getCompanyResultById(companyId);

    this.isLoading = false;

    if (result.error || !result.company) {
      this.currentQuery = `Empresa #${companyId}`;
      this.filteredResults = [];
      this.searchError =
        result.message || "No se encontro la empresa solicitada.";
      return;
    }

    this.currentQuery = result.company.title || `Empresa #${companyId}`;
    this.currentCategory = "";
    this.currentLocation = "";
    this.currentSearchId = null;

    this.updateStateFromData({
      notFound: false,
      searchString: this.currentQuery,
      results: [result.company],
      searchId: undefined,
      statusSelect: 2,
      resultsNumber: 1,
      offset: 0,
      limit: 1,
      fetched: 1,
      sortBy: this.currentSortOrder,
    });

    this.onboardingService.completeOnboardingStepByKey("FIND_LEADS");
  }

  private clearDirectorioParamsFromUrl(): void {
    if (
      this.route.snapshot.queryParamMap.has("companyId") ||
      this.route.snapshot.queryParamMap.has("directorio")
    ) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {},
        replaceUrl: true,
      });
    }
  }

  // ── Filtro de industria ──────────────────────────────────────────────────

  /** Carga la taxonomía y el mapa de sectores. Si falla, el filtro no aparece. */
  private async loadIndustryTaxonomy(): Promise<void> {
    try {
      this.industrySections = await this.industryTax.sections(this.translate.currentLang || 'es');
      const res = await fetch('data/sector-map.json');
      if (res.ok) this.sectorToGroup = (await res.json()).sectorToGroup ?? {};
    } catch {
      this.industrySections = [];
    }
  }

  toggleIndustryPanel(): void { this.industryOpen = !this.industryOpen; }

  toggleIndustryGroup(key: string): void {
    this.selectedIndustryGroups.has(key)
      ? this.selectedIndustryGroups.delete(key)
      : this.selectedIndustryGroups.add(key);
    this.applyLocalFilters();
  }

  isIndustryGroupOn(key: string): boolean {
    return this.selectedIndustryGroups.has(key);
  }

  /**
   * Los grupos que coinciden con lo escrito en el buscador del filtro. Se
   * calcula bajo demanda y se guarda en un campo, nunca desde la plantilla:
   * un getter en *ngFor devuelve un array nuevo en cada ciclo de change
   * detection y eso congela la pestaña.
   */
  public visibleIndustrySections: IndustrySection[] = [];

  onIndustryQueryChange(): void {
    const q = this.industryQuery.trim().toLowerCase();
    if (!q) { this.visibleIndustrySections = this.industrySections; return; }
    this.visibleIndustrySections = this.industrySections
      .map(sec => ({
        ...sec,
        industries: sec.industries.filter(i => i.label.toLowerCase().includes(q)),
      }))
      .filter(sec => sec.label.toLowerCase().includes(q) || sec.industries.length > 0);
  }

  /**
   * A qué grupo pertenece una empresa.
   *
   * El 91% de las filas trae sólo la clave gruesa del sector (RETAIL, MANUF…),
   * sobre todo en Brasil, donde el 98,7% no tiene categoría específica. Para
   * esas usamos el mapa de sectores. Para el resto —Colombia, Guatemala, US,
   * México, que sí traen categoría propia— se compara contra las etiquetas de
   * la taxonomía.
   */
  private groupOfCompany(c: Company): string | null {
    const raw = (c.categoryName || '').trim();
    if (!raw) return null;

    const bySector = this.sectorToGroup[raw.toUpperCase()];
    if (bySector) return bySector;

    const needle = raw.toLowerCase();
    for (const sec of this.industrySections) {
      if (sec.industries.some(i => needle.includes(i.label.toLowerCase()))) return sec.key;
    }
    return null;
  }

  /** Filtros bloqueados: se avisa y no se hace nada más. */
  onLockedFilter(): void {
    this.notificationService.showInfo(this.translate.instant('SEARCH.LOCKED_HINT'));
  }

  // ── Sondeo de la búsqueda ────────────────────────────────────────────────

  private searchPollTimer: ReturnType<typeof setInterval> | null = null;
  private searchPollDeadline = 0;

  /**
   * Espera a que la búsqueda termine leyendo el endpoint BARATO.
   *
   * Aquí estaba el error de fondo. Volver a llamar a runSearchCompanies para
   * "ver si ya terminó" NO consulta el resultado: relanza el scrape. Cada
   * consulta tardaba 36 segundos y cobraba créditos otra vez.
   *
   * getMySearchHistoryCompanyDetails devuelve exactamente las mismas filas en
   * ~140 ms, porque sólo lee lo que el scrape ya guardó. Es el mismo endpoint
   * que usa la pantalla de Historial, que siempre fue rápida.
   *
   * Además pinta lo que ya haya llegado mientras el scrape sigue: los
   * resultados aparecen de a poco en vez de esperar al final.
   */
  private startSearchPolling(): void {
    this.stopSearchPolling();
    this.searchPollDeadline = Date.now() + 5 * 60 * 1000;

    const tick = async () => {
      if (!this.currentSearchId) { this.stopSearchPolling(); return; }
      if (Date.now() > this.searchPollDeadline) {
        this.stopSearchPolling();
        this.isLoading = false;
        this.searchError = this.translate.instant('SEARCH.STILL_RUNNING');
        return;
      }
      try {
        const res = await this.companiesService.getMySearchHistoryCompanyDetails(
          this.currentSearchId,
          this.currentOffset,
          this.itemsPerPage,
          this.currentSortOrder,
        );
        if (res?.error) return;

        // Se pinta lo que haya, aunque el scrape siga corriendo.
        if (res?.results?.length) {
          this.isLoading = false;
          this.updateStateFromData(res);
        }

        // statusSelect === 1 significa "todavía corriendo".
        if (res?.statusSelect !== 1) {
          this.stopSearchPolling();
          this.isLoading = false;
          this.searchStatus = '';
          if (res?.results?.length) {
            this.onboardingService.completeOnboardingStepByKey('FIND_LEADS');
          }
        }
      } catch {
        // Un fallo suelto no corta el sondeo; se reintenta al siguiente ciclo.
      }
    };

    tick();                                   // primera lectura inmediata
    this.searchPollTimer = setInterval(tick, 2000);
  }

  private stopSearchPolling(): void {
    if (this.searchPollTimer) {
      clearInterval(this.searchPollTimer);
      this.searchPollTimer = null;
    }
  }

  /** Recupera el id de la búsqueda recién lanzada y arranca el sondeo. */
  private async resolveSearchIdThenPoll(): Promise<void> {
    try {
      const hist = await this.companiesService.getMySearchHistoryCompanies(0, 1, 'createdOn_desc');
      const newest = hist?.history?.[0];
      if (newest?.id) {
        this.currentSearchId = newest.id;
        this.startSearchPolling();
        return;
      }
    } catch { /* cae al aviso de abajo */ }
    this.isLoading = false;
    this.searchError = this.translate.instant('SEARCH.STILL_RUNNING');
  }

  /**
   * Red de seguridad cuando el agente contesta sin pintar resultados.
   *
   * El agente debe llamar finalize_search, que es lo único que enciende
   * searchReady y hace que la pantalla muestre algo. Su propio prompt se lo
   * exige y le prohíbe contestar "buscando eso ahora". Lo hace igual: se queda
   * en el texto, la búsqueda queda creada en el servidor con sus resultados, y
   * la pantalla se queda vacía para siempre.
   *
   * Aquí miramos si apareció una búsqueda nueva desde que empezó la
   * conversación. Si la hay, la pintamos nosotros con el endpoint barato
   * (~140 ms) sin volver a cobrar créditos. La pantalla deja de depender de que
   * el modelo se acuerde de llamar a la herramienta.
   */
  private searchIdBeforeChat: number | null = null;

  async onAgentRepliedWithoutResults(): Promise<void> {
    try {
      const hist = await this.companiesService.getMySearchHistoryCompanies(0, 1, 'createdOn_desc');
      const newest = hist?.history?.[0];
      if (!newest?.id) return;
      // Sólo si es una búsqueda NUEVA: si no, estaríamos pintando una vieja.
      if (this.searchIdBeforeChat !== null && newest.id === this.searchIdBeforeChat) return;

      this.currentSearchId = newest.id;
      this.currentQuery = newest.searchString || this.currentQuery;
      this.isLoading = true;
      this.startSearchPolling();
    } catch { /* sin red de seguridad, se comporta como antes */ }
  }
}
