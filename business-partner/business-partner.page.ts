import { Component, Renderer2 } from '@angular/core';
import { NavController, ModalController, AlertController, LoadingController, PopoverController } from '@ionic/angular';
import { EnvService } from 'src/app/services/core/env.service';
import { PageBase } from 'src/app/page-base';
import { BRA_BranchProvider, CRM_ContactProvider } from 'src/app/services/static/services.service';
import { Location } from '@angular/common';
import { lib } from 'src/app/services/static/global-functions';
import { ApiSetting } from 'src/app/services/static/api-setting';
import { FormBuilder } from '@angular/forms';
import { AddressService } from 'src/app/services/custom/custom.service';
import { APIList } from 'src/app/services/static/global-variable';
import { SYS_ConfigService } from 'src/app/services/custom/system-config.service';
import { MergeContactModalComponent } from './merge-contact-modal/merge-contact-modal.component';

@Component({
	selector: 'app-business-partner',
	templateUrl: 'business-partner.page.html',
	styleUrls: ['business-partner.page.scss'],
	standalone: false,
})
export class BusinessPartnerPage extends PageBase {
	branchList = [];
	statusList = [];
	findByValue = 'WorkPhone';
	mergeFunction = {
		isShowMergePopup: false,
		showSpinner: false,
		findBy: 'WorkPhone',
		items: [],
	};

	constructor(
		private renderer: Renderer2,
		public pageProvider: CRM_ContactProvider,
		public branchProvider: BRA_BranchProvider,
		public modalController: ModalController,
		public sysConfigService: SYS_ConfigService,
		public popoverCtrl: PopoverController,
		public alertCtrl: AlertController,
		public loadingController: LoadingController,
		public env: EnvService,
		public formBuilder: FormBuilder,
		public navCtrl: NavController,
		public location: Location,
		public addressService: AddressService
	) {
		super();
		this.pageConfig.ShowFeature = true;
	}

	departmentList = [];
	preLoadData() {
		if (!this.sort.Id) {
			this.sort.Id = 'Id';
			this.sortToggle('Id', true);
		}

		const pageTypeMap = {
			vendor: 'IsVendor',
			carrier: 'IsCarrier',
			distributor: 'IsDistributor',
			storer: 'IsStorer',
			outlet: 'IsOutlets',
			customer: 'IsCustomer',
		};
		this.query[pageTypeMap[this.pageConfig.pageName]] = true;

		this.query.IDOwner = this.pageConfig.canViewAllData ? 'all' : this.env.user.StaffID;

		Promise.all([
			this.branchProvider.read(),
			this.env.getStatus('BusinessPartner'),
			this.sysConfigService.getConfig(this.env.selectedBranch, ['ContactUsedApprovalModule']),
			this.addressService.getAddressSubdivision(),
		]).then((values: any) => {
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
				if (values[2]) {
					this.pageConfig = {
						...this.pageConfig,
						...values[2],
					};
					if (this.pageConfig.ContactUsedApprovalModule) {
						this.pageConfig.canApprove = false;
						this.pageConfig.canApprove = false;
					}
				}
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
		this.pageConfig.canSubmit = this.pageConfig.canSubmitBusinessPartnerForApproval;
		super.loadedData(event);
	}

	changeDuplicateKeywork(e) {
		const value = e?.detail?.value ?? e?.target?.value;
		if (value == 'WorkPhone') {
			this.findByValue = 'WorkPhone';
			delete this.query.TaxCode_eq;
		} else {
			this.findByValue = 'TaxCode';
			delete this.query.WorkPhone_eq;
		}
	}

	findByDuplicate() {
		// Do not set IgnoredBranch on this.query — it breaks branch filter on refresh/scroll.
		delete this.query.IgnoredBranch;

		const q = { FindBy: this.findByValue, IgnoredBranch: true };
		this.mergeFunction.items = [];
		this.mergeFunction.showSpinner = true;

		const apiPath = {
			method: 'GET',
			url: () => ApiSetting.apiDomain('CRM/Contact/FindDuplicates'),
		};
		this.pageProvider.commonService
			.connect(apiPath.method, apiPath.url(), q)
			.toPromise()
			.then((data: any) => {
				this.mergeFunction.items = Array.isArray(data) ? data : [];
			})
			.catch((err) => {
				this.mergeFunction.items = [];
				this.env.showMessage(err, 'danger');
			})
			.finally(() => {
				this.mergeFunction.showSpinner = false;
			});
	}

	trackByDuplicateValue(_: number, item: { Value?: string }) {
		return item?.Value;
	}

	// Toolbar calls page.merge() — PageBase.merge() is empty.
	merge() {
		this.showMergePopup();
	}

	async showMergePopup(e = null) {
		if (!this.selectedItems?.length || this.selectedItems.length < 2) {
			this.env.showMessage('Please select at least 2 contacts to merge', 'warning');
			return;
		}

		const modal = await this.modalController.create({
			component: MergeContactModalComponent,
			cssClass: 'modal90 merge-modal-shell',
			componentProps: {
				contactIds: this.selectedItems.map((i) => i.Id),
			},
		});
		await modal.present();
		const { role } = await modal.onWillDismiss();
		if (role === 'merged') {
			this.refresh();
		}
	}

	async export() {
		if (this.pageConfig.pageName == 'vendor') {
			APIList.CRM_Contact.getExport.url = () => {
				return ApiSetting.apiDomain('CRM/Contact/VendorExport/');
			};
			let apiPath = APIList.CRM_Contact.getExport.url;
			await super.export();
			APIList.CRM_Contact.getExport.url = apiPath;
			return;
		}
		super.export();
	}

	async import(event) {
		if (this.pageConfig.pageName == 'vendor') {
			APIList.CRM_Contact.postImport.url = () => {
				return ApiSetting.apiDomain('CRM/Contact/VendorImport/');
			};
			let apiPath = APIList.CRM_Contact.postImport.url;
			await super.import(event);
			APIList.CRM_Contact.postImport.url = apiPath;
			return;
		}
		super.import(event);
	}
}
