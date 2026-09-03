import { Injectable } from '@angular/core';
import { ApiConfigService } from './api-config.service';
import { SignupPayload, SignupResponse } from '../models/signup.model';
import { fetchWithTimeout } from './http-timeout';

@Injectable({
  providedIn: 'root'
})
export class SignupService {

  constructor(private apiConfig: ApiConfigService) { }

  async register(payload: SignupPayload): Promise<SignupResponse> {
    const response = await fetchWithTimeout(this.apiConfig.signupUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'signupauth': 'UIh-9k88vY57L>f=7hF<'
      },
      body: JSON.stringify(payload)
    });

    const rawText = await response.text();
    let responseData: SignupResponse;

    if (!rawText) {
      if (!response.ok) {
        throw new Error('An unknown error occurred during signup.');
      }
      responseData = {} as SignupResponse;
    } else {
      try {
        responseData = JSON.parse(rawText);
      } catch {
        if (!response.ok) {
          throw new Error('An unknown error occurred during signup.');
        }
        responseData = {} as SignupResponse;
      }
    }

    if (!response.ok) {
      throw new Error(responseData.error || 'An unknown error occurred during signup.');
    }

    return responseData;
  }
}