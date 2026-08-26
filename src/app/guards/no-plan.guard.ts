import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { map } from 'rxjs/operators';

export const noPlanGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.userProfile$.pipe(
    map(userProfile => {
      const hasSubscription = !!userProfile?.companyProfile?.subscription;
      if (!hasSubscription) {
        return true;
      } else {
        return router.createUrlTree(['/dashboard']); 
      }
    })
  );
};