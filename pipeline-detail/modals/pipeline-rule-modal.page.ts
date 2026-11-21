import { ChangeDetectorRef, Component, Input } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AlertController, LoadingController, ModalController, NavController } from '@ionic/angular';

import { PageBase } from 'src/app/page-base';
import { EnvService } from 'src/app/services/core/env.service';
import { CRM_PipelineRuleProvider } from 'src/app/services/static/services.service';
import { CUSTOMER_HISTORIES, CUSTOMER_TYPES, ruleErrors, toPayload } from '../pipeline-config.util';

/** Popup to add or edit one qualification rule. Dismisses with role `saved` after a save or delete. */
@Component({
	selector: 'app-pipeline-rule-modal',
	templateUrl: './pipeline-rule-modal.page.html',
	standalone: false,
})
export class PipelineRuleModalPage extends PageBase {
	@Input() item: any;
	@Input() pipeline: { Id?: number };
	/** CRMServiceType rows: { Id, Name }. */
	@Input() serviceTypes: { Id: number; Name: string }[] = [];

	customerTypes = CUSTOMER_TYPES.map((c) => ({ Code: c, Name: c }));
	customerHistories = CUSTOMER_HISTORIES.map((c) => ({ Code: c, Name: c }));

	constructor(
		public pageProvider: CRM_PipelineRuleProvider,
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
			IDServiceType: [null],
			CustomerType: [null],
			CustomerHistory: [null],
			MinGuests: [null],
			MaxGuests: [null],
			Priority: [0],
		});
	}

	// A popup has no route data to load, so skip the PageBase page bootstrap.
	ngOnInit() {
		// ng-select shows the label as is, so translate the options.
		const tr = async (list: string[]) => Promise.all(list.map(async (c) => ({ Code: c, Name: ((await this.env.translateResource(c)) as string) || c })));
		tr(CUSTOMER_TYPES).then((l) => (this.customerTypes = l));
		tr(CUSTOMER_HISTORIES).then((l) => (this.customerHistories = l));
		this.formGroup.patchValue(this.item);
		this.formGroup.markAsPristine();
		this.pageConfig.showSpinner = false;
	}

	async saveChange() {
		const row = { ...this.item, ...this.formGroup.getRawValue() };
		const body = toPayload(row);
		const errors = ruleErrors(row);
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
