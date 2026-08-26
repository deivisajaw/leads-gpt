import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MyHistorySearchCompanyDetailsComponent } from './my-history-search-company-details.component';

describe('MyHistorySearchCompanyDetailsComponent', () => {
  let component: MyHistorySearchCompanyDetailsComponent;
  let fixture: ComponentFixture<MyHistorySearchCompanyDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyHistorySearchCompanyDetailsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MyHistorySearchCompanyDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
