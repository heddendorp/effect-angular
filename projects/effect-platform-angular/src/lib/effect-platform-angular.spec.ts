import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EffectPlatformAngular } from './effect-platform-angular';

describe('EffectPlatformAngular', () => {
  let component: EffectPlatformAngular;
  let fixture: ComponentFixture<EffectPlatformAngular>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EffectPlatformAngular]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EffectPlatformAngular);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
