import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const guestGuard: CanActivateFn = (route, state) => {
  const token = localStorage.getItem('csrfToken');
  if (token) {
    const router = inject(Router);
    router.navigateByUrl('/dashboard');
    return false;
  }
  return true;
};
