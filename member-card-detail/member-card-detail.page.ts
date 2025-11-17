import { Component, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, Validators, FormControl } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { NavController, LoadingController, AlertController } from '@ionic/angular';

import { PageBase } from 'src/app/page-base';
import { CommonService } from 'src/app/services/core/common.service';
import { EnvService } from 'src/app/services/core/env.service';
import { BRA_BranchProvider, CRM_ContactProvider, CRM_MemberCardProvider } from 'src/app/services/static/services.service';

@Component({
	selector: 'app-member-card-detail',
	templateUrl: './member-card-detail.page.html',
	styleUrls: ['./member-card-detail.page.scss'],
	standalone: false,
})
export class MemberCardDetailPage extends PageBase {

	statusList = [];
	typeList = [];
	subTypeList = [];
	constructor(
		public pageProvider: CRM_MemberCardProvider,
		public contactProvider: CRM_ContactProvider,
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
			IDBranch: [this.env.selectedBranch],
			Id: new FormControl({ value: '', disabled: true }),
			Code: [''],
			Name: ['', Validators.required],
			Remark: [''],
			Sort: [''],
			Status: ['Draft'],
			IsDisabled: new FormControl({ value: '', disabled: true }),
			IsDeleted: new FormControl({ value: '', disabled: true }),
			CreatedBy: new FormControl({ value: '', disabled: true }),
			CreatedDate: new FormControl({ value: '', disabled: true }),
			ModifiedBy: new FormControl({ value: '', disabled: true }),
			ModifiedDate: new FormControl({ value: '', disabled: true }),
			IDMember: ['', Validators.required],
			StartDate: ['', Validators.required],
			EndDate: [''],
			Type: [''],
			SubType: [''],
			Quota: [0],
			DailyLimit: [0],
		});
	}

	preLoadData(event?: any): void {
		Promise.all([
			this.env.getStatus('StandardApprovalStatus'), 
			this.env.getType('MemberCardType'),
			this.env.getType('MemberCardSubType')]).then((values: any) => {
			this.statusList = values[0];
			this.typeList = values[1];
			this.subTypeList = values[2];
			super.preLoadData(event);
		});
	}

	

	loadedData(event?: any, ignoredFromGroup?: boolean): void {
		if (this.item._Member) {
			this._memberDataSource.selected = [...[], this.item._Member];
		}
		this._memberDataSource.initSearch();
		super.loadedData(event, ignoredFromGroup);
	}
;

	_memberDataSource = this.buildSelectDataSource((term) => {
		return this.contactProvider.search({ SkipAddress: true, SortBy: ['Id_desc'], Take: 20, Skip: 0, Term: term });
	});

	segmentView = 's1';
	segmentChanged(ev: any) {
		this.segmentView = ev.detail.value;
	}
	async saveChange() {
		super.saveChange2();
	}
}
