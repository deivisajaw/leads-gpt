import { Component, ViewChild, type ElementRef, type QueryList, ViewChildren, ViewEncapsulation, OnInit, OnDestroy, ChangeDetectorRef } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '../../services/language.service';
import { AsideEventsService } from '../../services/aside-events.service';

@Component({
  selector: 'app-aside',
  standalone: true,
  imports: [RouterModule, CommonModule, TranslateModule],
  templateUrl: './aside.component.html',
  styleUrl: './aside.component.css',
  encapsulation: ViewEncapsulation.None,
  host: {
    class: "sidebar",
    "[class.collapsed]": "isCollapsed",
  },
})
export class AsideComponent implements OnInit, OnDestroy {

  isCollapsed = false;
  submenuOpen = false;
  username: string | null = "";
  private routerSubscription!: Subscription;
  private languageSubscription!: Subscription; 
  currentLang: string = "";

  @ViewChild("sidebar", { static: true }) sidebar!: ElementRef<HTMLElement>
  
  @ViewChild("myListsSubmenu") myListsSubmenu!: ElementRef<HTMLElement>;

  @ViewChild("mySearchHistorySubmenu") mySearchHistorySubmenu!: ElementRef<HTMLElement>;
  
  @ViewChild("subscriptionSettingsSubmenu") subscriptionSettingsSubmenu!: ElementRef<HTMLElement>;
  private userProfileSubscription!: Subscription;

  constructor(public authService: AuthService, private router: Router, private languageService: LanguageService, private asideEventsService: AsideEventsService) {}

  ngOnInit(): void {
    this.userProfileSubscription = this.authService.userProfile$.subscribe(profile => {
      this.username = profile ? profile.username : '';
    });
  }

  ngAfterViewInit() {
    this.checkAndOpenSubmenuIfActive();
  }

  changeLanguage(lang: string) {    
    this.languageService.setLanguage(lang);
  }

  logout(event: Event): void {
    event.preventDefault();
    this.authService.logout();
  }

  toggleSidebar(): void {
    this.isCollapsed = !this.isCollapsed

    if (this.isCollapsed) {
      this.closeAllSubmenus()
    }
  }

  private closeAllSubmenus(): void {
    if (this.myListsSubmenu) {
      this.myListsSubmenu.nativeElement.classList.remove("open");
    }

    if (this.mySearchHistorySubmenu) {
      this.mySearchHistorySubmenu.nativeElement.classList.remove("open");
    }

    if (this.subscriptionSettingsSubmenu) {
      this.subscriptionSettingsSubmenu.nativeElement.classList.remove("open");
    }
    
  }

  toggleSubmenu(event: Event, submenuElement: HTMLElement): void {
    event.preventDefault();

    if (this.isCollapsed) {
      return;
    }

    const isOpening = !submenuElement.classList.contains('open');

    this.closeAllSubmenus();

    if (isOpening) {
      submenuElement.classList.add('open');
    }
    this.asideEventsService.toggleSubmenu(); 
  }

  isSubmenuActive(paths: string[]): boolean {
    return paths.some(path => this.router.url.startsWith(path));
  }

  ngOnDestroy(): void {
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
    if (this.languageSubscription) {
      this.languageSubscription.unsubscribe(); 
    }

    if (this.userProfileSubscription) {
      this.userProfileSubscription.unsubscribe();
    }
  }

  private checkAndOpenSubmenuIfActive(): void {
    const myListsActive = this.isSubmenuActive(['/my-list-people', '/my-list-company', '/company-details', '/people-details']);

    const mySearchHistoryActive = this.isSubmenuActive(['/my-search-history-peoples', '/my-search-history-companies', '/my-history-search-people-details', '/my-history-search-company-details']);

    const subscriptionSettingsActive = this.isSubmenuActive(['/admin-users', '/payment-history', '/plans-list', '/my-plan', '/subscription-management']);

    if (this.myListsSubmenu) {
      if (myListsActive) {
        this.myListsSubmenu.nativeElement.classList.add('open');
      } else {
        this.myListsSubmenu.nativeElement.classList.remove('open');
      }
    }

    if (this.mySearchHistorySubmenu) {
      if (mySearchHistoryActive) {
        this.mySearchHistorySubmenu.nativeElement.classList.add('open');
      } else {
        this.mySearchHistorySubmenu.nativeElement.classList.remove('open');
      }
    }

    if (this.subscriptionSettingsSubmenu) {
      if (subscriptionSettingsActive) {
        this.subscriptionSettingsSubmenu.nativeElement.classList.add('open');
      } else {
        this.subscriptionSettingsSubmenu.nativeElement.classList.remove('open');
      }
    }
  }
}
