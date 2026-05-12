import { Component, ChangeDetectorRef } from '@angular/core';
import { NavController, LoadingController, AlertController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { ActivatedRoute } from '@angular/router';
import { EnvService } from 'src/app/services/core/env.service';
import { FormBuilder, Validators, FormControl, FormGroup } from '@angular/forms';
import { CommonService } from 'src/app/services/core/common.service';
import { CRM_PolLevelGroupProvider, CRM_PolLevelProvider } from 'src/app/services/static/services.service';

@Component({
	selector: 'app-level-policy-group-detail',
	templateUrl: './level-policy-group-detail.page.html',
	styleUrls: ['./level-policy-group-detail.page.scss'],
	standalone: false,
})
export class LevelPolicyGroupDetailPage extends PageBase {
	polLevelList = [];

	constructor(
		public pageProvider: CRM_PolLevelGroupProvider,
		public polLevelProvider: CRM_PolLevelProvider,
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
		super.loadedData(event, ignoredFromGroup);
		this.loadPolLevels();
	}

	segmentView = 's1';
	segmentChanged(ev: any) {
		this.segmentView = ev.detail.value;
		if (this.segmentView == 's2') {
			this.loadPolLevels();
		}
	}

	saveChange() {
		return this.saveChange2();
	}

	savedChange(savedItem?: any, form?: FormGroup<any>): void {
		super.savedChange(savedItem, form);
		this.loadedData(null);
	}

	loadPolLevels() {
		if (!this.item?.Id) {
			this.polLevelList = [];
			return;
		}

		this.polLevelProvider.read({ IDPolLevelGroup: this.item.Id, Take: 5000, SortBy: 'Level' }).then((resp: any) => {
			this.polLevelList = resp.data;
		});
	}
}
