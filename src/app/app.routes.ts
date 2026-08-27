import { Routes } from '@angular/router';
import { PublicLayoutComponent } from './layouts/public-layout/public-layout.component';
import { LoginComponent } from './pages/login/login.component';
import { AuthLayoutComponent } from './layouts/auth-layout/auth-layout.component';
import { DashboardHomeComponent } from './pages/dashboard-home/dashboard-home.component';
import { PeopleComponent } from './pages/people/people.component';
import { CompaniesComponent } from './pages/companies/companies.component';
import { MyListPeopleComponent } from './pages/my-list-people/my-list-people.component';
import { MyListCompanyComponent } from './pages/my-list-company/my-list-company.component';
import { MySearchHistoryPeoplesComponent } from './pages/my-search-history-peoples/my-search-history-peoples.component';
import { MySearchHistoryCompaniesComponent } from './pages/my-search-history-companies/my-search-history-companies.component';
import { authGuard } from './guards/auth.guard';
import { PageNotFoundRedirectComponent } from './components/page-not-found-redirect/page-not-found-redirect.component';
import { guestGuard } from './guards/guest.guard';
import { CompanyDetailsComponent } from './pages/company-details/company-details.component';
import { PeopleDetailsComponent } from './pages/people-details/people-details.component';
import { CampaignsComponent } from './pages/campaigns/campaigns.component';
import { EmailsComponent } from './pages/emails/emails.component';
import { CallsComponent } from './pages/calls/calls.component';
import { premiumPlanGuard } from './guards/premium-plan.guard';
import { UpgradePlanComponent } from './pages/upgrade-plan/upgrade-plan.component';
import { PlansComponent } from './pages/plans/plans.component';
import { SubscriptionManagementComponent } from './pages/subscription-management/subscription-management.component';
import { canAccessPlansGuard } from './guards/can-access-plans.guard';
import { canManageSubscriptionGuard } from './guards/can-manage-subscription.guard';
import { UserconfigComponent } from './pages/userconfig/userconfig.component';
import { MeetingsComponent } from './pages/meetings/meetings.component';
import { ConversationsComponent } from './pages/conversations/conversations.component';
import { DealsComponent } from './pages/deals/deals.component';
import { TasksComponent } from './pages/tasks/tasks.component';
import { WorkflowsComponent } from './pages/workflows/workflows.component';
import { AdminUsersComponent } from './pages/admin-users/admin-users.component';
import { AgentsComponent } from './pages/agents/agents.component';
import { AgentViewComponent } from './pages/agent-view/agent-view.component';
import { SuccessPaymentComponent } from './pages/success-payment/success-payment.component'; 
import { PaymentHistoryComponent } from './pages/payment-history/payment-history.component';
import { PlansListComponent } from './pages/plans-list/plans-list.component';
import { hasPlanGuard } from './guards/has-plan.guard';
import { RedeemInvitationCodeComponent } from './pages/redeem-invitation-code/redeem-invitation-code.component';
import { noPlanGuard } from './guards/no-plan.guard';
import { MyPlanComponent } from './pages/my-plan/my-plan.component';
import { isAdminGuard } from './guards/isAdmin.guard';
import { MyHistorySearchPeopleDetailsComponent } from './pages/my-history-search-people-details/my-history-search-people-details.component';
import { MyHistorySearchCompanyDetailsComponent } from './pages/my-history-search-company-details/my-history-search-company-details.component';
import { AnalyticsComponent } from './pages/analytics/analytics.component';
import { AdminDashboardComponent } from './pages/admin-dashboard/admin-dashboard.component';
import { RecoveryPasswordComponent } from './pages/recovery-password/recovery-password.component';
import { ResetPasswordComponent } from './pages/reset-password/reset-password.component';
import { PhoneNumberComponent } from './pages/phone-number/phone-number.component';
import { CampaignViewComponent } from './pages/campaign-view/campaign-view.component';
import { CampaignRecordingsViewComponent } from './pages/campaign-recordings-view/campaign-recordings-view.component';
import { MessagesComponent } from './pages/messages/messages.component';
import { MeetingDetailComponent } from './pages/meeting-detail/meeting-detail.component';
import { ConversationDetailComponent } from './pages/conversation-detail/conversation-detail.component';
import { LegalComponent } from './pages/legal/legal.component';
import { InstagramConnectedComponent } from './pages/instagram-connected/instagram-connected.component';
import { MyListsComponent } from './pages/my-lists/my-lists.component';
import { MyListDetailComponent } from './pages/my-list-detail/my-list-detail.component';
import { AbandonedCheckoutDetailComponent } from './pages/abandoned-checkout-detail/abandoned-checkout-detail.component';


export const routes: Routes = [
  { path: 'success-payment', component: SuccessPaymentComponent }, 
  {
    path: '',
    component: PublicLayoutComponent,
    children: [
      { path: '', component: LoginComponent, canActivate: [guestGuard] },
      { path: 'login', component: LoginComponent, canActivate: [guestGuard] },
      { path: 'signup', component: LoginComponent, canActivate: [guestGuard] },
      { path: 'recovery-password', component: RecoveryPasswordComponent, canActivate: [guestGuard] },
      { path: 'reset-password', component: ResetPasswordComponent, canActivate: [guestGuard] },
      { path: 'instagram/connected', component: InstagramConnectedComponent }
    ]
  },
  {
    path: '',
    component: AuthLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', component: DashboardHomeComponent },
      { path: 'people', component: PeopleComponent },
      { path: 'companies', component: CompaniesComponent },
      { path: 'my-list-people', component: MyListPeopleComponent },
      { path: 'my-list-company', component: MyListCompanyComponent },
      { path: 'company-details/:id', component: CompanyDetailsComponent },
      { path: 'people-details/:id', component: PeopleDetailsComponent },
      { path: 'my-search-history-peoples', component: MySearchHistoryPeoplesComponent },
      { path: 'my-search-history-companies', component: MySearchHistoryCompaniesComponent },
      { path: 'my-history-search-people-details/:id', component: MyHistorySearchPeopleDetailsComponent },
      { path: 'my-history-search-company-details/:id', component: MyHistorySearchCompanyDetailsComponent }, 
      { path: 'my-lists', component: MyListsComponent },
      { path: 'my-lists/:id', component: MyListDetailComponent },
      { path: 'campaigns', component: CampaignsComponent },
      { path: 'campaigns/:id', component: CampaignViewComponent },
      { path: 'campaigns/:id/recordings', component: CampaignRecordingsViewComponent },
      { path: 'analytics', component: AnalyticsComponent, canActivate: [premiumPlanGuard] },
      { path: 'agents', component: AgentsComponent },
      { path: 'agents/:id', component: AgentViewComponent, canActivate: [premiumPlanGuard] },
      { path: 'phone-numbers', component: PhoneNumberComponent },
      { path: 'emails', component: EmailsComponent, canActivate: [premiumPlanGuard] },
      { path: 'messages', component: MessagesComponent, canActivate: [premiumPlanGuard] },
      { path: 'calls', component: CallsComponent, canActivate: [premiumPlanGuard] },
      { path: 'meetings', component: MeetingsComponent, canActivate: [premiumPlanGuard] },
      { path: 'meetings/:uid', component: MeetingDetailComponent, canActivate: [premiumPlanGuard] },
      { path: 'conversations', component: ConversationsComponent, canActivate: [premiumPlanGuard] },
      { path: 'conversations/:id',  component: ConversationDetailComponent },
      { path: 'deals', component: DealsComponent, canActivate: [premiumPlanGuard] },
      { path: 'tasks', component: TasksComponent, canActivate: [premiumPlanGuard] },
      { path: 'workflows', component: WorkflowsComponent, canActivate: [premiumPlanGuard] },
      { path: 'workflows/abandoned-checkout/:id', component: AbandonedCheckoutDetailComponent, canActivate: [premiumPlanGuard] },
      { path: 'upgrade-plan', component: UpgradePlanComponent },
      { path: 'plans', component: PlansComponent, canActivate: [canAccessPlansGuard] },
      { path: 'subscription-management', component: SubscriptionManagementComponent, canActivate: [canManageSubscriptionGuard] },
      { path: 'userconfig', component: UserconfigComponent },
      { path: 'my-plan', component: MyPlanComponent, canActivate: [hasPlanGuard] },
      { path: 'admin-users', component: AdminUsersComponent, canActivate: [hasPlanGuard, isAdminGuard] },
      { path: 'admin-dashboard', component: AdminDashboardComponent, canActivate: [hasPlanGuard, isAdminGuard] },
      { path: 'payment-history', component: PaymentHistoryComponent, canActivate: [hasPlanGuard, isAdminGuard] },
      { path: 'plans-list', component: PlansListComponent, canActivate: [hasPlanGuard] },
      { path: 'redeem-code', component: RedeemInvitationCodeComponent },
      { path: 'legal/terms', component: LegalComponent},
      { path: 'legal/privacy', component: LegalComponent}
    ]  
  },
  { path: '**', component: PageNotFoundRedirectComponent }
];