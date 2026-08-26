import { TestBed } from '@angular/core/testing';

import { MyListPeopleService } from './my-list-people.service';

describe('MyListPeopleService', () => {
  let service: MyListPeopleService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MyListPeopleService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
