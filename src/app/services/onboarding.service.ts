import { Injectable } from '@angular/core';
import { ApiConfigService } from './api-config.service';
import { AuthService } from './auth.service';
import { OnboardingStepStatus } from '../models/user-profile.model';
import { fetchWithTimeout } from './http-timeout';

@Injectable({
  providedIn: 'root'
})
export class OnboardingService {

  constructor(
    private apiConfig: ApiConfigService,
    private authService: AuthService
  ) { }

  async completeOnboardingStepByKey(stepKey: string): Promise<any> {
   
    const step = this.getStepByKey(stepKey);
    if (!step) {
      console.warn(`Onboarding: Se intentó completar un paso con clave '${stepKey}', pero no se encontró en el perfil del usuario. Revisa la configuración en la base de datos.`);
      return;
    }

    // Si el paso ya está completado, no se hace la llamada al backend.
    if (step.isCompleted) {
      return;
    }

    const token = localStorage.getItem('csrfToken');
    if (!token) { throw new Error('No authentication token found'); }

    const action = 'com.ajawmrp3.apps.prospectingai.service.OnboardingService:completeOnboardingStep';
    const data = { _stepKey: stepKey };

    try {
      const response = await fetchWithTimeout(`${this.apiConfig.baseUrl}/ws/action`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': token
        },
        body: JSON.stringify({ action, data })
      });

      if (!response.ok) { throw new Error(`HTTP error! status: ${response.status}`); }

      const result = await response.json();
      if (result.data?.error) { throw new Error(result.data.message || 'Unknown error from API'); }

      // 2. Éxito en el backend -> actualizamos el estado en el frontend usando el ID del paso.
      this.authService.updateOnboardingStepStatus(step.id);

      // 3. Si el paso da créditos, refrescamos todo el perfil para ver el nuevo balance.
      if (step.rewardCredits > 0) {
        await this.authService.refreshUserProfile();
      }

      return result.data;

    } catch (error) {
      console.error(`Error completing onboarding step with key '${stepKey}':`, error);
      throw error;
    }
  }

  public getStepByKey(key: string): OnboardingStepStatus | null {
    const profile = this.authService.currentUserProfile;
    return profile?.onboardingStatus?.find(s => s.stepKey === key) || null;
  }
}