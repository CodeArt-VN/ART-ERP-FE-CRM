import { Component, Input, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ModalController } from '@ionic/angular';
import { emptyHallBookingFilter, HallBookingFilterState } from './hall-booking-filter.util';

@Component({
	selector: 'app-hall-booking-filter-modal',
	templateUrl: './hall-booking-filter-modal.page.html',
	standalone: false,
})
export class HallBookingFilterModalPage implements OnInit {
	@Input() filter: HallBookingFilterState = emptyHallBookingFilter();
	@Input() centers: { Id: number; Name?: string }[] = [];
	@Input() floors: { Code: string; Name: string }[] = [];
	@Input() kinds: { Code: string; Name: string }[] = [];
	@Input() statuses: { Code: string; Name: string }[] = [];

	formGroup: FormGroup;

	constructor(
		public modalController: ModalController,
		public formBuilder: FormBuilder
	) {
		this.formGroup = this.formBuilder.group({
			Keyword: [''],
			IDBranches: [[]],
			Floors: [[]],
			HallKinds: [[]],
			Statuses: [[]],
		});
	}

	ngOnInit() {
		const f = this.filter || emptyHallBookingFilter();
		this.formGroup.patchValue({
			Keyword: f.Keyword || '',
			IDBranches: [...(f.IDBranches || [])],
			Floors: [...(f.Floors || [])],
			HallKinds: [...(f.HallKinds || [])],
			Statuses: [...(f.Statuses || [])],
		});
	}

	closeModal() {
		return this.modalController.dismiss(null, 'cancel');
	}

	clearAll() {
		this.formGroup.reset({
			Keyword: '',
			IDBranches: [],
			Floors: [],
			HallKinds: [],
			Statuses: [],
		});
	}

	apply() {
		const v = this.formGroup.getRawValue();
		const data: HallBookingFilterState = {
			Keyword: String(v.Keyword || '').trim(),
			IDBranches: (v.IDBranches || []).map(Number).filter((n) => Number.isFinite(n)),
			Floors: (v.Floors || []).map(String),
			HallKinds: (v.HallKinds || []).map(String),
			Statuses: (v.Statuses || []).map(String),
		};
		return this.modalController.dismiss(data, 'apply');
	}
}
