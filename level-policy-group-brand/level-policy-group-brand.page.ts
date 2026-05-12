import { Component } from '@angular/core';
import { NavController, ModalController, AlertController, LoadingController, PopoverController } from '@ionic/angular';
import { EnvService } from 'src/app/services/core/env.service';
import { PageBase } from 'src/app/page-base';
import { CRM_PolLevelGroupBrandProvider } from 'src/app/services/static/services.service';
import { Location } from '@angular/common';
import { SortConfig } from 'src/app/interfaces/options-interface';

@Component({
	selector: 'app-level-policy-group-brand',
	templateUrl: 'level-policy-group-brand.page.html',
	styleUrls: ['level-policy-group-brand.page.scss'],
	standalone: false,
})
export class LevelPolicyGroupBrandPage extends PageBase {
	constructor(
		public pageProvider: CRM_PolLevelGroupBrandProvider,
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
