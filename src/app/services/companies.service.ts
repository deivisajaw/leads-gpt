import { Injectable } from "@angular/core";
import { ApiConfigService } from "./api-config.service";
import { fetchWithTimeout, SEARCH_TIMEOUT_MS } from './http-timeout';

export interface Company {
  id: number;
  title: string;
  categoryName: string;
  address: string;
  neighborhood: string;
  street: string;
  city: string;
  postalCode: string;
  state: string;
  countryCode: string;
  phoneUnformatted: string;
  permanentlyClosed: boolean;
  openingHours: string;
  website: string;
  additionalInfo: string;
  error: string;
  errorDescription: string;
  description: string;
  descriptionMd: string;
  email?: string;
  hasEmailOnFile?: boolean;
  hasPhoneOnFile?: boolean;
}

export interface CompanySearchResult {
  notFound: boolean;
  searchString: string;
  results: Company[];
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

export interface CompanySearchHistoryItem {
  id: number;
  searchString: string;
  statusSelect?: number;
  resultsNumber?: number;
  createdOn: string;
}

export interface CompanySearchHistoryResponse {
  error: boolean;
  message?: string;
  history: CompanySearchHistoryItem[];
  total: number;
  offset: number;
  limit: number;
  fetched: number;
  sortBy?: string;
}

export interface CompanySearchResponse {
  status:
    | "SEARCH_NOT_FOUND"
    | "SEARCH_IN_PROGRESS"
    | "SUCCESS"
    | "INSUFFICIENT_CREDITS"
    | "UNAUTHORIZED"
    | "INVALID_INPUT"
    | "ERROR";
  message?: string;
  data?: CompanySearchResult;
}

export interface CompanyDashboardStats {
  leads: number;
  searches: number;
  phones: number;
  emails: number;
}

export interface CompanyDashboardStatsResponse {
  error: boolean;
  message?: string;
  stats?: CompanyDashboardStats;
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

export interface RevealCompanyContactResponse {
  error: boolean;
  message?: string;
  value?: string;
  creditsRemaining?: number;
}

@Injectable({
  providedIn: "root",
})
export class CompaniesService {
  constructor(private apiConfig: ApiConfigService) {}

  async runSearchCompanies(
    query: string,
    offset = 0,
    limit = 25,
    sortBy = "title_asc",
    searchId?: number,
    category?: string,
    location?: string,
  ): Promise<CompanySearchResponse> {
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
            "com.ajawmrp3.apps.prospectingai.web.AiSearchController:runSearchCompanies",
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
      return result.data as CompanySearchResponse;
    } catch (error) {
      console.error("Error in runSearchCompanies:", error);
      return {
        status: "ERROR",
        message: "Error calling API",
      } as CompanySearchResponse;
    }
  }

  async getMySearchHistoryCompanies(
    offset = 0,
    limit = 25,
    sortBy = "createdOn_desc",
  ): Promise<CompanySearchHistoryResponse> {
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
            "com.ajawmrp3.apps.prospectingai.web.AiSearchController:getMySearchHistoryCompanies",
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
      return result.data as CompanySearchHistoryResponse;
    } catch (error) {
      console.error("Error in getMySearchHistoryCompanies:", error);
      return {
        error: true,
        message: "Error calling API",
        history: [],
        total: 0,
        offset: offset,
        limit: limit,
        fetched: 0,
        sortBy: sortBy,
      } as CompanySearchHistoryResponse;
    }
  }

  async getMySearchHistoryCompanyDetails(
    searchId: number,
    offset = 0,
    limit = 25,
    sortBy = "title_asc",
  ): Promise<CompanySearchResult> {
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
            "com.ajawmrp3.apps.prospectingai.web.AiSearchController:getMySearchHistoryCompanyDetails",
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
      return result.data as CompanySearchResult;
    } catch (error) {
      console.error("Error in getMySearchHistoryCompanyDetails:", error);
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
      } as CompanySearchResult;
    }
  }

  async getCompanyDashboardStats(): Promise<CompanyDashboardStatsResponse> {
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
      console.error("Error in getCompanyDashboardStats:", error);
      const errorMessage =
        error instanceof Error ? error.message : "A network error occurred.";
      return {
        error: true,
        message: errorMessage,
      };
    }
  }

  // ─── "Personas sugeridas para ti" (hero de companies) ───
  // Ajusta el nombre de la acción de Axelor cuando esté definida en el backend.
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
            "com.ajawmrp3.apps.prospectingai.web.AiSearchController:getSuggestedProspects",
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

  // ─── Revelar email/teléfono de una empresa (1 crédito por acción) ───
  // Ajusta el nombre de la acción de Axelor cuando esté definida en el backend.
  async revealCompanyEmail(
    companyId: number,
  ): Promise<RevealCompanyContactResponse> {
    return this.revealCompanyContact("getCompanyEmail", companyId);
  }

  async revealCompanyPhone(
    companyId: number,
  ): Promise<RevealCompanyContactResponse> {
    return this.revealCompanyContact("getCompanyPhone", companyId);
  }

  private async revealCompanyContact(
    actionName: string,
    companyId: number,
  ): Promise<RevealCompanyContactResponse> {
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
          data: { companyId },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result.data as RevealCompanyContactResponse;
    } catch (error) {
      console.error(`Error in ${actionName}:`, error);
      return {
        error: true,
        message: "Error calling API",
      };
    }
  }

  async getCompanyResultById(
    id: number,
  ): Promise<{ error: boolean; message?: string; company?: Company }> {
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
            "com.ajawmrp3.apps.prospectingai.web.AiSearchController:getCompanyResultById",
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

      return { error: false, company: data as Company };
    } catch (error) {
      console.error("Error in getCompanyResultById:", error);
      return { error: true, message: "Error calling API" };
    }
  }
}
