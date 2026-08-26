import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';

import { premiumPlanGuard } from './premium-plan.guard';

describe('premiumPlanGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) => 
      TestBed.runInInjectionContext(() => premiumPlanGuard(...guardParameters));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});
