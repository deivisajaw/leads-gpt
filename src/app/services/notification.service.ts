import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

// Definimos la estructura de una notificación
export interface Notification {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notificationSubject = new Subject<Notification>();
  private notificationId = 0;

  // El componente Toast se suscribirá a este Observable
  getNotifications(): Observable<Notification> {
    return this.notificationSubject.asObservable();
  }

  // Método para mostrar una notificación de éxito
  showSuccess(message: string) {
    this.notificationSubject.next({
      id: this.notificationId++,
      type: 'success',
      message: message
    });
  }

  // Método para mostrar una notificación de error
  showError(message: string) {
    this.notificationSubject.next({
      id: this.notificationId++,
      type: 'error',
      message: message
    });
  }

  // Método para mostrar una notificación de información
  showInfo(message: string) {
    this.notificationSubject.next({
      id: this.notificationId++,
      type: 'info',
      message: message
    });
  }
}
