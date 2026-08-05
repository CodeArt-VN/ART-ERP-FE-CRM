import { Component } from '@angular/core';
import { NavController, ModalController, AlertController, LoadingController, PopoverController } from '@ionic/angular';
import { EnvService } from 'src/app/services/core/env.service';
import { PageBase } from 'src/app/page-base';
import { CRM_AttendanceProvider } from 'src/app/services/static/services.service';
import { Location } from '@angular/common';
import { lib } from 'src/app/services/static/global-functions';

@Component({
	selector: 'app-attendance-booking',
	templateUrl: 'attendance-booking.page.html',
	styleUrls: ['attendance-booking.page.scss'],
	standalone: false,
})
export class AttendanceBookingPage extends PageBase {
	constructor(
		public pageProvider: CRM_AttendanceProvider,
		public modalController: ModalController,
		public popoverCtrl: PopoverController,
		public alertCtrl: AlertController,
		public loadingController: LoadingController,
		public env: EnvService,
		public navCtrl: NavController,
		public location: Location
	) {
		super();
		this.pageConfig.ShowFeature = false;
		this.pageConfig.ShowArchive = false;
		this.pageConfig.ShowHelp = false;

		this.pageConfig.dividers = [
			{
				fields: ['PartyDate'],
				dividerFn: (record, recordIndex, records) => {
					const toDay = (d) => lib.dateFormat(d, 'yyyy-mm-dd');
					if (recordIndex === 0) {
						const days = new Set(records.map((r) => toDay(r.PartyDate)));
						(records as any).__partyDateMultiDay = days.size >= 2;
					}
					if (!(records as any).__partyDateMultiDay) {
						return null;
					}
					const a = recordIndex == 0 ? '' : toDay(records[recordIndex - 1].PartyDate);
					const b = toDay(record.PartyDate);
					if (a === b) {
						return null;
					}
					return lib.dateFormat(record.PartyDate, 'dd/mm/yyyy');
				},
			},
		];
	}

	statusList = [];
	PartyMenuList = [];
	AttendanceGroup = [];
	AttendanceType = [];

	numberOfBooking = 0;
	numberOfDinnerPax = 0;
	numberOfReal = 0;
	numberOfKid = 0;
	numberOfForeigner = 0;

	preLoadData(event) {
		// Default time-frame = Relative "Today" (same as quick-pick Today)
		const relativeToday = { Type: 'Relative', IsPastDate: true, Period: 'Day', Amount: 0, IsNull: false };
		this.query.PartyDateTimeFrame = {
			From: { ...relativeToday },
			To: { ...relativeToday },
		};
		this.pageConfig.sort = [{ Dimension: 'PartyDate', Order: 'DESC' }];
		this.query.Status = '';
		this.query.TypeOfParty = '';
		this.query.CustomerGroup = '';
		this.query.CustomerType = '';

		Promise.all([this.env.getStatus('AttendanceBooking'), this.env.getType('PartyMenu'), this.env.getType('AttendanceGroup'), this.env.getType('AttendanceType')]).then(
			(values: any) => {
				if (values.length) {
					this.statusList = values[0].filter((d) => d.Code != 'AttendanceBooking');
					this.PartyMenuList = values[1].filter((d) => d.Code != 'PartyMenu');
					this.AttendanceGroup = values[2].filter((d) => d.Code != 'AttendanceGroup');
					this.AttendanceType = values[3].filter((d) => d.Code != 'AttendanceType');
				}

				super.preLoadData(event);
			}
		);
	}

	loadedData(event) {
		this.recomputeAttendanceAggregates();
		super.loadedData(event);
	}

	enrichListItem(row: any) {
		if (!row) {
			return row;
		}
		const i = { ...row };
		i.StatusText = lib.getAttrib(i.Status, this.statusList, 'Name', '', 'Code');
		i.StatusColor = lib.getAttrib(i.Status, this.statusList, 'Color', '', 'Code');
		i.TypeOfPartyText = lib.getAttrib(i.TypeOfParty, this.PartyMenuList, 'Name', '', 'Code');
		return i;
	}

	onListItemsPatched() {
		this.recomputeAttendanceAggregates();
	}

	private recomputeAttendanceAggregates() {
		this.numberOfBooking = 0;
		this.numberOfDinnerPax = 0;
		this.numberOfReal = 0;
		this.numberOfKid = 0;
		this.numberOfForeigner = 0;

		this.numberOfBooking = this.items.length;

		this.items.forEach((i) => {
			this.numberOfDinnerPax += i.DinnerPax || 0;
			this.numberOfReal += i.RealField || 0;
			this.numberOfKid += i.Kids || 0;
			this.numberOfForeigner += i.ForeignerNo || 0;
			i.StatusText = lib.getAttrib(i.Status, this.statusList, 'Name', '', 'Code');
			i.StatusColor = lib.getAttrib(i.Status, this.statusList, 'Color', '', 'Code');
			i.TypeOfPartyText = lib.getAttrib(i.TypeOfParty, this.PartyMenuList, 'Name', '', 'Code');
		});
	}

	// async showModal(i) {
	//     const modal = await this.modalController.create({
	//         component: AttendanceBookingDetailPage,
	//         componentProps: {
	//             item: i,
	//             id: i.Id
	//         },
	//         cssClass: 'my-custom-class'
	//     });
	//     return await modal.present();
	// }

	// add() {
	//     let newItem = {
	//         Id: 0,
	//     };
	//     this.showModal(newItem);
	// }
}
