import { Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MyListPeopleService } from '../../services/my-list-people.service';
import { PeopleService } from '../../services/people.service';
import { ContactActivityService, ContactTouch } from '../../services/contact-activity.service';
import { SavedListService, SavedListSummary } from '../../services/saved-list.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-people-details',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule],
  templateUrl: './people-details.component.html',
  styleUrl: './people-details.component.css'
})
export class PeopleDetailsComponent implements OnInit {
  people: any = null;
  isLoading = false;
  peopleId: number = 0;

  /** Toques previos con esta persona. Vacío = nunca la hemos contactado. */
  touches: ContactTouch[] = [];
  recentTouches: ContactTouch[] = [];
  loadingTouches = false;

  /** La descripción suele ser larguísima; se recorta hasta que la abran. */
  expanded = false;

  /** El avatar remoto falla a menudo; ahí caemos a las iniciales. */
  imgFailed = false;

  /** Elegir lista al vuelo, sin salir de la ficha. */
  showListPicker = false;
  loadingLists = false;
  savingToList = false;
  lists: SavedListSummary[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private myListPeopleService: MyListPeopleService,
    private peopleService: PeopleService,
    private activity: ContactActivityService,
    private savedLists: SavedListService,
    private notify: NotificationService,
    private translate: TranslateService
  ) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.peopleId = +params['id'];
      this.loadPeopleDetails();
    });
  }

  async loadPeopleDetails() {
    this.isLoading = true;
    try {
      // getPeopleDetails exige que el registro este GUARDADO en la lista del
      // usuario. Los que se abren desde el Historial son resultados de busqueda
      // sin guardar, asi que devolvia "no encontrado" y la ficha salia vacia.
      // getPeopleResultById lee la misma tabla con el mismo id, sin ese filtro.
      let result = await this.myListPeopleService.getPeopleDetails(this.peopleId);
      if (result?.error) {
        result = await this.peopleService.getPeopleResultById(this.peopleId);
      }
      if (result?.error) {
        console.error('Error loading people details:', result.message);
      } else {
        this.people = result;
        this.buildChecks();
        this.loadTouches();
      }
    } catch (error) {
      console.error('Error loading people details:', error);
    } finally {
      this.isLoading = false;
    }
  }

  /** Aparte del detalle: si falla, la ficha se ve igual, sólo sin franja. */
  private async loadTouches(): Promise<void> {
    this.loadingTouches = true;
    try {
      this.touches = await this.activity.forContact(this.people?.phone, this.displayName);
      // Recortado aquí, no en la plantilla: slice() en el *ngFor devolvía un
      // array nuevo en cada ciclo, con el mismo efecto de congelar la pestaña.
      this.recentTouches = this.touches.slice(0, 4);
    } finally {
      this.loadingTouches = false;
    }
  }

  get displayName(): string {
    return this.people?.fullName || this.people?.name || '';
  }

  get avatarUrl(): string {
    return this.imgFailed ? '' : (this.people?.image || this.people?.avatar || '');
  }

  get initials(): string {
    const n = this.displayName.trim();
    if (!n) return '?';
    return n.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  /**
   * El cargo a veces viene repitiendo el nombre completo ("Antonia Vélez -
   * Growth | Performance"). Mostrarlo tal cual duplica el título de la ficha,
   * así que le quitamos el nombre cuando lo trae pegado.
   */
  get jobTitle(): string {
    const t = (this.people?.title || '').trim();
    if (!t) return '';
    const n = this.displayName.trim();
    if (n && t.toLowerCase().startsWith(n.toLowerCase())) {
      return t.slice(n.length).replace(/^[\s\-–—·|,]+/, '').trim() || t;
    }
    return t;
  }

  get place(): string {
    return (this.people?.location || '').trim();
  }

  /** El texto largo: preferimos "about", si no la descripción. */
  get about(): string {
    return (this.people?.about || this.people?.description || '').trim();
  }

  get linkedIn(): string {
    const l = (this.people?.link || '').trim();
    return /linkedin\./i.test(l) ? l : '';
  }

  /** Sólo para mostrar: "linkedin.com/in/x" en vez de la URL completa. */
  get linkedInLabel(): string {
    return this.linkedIn.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
  }

  get waHref(): string {
    const d = (this.people?.phone || '').replace(/\D/g, '');
    return d ? `https://wa.me/${d}` : '';
  }

  /** El backend manda esto como texto o como lista; normalizamos a lista. */
  private asList(v: any): string[] {
    if (!v) return [];
    if (Array.isArray(v)) return v.map(x => typeof x === 'string' ? x : (x?.title || x?.name || '')).filter(Boolean);
    const s = String(v).trim();
    if (!s || s === 'Not specified') return [];
    if (s.startsWith('[')) {
      try { return this.asList(JSON.parse(s)); } catch { /* cae al texto plano */ }
    }
    return [s];
  }

  get education(): string[]  { return this.asList(this.people?.education); }
  get experience(): string[] { return this.asList(this.people?.experiencies); }

  /**
   * Qué tenemos de esta persona. No es un puntaje inventado: es cuántos de los
   * campos que sirven para contactarla están realmente llenos.
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
    this.checks = [
      { key: 'RECORD.CHK_PHONE',  has: !!this.people?.phone },
      { key: 'RECORD.CHK_EMAIL',  has: !!this.people?.email },
      { key: 'RECORD.CHK_LINKEDIN', has: !!this.linkedIn },
      { key: 'RECORD.CHK_JOB',    has: !!this.jobTitle },
      { key: 'RECORD.CHK_PLACE',  has: !!this.place },
      { key: 'RECORD.CHK_ABOUT',  has: !!this.about },
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
      const res = await this.savedLists.addPeopleToList(listId, [this.peopleId]);
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
   * asistente con esta persona ya elegida como lead.
   */
  createCampaign(): void {
    this.router.navigate(['/campaigns'], {
      queryParams: {
        newLead: this.peopleId,
        leadType: 'people',
        leadName: this.displayName,
        leadPhone: this.people?.phone || '',
        leadEmail: this.people?.email || '',
      }
    });
  }

  trackTouch = (i: number, t: ContactTouch) => t.date + i;

  goBack() {
    this.location.back();
  }
}
