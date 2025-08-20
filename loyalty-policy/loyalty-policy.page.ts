import { Component } from '@angular/core';
import { NavController, ModalController, AlertController, LoadingController, PopoverController } from '@ionic/angular';
import { EnvService } from 'src/app/services/core/env.service';
import { PageBase } from 'src/app/page-base';
import { CRM_PolLoyaltyProvider } from 'src/app/services/static/services.service';
import { Location } from '@angular/common';

@Component({
	selector: 'app-loyalty-policy',
	templateUrl: 'loyalty-policy.page.html',
	styleUrls: ['loyalty-policy.page.scss'],
	standalone: false,
})
export class LoyaltyPolicyPage extends PageBase {
	statusList = [];
	constructor(
		public pageProvider: CRM_PolLoyaltyProvider,
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

	preLoadData(event?: any): void {
		Promise.all([this.env.getStatus('Loyalty')]).then((values: any) => {
			this.statusList = values[0];
			super.preLoadData(event);
		});
	}
	loadedData(event) {
		this.items.forEach((i) => {
			i._Status = this.statusList.find((d) => d.Code == i.Status);
		});
		super.loadedData(event);
	}
}
