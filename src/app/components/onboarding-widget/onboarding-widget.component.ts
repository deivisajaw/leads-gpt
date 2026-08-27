import { Component, OnInit, OnDestroy, ViewChild, ElementRef, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { Observable, map, Subscription, filter } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { OnboardingStepStatus } from '../../models/user-profile.model';

@Component({
  selector: 'app-onboarding-widget',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule],
  templateUrl: './onboarding-widget.component.html',
  styleUrls: ['./onboarding-widget.component.css']
})
export class OnboardingWidgetComponent implements OnInit, OnDestroy {

  @ViewChild('stepsContainer') stepsContainerRef!: ElementRef;

  // Permite re-abrir la guia de pasos aunque el onboarding este completado (solo vista)
  @Input() forceShow = false;

  public onboardingStatus$: Observable<OnboardingStepStatus[] | undefined>;
  public progress$: Observable<number>;
  public allStepsCompleted$: Observable<boolean>;

  public currentSlideIndex: number = 0;
  public isPlaying: boolean = true;
  private carouselInterval: any;
  private stepsSubscription!: Subscription;
  public steps: OnboardingStepStatus[] = []; 

  constructor(
    private authService: AuthService,
    private router: Router,
    private notificationService: NotificationService,
    private translate: TranslateService 
  ) {
    this.onboardingStatus$ = this.authService.userProfile$.pipe(
      map(profile => profile?.onboardingStatus ?? [])
    );

    this.progress$ = this.authService.userProfile$.pipe(
      map(profile => {
        const steps = profile?.onboardingStatus;
        if (!steps || steps.length === 0) return 0;
        const completedSteps = steps.filter(step => step.isCompleted).length;
        return Math.round((completedSteps / steps.length) * 100);
      })
    );

    this.allStepsCompleted$ = this.authService.userProfile$.pipe(
      map(profile => {
        const steps = profile?.onboardingStatus;
        return steps ? steps.length > 0 && steps.every(step => step.isCompleted) : false;
      })
    );
  }

  // Presentacional: el mensaje de "todo completado" se muestra UNA sola vez y luego desaparece
  private static CONGRATS_SEEN_KEY = 'ajawOnboardingCongratsSeen';
  public congratsVisible = false;
  public congratsLeaving = false;
  private congratsSubscription!: Subscription;
  private congratsTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.stepsSubscription = this.onboardingStatus$
      .pipe(filter(steps => !!steps && steps.length > 0))
      .subscribe(steps => {
        this.steps = steps as OnboardingStepStatus[];
        this.currentSlideIndex = 0;
        this.startCarousel();
      });

    this.congratsSubscription = this.allStepsCompleted$
      .pipe(filter(done => done === true))
      .subscribe(() => {
        const seen = localStorage.getItem(OnboardingWidgetComponent.CONGRATS_SEEN_KEY) === '1';
        if (!seen && !this.congratsVisible) {
          this.congratsVisible = true;
          this.congratsTimer = setTimeout(() => this.dismissCongrats(), 8000);
        }
      });
  }

  dismissCongrats(): void {
    if (this.congratsTimer) { clearTimeout(this.congratsTimer); this.congratsTimer = null; }
    this.congratsLeaving = true;
    setTimeout(() => {
      this.congratsVisible = false;
      this.congratsLeaving = false;
      localStorage.setItem(OnboardingWidgetComponent.CONGRATS_SEEN_KEY, '1');
    }, 350);
  }

  ngOnDestroy(): void {
    this.stopCarousel();
    if (this.stepsSubscription) {
      this.stepsSubscription.unsubscribe();
    }
    if (this.congratsSubscription) {
      this.congratsSubscription.unsubscribe();
    }
    if (this.congratsTimer) {
      clearTimeout(this.congratsTimer);
    }
  }

  startCarousel(): void {
    this.stopCarousel(); 
    if (this.steps.length > this.getVisibleCardsCount() && this.isPlaying) {
      this.carouselInterval = setInterval(() => {
        this.nextSlide();
      }, 5000);
    }
  }

  stopCarousel(): void {
    if (this.carouselInterval) {
      clearInterval(this.carouselInterval);
      this.carouselInterval = null;
    }
  }

  togglePlayPause(): void {
    this.isPlaying = !this.isPlaying;
    if (this.isPlaying) {
      this.startCarousel();
    } else {
      this.stopCarousel();
    }
  }

  nextSlide(): void {
    if (this.steps.length === 0 || !this.stepsContainerRef) return;

    const container = this.stepsContainerRef.nativeElement;
    const firstCard = container.querySelector('.step-card');
    if (!firstCard) return;

    const cardWidth = firstCard.offsetWidth;
    const gap = 15; 
    const scrollAmount = cardWidth + gap;

    const maxScrollLeft = container.scrollWidth - container.clientWidth;
    const tolerance = 2; 

    if (container.scrollLeft >= maxScrollLeft - tolerance) {
      container.scrollTo({ left: 0, behavior: 'smooth' });
      this.currentSlideIndex = 0;
    } else {
      container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      this.currentSlideIndex++;
    }

    if (this.isPlaying) { 
      this.startCarousel();
    }
  }

  prevSlide(): void {
    if (this.steps.length === 0 || !this.stepsContainerRef) return;

    const container = this.stepsContainerRef.nativeElement;
    const firstCard = container.querySelector('.step-card');
    if (!firstCard) return;

    const cardWidth = firstCard.offsetWidth; 
    const gap = 15; 
    const scrollAmount = cardWidth + gap;

    if (container.scrollLeft - scrollAmount <= 0) {
      container.scrollTo({ left: container.scrollWidth, behavior: 'smooth' });
      this.currentSlideIndex = this.steps.length - 1; 
    } else {
      container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
      this.currentSlideIndex--;
    }

    if (this.isPlaying) { 
      this.startCarousel();
    }
  }

  getVisibleCardsCount(): number {
    const width = window.innerWidth;
    if (width >= 1200) return 4;
    if (width >= 992) return 3;
    if (width >= 768) return 2;
    return 1; // Móvil
  }

  navigateToStep(step: OnboardingStepStatus): void {
    if (step.actionRoute) {
      this.router.navigate([step.actionRoute]);
    } else {
      this.notificationService.showInfo(this.translate.instant('ONBOARDING_WIDGET.NO_ACTION_ROUTE_MESSAGE'));
    }
  }
}