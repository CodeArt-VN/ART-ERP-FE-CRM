import { Component } from '@angular/core';
import { NavController, ModalController, AlertController, LoadingController, PopoverController } from '@ionic/angular';
import { Location } from '@angular/common';
import { PageBase } from 'src/app/page-base';
import { EnvService } from 'src/app/services/core/env.service';
import { CRM_PipelineProvider } from 'src/app/services/static/services.service';

@Component({
	selector: 'app-pipeline',
	templateUrl: 'pipeline.page.html',
	standalone: false,
})
export class PipelinePage extends PageBase {
	constructor(
		public pageProvider: CRM_PipelineProvider,
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
		this.pageConfig.sort = [{ Dimension: 'Sort', Order: 'ASC' }];
		super.preLoadData(event);
	}
}
