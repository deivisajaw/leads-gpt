import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router'; 
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-public-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './public-home.component.html',
  styleUrl: './public-home.component.css'
})
export class PublicHomeComponent {

  username = '';
  password = '';
  errorMessage = '';

  constructor(private authService: AuthService) {}

  async onLogin() {
    try {
      await this.authService.login(this.username, this.password);
    } catch (error: any) {
      this.errorMessage = error.message || 'Error desconocido';
    }
  }

}
