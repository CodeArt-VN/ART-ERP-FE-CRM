import { Component, Input } from '@angular/core';
import { ModalController } from '@ionic/angular';

@Component({
	selector: 'app-hall-booking-list-modal',
	templateUrl: './hall-booking-list-modal.page.html',
	standalone: false,
})
export class HallBookingListModalPage {
	@Input() bookings: any[] = [];

	constructor(public modalController: ModalController) {}

	closeModal(data?: any) {
		return this.modalController.dismiss(data);
	}

	pick(b: any) {
		return this.closeModal({ booking: b });
	}
}
