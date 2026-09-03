import {
  Component, Input, Output, EventEmitter,
  OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked, Renderer2
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiConfigService } from '../../services/api-config.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

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
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './search-chat.component.html',
  styleUrl: './search-chat.component.css',
})
export class SearchChatComponent implements OnInit, AfterViewChecked, OnDestroy {
  @Input() mode: SearchChatMode = 'people';
  @Output() searchReady = new EventEmitter<SearchReadyResult>();

  /**
   * El agente contestó pero NO pidió pintar resultados.
   *
   * El prompt le prohíbe expresamente responder "buscando eso ahora" sin
   * llamar a finalize_search, porque el turno termina y el usuario se queda
   * esperando algo que nunca llega. Aun así lo hace: contesta esa frase exacta,
   * la búsqueda queda creada con resultados y la pantalla nunca los muestra.
   *
   * La interfaz no puede depender de que el modelo se porte bien. Con esto, el
   * contenedor va a mirar si se creó una búsqueda y la pinta igual.
   */
  @Output() repliedWithoutResults = new EventEmitter<void>();

  /** Lo que escribio el usuario, por si el agente devuelve los campos vacios. */
  @Output() userAsked = new EventEmitter<string>();
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
  title = '';
  subtitle = '';
  inputPlaceholder = '';
  // IMPORTANTE: quickPrompts se calcula UNA sola vez (ngOnInit) y se guarda como propiedad
  // estable, no como getter. Un getter usado en *ngFor crea un array (y objetos) nuevos en
  // cada ciclo de change detection —Angular no puede saber que son "los mismos" chips porque
  // cambian de identidad todo el tiempo, así que destruye y vuelve a crear ese DOM en cada
  // ciclo. Como Angular dispara change detection en cada evento (incluido mousemove), eso
  // termina congelando la pestaña con solo mover el mouse. Con una propiedad fija esto no pasa.
  quickPrompts: QuickPrompt[] = [];

  private langSub?: Subscription;

  constructor(
    private apiConfig: ApiConfigService,
    private renderer: Renderer2,
    private translate: TranslateService,
  ) { }

  ngOnInit(): void {
    // Estos textos se arman una sola vez con translate.instant(), no con el pipe
    // (el título y los chips no deben cambiar en cada ciclo de detección).
    //
    // Pero instant() devuelve la CLAVE si el archivo de idioma todavía no llegó,
    // y nada en el arranque espera a que llegue: en una carga en frío la portada
    // habría mostrado "SEARCH_CHAT.CALM_CO_1". Por eso esperamos con get(), que
    // resuelve cuando el idioma activo está cargado, y volvemos a armarlos si el
    // usuario cambia de idioma.
    this.translate.get('SEARCH_CHAT.CALM_CO_1').subscribe(() => this.buildCopy());
    this.langSub = this.translate.onLangChange.subscribe(() => this.buildCopy());

    window.addEventListener('resize', this.resizeListener);
  }

  private buildCopy(): void {
    this.title = this.pickWittyTitle();
    this.subtitle = this.t(this.mode === 'companies' ? 'SUB_CO' : 'SUB_PE');
    this.inputPlaceholder = this.t(this.mode === 'companies' ? 'PH_CO' : 'PH_PE');
    this.greeting = this.computeGreeting();
    this.quickPrompts = this.buildQuickPrompts();
    // Sólo se saluda una vez: si ya hay conversación, no se pisa.
    if (!this.messages.length) this.startConversation();
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
    this.langSub?.unsubscribe();
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
    if (hour >= 22 || hour < 5) { return this.t('NIGHT_MODE') + ' 🌙'; }
    const key = hour < 12 ? 'MORNING' : hour < 19 ? 'AFTERNOON' : 'EVENING';
    return `${this.t(key)} 👋`;
  }

  /** Atajo: todas las cadenas de este componente cuelgan de SEARCH_CHAT. */
  private t(key: string): string {
    return this.translate.instant('SEARCH_CHAT.' + key);
  }

  /** Una de las N variantes de una clave, al azar. */
  private pick(baseKey: string, n: number): string {
    return this.t(`${baseKey}_${1 + Math.floor(Math.random() * n)}`);
  }

  // Titulo rotativo estilo asistente (patron ChatGPT: mayoria de lineas calmadas,
  // toque motivacional ocasional para que no canse)
  private pickWittyTitle(): string {
    const hour = new Date().getHours();
    const night = hour >= 22 || hour < 5;
    const isCompanies = this.mode === 'companies';

    const who = isCompanies ? 'CO' : 'PE';
    if (night) return this.pick(`NIGHT_${who}`, 3);

    // ~70% calmado, ~30% con sabor
    return Math.random() < 0.3
      ? this.pick(`SPICY_${who}`, 3)
      : this.pick(`CALM_${who}`, 4);
  }

  private buildQuickPrompts(): QuickPrompt[] {
    // La etiqueta se traduce; la consulta se manda al agente en el idioma del
    // usuario, que es el que el backend entiende mejor para buscar.
    const who = this.mode === 'people' ? 'PE' : 'CO';
    return [1, 2, 3, 4].map(i => ({
      label: this.t(`CHIP_${who}_${i}`),
      query: this.t(`CHIP_${who}_${i}_Q`),
    }));
  }

  // Mensaje de bienvenida fijo y local — no hace falta llamar al agente solo para saludar.
  private startConversation(): void {
    const greeting = this.t(this.mode === 'companies' ? 'HELLO_CO' : 'HELLO_PE');

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
    this.userAsked.emit(text);

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
      this.pushMsg('assistant', this.t('ERROR_REPLY'));
      return;
    }

    if (!result.searchReady) {
      this.repliedWithoutResults.emit();
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

    this.pushMsg('assistant', result.reply || this.t('TELL_MORE'), result.options);
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