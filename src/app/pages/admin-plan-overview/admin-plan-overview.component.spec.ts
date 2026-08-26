import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminPlanOverviewComponent } from './admin-plan-overview.component';

describe('AdminPlanOverviewComponent', () => {
  let component: AdminPlanOverviewComponent;
  let fixture: ComponentFixture<AdminPlanOverviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminPlanOverviewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminPlanOverviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
