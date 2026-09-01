import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { PlanService } from '../../services/plan.service';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { Plan } from '../plans/plans.component';
import { CurrencyService } from '../../services/currency.service';


@Component({
  selector: 'app-plans-list',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './plans-list.component.html',
  styleUrls: ['./plans-list.component.css'],
  providers: [PlanService]
})
export class PlansListComponent implements OnInit {
  public currency = inject(CurrencyService);
 
  

  constructor(
    private planService: PlanService, 
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
    const multiplier = this.billingCycle === 'annual' ? 1 : 1; // El precio anual ya es el total
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


  /** "≈ $1.268.096 COP" — vacío si el cliente ya está en USD. */
  approxPrice(plan: any): string {
    return this.currency.approx(this.getRoundedPrice(plan));
  }
}
