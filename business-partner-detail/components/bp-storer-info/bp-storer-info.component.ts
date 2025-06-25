import { Component, ChangeDetectorRef, Input, Output, EventEmitter } from '@angular/core';
import { FormBuilder, Validators, FormControl } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AlertController, LoadingController, NavController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { EnvService } from 'src/app/services/core/env.service';
import {
	BRA_BranchProvider,
	WMS_AllocationStrategyProvider,
	WMS_CartonGroupProvider,
	WMS_LocationProvider,
	WMS_PutawayStrategyProvider,
	WMS_StorerConfigProvider,
	WMS_ZoneProvider,
} from 'src/app/services/static/services.service';
import { lib } from 'src/app/services/static/global-functions';
import { BRA_Branch, WMS_AllocationStrategy, WMS_CartonGroup, WMS_Location, WMS_PutawayStrategy, WMS_Zone } from 'src/app/models/model-list-interface';

@Component({
	selector: 'app-bp-storer-info',
	templateUrl: './bp-storer-info.component.html',
	styleUrls: ['./bp-storer-info.component.scss'],
	standalone: false,
})
export class BpStorerInfoComponent extends PageBase {
	@Input() canEdit;
	@Input() bpId;
	@Input() bpIdStorer;
	@Input() segmentIndex;
	cartonGroupList: WMS_CartonGroup[] = [];
	putawayStrategyList: WMS_PutawayStrategy[] = [];
	allocationStrategyList: WMS_AllocationStrategy[] = [];
	zoneList: WMS_Zone[] = [];
	locationList: WMS_Location[] = [];
	branchList: BRA_Branch[] = [];


	constructor(
		public pageProvider: WMS_StorerConfigProvider,
		public cartonGroupProvider: WMS_CartonGroupProvider,
		public zoneProvider: WMS_ZoneProvider,
		public locationProvider: WMS_LocationProvider,
		public putawayStrategyProvider: WMS_PutawayStrategyProvider,
		public allocationStrategyProvider: WMS_AllocationStrategyProvider,
		public env: EnvService,
		public route: ActivatedRoute,
		public alertCtrl: AlertController,
		public navCtrl: NavController,
		public formBuilder: FormBuilder,
		public cdr: ChangeDetectorRef,
		public loadingController: LoadingController,
		public branchProvider: BRA_BranchProvider
	) {
		super();
		this.pageConfig.isDetailPage = true;
		this.pageConfig.isForceCreate = true; //Id===IDContact

		this.formGroup = formBuilder.group({
			Id: new FormControl(),
			IDWarehouse: ['', Validators.required],
			IDStorer: ['', Validators.required],
			isActivated: [''],
			StandardCarrierAlphaCode: [''],
			CreditLimit: [''],
			IDCartonGroup: [''],
			//Task
			IsEnablePacking: [''],
			IsQCInspectAtPack: [''],
			IsAllowMultiZoneRainbowPallet: [''],
			DefaultItemRotation: ['', Validators.required],
			DefaultRotation: ['', Validators.required],
			DefaultAllocationStrategy: [''],
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

	preLoadData(event?: any): void {
		this.id = this.bpId;
		this.branchList = lib.cloneObject(this.env.branchList);
		Promise.all([
			this.cartonGroupProvider.read()
		]).then((res: any) => {
			this.cartonGroupList = res[0]['data'];
			super.preLoadData(event);
		});
		
	}

	loadedData() {
		if (!this.id) {
			this.formGroup.controls.IDStorer.setValue(this.bpIdStorer);
			this.formGroup.controls.IDStorer.markAsDirty();
		}

		if (this.item?.IDWarehouse) {
			this.loadPutawayAndAllocationStrategy(this.item.IDWarehouse).then(() => {
				super.loadedData();
			});
		} else {
			super.loadedData();
		}

		this.pageConfig.canEdit = this.canEdit;
		if (!this.canEdit) this.formGroup?.disable();
	}

	isChangingWarehouse = false;
	loadPutawayAndAllocationStrategy(selectedWarehouseId = null) {
		this.isChangingWarehouse = true;
		if (!selectedWarehouseId) selectedWarehouseId = this.formGroup.controls.IDWarehouse.value;

		return Promise.all([
			this.putawayStrategyProvider.read({ IDBranch: selectedWarehouseId }),
			this.allocationStrategyProvider.read({ IDBranch: selectedWarehouseId }),
			this.locationProvider.read({ IDBranch: selectedWarehouseId }),
			this.zoneProvider.read({ IDBranch: selectedWarehouseId }),
		]).then((res:any) => {
			this.putawayStrategyList = res[0]['data'];
			this.allocationStrategyList = res[1]['data'];
			this.locationList = res[2]['data'];
			this.zoneList = res[3]['data'];
		}).finally(() => {
			this.isChangingWarehouse = false;
		});
	}

	async saveChange() {
		super.saveChange2(this.formGroup, null);

		this.changeSegmentName.emit({
			index: this.segmentIndex,
			name: this.branchList.find((f) => f.Id == this.formGroup.controls.IDWarehouse.value).Name,
		});
	}

	@Output() changeSegmentName = new EventEmitter<any>();

	markNestedNode(ls, Id) {
		ls.filter((d) => d.IDParent == Id).forEach((i) => {
			if (i.Type == 'Warehouse') i.disabled = false;
			this.markNestedNode(ls, i.Id);
		});
	}
}
