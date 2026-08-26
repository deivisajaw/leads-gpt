import {
  Component,
  OnInit,
  OnDestroy,
  NgZone,
  ElementRef,
  Renderer2,
  HostListener,
  ChangeDetectorRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { Subject } from 'rxjs';
import { filter, takeUntil, take } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { AsideEventsService } from '../../services/aside-events.service';
import { UserProfile } from '../../models/user-profile.model';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { PlansComponent } from '../../pages/plans/plans.component';

interface OnboardingStep {
  stepKey: string;
  isCompleted: boolean;
  completedAt?: Date;
}

interface OnboardingStepConfig {
  overlay: {
    elementSelector: string;
    message: string;
    tooltipPosition: 'right' | 'left' | 'top' | 'bottom';
    parentSelector?: string;
    parentMessage?: string;
    tooltipOffsetY?: number;
    tooltipOffsetY_child?: number;
  };
  inPage: {
    message: string;
    position?: 'top' | 'bottom'; 
  };
  actionRoute: string;
}

@Component({
  selector: 'app-onboarding-guide',
  standalone: true,
  imports: [CommonModule, TranslateModule, PlansComponent],
  templateUrl: './onboarding-guide.component.html',
  styleUrls: ['./onboarding-guide.component.css'],
})
export class OnboardingGuideComponent implements OnInit, OnDestroy {
  // --- Template References ---
  @ViewChild('overlayTooltip') overlayTooltipRef!: ElementRef<HTMLDivElement>;
  @ViewChild('inPageTooltip') inPageTooltipRef!: ElementRef<HTMLDivElement>;

  // --- Visibility Controls ---
  showOverlay = false;
  showInPageTooltip = false;

  // --- Tooltip Properties ---
  overlayTooltipMessage = '';
  inPageTooltipMessage = '';
  styleOverlayTooltip: any = {};
  styleInPageTooltip: any = {};
  styleOverlayArrow: any = {};
  styleInPageArrow: any = {};
  currentStepNumber = 0;
  totalSteps = 0;

  // --- Overlay Layer Styles ---
  styleTop: any = {};
  styleBottom: any = {};
  styleLeft: any = {};
  styleRight: any = {};

  // --- Plans Modal Properties ---
  showPlansModal = false;
  private PLANS_MODAL_STATUS_KEY = 'plansModalStatusByUser';
  private hasCheckedPlansModal = false;
  
  // --- Temporary Disable Properties ---
  private isTemporarilyDisabled = false;

  // --- Private properties ---
  private destroy$ = new Subject<void>();
  private stepConfigs = new Map<string, OnboardingStepConfig>();
  private currentStep: OnboardingStep | null = null;
  private targetElement: HTMLElement | null = null;
  private originalTargetStyles: { zIndex: string; pointerEvents: string; position: string; } | null = null;

  constructor(
    private authService: AuthService,
    private router: Router,
    private ngZone: NgZone,
    private renderer: Renderer2,
    private cdr: ChangeDetectorRef,
    private asideEventsService: AsideEventsService,
    private translate: TranslateService
  ) {}

  ngOnInit(): void {
    this.initializeStepConfigs();

    this.authService.userProfile$
      .pipe(takeUntil(this.destroy$))
      .subscribe((profile) => {
        if (profile) {
          this.evaluateOnboardingState(profile);
        }
      });

    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        // Resetear la desactivación temporal al cambiar de ruta
        this.isTemporarilyDisabled = false;
        
        if (this.authService.currentUserProfile) {
          this.evaluateOnboardingState(this.authService.currentUserProfile);
        }
      });

    this.asideEventsService.submenuToggled$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        // Resetear la desactivación temporal al abrir/cerrar submenus
        this.isTemporarilyDisabled = false;
        
        if (this.authService.currentUserProfile) {
          this.evaluateOnboardingState(this.authService.currentUserProfile);
        }
      });
  }

  private initializeStepConfigs(): void {
    this.stepConfigs.set('CONFIGURE_PROFILE', {
      overlay: {
        elementSelector: '[data-stepKey="CONFIGURE_PROFILE"]',
        message: 'ONBOARDING_GUIDE.CONFIGURE_PROFILE_OVERLAY_MESSAGE',
        tooltipPosition: 'right',
        tooltipOffsetY: -25,
        tooltipOffsetY_child: 0,
      },
      inPage: {
        message: 'ONBOARDING_GUIDE.CONFIGURE_PROFILE_INPAGE_MESSAGE', 
        position: 'bottom',
      },
      actionRoute: '/userconfig',
    });
    
    this.stepConfigs.set('ASSIGN_CREDITS', {
      overlay: {
        elementSelector: '[data-stepKey="ASSIGN_CREDITS"]', 
        message: 'ONBOARDING_GUIDE.ASSIGN_CREDITS_OVERLAY_MESSAGE', 
        tooltipPosition: 'right',
        parentSelector: '[data-stepKey="OPEN_SUBSCRIPTION_SETTINGS"]', 
        parentMessage: 'ONBOARDING_GUIDE.ASSIGN_CREDITS_PARENT_MESSAGE', 
        tooltipOffsetY: -25, 
        tooltipOffsetY_child: 5,
      },
      inPage: {
        message: 'ONBOARDING_GUIDE.ASSIGN_CREDITS_INPAGE_MESSAGE',
        position: 'bottom',
      },
      actionRoute: '/admin-users',
    });

    this.stepConfigs.set('FIND_LEADS', {
      overlay: { 
        elementSelector: '[data-stepKey="FIND_LEADS-SAVE_LEAD"]', 
        message: 'ONBOARDING_GUIDE.FIND_LEADS_OVERLAY_MESSAGE', 
        tooltipPosition: 'right',
        tooltipOffsetY: 5,
        tooltipOffsetY_child: 0,
      },
      inPage: {
         message: 'ONBOARDING_GUIDE.FIND_LEADS_INPAGE_MESSAGE',
        position: 'bottom',
      },
      actionRoute: '/people',
    });

    this.stepConfigs.set('SAVE_LEAD', {
      overlay: { 
        elementSelector: '[data-stepKey="FIND_LEADS-SAVE_LEAD"]', 
         message: 'ONBOARDING_GUIDE.SAVE_LEAD_OVERLAY_MESSAGE',
        tooltipPosition: 'right',
        tooltipOffsetY: 5, 
        tooltipOffsetY_child: 0,
      },
      inPage: {
         message: 'ONBOARDING_GUIDE.SAVE_LEAD_INPAGE_MESSAGE',
        position: 'top', 
      },
      actionRoute: '/people',
    });
    
    this.stepConfigs.set('REQUEST_PHONE_NUMBER', {
      overlay: {
        elementSelector: '[data-stepKey="REQUEST_PHONE_NUMBER"]',
         message: 'ONBOARDING_GUIDE.REQUEST_PHONE_NUMBER_OVERLAY_MESSAGE',
        tooltipPosition: 'right',
        tooltipOffsetY: 0, 
        tooltipOffsetY_child: 0,
      },
      inPage: {
        message: 'ONBOARDING_GUIDE.REQUEST_PHONE_NUMBER_INPAGE_MESSAGE',
        position: 'top',
      },
      actionRoute: '/phone-numbers',
    });
    
    this.stepConfigs.set('CREATE_AGENT', {
      overlay: {
        elementSelector: '[data-stepKey="CREATE_AGENT"]',
       message: 'ONBOARDING_GUIDE.CREATE_AGENT_OVERLAY_MESSAGE', 
        tooltipPosition: 'right',
        tooltipOffsetY: 0, 
        tooltipOffsetY_child: 0,
      },
      inPage: {
        message: 'ONBOARDING_GUIDE.CREATE_AGENT_INPAGE_MESSAGE',
        position: 'bottom',
      },
      actionRoute: '/agents',
    });

    this.stepConfigs.set('CREATE_CAMPAIGN', {
      overlay: {
        elementSelector: '[data-stepKey="CREATE_CAMPAIGN"]',
        message: 'ONBOARDING_GUIDE.CREATE_CAMPAIGN_OVERLAY_MESSAGE',
        tooltipPosition: 'right',
        tooltipOffsetY: -20,
        tooltipOffsetY_child: 0,
      },
      inPage: {
         message: 'ONBOARDING_GUIDE.CREATE_CAMPAIGN_INPAGE_MESSAGE',
        position: 'bottom',
      },
      actionRoute: '/campaigns',
    });
  }

  private evaluateOnboardingState(profile: UserProfile): void {
    // Si está temporalmente desactivado, no hacer nada
    if (this.isTemporarilyDisabled) {
      return;
    }

    const incompleteSteps = profile.onboardingStatus ?? [];
    const firstIncompleteStep = incompleteSteps.find(step => !step.isCompleted);
    
    this.currentStep = firstIncompleteStep || null;
    this.totalSteps = incompleteSteps.length;

    // Verificar si todos los pasos están completos
    const allStepsCompleted = incompleteSteps.length > 0 && incompleteSteps.every(step => step.isCompleted);

    // Si todos los pasos están completos, verificar si debe mostrar el modal de planes
    if (allStepsCompleted && !this.hasCheckedPlansModal) {
      this.hasCheckedPlansModal = true;
      this.checkAndShowPlansModal(profile);
      return;
    }

    if (!this.currentStep || this.totalSteps === 0) {
      this.hideGuide();
      return;
    }

    const currentIndex = incompleteSteps.findIndex(step => step.stepKey === this.currentStep!.stepKey);
    this.currentStepNumber = currentIndex + 1;

    const config = this.stepConfigs.get(this.currentStep.stepKey);

    if (!config) {
      this.hideGuide();
      return;
    }

    const isOnActionRoute = this.router.url.startsWith(config.actionRoute);

    if (isOnActionRoute) {
      this.showInPageGuide(config);
    } else {
      this.showOverlayGuide(config);
    }
  }

  private checkAndShowPlansModal(profile: UserProfile): void {
    // Verificar que el usuario tenga un plan FREE
    const isFreeUser = this.authService.hasFreeSubscription;
    
    if (!isFreeUser) {
      return; // Si no es usuario free, no mostrar el modal
    }

    // Verificar si el usuario ya vio el modal anteriormente
    const userId = profile.userId;
    if (!userId) {
      return;
    }

    const hasSeenModal = this.getHasSeenPlansModalLocally(userId);
    
    if (!hasSeenModal) {
      // Mostrar el modal solo si no lo ha visto antes
      this.showPlansModal = true;
      this.cdr.detectChanges();
    }
  }

  private showOverlayGuide(config: OnboardingStepConfig): void {
    this.hideGuide();
    this.ngZone.onStable.pipe(take(1)).subscribe(() => {
      let targetElementToHighlight: HTMLElement | null = null;
      let messageToDisplay: string = config.overlay.message;
      let tooltipPosition: 'right' | 'left' | 'top' | 'bottom' = config.overlay.tooltipPosition;
      let isTargetActuallyChild = false;

      const actualTargetElement = document.querySelector<HTMLElement>(config.overlay.elementSelector);

      if (actualTargetElement) {
          const parentSubmenuLi = actualTargetElement.closest('.nav-item.has-submenu');
          if (parentSubmenuLi) {
              isTargetActuallyChild = parentSubmenuLi.classList.contains('open');
          } else {
              isTargetActuallyChild = true;
          }
      }

      if (isTargetActuallyChild) {
        targetElementToHighlight = actualTargetElement;
      } else if (config.overlay.parentSelector) {
        const parentElement = document.querySelector<HTMLElement>(config.overlay.parentSelector);
        if (parentElement) {
          targetElementToHighlight = parentElement;
          messageToDisplay = config.overlay.parentMessage || config.overlay.message;
        }
      }

      if (targetElementToHighlight) {
        targetElementToHighlight.scrollIntoView({ behavior: 'smooth', block: 'center' });

        this.targetElement = targetElementToHighlight;
        this.overlayTooltipMessage = messageToDisplay;
        this.cdr.detectChanges();

        let tooltipOffsetToUse = isTargetActuallyChild
          ? (config.overlay.tooltipOffsetY_child || config.overlay.tooltipOffsetY || 0)
          : (config.overlay.tooltipOffsetY || 0);

        setTimeout(() => {
          if (this.targetElement) {
            this.calculateOverlayPositions(this.targetElement, tooltipPosition, tooltipOffsetToUse);
            this.showOverlay = true;
            this.cdr.detectChanges();
          }
        }, 400); 
      } else {
        this.hideGuide();
      }
    });
  }

  private showInPageGuide(config: OnboardingStepConfig): void {
    this.hideGuide();
    this.inPageTooltipMessage = config.inPage.message;
    
    const position = config.inPage.position || 'bottom';
    const baseStyle = {
      position: 'fixed',
      left: '50%',
      transform: 'translateX(-50%)',
      opacity: 1,
    };

    if (position === 'top') {
      this.styleInPageTooltip = { ...baseStyle, top: '20px' };
    } else {
      this.styleInPageTooltip = { ...baseStyle, bottom: '20px' };
    }

    this.styleInPageArrow = { display: 'none' };
    this.showInPageTooltip = true;
    this.cdr.detectChanges();
  }

  private calculateOverlayPositions(target: HTMLElement, tooltipPosition: string, tooltipOffsetY: number = 0): void {
    this.ngZone.onStable.pipe(take(1)).subscribe(() => {
      requestAnimationFrame(() => {
        const rect = target.getBoundingClientRect();

        this.styleTop = { top: '0', left: '0', width: '100vw', height: `${rect.top}px` };
        this.styleBottom = { top: `${rect.bottom}px`, left: '0', width: '100vw', height: `calc(100vh - ${rect.bottom}px)` };
        this.styleLeft = { top: `${rect.top}px`, left: '0', width: `${rect.left}px`, height: `${rect.height}px` };
        this.styleRight = { top: `${rect.top}px`, left: `${rect.right}px`, width: `calc(100vw - ${rect.right}px)`, height: `${rect.height}px` };

        if (!this.overlayTooltipRef) return;
        const tooltipRect = this.overlayTooltipRef.nativeElement.getBoundingClientRect();
        const gap = 15;
        const arrowSize = 12;
        let tooltipTop = 0, tooltipLeft = 0;

        if (tooltipPosition === 'right') {
            tooltipLeft = rect.right + gap;
            tooltipTop = rect.top + rect.height / 2 - tooltipRect.height / 2 + 45 + tooltipOffsetY;
            this.styleOverlayArrow = { top: '50%', left: `-${arrowSize / 2}px`, transform: 'translateY(-50%) rotate(45deg)' };
        }
        this.styleOverlayTooltip = { top: `${tooltipTop}px`, left: `${tooltipLeft}px`, opacity: 1 };
        this.cdr.detectChanges();
      });
    });
  }

  private hideGuide(): void {
    if (this.targetElement && this.originalTargetStyles) {
      this.renderer.setStyle(this.targetElement, 'z-index', this.originalTargetStyles.zIndex);
      this.renderer.setStyle(this.targetElement, 'pointer-events', this.originalTargetStyles.pointerEvents);
      this.renderer.setStyle(this.targetElement, 'position', this.originalTargetStyles.position);
      this.targetElement = null;
      this.originalTargetStyles = null;
    }
    if (this.showOverlay || this.showInPageTooltip) {
      this.showOverlay = false;
      this.showInPageTooltip = false;
      this.styleOverlayTooltip = {};
      this.styleInPageTooltip = {};
      this.styleOverlayArrow = {};
      this.styleInPageArrow = {};
      this.cdr.detectChanges();
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    if (this.showOverlay && this.targetElement && this.currentStep) {
      const config = this.stepConfigs.get(this.currentStep.stepKey);
      if (config) {
        this.calculateOverlayPositions(this.targetElement, config.overlay.tooltipPosition);
      }
    }
  }

  // --- Plans Modal LocalStorage Methods (similar a dashboard-home) ---
  private getPlansModalStatusMap(): { [userId: number]: boolean } {
    const stored = localStorage.getItem(this.PLANS_MODAL_STATUS_KEY);
    return stored ? JSON.parse(stored) : {};
  }

  private updateUserPlansModalStatusLocally(userId: number, status: boolean): void {
    const statusMap = this.getPlansModalStatusMap();
    statusMap[userId] = status;
    localStorage.setItem(this.PLANS_MODAL_STATUS_KEY, JSON.stringify(statusMap));
  }

  private getHasSeenPlansModalLocally(userId: number): boolean {
    const statusMap = this.getPlansModalStatusMap();
    return statusMap[userId] || false;
  }

  closePlansModal(): void {
    this.showPlansModal = false;
    const userId = this.authService.currentUserProfile?.userId;
    if (userId) {
      this.updateUserPlansModalStatusLocally(userId, true);
    }
    this.cdr.detectChanges();
  }

  closeOverlayTemporarily(): void {
    this.isTemporarilyDisabled = true;
    this.hideGuide();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.hideGuide();
    // Resetear la bandera para que se reactive en la próxima carga del componente
    this.isTemporarilyDisabled = false;
  }
}
