import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LanguageService {
  private languageSubject: BehaviorSubject<string>;
  public language$: BehaviorSubject<string>;

  constructor(private translate: TranslateService) {
    const initialLanguage = localStorage.getItem('language') || this.translate.getBrowserLang() || 'es';
    this.languageSubject = new BehaviorSubject<string>(initialLanguage);
    this.language$ = this.languageSubject;
    this.translate.use(initialLanguage);
  }

  setLanguage(lang: string): void {
  
    this.translate.use(lang);
    this.translate.reloadLang(lang).subscribe(() => {
      localStorage.setItem('language', lang);
      this.languageSubject.next(lang);
    });
 
  }

  getLanguage(): string {
    const currentLang = this.languageSubject.getValue();
    return currentLang;
  }
}
