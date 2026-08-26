import { Injectable } from '@angular/core';
import { ApiConfigService } from './api-config.service';

export interface UpdatedCompanyDataResponse {
  companyId: number;
  companyName: string;
  creditDistributionMode: string;
}

export interface CompanyMember {
  id: number;
  fullName: string;
  email: string;
  role: string;
  creditsAllocated: number;
  isActive: boolean;
  userId: number; 
  distributionPriority: number;
}

export interface CompanyData {
  id: number;
  name: string;
  credits: number;
  creditDistributionMode: string;
  minCreditsGuaranteed?: number; // New field
}

export interface CompanyAdminData {
  companyData: CompanyData;
  members: CompanyMember[];
  pagination: {
    totalRecords: number;
    currentPage: number;
    totalPages: number;
  };
}

export interface InvitationCode {
  id: number;
  code: string;
  email: string;
  status: string;
  expiresAt: string | null;
  usedAt: string | null;
  usedBy: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class CompanyDataService {

  constructor(private apiConfig: ApiConfigService) { }

  async getCompanyMembers(): Promise<CompanyAdminData> {
    const token = localStorage.getItem('csrfToken');
    if (!token) {
      throw new Error('No authentication token found');
    }

    try {
      const response = await fetch(`${this.apiConfig.baseUrl}/ws/action`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': token
        },
        body: JSON.stringify({
          action: 'com.ajawmrp3.apps.prospectingai.web.CompanyDataController:getCompanyMembers',
          data: {}
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.data?.error || result.status === -1) {
        throw new Error(result.data?.message || result.message || 'Unknown error from API');
      }

      return result.data as CompanyAdminData;

    } catch (error) {
      console.error('Error fetching company members:', error);
      throw error;
    }
  }

  async updateCompanyData(
    companyId: number,
    companyName: string,
    creditDistributionMode: string,
    minCreditsGuaranteed: number | undefined // New parameter
  ): Promise<UpdatedCompanyDataResponse> {
    const token = localStorage.getItem('csrfToken');
    if (!token) {
      throw new Error('No authentication token found');
    }

    try {

      const response = await fetch(`${this.apiConfig.baseUrl}/ws/action`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': token
        },
        body: JSON.stringify({
          action: 'com.ajawmrp3.apps.prospectingai.web.CompanyDataController:updateCompanyData',
          data: {
            _companyId: companyId,
            _newCompanyName: companyName,
            _newCreditDistributionMode: creditDistributionMode,
            _newMinCreditsGuaranteed: minCreditsGuaranteed // New parameter
          }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.data?.error || result.status === -1) {
        throw new Error(result.data?.message || result.message || 'Unknown error from API');
      }

      // The backend returns the updated data within a companyData field inside data
      return result.data.companyData as UpdatedCompanyDataResponse;

    } catch (error) {
      console.error('Error updating company data:', error);
      throw error; // Re-throw to be handled by the component
    }
  }

  async assignCreditsToMembers(memberIds: number[], credits: number): Promise<void> {
    const token = localStorage.getItem('csrfToken');
    if (!token) {
      throw new Error('No authentication token found');
    }

    try {
      const response = await fetch(`${this.apiConfig.baseUrl}/ws/action`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': token
        },
        body: JSON.stringify({
          action: 'com.ajawmrp3.apps.prospectingai.web.CompanyDataController:assignCreditsToMembers',
          data: {
            _memberIds: memberIds,
            _credits: credits
          }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.data?.error || result.status === -1) {
        throw new Error(result.data?.message || result.message || 'Unknown error from API');
      }

      // Assuming the backend returns success/failure, no specific data needed here
    } catch (error) {
      console.error('Error assigning credits:', error);
      throw error;
    }
  }

  async generateInvitationCode(email: string, expiresAt?: string): Promise<any> {
    const token = localStorage.getItem('csrfToken');
    if (!token) {
      throw new Error('No authentication token found');
    }

    const payload: { _email: string; _expiresAt?: string } = { _email: email };
    if (expiresAt) {
      // Convert local datetime string to ISO 8601 format with Z timezone indicator
      payload._expiresAt = new Date(expiresAt).toISOString();
    }

    try {
      const response = await fetch(`${this.apiConfig.baseUrl}/ws/action`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': token
        },
        body: JSON.stringify({
          action: 'com.ajawmrp3.apps.prospectingai.web.CompanyDataController:generateInvitationCode',
          data: payload
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.data?.error || result.status === -1) {
        throw new Error(result.data?.message || result.message || 'Unknown error from API');
      }

      return result.data;

    } catch (error) {
      console.error('Error generating invitation code:', error);
      throw error;
    }
  }

  async getGeneratedCodes(): Promise<InvitationCode[]> {
    const token = localStorage.getItem('csrfToken');
    if (!token) {
      throw new Error('No authentication token found');
    }

    try {
      const response = await fetch(`${this.apiConfig.baseUrl}/ws/action`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': token
        },
        body: JSON.stringify({
          action: 'com.ajawmrp3.apps.prospectingai.web.CompanyDataController:getGeneratedCodes',
          data: {}
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.data?.error || result.status === -1) {
        throw new Error(result.data?.message || result.message || 'Unknown error from API');
      }

      return result.data.codes as InvitationCode[];

    } catch (error) {
      console.error('Error fetching generated codes:', error);
      throw error;
    }
  }

  async distributeEquitableCredits(creditsToDistribute: number): Promise<any> {
    const token = localStorage.getItem('csrfToken');
    if (!token) {
      throw new Error('No authentication token found');
    }

    try {
      const response = await fetch(`${this.apiConfig.baseUrl}/ws/action`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': token
        },
        body: JSON.stringify({
          action: 'com.ajawmrp3.apps.prospectingai.web.CompanyDataController:distributeEquitableCredits',
          data: { _creditsToDistribute: creditsToDistribute }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.data?.error || result.status === -1) {
        throw new Error(result.data?.message || result.message || 'Unknown error from API');
      }

      return result.data;

    } catch (error) {
      console.error('Error distributing equitable credits:', error);
      throw error;
    }
  }

  async distributeRuleBasedCredits(creditsToDistribute: number): Promise<any> {
    const token = localStorage.getItem('csrfToken');
    if (!token) {
      throw new Error('No authentication token found');
    }

    try {
      const response = await fetch(`${this.apiConfig.baseUrl}/ws/action`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': token
        },
        body: JSON.stringify({
          action: 'com.ajawmrp3.apps.prospectingai.web.CompanyDataController:distributeRuleBasedCredits',
          data: { _creditsToDistribute: creditsToDistribute }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.data?.error || result.status === -1) {
        throw new Error(result.data?.message || result.message || 'Unknown error from API');
      }

      return result.data;

    } catch (error) {
      console.error('Error distributing rule-based credits:', error);
      throw error;
    }
  }

  async redeemInvitationCode(code: string): Promise<any> {
    const token = localStorage.getItem('csrfToken');
    if (!token) {
      throw new Error('No authentication token found');
    }

    try {
      const response = await fetch(`${this.apiConfig.baseUrl}/ws/action`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': token
        },
        body: JSON.stringify({
          action: 'com.ajawmrp3.apps.prospectingai.web.CompanyDataController:redeemInvitationCode',
          data: { _code: code }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.data?.error || result.status === -1) {
        throw new Error(result.data?.message || result.message || 'Unknown error from API');
      }

      return result.data;

    } catch (error) {
      console.error('Error redeeming invitation code:', error);
      throw error;
    }
  }

  async getUserPlanDetails(): Promise<any> {
    const token = localStorage.getItem('csrfToken');
    if (!token) {
      throw new Error('No authentication token found');
    }

    try {
      const response = await fetch(`${this.apiConfig.baseUrl}/ws/action`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': token
        },
        body: JSON.stringify({
          action: 'com.ajawmrp3.apps.prospectingai.web.CompanyDataController:getUserPlanDetails',
          data: {}
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.data?.error || result.status === -1) {
        throw new Error(result.data?.message || result.message || 'Unknown error from API');
      }

      return result.data;

    } catch (error) {
      console.error('Error fetching user plan details:', error);
      throw error;
    }
  }

  async leaveCompanyTeam(): Promise<any> {
    const token = localStorage.getItem('csrfToken');
    if (!token) {
      throw new Error('No authentication token found');
    }

    try {
      const response = await fetch(`${this.apiConfig.baseUrl}/ws/action`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': token
        },
        body: JSON.stringify({
          action: 'com.ajawmrp3.apps.prospectingai.web.CompanyDataController:leaveCompanyTeam',
          data: {}
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.data?.error || result.status === -1) {
        throw new Error(result.data?.message || result.message || 'Unknown error from API');
      }

      return result.data;

    } catch (error) {
      console.error('Error leaving company team:', error);
      throw error;
    }
  }

  async getSubscriptionHistory(): Promise<any> {
    const token = localStorage.getItem('csrfToken');
    if (!token) {
      throw new Error('No authentication token found');
    }

    try {
      const response = await fetch(`${this.apiConfig.baseUrl}/ws/action`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': token
        },
        body: JSON.stringify({
          action: 'com.ajawmrp3.apps.prospectingai.web.CompanyDataController:getSubscriptionHistory',
          data: {}
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.data?.error || result.status === -1) {
        throw new Error(result.data?.message || result.message || 'Unknown error from API');
      }

      return result.data;

    } catch (error) {
      console.error('Error fetching subscription history:', error);
      throw error;
    }
  }

  async deleteCompanyMember(memberId: number): Promise<any> {
    const token = localStorage.getItem('csrfToken');
    if (!token) {
      throw new Error('No authentication token found');
    }

    try {
      const response = await fetch(`${this.apiConfig.baseUrl}/ws/action`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': token
        },
        body: JSON.stringify({
          action: 'com.ajawmrp3.apps.prospectingai.web.CompanyDataController:deleteCompanyMember',
          data: { _memberId: memberId }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.data?.error || result.status === -1) {
        throw new Error(result.data?.message || result.message || 'Unknown error from API');
      }

      return result.data;

    } catch (error) {
      console.error('Error deleting company member:', error);
      throw error;
    }
  }

  async assignCreditsToSingleMember(memberId: number, credits: number): Promise<any> {
    const token = localStorage.getItem('csrfToken');
    if (!token) {
      throw new Error('No authentication token found');
    }

    try {
      const response = await fetch(`${this.apiConfig.baseUrl}/ws/action`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': token
        },
        body: JSON.stringify({
          action: 'com.ajawmrp3.apps.prospectingai.web.CompanyDataController:assignCreditsToMember',
          data: { _memberId: memberId, _credits: credits }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.data?.error || result.status === -1) {
        throw new Error(result.data?.message || result.message || 'Unknown error from API');
      }

      return result.data;

    } catch (error) {
      console.error('Error assigning credits to single member:', error);
      throw error;
    }
  }

  async toggleCompanyMemberStatus(memberId: number): Promise<any> {
    const token = localStorage.getItem('csrfToken');
    if (!token) {
      throw new Error('No authentication token found');
    }

    try {
      const response = await fetch(`${this.apiConfig.baseUrl}/ws/action`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': token
        },
        body: JSON.stringify({
          action: 'com.ajawmrp3.apps.prospectingai.web.CompanyDataController:toggleCompanyMemberStatus',
          data: { _memberId: memberId }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.data?.error || result.status === -1) {
        throw new Error(result.data?.message || result.message || 'Unknown error from API');
      }

      return result.data;

    } catch (error) {
      console.error('Error toggling company member status:', error);
      throw error;
    }
  }

  async withdrawAllCreditsFromMember(memberId: number): Promise<any> {
    const token = localStorage.getItem('csrfToken');
    if (!token) {
      throw new Error('No authentication token found');
    }

    try {
      const response = await fetch(`${this.apiConfig.baseUrl}/ws/action`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': token
        },
        body: JSON.stringify({
          action: 'com.ajawmrp3.apps.prospectingai.web.CompanyDataController:withdrawAllCreditsFromMember',
          data: { _memberId: memberId }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.data?.error || result.status === -1) {
        throw new Error(result.data?.message || result.message || 'Unknown error from API');
      }

      return result.data;

    } catch (error) {
      console.error('Error withdrawing all credits from member:', error);
      throw error;
    }
  }

  async changeMemberRoleToAdmin(memberId: number): Promise<any> {
    const token = localStorage.getItem('csrfToken');
    if (!token) {
      throw new Error('No authentication token found');
    }

    try {
      const response = await fetch(`${this.apiConfig.baseUrl}/ws/action`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': token
        },
        body: JSON.stringify({
          action: 'com.ajawmrp3.apps.prospectingai.web.CompanyDataController:changeMemberRoleToAdmin',
          data: { _memberId: memberId }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.data?.error || result.status === -1) {
        throw new Error(result.data?.message || result.message || 'Unknown error from API');
      }

      return result.data;

    } catch (error) {
      console.error('Error changing member role to admin:', error);
      throw error;
    }
  }

  async changeMemberRoleToMember(memberId: number): Promise<any> {
    const token = localStorage.getItem('csrfToken');
    if (!token) {
      throw new Error('No authentication token found');
    }

    try {
      const response = await fetch(`${this.apiConfig.baseUrl}/ws/action`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': token
        },
        body: JSON.stringify({
          action: 'com.ajawmrp3.apps.prospectingai.web.CompanyDataController:changeMemberRoleToMember',
          data: { _memberId: memberId }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.data?.error || result.status === -1) {
        throw new Error(result.data?.message || result.message || 'Unknown error from API');
      }

      return result.data;

    } catch (error) {
      console.error('Error changing member role to member:', error);
      throw error;
    }
  }

  async getMemberCreditHistory(memberId: number): Promise<any> {
    const token = localStorage.getItem('csrfToken');
    if (!token) {
      throw new Error('No authentication token found');
    }

    try {
      const response = await fetch(`${this.apiConfig.baseUrl}/ws/action`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': token
        },
        body: JSON.stringify({
          action: 'com.ajawmrp3.apps.prospectingai.web.CompanyDataController:getMemberCreditHistory',
          data: { _memberId: memberId }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.data?.error || result.status === -1) {
        throw new Error(result.data?.message || result.message || 'Unknown error from API');
      }

      return result.data;

    } catch (error) {
      console.error('Error fetching member credit history:', error);
      throw error;
    }
  }

  async editMemberCredits(memberId: number, newCreditAmount: number): Promise<any> {
    const token = localStorage.getItem('csrfToken');
    if (!token) {
      throw new Error('No authentication token found');
    }

    try {
      const response = await fetch(`${this.apiConfig.baseUrl}/ws/action`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': token
        },
        body: JSON.stringify({
          action: 'com.ajawmrp3.apps.prospectingai.web.CompanyDataController:editMemberCredits',
          data: { _memberId: memberId, _newCreditAmount: newCreditAmount }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.data?.error || result.status === -1) {
        throw new Error(result.data?.message || result.message || 'Unknown error from API');
      }

      return result.data;

    } catch (error) {
      console.error('Error editing member credits:', error);
      throw error;
    }
  }

  async getCreditHistoryByCompany(): Promise<any> {
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
        action: 'com.ajawmrp3.apps.prospectingai.web.CompanyDataController:getCreditHistoryByCompany',
        data: {} 
      })
    });
   
    if (!response.ok) {
     throw new Error(`HTTP error! status: ${response.status}`);
    }
   
    const apiResponse = await response.json();
   
    if (apiResponse.data && apiResponse.data.error) {
      throw new Error(apiResponse.data.message || 'Error fetching grouped credit history.');
    }
    
    return apiResponse.data;
  } 

  async updateMemberDistributionPriority(memberId: number, newPriority: number): Promise<any> {
    const token = localStorage.getItem('csrfToken');
    if (!token) {
      throw new Error('No authentication token found');
    }

    try {
      const response = await fetch(`${this.apiConfig.baseUrl}/ws/action`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': token
        },
        body: JSON.stringify({
          action: 'com.ajawmrp3.apps.prospectingai.web.CompanyDataController:updateMemberDistributionPriority',
          data: { _memberId: memberId, _newPriority: newPriority }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.data?.error || result.status === -1) {
        throw new Error(result.data?.message || result.message || 'Unknown error from API');
      }

      return result.data;

    } catch (error) {
      console.error('Error editing member priority:', error);
      throw error;
    }
  }
}