import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { MCPDetailPage } from './mcp-detail.page';

describe('MCPDetailPage', () => {
  let component: MCPDetailPage;
  let fixture: ComponentFixture<MCPDetailPage>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [MCPDetailPage],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(MCPDetailPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
