export interface SignupPayload {
  firstName: string;
  lastName: string;
  companyName: string;
  email: string;
  prefixCountyPhone: string;
  phoneNumber: string;
  password: string;
}

export interface SignupResponse {
  status?: number;
  data?: any[];
  error?: string;
}
