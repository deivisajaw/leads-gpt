import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const rootGuard: CanActivateFn = () => {
  const token = localStorage.getItem('csrfToken');
  const router = inject(Router);

  if (token) {
    router.navigateByUrl('/dashboard');
    return false;
  }

  return true;
};
