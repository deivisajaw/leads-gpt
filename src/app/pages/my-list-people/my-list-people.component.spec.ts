import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MyListPeopleComponent } from './my-list-people.component';

describe('MyListPeopleComponent', () => {
  let component: MyListPeopleComponent;
  let fixture: ComponentFixture<MyListPeopleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyListPeopleComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MyListPeopleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
