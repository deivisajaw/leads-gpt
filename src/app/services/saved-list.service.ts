import { Injectable } from '@angular/core';
import { ApiConfigService } from './api-config.service';

export interface SavedListSummary {
  id: number;
  name: string;
  description: string;
  companiesCount: number;
  peopleCount: number;
  createdOn: string;
}

export interface SavedListsResponse {
  error: boolean;
  message?: string;
  lists: SavedListSummary[];
}

export interface CreateSavedListResponse {
  error: boolean;
  message?: string;
  list?: { id: number; name: string; description: string };
}

export interface SimpleOkResponse {
  error: boolean;
  message?: string;
}

export interface ListCompaniesResponse {
  error: boolean;
  message?: string;
  companies: any[];
  total?: number;
  offset?: number;
  limit?: number;
}

export interface ListPeoplesResponse {
  error: boolean;
  message?: string;
  peoples: any[];
  total?: number;
  offset?: number;
  limit?: number;
}

export interface AddToListResponse {
  error: boolean;
  message?: string;
  added?: number;
}

@Injectable({
  providedIn: 'root'
})
export class SavedListService {

  constructor(private apiConfig: ApiConfigService) {}

  private async call<T>(action: string, data: Record<string, any>, fallback: T): Promise<T> {
    try {
      const token = localStorage.getItem('csrfToken');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${this.apiConfig.baseUrl}/ws/action`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': token
        },
        body: JSON.stringify({
          action: `com.ajawmrp3.apps.prospectingai.web.AiSearchController:${action}`,
          data
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result.data as T;
    } catch (error) {
      console.error(`Error in ${action}:`, error);
      return fallback;
    }
  }

  // ─── Gestión de listas ───

  async createSavedList(name: string, description?: string): Promise<CreateSavedListResponse> {
    return this.call('createSavedList', { name, description: description || undefined },
      { error: true, message: 'Error creando la lista' });
  }

  async getMySavedLists(): Promise<SavedListsResponse> {
    return this.call('getMySavedLists', {}, { error: true, message: 'Error cargando listas', lists: [] });
  }

  async renameSavedList(listId: number, name: string, description?: string): Promise<SimpleOkResponse> {
    return this.call('renameSavedList', { listId, name, description: description || undefined },
      { error: true, message: 'Error renombrando la lista' });
  }

  async deleteSavedList(listId: number): Promise<SimpleOkResponse> {
    return this.call('deleteSavedList', { listId }, { error: true, message: 'Error borrando la lista' });
  }

  // ─── Contenido de una lista (paginado) ───

  async getSavedListCompanies(listId: number, offset = 0, limit = 25, query = ''): Promise<ListCompaniesResponse> {
    return this.call('getSavedListCompanies', { listId, offset, limit, query: query || undefined },
      { error: true, message: 'Error cargando empresas de la lista', companies: [] });
  }

  async getSavedListPeoples(listId: number, offset = 0, limit = 25, query = ''): Promise<ListPeoplesResponse> {
    return this.call('getSavedListPeoples', { listId, offset, limit, query: query || undefined },
      { error: true, message: 'Error cargando personas de la lista', peoples: [] });
  }

  // ─── Picker: elementos guardados que TODAVÍA NO están en esta lista ───

  async getUnassignedCompaniesForList(listId: number, offset = 0, limit = 25): Promise<ListCompaniesResponse> {
    return this.call('getUnassignedCompaniesForList', { listId, offset, limit },
      { error: true, message: 'Error cargando empresas disponibles', companies: [] });
  }

  async getUnassignedPeoplesForList(listId: number, offset = 0, limit = 25): Promise<ListPeoplesResponse> {
    return this.call('getUnassignedPeoplesForList', { listId, offset, limit },
      { error: true, message: 'Error cargando personas disponibles', peoples: [] });
  }

  // ─── Agregar/quitar elementos ya guardados hacia/desde una lista ───

  async addCompaniesToList(listId: number, savedResultIds: number[]): Promise<AddToListResponse> {
    return this.call('addCompaniesToList', { listId, savedResultIds },
      { error: true, message: 'Error agregando empresas a la lista' });
  }

  async addPeopleToList(listId: number, savedResultIds: number[]): Promise<AddToListResponse> {
    return this.call('addPeopleToList', { listId, savedResultIds },
      { error: true, message: 'Error agregando personas a la lista' });
  }

  async removeCompanyFromList(listId: number, savedResultId: number): Promise<SimpleOkResponse> {
    return this.call('removeCompanyFromList', { listId, savedResultId },
      { error: true, message: 'Error quitando la empresa de la lista' });
  }

  async removePeopleFromList(listId: number, savedResultId: number): Promise<SimpleOkResponse> {
    return this.call('removePeopleFromList', { listId, savedResultId },
      { error: true, message: 'Error quitando la persona de la lista' });
  }
}
