import { Component } from '@angular/core';
import { NavController, ModalController, AlertController, LoadingController, PopoverController } from '@ionic/angular';
import { EnvService } from 'src/app/services/core/env.service';
import { PageBase } from 'src/app/page-base';
import { CRM_RewardProvider } from 'src/app/services/static/services.service';
import { Location } from '@angular/common';
import { SortConfig } from 'src/app/models/options-interface';
import { environment } from 'src/environments/environment';
import { lib } from 'src/app/services/static/global-functions';

@Component({
	selector: 'app-reward',
	templateUrl: 'reward.page.html',
	styleUrls: ['reward.page.scss'],
	standalone: false,
})
export class RewardPage extends PageBase {
	imageServer = environment.posImagesServer;
	noImage = 'assets/avartar-empty.jpg';
	statusList = [];

	constructor(
		public pageProvider: CRM_RewardProvider,
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
		Promise.all([this.env.getStatus('Reward')]).then((values: any) => {
			this.statusList = values[0];
			super.preLoadData(event);
		});
	}

	loadedData(event?: any, ignoredFromGroup?: boolean): void {
		this.items.forEach((i) => {
			i._Status = this.statusList.find((d) => d.Code == i.Status);
		});
		super.loadedData(event, ignoredFromGroup);
	}
}
