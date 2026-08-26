import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { map } from 'rxjs/operators';

export const canAccessPlansGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.userProfile$.pipe(
    map(() => {
      if (!authService.hasPaidSubscription) {
        return true; 
      } else {
        router.navigate(['/subscription-management']);
        return false;
      }
    })
  );
};