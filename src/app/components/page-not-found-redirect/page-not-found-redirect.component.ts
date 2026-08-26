import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  standalone: true,
  template: '',
  host: { 'data-component': 'page-not-found' },
})
export class PageNotFoundRedirectComponent {
  constructor(router: Router) {
    const token = localStorage.getItem('csrfToken');
    if (token) {
      router.navigateByUrl('/dashboard');
    } else {
      router.navigateByUrl('/');
    }
  }
}
