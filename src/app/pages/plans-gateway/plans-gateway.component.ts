import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { PlansComponent } from '../plans/plans.component';
import { SubscriptionManagementComponent } from '../subscription-management/subscription-management.component';
import { Router } from '@angular/router'; // Import Router

@Component({
  selector: 'app-plans-gateway',
  standalone: true,
  imports: [
    CommonModule,
    PlansComponent, // Importar para poder usarlo en la plantilla
    SubscriptionManagementComponent // Importar para poder usarlo en la plantilla
  ],
  templateUrl: './plans-gateway.component.html',
  styleUrls: ['./plans-gateway.component.css']
})
export class PlansGatewayComponent implements OnInit, OnDestroy {
  private profileSubscription: Subscription | undefined;
  hasSubscription: boolean = false;
  isAdmin: boolean = false; // New property
  isProfileLoaded: boolean = false;

  constructor(private authService: AuthService, private router: Router) {} // Inject Router

  ngOnInit(): void {
    this.profileSubscription = this.authService.userProfile$.subscribe(profile => {
      this.isProfileLoaded = true;
      this.hasSubscription = !!profile?.companyProfile?.subscription;
      this.isAdmin = profile?.companyProfile?.role === 'ADMIN'; // Get admin status

      // ONLY redirect if user has a plan but is NOT an admin
      if (!this.isAdmin && this.hasSubscription) {
        this.router.navigate(['/my-plan']);
      }
      // For other cases (admin, or no plan), conditional rendering in HTML will handle it.
    });
  }

  ngOnDestroy(): void {
    this.profileSubscription?.unsubscribe();
  }
}
