import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { PlanService } from '../../services/plan.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../services/auth.service'; 
import { PaymentService } from '../../services/payment.service'; 
import { Subject, takeUntil } from 'rxjs'; 
import { PaymentLinkModalComponent } from '../../components/shared/payment-link-modal/payment-link-modal.component'; 
import { LoadingModalComponent } from '../../components/shared/loading-modal/loading-modal.component'; 

export interface Plan {
  id: number;
  name: string;
  description: string;
  pricePerMonth: string;
  pricePerYear: string;
  creditsPerUserPerYear: number;
  features: string[];
  paymentLink: string | null;
  saleCurrency: string;
  popular?: boolean; 
  note?: string; 
}

interface Faq {
  q: string;
  a: string;
  open: boolean;
}

@Component({
  selector: 'app-plans',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, PaymentLinkModalComponent, LoadingModalComponent],
  templateUrl: './plans.component.html',
  styleUrls: ['./plans.component.css'],
  providers: [PlanService]
})
export class PlansComponent implements OnInit, OnDestroy { 

  @Input() hideFreePlan: boolean = false;

  // isLoading: boolean = false; 
  private ngUnsubscribe = new Subject<void>(); 

  showPaymentModal: boolean = false; 
  paymentLinkToShow: string | null = null; 
  showLoadingModal: boolean = false; 
  Math = Math;

  constructor(
    private planService: PlanService,
    private authService: AuthService,
    private paymentService: PaymentService 
  ) {}

  billingCycle: 'monthly' | 'annual' = 'annual';
  users: number = 1;
  selectedPlan: Plan = {
    id: 0,
    name: '',
    description: '',
    pricePerMonth: '0',
    pricePerYear: '0',
    creditsPerUserPerYear: 0,
    features: [],
    paymentLink: null,
    saleCurrency: 'USD'
  };
  totalCost: number = 0;
  currentPlanId: number = 1; 

  plans: Plan[] = [];

  faqs: Faq[] = [
    { q: 'PLANS.FAQ_1_Q', a: 'PLANS.FAQ_1_A', open: false },
    { q: 'PLANS.FAQ_2_Q', a: 'PLANS.FAQ_2_A', open: false },
    { q: 'PLANS.FAQ_3_Q', a: 'PLANS.FAQ_3_A', open: false },
    { q: 'PLANS.FAQ_4_Q', a: 'PLANS.FAQ_4_A', open: false },
    { q: 'PLANS.FAQ_5_Q', a: 'PLANS.FAQ_5_A', open: false },
    { q: 'PLANS.FAQ_6_Q', a: 'PLANS.FAQ_6_A', open: false }
  ];

  get visiblePlans(): Plan[] {
    if (this.hideFreePlan) {
      return this.plans.filter(p => parseFloat(p.pricePerMonth) > 0);
    }
    return this.plans;
  }

  get isFreePlanSelected(): boolean {
    if (!this.selectedPlan) {
      return false;
    }
    return parseFloat(this.selectedPlan.pricePerMonth) === 0;
  }

  ngOnInit(): void {
    this.loadPlans();
  }

  async loadPlans(): Promise<void> {
    try {
      const response = await this.planService.getPlans();
      if (!response.error) {
        const sortedPlans = response.planes.sort((a: Plan, b: Plan) => {
          return parseFloat(a.pricePerMonth) - parseFloat(b.pricePerMonth);
        });

        this.plans = sortedPlans;

        this.plans.forEach(p => {
          if (p.name === 'Profesional') {
            p.popular = true;
          }
        });

        this.selectedPlan = this.plans.find(p => p.id === this.currentPlanId) || this.plans[0];
        this.updateTotalCost();
      }
    } catch (error) {
      console.error('Error loading plans:', error);
    }
  }

  setBillingCycle(cycle: 'monthly' | 'annual'): void {
    this.billingCycle = cycle;
    this.updateTotalCost();
  }

  getPrice(plan: Plan): number {
    const price = this.billingCycle === 'monthly' ? plan.pricePerMonth : plan.pricePerYear;
    return parseFloat(price);
  }

  getCardDisplayPrice(plan: Plan): number {
    if (this.billingCycle === 'annual') {
      return parseFloat(plan.pricePerYear) / 12;
    }
    return parseFloat(plan.pricePerMonth);
  }

  getRoundedPrice(plan: Plan): number {
    const rawPrice = this.getCardDisplayPrice(plan);
    return Math.round(rawPrice);
  }

  selectPlan(plan: Plan): void {
    if (plan.id === this.currentPlanId) return;
    this.selectedPlan = plan;
    this.updateTotalCost();
  }

  updateUsers(): void {
    if (this.users < 1) {
      this.users = 1;
    }
    this.updateTotalCost();
  }

  incrementUsers(): void {
    this.users++;
    this.updateTotalCost();
  }

  decrementUsers(): void {
    if (this.users > 1) {
      this.users--;
      this.updateTotalCost();
    }
  }

  updateTotalCost(): void {
    if (!this.selectedPlan) return;
    const pricePerUser = this.getPrice(this.selectedPlan);
    const multiplier = this.billingCycle === 'annual' ? 1 : 1; 
    this.totalCost = this.users * pricePerUser * multiplier;
  }

  getButtonText(plan: Plan): string {
    if (plan.id === this.currentPlanId) {
      return 'PLANS.CURRENT_PLAN';
    }
    if (plan.id === this.selectedPlan.id) {
      return 'PLANS.SELECTED';
    }
    return 'PLANS.SELECT_PLAN';
  }

  getButtonClass(plan: Plan): string {
    if (plan.id === this.currentPlanId) {
      return 'current';
    }
    if (plan.id === this.selectedPlan.id) {
      return 'selected';
    }
    return 'select';
  }

  toggleFaq(index: number): void {
    this.faqs[index].open = !this.faqs[index].open;
  }

  redirectToPayment(): void {
        if (!this.selectedPlan) {
          console.error('No hay un plan seleccionado.');
          return;
        }

        this.showLoadingModal = true; 

        const userProfile = this.authService.currentUserProfile;
        if (!userProfile || !userProfile.userId || !userProfile.username) {
          console.error('No se pudo obtener la información del usuario para el pago.');
          this.showLoadingModal = false;
          // Aquí podrías redirigir al login o mostrar un mensaje al usuario
          return;
        }

        /*const payload = {
          userId: userProfile.userId,
          userEmail: userProfile.email,
          transactionType: 'SUBSCRIPTION_CREATED', 
          planDetails: {
            planId: this.selectedPlan.id,
            userCount: this.users,
            billingCycle: this.billingCycle.toUpperCase() 
          }
        };*/

        const payload = {
          userId: userProfile.userId,
          transactionType: 'SUBSCRIPTION_CREATED', 
          quantity: this.users,
          billingCycle: this.billingCycle.toLowerCase(),
          planId: this.selectedPlan.id
        };

        this.paymentService.createPaymentLink(payload)
          .pipe(takeUntil(this.ngUnsubscribe)) 
          .subscribe({
            next: (response) => {
              console.log(response)
                  this.showLoadingModal = false; 
                  this.paymentLinkToShow = response.url;
                  this.showPaymentModal = true; 
                },
                error: (error) => {
                  this.showLoadingModal = false; 
                  console.error('Error al generar el enlace de pago:', error);
                  // Aquí podrías mostrar un mensaje de error al usuario
                }
          });
      }

      ngOnDestroy(): void {
        this.ngUnsubscribe.next();
        this.ngUnsubscribe.complete();
      }
    }