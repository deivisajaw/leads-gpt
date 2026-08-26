import { Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MyListPeopleService } from '../../services/my-list-people.service';

@Component({
  selector: 'app-people-details',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './people-details.component.html',
  styleUrl: './people-details.component.css'
})
export class PeopleDetailsComponent implements OnInit {
  people: any = null;
  isLoading = false;
  peopleId: number = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private myListPeopleService: MyListPeopleService
  ) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.peopleId = +params['id'];
      this.loadPeopleDetails();
    });
  }

  async loadPeopleDetails() {
    this.isLoading = true;
    try {
      const result = await this.myListPeopleService.getPeopleDetails(this.peopleId);
      if (result.error) {
        console.error('Error loading people details:', result.message);
      } else {
        this.people = result;
      }
    } catch (error) {
      console.error('Error loading people details:', error);
    } finally {
      this.isLoading = false;
    }
  }

  goBack() {
    this.location.back();
  }
}