import { ChangeDetectorRef, Component, Input } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AlertController, LoadingController, ModalController, NavController } from '@ionic/angular';

import { PageBase } from 'src/app/page-base';
import { EnvService } from 'src/app/services/core/env.service';
import { CRM_ActivityProvider, HRM_StaffProvider } from 'src/app/services/static/services.service';
import { PlanStage } from '../pipeline.models';
import { ACTIVITY_TASK_TYPES, mergeDateWithOriginalTime, toDateInputValue } from '../pipeline-view.util';

@Component({
	selector: 'app-activity-modal',
	templateUrl: './activity-modal.page.html',
	standalone: false,
})
export class ActivityModalPage extends PageBase {
	@Input() item: any;
	@Input() stages: PlanStage[] = [];
	@Input() ownerItem: any;
	@Input() canEdit = false;
	@Input() canDelete = false;
	busy = false;
	private originalDates: Record<string, any> = {};

	taskTypeOptions = ACTIVITY_TASK_TYPES.map((c) => ({ Code: c, Name: c }));
	statusOptions = [
		{ Code: 'Open', Name: 'Open' },
		{ Code: 'Done', Name: 'Done' },
		{ Code: 'Skipped', Name: 'Skipped' },
	];

	_OwnerDataSource = this.buildSelectDataSource((term) =>
		this.staffProvider.search({
			Take: 20,
			Skip: 0,
			Keyword: term,
		})
	);

	constructor(
		public pageProvider: CRM_ActivityProvider,
		public staffProvider: HRM_StaffProvider,
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
			TaskType: ['Call'],
			Status: ['Open'],
			IDStage: [null],
			DueDate: [''],
			EventDate: [''],
			IDOwner: [null],
			Remark: [''],
		});
	}

	ngOnInit() {
		this.pageConfig.canEdit = this.canEdit;
		this.pageConfig.canDelete = this.canDelete;
		const src = this.item || {};
		this.originalDates = {
			DueDate: src.DueDate || null,
			EventDate: src.EventDate || null,
		};

		if (this.ownerItem?.Id) {
			this._OwnerDataSource.selected = [this.ownerItem];
		}
		this._OwnerDataSource.initSearch();

		this.formGroup.patchValue({
			Name: src.Name || '',
			TaskType: src.TaskType || 'Call',
			Status: src.Status || 'Open',
			IDStage: src.IDStage || null,
			DueDate: toDateInputValue(src.DueDate),
			EventDate: toDateInputValue(src.EventDate),
			IDOwner: src.IDOwner || null,
			Remark: src.Remark || '',
		});
		if (!this.canEdit) {
			this.formGroup.disable({ emitEvent: false });
		}
		this.formGroup.markAsPristine();
		this.pageConfig.showSpinner = false;
	}

	async saveChange() {
		if (!this.canEdit || this.formGroup.invalid || this.busy) return;
		this.busy = true;
		const v = this.formGroup.getRawValue();
		const status = v.Status || 'Open';
		const body: any = {
			Id: this.item?.Id || 0,
			IDOpportunity: this.item?.IDOpportunity || null,
			IDContact: this.item?.IDContact || null,
			IDBranch: this.item?.IDBranch || this.env.selectedBranch,
			IDStage: v.IDStage || null,
			IDStageTask: this.item?.IDStageTask || null,
			IDOwner: v.IDOwner || null,
			Name: (v.Name || '').trim(),
			TaskType: v.TaskType || 'Call',
			Status: status,
			DueDate: mergeDateWithOriginalTime(v.DueDate, this.originalDates['DueDate']),
			EventDate: mergeDateWithOriginalTime(v.EventDate, this.originalDates['EventDate']),
			CompletedDate: status === 'Done' ? this.item?.CompletedDate || new Date().toISOString() : null,
			IsRequired: !!this.item?.IsRequired,
			DocumentType: this.item?.DocumentType || null,
			Remark: (v.Remark || '').trim() || null,
		};
		try {
			const saved = await this.pageProvider.save(body);
			this.env.showMessage('Saving completed!', 'success');
			await this.modalController.dismiss(saved, 'saved');
		} catch (err: any) {
			this.env.showMessage(err?.error?.Message || err?.message || String(err), 'danger');
		}
		this.busy = false;
	}

	async delete() {
		if (!this.item?.Id || !this.canDelete || this.busy) return;
		try {
			await this.env.showPrompt('Do you want to delete?', this.item.Name, 'Delete');
		} catch {
			return;
		}
		this.busy = true;
		try {
			await this.pageProvider.delete(this.item);
			this.env.showMessage('DELETE_RESULT_SUCCESS', 'success');
			await this.modalController.dismiss(null, 'saved');
		} catch (err: any) {
			this.env.showMessage(err?.error?.Message || err?.message || String(err), 'danger');
		}
		this.busy = false;
	}
}
