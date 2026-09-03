import { Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MyListCompanyService } from '../../services/my-list-company.service';
import { SavedListService, SavedListSummary } from '../../services/saved-list.service';
import { NotificationService } from '../../services/notification.service';
import { ContactActivityService, ContactTouch } from '../../services/contact-activity.service';

/** Un día del horario, ya legible. */
export interface OpeningDay {
  day: string;
  hours: string;
  closed: boolean;
  today: boolean;
}

@Component({
  selector: 'app-company-details',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule],
  templateUrl: './company-details.component.html',
  styleUrl: './company-details.component.css'
})
export class CompanyDetailsComponent implements OnInit {
  company: any = null;
  isLoading = false;
  companyId: number = 0;

  /** Horario ya interpretado; vacío si no vino o no se pudo leer. */
  openingDays: OpeningDay[] = [];

  /** "Información adicional" ya legible: grupo → cosas que sí tiene. */
  extras: { group: string; items: string[] }[] = [];

  /** Llamadas que ya le hicimos. Vacío = nunca la contactamos. */
  touches: ContactTouch[] = [];
  recentTouches: ContactTouch[] = [];
  loadingTouches = false;

  expanded = false;

  /** Elegir lista al vuelo, sin salir de la ficha. */
  showListPicker = false;
  loadingLists = false;
  savingToList = false;
  lists: SavedListSummary[] = [];

  private readonly DAYS_EN = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private myListCompanyService: MyListCompanyService,
    private savedLists: SavedListService,
    private notify: NotificationService,
    private translate: TranslateService,
    private activity: ContactActivityService
  ) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.companyId = +params['id'];
      this.loadCompanyDetails();
    });
  }

  async loadCompanyDetails() {
    this.isLoading = true;
    try {
      const result = await this.myListCompanyService.getCompanyDetails(this.companyId);
      if (result.error) {
        console.error('Error loading company details:', result.message);
      } else {
        this.company = result;
        this.openingDays = this.parseOpeningHours(result.openingHours);
        this.extras = this.parseAdditionalInfo(result.additionalInfo);
        this.buildChecks();
        this.loadTouches();
      }
    } catch (error) {
      console.error('Error loading company details:', error);
    } finally {
      this.isLoading = false;
    }
  }

  /** Aparte del detalle: si falla, la ficha se ve igual, sólo sin actividad. */
  private async loadTouches(): Promise<void> {
    this.loadingTouches = true;
    try {
      this.touches = await this.activity.forContact(this.company?.phoneUnformatted, this.company?.title);
      // Recortado aquí, no en la plantilla: slice() en el *ngFor devolvía un
      // array nuevo en cada ciclo, con el mismo efecto de congelar la pestaña.
      this.recentTouches = this.touches.slice(0, 4);
    } finally {
      this.loadingTouches = false;
    }
  }

  /**
   * openingHours llega como un JSON en texto:
   *   [{"day": "Monday", "hours": "8 AM to 6 PM"}, {"day": "Saturday", "hours": "Closed"}]
   * Volcarlo tal cual en pantalla es ilegible. Aquí lo convertimos en filas.
   * Si el formato cambia o viene roto, devolvemos vacío y la plantilla muestra
   * el texto crudo como respaldo — nunca se pierde el dato.
   */
  private parseOpeningHours(raw: any): OpeningDay[] {
    if (!raw || raw === 'Not specified') return [];
    let list: any;
    try {
      list = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      return [];
    }
    if (!Array.isArray(list)) return [];

    const todayName = this.DAYS_EN[new Date().getDay()];
    return list
      .filter(d => d && (d.day || d.hours))
      .map(d => {
        const hours = String(d.hours ?? '').trim();
        return {
          day: String(d.day ?? '').trim(),
          hours: hours || '—',
          closed: /closed|cerrado/i.test(hours),
          today: String(d.day ?? '').trim().toLowerCase() === todayName.toLowerCase(),
        };
      });
  }

  /**
   * additionalInfo llega como un JSON en texto:
   *   {"Payments": [{"Debit cards": true}, {"Credit cards": true}],
   *    "Service options": [{"Delivery": true}, {"In-store pick-up": true}]}
   * Volcarlo tal cual llenaba media tarjeta de llaves y comillas. Aquí sacamos
   * sólo lo que la empresa SÍ tiene, agrupado. Si viene roto, devolvemos vacío
   * y la plantilla enseña el texto crudo como respaldo.
   */
  private parseAdditionalInfo(raw: any): { group: string; items: string[] }[] {
    if (!raw || raw === 'Not specified') return [];
    let obj: any;
    try {
      obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      return [];
    }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];

    const out: { group: string; items: string[] }[] = [];
    for (const [group, val] of Object.entries(obj)) {
      const items: string[] = [];
      for (const entry of (Array.isArray(val) ? val : [val])) {
        if (!entry || typeof entry !== 'object') continue;
        // Sólo lo que tiene en true: un "Delivery: false" no es un argumento de venta.
        for (const [name, on] of Object.entries(entry as any)) {
          if (on === true) items.push(name);
        }
      }
      if (items.length) out.push({ group, items });
    }
    return out;
  }

  /** Sólo se muestra crudo si no se pudo interpretar y hay algo que mostrar. */
  get rawHours(): string {
    const h = (this.company?.openingHours || '').trim();
    return h && h !== 'Not specified' ? h : '';
  }

  get about(): string {
    return (this.company?.description || this.company?.descriptionMd || '').trim();
  }

  /** "Villavicencio, Meta, Colombia" con lo que haya, sin comas sueltas. */
  get cityLine(): string {
    return [this.company?.city, this.company?.state, this.countryName]
      .map(v => (v || '').trim()).filter(Boolean).join(', ');
  }

  /** El backend manda el código ISO; mostramos el país cuando lo conocemos. */
  get countryName(): string {
    const code = (this.company?.countryCode || '').toUpperCase();
    const map: Record<string, string> = {
      CO: 'Colombia', MX: 'México', BR: 'Brasil', AR: 'Argentina', CL: 'Chile',
      PE: 'Perú', EC: 'Ecuador', VE: 'Venezuela', BO: 'Bolivia', PY: 'Paraguay',
      UY: 'Uruguay', CR: 'Costa Rica', PA: 'Panamá', GT: 'Guatemala',
      DO: 'República Dominicana', US: 'Estados Unidos', ES: 'España',
    };
    return map[code] || code;
  }

  get isOpen(): boolean { return !this.company?.permanentlyClosed; }

  /** Iniciales para el avatar, cuando no hay logo. */
  get initials(): string {
    const t = (this.company?.title || '').trim();
    if (!t) return '?';
    return t.split(/\s+/).slice(0, 2).map((w: string) => w[0]).join('').toUpperCase();
  }

  /** El sitio a veces viene sin protocolo; sin esto el enlace no abre. */
  get websiteHref(): string {
    const w = (this.company?.website || '').trim();
    if (!w) return '';
    return /^https?:\/\//i.test(w) ? w : 'https://' + w;
  }

  /**
   * Qué tenemos de esta empresa. No es un puntaje inventado: es cuántos de los
   * campos que sirven para venderle están realmente llenos.
   *
   * IMPORTANTE: campos fijos, calculados una sola vez al cargar. Como getters
   * devolvían un array nuevo en cada ciclo de change detection; el *ngFor no
   * podía saber que eran las mismas filas, destruía y rehacía ese DOM en cada
   * ciclo, y como Angular corre change detection en cada evento (mousemove
   * incluido) la pestaña se congelaba con sólo mover el mouse.
   */
  checks: { key: string; has: boolean }[] = [];
  completeness = 0;

  private buildChecks(): void {
    const c = this.company;
    this.checks = [
      { key: 'RECORD.CHK_PHONE',   has: !!c?.phoneUnformatted },
      { key: 'RECORD.CHK_SITE',    has: !!this.websiteHref },
      { key: 'RECORD.CHK_ADDRESS', has: !!(c?.address || c?.street) },
      { key: 'RECORD.CHK_HOURS',   has: this.openingDays.length > 0 },
      { key: 'RECORD.CHK_ABOUT',   has: !!this.about },
      { key: 'RECORD.CHK_CATEGORY',has: !!c?.categoryName },
    ];
    this.completeness = Math.round(
      this.checks.filter(x => x.has).length / this.checks.length * 100);
  }

  // ── Disparadores ────────────────────────────────────────────────────────

  async openListPicker(): Promise<void> {
    this.showListPicker = true;
    if (this.lists.length) return;
    this.loadingLists = true;
    try {
      const res = await this.savedLists.getMySavedLists();
      this.lists = res?.lists ?? [];
    } catch {
      this.lists = [];
    } finally {
      this.loadingLists = false;
    }
  }

  async addToList(listId: number): Promise<void> {
    if (this.savingToList) return;
    this.savingToList = true;
    try {
      const res = await this.savedLists.addCompaniesToList(listId, [this.companyId]);
      if (res?.error) {
        this.notify.showError(res.message || this.translate.instant('RECORD.ADD_FAILED'));
      } else {
        const name = this.lists.find(l => l.id === listId)?.name ?? '';
        this.notify.showSuccess(this.translate.instant('RECORD.ADDED_TO', { list: name }));
        this.showListPicker = false;
      }
    } catch {
      this.notify.showError(this.translate.instant('RECORD.ADD_FAILED'));
    } finally {
      this.savingToList = false;
    }
  }

  goToLists(): void {
    this.showListPicker = false;
    this.router.navigate(['/my-lists']);
  }

  /**
   * No creamos la campaña desde aquí: faltan agente, tipo y horario. Abrimos el
   * asistente con esta empresa ya elegida como lead.
   */
  createCampaign(): void {
    this.router.navigate(['/campaigns'], {
      queryParams: {
        newLead: this.companyId,
        leadType: 'company',
        leadName: this.company?.title || '',
        leadPhone: this.company?.phoneUnformatted || '',
        leadEmail: '',
      }
    });
  }

  trackTouch = (i: number, t: ContactTouch) => t.date + i;

  goBack() {
    this.location.back();
  }
}
