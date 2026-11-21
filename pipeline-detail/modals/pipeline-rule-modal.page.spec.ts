import { FormBuilder } from '@angular/forms';
import { TestBed } from '@angular/core/testing';

import { HistoryService } from 'src/app/services/custom/history.service';
import { PipelineRuleModalPage } from './pipeline-rule-modal.page';

function build(options: { existing?: any[]; saveError?: any } = {}) {
	const pageProvider = {
		read: jasmine.createSpy('read').and.returnValue(Promise.resolve({ data: options.existing || [] })),
		save: jasmine.createSpy('save').and.callFake(() => (options.saveError ? Promise.reject(options.saveError) : Promise.resolve({}))),
		delete: jasmine.createSpy('delete').and.returnValue(Promise.resolve({})),
	};
	const env = {
		showMessage: jasmine.createSpy('showMessage'),
		showAlert: jasmine.createSpy('showAlert'),
		showPrompt: jasmine.createSpy('showPrompt').and.returnValue(Promise.resolve()),
		translateResource: (k: string) => Promise.resolve(k),
	};
	const modalController = { dismiss: jasmine.createSpy('dismiss').and.returnValue(Promise.resolve()) };
	TestBed.configureTestingModule({ providers: [{ provide: HistoryService, useValue: {} }] });
	const page = TestBed.runInInjectionContext(
		() => new PipelineRuleModalPage(pageProvider as any, env as any, {} as any, {} as any, modalController as any, {} as any, new FormBuilder(), {} as any, {} as any)
	);
	page.pipeline = { Id: 1 };
	page.item = { Id: 0, IDPipeline: 1, Name: '', Priority: 0, Sort: 3, IDTargetBranch: 9, _new: true };
	page.ngOnInit();
	return { page, pageProvider, env, modalController };
}

describe('PipelineRuleModalPage', () => {
	it('refuses a rule without a name or with min above max', async () => {
		const { page, pageProvider, env } = build();
		await page.saveChange();
		expect(env.showAlert).toHaveBeenCalled();
		page.formGroup.patchValue({ Name: 'R', MinGuests: 50, MaxGuests: 10 });
		await page.saveChange();
		expect(pageProvider.save).not.toHaveBeenCalled();
		expect(env.showAlert.calls.count()).toBe(2);
	});

	it('saves empty conditions as null without a Code, then dismisses saved', async () => {
		const { page, pageProvider, modalController } = build();
		page.formGroup.patchValue({ Name: 'Tiệc cưới lớn', MinGuests: 100, MaxGuests: '', CustomerType: '', IDServiceType: 5670 });
		await page.saveChange();
		const body = pageProvider.save.calls.mostRecent().args[0];
		expect('Code' in body).toBeFalse();
		expect(body.IDServiceType).toBe(5670);
		expect(body.MinGuests).toBe(100);
		expect(body.MaxGuests).toBeNull();
		expect(body.CustomerType).toBeNull();
		expect(body.IDTargetBranch).toBe(9);
		expect(body._new).toBeUndefined();
		expect(modalController.dismiss).toHaveBeenCalledWith(null, 'saved');
	});

	it('keeps the seeded code of an existing rule', async () => {
		const { page, pageProvider } = build();
		page.item = { ...page.item, Id: 4, Name: 'Old', Code: 'CORP_EVENT' };
		page.ngOnInit();
		page.formGroup.patchValue({ Priority: 2 });
		await page.saveChange();
		expect(pageProvider.save.calls.mostRecent().args[0].Code).toBe('CORP_EVENT');
	});

	it('shows the error when the save fails and stays open', async () => {
		const { page, env, modalController } = build({ saveError: new Error('boom') });
		page.formGroup.patchValue({ Name: 'R' });
		await page.saveChange();
		expect(env.showMessage).toHaveBeenCalledWith('boom', 'danger');
		expect(modalController.dismiss).not.toHaveBeenCalled();
	});

	it('delete removes the rule after the prompt and dismisses saved', async () => {
		const { page, pageProvider, modalController } = build();
		page.item = { ...page.item, Id: 4, Name: 'Old' };
		await page.delete();
		expect(pageProvider.delete).toHaveBeenCalledWith(page.item);
		expect(modalController.dismiss).toHaveBeenCalledWith(null, 'saved');
	});
});
