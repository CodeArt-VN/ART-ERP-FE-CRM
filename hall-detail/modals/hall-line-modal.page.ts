import { ChangeDetectorRef, Component, Input } from '@angular/core';
import { FormBuilder, FormControl, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AlertController, LoadingController, ModalController, NavController } from '@ionic/angular';

import { PageBase } from 'src/app/page-base';
import { EnvService } from 'src/app/services/core/env.service';
import { CRM_HallProvider } from 'src/app/services/static/services.service';
import { CAPACITY_FIELDS, explainSaveFailure, lineErrors, normalizeHallNumbers, toLinePayload } from '../hall.util';

/** Popup to add or edit one line of a hall. Dismisses with role `saved` after a save, enable / disable or delete. */
@Component({
	selector: 'app-hall-line-modal',
	templateUrl: './hall-line-modal.page.html',
	standalone: false,
})
export class HallLineModalPage extends PageBase {
	@Input() item: any;
	@Input() hall: { Id?: number; Code?: string; IDBranch?: number };
	/** The other lines of the hall (for the duplicate hint). */
	@Input() lines: any[] = [];

	capacityFields = CAPACITY_FIELDS;

	constructor(
		public pageProvider: CRM_HallProvider,
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
			LineNo: [null, Validators.required],
			Name: ['', Validators.required],
			Code: [''],
			Remark: [''],
			AreaSqm: [null],
			SizeText: [''],
			MaxGuests: [null],
			CapCircle: [null],
			CapBuffet: [null],
			CapTheater: [null],
			CapClass: [null],
			CapSemicircle: [null],
			CapLetterU: [null],
			CapSquare: [null],
			IsDisabled: new FormControl(false),
		});
	}

	// A popup has no route data to load, so skip the PageBase page bootstrap.
	ngOnInit() {
		this.getPagePermission('hall'); // canDelete for the footer button
		this.formGroup.patchValue(this.item);
		// a new line comes prefilled (next free number, code, name), so it can be saved as is
		if (this.item?.Id) this.formGroup.markAsPristine();
		else this.formGroup.markAsDirty();
		this.pageConfig.showSpinner = false;
	}

	async saveChange() {
		const row = { ...this.item, ...this.formGroup.getRawValue() };
		const errors = lineErrors(normalizeHallNumbers(row));
		if (errors.length) {
			const texts = await Promise.all(errors.map((e) => this.env.translateResource(e)));
			this.env.showMessage(texts.join(' | '), 'warning', null, 8000, true);
			return;
		}
		const body = toLinePayload(row);
		try {
			const saved: any = await this.pageProvider.save(body);
			const id = saved?.Id || this.item.Id;
			const wantDisabled = !!this.formGroup.getRawValue().IsDisabled;
			// the API ignores IsDisabled on save: enable / disable is its own call
			if (id && wantDisabled !== !!this.item.IsDisabled) await this.pageProvider.disable({ Id: id }, wantDisabled);
			this.env.showMessage('Saving completed!', 'success');
			await this.modalController.dismiss(null, 'saved');
		} catch {
			const key = await explainSaveFailure(async (q) => ((await this.pageProvider.read(q)) as any).data || [], { ...body, HallType: 'Line', Id: body.Id || 0 });
			this.env.showMessage(key, 'danger', null, 8000, true);
		}
	}

	async delete() {
		try {
			await this.env.showPrompt('Do you want to delete?', this.item.Name, 'Delete');
		} catch {
			return;
		}
		try {
			await this.pageProvider.delete({ ...this.item });
			await this.modalController.dismiss(null, 'saved');
		} catch {
			// 409 from the API: most likely the line is in use (for example by a booking)
			this.env.showMessage('This line cannot be deleted. It may be in use.', 'danger', null, 8000, true);
		}
	}
}
