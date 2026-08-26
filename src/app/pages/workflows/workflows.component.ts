import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { WorkflowService, WorkflowInstance, WorkflowType } from '../../services/workflow.service';
import { AbandonedCheckout } from '../../services/abandoned-checkout.service';
import { NotificationService } from '../../services/notification.service';
import { WORKFLOW_TEMPLATES, WorkflowTemplate } from '../../config/workflow-templates';
import { AbandonedCheckoutFormComponent } from '../../components/abandoned-checkout-form/abandoned-checkout-form.component';

@Component({
  selector: 'app-workflows',
  standalone: true,
  templateUrl: './workflows.component.html',
  styleUrls: ['./workflows.component.css'],
  imports: [CommonModule, FormsModule, RouterModule, TranslateModule, AbandonedCheckoutFormComponent]
})
export class WorkflowsComponent implements OnInit {

  instances: WorkflowInstance[] = [];
  isLoading = false;

  templates: WorkflowTemplate[] = WORKFLOW_TEMPLATES;

  isFormVisible = false;
  activeTemplateKey: WorkflowType | null = null;
  editingRecord: AbandonedCheckout | null = null;

  // ── Búsqueda y filtros ──
  searchTerm = '';
  typeFilter: WorkflowType | 'all' = 'all';
  statusFilter: 'all' | 'active' | 'paused' = 'all';

  constructor(
    private workflowService: WorkflowService,
    private notificationService: NotificationService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loadInstances();
  }

  async loadInstances(): Promise<void> {
    this.isLoading = true;
    try {
      this.instances = await this.workflowService.getWorkflowInstances();
    } catch (error) {
      console.error('Error loading workflow instances:', error);
      this.instances = [];
    } finally {
      this.isLoading = false;
    }
  }

  // ── Métricas (derivadas de `instances`, sin llamadas nuevas al backend) ──
  get totalCount(): number {
    return this.instances.length;
  }

  get activeCount(): number {
    return this.instances.filter(i => i.active).length;
  }

  get pausedCount(): number {
    return this.instances.filter(i => !i.active).length;
  }

  get errorCount(): number {
    return this.instances.filter(i => !!i.error).length;
  }

  get totalFollowups(): number {
    return this.instances.reduce((sum, i) => sum + (i.followupsCount || 0), 0);
  }

  // ── Lista filtrada que consume la tabla ──
  get filteredInstances(): WorkflowInstance[] {
    let result = this.instances;

    if (this.typeFilter !== 'all') {
      result = result.filter(i => i.workflowType === this.typeFilter);
    }

    if (this.statusFilter !== 'all') {
      const wantActive = this.statusFilter === 'active';
      result = result.filter(i => i.active === wantActive);
    }

    const term = this.searchTerm.trim().toLowerCase();
    if (term) {
      result = result.filter(i =>
        i.name.toLowerCase().includes(term) ||
        (i.agentName || '').toLowerCase().includes(term)
      );
    }

    return result;
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.typeFilter = 'all';
    this.statusFilter = 'all';
  }

  async onToggleActive(instance: WorkflowInstance): Promise<void> {
    const previousValue = instance.active;
    instance.active = !instance.active; // optimista, se revierte si falla

    try {
      await this.workflowService.toggleWorkflowActive(instance.id, instance.workflowType, instance.active);
    } catch (error: any) {
      instance.active = previousValue;
      console.error('Error toggling workflow active state:', error);
      this.notificationService.showError(`Error al actualizar el estado: ${error.message}`);
    }
  }

  openTemplate(template: WorkflowTemplate): void {
    this.activeTemplateKey = template.key;
    this.editingRecord = null;
    this.isFormVisible = true;
  }

  editInstance(instance: WorkflowInstance, event: Event): void {
    event.stopPropagation();
    this.activeTemplateKey = instance.workflowType;
    this.editingRecord = { id: instance.id } as AbandonedCheckout;
    this.isFormVisible = true;
  }

  closeForm(): void {
    this.isFormVisible = false;
    this.activeTemplateKey = null;
    this.editingRecord = null;
  }

  onFormSaved(): void {
    this.closeForm();
    this.loadInstances();
  }

  viewDetails(instance: WorkflowInstance): void {
    switch (instance.workflowType) {
      case 'ABANDONED_CHECKOUT':
        this.router.navigate(['/workflows/abandoned-checkout', instance.id]);
        break;
    }
  }

  templateLabel(workflowType: WorkflowType): string {
    const found = this.templates.find(t => t.key === workflowType);
    return found ? found.titleKey : workflowType;
  }
}