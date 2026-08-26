import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

export type LegalSection = 'terms' | 'privacy';

@Component({
  selector: 'app-legal',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './legal.component.html',
  styleUrls: ['./legal.component.css']
})
export class LegalComponent implements OnInit {
  activeSection: LegalSection = 'terms';

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    // Reads the last segment of the path: /legal/terms → 'terms', /legal/privacy → 'privacy'
    this.route.url.subscribe(segments => {
      const last = segments[segments.length - 1]?.path as LegalSection;
      if (last === 'terms' || last === 'privacy') {
        this.activeSection = last;
      }
    });
  }

  showSection(section: LegalSection): void {
    this.activeSection = section;
  }
}
