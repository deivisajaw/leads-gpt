import { TestBed } from '@angular/core/testing';

import { AsideEventsService } from './aside-events.service';

describe('AsideEventsService', () => {
  let service: AsideEventsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AsideEventsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
