import { Component, ChangeDetectorRef, Input, Output, EventEmitter } from '@angular/core';
import { FormBuilder, Validators, FormControl } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AlertController, LoadingController, NavController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { EnvService } from 'src/app/services/core/env.service';
import { BRA_BranchProvider, WMS_LocationProvider, WMS_StorerConfigProvider, WMS_ZoneProvider } from 'src/app/services/static/services.service';
import { lib } from 'src/app/services/static/global-functions';

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
	locationList = [];
	branchList;
	constructor(
		public pageProvider: WMS_StorerConfigProvider,
		public zoneProvider: WMS_ZoneProvider,
		public locationProvider: WMS_LocationProvider,
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

	preLoadData(event?: any): void {
		this.id = this.bpId;
		this.branchProvider
			.read({
				Skip: 0,
				Take: 5000,
				Type: 'Warehouse',
				AllParent: true,
				Id: this.env.selectedBranchAndChildren,
			})
			.then((resp) => {
				lib.buildFlatTree(resp['data'], this.branchList).then((result: any) => {
					this.branchList = result;
					this.branchList.forEach((i) => {
						i.disabled = true;
					});
					this.markNestedNode(this.branchList, this.env.selectedBranch);
				});
			});
		super.preLoadData(event);
	}

	loadedData() {
		if (!this.id) {
			this.formGroup.controls.IDStorer.setValue(this.bpIdStorer);
			this.formGroup.controls.IDStorer.markAsDirty();
		}

		super.loadedData();
		this.pageConfig.canEdit = this.canEdit;
		if (!this.canEdit) this.formGroup?.disable();
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
