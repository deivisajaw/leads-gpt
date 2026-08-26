import { Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MyListCompanyService } from '../../services/my-list-company.service';

@Component({
  selector: 'app-company-details',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './company-details.component.html',
  styleUrl: './company-details.component.css'
})
export class CompanyDetailsComponent implements OnInit {
  company: any = null;
  isLoading = false;
  companyId: number = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private myListCompanyService: MyListCompanyService
  ) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.companyId = +params['id'];
      this.loadCompanyDetails();
    });
  }

  async loadCompanyDetails() {
    this.isLoading = true;
    try {
      const result = await this.myListCompanyService.getCompanyDetails(this.companyId);
      if (result.error) {
        console.error('Error loading company details:', result.message);
      } else {
        this.company = result;
      }
    } catch (error) {
      console.error('Error loading company details:', error);
    } finally {
      this.isLoading = false;
    }
  }

  goBack() {
    this.location.back();
  }
}