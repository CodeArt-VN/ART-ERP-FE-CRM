import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { MCPPage } from './mcp.page';

describe('MCPPage', () => {
	let component: MCPPage;
	let fixture: ComponentFixture<MCPPage>;

	beforeEach(async(() => {
		TestBed.configureTestingModule({
			declarations: [MCPPage],
			imports: [IonicModule.forRoot()],
		}).compileComponents();

		fixture = TestBed.createComponent(MCPPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
