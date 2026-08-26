import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MyHistorySearchPeopleDetailsComponent } from './my-history-search-people-details.component';

describe('MyHistorySearchPeopleDetailsComponent', () => {
  let component: MyHistorySearchPeopleDetailsComponent;
  let fixture: ComponentFixture<MyHistorySearchPeopleDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyHistorySearchPeopleDetailsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MyHistorySearchPeopleDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
