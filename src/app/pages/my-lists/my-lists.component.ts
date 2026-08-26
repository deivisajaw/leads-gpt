import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { SavedListService, SavedListSummary } from '../../services/saved-list.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-my-lists',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TranslateModule],
  templateUrl: './my-lists.component.html',
  styleUrl: './my-lists.component.css'
})
export class MyListsComponent implements OnInit {

  lists: SavedListSummary[] = [];
  isLoading = false;
  public rowsRevealed = false;

  // ─── Modal de crear/renombrar lista ───
  public showListModal = false;
  public listModalMode: 'create' | 'rename' = 'create';
  public listModalName = '';
  public listModalDescription = '';
  public listModalTargetId: number | null = null;
  public isSavingList = false;

  // ─── Modal de confirmación de borrado ───
  public showDeleteConfirm = false;
  public deleteTargetList: SavedListSummary | null = null;
  public isDeleting = false;

  constructor(
    private savedListService: SavedListService,
    private router: Router,
    private notificationService: NotificationService
  ) {}

  ngOnInit() {
    this.loadLists();
  }

  async loadLists() {
    this.isLoading = true;
    try {
      const res = await this.savedListService.getMySavedLists();
      if (res.error) {
        this.notificationService.showError(res.message || 'Error al cargar tus listas.');
        this.lists = [];
      } else {
        this.lists = res.lists;
      }
    } catch (error) {
      this.notificationService.showError('Error de conexión al cargar tus listas.');
      this.lists = [];
    } finally {
      this.isLoading = false;
      this.rowsRevealed = false;
      setTimeout(() => { this.rowsRevealed = true; }, 0);
    }
  }

  openList(list: SavedListSummary): void {
    this.router.navigate(['/my-lists', list.id]);
  }

  // ─── Crear / renombrar ───

  openCreateModal(): void {
    this.listModalMode = 'create';
    this.listModalName = '';
    this.listModalDescription = '';
    this.listModalTargetId = null;
    this.showListModal = true;
  }

  openRenameModal(list: SavedListSummary, event: Event): void {
    event.stopPropagation();
    this.listModalMode = 'rename';
    this.listModalName = list.name;
    this.listModalDescription = list.description || '';
    this.listModalTargetId = list.id;
    this.showListModal = true;
  }

  closeListModal(): void {
    this.showListModal = false;
  }

  async saveListModal(): Promise<void> {
    const name = this.listModalName.trim();
    if (!name) {
      this.notificationService.showError('El nombre de la lista es requerido.');
      return;
    }

    this.isSavingList = true;
    try {
      if (this.listModalMode === 'create') {
        const res = await this.savedListService.createSavedList(name, this.listModalDescription.trim() || undefined);
        if (res.error) {
          this.notificationService.showError(res.message || 'No se pudo crear la lista.');
        } else {
          this.notificationService.showSuccess('Lista creada.');
          this.showListModal = false;
          this.loadLists();
        }
      } else if (this.listModalTargetId !== null) {
        const res = await this.savedListService.renameSavedList(this.listModalTargetId, name, this.listModalDescription.trim() || undefined);
        if (res.error) {
          this.notificationService.showError(res.message || 'No se pudo renombrar la lista.');
        } else {
          this.notificationService.showSuccess('Lista actualizada.');
          this.showListModal = false;
          this.loadLists();
        }
      }
    } catch (error) {
      this.notificationService.showError('Error de conexión al guardar la lista.');
    } finally {
      this.isSavingList = false;
    }
  }

  // ─── Borrar ───

  openDeleteConfirm(list: SavedListSummary, event: Event): void {
    event.stopPropagation();
    this.deleteTargetList = list;
    this.showDeleteConfirm = true;
  }

  closeDeleteConfirm(): void {
    this.showDeleteConfirm = false;
    this.deleteTargetList = null;
  }

  async confirmDelete(): Promise<void> {
    if (!this.deleteTargetList) return;
    this.isDeleting = true;
    try {
      const res = await this.savedListService.deleteSavedList(this.deleteTargetList.id);
      if (res.error) {
        this.notificationService.showError(res.message || 'No se pudo borrar la lista.');
      } else {
        this.notificationService.showSuccess('Lista borrada. Las empresas/personas guardadas siguen en tu lista general.');
        this.showDeleteConfirm = false;
        this.deleteTargetList = null;
        this.loadLists();
      }
    } catch (error) {
      this.notificationService.showError('Error de conexión al borrar la lista.');
    } finally {
      this.isDeleting = false;
    }
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  }
}
