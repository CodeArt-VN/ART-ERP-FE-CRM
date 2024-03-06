import { Component, ChangeDetectorRef, Input, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormControl, FormArray } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AlertController, LoadingController, NavController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { EnvService } from 'src/app/services/core/env.service';
import { WMS_LocationProvider, WMS_StorerProvider, WMS_ZoneProvider } from 'src/app/services/static/services.service';

@Component({
  selector: 'app-bp-storer-info',
  templateUrl: './bp-storer-info.component.html',
  styleUrls: ['./bp-storer-info.component.scss'],
})
export class BpStorerInfoComponent extends PageBase {
  @Input() canEdit;
  @Input() set bpId(value) {
    this.id = value;
  }

  constructor(
    public pageProvider: WMS_StorerProvider,
    public zoneProvider: WMS_ZoneProvider,
    public locationProvider: WMS_LocationProvider,
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
      IDBranch: [this.env.selectedBranch],
      Id: new FormControl(),

      isActivated: [''],
      StandardCarrierAlphaCode: [''],
      CreditLimit: [''],
      IDCartonGroup: [''],

      Remark: [''],

      //Crossdock
      // EnableOpportunisticCrossdock
      // Order Sequence Strategy
      // Allow Partial Shipments
      // Automatically Create Pick Tasks During Allocation
      // Issue Full Pallet Picks to Operator Following Receipt
      // Inbound Staging Location for Allocated Receipts
      // Outbound Crossdock Stage Location
      // Requested Ship Date – From Date: Today minus(-) number of days
      // Requested Ship Date – To Date: To Today plus(+) number of days
      // Order Types to Exclude from Opportunistic Allocation
      // Minimum Allowable % of Order Qty to Received Qty
      // Maximum # of Orders to Allocate per Receipt Transactions
      // Automatic Appointment Rule

      //Task
      IsEnablePacking: [''],
      IsQCInspectAtPack: [''],
      IsAllowMultiZoneRainbowPallet: [''],
      DefaultItemRotation: ['', Validators.required],
      DefaultRotation: ['', Validators.required],
      DefaultStrategy: [''],
      DefaultPutawayStrategy: [''],
      DefaultInboundQCLocation: [''],
      DefaultOutboundQCLocation: [''],
      DefaultReturnsReceiptLocation: [''],
      DefaultPackingLocation: [''],

      //Label
      LPNBarcodeSymbology: [''],
      LPNBarcodeFormat: [''],
      LPNLength: [''],
      LPNStartNumber: [''],
      LPNNextNumber: [''],
      LPNRollbackNumber: [''],
      CaseLabelType: [''],
      ApplicationID: [''],
      SSCCFirstDigit: [''],
      UCCVendor: [''],

      //Processing
      AllowCommingledLPN: [''],
      LabelTemplate: [''],
    });
  }

  loadedData() {
    if (!this.item || !this.item.Id) {
      this.item = {};
      this.item.Id = this.id;
    }
    super.loadedData();
    this.pageConfig.canEdit = this.canEdit;
    if (!this.canEdit) this.formGroup?.disable();
  }

  async saveChange() {
    super.saveChange2(this.formGroup, null);
  }

  locationList = []; //TODO: load locations
}
