import { Component } from '@angular/core';
import { NavController, ModalController, AlertController, LoadingController, PopoverController } from '@ionic/angular';
import { EnvService } from 'src/app/services/core/env.service';
import { PageBase } from 'src/app/page-base';
import { BRA_BranchProvider, CRM_MembershipLoyaltyProvider, SYS_ActionProvider, SYS_IntegrationProviderProvider } from 'src/app/services/static/services.service';
import { Location } from '@angular/common';
import { SortConfig } from 'src/app/interfaces/options-interface';

@Component({
	selector: 'app-membership-loyalty',
	templateUrl: 'membership-loyalty.page.html',
	styleUrls: ['membership-loyalty.page.scss'],
	standalone: false,
})
export class MembershipLoyaltyPage extends PageBase {

	constructor(
		public pageProvider: CRM_MembershipLoyaltyProvider,
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
		super.preLoadData(event);
	}
	loadedData(event) {
		super.loadedData(event);
	}
}
