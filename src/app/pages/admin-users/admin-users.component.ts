import { Component, OnInit, ElementRef, ViewChild, HostListener } from '@angular/core'; 
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  CompanyDataService,
  CompanyAdminData,
  CompanyMember,
} from '../../services/company-data.service';
import { AuthService } from '../../services/auth.service'; 
import { AssignCreditsModalComponent } from '../../components/shared/assign-credits-modal/assign-credits-modal.component';
import { InviteUserModalComponent } from '../../components/shared/invite-user-modal/invite-user-modal.component';
import { ViewGeneratedCodesModalComponent } from '../../components/shared/view-generated-codes-modal/view-generated-codes-modal.component';
import { DistributeCreditsInputModalComponent } from '../../components/shared/distribute-credits-input-modal/distribute-credits-input-modal.component';
import { ConfirmationModalComponent } from '../../components/shared/confirmation-modal/confirmation-modal.component';
import { CreditHistoryModalComponent } from '../../components/shared/credit-history-modal/credit-history-modal.component'; 
import { EditPriorityModalComponent } from '../../components/shared/edit-priority-modal/edit-priority-modal.component';
import { OnboardingService } from "../../services/onboarding.service"; // NEW IMPORT


import { NotificationService } from '../../services/notification.service';

interface ActionMenuItem {
  labelKey: string; 
  icon: string;
  action: (member: CompanyMember) => void;
  show: boolean; 
}

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    FormsModule,
    AssignCreditsModalComponent,
    InviteUserModalComponent,
    ViewGeneratedCodesModalComponent,
    DistributeCreditsInputModalComponent,
    ConfirmationModalComponent,
    CreditHistoryModalComponent, 
    EditPriorityModalComponent
  ],
  templateUrl: './admin-users.component.html',
  styleUrl: './admin-users.component.css',
})
export class AdminUsersComponent implements OnInit {
  isLoading = true;
  error: string | null = null;
  data: CompanyAdminData | null = null;

  notification = {
    show: false,
    type: 'success', 
    message: '',
  };

  selection = new Set<number>();

  showAssignCreditsModal: boolean = false;
  selectedMemberForCredits: CompanyMember | null = null;
  showInviteUserModal: boolean = false;
  showViewGeneratedCodesModal: boolean = false;
  showCreditHistoryModal: boolean = false;
  showEditPriorityModal: boolean = false;
  selectedMemberForPriorityEdit: CompanyMember | null = null; 
  selectedMemberForHistory: CompanyMember | null = null;
  modalAssignCreditsType: 'ASSIGN_SINGLE' | 'ASSIGN_BULK' | 'EDIT_CREDITS_USER' | null = null;

  modalTitle = "";
  modalMessage = "";
  initialCredits = 0;
  maxCredits = 0; 

  currentPage: number = 1;
  pageSize: number = 10; 
  paginatedMembers: CompanyMember[] = [];
  searchTerm: string = '';
  filteredMembers: CompanyMember[] = [];

  activeActionMenuMember: CompanyMember | null = null; 
  showActionMenu: boolean = false;
  menuPosition = { top: '0px', left: '0px' };
  @ViewChild('actionMenu') actionMenu!: ElementRef;
  currentActionMenuOptions: ActionMenuItem[] = []; // Nueva propiedad

  currentUserId: number | null = null;

  showDistributeCreditsInputModal: boolean = false;
  showConfirmationModal: boolean = false;
  creditsToDistributeForConfirmation: number = 0;
  distributionModeForConfirmation: 'equitable' | 'rule-based' = 'equitable';

  confirmationState = {
    show: false,
    title: '',
    message: '',
    isLoading: false,
    error: null as string | null,
    confirmAction: () => { },
  };
  memberForAction: CompanyMember | null = null;
  Math = Math;

  constructor(
    private companyDataService: CompanyDataService,
    private authService: AuthService, 
    private translate: TranslateService,
    private el: ElementRef,
    private onboardingService: OnboardingService
  ) { }

  ngOnInit(): void {
    this.authService.ensureProfileLoaded().then(() => {
      this.currentUserId = this.authService.currentUserProfile?.userId ?? null;
      this.fetchData();
    });
  }

  @HostListener('document:click', ['$event'])
  onClick(event: Event) {
    if (
      this.showActionMenu &&
      this.actionMenu &&
      !this.actionMenu.nativeElement.contains(event.target as Node)
    ) {
      this.showActionMenu = false;
      this.activeActionMenuMember = null;
    }
  }

  @HostListener('document:keydown.escape', ['$event'])
  onKeydownHandler(event: KeyboardEvent) {
    if (this.showAssignCreditsModal) this.closeAssignCreditsModal();
    if (this.showInviteUserModal) this.closeInviteUserModal();
    if (this.showViewGeneratedCodesModal) this.closeViewGeneratedCodesModal();
    if (this.showDistributeCreditsInputModal) this.closeDistributeCreditsInputModal();
    if (this.showConfirmationModal) this.closeConfirmationModal();
    if (this.confirmationState.show) this.closeGenericConfirmation();
    if (this.showActionMenu) {
      this.showActionMenu = false;
      this.activeActionMenuMember = null;
    }
  }

  async fetchData(): Promise<void> {
    this.isLoading = true;
    this.error = null;
    this.selection.clear();
    try {
      const realData = await this.companyDataService.getCompanyMembers();

      const numberOfFakeUsersToAdd = 80;
      const lastRealMemberId = realData.members.length > 0 ? Math.max(...realData.members.map(m => m.id)) : 0;
      const fakeUsers = this.generateFakeUsers(numberOfFakeUsersToAdd, lastRealMemberId + 1);

      //const combinedMembers = [...realData.members, ...fakeUsers];
      const combinedMembers = [...realData.members];

      this.data = {
        ...realData, 
        members: combinedMembers,
        pagination: {
          totalRecords: combinedMembers.length,
          currentPage: this.currentPage,
          totalPages: Math.ceil(combinedMembers.length / this.pageSize)
        }
      };
      this.applyFiltersAndPagination(); 

    } catch (err: any) {
      this.error = err.message || 'An unknown error occurred while fetching data.';
    } finally {
      this.isLoading = false;
    }
  }

  applyFiltersAndPagination(): void {
    if (!this.data || !this.data.members) {
      this.filteredMembers = [];
      this.paginatedMembers = [];
      return;
    }

    const lowerCaseSearchTerm = this.searchTerm.toLowerCase();
    this.filteredMembers = this.data.members.filter(member =>
      member.fullName.toLowerCase().includes(lowerCaseSearchTerm) ||
      member.email.toLowerCase().includes(lowerCaseSearchTerm)
    );

    this.data.pagination.totalRecords = this.filteredMembers.length;
    this.data.pagination.totalPages = Math.ceil(this.filteredMembers.length / this.pageSize);
    this.currentPage = 1;

    this.applyPagination();
  }

  applyPagination(): void {
    if (!this.filteredMembers) {
      this.paginatedMembers = [];
      return;
    }
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.paginatedMembers = this.filteredMembers.slice(startIndex, endIndex);
  }

  getInitials(name: string): string {
    if (!name) return '';
    const names = name.split(' ');
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return `${name[0]}${name[1] || ''}`.toUpperCase();
  }

  showNotification(type: 'success' | 'danger', message: string) {
    this.notification = { show: true, type, message };
  }

  dismissNotification() {
    this.notification.show = false;
  }

  get isAllSelected(): boolean {
    if (!this.data || !this.data.members.length) return false;
    return this.selection.size === this.data.members.length;
  }

  toggleSelectAll(): void {
    if (this.isAllSelected) {
      this.selection.clear();
    } else {
      this.data?.members.forEach((member) => this.selection.add(member.id));
    }
  }

  toggleMemberSelection(memberId: number): void {
    if (this.selection.has(memberId)) {
      this.selection.delete(memberId);
    } else {
      this.selection.add(memberId);
    }
  }

  onPageSizeChange(event: Event): void {
    this.pageSize = +(event.target as HTMLSelectElement).value;
    this.currentPage = 1;
    this.applyFiltersAndPagination();
  }

  goToPage(page: number): void {
    if (!this.data) return;
    const totalPages = Math.ceil(this.filteredMembers.length / this.pageSize);
    if (page >= 1 && page <= totalPages) {
      this.currentPage = page;
      this.applyPagination();
    }
  }

  goToNextPage(): void {
    this.goToPage(this.currentPage + 1);
  }

  goToPreviousPage(): void {
    this.goToPage(this.currentPage - 1);
  }

  onSearchTermChange(): void {
    this.applyFiltersAndPagination();
  }

  openAssignCreditsModal(member: CompanyMember | null = null, type: 'ASSIGN_SINGLE' | 'ASSIGN_BULK' | 'EDIT_CREDITS_USER' = 'ASSIGN_SINGLE', initialCredits: number = 0, title = "", message = "", maxCredits = 0): void {
    this.selectedMemberForCredits = member;
    this.modalAssignCreditsType = type; 

    this.initialCredits = initialCredits;
    this.modalTitle = title;
    this.modalMessage = message;
    this.maxCredits = maxCredits;

    this.showAssignCreditsModal = true;
    this.showActionMenu = false;
  }

  closeAssignCreditsModal(): void {
    this.showAssignCreditsModal = false;
  }

  async onCreditsAssigned(credits: number): Promise<void> {

    let executeAction: () => Promise<void>;
    let title: string;
    let message: string;

    switch (this.modalAssignCreditsType) {
      case 'ASSIGN_SINGLE':
        if (!this.selectedMemberForCredits) return;
        executeAction = () => this.executeAssignCreditsSingle(this.selectedMemberForCredits!.id, credits);
        title = 'Confirmar Asignacion de Creditos';

        message = `¿Estás seguro de que deseas asignar ${credits} creditos a ${this.selectedMemberForCredits.fullName}?`;
        break;
      case 'ASSIGN_BULK':
        const memberIdsBulk = Array.from(this.selection);
        if (memberIdsBulk.length === 0) return;
        executeAction = () => this.executeAssignCreditsBulk(memberIdsBulk, credits);
        title = 'Confirmar Asignacion Masiva de Creditos'; 
        message = `¿Estás seguro de que deseas asignar ${credits} creditos a ${memberIdsBulk.length} miembros seleccionados?`;
        break;
      case 'EDIT_CREDITS_USER':
        if (!this.selectedMemberForCredits) return;
        executeAction = () => this.executeEditCreditsUser(this.selectedMemberForCredits!.id, credits);
        title = 'Confirmar Edicion de Creditos'; 
        message = `¿Estás seguro de que deseas establecer los creditos de ${this.selectedMemberForCredits.fullName} en ${credits}?`;
        break;
      default:
        console.error('Tipo de asignación de créditos desconocido:', this.modalAssignCreditsType);
        return;
    }

    this.openGenericConfirmation(title, message, this.selectedMemberForCredits!, executeAction);
    //this.selectedMemberForCredits = null;
  }

  private async executeAssignCreditsSingle(memberId: number, credits: number) {
    try {
      await this.companyDataService.assignCreditsToSingleMember(memberId, credits);
      const memberName = this.memberForAction?.fullName ?? 'el miembro';
      this.closeGenericConfirmation();
      this.closeAssignCreditsModal();
      this.handleSuccessfulAction(`Se asignaron ${credits} creditos a ${memberName} exitosamente.`);
      this.onboardingService.completeOnboardingStepByKey('ASSIGN_CREDITS'); 
      const member = this.data?.members.find(m => m.id === memberId);
      if (member && member.userId === this.currentUserId) {
        this.authService.refreshUserProfile();
      }
    } catch (err: any) {
      this.confirmationState.error = err.message || 'Error al asignar creditos.';
    }
  }

  private async executeAssignCreditsBulk(memberIds: number[], credits: number) {
    try {
      await this.companyDataService.assignCreditsToMembers(memberIds, credits);
      this.closeGenericConfirmation();
      this.closeAssignCreditsModal();
      this.handleSuccessfulAction(`Se asignaron ${credits} creditos a ${memberIds.length} miembros exitosamente.`);
      this.onboardingService.completeOnboardingStepByKey('ASSIGN_CREDITS'); 
      const currentUserAsMember = this.data?.members.find(m => m.userId === this.currentUserId);
      if (currentUserAsMember && memberIds.includes(currentUserAsMember.id)) {
        this.authService.refreshUserProfile();
      }
    } catch (err: any) {
      this.confirmationState.error = err.message || 'Error al asignar creditos masivos.';
    }
  }

  private async executeEditCreditsUser(memberId: number, credits: number) {
    try {
      await this.companyDataService.editMemberCredits(memberId, credits);
      this.closeGenericConfirmation();
      this.closeAssignCreditsModal();
      const memberName = this.memberForAction?.fullName ?? 'el miembro';
      this.handleSuccessfulAction(`Se editaron los creditos de ${memberName} a ${credits} exitosamente.`);
      this.onboardingService.completeOnboardingStepByKey('ASSIGN_CREDITS'); 

      const member = this.data?.members.find(m => m.id === memberId);
      if (member && member.userId === this.currentUserId) {
        this.authService.updateCurrentUserCredits(credits);
        this.authService.refreshUserProfile();
      }
      
    } catch (err: any) {
      this.confirmationState.error = err.message || 'Error al editar creditos.';
    }
  }

  openInviteUserModal(): void {
    this.showInviteUserModal = true;
    this.showActionMenu = false;
  }

  closeInviteUserModal(): void {
    this.showInviteUserModal = false;
  }

  handleInviteSuccess(email: string): void {
    this.showNotification('success', `Invitation successfully sent to ${email}.`);
  }

  openViewGeneratedCodesModal(): void {
    this.showViewGeneratedCodesModal = true;
    this.showActionMenu = false;
  }

  closeViewGeneratedCodesModal(): void {
    this.showViewGeneratedCodesModal = false;
  }

  distributionError: string | null = null;
  isDistributionLoading = false;

  openDistributeCreditsInputModal(mode: 'equitable' | 'rule-based'): void {
    if (!this.data) return;
    this.distributionError = null;
    this.isDistributionLoading = false;
    this.distributionModeForConfirmation = mode;
    this.showDistributeCreditsInputModal = true;
    this.showActionMenu = false;
  }

  closeDistributeCreditsInputModal(): void {
    this.showDistributeCreditsInputModal = false;
    this.creditsToDistributeForConfirmation = 0;
  }

  onCreditsInputDistribute(credits: number): void {
    this.creditsToDistributeForConfirmation = credits;
    this.distributionError = null;
    this.isDistributionLoading = true;
    this.openConfirmationModal();
  }

  openConfirmationModal(): void {
    this.showConfirmationModal = true;
    this.showActionMenu = false;
  }

  closeConfirmationModal(): void {
    this.showConfirmationModal = false;
  }

  async onConfirmationConfirm(): Promise<void> {
    this.closeConfirmationModal();
    if (!this.data) return;

    try {
      if (this.distributionModeForConfirmation === 'equitable') {
        await this.companyDataService.distributeEquitableCredits(
          this.creditsToDistributeForConfirmation
        );
        this.onboardingService.completeOnboardingStepByKey('ASSIGN_CREDITS'); 
      } else {
        await this.companyDataService.distributeRuleBasedCredits(
          this.creditsToDistributeForConfirmation
        );
        this.onboardingService.completeOnboardingStepByKey('ASSIGN_CREDITS'); 
      }
      this.closeDistributeCreditsInputModal();
      this.showNotification('success', 'Credits distributed successfully.');
      await this.fetchData();
      this.authService.refreshUserProfile();
    } catch (err: any) {
      this.distributionError = err.message || 'Failed to distribute credits.';
    } finally {
      this.isDistributionLoading = false;
    }
  }

  onConfirmationCancel(): void {
    this.isDistributionLoading = false;
    this.closeConfirmationModal();
  }

  openCreditHistoryModal(member: CompanyMember): void {
    this.selectedMemberForHistory = member;
    this.showCreditHistoryModal = true;
    this.showActionMenu = false; 
  }

  closeCreditHistoryModal(): void {
    this.showCreditHistoryModal = false;
    this.selectedMemberForHistory = null;
  }

  openEditPriorityModal(member: CompanyMember): void {
    this.selectedMemberForPriorityEdit = member;
    this.showEditPriorityModal = true;
    this.showActionMenu = false; 
  }

  closeEditPriorityModal(): void {
    this.showEditPriorityModal = false;
  }

  async onPriorityEdited(newPriority: number): Promise<void> {
   
    if (!this.selectedMemberForPriorityEdit) return;

    const member = this.selectedMemberForPriorityEdit;
    const title = 'Confirmar Cambio de Prioridad';
    const message = `¿Está seguro que desea cambiar la prioridad de ${member.fullName} de ${member.distributionPriority} a ${newPriority}?`;
   
    this.openGenericConfirmation(title, message, member, () => this.executeEditPriority(member.id, newPriority));
  }

  private async executeEditPriority(memberId: number, newPriority: number): Promise<void> {
    try {
      await this.companyDataService.updateMemberDistributionPriority(memberId, newPriority);
      this.closeGenericConfirmation();
      this.closeEditPriorityModal();
      this.handleSuccessfulAction(`La prioridad de ${this.selectedMemberForPriorityEdit?.fullName} se actualizó correctamente a ${newPriority}.`);
      this.selectedMemberForPriorityEdit = null;
    } catch (err: any) {
      this.confirmationState.error = err.message || 'Error al actualizar la prioridad.';
    }
  }

  openGenericConfirmation(
    title: string,
    message: string,
    member: CompanyMember,
    action: () => Promise<void>
  ) {
    this.confirmationState = {
      show: true,
      title,
      message,
      isLoading: false,
      error: null,
      confirmAction: action,
    };
    this.memberForAction = member;
    this.showActionMenu = false;
  }

  async onGenericConfirm() {
    this.confirmationState.isLoading = true;
    this.confirmationState.error = null;
    try {
      await this.confirmationState.confirmAction();
    } catch (err: any) {
      this.confirmationState.error = err.message || 'An unknown error occurred.';
    } finally {
      this.confirmationState.isLoading = false;
    }
  }

  closeGenericConfirmation() {
    this.confirmationState.show = false;
    this.memberForAction = null;
  }

  private async handleSuccessfulAction(message: string) {
    this.showNotification('success', message);
    
    await this.fetchData();
    
    if (this.data?.companyData?.credits !== undefined) {
      this.authService.updateCompanyCredits(this.data.companyData.credits);
    }
  }

  private async executeDeleteMember() {
    if (!this.memberForAction) return;
    await this.companyDataService.deleteCompanyMember(this.memberForAction.id);
    this.closeGenericConfirmation();
    this.handleSuccessfulAction(
      `El miembro ${this.memberForAction.fullName} ha sido eliminado exitosamente.`
    );
  }

  private async executeToggleMemberStatus() {
    if (!this.memberForAction) return;
    const memberName = this.memberForAction.fullName;
    const currentStatus = this.memberForAction.isActive;

    await this.companyDataService.toggleCompanyMemberStatus(this.memberForAction.id);
    this.closeGenericConfirmation();
    this.handleSuccessfulAction(
      `El miembro ${memberName} ha sido ${currentStatus ? 'desactivado' : 'activado'} exitosamente.`
    );
  }

  private async executeWithdrawAllCredits() {
    if (!this.memberForAction) return;
    const memberName = this.memberForAction.fullName;
    const affectedUserId = this.memberForAction.userId;

    await this.companyDataService.withdrawAllCreditsFromMember(this.memberForAction.id);
    this.closeGenericConfirmation();
    this.handleSuccessfulAction(
      `Todos los creditos han sido retirados de ${memberName} exitosamente.`
    );

    if (affectedUserId === this.currentUserId) {
      this.authService.updateCurrentUserCredits(0);
    }
  }

  private async executeChangeRole(newRole: 'ADMIN' | 'MEMBER') {
    if (!this.memberForAction) return;
    const memberName = this.memberForAction.fullName;

    if (newRole === 'ADMIN') {
      await this.companyDataService.changeMemberRoleToAdmin(this.memberForAction.id);
    } else {
      await this.companyDataService.changeMemberRoleToMember(this.memberForAction.id);
    }
    this.closeGenericConfirmation();
    this.handleSuccessfulAction(
      `El rol de ${memberName} ha sido cambiado a ${newRole} exitosamente.`
    );
  }

  getActionMenuOptions(member: CompanyMember): ActionMenuItem[] {
    const options: ActionMenuItem[] = [];

    options.push({
      labelKey: member.isActive
        ? 'ADMIN_USERS.DEACTIVATE_USER'
        : 'ADMIN_USERS.ACTIVATE_USER',
      icon: member.isActive ? 'fas fa-user-slash' : 'fas fa-user-check',
      action: (m) => {
        const actionType = m.isActive ? 'desactivar' : 'activar';
        const title = `Confirmar ${actionType} usuario`; 
        const message = `¿Estás seguro de que deseas ${actionType} a ${m.fullName}?`; 
        this.openGenericConfirmation(title, message, m, () => this.executeToggleMemberStatus());
      },
      show: member.userId !== this.currentUserId, 
    });

    options.push({
      labelKey: 'ADMIN_USERS.ASSIGN_CREDITS_SINGLE',
      icon: 'fas fa-coins',
      action: (m) => this.openAssignCreditsModal(m, 'ASSIGN_SINGLE', 0, 'SUB_MGMT.ASSIGN_CREDITS_MODAL_TITLE', 'SUB_MGMT.ASSIGN_CREDITS_MODAL_MESSAGE', this.data?.companyData?.credits ?? 0), 
      show: true,
    });

    options.push({
      labelKey: 'ADMIN_USERS.WITHDRAW_ALL_CREDITS',
      icon: 'fas fa-minus-circle',
      action: (m) => {
        const title = 'Confirmar Retiro de Creditos'; 
        const message = `¿Estás seguro de que deseas retirar todos los creditos de ${m.fullName}? Sus creditos se resetearan a cero.`; 
        this.openGenericConfirmation(title, message, m, () => this.executeWithdrawAllCredits());
      },
      show: true,
    });

    options.push({
      labelKey: 'ADMIN_USERS.EDIT_CREDITS',
      icon: 'fas fa-edit',
      action: (m) => this.openAssignCreditsModal(m, 'EDIT_CREDITS_USER', m.creditsAllocated ?? 0, 'SUB_MGMT.EDIT_CREDITS_MODAL_TITLE', 'SUB_MGMT.EDIT_CREDITS_MODAL_MESSAGE',
        ((this.data?.companyData?.credits ?? 0) + (m.creditsAllocated))
      ),
      show: true,
    });

    options.push({
      labelKey: 'ADMIN_USERS.VIEW_CREDIT_HISTORY',
      icon: 'fas fa-history',
      action: (m) => this.openCreditHistoryModal(m),
      show: true,
    });

    options.push({ 
      labelKey: 'ADMIN_USERS.EDIT_PRIORITY', 
      icon: 'fas fa-sort-numeric-up', 
      action: (m) => this.openEditPriorityModal(m),
      show: true,
    });

    if (member.userId !== this.currentUserId) { 
      if (member.role === 'ADMIN') {
        options.push({
          labelKey: 'ADMIN_USERS.CHANGE_ROLE_TO_MEMBER',
          icon: 'fas fa-user-minus',
          action: (m) => {
            const title = 'Confirmar cambio de rol'; 
            const message = `¿Estás seguro de que deseas cambiar el rol de ${m.fullName} a Miembro?`;
            this.openGenericConfirmation(title, message, m, () => this.executeChangeRole('MEMBER'));
          },
          show: true, 
        });
      } else {
        options.push({
          labelKey: 'ADMIN_USERS.CHANGE_ROLE_TO_ADMIN',
          icon: 'fas fa-user-plus',
          action: (m) => {
            const title = 'Confirmar cambio de rol';
            const message = `¿Estás seguro de que deseas cambiar el rol de ${m.fullName} a Administrador?`; 
            this.openGenericConfirmation(title, message, m, () => this.executeChangeRole('ADMIN'));
          },
          show: true,
        });
      }
    }

    options.push({
      labelKey: 'ADMIN_USERS.DELETE_USER',
      icon: 'fas fa-trash-alt',
      action: (m) => {
        const title = 'Confirm Deletion'; 
        const message = `Are you sure you want to delete ${m.fullName}? This action cannot be undone.`; 
        this.openGenericConfirmation(title, message, m, () => this.executeDeleteMember());
      },
      show: member.userId !== this.currentUserId, 
    });

    return options.filter((option) => option.show);
  }

  toggleActionMenu(event: MouseEvent, member: CompanyMember): void {
    event.stopPropagation();
    const button = event.currentTarget as HTMLElement;

    if (this.activeActionMenuMember?.id === member.id && this.showActionMenu) {
      this.showActionMenu = false;
      this.activeActionMenuMember = null;
    } else {
      this.activeActionMenuMember = member;
      this.currentActionMenuOptions = this.getActionMenuOptions(member); // Calcular y almacenar las opciones
      this.showActionMenu = true;

      setTimeout(() => {
        if (!this.actionMenu || !this.actionMenu.nativeElement) return;
        const menuEl = this.actionMenu.nativeElement;
        const rect = button.getBoundingClientRect();
        const menuHeight = menuEl.offsetHeight;
        const menuWidth = menuEl.offsetWidth;

        let top = rect.bottom + window.scrollY;
        let left = rect.right + window.scrollX - menuWidth;

        if (top + menuHeight > window.innerHeight + window.scrollY) {
          top = rect.top + window.scrollY - menuHeight;
        }
        if (left < 0) left = 10;

        this.menuPosition = { top: `${top}px`, left: `${left}px` };
      }, 0);
    }
  }

  generateFakeUsers(count: number, startingId: number = 1): CompanyMember[] {
    const fakeUsers: CompanyMember[] = [];
    for (let i = 0; i < count; i++) {
      const id = startingId + i;
      fakeUsers.push({
        id: id,
        fullName: `Usuario Falso ${id}`,
        email: `fake.user${id}@example.com`,
        role: id % 5 === 0 ? 'ADMIN' : 'MEMBER', 
        creditsAllocated: Math.floor(Math.random() * 1000) + 100,
        isActive: id % 3 !== 0, 
        userId: id + 1000,
        distributionPriority: id,
      });
    }
    return fakeUsers;
  }


}