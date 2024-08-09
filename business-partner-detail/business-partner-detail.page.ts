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

@Component({
  selector: 'app-business-partner-detail',
  templateUrl: './business-partner-detail.page.html',
  styleUrls: ['./business-partner-detail.page.scss'],
})
export class BusinessPartnerDetailPage extends PageBase {
  avatarURL = 'assets/imgs/avartar-empty.jpg';
  priceList = [];
  statusList = [];

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
    });
  }

  preLoadData(event) {
    this.priceListProvider.read().then((resp) => {
      this.priceList = resp['data'];
    });
    this.env.getStatus('BusinessPartner').then((data: any) => {
      this.statusList = data;
      super.preLoadData(event);
    });
  }

  loadedData(event?: any, ignoredFromGroup?: boolean): void {
    
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
    if(this.pageConfig.pageName != 'business-partner'){
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

      this.formGroup.controls['IsPersonal'].setValue(true);
      this.formGroup.controls['IsPersonal'].markAsDirty();

    if (this.item._Owner) {
      this.salesmanListSelected.push(this.item._Owner);
      this.salesmanListSelected = [...this.salesmanListSelected];
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

  async saveChange() {
    if (this.id == '0') {
      this.formGroup.controls.Status.setValue('New');
      this.formGroup.controls.Status.markAsDirty();
    }
    super.saveChange2();
  }

  changeType(control){
    if(this.submitAttempt) {
      this.formGroup.get(control).setValue(!this.formGroup.get(control).value)
      return;
    }
    this.submitAttempt = false;
    this.saveChange(); 
  }
  segmentView = 's1';
  segmentChanged(ev: any) {
    this.segmentView = ev.detail.value;
  }

  //https://www.google.com/maps/dir/?api=1&origin=10.764310,106.764643&destination=10.764310,106.764643&waypoints=10.7830526,106.94224159999999|10.791549,107.07479179999996|10.7915375,107.0749568|10.7922551,107.0781187|10.725809,107.05181330000005|10.7897802,107.10178040000005
  //https://www.google.com/maps/dir/10.7830526,106.94224159999999/10.791549,107.07479179999996/10.7915375,107.0749568/10.7922551,107.0781187/10.725809,107.05181330000005/10.7897802,107.10178040000005
}
