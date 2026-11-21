import { ChangeDetectorRef, Component, Input } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AlertController, LoadingController, ModalController, NavController } from '@ionic/angular';

import { PageBase } from 'src/app/page-base';
import { EnvService } from 'src/app/services/core/env.service';
import { CRM_PipelineStageTaskProvider } from 'src/app/services/static/services.service';
import { DOCUMENT_TYPES, TASK_TYPES, nextSort, taskErrors, tasksOfStage, toPayload } from '../pipeline-config.util';

/**
 * Popup to add or edit one playbook task of a stage. The stage can be changed, to move the task to another stage
 * (it goes to the end of that stage). Dismisses with role `saved` after a save or delete.
 */
@Component({
	selector: 'app-pipeline-task-modal',
	templateUrl: './pipeline-task-modal.page.html',
	standalone: false,
})
export class PipelineTaskModalPage extends PageBase {
	@Input() item: any;
	@Input() pipeline: { Id?: number };
	@Input() stage: { Id?: number; Name?: string };
	/** Every stage of the pipeline, the choices of the Stage field. Only `stage` is offered when empty. */
	@Input() stages: any[] = [];
	/** Every task of the pipeline, to put a moved task at the end of its new stage. */
	@Input() tasks: any[] = [];

	stageOptions: { Id: number; Name: string }[] = [];
	taskTypes = TASK_TYPES.map((c) => ({ Code: c, Name: c }));
	documentTypes = DOCUMENT_TYPES.map((c) => ({ Code: c, Name: c }));

	constructor(
		public pageProvider: CRM_PipelineStageTaskProvider,
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
			IDStage: [null, Validators.required],
			TaskType: ['Call'],
			DocumentType: [null],
			DueOffsetDays: [0],
			IsRequired: [false],
		});
	}

	// A popup has no route data to load, so skip the PageBase page bootstrap.
	ngOnInit() {
		const stages = this.stages?.length ? this.stages : this.stage ? [this.stage] : [];
		this.stageOptions = stages.map((s: any) => ({ Id: s.Id, Name: s.Name }));
		this.formGroup.patchValue(this.item);
		this.formGroup.markAsPristine();
		this.pageConfig.showSpinner = false;
	}

	/** The document type only applies to a Document task. */
	get isDocument(): boolean {
		return this.formGroup.get('TaskType')?.value === 'Document';
	}

	onTypeChange() {
		if (!this.isDocument) this.formGroup.get('DocumentType')?.setValue(null);
	}

	async saveChange() {
		const row = { ...this.item, ...this.formGroup.getRawValue() };
		// moved to another stage: it goes to the end of that stage
		if (row.IDStage !== this.item.IDStage) row.Sort = nextSort(tasksOfStage(this.tasks, row.IDStage));
		const body = toPayload(row);
		const errors = taskErrors(row);
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
