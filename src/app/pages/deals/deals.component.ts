import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  CdkDragDrop, moveItemInArray, transferArrayItem,
  CdkDropListGroup, CdkDropList, CdkDrag,
} from '@angular/cdk/drag-drop';
import {
  DealsService, Deal, DealStageConfig,
  CreateDealRequest, CreateStageRequest, DealCampaignOption
} from '../../services/deals.service';
import { DealDetailModalComponent } from '../../components/deal-detail-modal/deal-detail-modal.component';
import { NotificationService } from '../../services/notification.service';

export type ViewMode = 'kanban' | 'grid' | 'list';
export type SortField = 'name' | 'amount' | 'createdOn' | 'expectedCloseDate';
export type SortDir = 'asc' | 'desc';

@Component({
  selector: 'app-deals',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TranslateModule,
    CdkDropListGroup, CdkDropList, CdkDrag,
    DealDetailModalComponent,
  ],
  templateUrl: './deals.component.html',
  styleUrls: ['./deals.component.css'],
})
export class DealsComponent implements OnInit {

  private svc = inject(DealsService);
  private notify = inject(NotificationService);
  private translate = inject(TranslateService);

  // ── Data ──────────────────────────────────────────────────────────────────
  allDeals: Deal[] = [];
  stageConfigs: DealStageConfig[] = [];
  board: Record<number, Deal[]> = {};

  // ── UI state ──────────────────────────────────────────────────────────────
  isLoading = true;
  isUpdatingStage = false;
  viewMode: ViewMode = 'kanban';

  // ── List view collapsed groups ─────────────────────────────────────────────
  listGrouped = false;
  private collapsedGroups = new Set<number>();

  // ── Search & Filter ───────────────────────────────────────────────────────
  searchQuery = '';
  filterStageId: number | null = null;
  sortField: SortField = 'createdOn';
  sortDir: SortDir = 'desc';
  filteredDeals: Deal[] = [];

  // ── Detail modal ──────────────────────────────────────────────────────────
  selectedDeal: Deal | null = null;

  // ── Create Deal Panel ─────────────────────────────────────────────────────
  showCreatePanel = false;
  isSavingDeal = false;
  createForm: CreateDealRequest = this.emptyCreateForm();

  // ── Campaigns for select ──────────────────────────────────────────────────
  availableCampaigns: DealCampaignOption[] = [];

  // ── Delete confirmation ────────────────────────────────────────────────────
  dealToDelete: Deal | null = null;
  isDeletingDeal = false;

  // ── Create Stage Modal ────────────────────────────────────────────────────
  showStageModal = false;
  isSavingStage = false;
  stageForm: CreateStageRequest = { _label: '', _color: '#5b4fe5', _stageType: 'open', _probability: 0 };

  // ── Import CSV Modal ──────────────────────────────────────────────────────
  showImportModal = false;
  isImporting = false;
  csvFile: File | null = null;
  csvPreviewRows: string[][] = [];
  importResult: any = null;

  // ─────────────────────────────────────────────────────────────────────────
  // INIT
  // ─────────────────────────────────────────────────────────────────────────

  ngOnInit(): void { this.loadAll(); }

  /**
   * Con Promise.all, una sola petición lenta dejaba el tablero entero girando:
   * si ésa no respondía nunca, las otras dos ya habían llegado y no servían de
   * nada. Con allSettled pintamos lo que sí llegó y avisamos de lo que falló,
   * en vez de quedarnos en el engranaje.
   */
  async loadAll(): Promise<void> {
    this.isLoading = true;
    try {
      const [stages, deals, campaigns] = await Promise.allSettled([
        this.svc.getStageConfigs(),
        this.svc.getDeals(),
        this.svc.getCampaignsByCompany(),
      ]);

      this.stageConfigs = stages.status === 'fulfilled'
        ? [...stages.value].sort((a, b) => a.sortOrder - b.sortOrder) : [];
      this.allDeals = deals.status === 'fulfilled' ? deals.value : [];
      this.availableCampaigns = campaigns.status === 'fulfilled' ? campaigns.value : [];

      this.initBoard();
      this.populateBoard();
      this.applyFilter();

      const failed = [stages, deals, campaigns].filter(r => r.status === 'rejected');
      if (failed.length) {
        const reason = (failed[0] as PromiseRejectedResult).reason;
        const timedOut = reason?.name === 'RequestTimeoutError';
        this.notify.showError(this.translate.instant(timedOut ? 'DEALS.LOAD_TIMEOUT' : 'DEALS.LOAD_FAILED'));
      }
    } finally {
      this.isLoading = false;
    }
  }

  private initBoard(): void {
    this.board = {};
    this.stageConfigs.forEach(s => this.board[s.id] = []);
  }

  private populateBoard(): void {
    this.initBoard();
    this.allDeals.forEach(d => {
      if (this.board[d.stageConfigId] !== undefined) {
        this.board[d.stageConfigId].push(d);
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SEARCH / FILTER / SORT
  // ─────────────────────────────────────────────────────────────────────────

  applyFilter(): void {
    let list = [...this.allDeals];
    const q = this.searchQuery.trim().toLowerCase();

    if (q) {
      list = list.filter(d =>
        d.name.toLowerCase().includes(q) ||
        (d.contact?.displayName ?? '').toLowerCase().includes(q) ||
        (d.contact?.email ?? '').toLowerCase().includes(q) ||
        (d.campaignName ?? '').toLowerCase().includes(q) ||
        (d.ownerUserFullName ?? '').toLowerCase().includes(q)
      );
    }
    if (this.filterStageId !== null) {
      list = list.filter(d => d.stageConfigId === this.filterStageId);
    }

    list.sort((a, b) => {
      const va: any = (a as any)[this.sortField] ?? '';
      const vb: any = (b as any)[this.sortField] ?? '';
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return this.sortDir === 'asc' ? cmp : -cmp;
    });

    this.filteredDeals = list;

    if (q || this.filterStageId !== null) {
      this.initBoard();
      list.forEach(d => {
        if (this.board[d.stageConfigId] !== undefined)
          this.board[d.stageConfigId].push(d);
      });
    } else {
      this.populateBoard();
    }
  }

  setSort(field: SortField): void {
    if (this.sortField === field) this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    else { this.sortField = field; this.sortDir = 'asc'; }
    this.applyFilter();
  }

  clearSearch(): void { this.searchQuery = ''; this.filterStageId = null; this.applyFilter(); }

  setView(v: ViewMode): void { this.viewMode = v; }

  // ─────────────────────────────────────────────────────────────────────────
  // LIST VIEW HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  getListGroupDeals(stageId: number): Deal[] {
    const q = this.searchQuery.trim().toLowerCase();
    const base = this.board[stageId] ?? [];
    if (!q && this.filterStageId === null) return base;
    return this.filteredDeals.filter(d => d.stageConfigId === stageId);
  }

  toggleListGroup(stageId: number): void {
    if (this.collapsedGroups.has(stageId)) {
      this.collapsedGroups.delete(stageId);
    } else {
      this.collapsedGroups.add(stageId);
    }
  }

  isGroupCollapsed(stageId: number): boolean {
    return this.collapsedGroups.has(stageId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // KANBAN DRAG & DROP
  // ─────────────────────────────────────────────────────────────────────────

  async drop(event: CdkDragDrop<Deal[]>): Promise<void> {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      return;
    }

    const deal = event.previousContainer.data[event.previousIndex];
    const oldStageId = deal.stageConfigId;
    const newStageId = +event.container.id;
    const newStage = this.stageConfigs.find(s => s.id === newStageId);

    transferArrayItem(
      event.previousContainer.data, event.container.data,
      event.previousIndex, event.currentIndex
    );

    this.isUpdatingStage = true;
    try {
      await this.svc.updateDealStage(deal.id, newStageId);
      deal.stageConfigId = newStageId;
      deal.stageLabel = newStage?.label ?? '';
      deal.stageColor = newStage?.color ?? '';
      deal.stageCode = newStage?.code ?? '';
      deal.stageType = newStage?.stageType ?? 'open';
      this.notify.showSuccess('Etapa actualizada correctamente.');
    } catch (e: any) {
      // Rollback visual
      transferArrayItem(
        event.container.data, event.previousContainer.data,
        event.currentIndex, event.previousIndex
      );
      deal.stageConfigId = oldStageId;
      this.notify.showError('Error al actualizar etapa: ' + e.message);
    } finally {
      this.isUpdatingStage = false;
    }
  }

  getConnectedList(): string[] {
    return this.stageConfigs.map(s => s.id.toString());
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DETAIL MODAL
  // ─────────────────────────────────────────────────────────────────────────

  openDealModal(deal: Deal): void { this.selectedDeal = deal; }
  onModalClose(): void { this.selectedDeal = null; this.loadAll(); }

  // ─────────────────────────────────────────────────────────────────────────
  // CREATE DEAL PANEL
  // ─────────────────────────────────────────────────────────────────────────

  openCreatePanel(): void {
    this.createForm = this.emptyCreateForm();
    const def = this.stageConfigs.find(s => s.isDefault) ?? this.stageConfigs[0];
    if (def) this.createForm._stageConfigId = def.id;
    this.showCreatePanel = true;
  }

  closeCreatePanel(): void { this.showCreatePanel = false; }

  async submitCreateDeal(): Promise<void> {
    if (!this.createForm._name?.trim()) {
      this.notify.showError('El nombre del deal es requerido.'); return;
    }
    if (!this.createForm._contactData?._displayName?.trim()) {
      this.notify.showError('El nombre del contacto es requerido.'); return;
    }
    this.isSavingDeal = true;
    try {
      const newDeal = await this.svc.createDeal(this.createForm);
      this.allDeals.push(newDeal);
      if (this.board[newDeal.stageConfigId]) {
        this.board[newDeal.stageConfigId].push(newDeal);
      }
      this.applyFilter();
      this.notify.showSuccess('Deal creado correctamente.');
      this.showCreatePanel = false;
    } catch (e: any) {
      this.notify.showError(e.message);
    } finally {
      this.isSavingDeal = false;
    }
  }

  private emptyCreateForm(): CreateDealRequest {
    return {
      _name: '',
      _description: '',
      _amount: undefined,
      _expectedCloseDate: '',
      _stageConfigId: undefined,
      _campaignId: undefined,
      _contactData: {
        _contactType: 'PEOPLE',
        _displayName: '',
        _email: '',
        _phone: '',
        _jobTitle: '',
        _associatedCompany: '',
        _source: 'MANUAL',
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CREATE STAGE MODAL
  // ─────────────────────────────────────────────────────────────────────────

  openStageModal(): void {
    this.stageForm = { _label: '', _color: '#5b4fe5', _stageType: 'open', _probability: 0 };
    this.showStageModal = true;
  }

  closeStageModal(): void { this.showStageModal = false; }

  async submitCreateStage(): Promise<void> {
    if (!this.stageForm._label?.trim()) {
      this.notify.showError('El nombre del stage es requerido.'); return;
    }
    this.isSavingStage = true;
    try {
      const stage = await this.svc.createStageConfig(this.stageForm);
      this.stageConfigs.push(stage);
      this.stageConfigs.sort((a, b) => a.sortOrder - b.sortOrder);
      this.board[stage.id] = [];
      this.notify.showSuccess('Stage creado correctamente.');
      this.showStageModal = false;
    } catch (e: any) {
      this.notify.showError(e.message);
    } finally {
      this.isSavingStage = false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // IMPORT CSV MODAL
  // ─────────────────────────────────────────────────────────────────────────

  openImportModal(): void {
    this.csvFile = null;
    this.csvPreviewRows = [];
    this.importResult = null;
    this.showImportModal = true;
  }

  closeImportModal(): void { this.showImportModal = false; }

  onCsvFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.csvFile = file;
    this.importResult = null;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim());
      this.csvPreviewRows = lines.slice(0, 4).map(l =>
        l.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
      );
    };
    reader.readAsText(file);
  }

  async submitImport(): Promise<void> {
    if (!this.csvFile) { this.notify.showError('Seleccione un archivo CSV.'); return; }
    this.isImporting = true;
    try {
      const csvContent = await this.csvFile.text();
      this.importResult = await this.svc.importDealsFromCsv(csvContent);

      const hasErrors = (this.importResult?.errors?.length ?? 0) > 0;

      if (this.importResult.imported > 0) {
        await this.loadAll();
        this.notify.showSuccess(`${this.importResult.imported} deal(s) importados.`);
      }

      if (!hasErrors) {
        this.closeImportModal();
      }

    } catch (e: any) {
      this.notify.showError(e.message);
    } finally {
      this.isImporting = false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UTILS
  // ─────────────────────────────────────────────────────────────────────────

  getInitials(name: string): string {
    return (name ?? '').split(' ').slice(0, 2).map(n => n[0] ?? '').join('').toUpperCase();
  }

  getTotalAmount(stageId: number): number {
    return (this.board[stageId] ?? []).reduce((s, d) => s + (d.amount ?? 0), 0);
  }

  getTotalAllDeals(): number {
    return this.filteredDeals.reduce((s, d) => s + (d.amount ?? 0), 0);
  }

  getStageById(id: number): DealStageConfig | undefined {
    return this.stageConfigs.find(s => s.id === id);
  }

  trackByStage(_: number, s: DealStageConfig) { return s.id; }
  trackByDeal(_: number, d: Deal) { return d.id; }

  // ── Delete deal ────────────────────────────────────────────────────────────

  openDeleteConfirm(deal: Deal, event: MouseEvent): void {
    event.stopPropagation(); // evita abrir el modal de detalle
    this.dealToDelete = deal;
  }

  cancelDelete(): void {
    this.dealToDelete = null;
  }

  async confirmDelete(): Promise<void> {
    if (!this.dealToDelete) return;
    this.isDeletingDeal = true;
    try {
      await this.svc.deleteDeal(this.dealToDelete.id);
      this.notify.showSuccess(
        this.translate.instant('DEALS.DELETE.SUCCESS', { name: this.dealToDelete.name })
      );
      this.dealToDelete = null;
      await this.loadAll();
    } catch (e: any) {
      this.notify.showError(e.message || this.translate.instant('DEALS.DELETE.ERROR'));
    } finally {
      this.isDeletingDeal = false;
    }
  }
}