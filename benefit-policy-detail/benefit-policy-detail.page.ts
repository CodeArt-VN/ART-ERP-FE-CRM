import { Component, ChangeDetectorRef, ViewChild, ElementRef, QueryList, ViewChildren } from '@angular/core';
import { NavController, LoadingController, AlertController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { ActivatedRoute } from '@angular/router';
import { EnvService } from 'src/app/services/core/env.service';
import { FormBuilder, Validators, FormControl, FormArray } from '@angular/forms';
import { CommonService } from 'src/app/services/core/common.service';
import { CRM_BrandProvider, CRM_PolBenefitProvider, CRM_PolLevelProvider } from 'src/app/services/static/services.service';
import { ApiSetting } from 'src/app/services/static/api-setting';
import { environment } from 'src/environments/environment';
import { DynamicScriptLoaderService } from 'src/app/services/custom/custom.service';
import { thirdPartyLibs } from 'src/app/services/static/thirdPartyLibs';

declare var Quill: any;

@Component({
	selector: 'app-benefit-policy-detail',
	templateUrl: './benefit-policy-detail.page.html',
	styleUrls: ['./benefit-policy-detail.page.scss'],
	standalone: false,
})
export class BenefitPolicyDetailPage extends PageBase {

	constructor(
		public pageProvider: CRM_PolBenefitProvider,
		public env: EnvService,
		public navCtrl: NavController,
		public route: ActivatedRoute,
		public alertCtrl: AlertController,
		public formBuilder: FormBuilder,
		public cdr: ChangeDetectorRef,
		public loadingController: LoadingController,
		public commonService: CommonService,
		private dynamicScriptLoaderService: DynamicScriptLoaderService
	) {
		super();
		this.pageConfig.isDetailPage = true;

		this.formGroup = formBuilder.group({
			// IDBranch: [this.env.selectedBranch],
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
		});
	}

	loadedData(event?: any, ignoredFromGroup?: boolean): void {
		super.loadedData();
		console.log(this.item);
	}

	segmentView = 's1';
	segmentChanged(ev: any) {
		this.segmentView = ev.detail.value;
	}

	saveChange() {
		return this.saveChange2();
	}

}
