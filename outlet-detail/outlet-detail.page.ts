import { Component, ChangeDetectorRef } from '@angular/core';
import { NavController, LoadingController, AlertController, PopoverController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { ActivatedRoute } from '@angular/router';
import { EnvService } from 'src/app/services/core/env.service';
import { CRM_ContactProvider, HRM_StaffProvider } from 'src/app/services/static/services.service';
import { FormBuilder, Validators, FormControl } from '@angular/forms';
import { CommonService } from 'src/app/services/core/common.service';
import { concat, of, Subject } from 'rxjs';
import { catchError, distinctUntilChanged, switchMap, tap } from 'rxjs/operators';

@Component({
  selector: 'app-outlet-detail',
  templateUrl: './outlet-detail.page.html',
  styleUrls: ['./outlet-detail.page.scss'],
})
export class OutletDetailPage extends PageBase {
  statusList = [];

  constructor(
    public pageProvider: CRM_ContactProvider,
    public staffProvider: HRM_StaffProvider,
    public popoverCtrl: PopoverController,
    public env: EnvService,
    public navCtrl: NavController,
    public route: ActivatedRoute,
    public alertCtrl: AlertController,
    public formBuilder: FormBuilder,
    public cdr: ChangeDetectorRef,
    public loadingController: LoadingController,
    public commonService: CommonService,
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
      Address: this.formBuilder.group({
        Id: [''],
        Phone1: ['', Validators.required],
        Contact: ['', Validators.required],
        Province: ['', Validators.required],
        District: ['', Validators.required],
        Ward: ['', Validators.required],
        AddressLine1: ['', Validators.required],
        AddressLine2: [''],
      }),
      Addresses: this.formBuilder.array([]),

      NumberOfEmployees: [''],
      AnnualRevenue: [''],
      BankName: [''],
      BankAccount: [''],
    });
  }

  preLoadData(event) {
    this.env.getStatus('BusinessPartner').then((data: any) => {
      this.statusList = data;
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

    this.salesmanSearch();

    super.loadedData(event, ignoredFromGroup);
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
              tap(() => (this.salesmanListLoading = false)),
            ),
        ),
      ),
    );
  }

  segmentView = 's1';
  segmentChanged(ev: any) {
    this.segmentView = ev.detail.value;
  }

  async saveChange() {
    super.saveChange2();
  }
}
