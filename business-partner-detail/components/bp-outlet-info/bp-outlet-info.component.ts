import { Component, ChangeDetectorRef, Input, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormControl, FormArray } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AlertController, LoadingController, NavController } from '@ionic/angular';
import { from } from 'rxjs';
import { PageBase } from 'src/app/page-base';
import { EnvService } from 'src/app/services/core/env.service';
import { lib } from 'src/app/services/static/global-functions';
import { CRM_OutletsProvider, SYS_TypeProvider, WMS_StorerProvider } from 'src/app/services/static/services.service';

@Component({
  selector: 'app-bp-outlet-info',
  templateUrl: './bp-outlet-info.component.html',
  styleUrls: ['./bp-outlet-info.component.scss'],
})
export class BpOutletInfoComponent extends PageBase {
  @Input() canEdit;
  @Input() set bpId(value) {
    this.id = value;
  };

  constructor(
    public pageProvider: CRM_OutletsProvider,
    public typeProvider: SYS_TypeProvider,
    public env: EnvService,
    public route: ActivatedRoute,
    public alertCtrl: AlertController,
    public navCtrl: NavController,
    public formBuilder: FormBuilder,
    public cdr: ChangeDetectorRef,
    public loadingController: LoadingController,
  ) {
    super();
    this.pageConfig.isDetailPage = true;
    this.pageConfig.isForceCreate = true; //Id===IDContact

    this.formGroup = formBuilder.group({
      Id: [''],
      Type: [''],
      Location: [''],
      BusinessType: [''],
      PopulationDistribution: [''],
      CustomersAccess: [''],
      Display: [''],
      Remark: [''],

      MainRouteId: [''],
      IsDisabled: ['']
    });

  }

  typeList = [];
  TypeSource = [];
  LocationSource = [];
  BusinessTypeSource = [];
  PopulationDistributionSource = [];
  CustomersAccessSource = [];
  DisplaySource = [];
  preLoadData() {
    this.typeProvider.read({ IgnoredBranch: true, AllChildren: true, Code: 'OutletsType', Take: 5000 }).then(resp => {
      this.typeList = resp['data'];
      super.preLoadData();
      this.getDataSource('fmcg-distribution-channels').then((tree: any) => {
        this.TypeSource = tree;
      });
      this.getDataSource('shop-location').then((tree: any) => {
        this.LocationSource = tree;
      });
      this.getDataSource('business-type').then((tree: any) => {
        this.BusinessTypeSource = tree;
      });
      this.getDataSource('population-distribution').then((tree: any) => {
        this.PopulationDistributionSource = tree;
      });
      this.getDataSource('customers-access').then((tree: any) => {
        this.CustomersAccessSource = tree;
      });
      this.getDataSource('outlets-display').then((tree: any) => {
        this.DisplaySource = tree;
      });
    });
  }

  loadedData() {
    if (!this.item || !this.item.Id) {
      this.item = {};
      this.item.Id = this.id;
    }
    this.pageConfig.canEdit = this.canEdit;
    super.loadedData();
  }

  async saveChange() {
    super.saveChange2(this.formGroup, null);
  }

  getDataSource(code) {
    let root = this.typeList.find(d => d.Code == code);
    return lib.buildFlatTree(this.typeList, [], true, root);
  }

  searchShowAllChildren = (term: string, item: any) => {
    let ids = lib.searchTreeReturnId(this.typeList, term);
    return ids.indexOf(item.Id) > -1;
  }

}
