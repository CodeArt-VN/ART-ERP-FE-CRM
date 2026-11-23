import { ChangeDetectorRef, Component, Input } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AlertController, LoadingController, ModalController, NavController } from '@ionic/angular';

import { PageBase } from 'src/app/page-base';
import { EnvService } from 'src/app/services/core/env.service';
import { APIList } from 'src/app/services/static/global-variable';
import { CRM_ContactProvider } from 'src/app/services/static/services.service';

@Component({
	selector: 'app-opp-contact-modal',
	templateUrl: './opp-contact-modal.page.html',
	standalone: false,
})
export class OppContactModalPage extends PageBase {
	@Input() opportunity: any;
	@Input() item: any; // existing OpportunityContact row (optional)
	@Input() canEdit = true;
	@Input() canDelete = false;

	busy = false;
	mode: 'pick' | 'create' = 'pick';

	_ContactDataSource = this.buildSelectDataSource((term) =>
		this.contactProvider.search({
			Take: 20,
			Skip: 0,
			Keyword: term,
		})
	);

	constructor(
		public pageProvider: CRM_ContactProvider,
		public contactProvider: CRM_ContactProvider,
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
			Id: [0],
			IDContact: [null],
			Role: [''],
			IsPrimary: [false],
			// create-new contact fields
			Name: [''],
			WorkPhone: [''],
			Email: [''],
			IsPersonal: [true],
		});
	}

	ngOnInit() {
		this.pageConfig.canEdit = this.canEdit;
		this.pageConfig.canDelete = this.canDelete;
		const row = this.item || {};
		this.mode = row.IDContact ? 'pick' : 'pick';
		this.formGroup.patchValue({
			Id: row.Id || 0,
			IDContact: row.IDContact || null,
			Role: row.Role || '',
			IsPrimary: !!row.IsPrimary,
			Name: '',
			WorkPhone: '',
			Email: '',
			IsPersonal: true,
		});
		if (row.IDContact) {
			this._ContactDataSource.selected = [
				{
					Id: row.IDContact,
					Name: row.ContactName,
					WorkPhone: row.WorkPhone,
					Email: row.Email,
				},
			];
		}
		this._ContactDataSource.initSearch();
		this.applyModeValidators();
		this.formGroup.markAsPristine();
		this.pageConfig.showSpinner = false;
	}

	setMode(mode: 'pick' | 'create') {
		this.mode = mode;
		this.applyModeValidators();
		this.cdr.detectChanges();
	}

	private applyModeValidators() {
		const idContact = this.formGroup.get('IDContact');
		const name = this.formGroup.get('Name');
		if (this.mode === 'pick') {
			idContact?.setValidators([Validators.required]);
			name?.clearValidators();
		} else {
			idContact?.clearValidators();
			name?.setValidators([Validators.required]);
		}
		idContact?.updateValueAndValidity({ emitEvent: false });
		name?.updateValueAndValidity({ emitEvent: false });
	}

	async closeModal(role = 'cancel', data?: any) {
		await this.modalController.dismiss(data, role);
	}

	async saveChange() {
		if (!this.canEdit || this.busy || !this.opportunity?.Id) return;
		this.formGroup.updateValueAndValidity();
		if (this.formGroup.invalid) {
			this.env.showMessage('Please recheck control(s): {value}', 'warning', this.mode === 'create' ? 'Name' : 'Contact');
			return;
		}
		this.busy = true;
		try {
			const v = this.formGroup.getRawValue();
			let contactId = Number(v.IDContact) || 0;
			if (this.mode === 'create') {
				const created: any = await this.contactProvider.save({
					Id: 0,
					IDBranch: this.opportunity.IDBranch || this.env.selectedBranch,
					Name: (v.Name || '').trim(),
					WorkPhone: (v.WorkPhone || '').trim() || null,
					Email: (v.Email || '').trim() || null,
					IsPersonal: !!v.IsPersonal,
				});
				contactId = created?.Id || 0;
				if (!contactId) throw new Error('Cannot create contact');
			}

			const api = APIList.CRM_OpportunityContact.save;
			const res: any = await this.pageProvider.commonService
				.connect(api.method, api.url(), {
					Id: v.Id || undefined,
					IDOpportunity: this.opportunity.Id,
					IDContact: contactId,
					Role: (v.Role || '').trim() || null,
					IsPrimary: !!v.IsPrimary,
				})
				.toPromise();
			this.env.showMessage('Saving completed!', 'success');
			await this.closeModal('saved', res?.Item || res);
		} catch (err: any) {
			const msg = err?.error?.Message || err?.message || 'Cannot save, please try again';
			this.env.showMessage(msg, 'danger');
		} finally {
			this.busy = false;
		}
	}

	async delete() {
		if (!this.canDelete || !this.item?.Id || this.busy) return;
		this.env
			.showPrompt('Are you sure you want to delete this contact link?', null, 'Delete')
			.then(async () => {
				this.busy = true;
				try {
					const api = APIList.CRM_OpportunityContact.delete;
					await this.pageProvider.commonService.connect(api.method, api.url(this.item.Id), null).toPromise();
					this.env.showMessage('Deleted!', 'success');
					await this.closeModal('saved');
				} catch (err: any) {
					this.env.showMessage(err?.error?.Message || err?.message || 'Cannot save, please try again', 'danger');
				} finally {
					this.busy = false;
				}
			})
			.catch(() => {});
	}
}
