# AJAW · People Search — demo funcional (handoff)

## Qué es
Demo completo del flujo de búsqueda de personas de AJAW, **100% front-end en UN solo archivo**: `ajaw_people_search.html`. Sin build, sin dependencias, sin backend — se abre en cualquier navegador o se sube a cualquier hosting tal cual.

Flujo: **Hero con globo (página de inicio) → chat con la IA (estilo Shopify Sidekick) → la IA confirma qué va a scrapear → panel de resultados estilo Apollo.**

## Cómo correrlo
- Doble click al archivo, o
- Subirlo a cualquier hosting / carpeta pública y abrir la URL, o
- Embeberlo con `<iframe src=".../ajaw_people_search.html" style="width:100%;height:100vh;border:0">`.

El mapa del globo (continentes) va **embebido dentro del HTML** (data URI) — no necesita archivos extra. El `earth_landmask_720.png` incluido es la misma máscara por si se quiere servir aparte (el código la busca como fallback en `earth_landmask_720.png` junto al HTML y en `https://data.ajaw.ai/images/earth_landmask_720.png`, que hoy da 404 — súbanla ahí para arreglar también el dashboard viejo).

## Qué es simulado (para conectar al backend real)
Todo el "scraping" es teatro client-side. Puntos de conexión en el JS (buscar estos nombres):
- `parseQuery(text)` — parsea nicho/ciudad/señales del texto. Reemplazar por el endpoint NLU real.
- `genLeads(cfg, count)` — genera los leads fake. Reemplazar por el query real a la base (AJAW DATA).
- `startSearch(cfg)` — orquesta la animación de búsqueda y pinta resultados.
- `revealMail / revealPhone / enrich()` — revelado de email/celular y descuento de créditos (hoy fake, −1/−2).
- `exportCSV(leads)` — ya genera CSV real de lo que esté en pantalla; el filename termina en "(N leads)" (regla de la casa: mantenerla).
- Listas, campañas, historial: estado en memoria (`S.lists`, `S.campaigns`, `S.history`) — persistir en API.

## Reglas de producto que hay que respetar
1. La conversación con la IA **siempre confirma antes de scrapear** (resumen + "Confirmar y scrapear / Cambiar algo"). No saltarse ese paso.
2. El pill del query queda arriba de los resultados con "Editar búsqueda" → vuelve al chat con historial.
3. Botones Ocultar/Mostrar filtros (toolbar con badge de # filtros activos + botón en el rail).
4. Estilo: sidebar blanco + índigo `#5b4fe5`, español. Métricas del hero sin barra separadora (estilo Shopify).

Cualquier duda, es un solo archivo — todo el CSS y JS están adentro, comentados por secciones.
