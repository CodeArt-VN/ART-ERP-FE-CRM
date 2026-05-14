import { Component, ChangeDetectorRef, ViewChild, ElementRef, QueryList, ViewChildren } from '@angular/core';
import { NavController, LoadingController, AlertController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { ActivatedRoute } from '@angular/router';
import { EnvService } from 'src/app/services/core/env.service';
import { FormBuilder, Validators, FormControl, FormArray } from '@angular/forms';
import { CommonService } from 'src/app/services/core/common.service';
import { CRM_BrandProvider } from 'src/app/services/static/services.service';
import { ApiSetting } from 'src/app/services/static/api-setting';
import { environment } from 'src/environments/environment';
import { DynamicScriptLoaderService } from 'src/app/services/custom/custom.service';
import { thirdPartyLibs } from 'src/app/services/static/thirdPartyLibs';

declare var Quill: any;

@Component({
	selector: 'app-brand-detail',
	templateUrl: './brand-detail.page.html',
	styleUrls: ['./brand-detail.page.scss'],
	standalone: false,
})
export class BrandDetailPage extends PageBase {
	Image: any;
	noImage = 'assets/avartar-empty.jpg';
	imageServer = environment.posImagesServer;
	editor: any;
	remarkBeforeChange = '';
	isEdit = true;
	polLevelGroupList = [];
	selectedPolLevelGroupIds = [];
	isLoadingPolLevelGroups = false;
	isSyncingPolLevelGroups = false;
	@ViewChildren('quillEditor') quillElement: QueryList<ElementRef>;

	constructor(
		public pageProvider: CRM_BrandProvider,
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
			IsPartner: [false],
			PinCode: ['', Validators.required],
			Avatar: [null],
			Logo: [null],
		});
	}

	loadedData(event?: any, ignoredFromGroup?: boolean): void {
		super.loadedData();
		if (this.segmentView == 's3') {
			this.loadPolLevelGroups();
		}
	}

	segmentView = 's1';
	segmentChanged(ev: any) {
		this.segmentView = ev.detail.value;
		if (this.segmentView == 's3') {
			this.loadPolLevelGroups();
		}
	}

	saveChange() {
		return this.saveChange2();
	}

	@ViewChild('uploadImage') uploadImage: any;
	_isAvatar = false;
	onClickUpload(isAvatar: boolean, id: number) {
		this._isAvatar = isAvatar;
		this.uploadImage.nativeElement.value = '';
		this.uploadImage.nativeElement.click();
	}

	onFileSelected = (event) => {
		if (event.target.files.length == 0) {
			return;
		}
		let apiDomain = 'CRM/Brand/UploadImage/';
		let apiPath = {
			method: 'UPLOAD',
			url: function () {
				return ApiSetting.apiDomain(apiDomain);
			},
		};

		this.commonService.upload(apiPath, event.target.files[0]).then((result: any) => {
			if (result != null) {
				this.env.showMessage('Upload success', 'success');
				const envImage = result; // environment.posImagesServer +
				if (this._isAvatar) {
					this.formGroup.controls.Avatar.setValue(envImage);
					this.formGroup.controls.Avatar.markAsDirty();
					this.saveChange();
				} else {
					this.formGroup.controls.Logo.setValue(envImage);
					this.formGroup.controls.Logo.markAsDirty();
					this.saveChange();
				}
			} else {
				this.env.showMessage('Upload failed', 'success');
			}
		});
	};
	onTemplateChange(value: string) {
		this.formGroup.get('Remark')?.setValue(value);
		this.formGroup.get('Remark')?.markAsDirty();
	}

	edit() {
		this.isEdit = true;
		this.remarkBeforeChange = this.item.Remark;
	}

	preView() {
		this.isEdit = false;
		this.remarkBeforeChange = this.item.Remark;
		this.item.Remark = this.formGroup.get('Remark')?.value ?? '';
	}

	saveContent() {
		this.saveChange();
	}

	loadPolLevelGroups() {
		if (!this.item?.Id || this.isLoadingPolLevelGroups) {
			return;
		}

		this.isLoadingPolLevelGroups = true;
		this.commonService
			.connect('GET', 'CRM/PolLevelGroupBrand/OptionsByBrand/' + this.item.Id, null)
			.toPromise()
			.then((resp: any) => {
				this.polLevelGroupList = resp || [];
				this.selectedPolLevelGroupIds = this.polLevelGroupList.filter((d) => d.Selected).map((d) => d.Id);
			})
			.catch((err) => {
				this.env.showMessage('Cannot load level policy groups', 'danger');
				console.error(err);
			})
			.finally(() => {
				this.isLoadingPolLevelGroups = false;
			});
	}

	isPolLevelGroupSelected(group: any) {
		return this.selectedPolLevelGroupIds.indexOf(group.Id) > -1;
	}

	onPolLevelGroupChanged(group: any, ev: any) {
		if (!this.pageConfig.canEdit || !this.item?.Id || this.isSyncingPolLevelGroups) {
			return;
		}

		const checked = ev?.detail?.checked == true;
		if (checked == this.isPolLevelGroupSelected(group)) {
			return;
		}

		let ids = this.selectedPolLevelGroupIds.filter((id) => id != group.Id);
		if (checked) {
			ids.push(group.Id);
		}

		this.syncPolLevelGroups(ids);
	}

	syncPolLevelGroups(ids: number[]) {
		this.isSyncingPolLevelGroups = true;
		this.commonService
			.connect('POST', 'CRM/PolLevelGroupBrand/SetByBrand', {
				IDBrand: this.item.Id,
				IDsPolLevelGroup: ids,
			})
			.toPromise()
			.then((resp: any) => {
				this.polLevelGroupList = resp?.Items || this.polLevelGroupList;
				this.selectedPolLevelGroupIds = resp?.IDsPolLevelGroup || ids;
				this.env.showMessage('Saved', 'success');
			})
			.catch((err) => {
				this.env.showMessage('Cannot save level policy groups', 'danger');
				this.loadPolLevelGroups();
				console.error(err);
			})
			.finally(() => {
				this.isSyncingPolLevelGroups = false;
			});
	}
}
