import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ApiConfigService {
  
  //readonly baseUrl = 'https://data.ajawmrp.com'; 
  readonly baseUrl = 'https://prospecting.ajaw.ai'; 

  readonly paymentUrl = 'https://n8n.ajaw.ai/webhook/payment-link';  
  readonly signupUrl: string = 'https://n8n.ajaw.ai/webhook/signup';
  readonly searchCompanyUrl: string = 'https://n8n.ajaw.ai/webhook/ajaw-leads-bot';
  readonly searchPeopleUrl: string = 'https://n8n.ajaw.ai/webhook/ajaw-linkedin-bot';
  readonly textBotCreatorUrl = 'https://n8n.ajaw.ai/webhook/text-bot-creator';
  readonly voiceBotCreatorUrl = 'https://n8n.ajaw.ai/webhook/voice-bot-creator';
  readonly smsBotCreatorUrl = 'https://n8n.ajaw.ai/webhook/sms-bot-creator';

  readonly voiceCampaignCreatorUrl = 'https://n8n.ajaw.ai/webhook/voice-campaign-creator';

  readonly smsCampaignCreatorUrl = 'https://n8n.ajaw.ai/webhook/sms-campaign-creator';
  
  readonly scrapingPeopleUrl: string = 'https://n8n.ajaw.ai/webhook/ajaw-linkedin-scrape';
  readonly recoveryPasswordUrl: string = 'https://n8n.ajaw.ai/webhook/recovery-password';

  readonly availablePhoneNumbersWebhookUrl = 'https://n8n.ajaw.ai/webhook/available-phone-numbers';

  readonly acquirePhoneNumberWebhookUrl = 'https://n8n.ajaw.ai/webhook/acquire-phone-number';

  readonly aiTestCallmeWebhookUrl = 'https://n8n.ajaw.ai/webhook/ai-test-callme';

  readonly refreshCalendarTokenUrl = 'https://n8n.ajaw.ai/webhook/refresh-calendar-accestoken';
  readonly googleCalendarEventsUrl = 'https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events';

  readonly chatAgentUrl = 'https://n8n.srv858310.hstgr.cloud/webhook/chat-search-agent';

  readonly chatwootProfileUrl = 'https://chat.ajaw.ai/api/v1/profile';
  readonly chatwootBaseUrl    = 'https://chat.ajaw.ai';

  readonly promptGeneratorUrl = 'https://n8n.ajaw.ai/webhook/prompt-generator';

  //readonly chatwootProfileUrl = '/chatwoot-api/api/v1/profile';
  //readonly chatwootBaseUrl    = '/chatwoot-api';

  readonly instagramBotCreatorUrl = 'https://n8n.ajaw.ai/webhook/instagram-bot-creator';

  readonly freeUpAgentUrl = 'https://n8n.ajaw.ai/webhook/free-up-agent';

  readonly abandonedCheckoutCreatorUrl = 'https://n8n.ajaw.ai/webhook/abandoned-checkout-creator';

  //readonly baseUrl = 'http://localhost:8080/ajawmrp3';
  //readonly paymentUrl = 'http://localhost:4210/api/create-payment-link';
  //readonly signupUrl: string = 'http://localhost:4240/singup';
  //readonly searchCompanyUrl: string = 'http://localhost:4220/search';
  //readonly searchPeopleUrl: string = 'http://localhost:4230/search';
  //readonly availablePhoneNumbersWebhookUrl = 'http://localhost:4250/available-phone-numbers';

  constructor() { }
}

