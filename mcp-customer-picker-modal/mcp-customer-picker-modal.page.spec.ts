import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { MCPCustomerPickerModalPage } from './mcp-customer-picker-modal.page';

describe('MCPCustomerPickerModalPage', () => {
	let component: MCPCustomerPickerModalPage;
	let fixture: ComponentFixture<MCPCustomerPickerModalPage>;

	beforeEach(async(() => {
		TestBed.configureTestingModule({
			declarations: [MCPCustomerPickerModalPage],
			schemas: [CUSTOM_ELEMENTS_SCHEMA],
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(MCPCustomerPickerModalPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
