import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LanguageService } from './services/language.service';
import { AuthService } from './services/auth.service';

@Component({
  standalone: true,
  selector: 'app-root',
  imports: [RouterOutlet, TranslateModule],
  template: `<router-outlet></router-outlet>`,
})
export class AppComponent {
  
  title = 'leads-gpt';

  constructor(
    private translate: TranslateService, 
    private languageService: LanguageService,
    private authService: AuthService // Inyectar AuthService
  ) {
    // Iniciar la comprobación de la sesión al arrancar la app
    this.authService.ensureProfileLoaded();

    // Lógica de idioma existente
    this.translate.setDefaultLang('es');
    const lang = this.languageService.getLanguage();
    this.translate.use(lang);
  }
  
}