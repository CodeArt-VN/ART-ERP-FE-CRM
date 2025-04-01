import { Component, ChangeDetectorRef } from '@angular/core';
import { NavController, LoadingController, AlertController, PopoverController, ModalController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { ActivatedRoute } from '@angular/router';
import { EnvService } from 'src/app/services/core/env.service';
import { CRM_ContactProvider, HRM_StaffProvider } from 'src/app/services/static/services.service';
import { FormBuilder, Validators, FormControl, FormArray, FormGroup } from '@angular/forms';
import { CommonService } from 'src/app/services/core/common.service';
import { concat, of, Subject } from 'rxjs';
import { catchError, distinctUntilChanged, switchMap, tap } from 'rxjs/operators';
import { thirdPartyLibs } from 'src/app/services/static/thirdPartyLibs';
import { AddressService, DynamicScriptLoaderService } from 'src/app/services/custom.service';
import { DataCorrectionRequestModalPage } from 'src/app/modals/data-correction-request-modal/data-correction-request-modal.page';
declare var ggMap;

@Component({
	selector: 'app-outlet-detail',
	templateUrl: './outlet-detail.page.html',
	styleUrls: ['./outlet-detail.page.scss'],
	standalone: false,
})
export class OutletDetailPage extends PageBase {
	statusList = [];
	isShowAddAddress = true;

	constructor(
		public pageProvider: CRM_ContactProvider,
		public staffProvider: HRM_StaffProvider,
		public popoverCtrl: PopoverController,
		public env: EnvService,
		public navCtrl: NavController,
		public route: ActivatedRoute,
		public alertCtrl: AlertController,
		public modalController: ModalController,
		public formBuilder: FormBuilder,
		public cdr: ChangeDetectorRef,
		public loadingController: LoadingController,
		public dynamicScriptLoaderService: DynamicScriptLoaderService,
		public addressService: AddressService,
		public commonService: CommonService
	) {
		super();
		this.pageConfig.isDetailPage = true;

		this.formGroup = formBuilder.group({
			IDBranch: new FormControl({ value: null, disabled: false }),
			Id: new FormControl({ value: '', disabled: true }),
			Code: [''],
			Name: ['', Validators.required],
			IDOwner: [''],
			Remark: [''],
			Sort: [''],
			IsDisabled: new FormControl({ value: '', disabled: true }),
			IsDeleted: new FormControl({ value: '', disabled: true }),
			CreatedBy: new FormControl({ value: '', disabled: true }),
			CreatedDate: new FormControl({ value: '', disabled: true }),
			ModifiedBy: new FormControl({ value: '', disabled: true }),
			ModifiedDate: new FormControl({ value: '', disabled: true }),

			IsPersonal: [true],
			IsOutlets: [true],
			WorkPhone: [null, [Validators.required, Validators.pattern('[- +()0-9]{10,}')]],

			OtherPhone: [''],
			CompanyName: [''],
			TaxCode: [''],
			Fax: [''],
			Website: [''],
			Email: [''],
			BillingAddress: [''],

			Status: new FormControl({ value: '', disabled: true }),
			// Address: this.formBuilder.group({
			//   Id: [''],
			//   Phone1: ['', Validators.required],
			//   Contact: ['', Validators.required],
			//   Province: ['', Validators.required],
			//   District: ['', Validators.required],
			//   Ward: ['', Validators.required],
			//   AddressLine1: ['', Validators.required],
			//   AddressLine2: [''],
			// }),
			Addresses: this.formBuilder.array([]),
			TaxInfos: this.formBuilder.array([]),
			DeletedAddressFields: [],
			DeletedTaxInfoFields: [],

			NumberOfEmployees: [''],
			AnnualRevenue: [''],
			BankName: [''],
			BankAccount: [''],
		});
	}

	preLoadData(event) {
		this.loadGGMap();
		Promise.all([this.env.getStatus('BusinessPartner'), this.addressService.getAddressSubdivision()]).then((values: any) => {
			this.statusList = values[0];
			super.preLoadData(event);
		});
	}

	loadedData(event?: any, ignoredFromGroup?: boolean): void {
		if (this.item && (this.item.IsBranch || this.item.IsStaff)) {
			this.formGroup.controls.Code.disable();
			this.formGroup.controls.Name.disable();
			this.formGroup.controls.IsDisabled.disable();
			this.formGroup.controls.IsPersonal.disable();
			this.pageConfig.canDelete = false;
		}

		if (this.item.Id) {
			let blockedStatus = ['Submitted', 'Approved'];

			if (blockedStatus.indexOf(this.item.Status) > -1 && !this.pageConfig.canEditApproved) {
				this.pageConfig.canEdit = false;
				this.pageConfig.canDelete = false;
			}
		}

		if (this.item._Owner) {
			this.salesmanListSelected.push(this.item._Owner);
			this.salesmanListSelected = [...this.salesmanListSelected];
		}

		if (this.item.Addresses?.length > 0) {
			let groups = this.formGroup.get('Addresses') as FormArray;
			groups.clear();
			this.patchAddressesValue();
		}
		if (this.item.TaxInfos?.length > 0) {
			let groups = this.formGroup.get('TaxInfos') as FormArray;
			groups.clear();
			this.patchTaxInfosValue();
		}
		this.salesmanSearch();

		super.loadedData(event, ignoredFromGroup);
	}

	patchAddressesValue() {
		if (this.item.Addresses) {
			if (this.item.Addresses?.length) {
				for (let i of this.item.Addresses) {
					this.addAddress(i);
				}
			}

			if (!this.pageConfig.canEdit) {
				this.formGroup.controls.Addresses.disable();
			}
		}
	}

	addAddress(address, markAsDirty = false) {
		// todo
		let groups = <FormArray>this.formGroup.controls.Addresses;
		let group = this.formBuilder.group({
			IDPartner: [this.formGroup.get('Id').value],
			Id: new FormControl(address?.Id),
			AddressLine1: [address?.AddressLine1, Validators.required],
			AddressLine2: [address?.AddressLine2],
			Country: [address?.Country],
			Province: [address?.Province],
			District: [address?.District],
			Ward: [address?.Ward],
			ZipCode: [address?.ZipCode],
			Lat: [address?.Lat],
			Long: [address?.Long],
			Contact: [address?.Contact],
			Phone1: [address?.Phone1],
			Phone2: [address?.Phone2],
			Remark: [address?.Remark],
			Sort: [address?.Sort],
		});
		groups.push(group);
		group.get('IDPartner').markAsDirty();
		group.get('Id').markAsDirty();
		if (groups.controls.find((d) => !d.get('Id').value)) {
			this.isShowAddAddress = false;
		} else this.isShowAddAddress = true;
	}

	changeAddress(e) {
		let groups = <FormArray>this.formGroup.controls.Addresses;
		let fg = groups.controls.find((d) => d.get('Id').value == e.Id) as FormGroup;
		if(!fg) fg = groups.controls.find((d) => !d.get('Id').value) as FormGroup;
		if (fg) {
			Object.keys(fg.controls).forEach((key) => {
				if (fg.get(key) && fg.get(key).value !== e[key]) {
					fg.get(key).setValue(e[key]); // Update the value
					fg.get(key).markAsDirty(); // Mark the control as dirty if the value changed
				}
			});
			fg.get('Id').markAsDirty();
			this.saveChange();
		}
	}

	removeAddress(e) {
		let groups = <FormArray>this.formGroup.controls.Addresses;
		let fg = groups.controls.find((d) => d.get('Id').value == e.Id) as FormGroup;
		let index = groups.controls.indexOf(fg);
		if (e.Id > 0) {
			this.formGroup.get('DeletedAddressFields').setValue([e.Id]);
			this.formGroup.get('DeletedAddressFields').markAsDirty();
			this.saveChange();
		}
		groups.removeAt(index);
	}


	patchTaxInfosValue() {
		if (this.item.TaxInfos) {
			if (this.item.TaxInfos?.length) {
				for (let i of this.item.TaxInfos) {
					this.addTaxInfo(i);
				}
			}

			if (!this.pageConfig.canEdit) {
				this.formGroup.controls.TaxInfos.disable();
			}
		}
	}
	addTaxInfo(taxAddress, markAsDirty = false) {
		// todo
		let groups = <FormArray>this.formGroup.controls.TaxInfos;
		let group = this.formBuilder.group({
			IDPartner: [this.formGroup.get('Id').value],
			Id: new FormControl(taxAddress?.Id),
			CompanyName: [taxAddress?.TaxCode, Validators.required],
			TaxCode: [taxAddress?.TaxCode, Validators.required],
			WorkPhone: [taxAddress?.WorkPhone],
			Email: [taxAddress?.Email],
			BillingAddress: [taxAddress?.BillingAddress, Validators.required],
			IsDefault: [taxAddress?.IsDefault || false],
			Remark: [taxAddress?.Remark],
		});
		groups.push(group);
		group.get('IDPartner').markAsDirty();
		group.get('Id').markAsDirty();
	}

	changeTaxInfo(e) {
		let groups = <FormArray>this.formGroup.controls.TaxInfos;
		let fg = groups.controls.find((d) => d.get('Id').value == e.Id) as FormGroup;
		if(!fg) fg = groups.controls.find((d) => !d.get('Id').value) as FormGroup;
		if (fg) {
			Object.keys(fg.controls).forEach((key) => {
				if (fg.get(key) && fg.get(key).value !== e[key]) {
					if(key == 'IsDefault' && e[key]) {
						groups.controls.filter(d=> d.value.Id != fg.value.Id).forEach((g) => {
							g.get('IsDefault').setValue(false); // Update the value
							g.get('IsDefault').markAsDirty(); // Update the value
						});
					}
					fg.get(key).setValue(e[key]); // Update the value
					fg.get(key).markAsDirty(); // Mark the control as dirty if the value changed
				}
			});
			fg.get('Id').markAsDirty();
			this.saveChange();
		}
	}

	removeTaxInfo(e) {
		let groups = <FormArray>this.formGroup.controls.TaxInfos;
		let fg = groups.controls.find((d) => d.get('Id').value == e.Id) as FormGroup;
		let index = groups.controls.indexOf(fg);
		if (e.Id > 0) {
			this.formGroup.get('DeletedTaxInfoFields').setValue([e.Id]);
			this.formGroup.get('DeletedTaxInfoFields').markAsDirty();
			this.saveChange();
		}
		groups.removeAt(index);
	}

	checkPhoneNumber() {
		if (this.formGroup.controls.WorkPhone.valid) {
			this.pageProvider
				.search({
					WorkPhone_eq: this.formGroup.controls.WorkPhone.value,
				})
				.toPromise()
				.then((result: any) => {
					if (result.length == 0 && result.findIndex((e) => e.Id == this.id)) {
						this.formGroup.controls.WorkPhone.setErrors(null);
						this.formGroup.controls.Address['controls'].Phone1.setValue(this.formGroup.controls.WorkPhone.value);
						this.formGroup.controls.Address['controls'].Phone1.markAsDirty();
						this.saveChange();
					} else {
						this.formGroup.controls.WorkPhone.setErrors({
							incorrect: true,
						});
					}
				});
		}
	}

	salesmanList$;
	salesmanListLoading = false;
	salesmanListInput$ = new Subject<string>();
	salesmanListSelected = [];
	salesmanSelected = null;
	salesmanSearch() {
		this.salesmanListLoading = false;
		this.salesmanList$ = concat(
			of(this.salesmanListSelected),
			this.salesmanListInput$.pipe(
				distinctUntilChanged(),
				tap(() => (this.salesmanListLoading = true)),
				switchMap((term) =>
					this.staffProvider
						.search({
							Take: 20,
							Skip: 0,
							Term: term ? term : this.item.IDSeller,
						})
						.pipe(
							catchError(() => of([])), // empty list on error
							tap(() => (this.salesmanListLoading = false))
						)
				)
			)
		);
	}

	loadGGMap() {
		if (!this.env.isMapLoaded) {
			this.dynamicScriptLoaderService
				.loadResources(thirdPartyLibs.ggMap.source)
				.then(() => {
					this.env.isMapLoaded = true;
				})
				.catch((error) => console.error('Error loading script', error));
		}
	}

	async openRequestDataConnectionModal() {
		// let formGroup = clone
		const modal = await this.modalController.create({
			component: DataCorrectionRequestModalPage,
			componentProps: {
				item: {
					IDBranch: this.formGroup.get('IDBranch').value,
					Id: this.formGroup.get('Id').value,
					CompanyName: this.formGroup.get('CompanyName').value,
					Name: this.formGroup.get('Name').value,
					IsPersonal: this.formGroup.get('IsPersonal').value,
					IsOutlets: this.formGroup.get('IsOutlets').value,
					WorkPhone: this.formGroup.get('WorkPhone').value,
		
					OtherPhone: this.formGroup.get('OtherPhone').value,
					Website: this.formGroup.get('Website').value,
					Email: this.formGroup.get('Email').value,
					Addresses: this.formGroup
						.get('Addresses')
						.getRawValue()
						.map((s) => {
							return {
								Id: s.Id,
								AddressLine1: s.AddressLine1,
								AddressLine2: s.AddressLine2,
								Country: s.Country,
								Province: s.Province,
								District: s.District,
								Ward: s.Ward,
								ZipCode: s.ZipCode,
								Lat: s.Lat,
								Long: s.Long,
								Contact: s.Contact,
								Phone1: s.Phone1,
								Phone2: s.Phone2,
								Remark: s.Remark,
							};
						}),
					TaxInfos: this.formGroup
						.get('TaxInfos')
						.getRawValue()
						.map((s) => {
							return {
								Id: s.Id,
								CompanyName:s.CompanyName,
								TaxCode : s.TaxCode,
								WorkPhone:s.WorkPhone,
								Email:s.Email,
								BillingAddress:s.BillingAddress,
								IsDefault:s.IsDefault,
								Remark:s.Remark,
							};
						}),
				},
				model: {
					title: 'Outlet',
					type: 'Outlet',
					fields:[
						{
						type:'Group',
						groups: [
							{
								title: 'General information',
								cols: { default: 12, sm: 3 },
								fields: [
									{
										id: 'Id',
										type: 'number',
										label: 'Id',
										disabled: true,
										cols: { default: 'auto', xs: 12, sm: 12, md: 12, lg: 4 },
									},
									{
										id: 'IDBranch',
										type: 'number',
										label: 'Branch',
										disabled: true,
										cols: { xs: 12, sm: 12, md: 12, lg: 12, xl: 4 },
									},
									{
										id: 'Name',
										type: 'text',
										label: 'Name',
										cols: { xs: 12, sm: 12, md: 12, lg: 12, xl: 4 },
									},
									{
										id: 'CompanyName',
										type: 'text',
										label: 'CompanyName',
										cols: { xs: 12, sm: 12, md: 12, lg: 12, xl: 4 },
									},
									{
										id: 'IsPersonal',
										type: 'checkbox',
										label: 'Is personal',
										cols: { xs: 12, sm: 12, md: 12, lg: 12, xl: 4 },
									},
									{
										id: 'WorkPhone',
										type: 'text',
										label: 'Work phone',
										cols: { xs: 12, sm: 12, md: 12, lg: 12, xl: 4 },
									},
									{
										id: 'OtherPhone',
										type: 'text',
										label: 'Other phone',
										cols: { xs: 12, sm: 12, md: 12, lg: 12, xl: 4 },
									},
									{
										id: 'Website',
										type: 'text',
										label: 'Website',
										cols: { xs: 12, sm: 12, md: 12, lg: 12, xl: 4 },
									},
									{
										id: 'Email',
										type: 'email',
										label: 'Email',
										cols: { xs: 12, sm: 12, md: 12, lg: 12, xl: 4 },
									},
									//  { id: 'DeletedAddressFields',type:'nonRender'},
								],
							},
							{
								title: 'Addresses',
								cols: { default: 12, xs: 3 },
								fields: [
									{
										id: 'Addresses',
										type: 'addresses-component',
										disabled: true,
										// fields:[{
										//     id: 'Id',
										//     type: 'number',
										//     label: 'Id',
										//     disabled: true,
										//     cols: { xs: 12 ,  sm: 12 , md: 12 ,  lg: 12 ,  xl: 4 },
										// }],
										// groups: [
										// 	{
										// 		title: 'ADDRESS LINE',
										// 		cols: { default: 12, sm: 3 },
										// 		fields: [
										// 			{
										// 				id: 'Id',
										// 				type: 'number',
										// 				label: 'Id',
										// 				disabled: true,
										// 				cols: { xs: 12, sm: 12, md: 12, lg: 12, xl: 4 },
										// 			},
										// 			{
										// 				id: 'AddressLine1',
										// 				type: 'text',
										// 				label: 'AddressLine1',
										// 				cols: { xs: 12, sm: 12, md: 12, lg: 12, xl: 4 },
										// 			},
										// 		],
										// 	},
										// ],
									},
								],
							},
							{
								title: 'Billing address',
								cols: { default: 12, xs: 3 },
								fields: [
									{
										id: 'TaxInfos',
										type: 'tax-infos-component',
										disabled: true,
									}]
								}
						],
					}]
					
				},
				// cssClass: 'modal90',
			},
		});

		await modal.present();
		const { data } = await modal.onWillDismiss();
	
	}

	segmentView = 's1';
	segmentChanged(ev: any) {
		this.segmentView = ev.detail.value;
	}

	async saveChange() {
		super.saveChange2();
	}

	savedChange(savedItem = null, form = this.formGroup) {
		super.savedChange(savedItem, form);
		let groupsAddresses = <FormArray>this.formGroup.controls.Addresses;
		let idsBeforeSaving = new Set(groupsAddresses.controls.map((g) => g.get('Id').value));
		this.item = savedItem;
		if (this.item.Addresses?.length > 0) {
			let newIds = new Set(this.item.Addresses.map((i) => i.Id));
			const diff = [...newIds].filter((item) => !idsBeforeSaving.has(item));
			if (diff?.length > 0) {
				groupsAddresses.controls
					.find((d) => d.get('Id').value == null)
					?.get('Id')
					.setValue(diff[0]);
			}
		}
		if (groupsAddresses.controls.find((d) => !d.get('Id').value)) {
			this.isShowAddAddress = false;
		} else this.isShowAddAddress = true;

		let groupsTaxInfos = <FormArray>this.formGroup.controls.TaxInfos;
		let idsBeforeSavingTaxInfos = new Set(groupsTaxInfos.controls.map((g) => g.get('Id').value));
		if (this.item.TaxInfos?.length > 0) {
			let newIds = new Set(this.item.TaxInfos.map((i) => i.Id));
			const diff = [...newIds].filter((item) => !idsBeforeSavingTaxInfos.has(item));
			if (diff?.length > 0) {
				groupsTaxInfos.controls
					.find((d) => d.get('Id').value == null)
					?.get('Id')
					.setValue(diff[0]);
			}
		}
	}
}
