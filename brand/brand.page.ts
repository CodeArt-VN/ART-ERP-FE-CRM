import { Component } from '@angular/core';
import { NavController, ModalController, AlertController, LoadingController, PopoverController } from '@ionic/angular';
import { EnvService } from 'src/app/services/core/env.service';
import { PageBase } from 'src/app/page-base';
import { CRM_BrandProvider } from 'src/app/services/static/services.service';
import { Location } from '@angular/common';
import { SortConfig } from 'src/app/models/options-interface';
import { environment } from 'src/environments/environment';

@Component({
	selector: 'app-brand',
	templateUrl: 'brand.page.html',
	styleUrls: ['brand.page.scss'],
	standalone: false,
})
export class BrandPage extends PageBase {

	
	imageServer = environment.posImagesServer;
	noImage = 'assets/avartar-empty.jpg';


	constructor(
		public pageProvider: CRM_BrandProvider,
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
