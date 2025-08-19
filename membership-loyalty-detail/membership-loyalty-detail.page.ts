import { Component, ChangeDetectorRef } from '@angular/core';
import { NavController, LoadingController, AlertController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { ActivatedRoute } from '@angular/router';
import { EnvService } from 'src/app/services/core/env.service';
import { CRM_ContactProvider, CRM_MembershipLoyaltyProvider, CRM_PolLevelProvider } from 'src/app/services/static/services.service';
import { FormBuilder, Validators, FormControl } from '@angular/forms';
import { CommonService } from 'src/app/services/core/common.service';

@Component({
	selector: 'app-membership-loyalty-detail',
	templateUrl: './membership-loyalty-detail.page.html',
	styleUrls: ['./membership-loyalty-detail.page.scss'],
	standalone: false,
})
export class MembershipLoyaltyDetailPage extends PageBase {
	polLevelList = [];
	_contactDataSource = this.buildSelectDataSource((term) => {
		return this.contactProvider.search({
			SortBy: ['Id_desc'],
			Take: 20,
			Skip: 0,
			IsCustomer: true,
			Term: term,
		});
	});
	constructor(
		public pageProvider: CRM_MembershipLoyaltyProvider,
		public polLevelProvider: CRM_PolLevelProvider,
		public contactProvider: CRM_ContactProvider,
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
			IDPolLevel: ['', Validators.required],
			IDContact: ['', Validators.required],
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
			Point: [''],
		});
	}

	preLoadData(event?: any): void {
		Promise.all([this.polLevelProvider.read()]).then((values: any) => {
			this.polLevelList = values[0].data;
			super.preLoadData();
		});
	}

	loadedData(event?: any, ignoredFromGroup?: boolean): void {
		if (this.item?.Id && this.item?._Contact) {
			this._contactDataSource.selected = [];
			this._contactDataSource.selected.push(this.item._Contact);
		}

		this._contactDataSource.initSearch();
		super.loadedData();
	}

	segmentView = 's1';
	segmentChanged(ev: any) {
		this.segmentView = ev.detail.value;
	}

	async saveChange() {
		super.saveChange2();
	}
}
