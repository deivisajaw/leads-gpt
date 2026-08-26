import { Component } from '@angular/core';
import { RouterLink } from '@angular/router'; 
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-upgrade-plan',
  standalone: true,
  imports: [TranslateModule, RouterLink],
  templateUrl: './upgrade-plan.component.html',
  styleUrl: './upgrade-plan.component.css'
})
export class UpgradePlanComponent {

}
