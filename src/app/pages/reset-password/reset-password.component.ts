import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../services/auth.service';
import { ActivatedRoute, Router, RouterModule } from '@angular/router'; // Added ActivatedRoute and RouterModule

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, RouterModule], // Added RouterModule
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.css']
})
export class ResetPasswordComponent implements OnInit {
  email: string = '';
  token: string = '';
  newPassword = '';
  confirmPassword = '';
  message: string | null = null;
  isError: boolean = false;
  isLoading: boolean = false;
  passwordFieldType: string = 'password'; // For password visibility toggle
  passwordValidationState = {
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    symbol: false,
    match: false
  };

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute // Inject ActivatedRoute to get URL params
  ) { }

  ngOnInit(): void {
    // Get email and token from URL parameters
    this.route.queryParams.subscribe(params => {
      this.email = params['email'] || '';
      this.token = params['token'] || '';

      if (!this.email || !this.token) {
        this.isError = true;
        this.message = 'Parametros de recuperacion de contrasena invalidos o faltantes.';
        this.isLoading = false; // Ensure loading is false if params are invalid
      }
    });
  }

  validatePassword(): void {
    // Clear general messages when user starts typing
    this.message = null;
    this.isError = false;

    // Password validation rules (copied from login component's signup)
    this.passwordValidationState.length = this.newPassword.length >= 8;
    this.passwordValidationState.uppercase = /[A-Z]/.test(this.newPassword);
    this.passwordValidationState.lowercase = /[a-z]/.test(this.newPassword);
    this.passwordValidationState.number = /[0-9]/.test(this.newPassword);
    this.passwordValidationState.symbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/.test(this.newPassword);
    this.passwordValidationState.match = this.newPassword === this.confirmPassword && this.newPassword.length > 0;
  }

  isPasswordValid(): boolean {
    return Object.values(this.passwordValidationState).every(state => state === true);
  }

  togglePasswordVisibility(): void {
    this.passwordFieldType = this.passwordFieldType === 'password' ? 'text' : 'password';
  }

  async onResetPassword(): Promise<void> {
    this.isLoading = true;
    this.message = null;
    this.isError = false;

    if (!this.isPasswordValid()) {
      this.isError = true;
      this.message = 'La nueva contrasena no cumple con los requisitos o no coincide.';
      this.isLoading = false;
      return;
    }

    try {
      await this.authService.resetPassword(this.email, this.token, this.newPassword);
      this.message = 'Tu contrasena ha sido restablecida exitosamente. Redirigiendo al login...';
      setTimeout(() => {
        this.router.navigate(['/login']);
      }, 3000);
    } catch (error: any) {
      this.isError = true;
      this.message = error.message || 'Error al restablecer la contrasena.';
    } finally {
      this.isLoading = false;
    }
  }
}
