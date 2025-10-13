import { Component, Renderer2 } from '@angular/core';
import { NavController, ModalController, AlertController, LoadingController, PopoverController } from '@ionic/angular';
import { EnvService } from 'src/app/services/core/env.service';
import { PageBase } from 'src/app/page-base';
import { BRA_BranchProvider, CRM_ContactProvider, SYS_ConfigProvider } from 'src/app/services/static/services.service';
import { Location } from '@angular/common';
import { lib } from 'src/app/services/static/global-functions';
import { ApiSetting } from 'src/app/services/static/api-setting';
import { FormBuilder, FormControl, Validators } from '@angular/forms';
import { AddressService } from 'src/app/services/custom/custom.service';
import { APIList } from 'src/app/services/static/global-variable';

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
	isShowMergePopup = false;
	mergeFunction = {
		isShowMergePopup: false,
		showSpinner: false,
		findBy: 'WorkPhone',
		items: [],
	};
	formMerge: any;
	mergeModel = {
		Code: '',
		Name: '',
		WorkPhone: '',
		TaxCode: '',
		Id: 0,
		Address: {
			AddressLine1: '',
			AddressLine2: '',
			Contact: '',
			Country: '',
			District: '',
			Id: '',
			Phone1: '',
			Phone2: '',
			Province: '',
			Ward: '',
		},
		BillingAddress: '',
		Email: '',
		CompanyName: '',
		IsPersonal: false,
	};

	constructor(
		private renderer: Renderer2,
		public pageProvider: CRM_ContactProvider,
		public branchProvider: BRA_BranchProvider,
		public modalController: ModalController,
		public sysConfigProvider: SYS_ConfigProvider,
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

		let sysConfigQuery = ['ContactUsedApprovalModule'];

		Promise.all([
			this.branchProvider.read(),
			this.env.getStatus('BusinessPartner'),
			this.sysConfigProvider.read({ Code_in: sysConfigQuery, IDBranch: this.env.selectedBranch }),
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
				if (values[2]['data']) {
					values[2]['data'].forEach((e) => {
						if ((e.Value == null || e.Value == 'null') && e._InheritedConfig) {
							e.Value = e._InheritedConfig.Value;
						}
						this.pageConfig[e.Code] = JSON.parse(e.Value);
						if (this.pageConfig.ContactUsedApprovalModule) {
							this.pageConfig.canApprove = false;
							this.pageConfig.canApprove = false;
						}
					});
				}
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
		this.pageConfig.canSubmit = this.pageConfig.canSubmitBusinessPartnerForApproval;
		super.loadedData(event);
	}



	changeDuplicateKeywork(e) {
		if (e.target.value == 'WorkPhone') {
			this.findByValue = 'WorkPhone';
			this.query.TaxCode_eq = undefined;
		} else {
			this.findByValue = 'TaxCode';
			this.query.WorkPhone_eq = undefined;
		}
		console.log(e);
	}
	findByDuplicate() {
		let q = { FindBy: this.findByValue };
		this.query.IgnoredBranch = true;
		this.mergeFunction.items = [];
		this.mergeFunction.showSpinner = true;

		let apiPath = {
			method: 'GET',
			url: function () {
				return ApiSetting.apiDomain('CRM/Contact/FindDuplicates');
			},
		};
		this.pageProvider.commonService
			.connect(apiPath.method, apiPath.url(), q)
			.toPromise()
			.then((data: any) => {
				this.mergeFunction.items = data;
			})
			.finally(() => {
				this.mergeFunction.showSpinner = false;
			});
	}
	showMergePopup(e) {
		this.isShowMergePopup = true;
		this.changeSelected(this.selectedItems[0]);
	}

	changeSelected(selectedModel) {
		this.mergeModel.Code = selectedModel.Code;
		this.mergeModel.Name = selectedModel.Name;
		this.mergeModel.WorkPhone = selectedModel.WorkPhone;
		this.mergeModel.TaxCode = selectedModel.TaxCode;
		this.mergeModel.BillingAddress = selectedModel.BillingAddress;
		this.mergeModel.CompanyName = selectedModel.CompanyName;
		this.mergeModel.Email = selectedModel.Email;
		this.mergeModel.Id = selectedModel.Id;
		this.mergeModel.IsPersonal = selectedModel.IsPersonal;

		this.mergeModel.Address.Id = selectedModel.Addresses[0]?.Id;
		this.mergeModel.Address.AddressLine1 = selectedModel.Addresses[0]?.AddressLine1;
		this.mergeModel.Address.AddressLine2 = selectedModel.Addresses[0]?.AddressLine2;
		this.mergeModel.Address.Contact = selectedModel.Addresses[0]?.Contact;
		this.mergeModel.Address.Country = selectedModel.Addresses[0]?.Country;
		this.mergeModel.Address.Phone1 = selectedModel.Addresses[0]?.Phone1;
		this.mergeModel.Address.Phone2 = selectedModel.Addresses[0]?.Phone2;
		this.mergeModel.Address.Province = selectedModel.Addresses[0]?.Province;
		this.mergeModel.Address.Ward = selectedModel.Addresses[0]?.Ward;
		console.log(this.mergeModel);
	}
	mergeContact() {
		// so sánh với selected hiện tại
		let obj: any = {};
		obj.Id = this.mergeModel.Id;
		obj.MergedItems = this.selectedItems.map(({ Id }) => Id).filter((x) => x != obj.Id);
		let selectedMergeModel = this.selectedItems.find((x) => x.Id == obj.Id);
		let address: any = {};
		//obj.QueryStrings={key:''}
		if (this.mergeModel.Code != selectedMergeModel.Code) {
			obj.Code = this.mergeModel.Code;
		}
		if (this.mergeModel.Name != selectedMergeModel.Name) {
			obj.Name = this.mergeModel.Name;
		}
		if (this.mergeModel.WorkPhone != selectedMergeModel.WorkPhone) {
			obj.WorkPhone = this.mergeModel.WorkPhone;
		}
		if (this.mergeModel.TaxCode != selectedMergeModel.TaxCode) {
			obj.TaxCode = this.mergeModel.TaxCode;
		}
		if (this.mergeModel.BillingAddress != selectedMergeModel.BillingAddress) {
			obj.BillingAddress = this.mergeModel.BillingAddress;
		}
		if (this.mergeModel.Email != selectedMergeModel.Email) {
			obj.Email = this.mergeModel.Email;
		}
		if (this.mergeModel.IsPersonal != selectedMergeModel.IsPersonal) {
			obj.IsPersonal = this.mergeModel.IsPersonal;
		}
		if (this.mergeModel.IsPersonal != selectedMergeModel.IsPersonal) {
			obj.IsPersonal = this.mergeModel.IsPersonal;
		}
		if (this.mergeModel.Address.AddressLine1 != selectedMergeModel.Addresses[0]?.AddressLine1) {
			address.AddressLine1 = this.mergeModel.Address.AddressLine1;
		}
		if (this.mergeModel.Address.AddressLine2 != selectedMergeModel.Addresses[0]?.AddressLine2) {
			address.AddressLine2 = this.mergeModel.Address.AddressLine2;
		}
		if (this.mergeModel.Address.Contact != selectedMergeModel.Addresses[0]?.Contact) {
			address.Contact = this.mergeModel.Address.Contact;
		}
		if (this.mergeModel.Address.Country != selectedMergeModel.Addresses[0]?.Country) {
			address.Country = this.mergeModel.Address.Country;
		}
		if (this.mergeModel.Address.Phone1 != selectedMergeModel.Addresses[0]?.Phone1) {
			address.Phone1 = this.mergeModel.Address.Phone1;
		}
		if (this.mergeModel.Address.Phone2 != selectedMergeModel.Addresses[0]?.Phone2) {
			address.Phone2 = this.mergeModel.Address.Phone2;
		}
		if (this.mergeModel.Address.Province != selectedMergeModel.Addresses[0]?.Province) {
			address.Province = this.mergeModel.Address.Province;
		}
		if (this.mergeModel.Address.Ward != selectedMergeModel.Addresses[0]?.Ward) {
			address.Ward = this.mergeModel.Address.Ward;
		}
		if (address != null && address != undefined) {
			obj.Address = address;
			obj.Address.IDPartner = obj.Id;
			if (!selectedMergeModel.Addresses.length || !selectedMergeModel.Addresses[0].Id) {
				obj.Address.Id = 0;
			} else {
				obj.Address.Id = selectedMergeModel.Addresses[0].Id;
			}
		}
		let apiPath = {
			method: 'POST',
			url: function () {
				return ApiSetting.apiDomain('CRM/Contact/Merge');
			},
		};
		this.pageProvider.commonService
			.connect(apiPath.method, apiPath.url(), obj)
			.toPromise()
			.then((data: any) => {
				this.isShowMergePopup = false;
				this.refresh();
			});
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
