import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { FullCalendarModule } from '@fullcalendar/angular';
import { ShareModule } from 'src/app/share.module';
import { HallBookingPage } from './hall-booking.page';
import { HallBookModalModule } from './hall-book-modal.module';
import { HallBookingListModalPage } from './hall-booking-list-modal.page';
import { HallBookingFilterModalPage } from './hall-booking-filter-modal.page';

@NgModule({
	imports: [
		IonicModule,
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		ShareModule,
		FullCalendarModule,
		HallBookModalModule,
		RouterModule.forChild([{ path: '', component: HallBookingPage }]),
	],
	declarations: [HallBookingPage, HallBookingListModalPage, HallBookingFilterModalPage],
})
export class HallBookingPageModule {}
