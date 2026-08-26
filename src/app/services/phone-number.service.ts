import { Injectable, inject } from '@angular/core';
import { ApiConfigService } from './api-config.service';

export interface PhoneNumber {
  id: number;
  twilioPhone: string;
  companyDataId: number; 
}

@Injectable({
  providedIn: 'root'
})
export class PhoneNumberService {
  private apiConfig = inject(ApiConfigService);

  private async fetchDataAxelor(action: string, data: any): Promise<any> {
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
      body: JSON.stringify({ action, data })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    if (result.error) {
      throw new Error(result.error.message || 'Unknown error');
    }
    return result.data;
  }

  async getCompanyPhoneNumbers(companyDataId: number): Promise<PhoneNumber[]> {
    const response = await this.fetchDataAxelor(
      'com.ajawmrp3.apps.prospectingai.web.CompanyPhoneNumberController:getPhoneNumbers',
      { companyDataId }
    );
    return response.phones || [];
  }

  async getAvailablePhoneNumbers(): Promise<any[]> {
    const response = await fetch(this.apiConfig.availablePhoneNumbersWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ countryCode: 'US' })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    if (result && result.body && result.body.available_phone_numbers) {
      return result.body.available_phone_numbers.map((item: any) => ({
        phoneNumber: item.phone_number,
        friendlyName: item.friendly_name
      }));
    } else {
      throw new Error(result?.message || 'No se encontraron números de teléfono disponibles.');
    }
  }

  async acquirePhoneNumber(phoneNumber: string, companyDataId: number): Promise<any> {
    const response = await fetch(this.apiConfig.acquirePhoneNumberWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phoneNumber, companyDataId })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    
    if (result && typeof result.success === 'string') {
      return result; 
    } else if (result && typeof result.error === 'string') {
      throw new Error(result.error); 
    } else {
      throw new Error('Error al adquirir el número de teléfono. Respuesta inesperada del webhook.');
    }
  }
}
