export interface UserProfile {
  userId: number;
  username: string; 
  email: string; 
  fullName?: string;
  language?: string; 
  creditsPerSearch?: number;
  hideOnboardingWidget?: boolean;

  error?: boolean;
  
  companyProfile?: CompanyProfile; 

  onboardingStatus?: OnboardingStepStatus[]; 
}

export interface CompanyProfile {
  companyId: number;
  companyName: string;
  companyStatus: string;
  companyCredits: number;
  creditDistributionMode: string;
  minCreditsGuaranteed?: number; 
  role: string;
  subscription: SubscriptionProfile | null;
  isActive: boolean;
  distributionPriority?: number;
  creditsAllocated?: number;
}

export interface SubscriptionProfile {
  subscriptionId: number;
  plan: PlanProfile;
  startDate: string; 
  endDate: string;   
  status: 'ACTIVE' | 'PENDING_PAYMENT' | 'CANCELLED' | 'EXPIRED';
  credits: number;
  amount: string;
  billingPeriod: 'ANNUAL' | 'MONTHLY';
  userNumbers: number;
}

export interface PlanProfile {
  id: number;
  name: string;
  price: number;
}

export interface CompanyMember {
  id: number;
  user: {
    id: number;
    username: string; 
    firstName?: string;
    lastName?: string;
  };
  credits: number; 
  distributionPriority?: number;
  minCreditsGuaranteed?: number;
  isActive?: boolean; 
}

export interface OnboardingStepStatus {
  id: number;
  name: string;
  description: string;
  stepKey: string;
  actionRoute: string;
  rewardCredits: number;
  orderItem: number;
  icon: string;
  nature: 'INDIVIDUAL' | 'COLLABORATIVE';
  applicableRole: 'ALL' | 'ADMIN';
  isCompleted: boolean;
  completedOn: string | null; 
}