import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '../../services/language.service';
import { LANGUAGES, AppLanguage, detectLanguage } from '../../services/languages.catalog';
import { CurrencyService, CURRENCIES, AppCurrency } from '../../services/currency.service';
import { AuthService } from '../../services/auth.service';
import { Subscription } from 'rxjs';
import { fetchWithTimeout } from '../../services/http-timeout';
import { OnboardingService } from "../../services/onboarding.service"; // NEW IMPORT

@Component({
  selector: 'app-userconfig',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './userconfig.component.html',
  styleUrls: ['./userconfig.component.css']
})
export class UserconfigComponent implements OnInit, OnDestroy {
  selectedLanguage: string = 'es';
  langQuery = '';
  readonly languages: AppLanguage[] = LANGUAGES;
  readonly detectedLanguage: string = detectLanguage('es');

  // ── moneda de visualización (el cobro sigue siendo en USD) ──
  private currencySvc = inject(CurrencyService);
  currencyQuery = '';
  readonly currencies: AppCurrency[] = CURRENCIES;
  readonly detectedCurrency: string = this.currencySvc.detect();
  selectedCurrency: string = this.currencySvc.current;

  filteredCurrencies(): AppCurrency[] {
    const q = this.currencyQuery.trim().toLowerCase();
    if (!q) return this.currencies;
    return this.currencies.filter(c =>
      c.code.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      c.symbol.includes(q));
  }

  selectCurrency(code: string): void {
    if (this.isLoading) return;
    this.selectedCurrency = code;
    this.currencySvc.setCurrency(code);   // se aplica de inmediato
  }

  /** Filtra por nombre nativo, nombre en inglés o código. Los listos primero. */
  filteredLanguages(): AppLanguage[] {
    const q = this.langQuery.trim().toLowerCase();
    const list = q
      ? this.languages.filter(l =>
          l.native.toLowerCase().includes(q) ||
          l.english.toLowerCase().includes(q) ||
          l.code.startsWith(q))
      : this.languages;
    return [...list].sort((a, b) => Number(b.ready) - Number(a.ready));
  }
  initialLanguage: string = 'es';
  isLoading: boolean = false;
  message: string | null = null;
  isError: boolean = false;
  errorMessage: string | null = null; 
  creditsPerSearch: number = 0;
  initialCreditsPerSearch: number = 0;
  hideOnboardingWidget: boolean = false;
  initialHideOnboardingWidget: boolean = false;
  isConfigureProfileIncomplete: boolean = false; // New property
  private languageSubscription!: Subscription;
  private userProfileSubscription!: Subscription; // New subscription

  constructor(
    private languageService: LanguageService,
    private translate: TranslateService,
    private authService: AuthService,
    private onboardingService: OnboardingService // NEW INJECTION
  ) {}

  ngOnInit(): void {
    this.languageSubscription = this.languageService.language$.subscribe(lang => {
      this.selectedLanguage = lang;
      this.initialLanguage = lang;
    });

    this.userProfileSubscription = this.authService.userProfile$.subscribe(profile => {
      if (profile) {
        // Initialize config values from profile
        this.selectedLanguage = profile.language || 'es';
        this.initialLanguage = this.selectedLanguage;

        this.creditsPerSearch = profile.creditsPerSearch !== undefined ? profile.creditsPerSearch : 0;
        this.initialCreditsPerSearch = this.creditsPerSearch;

        this.hideOnboardingWidget = profile.hideOnboardingWidget !== undefined ? profile.hideOnboardingWidget : false;
        this.initialHideOnboardingWidget = this.hideOnboardingWidget;

        // Check onboarding status
        const configureProfileStep = (profile.onboardingStatus ?? []).find(step => step.stepKey === 'CONFIGURE_PROFILE');
        this.isConfigureProfileIncomplete = configureProfileStep ? !configureProfileStep.isCompleted : false;
      }
    });
  }

  ngOnDestroy(): void {
    if (this.languageSubscription) {
      this.languageSubscription.unsubscribe();
    }
    if (this.userProfileSubscription) { // Unsubscribe from userProfile$
      this.userProfileSubscription.unsubscribe();
    }
  }

  selectLanguage(lang: string): void {
    const target = this.languages.find(l => l.code === lang);
    if (!this.isLoading && target?.ready) {
      this.selectedLanguage = lang;
    }
  }

  isConfigChanged(): boolean {
    const actualChanges = this.selectedLanguage !== this.initialLanguage || this.creditsPerSearch !== this.initialCreditsPerSearch || this.hideOnboardingWidget !== this.initialHideOnboardingWidget;
    return actualChanges || this.isConfigureProfileIncomplete; // Button enabled if changes OR step incomplete
  }

  async saveConfig(): Promise<void> { 
    this.errorMessage = null; 
    if (!this.isConfigChanged()) return;

    if (this.creditsPerSearch === null || isNaN(this.creditsPerSearch)) {
      this.errorMessage = 'creditsPerSearch is required and must be a number.';
      this.isError = true;
      return;
    }
    if (this.creditsPerSearch < 1) {
      this.errorMessage = 'creditsPerSearch must be at least 1.'; 
      this.isError = true;
      return;
    }



    this.isLoading = true;
    this.message = null; 

    try {
      const csrfToken = localStorage.getItem('csrfToken');
      if (!csrfToken) {
        throw new Error('CSRF token not found.');
      }

      const response = await fetchWithTimeout(`${this.authService.apiConfig.baseUrl}/ws/action`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({
          action: 'com.ajawmrp3.apps.prospectingai.web.UserConfigController:saveConfigUser',
          data: { 
            _language: this.selectedLanguage,
            _creditsPerSearch: this.creditsPerSearch,
            _hideOnboardingWidget: this.hideOnboardingWidget
          }
        })
      });

      const result = await response.json();

      if (response.ok) {
        if (result.status === 0) {
        
          const updatedLanguage = result.data?.language || this.selectedLanguage;
          const updatedCreditsPerSearch = result.data?.creditsPerSearch || this.creditsPerSearch;
          const updatedHideOnboarding = result.data?.hideOnboardingWidget !== undefined ? result.data.hideOnboardingWidget : this.hideOnboardingWidget;

          // Se comprueba ANTES de mover initialLanguage. Estaba al revés: se
          // machacaba initialLanguage con el idioma nuevo y luego se comparaba
          // contra él, así que la condición nunca se cumplía y setLanguage no
          // llegaba a ejecutarse. El idioma se guardaba en el backend pero la
          // pantalla seguía igual hasta que uno recargaba a mano.
          const languageChanged = updatedLanguage !== this.initialLanguage;

          this.initialLanguage = updatedLanguage;
          this.initialCreditsPerSearch = updatedCreditsPerSearch;
          this.initialHideOnboardingWidget = updatedHideOnboarding;

          if (languageChanged) {
            this.languageService.setLanguage(updatedLanguage);
          }

          this.authService.updateLocalProfileData({
            language: updatedLanguage,
            creditsPerSearch: updatedCreditsPerSearch,
            hideOnboardingWidget: updatedHideOnboarding
          });

          this.isError = false;
          this.message = this.translate.instant('USERCONFIG.SAVED');
          this.onboardingService.completeOnboardingStepByKey('CONFIGURE_PROFILE');

          // Los pipes | translate cambian solos, pero varias pantallas fijan sus
          // textos con translate.instant() al construirse y ésas se quedarían en
          // el idioma viejo. Recargamos una vez para que todo quede parejo.
          if (languageChanged) {
            setTimeout(() => window.location.reload(), 700);
          }
        } else {
          this.isError = true;
          this.message = result.data?.message || result.message || 'Failed to update config due to backend error.';
        }
      }
      else {
        this.isError = true;
        this.message = `HTTP Error: ${response.status} - ${response.statusText || 'Unknown error'}`;
        if (result.message) {
          this.message += ` (${result.message})`;
        }
      }
    } catch (error: any) {
      this.isError = true;
      this.message = error.message || 'An unexpected network error occurred.';
      console.error('Error saving config:', error);
    } finally {
      this.isLoading = false;
      setTimeout(() => {
        this.message = null;
      }, 3000);
    }
  }
}