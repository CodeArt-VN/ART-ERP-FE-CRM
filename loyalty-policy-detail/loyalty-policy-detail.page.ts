import { Component, ChangeDetectorRef } from '@angular/core';
import { NavController, LoadingController, AlertController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { ActivatedRoute } from '@angular/router';
import { EnvService } from 'src/app/services/core/env.service';
import { BRA_BranchProvider, CRM_PolLevelProvider, CRM_PolLoyaltyProvider } from 'src/app/services/static/services.service';
import { FormBuilder, Validators, FormControl } from '@angular/forms';
import { CommonService } from 'src/app/services/core/common.service';

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
			Status:new FormControl({ value: 'Draft', disabled: true }),
			StartDate: ['', Validators.required],
			EndDate: [null],
			EventType: ['', Validators.required],
			CalculationMethod: [''],
			CalculationBy: [''],
			ConversionRate: [''],
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
		if(!this.item?.Id){
			this.formGroup.controls.Status.markAsDirty();
		}
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
}
