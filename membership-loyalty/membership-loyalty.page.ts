import { Component } from '@angular/core';
import { NavController, ModalController, AlertController, LoadingController, PopoverController } from '@ionic/angular';
import { EnvService } from 'src/app/services/core/env.service';
import { PageBase } from 'src/app/page-base';
import {
	BRA_BranchProvider,
	CRM_MembershipLoyaltyProvider,
	CRM_PolLevelProvider,
	SYS_ActionProvider,
	SYS_IntegrationProviderProvider,
} from 'src/app/services/static/services.service';
import { Location } from '@angular/common';
import { SortConfig } from 'src/app/interfaces/options-interface';
import { CRM_PolLevel } from 'src/app/models/model-list-interface';

@Component({
	selector: 'app-membership-loyalty',
	templateUrl: 'membership-loyalty.page.html',
	styleUrls: ['membership-loyalty.page.scss'],
	standalone: false,
})
export class MembershipLoyaltyPage extends PageBase {
	polLevelList = [];
	constructor(
		public pageProvider: CRM_MembershipLoyaltyProvider,
		public polLevelProvider: CRM_PolLevelProvider,
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
		Promise.all([this.polLevelProvider.read()]).then(([polLevelResult]: any[]) => {
			this.polLevelList = polLevelResult.data;
			super.preLoadData(event);
		});
	}

	loadedData(event) {
		super.loadedData(event);
	}

	LevelEvaluation() {
		this.env
			.showLoading(
				'Evaluating levels...',
				this.pageProvider.commonService
					.connect(
						'POST',
						'CRM/MembershipLoyalty/LevelEvaluation',
						this.selectedItems.map((d) => d.Id)
					)
					.toPromise()
			)
			.then((res: any) => {
				this.env.showMessage('Level evaluation completed','success' );
				this.refresh();
			});
	}
}
