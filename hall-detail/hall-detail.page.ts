import { Component, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormControl, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { NavController, LoadingController, AlertController, ModalController } from '@ionic/angular';

import { PageBase } from 'src/app/page-base';
import { EnvService } from 'src/app/services/core/env.service';
import { CRM_HallProvider } from 'src/app/services/static/services.service';
import {
	CAPACITY_FIELDS,
	HALL_FLOORS,
	HALL_KINDS,
	MAX_QUICK_LINES,
	buildQuickLines,
	centerOptions,
	defaultCenter,
	explainSaveFailure,
	hallErrors,
	hallKindColor,
	hallKindIcon,
	newLine,
	normalizeHallNumbers,
	parseLineCount,
	primaryCapacity,
	suggestHallCode,
	toLinePayload,
} from './hall.util';
import { HallLineModalPage } from './modals/hall-line-modal.page';

@Component({
	selector: 'app-hall-detail',
	templateUrl: './hall-detail.page.html',
	styleUrls: ['./hall-detail.page.scss'],
	standalone: false,
})
export class HallDetailPage extends PageBase {
	/** s1 = General information, s2 = Lines. */
	segmentView = 's1';
	lines: any[] = [];
	centerList: any[] = [];
	kindList: { Code: string; Name: string }[] = HALL_KINDS.map((c) => ({ Code: c, Name: c }));
	floorList: { Code: string; Name: string }[] = HALL_FLOORS.map((f) => ({ Code: f, Name: f }));
	capacityFields = CAPACITY_FIELDS;
	hallKindColor = hallKindColor;
	hallKindIcon = hallKindIcon;
	primaryCapacity = primaryCapacity;
	/** The API needs the type and the center on every save (the type is not shown in the form). */
	alwaysReturnProps = ['Id', 'IDBranch', 'HallType'];

	constructor(
		public pageProvider: CRM_HallProvider,
		public env: EnvService,
		public navCtrl: NavController,
		public route: ActivatedRoute,
		public alertCtrl: AlertController,
		public modalController: ModalController,
		public formBuilder: FormBuilder,
		public cdr: ChangeDetectorRef,
		public loadingController: LoadingController
	) {
		super();
		this.pageConfig.isDetailPage = true;

		this.formGroup = formBuilder.group({
			IDBranch: [null, Validators.required],
			Id: new FormControl({ value: '', disabled: true }),
			HallType: ['Hall'],
			Name: ['', Validators.required],
			Code: [''],
			Remark: [''],
			Floor: [null],
			HallKind: ['Banquet'],
			Sort: [null],
			AreaSqm: [null],
			SizeText: [''],
			CapCircle: [null],
			CapBuffet: [null],
			CapTheater: [null],
			CapClass: [null],
			CapSemicircle: [null],
			CapLetterU: [null],
			CapSquare: [null],
			MinGuests: [null],
			MaxGuests: [null],
			MinTables: [null],
			MaxTables: [null],
			IsDisabled: new FormControl({ value: false, disabled: true }),
			IsDeleted: new FormControl({ value: '', disabled: true }),
			CreatedBy: new FormControl({ value: '', disabled: true }),
			CreatedDate: new FormControl({ value: '', disabled: true }),
			ModifiedBy: new FormControl({ value: '', disabled: true }),
			ModifiedDate: new FormControl({ value: '', disabled: true }),
		});
	}

	segmentChanged(ev: any) {
		this.segmentView = ev.detail.value;
	}

	preLoadData(event?: any): void {
		this.centerList = centerOptions(this.env.branchList);
		// ng-select shows the label as is, so translate the options before the form renders.
		const floorWord = this.env.translateResource('Floor') as Promise<string>;
		const kinds = Promise.all(HALL_KINDS.map(async (c) => ({ Code: c, Name: ((await this.env.translateResource(c)) as string) || c })));
		Promise.all([kinds, floorWord])
			.then(([k, f]) => {
				this.kindList = k;
				this.floorList = HALL_FLOORS.map((x) => ({ Code: x, Name: `${f || 'Floor'} ${x}` }));
			})
			.catch(() => {})
			.finally(() => super.preLoadData(event));
	}

	loadedData(event?: any, ignoredFromGroup?: boolean): void {
		super.loadedData(event, ignoredFromGroup);
		if (this.item?.HallType === 'Line' && this.item.IDParent) {
			// a line has no page of its own: open its hall
			this.nav('hall/' + this.item.IDParent, 'root');
			return;
		}
		if (this.item?.Id) {
			// a floor outside the usual list (free text in the DB) must still show
			if (this.item.Floor && !this.floorList.some((f) => f.Code === this.item.Floor)) {
				this.floorList = [...this.floorList, { Code: this.item.Floor, Name: this.item.Floor }];
			}
			// the lines must stay in the hall's center (DB foreign key), so the center is fixed once the hall exists
			this.formGroup.controls.IDBranch.disable({ emitEvent: false });
			this.loadLines();
		} else {
			this.lines = [];
			this.segmentView = 's1';
			if (this.pageConfig.canEdit) this.formGroup.controls.IDBranch.enable({ emitEvent: false });
			const center = defaultCenter(this.centerList, this.env.selectedBranch, this.env.selectedBranchAndChildren);
			if (center && !this.formGroup.controls.IDBranch.value) this.formGroup.controls.IDBranch.setValue(center);
		}
	}

	// ---------------------------------------------------------------- save

	/** A new hall saves itself once the center and the name are filled; an existing one saves each change. */
	async saveChange() {
		const raw = this.formGroup.getRawValue();
		if (!this.item?.Id && (!raw.IDBranch || !String(raw.Name || '').trim())) return;

		const errors = hallErrors(normalizeHallNumbers(raw));
		if (errors.length) {
			const texts = await Promise.all(errors.map((e) => this.env.translateResource(e)));
			this.env.showMessage(texts.join(' | '), 'warning');
			return;
		}

		// no code typed: propose <center code>-<name without accents>, same as the seeded halls
		if (!String(raw.Code || '').trim()) {
			const code = suggestHallCode(this.centerList.find((c) => c.Id == raw.IDBranch)?.Code || '', raw.Name);
			if (code) {
				this.formGroup.controls.Code.setValue(code);
				this.formGroup.controls.Code.markAsDirty();
			}
		}

		try {
			await super.saveChange2();
		} catch (err) {
			if (err !== 'form invalid' && err !== 'submitAttempt') await this.showSaveFailure({ ...this.item, ...this.formGroup.getRawValue(), Id: this.item?.Id || 0, HallType: 'Hall' });
		}
	}

	/** Dirty values go out as numbers (the mask returns strings). */
	getDirtyValues(fg) {
		const values = super.getDirtyValues(fg);
		return fg === this.formGroup && values ? normalizeHallNumbers(values) : values;
	}

	savedChange(savedItem = null, form = this.formGroup) {
		super.savedChange(savedItem, form);
		if (savedItem?.Id && form === this.formGroup) {
			this.item = { ...this.item, ...savedItem };
			// audit fields and the generated code are not dirty, so show what the server stored
			this.formGroup.patchValue(
				{ Code: savedItem.Code ?? this.formGroup.controls.Code.value, CreatedBy: savedItem.CreatedBy, CreatedDate: savedItem.CreatedDate, ModifiedBy: savedItem.ModifiedBy, ModifiedDate: savedItem.ModifiedDate },
				{ emitEvent: false }
			);
			this.formGroup.markAsPristine();
			this.formGroup.controls.IDBranch.disable({ emitEvent: false });
			this.loadLines();
		}
	}

	/** The API only says 404 / 409, so name the broken rule from the rows of the same center. */
	private async showSaveFailure(row: any) {
		const key = await explainSaveFailure(async (q) => ((await this.pageProvider.read(q)) as any).data || [], row);
		this.env.showMessage(key, 'danger', null, 8000, true);
	}

	// ---------------------------------------------------------------- delete

	delete(publishEventCode = this.pageConfig.pageName) {
		if (this.lines.length) {
			this.env.showMessage('This hall still has lines. Delete its lines first.', 'warning', null, 6000, true);
			return;
		}
		super.delete(publishEventCode);
	}

	// ---------------------------------------------------------------- lines

	async loadLines() {
		if (!this.item?.Id) return;
		const q = { IDParent: this.item.Id, IDBranch: this.item.IDBranch, HallType_eq: 'Line', IsDisabled: 'skipped', Take: 1000, SortBy: '[LineNo]' };
		try {
			const res: any = await this.pageProvider.read(q, true);
			this.lines = (res.data || []).sort((a, b) => (a.LineNo || 0) - (b.LineNo || 0));
		} catch (err: any) {
			this.env.showMessage(err?.error?.Message || err?.message || 'Cannot extract data', 'danger');
		}
		this.cdr?.detectChanges();
	}

	/** Sheet popup (skill fe-popup): reload the lines whenever it closes. */
	private async openLineModal(line: any) {
		const modal = await this.modalController.create({
			component: HallLineModalPage,
			componentProps: { item: { ...line }, hall: this.item, lines: this.lines },
			cssClass: 'form-1column',
			breakpoints: [0, 0.25, 0.5, 0.75, 1],
			initialBreakpoint: 0.75,
			handleBehavior: 'cycle',
			expandToScroll: false,
		});
		await modal.present();
		await modal.onWillDismiss();
		await this.loadLines();
	}

	addLine() {
		return this.openLineModal(newLine(this.item, this.lines));
	}

	editLine(line: any) {
		return this.openLineModal(line);
	}

	/** Ask N, then create LineNo 1..N that are still missing (code `<hall code>-L<k>`, name `Line k`). */
	async quickCreateLines() {
		let answer: any;
		const placeholder = ((await this.env.translateResource('Number of lines')) as string) || 'Number of lines';
		try {
			answer = await this.env.showPrompt('How many lines does this hall have?', null, 'Quick create lines', 'Create', 'Cancel', [
				{ name: 'count', type: 'number', min: 1, max: MAX_QUICK_LINES, value: Math.max(2, this.lines.length), placeholder },
			]);
		} catch {
			return;
		}
		const n = parseLineCount(answer?.count);
		if (n === null) {
			this.env.showMessage('Enter a whole number from 1 to 50', 'warning');
			return;
		}
		const rows = buildQuickLines(this.item, this.lines, n);
		if (!rows.length) {
			this.env.showMessage('All these lines already exist', 'warning');
			return;
		}
		let created = 0;
		try {
			for (const row of rows) {
				await this.pageProvider.save(toLinePayload(row));
				created++;
			}
			this.env.showMessage('Created {value} lines', 'success', created);
		} catch {
			if (created) this.env.showMessage('Created {value} lines', 'success', created);
			const failed = rows[created];
			await this.showSaveFailure(failed);
		}
		await this.loadLines();
	}
}
