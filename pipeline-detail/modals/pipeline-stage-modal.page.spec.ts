import { FormBuilder } from '@angular/forms';
import { TestBed } from '@angular/core/testing';

import { HistoryService } from 'src/app/services/custom/history.service';
import { PipelineStageModalPage } from './pipeline-stage-modal.page';
import { PipelineTaskModalPage } from './pipeline-task-modal.page';

/** Builds the popup without rendering it: only the services the task list touches are stubs. */
function build(saveFails = false, dismissRole?: string, reloaded: any[] = []) {
	const taskModal = {
		present: jasmine.createSpy('present').and.returnValue(Promise.resolve()),
		onWillDismiss: jasmine.createSpy('onWillDismiss').and.returnValue(Promise.resolve({ role: dismissRole })),
	};
	const modalController = {
		create: jasmine.createSpy('create').and.returnValue(Promise.resolve(taskModal)),
		dismiss: jasmine.createSpy('dismiss').and.returnValue(Promise.resolve()),
	};
	const stageProvider = { save: jasmine.createSpy('stageSave').and.returnValue(Promise.resolve({})) };
	const taskProvider = {
		read: jasmine.createSpy('read').and.returnValue(Promise.resolve({ data: reloaded })),
		save: jasmine.createSpy('save').and.callFake(() => (saveFails ? Promise.reject(new Error('boom')) : Promise.resolve())),
	};
	const env = { showMessage: jasmine.createSpy('showMessage'), showAlert: jasmine.createSpy('showAlert'), translateResource: (k: string) => Promise.resolve(k) };
	TestBed.configureTestingModule({ providers: [{ provide: HistoryService, useValue: {} }] });
	// PageBase injects HistoryService in a field initializer, so the popup needs an injection context.
	const page = TestBed.runInInjectionContext(
		() => new PipelineStageModalPage(stageProvider as any, taskProvider as any, env as any, {} as any, {} as any, modalController as any, {} as any, new FormBuilder(), { detectChanges: () => {} } as any, {} as any)
	);
	page.item = { Id: 7, Name: 'Stage 7' };
	page.pipeline = { Id: 1 };
	page.tasks = [
		{ Id: 1, IDStage: 7, Name: 'A', Sort: 1 },
		{ Id: 2, IDStage: 7, Name: 'B', Sort: 2 },
		{ Id: 3, IDStage: 7, Name: 'C', Sort: 3 },
	];
	page.ngOnInit();
	return { page, taskProvider, stageProvider, env, modalController };
}

/** What ion-reorder-group gives the handler: move one item, return the new array. */
function drop(from: number, to: number): any {
	return {
		detail: {
			complete: (list: any[]) => {
				const copy = [...list];
				const [moved] = copy.splice(from, 1);
				copy.splice(to, 0, moved);
				return copy;
			},
		},
	};
}

describe('PipelineStageModalPage colour', () => {
	it('loads the stage colour into the form', () => {
		const { page } = build();
		page.item = { Id: 7, Name: 'Stage 7', Icon: 'heart-outline', Color: 'danger' };
		page.ngOnInit();
		expect(page.formGroup.get('Color')?.value).toBe('danger');
	});

	it('saves the chosen colour and keeps the stage icon', async () => {
		const { page, stageProvider, modalController } = build();
		page.item = { ...page.item, Icon: 'flag-outline' };
		page.formGroup.patchValue({ Color: 'success' });
		await page.saveChange();
		const body = stageProvider.save.calls.mostRecent().args[0];
		expect(body.Color).toBe('success');
		expect(body.Icon).toBe('flag-outline');
		expect(body.Id).toBe(7);
		expect(modalController.dismiss).toHaveBeenCalledWith(null, 'saved');
	});
});

describe('PipelineStageModalPage task list', () => {
	it('copies the stage tasks into the list on init, sort mode off', () => {
		const { page } = build();
		expect(page.taskList.map((t: any) => t.Id)).toEqual([1, 2, 3]);
		expect(page.sorting).toBeFalse();
	});

	it('toggleSort switches the drag handles on and off', () => {
		const { page } = build();
		page.toggleSort();
		expect(page.sorting).toBeTrue();
		page.toggleSort();
		expect(page.sorting).toBeFalse();
	});

	it('a drop reorders the list and saves only the moved rows', async () => {
		const { page, taskProvider } = build();
		page.toggleSort();
		await page.onTaskReorder(drop(2, 1)); // A C B
		expect(page.taskList.map((t: any) => [t.Id, t.Sort])).toEqual([
			[1, 1],
			[3, 2],
			[2, 3],
		]);
		const saved = taskProvider.save.calls.allArgs().map((a: any) => a[0].Id);
		expect(saved).toEqual([3, 2]);
	});

	it('a second drop compares against the order that was just saved', async () => {
		const { page, taskProvider } = build();
		page.toggleSort();
		await page.onTaskReorder(drop(2, 1)); // A C B
		taskProvider.save.calls.reset();
		await page.onTaskReorder(drop(1, 2)); // A B C again
		expect(taskProvider.save.calls.allArgs().map((a: any) => a[0].Id)).toEqual([2, 3]);
	});

	it('a drop that changes nothing saves nothing', async () => {
		const { page, taskProvider } = build();
		page.toggleSort();
		await page.onTaskReorder(drop(1, 1));
		expect(taskProvider.save).not.toHaveBeenCalled();
	});

	it('restores the previous order and reports the error when a save fails', async () => {
		const { page, env } = build(true);
		page.toggleSort();
		await page.onTaskReorder(drop(2, 0)); // C A B
		expect(page.taskList.map((t: any) => t.Id)).toEqual([1, 2, 3]);
		expect(page.taskList.map((t: any) => t.Sort)).toEqual([1, 2, 3]);
		expect(env.showMessage).toHaveBeenCalledWith('boom', 'danger');
	});

	it('edit opens the task popup for that task in this stage', async () => {
		const { page, modalController } = build();
		await page.editTask(page.taskList[1]);
		const opts = modalController.create.calls.mostRecent().args[0] as any;
		expect(opts.component).toBe(PipelineTaskModalPage);
		expect(opts.componentProps.item.Id).toBe(2);
		expect(opts.componentProps.stage).toBe(page.item);
		expect(opts.componentProps.pipeline).toBe(page.pipeline);
	});

	it('gives the task popup every stage and task so a task can move to another stage', async () => {
		const { page, modalController } = build();
		page.stages = [{ Id: 7 }, { Id: 8 }];
		page.allTasks = [{ Id: 1, IDStage: 7 }, { Id: 9, IDStage: 8 }];
		await page.editTask(page.taskList[0]);
		const opts = modalController.create.calls.mostRecent().args[0] as any;
		expect(opts.componentProps.stages).toBe(page.stages);
		expect(opts.componentProps.tasks).toBe(page.allTasks);
	});

	it('reloads this stage tasks after the task popup saved', async () => {
		const { page, taskProvider } = build(false, 'saved', [
			{ Id: 2, IDStage: 7, Name: 'B edited', Sort: 1 },
			{ Id: 9, IDStage: 8, Name: 'other stage', Sort: 1 },
		]);
		await page.editTask(page.taskList[1]);
		expect(taskProvider.read).toHaveBeenCalled();
		expect(page.taskList.map((t: any) => t.Name)).toEqual(['B edited']);
	});

	it('keeps the list when the task popup is cancelled', async () => {
		const { page, taskProvider } = build();
		await page.editTask(page.taskList[0]);
		expect(taskProvider.read).not.toHaveBeenCalled();
		expect(page.taskList.length).toBe(3);
	});

	it('add opens the task popup with a new task at the end of this stage', async () => {
		const { page, modalController } = build();
		await page.addTask();
		const opts = modalController.create.calls.mostRecent().args[0] as any;
		expect(opts.component).toBe(PipelineTaskModalPage);
		expect(opts.componentProps.item.Id).toBeFalsy();
		expect(opts.componentProps.item.IDStage).toBe(7);
		expect(opts.componentProps.item.Sort).toBeGreaterThan(3);
		expect(opts.componentProps.stage).toBe(page.item);
	});
});
