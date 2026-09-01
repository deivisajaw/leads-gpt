import { Component, OnInit, ChangeDetectorRef, ViewChild, AfterViewInit, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { AuthService, OnboardingQuestion } from '../../services/auth.service';
import { SignupService } from '../../services/signup.service';
import { SignupPayload } from '../../models/signup.model';
import { OnboardingWizardComponent } from '../../components/onboarding-wizard/onboarding-wizard.component';
import { DirectorioRedirectService } from '../../services/directorio-redirect.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, OnboardingWizardComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent implements OnInit, AfterViewInit {
  @ViewChild('signupForm') signupForm!: NgForm;
  @ViewChild(OnboardingWizardComponent) onboardingWizard!: OnboardingWizardComponent;

  // Onboarding Wizard Properties
  showOnboardingWizard = false;
  onboardingQuestions: OnboardingQuestion[] = [];

  // Login properties
  username = '';
  password = '';
  errorMessage = '';
  loading = false;
  activeTab: 'login' | 'signup' = 'login';
  passwordFieldType: 'password' | 'text' = 'password';

  // Signup properties
  signupData: SignupPayload = {
    firstName: '',
    lastName: '',
    companyName: '',
    email: '',
    prefixCountyPhone: '+57',
    phoneNumber: '',
    password: ''
  };
  signupRepeatPassword = '';
  signupLoading = false;
  signupErrorMessage = '';
  signupSuccessMessage = '';
  loginMessage = '';
  signupSubmitted = false;
  signupPasswordFieldType: 'password' | 'text' = 'password';
  isSignupButtonDisabled = true;

  passwordValidationState = {
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    symbol: false,
    match: false
  };

  private fbPixelLoaded = false;

  constructor(
    private authService: AuthService,
    private signupService: SignupService,
    private cdr: ChangeDetectorRef,
    private renderer: Renderer2,
    private route: ActivatedRoute,
    private router: Router,
    private directorioRedirect: DirectorioRedirectService
  ) { }

  ngOnInit() {

    this.route.queryParams.subscribe(params => {
      this.directorioRedirect.capture(params);
    });

    const state = history.state as { signupSuccessMessage?: string };

    if (state?.signupSuccessMessage) {
      this.loginMessage = state.signupSuccessMessage;

      history.replaceState({}, document.title);
    }

    this.authService.getOnboardingQuestions().subscribe({
      next: (response) => {
        if (!response.error && response.questions) {
          this.onboardingQuestions = response.questions;
        } else {
          console.error('Failed to load onboarding questions:', response.message);
        }
      },
      error: (err) => {
        console.error('HTTP Error fetching onboarding questions:', err);
      }
    });

    const script = this.renderer.createElement('script');
    script.src = 'https://www.googletagmanager.com/gtag/js?id=AW-11321592792';
    script.async = true;
    this.renderer.appendChild(document.head, script);

    const inlineScript = this.renderer.createElement('script');
    inlineScript.text = `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'AW-11321592792');
    `;
    this.renderer.appendChild(document.head, inlineScript);

    if (localStorage.getItem('csrfToken')) {
      this.authService.logout();
    }

    this.route.url.subscribe(segments => {
      if (segments.length > 0 && segments[0].path === 'signup') {
        this.activeTab = 'signup';
        this.loadFacebookPixel();
      } else {
        this.activeTab = 'login';
      }
    });
  }

  ngAfterViewInit() {
    setTimeout(() => this.validateSignupState(), 0);
  }

  setActiveTab(tab: 'login' | 'signup'): void {
    if (tab === 'signup') {
      this.router.navigate(['/signup']);
    } else {
      this.router.navigate(['/login']);
    }
  }

  validateSignupState() {
    if (!this.signupForm || !this.signupForm.form) {
      this.isSignupButtonDisabled = true;
      return;
    }

    const password = this.signupData.password ?? '';
    const repeatPassword = this.signupRepeatPassword ?? '';

    this.passwordValidationState.length = password.length >= 8;
    this.passwordValidationState.uppercase = /[A-Z]/.test(password);
    this.passwordValidationState.lowercase = /[a-z]/.test(password);
    this.passwordValidationState.number = /[0-9]/.test(password);
    this.passwordValidationState.symbol = /[@$!%*?&.]/.test(password);
    this.passwordValidationState.match =
      password.length > 0 && password === repeatPassword;

    const allPasswordReqsMet = Object.values(this.passwordValidationState).every(val => val === true);

    this.isSignupButtonDisabled = this.signupForm.form.pristine || !this.signupForm.valid ||
      !allPasswordReqsMet;
    this.cdr.detectChanges();
  }

  async onLogin() {

    this.loginMessage = '';

    if (!this.username.trim() || !this.password.trim()) {
      this.errorMessage = 'Debes completar ambos campos.';
      this.cdr.detectChanges();
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    try {
      await this.authService.login(this.username, this.password);
    } catch (error: any) {
      this.errorMessage = 'Ha ocurrido un error con los datos ingresados';
      this.cdr.detectChanges();
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  async _performSignup(payload: SignupPayload & { onboardingResponses?: any[] }) {
    this.signupLoading = true;
    this.signupErrorMessage = '';
    this.signupSuccessMessage = '';

    try {

      await this.signupService.register(payload);

      // Guardar credenciales antes de resetear el formulario
      const userEmail = this.signupData.email;
      const userPassword = this.signupData.password;

      this.signupData = { firstName: '', lastName: '', companyName: '', email: '', prefixCountyPhone: '+57', phoneNumber: '', password: '' };
      this.signupRepeatPassword = '';
      this.signupSubmitted = false;

      this.signupForm.reset();
      this.cdr.detectChanges();

      this.reportConversion();

      // Iniciar sesión automáticamente con las credenciales del registro
      this.signupLoading = false;
      this.loading = true;
      this.cdr.detectChanges();

      try {
        await this.authService.login(userEmail, userPassword, false);
        // El servicio de autenticación manejará la redirección automática al dashboard/home
        if (this.onboardingWizard) {
          this.onboardingWizard.handleWebhookSuccess();
        } else {
          // Fallback en caso de que no se encuentre la referencia
          const nav = this.directorioRedirect.getRedirectNavigation();
          if (nav) {
            this.router.navigate(nav.commands, nav.extras);
          } else {
            this.router.navigate(['/dashboard']);
          }
        }
      } catch (loginError: any) {
        // Si el login automático falla, mostramos mensaje y redirigimos al tab de login
        this.loginMessage = '¡Registro exitoso! Por favor, inicia sesión con tus nuevas credenciales.';
        this.router.navigate(['/login'], {
          state: {
            signupSuccessMessage: '¡Registro exitoso! Por favor, inicia sesión con tus nuevas credenciales.'
          }
        });
        console.error('Error al iniciar sesión automáticamente:', loginError);
      } finally {
        this.loading = false;
        this.cdr.detectChanges();
      }

    } catch (error: any) {
      this.signupErrorMessage = error.message || 'Ha ocurrido un error en el registro.';
      this.signupLoading = false;
      this.showOnboardingWizard = false;
      if (this.onboardingWizard) {
        this.onboardingWizard.handleWebhookError();
      }
      this.cdr.detectChanges();
    }
  }

  onSignup() {
    this.signupSubmitted = true;
    this.validateSignupState();

    if (this.isSignupButtonDisabled) {
      this.signupErrorMessage = 'Por favor, completa todos los campos requeridos y asegúrate de que la contraseña cumpla los requisitos.';
      return;
    }

    if (this.onboardingQuestions.length > 0) {
      this.showOnboardingWizard = true;
    } else {
      this._performSignup(this.signupData);
    }
  }

  handleWizardClose() {
    this.showOnboardingWizard = false;
    // Si el usuario cierra el wizard, puede que queramos resetear algo o simplemente no hacer nada.
    // Por ahora, simplemente cerramos el wizard.
  }

  async handleWizardCompletion(answers: any[]) {
    //this.showOnboardingWizard = false;

    // Combina los datos de registro con las respuestas del wizard
    const finalPayload = {
      ...this.signupData,
      onboardingResponses: answers
    };

    //console.log('Final payload to be sent:', finalPayload);
    this._performSignup(finalPayload);
  }

  reportConversion(url?: string) {
    const callback = () => {
      if (url) {
        window.location.href = url;
      }
    };

    const gtagFn = (window as any).gtag;
    if (typeof gtagFn === 'function') {
      gtagFn('event', 'conversion', {
        send_to: 'AW-11321592792/NQoxCLjizK0bENiXx5Yq',
        value: 1.0,
        currency: 'USD',
        event_callback: callback
      });
      //console.log('✅ Evento de conversión enviado a Google Ads');
    } else {
      console.warn('⚠️ gtag aún no está disponible al momento de llamar reportConversion');
    }
  }


  togglePasswordVisibility() {
    this.passwordFieldType = this.passwordFieldType === 'password' ? 'text' : 'password';
  }

  toggleSignupPasswordVisibility() {
    this.signupPasswordFieldType = this.signupPasswordFieldType === 'password' ? 'text' : 'password';
  }

  loadFacebookPixel() {
    if (this.fbPixelLoaded) {
      return;
    }

    const script = this.renderer.createElement('script');
    script.text = `
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');

    fbq('init', '1861825304423016');
    fbq('track', 'PageView');
  `;

    this.renderer.appendChild(document.head, script);

    // Noscript fallback
    const noscript = this.renderer.createElement('noscript');
    noscript.innerHTML = `
    <img height="1" width="1" style="display:none"
    src="https://www.facebook.com/tr?id=1861825304423016&ev=PageView&noscript=1"/>
  `;
    this.renderer.appendChild(document.body, noscript);

    this.fbPixelLoaded = true;
    //console.log('✅ Meta Pixel cargado');
  }

}
