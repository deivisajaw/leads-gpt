import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MySearchHistoryCompaniesComponent } from './my-search-history-companies.component';

describe('MySearchHistoryCompaniesComponent', () => {
  let component: MySearchHistoryCompaniesComponent;
  let fixture: ComponentFixture<MySearchHistoryCompaniesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MySearchHistoryCompaniesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MySearchHistoryCompaniesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
