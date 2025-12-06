import { Component, ChangeDetectorRef, ViewChild } from '@angular/core';
import { NavController, ModalController, LoadingController, AlertController, PopoverController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { ActivatedRoute } from '@angular/router';
import { EnvService } from 'src/app/services/core/env.service';
import { CRM_ContactUDFProvider, HRM_StaffProvider, SYS_ConfigOptionProvider, WMS_PriceListProvider } from 'src/app/services/static/services.service';
import { FormBuilder, FormGroup, Validators, FormControl, FormArray } from '@angular/forms';
import { concat, of, Subject } from 'rxjs';
import { catchError, distinctUntilChanged, switchMap, tap } from 'rxjs/operators';
import { CommonService } from 'src/app/services/core/common.service';
import { thirdPartyLibs } from 'src/app/services/static/thirdPartyLibs';
import { AddressService, DynamicScriptLoaderService } from 'src/app/services/custom/custom.service';
import { DataCorrectionRequestModalPage } from 'src/app/modals/data-correction-request-modal/data-correction-request-modal.page';
import { CRM_ContactService } from 'src/app/services/contact.service';
declare var ggMap;
@Component({
	selector: 'app-business-partner-detail',
	templateUrl: './business-partner-detail.page.html',
	styleUrls: ['./business-partner-detail.page.scss'],
	standalone: false,
})
export class BusinessPartnerDetailPage extends PageBase {
	optionGroup = [
		{
			Code: 'bp-management-information',
			Name: 'Management information',
			Remark: 'Management information',
			Icon: 'stats-chart-outline',
		},
		{
			Code: 'lotable',
			Name: 'Lotable',
			Remark: 'Lotable',
			Icon: 'cube-outline',
		},
		{
			Code: 'udf',
			Name: 'User define field',
			Remark: 'User define field',
			Icon: 'build-outline',
		},
		{
			Code: 'bp-person-info',
			Name: 'Person info',
			Remark: 'Person info',
			Icon: 'person-outline',
			Condition: (item) => item.IsPersonal,
		},
		{
			Code: 'bp-recent-order',
			Name: 'Recent order',
			Remark: 'Recent order',
			Icon: 'receipt-outline',
		},
		{
			Code: 'bp-outlet-info',
			Name: 'Outlet info',
			Remark: 'Outlet info',
			Icon: 'business-outline',
			Condition: (item) => item.IsOutlets,
		},
		{
			Code: 'bp-address',
			Name: 'Bussiness partner address',
			Remark: 'Bussiness partner address',
			Icon: 'home-outline',
		},
		{
			Code: 'bp-reference-code',
			Name: 'Reference code',
			Remark: 'Reference code',
			Icon: 'pricetag-outline',
		},
		{
			Code: 'bp-master-coverage-plan',
			Name: 'Master coverage plan',
			Remark: 'Master coverage plan',
			Icon: 'layers-outline',
		},
		{
			Code: 'bp-contact-point',
			Name: 'Contact point',
			Remark: 'Contact point',
			Icon: 'call-outline',
			Condition: (item) => !item.IsPersonal,
		},
		{
			Code: 'bp-tax-address',
			Name: 'Invoice information',
			Remark: 'Ivoice information',
			Icon: 'document-text-outline',
		},
		{
			Code: 'bp-map',
			Name: 'Map',
			Remark: 'Map',
			Icon: 'map-outline',
		},
		{
			Code: 'bp-product',
			Name: 'Product',
			Remark: 'Product',
			Icon: 'cube-outline',
			Condition: (item) => !item.IsPersonal,
		},
		{
			Code: 'bp-storer-info',
			Name: 'Storer info',
			Remark: 'Storer info',
			Icon: 'storefront-outline',
			Condition: (item) => item.IsStorer,
		},
	];
	segmentView: any = {
		Page: 'bp-management-information',
	};
	avatarURL = 'assets/imgs/avartar-empty.jpg';
	initPriceList = [];
	statusList = [];
	storerList = [];
	isShowAddAddress = true;
	lotableList = [];
	udfList = [];
	contactUDFGroup: any = this.formBuilder.group({});

	constructor(
		public pageProvider: CRM_ContactService,
		public contactUDFProvider: CRM_ContactUDFProvider,
		public priceListProvider: WMS_PriceListProvider,
		public sysConfigOptionProvider: SYS_ConfigOptionProvider,
		public staffProvider: HRM_StaffProvider,
		public env: EnvService,
		public navCtrl: NavController,
		public route: ActivatedRoute,
		public popoverCtrl: PopoverController,
		public modalController: ModalController,
		public alertCtrl: AlertController,
		public formBuilder: FormBuilder,
		public cdr: ChangeDetectorRef,
		public loadingController: LoadingController,
		public dynamicScriptLoaderService: DynamicScriptLoaderService,
		public addressService: AddressService,
		public commonService: CommonService
	) {
		super();
		this.pageConfig.isDetailPage = true;
		this.pageConfig.isShowFeature = true;

		this.id = this.route.snapshot.paramMap.get('id');
		this.formGroup = formBuilder.group({
			IDBranch: new FormControl({ value: null, disabled: false }),
			Id: new FormControl({ value: '', disabled: true }),
			Code: new FormControl(),
			Name: new FormControl(),
			Remark: new FormControl(),
			Sort: [''],
			IsDisabled: new FormControl({ value: '', disabled: true }),
			CreatedBy: new FormControl({ value: '', disabled: true }),
			CreatedDate: new FormControl({ value: '', disabled: true }),
			ModifiedBy: new FormControl({ value: '', disabled: true }),
			ModifiedDate: new FormControl({ value: '', disabled: true }),
			IDParent: [''],
			Title: [''],
			IDOwner: [''],
			CompanyName: [''],
			TaxCode: [''],
			Fax: [''],
			Website: [''],
			BillingAddress: [''],
			IDIndividual: [''],
			IDSource: [''],
			IDSector: [''],
			IDIndustry: [''],
			IDRating: [''],
			NumberOfEmployees: [''],
			AnnualRevenue: [''],
			BankAccount: [''],
			BankName: [''],
			IsPersonal: [''],
			WorkPhone: [''],
			OtherPhone: [''],
			DoNotCall: [''],
			Email: [''],
			HasOptedOutOfEmail: [''],
			IsBranch: new FormControl({ value: '', disabled: true }),
			IsStaff: new FormControl({ value: '', disabled: true }),
			IsDistributor: [''],
			IsStorer: [''],
			IsVendor: [''],
			IsCarrier: [''],
			IsOutlets: [''],
			IsCustomer: [''],
			IsWholeSale: [''],
			IDPriceListForVendor: [''],
			IDPaymentTermForVendor: [''],
			IDBusinessPartnerGroup: [''],
			IDPriceList: [''],
			IDPaymentTerm: [''],
			Status: new FormControl({ value: '', disabled: true }),
			IsProvideReferenceCode: [''],
			Addresses: new FormArray([]),
			DeletedAddressFields: [],
			LotableText00: [''],
			LotableText01: [''],
			LotableText02: [''],
			LotableText03: [''],
			LotableText04: [''],
			LotableNum00: [''],
			LotableNum01: [''],
			LotableNum02: [''],
			LotableNum03: [''],
			LotableNum04: [''],
			LotableNum05: [''],
			LotableNum06: [''],
			LotableNum07: [''],
			LotableNum08: [''],
			LotableNum09: [''],
			LotableDate10: [''],
			LotableDate11: [''],
			LotableDate12: [''],
			LotableDate13: [''],
			LotableDate14: [''],
		});
	}
	_PriceListDataSource = this.buildSelectDataSource((term) => {
		return this.priceListProvider.search({
			SortBy: ['Id_desc'],
			Take: 20,
			Skip: 0,
			Term: term,
		});
	});
	_PriceListVendorDataSource = this.buildSelectDataSource((term) => {
		return this.priceListProvider.search({
			SortBy: ['Id_desc'],
			Take: 20,
			Skip: 0,
			Term: term,
		});
	});
	preLoadData(event) {
		this.loadGGMap();
		Promise.all([
			this.priceListProvider.read({ Take: 20 }),
			this.env.getStatus('BusinessPartner'),
			this.addressService.getAddressSubdivision(),
		]).then((values: any) => {
			this.initPriceList = values[0]['data'];
			this.statusList = values[1];
			super.preLoadData(event);
		});
	}

	getConfigOptionCode() {
		return new Promise((resolve, reject) => {
			let sysConfigOptionCode = ['CRMContactLotable', 'CRMContactUDF'];
			this.sysConfigOptionProvider
				.read({ Code_in: sysConfigOptionCode, AllChildren: true })
				.then((configOption: any) => {
					resolve(configOption.data.filter((d) => !configOption.data.some((s) => s.IDParent == d.Id)).map((d) => d.Code));
				})
				.catch((err) => reject(err));
		});
	}

	loadedData(event?: any, ignoredFromGroup?: boolean): void {
		this.contactUDFGroup.addControl('Id', new FormControl(this.item?._contactUDF ? this.item._contactUDF['Id'] : null));
		this.contactUDFGroup.addControl('Name', new FormControl(this.item?._contactUDF ? this.item._contactUDF['Name'] : null));
		this.contactUDFGroup.addControl('Code', new FormControl(this.item?._contactUDF ? this.item._contactUDF['Code'] : null));
		
		super.loadedData(event, ignoredFromGroup);
		if (this.initPriceList && this.initPriceList.length > 0) {
			this._PriceListDataSource.selected = [...this.initPriceList];
			this._PriceListVendorDataSource.selected = [...this.initPriceList];
		}
		let ids = [];
		if (this.item.IDPriceList) ids.push(this.item.IDPriceList);
		if (this.item.IDPriceListForVendor) ids.push(this.item.IDPriceListForVendor);
		if (ids.length > 0) {
			this.priceListProvider.read({ Id: [this.item.IDPriceList, this.item.IDPriceListForVendor] }).then((res: any) => {
				if (res?.data && res.data.length > 0) {
					this._PriceListDataSource.selected = [...res.data, ...this._PriceListDataSource.selected];
					this._PriceListVendorDataSource.selected = [...res.data, ...this._PriceListVendorDataSource.selected];
				}
				this._PriceListDataSource.initSearch();
				this._PriceListVendorDataSource.initSearch();
			});
		} else {
			this._PriceListDataSource.initSearch();
			this._PriceListVendorDataSource.initSearch();
		}

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
				//this.formGroup.get('IDAddress').disable();
			}
		} else {
			this.formGroup.controls['IsPersonal'].setValue(true);
			this.formGroup.controls['IsPersonal'].markAsDirty();
		}
		if (this.pageConfig.pageName != 'business-partner') {
			this.formGroup.controls['IsVendor'].disable();
			this.formGroup.controls['IsCarrier'].disable();
			this.formGroup.controls['IsDistributor'].disable();
			this.formGroup.controls['IsStorer'].disable();
			this.formGroup.controls['IsOutlets'].disable();
			this.formGroup.controls['IsCustomer'].disable();
			// this.formGroup.controls['IsProvideReferenceCode'].disable();
		}
		if (this.pageConfig.pageName == 'vendor') {
			this.formGroup.controls['IsVendor'].setValue(true);
			this.formGroup.controls['IsVendor'].markAsDirty();
		} else if (this.pageConfig.pageName == 'carrier') {
			this.formGroup.controls['IsCarrier'].setValue(true);
			this.formGroup.controls['IsCarrier'].markAsDirty();
		} else if (this.pageConfig.pageName == 'distributor') {
			this.formGroup.controls['IsDistributor'].setValue(true);
			this.formGroup.controls['IsDistributor'].markAsDirty();
		} else if (this.pageConfig.pageName == 'storer') {
			this.formGroup.controls['IsStorer'].setValue(true);
			this.formGroup.controls['IsStorer'].markAsDirty();
		} else if (this.pageConfig.pageName == 'outlet') {
			this.formGroup.controls['IsOutlets'].setValue(true);
			this.formGroup.controls['IsOutlets'].markAsDirty();
		} else if (this.pageConfig.pageName == 'customer') {
			this.formGroup.controls['IsCustomer'].setValue(true);
			this.formGroup.controls['IsCustomer'].markAsDirty();
		}

		if (this.item._Owner) {
			this.salesmanListSelected.push(this.item._Owner);
			this.salesmanListSelected = [...this.salesmanListSelected];
		}
		if (this.item._StorerConfig) {
			this.storerList = [...this.item._StorerConfig];
		}
		this.patchAddressesValue();

		this.salesmanSearch();
	}

	saveContactUDF() {
		if (!this.contactUDFGroup?.get('Id')?.value) {
			this.contactUDFGroup.get('Id').setValue(this.item?.Id);
			this.contactUDFGroup.get('Code').setValue(this.item?.Code);
			this.contactUDFGroup.get('Name').setValue(this.item?.Name);
			this.contactUDFGroup.get('Id').markAsDirty();
			this.contactUDFGroup.get('Code').markAsDirty();
			this.contactUDFGroup.get('Name').markAsDirty();
		} else {
			if (this.contactUDFGroup.get('Name').value != this.item?.Name) {
				this.contactUDFGroup.get('Name').setValue(this.item?.Name);
				this.contactUDFGroup.get('Name').markAsDirty();
			}
			if (this.contactUDFGroup.get('Code').value != this.item?.Code) {
				this.contactUDFGroup.get('Code').setValue(this.item?.Code);
				this.contactUDFGroup.get('Code').markAsDirty();
			}
		}
		let submitItem = this.getDirtyValues(this.contactUDFGroup);
		this.submitAttempt = true;
		this.contactUDFProvider.save(submitItem).then((res) => {
			this.contactUDFGroup.markAsPristine();
			this.cdr.detectChanges();
			this.submitAttempt = false;
			this.env.showMessage('Saving completed!', 'success');
		});
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

	patchAddressesValue() {
		if (this.item.Addresses?.length > 0) {
			let groups = this.formGroup.get('Addresses') as FormArray;
			groups.clear();
			if (this.item.Addresses?.length) {
				for (let i of this.item.Addresses) {
					this.addAddress(i);
				}
			}
		}
		if (!this.pageConfig.canEdit) {
			this.formGroup.controls.Addresses.disable();
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

	async saveChange() {
		if (this.id == '0') {
			this.formGroup.controls.Status.setValue('New');
			this.formGroup.controls.Status.markAsDirty();
			//this.formGroup.controls.IsPersonal.markAsDirty();
		}
		super.saveChange2();
	}

	async changeAddress(e) {
		let groups = <FormArray>this.formGroup.controls.Addresses;
		let fg = groups.controls.find((d) => d.get('Id').value == e.Id) as FormGroup;
		if (fg) {
			Object.keys(fg.controls).forEach((key) => {
				if (fg.get(key) && fg.get(key).value !== e[key]) {
					fg.get(key).setValue(e[key]); // Update the value
					fg.get(key).markAsDirty(); // Mark the control as dirty if the value changed
				}
			});
			fg.get('Id').markAsDirty();
			await this.saveChange();
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

	changeType(control) {
		if (this.submitAttempt) {
			this.formGroup.get(control).setValue(!this.formGroup.get(control).value);
			return;
		}
		this.submitAttempt = false;
		this.saveChange();
	}
	segmentChanged(ev: any) {
		this.pageConfig.isSubActive = true;
		this.segmentView.Page = ev;
	}

	selectedOption = this.optionGroup[0];

	loadNode(option = null) {
		this.pageConfig.isSubActive = true;
		if (!option && this.segmentView) {
			option = this.optionGroup.find((d) => d.Code == this.segmentView.Page);
		}

		if (!option) {
			option = this.optionGroup[0];
		}

		if (!option) {
			return;
		}
		this.selectedOption = option;
		this.segmentView.Page = option.Code;
		if (option.Code === 'lotable' || option.Code === 'udf') {
			this.env
				.showLoading(
					'Please wait for a few moments',
					this.getConfigOptionCode()
						.then((optionCode: any) => this.pageProvider.getConfig(null, optionCode))
						.then((config: any) => {
							if (option.Code === 'lotable') {
								this.lotableList = Object.entries(config)
									.filter(([key, value]) => key.startsWith('CRMLotable') && value !== null)
									.map(([key, value]) => {
										let type = '';
										if (key.includes('Text')) {
											type = 'text';
										} else if (key.includes('Num')) {
											type = 'number';
										} else if (key.includes('Date')) {
											type = 'datetime-local';
										}
										return { key, code: key.replace(/^CRM/, ''), value, type };
									});
							} else {
								this.udfList = Object.entries(config)
									.filter(([key, value]) => key.startsWith('CRMUDF') && value !== null)
									.map(([key, value]) => {
										const code = key.replace(/^CRM/, '');
										this.contactUDFGroup.addControl(
											code,
											new FormControl(this.item?._contactUDF?.[code] ?? '')
										);

										return { key, value, code };
									});
							}
						})
				)
				.catch((err) => {
					this.env.showMessage('Cannot load data', 'danger');
				});
		}
	}

	warehouseList = [];

	addWarehouse() {
		this.storerList.push({ Name: 'Kho mới' });
	}

	changeSegmentName(data: any) {
		this.storerList[data.index].Name = data.name;
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

	savedChange(savedItem = null, form = this.formGroup) {
		super.savedChange(savedItem, form);
		let groups = <FormArray>this.formGroup.controls.Addresses;
		let idsBeforeSaving = new Set(groups.controls.map((g) => g.get('Id').value));
		this.item = savedItem;
		this.formGroup?.patchValue(this.item);
		if (this.item.Addresses?.length > 0) {
			let newIds = new Set(this.item.Addresses.map((i) => i.Id));
			const diff = [...newIds].filter((item) => !idsBeforeSaving.has(item));
			if (diff?.length > 0) {
				groups.controls
					.find((d) => d.get('Id').value == null)
					?.get('Id')
					.setValue(diff[0]);
			}
		}
		if (groups.controls.find((d) => !d.get('Id').value)) {
			this.isShowAddAddress = false;
		} else this.isShowAddAddress = true;
	}
	async openRequestDataConnectionModal() {
		// let formGroup = clone
		const modal = await this.modalController.create({
			component: DataCorrectionRequestModalPage,
			componentProps: {
				item: {
					IDBranch: this.formGroup.get('IDBranch').value,
					Id: this.formGroup.get('Id').value,
					Code: this.formGroup.get('Code').value,
					CompanyName: this.formGroup.get('CompanyName').value,
					Name: this.formGroup.get('Name').value,
					Addresses: [
						this.formGroup
							.get('Addresses')
							.getRawValue()
							.map((s) => {
								return {
									Id: s.Id,
									AddressLine1: s.AddressLine1,
									Phone1: s.Phone1,
								};
							}),
					],
				},
				model: {
					Type: 'Outlet',
					Fields: [
						{ id: 'Id', type: 'number', label: 'Id', disabled: true },
						{ id: 'IDBranch', type: 'number', label: 'Branch', disabled: true },
						{ id: 'Name', type: 'text', label: 'Name' },
						{ id: 'Code', type: 'text', label: 'Code' },
						{ id: 'CompanyName', type: 'text', label: 'CompanyName' },
						//  { id: 'DeletedAddressFields',type:'nonRender'},
						{
							id: 'Addresses',
							type: 'FormArray',
							label: 'Addresses',
							Fields: [
								{ id: 'Id', type: 'number', label: 'Id', disabled: true },
								{ id: 'AddressLine1', type: 'text', label: 'AddressLine1' },
							],
						},
					],
				},
				cssClass: 'modal90',
			},
		});

		await modal.present();
		const { data } = await modal.onWillDismiss();
	}
	//https://www.google.com/maps/dir/?api=1&origin=10.764310,106.764643&destination=10.764310,106.764643&waypoints=10.7830526,106.94224159999999|10.791549,107.07479179999996|10.7915375,107.0749568|10.7922551,107.0781187|10.725809,107.05181330000005|10.7897802,107.10178040000005
	//https://www.google.com/maps/dir/10.7830526,106.94224159999999/10.791549,107.07479179999996/10.7915375,107.0749568/10.7922551,107.0781187/10.725809,107.05181330000005/10.7897802,107.10178040000005
}
