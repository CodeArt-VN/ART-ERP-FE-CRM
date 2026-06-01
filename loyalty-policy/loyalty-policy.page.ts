import { Component } from '@angular/core';
import { NavController, ModalController, AlertController, LoadingController, PopoverController } from '@ionic/angular';
import { EnvService } from 'src/app/services/core/env.service';
import { PageBase } from 'src/app/page-base';
import { CRM_PolLoyaltyProvider } from 'src/app/services/static/services.service';
import { Location } from '@angular/common';
import { ApiSetting } from 'src/app/services/static/api-setting';

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

	approve(): void {
		let text = 'Duyệt';
		let message = 'Bạn có chắc chắn duyệt các đối tượng này?';
		this.changeStatus(text, message, 'Approved');
	}

	disapprove(): void {
		let text = 'Không duyệt';
		let message = 'Bạn có chắc chắn từ chối các đối tượng này?';
		this.changeStatus(text, message, 'Unapproved');
	}

	changeStatus(text, message, Status) {
		this.alertCtrl
			.create({
				header: text,
				//subHeader: '---',
				message: message,
				buttons: [
					{
						text: 'Hủy',
						role: 'cancel',
						handler: () => {
							//console.log('Không xóa');
						},
					},
					{
						text: 'Xác nhận',
						cssClass: 'danger-btn',
						handler: () => {
							let publishEventCode = this.pageConfig.pageName;
							let apiPath = {
								method: 'POST',
								url: function () {
									return ApiSetting.apiDomain('CRM/PolLoyalty/ChangeStatus/');
								},
							};

							if (this.submitAttempt == false) {
								this.submitAttempt = true;
								let postDTO = {
									Ids: this.selectedItems.map((e) => e.Id),
									Status: Status,
								};
								this.pageProvider.commonService
									.connect(apiPath.method, apiPath.url(), postDTO)
									.toPromise()
									.then((savedItem: any) => {
										if (publishEventCode) {
											this.env.publishEvent({
												Code: publishEventCode,
											});
										}
										this.env.showMessage('Saving completed!', 'success');
										this.submitAttempt = false;
									})
									.catch((err) => {
										this.submitAttempt = false;
										//console.log(err);
									});
							}
						},
					},
				],
			})
			.then((alert) => {
				alert.present();
			});
	}
}
