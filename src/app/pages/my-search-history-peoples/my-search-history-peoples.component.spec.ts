import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MySearchHistoryPeoplesComponent } from './my-search-history-peoples.component';

describe('MySearchHistoryPeoplesComponent', () => {
  let component: MySearchHistoryPeoplesComponent;
  let fixture: ComponentFixture<MySearchHistoryPeoplesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MySearchHistoryPeoplesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MySearchHistoryPeoplesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
