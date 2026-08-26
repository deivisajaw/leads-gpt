import { Component, OnInit, Input, Output, EventEmitter, OnChanges, SimpleChanges, ViewChild, ElementRef, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OnboardingQuestion } from '../../services/auth.service';
import { TranslateModule } from '@ngx-translate/core';
import { Router } from '@angular/router';

interface Answer {
  answerText: string | null;
  selectedOption: number | null;
  selectedOptions: number[];
}

@Component({
  selector: 'app-onboarding-wizard',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './onboarding-wizard.component.html',
  styleUrls: ['./onboarding-wizard.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class OnboardingWizardComponent implements OnInit, OnChanges {

  @Input() questions: OnboardingQuestion[] = [];
  @Output() completed = new EventEmitter<any[]>();

  currentStep = 0;
  answers: { [questionId: number]: Answer } = {};

  // Estados de animación, carga y video solicitados
  isRegistering = false;
  showCinematic = false;

  @ViewChild('cineVideo') cineVideo!: ElementRef<HTMLVideoElement>;

  constructor(private router: Router) { }

  ngOnInit(): void {
    this.initializeAnswers();

    setTimeout(() => {
      const win = window as any;
      
      if (!win.particlesJS) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/particles.js@2.0.0/particles.min.js';
        script.async = true;
        script.onload = () => this.cargarConfiguracionParticles();
        document.head.appendChild(script);
      } else {
        this.cargarConfiguracionParticles();
      }
    }, 50);
  }

  private cargarConfiguracionParticles(): void {
    const win = window as any;
    if (win.particlesJS) {
      win.particlesJS('particles-js', {
        "particles": {
          "number": { "value": 60, "density": { "enable": true, "value_area": 800 } },
          "color": { "value": "#3E34F9" }, // Azul corporativo
          "shape": { "type": "circle" },
          "opacity": { "value": 0.15, "random": false },
          "size": { "value": 4, "random": true },
          "line_linked": { "enable": true, "distance": 150, "color": "#3E34F9", "opacity": 0.08, "width": 1 },
          "move": { "enable": true, "speed": 1.5, "direction": "none", "out_mode": "out" }
        },
        "interactivity": {
          "detect_on": "canvas",
          "events": { "onhover": { "enable": true, "mode": "grab" } },
          "modes": { "grab": { "distance": 140, "line_linked": { "opacity": 0.25 } } }
        },
        "retina_detect": true
      });
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['questions'] && changes['questions'].currentValue) {
      this.initializeAnswers();
    }
  }

  initializeAnswers(): void {
    this.answers = {};
    this.questions.forEach(q => {
      this.ensureAnswerObject(q.id);
    });
  }

  ensureAnswerObject(questionId: number): void {
    if (!this.answers[questionId]) {
      this.answers[questionId] = {
        answerText: null,
        selectedOption: null,
        selectedOptions: []
      };
    }
  }

  selectOption(questionId: number, optionId: number): void {
    this.ensureAnswerObject(questionId);
    const questionType = this.questions.find(q => q.id === questionId)?.questionType;

    if (questionType === 'SINGLE_SELECT') {
      this.answers[questionId].selectedOption = optionId;
      // Avance automático en SINGLE_SELECT
      this.handleAutomaticAdvance();
    } else if (questionType === 'MULTI_SELECT') {
      const selectedOptions = this.answers[questionId].selectedOptions;
      const index = selectedOptions.indexOf(optionId);
      if (index > -1) {
        selectedOptions.splice(index, 1);
      } else {
        selectedOptions.push(optionId);
      }
    }
  }

  selectBooleanOption(questionId: number, value: 'true' | 'false'): void {
    this.ensureAnswerObject(questionId);
    this.answers[questionId].answerText = value;
    // Avance automático en BOOLEAN
    this.handleAutomaticAdvance();
  }

  isOptionSelected(questionId: number, optionId: number): boolean {
    return this.answers[questionId]?.selectedOptions.includes(optionId) || false;
  }

  handleAutomaticAdvance(): void {
    setTimeout(() => {
      if (this.currentStep < this.questions.length - 1) {
        this.currentStep++;
      } else {
        this.finish();
      }
    }, 250); // Pequeña pausa para feedback visual del click
  }

  skipStep(): void {
    if (this.currentStep < this.questions.length - 1) {
      this.currentStep++;
    } else {
      this.finish();
    }
  }

  isCurrentStepValid(): boolean {
    if (!this.questions || this.questions.length === 0) {
      return false;
    }
    const currentQuestion = this.questions[this.currentStep];
    const currentAnswer = this.answers[currentQuestion.id];

    if (!currentAnswer) {
      return false;
    }

    switch (currentQuestion.questionType) {
      case 'TEXT':
      case 'DATE':
      case 'NUMBER_INTEGER':
      case 'NUMBER_DECIMAL':
        return currentAnswer.answerText !== null && currentAnswer.answerText.trim() !== '';
      case 'BOOLEAN':
        return currentAnswer.answerText !== null;
      case 'SINGLE_SELECT':
        return currentAnswer.selectedOption !== null;
      case 'MULTI_SELECT':
        return currentAnswer.selectedOptions.length > 0;
      default:
        return false;
    }
  }

  previousStep(): void {
    if (this.currentStep > 0) {
      this.currentStep--;
    }
  }

  finish(): void {
    // Generar el payload formateado con las respuestas actuales
    const formattedAnswers = Object.keys(this.answers).map(questionIdStr => {
      const questionId = parseInt(questionIdStr, 10);
      const answer = this.answers[questionId];
      return {
        id: questionId,
        selectedOption: answer.selectedOption,
        answerText: answer.answerText,
        selectedOptions: answer.selectedOptions
      };
    });

    // 1. Activamos el estado de carga (muestra "Preparando tu cuenta...")
    this.isRegistering = true;

    // 2. Emitimos las respuestas al componente login
    this.completed.emit(formattedAnswers);
  }

  public handleWebhookSuccess(): void {
    setTimeout(() => {
      this.isRegistering = false;
      this.showCinematic = true;

      setTimeout(() => {
        if (this.cineVideo && this.cineVideo.nativeElement) {
          const video = this.cineVideo.nativeElement;
          video.muted = true;
          video.playbackRate = 3.0;
          video.play().then(() => {
            video.addEventListener('ended', () => {
              this.showCinematic = false;
              this.router.navigate(['/dashboard']);
            });
          }).catch(err => {
            console.error('Error al reproducir el video automáticamente:', err);
            this.router.navigate(['/dashboard']);
          });
        }
      }, 50);
    }, 1000);
  }

  public handleWebhookError(): void {
    this.isRegistering = false;
    
    // Opcional: Si quieres reiniciar el paso actual al primero o dejarlo en el último
    // this.currentStep = 0; 
  }
}