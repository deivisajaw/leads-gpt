import { TestBed } from '@angular/core/testing';

import { MyListCompanyService } from './my-list-company.service';

describe('MyListCompanyService', () => {
  let service: MyListCompanyService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MyListCompanyService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
