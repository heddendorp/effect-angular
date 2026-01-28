import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EffectAngularQuery } from './effect-angular-query';

describe('EffectAngularQuery', () => {
  let component: EffectAngularQuery;
  let fixture: ComponentFixture<EffectAngularQuery>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EffectAngularQuery]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EffectAngularQuery);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
