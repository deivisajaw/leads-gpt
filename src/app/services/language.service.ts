import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject } from 'rxjs';
import { detectLanguage, READY_LANGUAGES, isRTL } from './languages.catalog';

@Injectable({
  providedIn: 'root'
})
export class LanguageService {
  private languageSubject: BehaviorSubject<string>;
  public language$: BehaviorSubject<string>;

  constructor(private translate: TranslateService) {
    // Si el usuario ya eligió idioma, se respeta. Si no, lo adivinamos por
    // navegador y zona horaria (sin backend ni servicios externos).
    let saved: string | null = null;
    try { saved = localStorage.getItem('language'); } catch { /* almacenamiento bloqueado */ }
    const ready = READY_LANGUAGES().map(l => l.code);
    const initialLanguage = (saved && ready.includes(saved)) ? saved : detectLanguage('es');
    if (!saved) {
      try { localStorage.setItem('languageAutoDetected', '1'); } catch { /* noop */ }
    }
    this.languageSubject = new BehaviorSubject<string>(initialLanguage);
    this.language$ = this.languageSubject;
    this.translate.use(initialLanguage);
    this.applyDirection(initialLanguage);
  }

  setLanguage(lang: string): void {
  
    this.translate.use(lang);
    this.translate.reloadLang(lang).subscribe(() => {
      try { localStorage.setItem('language', lang); } catch { /* almacenamiento bloqueado */ }
      this.applyDirection(lang);
      this.languageSubject.next(lang);
    });
 
  }

  getLanguage(): string {
    const currentLang = this.languageSubject.getValue();
    return currentLang;
  }

  /**
   * Idiomas como el árabe se leen de derecha a izquierda. Ponemos dir/lang en
   * <html> para que el navegador voltee el layout, y una clase por si algún
   * detalle necesita ajuste fino en CSS.
   */
  private applyDirection(lang: string): void {
    try {
      const rtl = isRTL(lang);
      const html = document.documentElement;
      html.setAttribute('dir', rtl ? 'rtl' : 'ltr');
      html.setAttribute('lang', lang);
      html.classList.toggle('rtl', rtl);
    } catch { /* noop */ }
  }
}
