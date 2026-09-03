import { Injectable } from "@angular/core";
import { ApiConfigService } from "./api-config.service";
import { fetchWithTimeout, SEARCH_TIMEOUT_MS } from './http-timeout';

export interface People {
  id: number;
  name: string;
  title: string;
  link: string;
  snippet: string;
  image: string;
  description: string;
  searchResultStatusSelect: number;
  fullName: string;
  email?: string;
  phone?: string;
  education: string;
  experiencies: string;
  countryCode: string;
  location: string;
  about: string;
  itemSelected: boolean;
  // Campos adicionales para la vista
  avatar: string;
  verified: boolean;
  jobTitle: string;
  company: string;

  hasEmailOnFile?: boolean;
  hasPhoneOnFile?: boolean;
}

export interface PeopleSearchResult {
  notFound: boolean;
  searchString: string;
  results: People[];
  searchId?: number;
  statusSelect?: number;
  resultsNumber?: number;
  offset: number;
  limit: number;
  fetched: number;
  sortBy?: string;
  message?: string;
  error?: boolean;
  creditsRemaining?: number;
}

export interface PeopleSearchHistoryItem {
  id: number;
  searchString: string;
  statusSelect?: number;
  resultsNumber?: number;
  createdOn: string;
}

export interface PeopleSearchHistoryResponse {
  error: boolean;
  message?: string;
  history: PeopleSearchHistoryItem[];
  total: number;
  offset: number;
  limit: number;
  fetched: number;
  sortBy?: string;
}

export interface PeopleSearchResponse {
  // Estos son los estados que el backend devuelve HOY (AiSearchServiceImpl).
  // Antes habia "SEARCH_NOT_FOUND" y "SEARCH_IN_PROGRESS": venian de cuando la
  // busqueda la hacia n8n de forma asincrona. Ese flujo ya no existe — la
  // busqueda es sincrona y devuelve los resultados en la misma respuesta. Que
  // siguieran declarados aqui hizo que el front tuviera ramas para manejar algo
  // que nunca llega.
  status:
    | "SUCCESS"
    | "INSUFFICIENT_CREDITS"
    | "UNAUTHORIZED"
    | "INVALID_INPUT"
    | "ERROR";
  message?: string;
  data?: PeopleSearchResult;
}

export interface SuggestedProspect {
  id: string | number;
  name: string;
  role: string;
  company: string;
  city: string;
  verified: boolean;
}

export interface SuggestedProspectsResponse {
  error: boolean;
  message?: string;
  prospects: SuggestedProspect[];
}

export interface RevealPeopleContactResponse {
  error: boolean;
  message?: string;
  value?: string;
  creditsRemaining?: number;
}

export interface PeopleDashboardStats {
  leads: number;
  searches: number;
  phones: number;
  emails: number;
}

export interface PeopleDashboardStatsResponse {
  error: boolean;
  message?: string;
  stats?: PeopleDashboardStats;
}

@Injectable({
  providedIn: "root",
})
export class PeopleService {
  constructor(private apiConfig: ApiConfigService) {}

  async runSearchPeople(
    query: string,
    offset = 0,
    limit = 25,
    sortBy = "name_asc",
    searchId?: number,
    category?: string,
    location?: string,
  ): Promise<PeopleSearchResponse> {
    try {
      const token = localStorage.getItem("csrfToken");

      if (!token) {
        throw new Error("No authentication token found");
      }

      const response = await fetchWithTimeout(`${this.apiConfig.baseUrl}/ws/action`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": token,
        },
        body: JSON.stringify({
          action:
            "com.ajawmrp3.apps.prospectingai.web.AiSearchController:runSearchPeople",
          data: {
            query: query,
            category: category || undefined,
            location: location || undefined,
            offset: offset,
            limit: limit,
            sortBy: sortBy,
            searchId: searchId || undefined,
          },
        }),
      }, SEARCH_TIMEOUT_MS);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      return result.data as PeopleSearchResponse;
    } catch (error) {
      console.error("Error in runSearchPeople:", error);
      return {
        status: "ERROR",
        message: "Error calling API",
      } as PeopleSearchResponse;
    }
  }

  async getMySearchHistoryPeoples(
    offset = 0,
    limit = 25,
    sortBy = "createdOn_desc",
  ): Promise<PeopleSearchHistoryResponse> {
    try {
      const token = localStorage.getItem("csrfToken");
      if (!token) {
        throw new Error("No authentication token found");
      }

      const response = await fetchWithTimeout(`${this.apiConfig.baseUrl}/ws/action`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": token,
        },
        body: JSON.stringify({
          action:
            "com.ajawmrp3.apps.prospectingai.web.AiSearchController:getMySearchHistoryPeoples",
          data: {
            offset: offset,
            limit: limit,
            sortBy: sortBy,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result.data as PeopleSearchHistoryResponse;
    } catch (error) {
      console.error("Error in getMySearchHistoryPeoples:", error);
      return {
        error: true,
        message: "Error calling API",
        history: [],
        total: 0,
        offset: offset,
        limit: limit,
        fetched: 0,
        sortBy: sortBy,
      } as PeopleSearchHistoryResponse;
    }
  }

  async getMySearchHistoryPeopleDetails(
    searchId: number,
    offset = 0,
    limit = 25,
    sortBy = "name_asc",
  ): Promise<PeopleSearchResult> {
    try {
      const token = localStorage.getItem("csrfToken");
      if (!token) {
        throw new Error("No authentication token found");
      }

      const response = await fetchWithTimeout(`${this.apiConfig.baseUrl}/ws/action`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": token,
        },
        body: JSON.stringify({
          action:
            "com.ajawmrp3.apps.prospectingai.web.AiSearchController:getMySearchHistoryPeopleDetails",
          data: {
            searchId: searchId,
            offset: offset,
            limit: limit,
            sortBy: sortBy,
          },
        }),
      }, SEARCH_TIMEOUT_MS);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result.data as PeopleSearchResult;
    } catch (error) {
      console.error("Error in getMySearchHistoryPeopleDetails:", error);
      return {
        error: true,
        message: "Error calling API",
        notFound: true,
        searchString: "",
        results: [],
        offset: offset,
        limit: limit,
        fetched: 0,
        sortBy: sortBy,
      } as PeopleSearchResult;
    }
  }

  // ─── "Personas sugeridas para ti" ───
  async getSuggestedProspects(limit = 3): Promise<SuggestedProspectsResponse> {
    try {
      const token = localStorage.getItem("csrfToken");
      if (!token) {
        throw new Error("No authentication token found");
      }

      const response = await fetchWithTimeout(`${this.apiConfig.baseUrl}/ws/action`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": token,
        },
        body: JSON.stringify({
          action:
            "com.ajawmrp3.apps.prospectingai.web.AiSearchController:getSuggestedPeopleProspects",
          data: { limit },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result.data as SuggestedProspectsResponse;
    } catch (error) {
      console.error("Error in getSuggestedProspects:", error);
      return {
        error: true,
        message: "Error calling API",
        prospects: [],
      };
    }
  }

  // ─── Revelar email/teléfono de una persona (1 crédito por acción) ───
  // OJO: nombres de acción ASUMIDOS siguiendo la misma convención que
  // getCompanyEmail/getCompanyPhone en companies. Si tu backend usa otro nombre para estos
  // dos métodos de people, ajústalo aquí (y en el AiSearchController).
  async revealPeopleEmail(
    peopleId: number,
  ): Promise<RevealPeopleContactResponse> {
    return this.revealPeopleContact("getPeopleEmail", peopleId);
  }

  async revealPeoplePhone(
    peopleId: number,
  ): Promise<RevealPeopleContactResponse> {
    return this.revealPeopleContact("getPeoplePhone", peopleId);
  }

  private async revealPeopleContact(
    actionName: string,
    peopleId: number,
  ): Promise<RevealPeopleContactResponse> {
    try {
      const token = localStorage.getItem("csrfToken");
      if (!token) {
        throw new Error("No authentication token found");
      }

      const response = await fetchWithTimeout(`${this.apiConfig.baseUrl}/ws/action`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": token,
        },
        body: JSON.stringify({
          action: `com.ajawmrp3.apps.prospectingai.web.AiSearchController:${actionName}`,
          data: { peopleId },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result.data as RevealPeopleContactResponse;
    } catch (error) {
      console.error(`Error in ${actionName}:`, error);
      return {
        error: true,
        message: "Error calling API",
      };
    }
  }

  // ─── Stats del dashboard de la vista inicial ───
  async getDashboardStats(): Promise<PeopleDashboardStatsResponse> {
    try {
      const token = localStorage.getItem("csrfToken");
      if (!token) {
        throw new Error("No authentication token found");
      }

      const response = await fetchWithTimeout(`${this.apiConfig.baseUrl}/ws/action`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": token,
        },
        body: JSON.stringify({
          action:
            "com.ajawmrp3.apps.prospectingai.web.AiSearchController:getStatistics",
          data: {},
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      // La respuesta real viene anidada: { status, data: { data: { scrapedLeads, searches, phones, emails }, error } }
      const payload = result.data;

      if (payload?.error) {
        return {
          error: true,
          message:
            payload.message ||
            "An unknown error occurred while fetching stats.",
        };
      }

      const stats = payload?.data ?? {};

      return {
        error: false,
        stats: {
          leads: stats.scrapedLeads ?? 0,
          searches: stats.searches ?? 0,
          phones: stats.phones ?? 0,
          emails: stats.emails ?? 0,
        },
      };
    } catch (error) {
      console.error("Error in getDashboardStats:", error);
      const errorMessage =
        error instanceof Error ? error.message : "A network error occurred.";
      return {
        error: true,
        message: errorMessage,
      };
    }
  }

  async getPeopleResultById(
    id: number,
  ): Promise<{ error: boolean; message?: string; person?: People }> {
    try {
      const token = localStorage.getItem("csrfToken");
      if (!token) {
        throw new Error("No authentication token found");
      }

      const response = await fetchWithTimeout(`${this.apiConfig.baseUrl}/ws/action`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": token,
        },
        body: JSON.stringify({
          action:
            "com.ajawmrp3.apps.prospectingai.web.AiSearchController:getPeopleResultById",
          data: { _id: id },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      const data = result.data;

      if (data?.error) {
        return { error: true, message: data.message };
      }

      return { error: false, person: data as People };
    } catch (error) {
      console.error("Error in getPeopleResultById:", error);
      return { error: true, message: "Error calling API" };
    }
  }
}
