import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { BusinessPartnerPage } from './outlet.page';

describe('BusinessPartnerPage', () => {
	let component: BusinessPartnerPage;
	let fixture: ComponentFixture<BusinessPartnerPage>;

	beforeEach(async(() => {
		TestBed.configureTestingModule({
			declarations: [BusinessPartnerPage],
			imports: [IonicModule.forRoot()],
		}).compileComponents();

		fixture = TestBed.createComponent(BusinessPartnerPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
