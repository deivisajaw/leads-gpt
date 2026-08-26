import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MyListCompanyComponent } from './my-list-company.component';

describe('MyListCompanyComponent', () => {
  let component: MyListCompanyComponent;
  let fixture: ComponentFixture<MyListCompanyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyListCompanyComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MyListCompanyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
