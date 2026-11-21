import { ChangeDetectorRef, Component, Input } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AlertController, LoadingController, ModalController, NavController } from '@ionic/angular';

import { PageBase } from 'src/app/page-base';
import { EnvService } from 'src/app/services/core/env.service';
import { CRM_QuotationProvider } from 'src/app/services/static/services.service';

@Component({
	selector: 'app-crm-quotation-modal',
	templateUrl: './crm-quotation-modal.page.html',
	standalone: false,
})
export class CrmQuotationModalPage extends PageBase {
	@Input() item: any;
	@Input() canEdit = false;
	@Input() canDelete = false;
	busy = false;

	constructor(
		public pageProvider: CRM_QuotationProvider,
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
			Remark: [''],
		});
	}

	ngOnInit() {
		this.pageConfig.canEdit = this.canEdit;
		this.pageConfig.canDelete = this.canDelete;
		this.formGroup.patchValue(this.item || {});
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
			Code: (v.Code || '').trim() || null,
			Name: (v.Name || '').trim(),
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
