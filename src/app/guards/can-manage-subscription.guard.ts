import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { map } from 'rxjs/operators';

export const canManageSubscriptionGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.userProfile$.pipe(
    map(() => {
      const hasSubscription = authService.hasAnySubscription; 

      const isAdmin = authService.isAdmin;

      if (hasSubscription && isAdmin) {
        return true; 
      } 
      
      if (hasSubscription && !isAdmin) {
        router.navigate(['/my-plan']); 
        return false;
      }

      router.navigate(['/plans']);
      return false;
    })
  );
};