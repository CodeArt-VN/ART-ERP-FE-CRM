import { Component, ChangeDetectorRef } from '@angular/core';
import { NavController, LoadingController, AlertController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { ActivatedRoute } from '@angular/router';
import { EnvService } from 'src/app/services/core/env.service';
import { BRA_BranchProvider, CRM_PolLevelProvider, CRM_PolLoyaltyProvider } from 'src/app/services/static/services.service';
import { FormBuilder, Validators, FormControl } from '@angular/forms';
import { CommonService } from 'src/app/services/core/common.service';
import { ApiSetting } from 'src/app/services/static/api-setting';

@Component({
	selector: 'app-loyalty-policy-detail',
	templateUrl: './loyalty-policy-detail.page.html',
	styleUrls: ['./loyalty-policy-detail.page.scss'],
	standalone: false,
})
export class LoyaltyPolicyDetailPage extends PageBase {
	_isNeverExpired = true;
	polLevelList = [];
	statusList = [];
	eventTypeList = [];
	calculationMethodList = [];
	CalculationByList = [];
	_isValue = true;
	_isConversionRate = true;
	conversionRateValue = 0;
	constructor(
		public pageProvider: CRM_PolLoyaltyProvider,
		public polLevelProvider: CRM_PolLevelProvider,
		public branchProvider: BRA_BranchProvider,
		public env: EnvService,
		public navCtrl: NavController,
		public route: ActivatedRoute,
		public alertCtrl: AlertController,
		public formBuilder: FormBuilder,
		public cdr: ChangeDetectorRef,
		public loadingController: LoadingController,
		public commonService: CommonService
	) {
		super();
		this.pageConfig.isDetailPage = true;

		this.formGroup = formBuilder.group({
			IDPolLevel: [],
			Id: new FormControl({ value: '', disabled: true }),
			Code: [''],
			Name: ['', Validators.required],
			Remark: [''],
			Sort: [''],
			IsDisabled: new FormControl({ value: '', disabled: true }),
			IsDeleted: new FormControl({ value: '', disabled: true }),
			CreatedBy: new FormControl({ value: '', disabled: true }),
			CreatedDate: new FormControl({ value: '', disabled: true }),
			ModifiedBy: new FormControl({ value: '', disabled: true }),
			ModifiedDate: new FormControl({ value: '', disabled: true }),
			Status: new FormControl({ value: 'Draft', disabled: true }),
			StartDate: ['', Validators.required],
			EndDate: [null],
			EventType: ['', Validators.required],
			CalculationMethod: [''],
			CalculationBy: [''],
			ConversionRate: [''],
			PointConversionRate: [''],
			Value: [''],
		});
	}

	preLoadData(event?: any): void {
		Promise.all([
			this.polLevelProvider.read(),
			this.env.getStatus('Loyalty'),
			this.env.getType('EventType'),
			this.env.getType('CalculationMethodType'),
			this.env.getType('CalculationByType'),
		]).then((values: any) => {
			this.polLevelList = values[0].data;
			this.statusList = values[1];
			this.eventTypeList = values[2];
			this.calculationMethodList = values[3];
			this.CalculationByList = values[4];
			super.preLoadData();
		});
	}

	loadedData(event?: any, ignoredFromGroup?: boolean): void {
		if (!this.item?.Id) {
			this.formGroup.controls.Status.markAsDirty();
		}
		if (this.item?.CalculationMethod == 'ByCount') {
			this._isValue = true;
			this._isConversionRate = false;
		}
		else {
			this._isValue = false;
			this._isConversionRate = true;
		}
		this.conversionRateValue = this.item?.ConversionRate || 0;
		super.loadedData();
	}

	segmentView = 's1';
	segmentChanged(ev: any) {
		this.segmentView = ev.detail.value;
	}

	async saveChange() {
		super.saveChange2();
	}

	changeNeverExpired() {
		if (this._isNeverExpired && this.formGroup.controls.EndDate.value != null) {
			this.formGroup.controls.EndDate.setValue(null);
			this.formGroup.controls.EndDate.markAsDirty();
		}
	}

	changeCalculationMethod() {
		if (this.formGroup.controls.CalculationMethod.value === 'ByCount') {
			this._isValue = true;
			this._isConversionRate = false;
			this.formGroup.controls.ConversionRate.setValue(null);
			this.formGroup.controls.ConversionRate.clearAsyncValidators();
			this.formGroup.controls.ConversionRate.updateValueAndValidity();
			this.formGroup.controls.ConversionRate.markAsDirty();
			this.formGroup.controls.Value.setValidators([Validators.required]);
			this.formGroup.controls.Value.updateValueAndValidity();
		} else {
			this._isValue = false;
			this._isConversionRate = true;
			this.formGroup.controls.Value.setValue(null);
			this.formGroup.controls.Value.clearAsyncValidators();
			this.formGroup.controls.Value.updateValueAndValidity();
			this.formGroup.controls.Value.markAsDirty();
			this.formGroup.controls.ConversionRate.setValidators([Validators.required]);
			this.formGroup.controls.ConversionRate.updateValueAndValidity();
		}
		this.saveChange();
	}

	changeConversionRate() {
		this.conversionRateValue = this.formGroup.controls.ConversionRate.value || 0;
		this.saveChange();
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
									Ids: [this.id],
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
										this.refresh();
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
