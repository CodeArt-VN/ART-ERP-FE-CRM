import { Component, ChangeDetectorRef, ViewChild, ElementRef, QueryList, ViewChildren } from '@angular/core';
import { NavController, LoadingController, AlertController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { ActivatedRoute } from '@angular/router';
import { EnvService } from 'src/app/services/core/env.service';
import { FormBuilder, Validators, FormControl, FormArray } from '@angular/forms';
import { CommonService } from 'src/app/services/core/common.service';
import { CRM_BrandProvider, CRM_PolLevelProvider, CRM_RewardCategoryProvider } from 'src/app/services/static/services.service';
import { ApiSetting } from 'src/app/services/static/api-setting';
import { environment } from 'src/environments/environment';
import { DynamicScriptLoaderService } from 'src/app/services/custom/custom.service';
import { thirdPartyLibs } from 'src/app/services/static/thirdPartyLibs';

declare var Quill: any;

@Component({
	selector: 'app-reward-category-detail',
	templateUrl: './reward-category-detail.page.html',
	styleUrls: ['./reward-category-detail.page.scss'],
	standalone: false,
})
export class RewardCategoryDetailPage extends PageBase {
	Image: any;
	noImage = 'assets/avartar-empty.jpg';
	imageServer = environment.posImagesServer;

	constructor(
		public pageProvider: CRM_RewardCategoryProvider,
		public env: EnvService,
		public navCtrl: NavController,
		public route: ActivatedRoute,
		public alertCtrl: AlertController,
		public formBuilder: FormBuilder,
		public cdr: ChangeDetectorRef,
		public loadingController: LoadingController,
		public commonService: CommonService,
		private dynamicScriptLoaderService: DynamicScriptLoaderService
	) {
		super();
		this.pageConfig.isDetailPage = true;

		this.formGroup = formBuilder.group({
			// IDBranch: [this.env.selectedBranch],
			Id: new FormControl({ value: '', disabled: true }),
			Code: [''],
			Name: ['', Validators.required],
			Remark: [''],
			Sort: [''],
			IsDisabled: new FormControl({ value: '', disabled: true }),
			IsDeleted: new FormControl({ value: '', disabled: true }),
			CreatedBy: new FormControl({ value: '', disabled: true }),
			CreatedDate: new FormControl({ value: '', disabled: true }),
			ModifiedBy: new FormControl({ value: '', disabled: true }),
			ModifiedDate: new FormControl({ value: '', disabled: true }),
			Logo: [null],
			Icon: [''],
			Color: [''],
		});
	}

	loadedData(event?: any, ignoredFromGroup?: boolean): void {
		super.loadedData();
		this.item.LevelBenefits = [];
		console.log(this.item);
	}

	segmentView = 's1';
	segmentChanged(ev: any) {
		this.segmentView = ev.detail.value;
	}

	saveChange() {
		return this.saveChange2();
	}

	@ViewChild('uploadImage') uploadImage: any;
	onClickUpload() {
		this.uploadImage.nativeElement.value = '';
		this.uploadImage.nativeElement.click();
	}

	onFileSelected = (event) => {
		if (event.target.files.length == 0) {
			return;
		}
		let apiDomain = 'CRM/Reward/UploadImage/';
		let apiPath = {
			method: 'UPLOAD',
			url: function () {
				return ApiSetting.apiDomain(apiDomain) +'RewardCategory';
			},
		};

		this.commonService.upload(apiPath, event.target.files[0]).then((result: any) => {
			if (result != null) {
				this.env.showMessage('Upload success', 'success');
				const envImage = result; // environment.posImagesServer +

				this.formGroup.controls.Logo.setValue(envImage);
				this.formGroup.controls.Logo.markAsDirty();
				this.saveChange();
			} else {
				this.env.showMessage('Upload failed', 'success');
			}
		});
	};

	addLine() {}
}
