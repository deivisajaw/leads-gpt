import {
  Component, Input, Output, EventEmitter,
  OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked, Renderer2
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiConfigService } from '../../services/api-config.service';

export interface ChatMessage {
  role: 'assistant' | 'user';
  text: string;
  options?: string[];
}

export interface QuickPrompt {
  label: string;
  query: string;
}

export interface SearchReadyResult {
  query: string;
  category: string;
  location: string;
}

export type SearchChatMode = 'people' | 'companies';

@Component({
  selector: 'app-search-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './search-chat.component.html',
  styleUrl: './search-chat.component.css',
})
export class SearchChatComponent implements OnInit, AfterViewChecked, OnDestroy {
  @Input() mode: SearchChatMode = 'people';
  @Output() searchReady = new EventEmitter<SearchReadyResult>();
  // Se emite una sola vez, justo cuando el usuario envía su primer mensaje — el componente
  // padre lo usa para ocultar el resto del contenido (globo, stats, sugeridos) y dejar la
  // pantalla en blanco con solo el header arriba, como pide el diseño.
  @Output() chatStarted = new EventEmitter<void>();

  @ViewChild('messagesEnd') messagesEnd!: ElementRef;
  // El composer se porta a document.body (position:fixed no depende así de ningún ancestro
  // con overflow/transform raros) — el ancla se queda en el flujo normal solo para (a) medir
  // el ancho/posición real del área de contenido (a la derecha del sidebar) y (b) reservar
  // ese espacio para que el resto de la página no salte al quedar el composer fuera de flujo.
  @ViewChild('composerAnchor') composerAnchorRef?: ElementRef<HTMLElement>;
  @ViewChild('composerFixed') composerFixedRef?: ElementRef<HTMLElement>;

  messages: ChatMessage[] = [];
  userInput = '';
  isLoading = false;
  hasStarted = false;

  private shouldScroll = false;
  private composerPortaled = false;
  private resizeListener = () => this.syncComposerPosition();
  // Historial en el formato que espera el backend (role/content) — independiente de
  // `messages`, que es lo que se pinta en pantalla (role/text).
  private history: { role: 'user' | 'assistant'; content: string }[] = [];

  greeting = '';
  title = '¿A quién quieres encontrar hoy?';
  subtitle = 'Encuentra al tomador de decisión correcto en cualquier empresa de Latinoamérica — cada búsqueda llena tu mapa de leads.';
  inputPlaceholder = 'Busca por nombre, cargo o empresa…';
  // IMPORTANTE: quickPrompts se calcula UNA sola vez (ngOnInit) y se guarda como propiedad
  // estable, no como getter. Un getter usado en *ngFor crea un array (y objetos) nuevos en
  // cada ciclo de change detection —Angular no puede saber que son "los mismos" chips porque
  // cambian de identidad todo el tiempo, así que destruye y vuelve a crear ese DOM en cada
  // ciclo. Como Angular dispara change detection en cada evento (incluido mousemove), eso
  // termina congelando la pestaña con solo mover el mouse. Con una propiedad fija esto no pasa.
  quickPrompts: QuickPrompt[] = [];

  constructor(private apiConfig: ApiConfigService, private renderer: Renderer2) { }

  ngOnInit(): void {
    this.title = this.mode === 'companies'
      ? '¿Qué empresa quieres encontrar hoy?'
      : '¿A quién quieres encontrar hoy?';
    this.greeting = this.computeGreeting();
    this.quickPrompts = this.buildQuickPrompts();
    this.startConversation();
    window.addEventListener('resize', this.resizeListener);
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.messagesEnd?.nativeElement?.scrollIntoView({ behavior: 'smooth' });
      this.shouldScroll = false;
    }
    this.portalComposerIfNeeded();
    this.syncComposerPosition();
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.resizeListener);
    // Si el composer quedó portado a body, hay que quitarlo a mano — Angular no sabe que lo
    // movimos fuera de su lugar original en el DOM.
    if (this.composerPortaled && this.composerFixedRef?.nativeElement?.parentNode === document.body) {
      document.body.removeChild(this.composerFixedRef.nativeElement);
    }
  }

  private portalComposerIfNeeded(): void {
    if (!this.composerPortaled && this.composerFixedRef?.nativeElement) {
      this.renderer.appendChild(document.body, this.composerFixedRef.nativeElement);
      this.composerPortaled = true;
    }
  }

  private syncComposerPosition(): void {
    if (!this.composerFixedRef?.nativeElement) return;
    // El fondo blanco debe cubrir TODO el ancho del área de contenido (a la derecha del
    // sidebar) — no solo el ancho de la columna centrada del chat (720px), o quedan franjas
    // grises a los lados. Por eso medimos contra el "shell" de la página (companies-shell o
    // people-shell, el que exista), no contra el ancla angosta.
    const shell = document.querySelector('.companies-shell, .people-shell') as HTMLElement | null;
    const rect = (shell ?? this.composerAnchorRef?.nativeElement)?.getBoundingClientRect();
    if (!rect) return;
    const el = this.composerFixedRef.nativeElement;
    el.style.left = `${rect.left}px`;
    el.style.width = `${rect.width}px`;
  }

  private computeGreeting(): string {
    const hour = new Date().getHours();
    const label = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
    return `${label} 👋`;
  }

  private buildQuickPrompts(): QuickPrompt[] {
    return this.mode === 'people'
      ? [
        { label: 'CEOs · Bogotá', query: 'CEOs y dueños de empresas en Bogotá' },
        { label: 'Gerentes de ventas', query: 'Gerentes de ventas en Colombia' },
        { label: 'Fundadores · Medellín', query: 'Fundadores de empresas en Medellín' },
        { label: 'Directores de marketing', query: 'Directores de marketing en Colombia con anuncios activos' },
      ]
      : [
        { label: 'Startups · fintech MX', query: 'Startups fintech en México' },
        { label: 'SaaS B2B · Colombia', query: 'Empresas SaaS B2B en Colombia con más de 50 empleados' },
        { label: 'Logística en crecimiento', query: 'Compañías logísticas en crecimiento en Latinoamérica' },
        { label: 'Salud · Medellín', query: 'Clínicas y centros de salud en Medellín' },
      ];
  }

  // Mensaje de bienvenida fijo y local — no hace falta llamar al agente solo para saludar.
  private startConversation(): void {
    const greeting = this.mode === 'companies'
      ? '¡Hola! Cuéntame qué tipo de empresa buscas y en qué ciudad, y te ayudo a encontrarla.'
      : '¡Hola! Cuéntame a quién buscas (cargo, ciudad, industria…) y te ayudo a encontrarlo.';

    this.messages = [{ role: 'assistant', text: greeting }];
    this.history = [{ role: 'assistant', content: greeting }];
  }

  // Mientras el agente no diga "searchReady", esto sigue siendo pura conversación — el chat
  // sigue visible y el componente padre (companies/people) no sabe nada de esto todavía. En
  // cuanto el backend responde searchReady=true, se entrega el query final y el chat queda
  // completamente fuera de la ecuación (el padre toma el control con la búsqueda real).
  async send(prefill?: string): Promise<void> {
    const text = (prefill ?? this.userInput).trim();
    if (!text || this.isLoading) return;

    if (!this.hasStarted) {
      this.chatStarted.emit();
    }
    this.hasStarted = true;
    this.userInput = '';

    this.pushMsg('user', text);
    this.history.push({ role: 'user', content: text });

    this.isLoading = true;
    const result = await this.callChatAgent(text);
    this.isLoading = false;

    if (result.error) {
      this.pushMsg('assistant', 'Tuve un problema para responder. ¿Puedes intentar de nuevo?');
      return;
    }

    if (result.searchReady) {
      this.pushMsg('assistant', result.reply || 'Perfecto, buscando eso ahora.');
      setTimeout(() => this.searchReady.emit({
        query: result.query || '',
        category: result.category || '',
        location: result.location || '',
      }), 500);
      return;
    }

    this.pushMsg('assistant', result.reply || 'Cuéntame un poco más.', result.options);
    this.history.push({ role: 'assistant', content: result.reply || '' });
  }

  // El usuario hace clic en una de las opciones que ofreció el agente — se manda como si el
  // usuario la hubiera escrito, así el flujo de conversación sigue exactamente igual.
  selectOption(option: string): void {
    this.send(option);
  }

  usePrompt(prompt: QuickPrompt): void {
    this.send(prompt.query);
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  trackByIndex(index: number): number {
    return index;
  }

  private pushMsg(role: 'assistant' | 'user', text: string, options?: string[]): void {
    this.messages.push({ role, text, options: options && options.length ? options : undefined });
    this.shouldScroll = true;
  }

    private async callChatAgent(
    message: string
  ): Promise<{
    error: boolean;
    reply?: string;
    searchReady?: boolean;
    query?: string;
    category?: string;
    location?: string;
    options?: string[];
  }> {
    try {
      const token = localStorage.getItem('csrfToken');
      if (!token) {
        return { error: true };
      }

      const historyToSend = this.history.slice(0, -1);

      const response = await fetch(`${this.apiConfig.baseUrl}/ws/action`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': token,
        },
        body: JSON.stringify({
          action: 'com.ajawmrp3.apps.prospectingai.web.AiSearchController:chatSearchAgent',
          data: {
            mode: this.mode,
            message: message,
            history: historyToSend,
          },
        }),
      });

      if (!response.ok) {
        return { error: true };
      }

      const json = await response.json();
      const values = json?.data?.[0]?.values ?? json?.data ?? json;

      if (values?.error) {
        return { error: true };
      }

      return {
        error: false,
        reply: values?.reply,
        searchReady: !!values?.searchReady,
        query: values?.query,
        category: values?.category,
        location: values?.location,
        options: Array.isArray(values?.options) ? values.options : undefined,
      };
    } catch (err) {
      console.error('Chat agent error:', err);
      return { error: true };
    }
  }
}