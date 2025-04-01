import { ChangeDetectorRef, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormBuilder, FormControl, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AlertController, LoadingController, NavController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { PageBase } from 'src/app/page-base';
import { EnvService } from 'src/app/services/core/env.service';
import { DynamicScriptLoaderService } from 'src/app/services/custom.service';
import { CRM_PartnerTaxInfoProvider } from 'src/app/services/static/services.service';

@Component({
	selector: 'app-tax-info',
	templateUrl: './tax-info.component.html',
	styleUrls: ['./tax-info.component.scss'],
	standalone: false,
})
export class TaxInfoComponent extends PageBase {
	
	@Input() canEdit;

	@Input() set config(value) {
		this.pageConfig = value;
		console.log(value);
	}
	@Input() set taxInfo(value) {
		// this.item = value;
		// this.buildForm();
		if (value) {
			this.item = value;
			if (this.formGroup) {
				this.formGroup.markAsPristine();
				this.formGroup.patchValue(this.item);
			}
		}
	}

	constructor(
		public pageProvider: CRM_PartnerTaxInfoProvider,
		public env: EnvService,
		public route: ActivatedRoute,
		public alertCtrl: AlertController,
		public navCtrl: NavController,
		public formBuilder: FormBuilder,
		public cdr: ChangeDetectorRef,
		public loadingController: LoadingController,
		public dynamicScriptLoaderService: DynamicScriptLoaderService,
		public translate: TranslateService
	) {
		super();
		this.pageConfig.isDetailPage = true;
		this.formGroup = this.formBuilder.group({
			Id:new FormControl({value:'', disabled: true}),
			//IDPartner:new FormControl({value:'', disabled: true}),
			CompanyName: ['', Validators.required],
			TaxCode: ['', Validators.required],
			WorkPhone: [''],
			Email: [''],
			BillingAddress: ['', Validators.required],
			IsDefault: [false],
			Remark: [''],
		});
	}

	preLoadData(event = null) {
		this.loadData();
	}
	loadData() {
		this.loadedData();
	}
	loadedData() {
		super.loadedData();
		this.pageConfig.canEdit = this.canEdit;
		if (!this.canEdit) this.formGroup?.disable();
	}


	@Output() onChange = new EventEmitter();
	submitChange(event = null) {
		let value = this.formGroup.getRawValue();
		if (!this.formGroup.valid) {
			let invalidControls = super.findInvalidControlsRecursive(this.formGroup);
			const translationPromises = invalidControls.map((control) => this.env.translateResource(control));
			Promise.all(translationPromises).then((values) => {
				let invalidControlsTranslated = values;
				this.env.showMessage('Please recheck control(s): {{value}}', 'warning', invalidControlsTranslated.join(' | '));
			});
		} else this.onChange.emit(value);
	}

	@Output() onDelete = new EventEmitter();
	removeTaxInfo() {
		let value = this.formGroup.getRawValue();

		this.env
			.showPrompt('Bạn có chắc muốn xóa không?', null, 'Xóa')
			.then((_) => {
				this.onDelete.emit(value);
			})
			.catch((_) => {});
	}

	onChangedTaxCode(event) {
		//'{"MaSoThue":"0314643146","TenChinhThuc":"CÔNG TY TNHH CÔNG NGHỆ CODE ART","DiaChiGiaoDichChinh":"53/44/21, Bùi Xương Trạch, Phường Long Trường, Thành phố Thủ Đức, Thành phố Hồ Chí Minh, Việt Nam","DiaChiGiaoDichPhu":"","TrangThaiHoatDong":"NNT Đang hoạt động (đã được cấp GCN ĐKT)","SoDienThoai":"","ChuDoanhNghiep":"","LastUpdate":"2022-02-15T00:00:00"}'
		console.log(event.target.value);

		let value = event.target.value;
		if (value.length > 9) {
			this.pageProvider.commonService
				.connect('GET', 'CRM/Contact/SearchUnitInforByTaxCode', {
					TaxCode: value,
				})
				.toPromise()
				.then((result: any) => {
					if (result.TenChinhThuc) {
						this.formGroup.controls.CompanyName.setValue(result.TenChinhThuc);
						this.formGroup.controls.CompanyName.markAsDirty();

						this.formGroup.controls.BillingAddress.setValue(result.DiaChiGiaoDichChinh);
						this.formGroup.controls.BillingAddress.markAsDirty();
						this.submitChange();
					}
				})
				.catch((err) => {
					this.env.showMessage('Mã số thuế không hợp lệ!', 'danger');
				});
		}
	}
}
