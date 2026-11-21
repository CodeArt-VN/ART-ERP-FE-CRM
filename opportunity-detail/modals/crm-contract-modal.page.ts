import { ChangeDetectorRef, Component, Input } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AlertController, LoadingController, ModalController, NavController } from '@ionic/angular';

import { PageBase } from 'src/app/page-base';
import { EnvService } from 'src/app/services/core/env.service';
import { CRM_ContractProvider } from 'src/app/services/static/services.service';
import { mergeDateWithOriginalTime, toDateInputValue } from '../pipeline-view.util';

@Component({
	selector: 'app-crm-contract-modal',
	templateUrl: './crm-contract-modal.page.html',
	standalone: false,
})
export class CrmContractModalPage extends PageBase {
	@Input() item: any;
	@Input() quotations: any[] = [];
	@Input() canEdit = false;
	@Input() canDelete = false;
	busy = false;
	private originalDates: Record<string, any> = {};

	constructor(
		public pageProvider: CRM_ContractProvider,
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
			Code: [''],
			Name: ['', Validators.required],
			IDQuotation: [null],
			ContractDate: [''],
			EventDate: [''],
			EndDate: [''],
			NumberOfGuests: [0],
			Amount: [0],
			Remark: [''],
		});
	}

	ngOnInit() {
		this.pageConfig.canEdit = this.canEdit;
		this.pageConfig.canDelete = this.canDelete;
		const src = this.item || {};
		this.originalDates = {
			ContractDate: src.ContractDate || null,
			EventDate: src.EventDate || null,
			EndDate: src.EndDate || null,
		};
		this.formGroup.patchValue({
			Code: src.Code || '',
			Name: src.Name || '',
			IDQuotation: src.IDQuotation || null,
			ContractDate: toDateInputValue(src.ContractDate),
			EventDate: toDateInputValue(src.EventDate),
			EndDate: toDateInputValue(src.EndDate),
			NumberOfGuests: src.NumberOfGuests ?? 0,
			Amount: src.Amount ?? 0,
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
		const body: any = {
			Id: this.item?.Id || 0,
			IDOpportunity: this.item?.IDOpportunity || null,
			IDContact: this.item?.IDContact || null,
			IDBranch: this.item?.IDBranch || this.env.selectedBranch,
			IDQuotation: v.IDQuotation || null,
			Code: (v.Code || '').trim() || null,
			Name: (v.Name || '').trim(),
			ContractDate: mergeDateWithOriginalTime(v.ContractDate, this.originalDates['ContractDate']),
			EventDate: mergeDateWithOriginalTime(v.EventDate, this.originalDates['EventDate']),
			EndDate: mergeDateWithOriginalTime(v.EndDate, this.originalDates['EndDate']),
			NumberOfGuests: Math.max(0, Math.round(Number(v.NumberOfGuests || 0))),
			Amount: Number(v.Amount || 0),
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
			await this.env.showPrompt('Do you want to delete?', this.item.Name || this.item.Code, 'Delete');
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
