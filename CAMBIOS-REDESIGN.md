# Cambios del rediseño UI — branch `redesign-ui`

**Para:** Deivis · **De:** Giuliano + Claude · **Fecha:** 2026-08-28
**PR:** https://github.com/ajaw-ai/leads-gpt/pull/1 (17 commits, 47 archivos, +1,375 / −271 líneas)

**Regla que seguimos en todo el branch:** cero cambios en services, API, guards ni lógica de datos. Todo es CSS, HTML, i18n y helpers presentacionales en componentes. Abajo va archivo por archivo para que puedas cruzarlo con tus cambios locales de ayer.

---

## Global

| Archivo | Qué cambió |
|---|---|
| `src/styles.css` | **El archivo más tocado (+278).** Inter aplicado al body (estaba cargado pero sin usar) + Space Grotesk como `--font-display` (h1–h4 y números de métricas). `thead/th` global: blanco con texto gris (antes indigo sólido con texto blanco). Hover de filas con tinte indigo `#f7f8ff`. Botones primarios globales → gradiente de marca (bloque con `!important` al final del archivo, selectores: `.btn-primary`, `.btn-action.view`, `.play-btn`, `.btn-retry`, etc.). Sidebar: section-titles más discretos, active pill con sombra suave, tamaños de iconos Lucide, logo wordmark (138px, `.logo-mark-only` en móvil ≤768px). Skeleton loaders reutilizables (`.sk-*`). Botones de empty-state compactados. `.header-section` con más padding y h1 oscuro (antes morado). |
| `src/index.html` | Google Fonts: se agregaron pesos de Inter (500, 800) y **Space Grotesk**. |
| `public/i18n/es.json` / `en.json` | `MARKETING_AI` → "MARKETING IA". Sección `PLANS`: hero nuevo ("La plataforma todo-en-uno…"), chips `STEP1/STEP2`, desglose de créditos (`CREDIT_USE_*`). `PAYMENT_MODAL`: copy nuevo para el checkout instantáneo. |
| `public/images/ajaw-logo-trim.png` | **Archivo nuevo.** El wordmark real sin los márgenes internos del PNG original. |
| `public/images/gear_white.png` | **Archivo nuevo.** El engranaje en blanco con fondo transparente (para el chip de créditos). |
| `.gitignore` | Se agregó `.claude/`. |

## Componentes compartidos

| Archivo | Qué cambió |
|---|---|
| `aside.component.html` | **36 iconos Font Awesome → SVGs Lucide inline** (solo los `<i>` → `<svg>`, la estructura/lógica de nav quedó igual). Logo: `<span>` de texto → `<img>` del wordmark + icono redondo para colapsado. |
| `onboarding-widget.component.ts/.html/.css` | El mensaje "¡Enhorabuena!" ahora aparece **una sola vez** (localStorage `ajawOnboardingCongratsSeen`), como barra slim con auto-fade a los 8s + botón cerrar. Nuevo `@Input() forceShow` para re-abrir el carrusel de pasos desde el home ("Guía de inicio"), solo vista. |
| `onboarding-wizard.component.css/.ts` | Signup: azul → gradiente (barra de progreso, bordes hover/selección con truco padding-box/border-box, glifos de iconos vía background-clip). Delay artificial de "Preparando tu cuenta": 1000ms → 300ms. |
| `search-chat.component.ts/.html/.css` | Título grande se oculta al iniciar el chat (le faltaba el `*ngIf="!hasStarted"` que ya tenían greeting/subtitle). Títulos rotativos (`pickWittyTitle()`: ~70% calmados / ~30% motivacionales + pool nocturno 22–5h). Saludo con texto gradiente. |
| `payment-link-modal.component.*` | **El link de pago se abre solo** en pestaña nueva (`ngOnInit` + `window.open`); el modal queda de respaldo anti popup-blocker con botón gradiente "Ir al pago seguro" en vez del URL crudo. **La generación del link en n8n quedó intacta** — mismo request, misma respuesta. |

## Páginas

| Archivo | Qué cambió |
|---|---|
| `campaigns.component.html/.ts/.css` | Tiles de métricas arriba (getters presentacionales: `totalCampaigns`, `activeCampaigns`, sumas de leads/meetings) — siempre visibles, con ceros si no hay datos. Toolbar patrón-Agentes: búsqueda + filtros tipo/estado (`filteredCampaigns`, filtrado presentacional del array ya cargado) + botón a la derecha. `*ngFor` ahora itera `filteredCampaigns`. Iconos de métricas con gradiente. |
| `dashboard-home.component.*` | Chips del header pulidos (labels envuelven, ya no se cortan). Iconos KPI → gradiente (antes cada uno de un color). **Embudo de Conversión: doughnut → breakdown estilo Shopify** (HTML/CSS con `funnelSteps` — getter **memoizado por referencia**; ver nota abajo). Charts en familia índigo (antes rosa/celeste/amarillo). Bloque "Guía de inicio" bajo Ajaw Academic (`showGuide` + `toggleGuide()`). |
| `people.component.*` / `companies.component.*` | Chip de créditos estilo pill con **engranaje AJAW y pulso** cuando cambia `creditsRemaining` (`ngDoCheck` presentacional — ver nota abajo). Sparklines con stroke gradiente (SVG `<defs>` compartido inyectado al inicio del template). |
| `my-list-people.component.html/.ts` | Skeleton shimmer en vez de spinner. `displayTitle()`: helper de solo presentación que quita el nombre duplicado del campo Cargo ("Nombre - Cargo" → "Cargo"). Sin zebra striping. Sin uppercase inline en los th. |
| `plans.component.html/.ts/.css` | Hero estilo Apollo + chips "Paso 1/2" + desglose visual de créditos. Preselección del **primer plan pago** (antes caía en el gratis). El payload de pago no cambió. |
| `messages.component.html/.css` | Error técnico de Chatwoot → estado amigable ("No pudimos cargar tus mensajes…"). |
| `campaign-view.component.css` | `.hero-title` con `color: #fff` explícito (el h1 global oscuro lo pisaba sobre el banner gradiente). |
| `campaign-recordings-view.component.css` | Título morado → oscuro. |
| `calls / workflows / conversations / deals / meetings / my-history-search-*` (.css) | Solo colores: headers de tabla blancos, iconos de métricas al gradiente, títulos oscuros, pill "Todas" gradiente (meetings). En workflows además se corrigió texto blanco invisible en el thead. |

---

## ⚠️ Notas técnicas importantes (léelas antes de mergear)

1. **Getters + `*ngFor` = página congelada.** Un getter que devuelve un array nuevo en cada ciclo de change detection hace que ngFor reconstruya el DOM en loop (mismo bug que documentaste en search-chat con quickPrompts). Por eso `funnelSteps` está **memoizado por referencia**. Si agregas listas derivadas, usa el mismo patrón.
2. **`ngDoCheck` en people/companies** es solo para la animación del chip de créditos — no toca datos. Cuando hagas la tarea **AI-65** (push de saldo en tiempo real), solo necesitas llamar `authService.updateCurrentUserCredits(newBalance)` y el pulso se dispara solo.
3. **`archivo.bin` (~100MB)** en la raíz del repo hace lentos los `git add -A` — considera sacarlo.
4. Si tus cambios de ayer tocan `styles.css`, `campaigns`, `dashboard-home`, `people/companies` o el `aside`, ahí van a estar los conflictos — el resto de archivos casi seguro mergea limpio. Cualquier conflicto raro: comenta en el PR y lo resolvemos.
