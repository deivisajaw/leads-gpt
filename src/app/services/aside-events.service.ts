import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AsideEventsService {
  private submenuToggledSource = new Subject<void>();

  submenuToggled$ = this.submenuToggledSource.asObservable();

  constructor() { }

  toggleSubmenu(): void {
    this.submenuToggledSource.next();
  }
}