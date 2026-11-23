import { ChangeDetectorRef, Component, Input } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AlertController, LoadingController, ModalController, NavController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { EnvService } from 'src/app/services/core/env.service';
import { APIList } from 'src/app/services/static/global-variable';
import { CRM_HallBookingProvider, CRM_HallProvider, CRM_OpportunityProvider } from 'src/app/services/static/services.service';
import { bookableHallSelectOptions, bookFormErrors, defaultHoldUntil, parseDateTimeLocal, toDateTimeLocalValue } from './hall-booking.util';

@Component({
	selector: 'app-hall-book-modal',
	templateUrl: './hall-book-modal.page.html',
	standalone: false,
})
export class HallBookModalPage extends PageBase {
	@Input() hall: any;
	@Input() booking: any;
	@Input() centers: any[] = [];
	@Input() defaultFrom = '';
	@Input() defaultTo = '';
	/** Same branch scope as calendar (`selectedBranchAndChildren` JSON), not a single parent id. */
	@Input() branchQuery: any = null;
	/** Preloaded bookable leaves from the calendar page — preferred over a second Hall API call. */
	@Input() hallOptions: any[] = [];

	busy = false;
	statusOptions = [
		{ Code: 'Hold', Name: 'Hold' },
		{ Code: 'Confirmed', Name: 'Confirmed' },
	];
	hallList: any[] = [];

	_OppDataSource = this.buildSelectDataSource((term) =>
		this.opportunityProvider.search({
			Take: 20,
			Skip: 0,
			Keyword: term,
		})
	);

	constructor(
		public pageProvider: CRM_HallBookingProvider,
		public hallProvider: CRM_HallProvider,
		public opportunityProvider: CRM_OpportunityProvider,
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
			IDHall: [null, Validators.required],
			IDOpportunity: [null, Validators.required],
			DateTimeFrom: ['', Validators.required],
			DateTimeTo: ['', Validators.required],
			Status: ['Hold', Validators.required],
			HoldExpiredAt: [''],
			Tables: [null],
			Guests: [null],
			Remark: [''],
		});
	}

	get canCancel(): boolean {
		const id = Number(this.booking?.Id || this.formGroup?.value?.Id || 0);
		const st = String(this.booking?.Status || this.formGroup?.value?.Status || '');
		return id > 0 && st !== 'Cancelled' && st !== 'Expired' && st !== 'Released';
	}

	async ngOnInit() {
		this.pageConfig.canEdit = true;
		await this.loadHalls();
		const b = this.booking || {};
		const h = this.hall || {};
		if (b.IDOpportunity) {
			this._OppDataSource.selected = [{ Id: b.IDOpportunity, Name: b.OpportunityName, Code: b.OpportunityCode }];
		}
		this._OppDataSource.initSearch();

		const hallId = b.IDHall || h.IDHall || h.Id || null;
		this.ensureHallOption(hallId, b.HallName || h.Name);

		this.formGroup.patchValue({
			Id: b.Id || 0,
			IDHall: hallId,
			IDOpportunity: b.IDOpportunity || null,
			DateTimeFrom: toDateTimeLocalValue(b.DateTimeFrom) || this.defaultFrom,
			DateTimeTo: toDateTimeLocalValue(b.DateTimeTo) || this.defaultTo,
			Status: b.Status === 'Confirmed' ? 'Confirmed' : 'Hold',
			HoldExpiredAt: toDateTimeLocalValue(b.HoldExpiredAt) || toDateTimeLocalValue(defaultHoldUntil()),
			Tables: b.Tables ?? null,
			Guests: b.Guests ?? null,
			Remark: b.Remark || '',
		});
		this.onStatusChange();
		this.formGroup.markAsPristine();
		this.pageConfig.showSpinner = false;
		this.cdr.detectChanges();
	}

	/** Keep current booking hall visible even if not in the filtered options list. */
	private ensureHallOption(id: any, name?: string) {
		const n = Number(id);
		if (!Number.isFinite(n) || n <= 0) return;
		if (this.hallList.some((h) => Number(h.Id) === n)) return;
		this.hallList = [{ Id: n, Name: name || String(n), nodeType: 'hall' }, ...this.hallList];
	}

	async loadHalls() {
		if (this.hallOptions?.length) {
			this.hallList = [...this.hallOptions];
			return;
		}
		const q: any = { HallType: 'Hall', Take: 500, IsDisabled: false };
		// Prefer calendar branch scope (children JSON). Single parent id often returns 0 halls.
		if (this.branchQuery != null) q.IDBranch = this.branchQuery;
		try {
			const res: any = await this.hallProvider.read(q, true);
			const halls = res?.data || [];
			let lines: any[] = [];
			if (halls.length) {
				const lq: any = {
					HallType: 'Line',
					Take: 2000,
					IsDisabled: false,
					IDParent: JSON.stringify(halls.map((h) => h.Id)),
				};
				if (this.branchQuery != null) lq.IDBranch = this.branchQuery;
				try {
					const lineRes: any = await this.hallProvider.read(lq, true);
					lines = lineRes?.data || [];
				} catch {
					lines = [];
				}
			}
			this.hallList = bookableHallSelectOptions(halls, lines);
		} catch {
			this.hallList = [];
		}
	}

	onStatusChange() {
		const status = this.formGroup.get('Status')?.value;
		const hold = this.formGroup.get('HoldExpiredAt');
		if (status === 'Hold') {
			hold?.setValidators([Validators.required]);
			if (!hold?.value) hold?.setValue(toDateTimeLocalValue(defaultHoldUntil()));
		} else {
			hold?.clearValidators();
		}
		hold?.updateValueAndValidity({ emitEvent: false });
	}

	async closeModal(data?: any) {
		await this.modalController.dismiss(data);
	}

	async saveChange() {
		if (this.busy) return;
		const raw = this.formGroup.getRawValue();
		const errs = bookFormErrors(raw);
		if (errs.length) {
			this.env.showMessage(errs[0], 'warning');
			return;
		}
		this.busy = true;
		const body: any = {
			Id: raw.Id || undefined,
			IDHall: Number(raw.IDHall),
			IDOpportunity: Number(raw.IDOpportunity),
			DateTimeFrom: parseDateTimeLocal(raw.DateTimeFrom)?.toISOString(),
			DateTimeTo: parseDateTimeLocal(raw.DateTimeTo)?.toISOString(),
			Status: raw.Status,
			Tables: raw.Tables === '' || raw.Tables == null ? null : Number(raw.Tables),
			Guests: raw.Guests === '' || raw.Guests == null ? null : Number(raw.Guests),
			Remark: raw.Remark || null,
		};
		if (raw.Status === 'Hold') {
			body.HoldExpiredAt = parseDateTimeLocal(raw.HoldExpiredAt)?.toISOString();
		}
		try {
			const api = APIList.CRM_HallBooking.book;
			const res: any = await this.pageProvider.commonService.connect(api.method, api.url(), body).toPromise();
			if (res && res.Success === false) {
				const msg = res.Message || (res.Conflicts?.length ? 'Hall is not available for the selected time range.' : 'Cannot save');
				this.env.showMessage(msg, 'danger');
				return;
			}
			this.env.showMessage('Saving completed!', 'success');
			this.closeModal({ saved: true, result: res });
		} catch (err: any) {
			const bodyErr = err?.error;
			const msg = bodyErr?.Message || bodyErr?.message || err?.message || 'Cannot save';
			this.env.showMessage(msg, 'danger');
		} finally {
			this.busy = false;
		}
	}

	async cancelBooking() {
		if (this.busy || !this.canCancel) return;
		const id = Number(this.booking?.Id || this.formGroup.value.Id);
		try {
			await this.env.showPrompt('Do you want to cancel this booking?', null, 'Cancel booking');
		} catch {
			return;
		}
		this.busy = true;
		try {
			const api = APIList.CRM_HallBooking.cancelBooking;
			const res: any = await this.pageProvider.commonService.connect(api.method, api.url(), { Id: id }).toPromise();
			if (res && res.Success === false) {
				this.env.showMessage(res.Message || 'Cannot save', 'danger');
				return;
			}
			this.env.showMessage('Saving completed!', 'success');
			this.closeModal({ saved: true, cancelled: true, result: res });
		} catch (err: any) {
			const bodyErr = err?.error;
			const msg = bodyErr?.Message || bodyErr?.message || err?.message || 'Cannot save';
			this.env.showMessage(msg, 'danger');
		} finally {
			this.busy = false;
		}
	}
}
