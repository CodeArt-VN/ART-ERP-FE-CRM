import { ChangeDetectorRef, Component, Input } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AlertController, ItemReorderEventDetail, LoadingController, ModalController, NavController } from '@ionic/angular';

import { PageBase } from 'src/app/page-base';
import { EnvService } from 'src/app/services/core/env.service';
import { CRM_PipelineStageProvider, CRM_PipelineStageTaskProvider } from 'src/app/services/static/services.service';
import { PipelineTaskModalPage } from './pipeline-task-modal.page';
import { STAGE_OUTCOMES, TASK_ICONS, changedSortRows, renumberRows, stageErrors, newTask, tasksOfStage, toPayload } from '../pipeline-config.util';

/** Popup to add or edit one pipeline stage. Dismisses with role `saved` after a save or delete. */
@Component({
	selector: 'app-pipeline-stage-modal',
	templateUrl: './pipeline-stage-modal.page.html',
	standalone: false,
})
export class PipelineStageModalPage extends PageBase {
	@Input() item: any;
	@Input() pipeline: { Id?: number };
	/** Tasks of this stage, already sorted by Sort. */
	@Input() tasks: any[] = [];
	/** Every stage and every task of the pipeline, passed on to the task popup so a task can move to another stage. */
	@Input() stages: any[] = [];
	@Input() allTasks: any[] = [];

	outcomes = STAGE_OUTCOMES.map((c) => ({ Code: c, Name: c }));
	taskList: any[] = [];
	taskIcons = TASK_ICONS;
	/** Drag handles show on the task list while on; each drop saves the moved rows. */
	sorting = false;
	private sortBefore: { Id: number; Sort: number }[] = [];

	constructor(
		public pageProvider: CRM_PipelineStageProvider,
		public taskProvider: CRM_PipelineStageTaskProvider,
		public env: EnvService,
		public navCtrl: NavController,
		public route: ActivatedRoute,
		public modalController: ModalController,
		public alertCtrl: AlertController,
		public formBuilder: FormBuilder,
		public cdr: ChangeDetectorRef,
		public loadingController: LoadingController
	) {
		super();
		this.pageConfig.isDetailPage = true;
		this.formGroup = formBuilder.group({
			Name: ['', Validators.required],
			Color: [''],
			Outcome: ['Open'],
			Probability: [0],
			ExpectedDays: [null],
			SLAHours: [null],
			Guide: [''],
			ExternalNames: [''],
			IsRequireLostReason: [false],
		});
	}

	// A popup has no route data to load, so skip the PageBase page bootstrap.
	ngOnInit() {
		// ng-select shows the label as is, so translate the outcome options.
		Promise.all(STAGE_OUTCOMES.map(async (c) => ({ Code: c, Name: ((await this.env.translateResource(c)) as string) || c }))).then((list) => (this.outcomes = list));
		this.formGroup.patchValue(this.item);
		this.formGroup.markAsPristine();
		this.taskList = [...(this.tasks || [])];
		this.pageConfig.showSpinner = false;
	}

	/** New task at the end of this stage, in the same popup as edit. */
	addTask() {
		return this.editTask(newTask(this.item, this.taskList));
	}

	/** Edit one task in its own popup, then reload the list here. */
	async editTask(task: any) {
		const modal = await this.modalController.create({
			component: PipelineTaskModalPage,
			componentProps: { item: { ...task }, pipeline: this.pipeline, stage: this.item, stages: this.stages, tasks: this.allTasks },
			cssClass: 'form-1column',
			breakpoints: [0, 0.25, 0.5, 0.75, 1],
			initialBreakpoint: 0.75,
			handleBehavior: 'cycle',
			expandToScroll: false,
		});
		await modal.present();
		const { role } = await modal.onWillDismiss();
		if (role === 'saved') await this.reloadTasks();
	}

	private async reloadTasks() {
		try {
			const q = { IDPipeline: this.pipeline.Id, Take: 1000, Sort: JSON.stringify([{ Dimension: 'Sort', Order: 'ASC' }]) };
			const res: any = await this.taskProvider.read(q);
			this.allTasks = res.data || [];
			this.taskList = tasksOfStage(this.allTasks, this.item.Id);
			this.cdr.detectChanges();
		} catch (err: any) {
			this.env.showMessage(err?.error?.Message || err?.message || String(err), 'danger');
		}
	}

	toggleSort() {
		this.sorting = !this.sorting;
		this.sortBefore = this.taskList.map((r) => ({ Id: r.Id, Sort: r.Sort }));
	}

	/** Drop in the list: renumber, then save only the rows whose Sort changed. Restores the list when a save fails. */
	async onTaskReorder(ev: CustomEvent<ItemReorderEventDetail>) {
		const previous = this.taskList;
		this.taskList = renumberRows(ev.detail.complete([...previous]));
		const changed = changedSortRows(this.taskList, this.sortBefore);
		if (!changed.length) return;
		try {
			for (const row of changed) {
				await this.taskProvider.save(toPayload(row));
			}
			this.sortBefore = this.taskList.map((r) => ({ Id: r.Id, Sort: r.Sort }));
			this.env.showMessage('Saving completed!', 'success');
		} catch (err: any) {
			// renumberRows changed Sort in place, so rebuild the previous order from the snapshot
			const before = new Map(this.sortBefore.map((b) => [b.Id, b.Sort]));
			this.taskList = previous.map((r) => ({ ...r, Sort: before.get(r.Id) ?? r.Sort })).sort((x, y) => x.Sort - y.Sort);
			this.env.showMessage(err?.error?.Message || err?.message || String(err), 'danger');
		}
	}

	async saveChange() {
		const row = { ...this.item, ...this.formGroup.getRawValue() };
		const body = toPayload(row);
		const errors = stageErrors(row);
		if (errors.length) {
			this.env.showAlert(errors.join('\n'), null, 'Cannot save');
			return;
		}
		try {
			await this.pageProvider.save(body);
			this.env.showMessage('Saving completed!', 'success');
			await this.modalController.dismiss(null, 'saved');
		} catch (err: any) {
			this.env.showMessage(err?.error?.Message || err?.message || String(err), 'danger');
		}
	}

	async delete() {
		try {
			await this.env.showPrompt('Do you want to delete?', this.item.Name, 'Delete');
		} catch {
			return;
		}
		try {
			await this.pageProvider.delete(this.item);
			await this.modalController.dismiss(null, 'saved');
		} catch (err: any) {
			this.env.showMessage(err?.error?.Message || err?.message || String(err), 'danger');
		}
	}
}
