import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../services/auth.service';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-recovery-password',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, RouterModule],
  templateUrl: './recovery-password.component.html',
  styleUrls: ['./recovery-password.component.css']
})
export class RecoveryPasswordComponent implements OnInit {
  email: string = '';
  message: string | null = null;
  isError: boolean = false;
  isLoading: boolean = false;

  constructor(private authService: AuthService, private router: Router) { }

  ngOnInit(): void { }

  async onRequestRecovery(): Promise<void> {
    this.isLoading = true;
    this.message = null;
    this.isError = false;

    try {
      await this.authService.requestPasswordRecovery(this.email);
      this.message = 'Se ha enviado un enlace de recuperacion a tu email. Por favor, revisa tu bandeja de entrada.';
    } catch (error: any) {
      this.isError = true;
      this.message = error.message || 'Error al solicitar la recuperacion de contrasena.';
    } finally {
      this.isLoading = false;
    }
  }
}
