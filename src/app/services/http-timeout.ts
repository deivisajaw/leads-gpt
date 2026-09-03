/**
 * fetch con tope de tiempo.
 *
 * El fetch del navegador espera para siempre. Si una acción del backend se
 * cuelga, la promesa nunca se resuelve ni se rechaza: el `finally` que apaga el
 * `isLoading` nunca llega a correr y la pantalla se queda con el engranaje
 * girando sin decir nada. Le pasó a AI CRM, a Listas y al Historial.
 *
 * Aquí abortamos pasado el plazo, de forma que el `catch` del llamador se
 * ejecute y la pantalla pueda mostrar un error de verdad.
 */

/** Para lecturas normales: nuestro backend contesta en 50-200 ms. */
export const DEFAULT_TIMEOUT_MS = 45000;

/**
 * Para las búsquedas, que sí tardan de verdad.
 *
 * Medido en vivo: runSearchCompanies tarda ~35 s por llamada porque el scrape
 * corre en ese momento. Con el tope normal de 45 s una búsqueda un poco más
 * lenta se abortaría sola, así que estas van con un margen mucho más ancho.
 */
export const SEARCH_TIMEOUT_MS = 240000;

export class RequestTimeoutError extends Error {
  constructor(url: string) {
    super(`Request timed out: ${url}`);
    this.name = 'RequestTimeoutError';
  }
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  // Si quien llama ya trae su propio AbortSignal, lo respetamos y no lo pisamos.
  if (init.signal) return fetch(input, init);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal });
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new RequestTimeoutError(String(input));
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
