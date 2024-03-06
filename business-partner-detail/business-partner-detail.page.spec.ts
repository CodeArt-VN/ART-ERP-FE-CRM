import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { BusinessPartnerDetailPage } from './business-partner-detail.page';

describe('ContactDetailPage', () => {
  let component: BusinessPartnerDetailPage;
  let fixture: ComponentFixture<BusinessPartnerDetailPage>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [BusinessPartnerDetailPage],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(BusinessPartnerDetailPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
