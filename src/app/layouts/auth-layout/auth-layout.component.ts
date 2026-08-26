import { Component, OnInit, Renderer2, Inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { ToastComponent } from '../../components/toast/toast.component';
import { FormsModule } from '@angular/forms';
import { RouterOutlet } from '@angular/router';
import { AsideComponent } from '../../components/aside/aside.component';
import { OnboardingGuideComponent } from '../../components/onboarding-guide/onboarding-guide.component';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-auth-layout',
  standalone: true,
  imports: [RouterOutlet, CommonModule, FormsModule, AsideComponent, ToastComponent, OnboardingGuideComponent],
  templateUrl: './auth-layout.component.html',
  styleUrl: './auth-layout.component.css'
})
export class AuthLayoutComponent implements OnInit {

  constructor(
    private renderer2: Renderer2,
    @Inject(DOCUMENT) private document: Document,
    private translate: TranslateService
  ) { }

  ngOnInit(): void {
    this.loadChatwootScript();
  }

  private loadChatwootScript(): void {

    this.translate.get('AUTH_LAYOUT.CHAT_SUPPORT_TITLE').subscribe((launcherTitle: string) => {
      const script = this.renderer2.createElement('script');
      script.type = 'text/javascript';
      script.innerHTML = `
      window.chatwootSettings = {"position":"right","type":"standard","launcherTitle":"${launcherTitle}"};
      (function(d,t) {
        var BASE_URL="https://chat.ajaw.ai";
        var g=d.createElement(t),s=d.getElementsByTagName(t)[0];
        g.src=BASE_URL+"/packs/js/sdk.js";
        g.async = true;
        s.parentNode.insertBefore(g,s);
        g.onload=function(){
          window.chatwootSDK.run({
            websiteToken: '378baZHez16iriBayLhmv6H9',
            baseUrl: BASE_URL
          })
        }
      })(document,"script");
    `;
      this.renderer2.appendChild(this.document.body, script);
    })

  }
}
