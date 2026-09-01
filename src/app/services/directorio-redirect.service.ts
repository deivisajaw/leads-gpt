import { Injectable } from '@angular/core';
import { Params } from '@angular/router';

export interface DirectorioTarget {
  type: 'company' | 'people';
  id: number;
}

const STORAGE_KEY = 'directorioRedirectTarget';

@Injectable({ providedIn: 'root' })
export class DirectorioRedirectService {

  // Lee companyId/peopleId + directorio de los queryParams y, si son validos, los
  // guarda para consumirlos una sola vez despues del login/signup. sessionStorage
  // (no localStorage) porque es un dato de un solo uso, no una preferencia del user.
  capture(queryParams: Params): void {
    if (queryParams['directorio'] !== 'true') {
      return;
    }

    const companyId = Number(queryParams['companyId']);
    if (queryParams['companyId'] !== undefined && Number.isFinite(companyId) && companyId > 0) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ type: 'company', id: companyId }));
      return;
    }

    const peopleId = Number(queryParams['peopleId']);
    if (queryParams['peopleId'] !== undefined && Number.isFinite(peopleId) && peopleId > 0) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ type: 'people', id: peopleId }));
    }
  }

  // Devuelve el destino pendiente y lo BORRA (uso unico) — o null si no hay nada.
  consume(): DirectorioTarget | null {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(STORAGE_KEY);
    try {
      return JSON.parse(raw) as DirectorioTarget;
    } catch {
      return null;
    }
  }

  // Devuelve [ruta, extras] listo para router.navigate(ruta, extras), o null.
  getRedirectNavigation(): { commands: any[]; extras: { queryParams: Params } } | null {
    const target = this.consume();
    if (!target) return null;

    if (target.type === 'company') {
      return { commands: ['/companies'], extras: { queryParams: { companyId: target.id } } };
    }
    return { commands: ['/people'], extras: { queryParams: { peopleId: target.id } } };
  }
}