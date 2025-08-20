import { Component } from '@angular/core';
import { NavController, ModalController, AlertController, LoadingController, PopoverController } from '@ionic/angular';
import { EnvService } from 'src/app/services/core/env.service';
import { PageBase } from 'src/app/page-base';
import {  CRM_PolBenefitProvider } from 'src/app/services/static/services.service';
import { Location } from '@angular/common';
import { SortConfig } from 'src/app/models/options-interface';
import { environment } from 'src/environments/environment';

@Component({
	selector: 'app-benefit-policy',
	templateUrl: 'benefit-policy.page.html',
	styleUrls: ['benefit-policy.page.scss'],
	standalone: false,
})
export class BenefitPolicyPage extends PageBase {


	constructor(
		public pageProvider: CRM_PolBenefitProvider,
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
		let sorted: SortConfig[] = [{ Dimension: 'Id', Order: 'DESC' }];
		this.pageConfig.sort = sorted;

		super.preLoadData(event);
	}
}
