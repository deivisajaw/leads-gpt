import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { DirectorioRedirectService } from '../services/directorio-redirect.service';

export const guestGuard: CanActivateFn = (route, state) => {
  const directorioRedirect = inject(DirectorioRedirectService);
  directorioRedirect.capture(route.queryParams);

  const token = localStorage.getItem('csrfToken');
  if (token) {
    const router = inject(Router);
    const nav = directorioRedirect.getRedirectNavigation();
    if (nav) {
      router.navigate(nav.commands, nav.extras);
    } else {
      router.navigateByUrl('/dashboard');
    }
    return false;
  }
  return true;
};