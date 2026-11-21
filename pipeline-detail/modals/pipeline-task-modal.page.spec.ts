import { FormBuilder } from '@angular/forms';
import { TestBed } from '@angular/core/testing';

import { HistoryService } from 'src/app/services/custom/history.service';
import { PipelineTaskModalPage } from './pipeline-task-modal.page';

const STAGES = [
	{ Id: 7, Name: 'Stage 7', IDPipeline: 1 },
	{ Id: 8, Name: 'Stage 8', IDPipeline: 1 },
];
const TASKS = [
	{ Id: 1, IDStage: 7, Name: 'A', Sort: 1 },
	{ Id: 2, IDStage: 8, Name: 'B', Sort: 4 },
	{ Id: 3, IDStage: 8, Name: 'C', Sort: 2 },
];

function build(options: { stages?: any[]; item?: any } = {}) {
	const pageProvider = {
		save: jasmine.createSpy('save').and.returnValue(Promise.resolve({})),
		delete: jasmine.createSpy('delete').and.returnValue(Promise.resolve({})),
	};
	const env = {
		showMessage: jasmine.createSpy('showMessage'),
		showAlert: jasmine.createSpy('showAlert'),
		showPrompt: jasmine.createSpy('showPrompt').and.returnValue(Promise.resolve()),
	};
	const modalController = { dismiss: jasmine.createSpy('dismiss').and.returnValue(Promise.resolve()) };
	TestBed.configureTestingModule({ providers: [{ provide: HistoryService, useValue: {} }] });
	const page = TestBed.runInInjectionContext(
		() => new PipelineTaskModalPage(pageProvider as any, env as any, {} as any, {} as any, modalController as any, {} as any, new FormBuilder(), {} as any, {} as any)
	);
	page.pipeline = { Id: 1 };
	page.stage = STAGES[0];
	page.stages = options.stages ?? STAGES;
	page.tasks = TASKS;
	page.item = options.item ?? { Id: 1, IDPipeline: 1, IDStage: 7, Name: 'A', TaskType: 'Call', IsRequired: false, DueOffsetDays: 0, Sort: 1 };
	page.ngOnInit();
	return { page, pageProvider, env, modalController };
}

describe('PipelineTaskModalPage stage', () => {
	it('offers every stage of the pipeline and selects the task stage', () => {
		const { page } = build();
		expect(page.stageOptions).toEqual([
			{ Id: 7, Name: 'Stage 7' },
			{ Id: 8, Name: 'Stage 8' },
		]);
		expect(page.formGroup.get('IDStage')?.value).toBe(7);
	});

	it('offers only the current stage when no stage list is given', () => {
		const { page } = build({ stages: [] });
		expect(page.stageOptions).toEqual([{ Id: 7, Name: 'Stage 7' }]);
	});

	it('keeps the stage and the sort when the stage is not changed', async () => {
		const { page, pageProvider, modalController } = build();
		page.formGroup.patchValue({ Name: 'A edited' });
		await page.saveChange();
		const body = pageProvider.save.calls.mostRecent().args[0];
		expect(body.IDStage).toBe(7);
		expect(body.Sort).toBe(1);
		expect(modalController.dismiss).toHaveBeenCalledWith(null, 'saved');
	});

	it('moves the task to the end of the chosen stage', async () => {
		const { page, pageProvider } = build();
		page.formGroup.patchValue({ IDStage: 8 });
		await page.saveChange();
		const body = pageProvider.save.calls.mostRecent().args[0];
		expect(body.Id).toBe(1);
		expect(body.IDStage).toBe(8);
		expect(body.Sort).toBe(5); // stage 8 has Sort 4 and 2
	});

	it('a new task moved to an empty stage starts at sort 1', async () => {
		const { page, pageProvider } = build({ item: { Id: 0, IDPipeline: 1, IDStage: 7, Name: 'New', TaskType: 'Call', Sort: 2, _new: true } });
		page.formGroup.patchValue({ IDStage: 99 });
		await page.saveChange();
		const body = pageProvider.save.calls.mostRecent().args[0];
		expect(body.IDStage).toBe(99);
		expect(body.Sort).toBe(1);
		expect('_new' in body).toBeFalse();
	});

	it('refuses a task without a stage', async () => {
		const { page, pageProvider, env } = build();
		page.formGroup.patchValue({ IDStage: null });
		await page.saveChange();
		expect(pageProvider.save).not.toHaveBeenCalled();
		expect(env.showAlert).toHaveBeenCalled();
	});
});
