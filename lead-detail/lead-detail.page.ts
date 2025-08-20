import { Component, ChangeDetectorRef } from '@angular/core';
import { NavController, LoadingController, AlertController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { ActivatedRoute } from '@angular/router';
import { EnvService } from 'src/app/services/core/env.service';
import { BRA_BranchProvider, CRM_CampaignProvider, CRM_LeadProvider } from 'src/app/services/static/services.service';
import { FormBuilder, Validators, FormControl } from '@angular/forms';
import { CommonService } from 'src/app/services/core/common.service';

@Component({
	selector: 'app-lead-detail',
	templateUrl: './lead-detail.page.html',
	styleUrls: ['./lead-detail.page.scss'],
	standalone: false,
})
export class LeadDetailPage extends PageBase {
	campaignList = [];

	constructor(
		public pageProvider: CRM_LeadProvider,
		public branchProvider: BRA_BranchProvider,
		public env: EnvService,
		public navCtrl: NavController,
		public route: ActivatedRoute,
		public alertCtrl: AlertController,
		public formBuilder: FormBuilder,
		public cdr: ChangeDetectorRef,
		public loadingController: LoadingController,
		public commonService: CommonService,
		public campaignProvider: CRM_CampaignProvider
	) {
		super();
		this.pageConfig.isDetailPage = true;

		this.formGroup = formBuilder.group({
			IDCampaign: [''],
			IDOwner: [''],
			IDStatus: [1, Validators.required],
			IDRating: [''],
			IDSource: [''],
			IDIndustry: [''],
			IDSector: [''],
			IDCountry: [''],
			IDCity: [''],
			IDProvince: [''],
			IDBranch: [this.env.selectedBranch],
			Id: new FormControl({ value: '', disabled: true }),
			Code: [''],
			Individual: [''],
			Name: [''],
			FirstName: [''],
			LastName: [''],
			Company: [''],
			Title: [''],
			Remark: [''],
			Address: [''],
			Street: [''],
			ZipCode: [''],
			AnnualRevenue: ['', Validators.required],
			Email: [''],
			HasOptedOutOfEmail: ['', Validators.required],
			Phone: [''],
			MobilePhone: [''],
			DoNotCall: ['', Validators.required],
			Fax: [''],
			HasOptedOutOfFax: ['', Validators.required],
			NumberOfEmployees: [''],
			Website: [''],
			LastTransferDate: [''],
			Sort: [''],
			IsDisabled: new FormControl({ value: '', disabled: true }),
			IsDeleted: new FormControl({ value: '', disabled: true }),
			CreatedBy: new FormControl({ value: '', disabled: true }),
			ModifiedBy: new FormControl({ value: '', disabled: true }),
			CreatedDate: new FormControl({ value: '', disabled: true }),
			ModifiedDate: new FormControl({ value: '', disabled: true }),
		});
	}

	preLoadData(event?: any): void {
		Promise.all([this.campaignProvider.read()]).then((values: any) => {
			this.campaignList = values[0].data;
			super.preLoadData(event);
		});
	}

	loadedData(event?: any, ignoredFromGroup?: boolean): void {
		super.loadedData(event, ignoredFromGroup);
		if (this.item) {
		}
	}

	segmentView = 's1';
	segmentChanged(ev: any) {
		this.segmentView = ev.detail.value;
	}

	async saveChange() {
		super.saveChange2();
	}
}
