import { CRM_MemberCardProvider } from './../../../services/static/services.service';
import { Component } from '@angular/core';
import { Location } from '@angular/common';
import { NavController, ModalController, AlertController, LoadingController, PopoverController } from '@ionic/angular';
import { environment } from 'src/environments/environment';
import { PageBase } from 'src/app/page-base';
import { EnvService } from 'src/app/services/core/env.service';
import { BRA_BranchProvider } from 'src/app/services/static/services.service';

@Component({
	selector: 'app-member-card',
	templateUrl: 'member-card.page.html',
	styleUrls: ['member-card.page.scss'],
	standalone: false,
})
export class MemberCardPage extends PageBase {

	constructor(
		public pageProvider: CRM_MemberCardProvider,
		public branchProvider: BRA_BranchProvider,
		public modalController: ModalController,
		public popoverCtrl: PopoverController,
		public alertCtrl: AlertController,
		public loadingController: LoadingController,
		public env: EnvService,
		public navCtrl: NavController,
		public location: Location
	) {
		super();
	}
	statusList = [];
	preLoadData(event?: any): void {
		Promise.all([this.env.getStatus('StandardApprovalStatus')]).then((values: any) => {
			this.statusList = values[0];
			super.preLoadData(event);
		});
	}
	loadedData(event) {
		this.items.forEach((i) => {
			i._Status = this.statusList.find((d) => d.Code == i.Status);
			i.Avatar = i._Member?.Code ? environment.staffAvatarsServer + i._Staff?.Code + '.jpg' : 'assets/avartar-empty.jpg';
			i.Email = i._Member?.Email ? i._Staff?.Email.replace(environment.loginEmail, '') : '';
		});

		super.loadedData(event);
	}
}
