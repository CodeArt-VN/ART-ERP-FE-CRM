import { Component, ChangeDetectorRef } from '@angular/core';
import { NavController, LoadingController, AlertController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { ActivatedRoute } from '@angular/router';
import { EnvService } from 'src/app/services/core/env.service';
import { BRA_BranchProvider, CRM_CampaignProvider, HRM_StaffProvider } from 'src/app/services/static/services.service';
import { FormBuilder, Validators, FormControl } from '@angular/forms';
import { CommonService } from 'src/app/services/core/common.service';

@Component({
	selector: 'app-campaign-detail',
	templateUrl: './campaign-detail.page.html',
	styleUrls: ['./campaign-detail.page.scss'],
	standalone: false,
})
export class CampaignDetailPage extends PageBase {
	_staffDataSource = this.buildSelectDataSource((term) => {
		return this.staffProvider.search({ Take: 20, Skip: 0, Keyword: term });
	});

	constructor(
		public pageProvider: CRM_CampaignProvider,
		public branchProvider: BRA_BranchProvider,
		public env: EnvService,
		public navCtrl: NavController,
		public route: ActivatedRoute,
		public alertCtrl: AlertController,
		public formBuilder: FormBuilder,
		public cdr: ChangeDetectorRef,
		public loadingController: LoadingController,
		public commonService: CommonService,

		public staffProvider: HRM_StaffProvider
	) {
		super();
		this.pageConfig.isDetailPage = true;

		this.formGroup = formBuilder.group({
			IDOwner: [''],
			IDStatus: [1, Validators.required],
			IDType: [''],
			IDParent: [''],
			IDBranch: [this.env.selectedBranch],
			Id: new FormControl({ value: '', disabled: true }),
			Code: [''],
			Name: [''],
			Remark: [''],
			StartDate: ['', Validators.required],
			EndDate: ['', Validators.required],
			NumSent: ['', Validators.required],
			ExpectedResponse: ['', Validators.required],
			ExpectedRevenue: ['', Validators.required],
			BudgetedCost: ['', Validators.required],
			ActualCost: ['', Validators.required],
			IsActive: ['f', Validators.required],
			HierarchyActualCost: ['', Validators.required],
			HierarchyBudgetedCost: ['', Validators.required],
			NumberOfContacts: ['', Validators.required],
			HierarchyNumberOfContacts: ['', Validators.required],
			NumberOfConvertedLeads: ['', Validators.required],
			HierarchyNumberOfConvertedLeads: ['', Validators.required],
			HierarchyExpectedRevenue: ['', Validators.required],
			NumberOfLeads: ['', Validators.required],
			HierarchyNumberOfLeads: ['', Validators.required],
			HierarchyNumberSent: ['', Validators.required],
			NumberOfOpportunities: ['', Validators.required],
			HierarchyNumberOfOpportunities: ['', Validators.required],
			NumberOfResponses: ['', Validators.required],
			HierarchyNumberOfResponses: ['', Validators.required],
			AmountAllOpportunities: ['', Validators.required],
			HierarchyAmountAllOpportunities: ['', Validators.required],
			AmountWonOpportunities: ['', Validators.required],
			HierarchyAmountWonOpportunities: ['', Validators.required],
			NumberOfWonOpportunities: [''],
			HierarchyNumberOfWonOpportunities: ['', Validators.required],
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
		super.preLoadData(event);
	}

	loadedData(event?: any, ignoredFromGroup?: boolean): void {
		if (this.item) {
			if (this.item._Owner) {
				this._staffDataSource.selected = [this.item._Owner];
			}
		}

		this._staffDataSource.initSearch();

		super.loadedData(event, ignoredFromGroup);
	}

	async saveChange() {
		super.saveChange2();
	}
}
