import { Component, ChangeDetectorRef, ViewChild } from '@angular/core';
import { NavController, ModalController, LoadingController, AlertController, PopoverController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { ActivatedRoute } from '@angular/router';
import { EnvService } from 'src/app/services/core/env.service';
import {
  CRM_ContactProvider,
  HRM_StaffProvider,
  WMS_PriceListProvider,
} from 'src/app/services/static/services.service';
import { FormBuilder, FormGroup, Validators, FormControl, FormArray } from '@angular/forms';
import { concat, of, Subject } from 'rxjs';
import { catchError, distinctUntilChanged, switchMap, tap } from 'rxjs/operators';
import { CommonService } from 'src/app/services/core/common.service';
import { thirdPartyLibs } from 'src/app/services/static/thirdPartyLibs';
import { AddressService, DynamicScriptLoaderService } from 'src/app/services/custom.service';
 declare var ggMap;
@Component({
  selector: 'app-business-partner-detail',
  templateUrl: './business-partner-detail.page.html',
  styleUrls: ['./business-partner-detail.page.scss'],
})
export class BusinessPartnerDetailPage extends PageBase {
  avatarURL = 'assets/imgs/avartar-empty.jpg';
  priceList = [];
  statusList = [];
  storerList = [];

  constructor(
    public pageProvider: CRM_ContactProvider,
    public priceListProvider: WMS_PriceListProvider,
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
    public addressService : AddressService,
    public commonService: CommonService,
  ) {
    super();
    this.pageConfig.isDetailPage = true;
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
      DeletedAddressFields:[],
    });
    console.log(this.formGroup.controls);
  }

  preLoadData(event) {
    this.loadGGMap();
    Promise.all([this.priceListProvider.read(),
      this.env.getStatus('BusinessPartner'),
      this.addressService.getAddressSubdivision()
    ]).then((values:any)=>{
      this.priceList = values[0]['data'];
      this.statusList = values[1];
      super.preLoadData(event);
    });
  }

  loadedData(event?: any, ignoredFromGroup?: boolean): void {
    this.formGroup.controls['IsPersonal'].setValue(true);
    this.formGroup.controls['IsPersonal'].markAsDirty();

    super.loadedData(event, ignoredFromGroup);
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
    if (this.item.Addresses?.length > 0) {
      let groups = this.formGroup.get('Addresses') as FormArray;
      groups.clear();
      this.patchAddressesValue();
    }
    this.salesmanSearch();
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
              tap(() => (this.salesmanListLoading = false)),
            ),
        ),
      ),
    );
  }

  patchAddressesValue(){
    if (this.item.Addresses) {
      if (this.item.Addresses?.length) {
        for (let i of this.item.Addresses) {
          this.addAddress(i);
        }
      }
  
      if (!this.pageConfig.canEdit ) {
        this.formGroup.controls.Addresses.disable();
      }
      }
  }
  
  addAddress(address, markAsDirty = false){ // todo
    let groups = <FormArray>this.formGroup.controls.Addresses;
    let group = this.formBuilder.group({
      IDPartner: [this.formGroup.get('Id').value],
      Id: new FormControl(address?.Id),
      AddressLine1: [address?.AddressLine1,Validators.required],
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
  }

  async saveChange() {
    if (this.id == '0') {
      this.formGroup.controls.Status.setValue('New');
      this.formGroup.controls.Status.markAsDirty();
    }
    super.saveChange2();
  }

  changeAddress(e){
    let groups = <FormArray>this.formGroup.controls.Addresses;
    let fg = groups.controls.find(d=> d.get('Id').value == e.Id) as FormGroup;
    if(fg){
        Object.keys(fg.controls).forEach(key => {
          if (fg.get(key) && fg.get(key).value !== e[key]) {
            fg.get(key).setValue(e[key]); // Update the value
            fg.get(key).markAsDirty();    // Mark the control as dirty if the value changed
          }
        });
        fg.get('Id').markAsDirty();
        this.saveChange(); 
    }
  }

  removeAddress(e) {
    let groups = <FormArray>this.formGroup.controls.Addresses;
    let fg = groups.controls.find(d=> d.get('Id').value == e.Id) as FormGroup;
    let index = groups.controls.indexOf(fg);
    if(e.Id >0){
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
  segmentView = 's1';
  segmentChanged(ev: any) {
    this.segmentView = ev.detail.value;
  }

  warehouseList = [];

  addWarehouse() {
    this.storerList.push({ Name: 'Kho mới'});
  }

  changeSegmentName(data: any) {
    this.storerList[data.index].Name = data.name;
  }
  
  loadGGMap() {
    if (typeof ggMap !== 'undefined')  this.env.isMapLoaded = true;
    else
      this.dynamicScriptLoaderService
        .loadResources(thirdPartyLibs.ggMap.source)
        .then(() =>  this.env.isMapLoaded = true)
        .catch((error) => console.error('Error loading script', error));
  }


  //https://www.google.com/maps/dir/?api=1&origin=10.764310,106.764643&destination=10.764310,106.764643&waypoints=10.7830526,106.94224159999999|10.791549,107.07479179999996|10.7915375,107.0749568|10.7922551,107.0781187|10.725809,107.05181330000005|10.7897802,107.10178040000005
  //https://www.google.com/maps/dir/10.7830526,106.94224159999999/10.791549,107.07479179999996/10.7915375,107.0749568/10.7922551,107.0781187/10.725809,107.05181330000005/10.7897802,107.10178040000005
}
