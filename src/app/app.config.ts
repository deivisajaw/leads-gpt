import { ApplicationConfig, provideZoneChangeDetection, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';

import { provideHttpClient, withFetch, HttpClient } from '@angular/common/http';

import { provideClientHydration } from '@angular/platform-browser';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';

/**
 * Los archivos de idioma se pedían como ./i18n/es.json, sin versión. Tras cada
 * despliegue el navegador seguía sirviendo el JSON viejo desde su caché, así que
 * cualquier clave nueva salía cruda en pantalla ("ASIDE.DEALS" en vez de
 * "AI CRM") hasta que el usuario limpiaba la caché.
 *
 * Le colgamos el hash del bundle principal, que Angular ya cambia en cada build:
 * mismo build → misma URL → sigue cacheado; build nuevo → URL nueva → se
 * vuelve a pedir. No hace falta tocar nada al desplegar.
 */
function buildStamp(): string {
  try {
    const src = (document.querySelector('script[src*="main"]') as HTMLScriptElement | null)?.src || '';
    const hash = src.match(/main[.-]([A-Za-z0-9]+)\.js/)?.[1];
    if (hash) return hash;
  } catch { /* sin DOM (SSR): se cae al respaldo */ }
  return 'dev';
}

export function HttpLoaderFactory(http: HttpClient) {
  return new TranslateHttpLoader(http, './i18n/', `.json?v=${buildStamp()}`);
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideClientHydration(),
    provideHttpClient(withFetch()),

    importProvidersFrom(
      TranslateModule.forRoot({
        loader: {
          provide: TranslateLoader,
          useFactory: HttpLoaderFactory,
          deps: [HttpClient],
        },
        defaultLanguage: 'es'
      })
    )
  ]
};
