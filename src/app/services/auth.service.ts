import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiConfigService } from './api-config.service';
import { LanguageService } from './language.service';
import { UserProfile } from '../models/user-profile.model';
import { DirectorioRedirectService } from './directorio-redirect.service';

declare const clarity: any;

export interface OnboardingQuestion {
  id: number;
  description: string;
  questionType: string;
  required: boolean;
  priority: number;
  category?: string;
  subtitle?: string;
  options: { id: number; description: string; iconClass: string; }[];
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private userProfileSubject = new BehaviorSubject<UserProfile | null>(null);
  public userProfile$ = this.userProfileSubject.asObservable();

  private ongoingProfileFetch: Promise<UserProfile> | null = null;

  constructor(
    private router: Router,
    public apiConfig: ApiConfigService,
    private languageService: LanguageService,
    private http: HttpClient,
    private directorioRedirect: DirectorioRedirectService
  ) { }

  getOnboardingQuestions(): Observable<{ error: boolean, questions?: OnboardingQuestion[], message?: string }> {
    const tenantId = 'db8';

    const headers = new HttpHeaders({
      'Cookie': `TENANTID=${tenantId}`
    });

    // Llama al nuevo endpoint público. withCredentials: true es importante para otras cookies.
    return this.http.get<any>(`${this.apiConfig.baseUrl}/ws/public/onboarding/questions`, { headers, withCredentials: true })
      .pipe(
        map(response => {
          if (response && !response.error) {
            return { error: false, questions: response.questions as OnboardingQuestion[] };
          } else {
            console.error('Backend error in getOnboardingQuestions:', response?.message);
            return { error: true, message: response?.message || 'Error al cargar las preguntas del onboarding' };
          }
        }),
        catchError(error => {
          console.error('HTTP error in getOnboardingQuestions:', error);
          return of({ error: true, message: 'Error de conexión al cargar las preguntas del onboarding' });
        })
      );
  }

  ensureProfileLoaded(): Promise<boolean> {

    if (this.ongoingProfileFetch) {
      return this.ongoingProfileFetch.then(p => !!p).catch(() => false);
    }

    if (this.currentUserProfile) {
      return Promise.resolve(true);
    }

    const csrfToken = localStorage.getItem('csrfToken');
    if (!csrfToken) {
      return Promise.resolve(false);
    }

    return this.fetchUserProfile()
      .then(profile => !!profile)
      .catch(() => false);
  }

  async login(username: string, password: string, navigate = true): Promise<void> {
    const body = new URLSearchParams();
    body.append('username', username);
    body.append('password', password);

    try {
      const response = await fetch(`${this.apiConfig.baseUrl}/login.jsp`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error('Login fallido: ' + error);
      }

      const csrfToken = response.headers.get('X-CSRF-Token');
      if (!csrfToken) {
        throw new Error('Token CSRF no recibido');
      }

      localStorage.setItem('csrfToken', csrfToken);
      await this.fetchUserProfile();
      if (navigate) {
        const nav = this.directorioRedirect.getRedirectNavigation();
        if (nav) {
          this.router.navigate(nav.commands, nav.extras);
        } else {
          this.router.navigate(['/dashboard']);
        }
      }

    } catch (error) {
      console.error('AuthService: Login failed', error);
      this.clearSession();
      throw error;
    }
  }

  fetchUserProfile(): Promise<UserProfile> {
    if (this.ongoingProfileFetch) {
      return this.ongoingProfileFetch;
    }

    const csrfToken = localStorage.getItem('csrfToken');
    if (!csrfToken) {
      this.logout();
      return Promise.reject(new Error('No CSRF token found'));
    }

    this.ongoingProfileFetch = fetch(`${this.apiConfig.baseUrl}/ws/action`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken
      },
      body: JSON.stringify({
        action: 'com.ajawmrp3.apps.prospectingai.web.UserConfigController:getUserId',
        data: {}
      })
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`Error fetching profile: ${response.statusText}`);
        }
        return response.json();
      })
      .then(apiResponse => {
        if (apiResponse.data?.error) {
          throw new Error(`API Error: ${apiResponse.data.message}`);
        }

        const rawProfile = apiResponse.data;
        if (!rawProfile || !rawProfile.userId) {
          throw new Error('User profile data is invalid');
        }

        const userProfile: UserProfile = {
          ...rawProfile,
          onboardingStatus: rawProfile.onboardingStatus || []
        };

        this.userProfileSubject.next(userProfile);
        if (userProfile.language) {
          this.languageService.setLanguage(userProfile.language);
        }
        localStorage.setItem('userId', userProfile.userId.toString());
        localStorage.setItem('username', userProfile.username);

        this.identifyClarity(userProfile);

        return userProfile;
      })
      .catch(error => {
        console.error('AuthService: Error fetching user profile:', error);
        this.logout();
        throw error;
      })
      .finally(() => {
        this.ongoingProfileFetch = null;
      });

    return this.ongoingProfileFetch;
  }

  public get currentUserProfile(): UserProfile | null {
    return this.userProfileSubject.getValue();
  }

  public updateLocalProfileData(updatedData: Partial<UserProfile>): void {
    const currentProfile = this.userProfileSubject.getValue();
    if (currentProfile) {
      const newProfile = { ...currentProfile, ...updatedData };
      this.userProfileSubject.next(newProfile);
    }
  }

  async requestPasswordRecovery(email: string): Promise<any> {
    const payload = {
      action: 'recovery',
      email: email
    };

    try {
      const response = await fetch(this.apiConfig.recoveryPasswordUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'signupauth': 'UIh-9k88vY57L>f=7hF<'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        let errorMessage = 'Error al solicitar la recuperacion de contraseña.';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch {
          errorMessage = await response.text(); // Fallback to text if not JSON
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('AuthService: Error requesting password recovery', error);
      throw error;
    }
  }

  async resetPassword(email: string, token: string, newPassword: string): Promise<any> {
    const payload = {
      action: 'reset',
      email: email,
      token: token,
      newPassword: newPassword
    };

    try {
      const response = await fetch(this.apiConfig.recoveryPasswordUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'signupauth': 'UIh-9k88vY57L>f=7hF<'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        let errorMessage = 'Error al restablecer la contrasena.';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch {
          errorMessage = await response.text(); // Fallback to text if not JSON
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('AuthService: Error resetting password', error);
      throw error;
    }
  }

  updateCompanyProfileData(updatedData: { companyName?: string; creditDistributionMode?: "MANUAL" | "AUTO_EQUITABLE" | "AUTO_RULE_BASED"; minCreditsGuaranteed?: number }): void {
    const currentProfile = this.userProfileSubject.getValue();
    if (currentProfile && currentProfile.companyProfile) {
      const updatedCompanyProfile = {
        ...currentProfile.companyProfile,
        companyName: updatedData.companyName !== undefined ? updatedData.companyName : currentProfile.companyProfile.companyName,
        creditDistributionMode: updatedData.creditDistributionMode !== undefined ? updatedData.creditDistributionMode : currentProfile.companyProfile.creditDistributionMode,
        minCreditsGuaranteed: updatedData.minCreditsGuaranteed !== undefined ? updatedData.minCreditsGuaranteed : currentProfile.companyProfile.minCreditsGuaranteed
      };
      const newProfile = { ...currentProfile, companyProfile: updatedCompanyProfile };
      this.userProfileSubject.next(newProfile);
    }
  }

  updateCompanyCredits(newCredits: number): void {
    const currentProfile = this.userProfileSubject.getValue();
    if (currentProfile && currentProfile.companyProfile) {

      const updatedCompanyProfile = { ...currentProfile.companyProfile, companyCredits: newCredits };

      const newProfile = { ...currentProfile, companyProfile: updatedCompanyProfile };

      this.userProfileSubject.next(newProfile);
    }
  }

  updateCurrentUserCredits(newBalance: number): void {
    const currentProfile = this.userProfileSubject.getValue();
    if (!currentProfile || !currentProfile.companyProfile) {
      return;
    }

    const updatedCompanyProfile = {
      ...currentProfile.companyProfile,
      creditsAllocated: newBalance
    };

    const newProfile = {
      ...currentProfile,
      companyProfile: updatedCompanyProfile
    };

    this.userProfileSubject.next(newProfile);
  }

  public updateOnboardingStepStatus(stepId: number): void {
    const currentProfile = this.userProfileSubject.getValue();
    if (!currentProfile || !currentProfile.onboardingStatus) {
      return;
    }
    const newOnboardingStatus = currentProfile.onboardingStatus.map(step => {
      if (step.id === stepId) {
        return { ...step, isCompleted: true, completedOn: new Date().toISOString() };
      }
      return step;
    });

    const newProfile = { ...currentProfile, onboardingStatus: newOnboardingStatus };
    this.userProfileSubject.next(newProfile);
  }

  async logout(): Promise<void> {
    try {
      await fetch(`${this.apiConfig.baseUrl}/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    }
    catch (error) {
      console.error('Error during backend logout, proceeding with frontend logout anyway.', error);
    }
    finally {

      try {

        if (typeof clarity === 'function') {
          clarity('identify', null);
        }

      } catch (e) { }

      this.clearSession();
      this.router.navigate(['/login']);
    }
  }

  private clearSession(): void {
    localStorage.removeItem('csrfToken');
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    this.userProfileSubject.next(null);
    this.languageService.setLanguage('es');
  }

  isAuthenticated(): boolean {
    return !!this.currentUserProfile;
  }

  public get isAdmin(): boolean {
    return this.currentUserProfile?.companyProfile?.role === 'ADMIN';
  }

  public get hasNoSubscription(): boolean {
    const profile = this.currentUserProfile;
    return !profile || !profile.companyProfile || !profile.companyProfile.subscription || !profile.companyProfile.subscription.plan;
  }

  public get hasFreeSubscription(): boolean {
    const profile = this.currentUserProfile;
    if (this.hasNoSubscription) {
      return false;
    }

    return parseFloat(profile!.companyProfile!.subscription!.plan.price.toString()) === 0;
  }

  public get hasPaidSubscription(): boolean {
    const profile = this.currentUserProfile;
    if (this.hasNoSubscription) {
      return false;
    }

    return parseFloat(profile!.companyProfile!.subscription!.plan.price.toString()) > 0;
  }

  public get hasAnySubscription(): boolean {
    return !this.hasNoSubscription;
  }

  async refreshUserProfile(): Promise<void> {
    try {
      await this.fetchUserProfile();
    } catch (error) {
      console.error('AuthService: Error refreshing user profile:', error);
    }
  }

  private identifyClarity(userProfile: UserProfile): void {

    if (typeof clarity !== 'function') {
      console.log('Clarity no disponible');
      return;
    }

    try {

      clarity(
        'identify',
        String(userProfile.userId),
        undefined,
        undefined,
        userProfile.email || userProfile.username
      );

      clarity('set', 'username', userProfile.username);
      clarity('set', 'companyId', String(userProfile.companyProfile?.companyId ?? ''));
      clarity('set', 'company', userProfile.companyProfile?.companyName ?? '');
      clarity('set', 'role', userProfile.companyProfile?.role ?? '');
      clarity('set', 'plan', userProfile.companyProfile?.subscription?.plan?.name ?? '');
      clarity('set', 'language', userProfile.language ?? '');
      clarity('set', 'subscription', userProfile.companyProfile?.subscription?.status ?? '');
      clarity('set', 'credits', String(userProfile.companyProfile?.creditsAllocated ?? 0));


    } catch (e) {
      console.error('Clarity identify error', e);
    }
  }
}
