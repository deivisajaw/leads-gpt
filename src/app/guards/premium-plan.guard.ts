import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const premiumPlanGuard: CanActivateFn = (route, state) => {
  
  const authService = inject(AuthService);
  const router = inject(Router);

  const userProfile = authService.currentUserProfile;
  
  if (authService.hasPaidSubscription) {
      return true;
  } else {
      router.navigate(['/upgrade-plan']);
      return false;
  }
};