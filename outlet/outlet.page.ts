import { Component } from '@angular/core';
import { NavController, ModalController, AlertController, LoadingController, PopoverController } from '@ionic/angular';
import { EnvService } from 'src/app/services/core/env.service';
import { PageBase } from 'src/app/page-base';
import { BRA_BranchProvider, CRM_ContactProvider } from 'src/app/services/static/services.service';
import { Location } from '@angular/common';
import { lib } from 'src/app/services/static/global-functions';
import { ApiSetting } from 'src/app/services/static/api-setting';

@Component({
	selector: 'app-outlet',
	templateUrl: 'outlet.page.html',
	styleUrls: ['outlet.page.scss'],
	standalone: false,
})
export class OutletPage extends PageBase {
	branchList = [];
	statusList = [];
	constructor(
		public pageProvider: CRM_ContactProvider,
		public branchProvider: BRA_BranchProvider,
		public modalController: ModalController,
		public popoverCtrl: PopoverController,
		public alertCtrl: AlertController,
		public loadingController: LoadingController,
		public env: EnvService,
		public navCtrl: NavController
	) {
		super();
	}

	departmentList = [];
	preLoadData() {
		this.query.Status = '';
		if (!this.sort.Id) {
			this.sort.Id = 'Id';
			this.sortToggle('Id', true);
		}

		if (this.pageConfig.pageName == 'vendor') {
			this.query.IgnoredBranch = true;
			this.query.IsVendor = true;
		}
		if (this.pageConfig.pageName == 'carrier') {
			this.query.IgnoredBranch = true;
			this.query.IsCarrier = true;
		} else if (this.pageConfig.pageName == 'distributor') {
			this.query.IgnoredBranch = true;
			this.query.IsDistributor = true;
		} else if (this.pageConfig.pageName == 'storer') {
			this.query.IgnoredBranch = true;
			this.query.IsStorer = true;
		} else if (this.pageConfig.pageName == 'outlet') {
			this.query.IsOutlets = true;
			this.query.IDOwner = this.pageConfig.canViewAllData ? 'all' : this.env.user.StaffID;
		} else if (this.pageConfig.pageName == 'customer') {
			this.query.IsCustomer = true;
			this.query.IDOwner = this.pageConfig.canViewAllData ? 'all' : this.env.user.StaffID;
		} else if (this.pageConfig.pageName == 'outlet' || this.pageConfig.pageName == 'contact-mobile') {
			this.query.IDOwner = this.pageConfig.canViewAllData ? 'all' : this.env.user.StaffID;
		}

		Promise.all([this.branchProvider.read(), this.env.getStatus('BusinessPartner')]).then((values: any) => {
			this.branchList = values[0]['data'];
			this.statusList = values[1];

			this.buildFlatTree(this.branchList, this.branchList, true).then((resp: any) => {
				this.branchList = resp;

				this.branchList.forEach((i) => {
					let prefix = '';
					for (let j = 1; j < i.level; j++) {
						prefix += '- ';
					}
					i.NamePadding = prefix + i.Name;
					if (i.Type == 'TitlePosition') {
						i.Flag = true;
					} else {
						this.departmentList.push(i);
					}
				});

				this.departmentList.forEach((i) => {
					i.IDs = [];
					this.getChildrenDepartmentID(i.IDs, i.Id);
				});

				this.departmentList.forEach((i) => {
					i.Query = JSON.stringify(i.IDs);
				});

				//console.log(this.departmentList)
			});
			super.preLoadData(null);
		});
	}

	getChildrenDepartmentID(ids, id) {
		ids.push(id);
		let children = this.departmentList.filter((i) => i.IDParent == id);
		children.forEach((i) => {
			this.getChildrenDepartmentID(ids, i.Id);
		});
	}

	loadedData(event) {
		this.items.forEach((i) => {
			i.Department = lib.getAttrib(i.IDDepartment, this.branchList);
			i.JobTitle = lib.getAttrib(i.IDJobTitle, this.branchList);
			i.StatusText = lib.getAttrib(i.Status, this.statusList, 'Name', '--', 'Code');
			i.StatusColor = lib.getAttrib(i.Status, this.statusList, 'Color', 'dark', 'Code');
		});

		super.loadedData(event);
	}
}
