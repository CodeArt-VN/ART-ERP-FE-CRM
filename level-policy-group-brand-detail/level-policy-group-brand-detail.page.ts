import { Component, ChangeDetectorRef } from '@angular/core';
import { NavController, LoadingController, AlertController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { ActivatedRoute } from '@angular/router';
import { EnvService } from 'src/app/services/core/env.service';
import { FormBuilder, Validators, FormControl } from '@angular/forms';
import { CommonService } from 'src/app/services/core/common.service';
import { CRM_BrandProvider, CRM_PolLevelGroupBrandProvider, CRM_PolLevelGroupProvider } from 'src/app/services/static/services.service';

@Component({
	selector: 'app-level-policy-group-brand-detail',
	templateUrl: './level-policy-group-brand-detail.page.html',
	styleUrls: ['./level-policy-group-brand-detail.page.scss'],
	standalone: false,
})
export class LevelPolicyGroupBrandDetailPage extends PageBase {
	brandList = [];
	polLevelGroupList = [];

	constructor(
		public pageProvider: CRM_PolLevelGroupBrandProvider,
		public brandProvider: CRM_BrandProvider,
		public polLevelGroupProvider: CRM_PolLevelGroupProvider,
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
			IDPolLevelGroup: ['', Validators.required],
			IDBrand: ['', Validators.required],
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

	preLoadData(event?: any): void {
		Promise.all([this.polLevelGroupProvider.read(), this.brandProvider.read()]).then((values: any) => {
			this.polLevelGroupList = values[0].data;
			this.brandList = values[1].data;
			super.preLoadData(event);
		});
	}

	segmentView = 's1';
	segmentChanged(ev: any) {
		this.segmentView = ev.detail.value;
	}

	saveChange() {
		return this.saveChange2();
	}
}
