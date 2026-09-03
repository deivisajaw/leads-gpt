import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Puerta de las páginas de pago (AI CRM, etc.).
 *
 * Antes leía el perfil de forma síncrona. En una carga en frío —abrir /deals
 * directamente, o recargar estando ahí— el perfil todavía no había llegado, así
 * que la puerta lo tomaba como "sin suscripción" y rebotaba a /upgrade-plan.
 * Desde dentro de la app funcionaba porque el perfil ya estaba en memoria; por
 * eso sólo fallaba al recargar.
 *
 * Ahora esperamos el perfil antes de decidir. fetchUserProfile() ya reutiliza la
 * petición en curso, así que esto no añade una llamada extra.
 */
export const premiumPlanGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.currentUserProfile) {
    try {
      await authService.fetchUserProfile();
    } catch {
      // No pudimos saber el plan (red caída, sesión vencida). Se cierra, igual
      // que antes de este cambio: authGuard, que corre en la ruta padre, ya
      // manda al login si la sesión murió de verdad.
      router.navigate(['/upgrade-plan']);
      return false;
    }
  }

  if (authService.hasPaidSubscription) return true;

  router.navigate(['/upgrade-plan']);
  return false;
};
