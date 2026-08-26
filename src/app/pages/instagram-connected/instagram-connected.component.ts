import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-instagram-connected',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './instagram-connected.component.html',
  styleUrls: ['./instagram-connected.component.css']
})
export class InstagramConnectedComponent implements OnInit {
  status: string = '';
  username: string = '';
  name: string = '';
  hasError: boolean = false;

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.status   = params['status']   || '';
      this.username = params['username'] || '';
      this.name     = params['name']     || '';
      this.hasError = this.status !== 'connected';
    });
  }
}
