import { ChangeDetectorRef, Component, Input } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AlertController, LoadingController, ModalController, NavController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { PageBase } from 'src/app/page-base';
import { EnvService } from 'src/app/services/core/env.service';
import { CRM_PartnerTaxInfoProvider } from 'src/app/services/static/services.service';

@Component({
	selector: 'app-bp-tax-address-modal',
	templateUrl: './bp-tax-address-modal.component.html',
	styleUrls: ['./bp-tax-address-modal.component.scss'],
	standalone: false,
})
export class BpTaxAddressModal extends PageBase {
	@Input() IDPartner;
	@Input() TaxAddressList;

	hasTaxCode = true;
	showSpinner = false;

	constructor(
		public pageProvider: CRM_PartnerTaxInfoProvider,
		public modalController: ModalController,
		public env: EnvService,
		public alertCtrl: AlertController,
		public navCtrl: NavController,
		public formBuilder: FormBuilder,
		public cdr: ChangeDetectorRef,
		public loadingController: LoadingController,
		public translate: TranslateService
	) {
		super();
		this.pageConfig.isDetailPage = true;
		this.formGroup = formBuilder.group({
			IDPartner: [''],
			Id: [''],
			Code: [''],
			Name: ['',Validators.required],
			CompanyName: ['', Validators.required],
			TaxCode: ['', Validators.required],
			WorkPhone: [''],
			Email: [''],
			BillingAddress: [''],
			IsDefault: [false],
			Remark: [''],
			IdentityCardNumber: [''],
			Sort: [''],
		});
	}

	preLoadData(event?: any): void {
		this.loadedData();
	}

	loadedData() {
		this.item = this.item || {};
		this.item.IDPartner = this.IDPartner;

		super.loadedData();

		const taxCode = this.formGroup.get('TaxCode')?.value;
		if (!this.item?.Id || this.item?.Id === 0) {
			this.hasTaxCode = true;
		} else {
			this.hasTaxCode = !!(taxCode && taxCode.toString().trim() !== '');
		}

		this.checkRuleHasTax(this.hasTaxCode);
	}

	changeIsDefault(form: FormGroup) {
		this.pageProvider.commonService
			.connect('GET', 'CRM/Contact/ChangeIsDefaultTaxAddresses', {
				Id: form.get('Id').value,
				Value: form.get('IsDefault').value,
				IDPartner: this.IDPartner,
			})
			.toPromise()
			.then(() => {
				this.env.showMessage('Saving completed!', 'success');
				this.cdr.detectChanges();
			})
			.catch(() => {
				this.env.showMessage('Cannot save, please try again', 'danger');
			});
	}

	saveAddress(form: FormGroup = this.formGroup) {
		if (!this.id || this.id === 0) {
			form.get('IDPartner')?.setValue(this.IDPartner);
			form.get('IDPartner')?.markAsDirty();
		}
		return this.saveChange2(form, null);
	}

	onChangedHasCode(value: boolean) {
		this.hasTaxCode = value;
		this.checkRuleHasTax(value);

		this.formGroup.get('TaxCode')?.setValue('');
		this.formGroup.get('TaxCode')?.markAsDirty();

		this.formGroup.get('IdentityCardNumber')?.setValue('');
		this.formGroup.get('IdentityCardNumber')?.markAsDirty();

		this.formGroup.get('CompanyName')?.setValue('');
		this.formGroup.get('CompanyName')?.markAsDirty();

		this.formGroup.get('WorkPhone')?.setValue('');
		this.formGroup.get('WorkPhone')?.markAsDirty();

		this.formGroup.get('Email')?.setValue('');
		this.formGroup.get('Email')?.markAsDirty();

		this.formGroup.get('BillingAddress')?.setValue('');
		this.formGroup.get('BillingAddress')?.markAsDirty();

		this.formGroup.get('Name')?.setValue('');
		this.formGroup.get('Name')?.markAsDirty();
	}

	checkRuleHasTax(hasTaxCode: boolean) {
		const taxCodeControl = this.formGroup.get('TaxCode');
		const idCardControl = this.formGroup.get('IdentityCardNumber');
		const companyName = this.formGroup.get('CompanyName');
		const name = this.formGroup.get('Name');
		if (hasTaxCode) {
			taxCodeControl?.setValidators([Validators.required]);
			name?.clearValidators();
			companyName?.setValidators([Validators.required]);
		} else {
			taxCodeControl?.clearValidators();
			companyName?.clearValidators();
			name?.setValidators([Validators.required]);
		}

		taxCodeControl?.updateValueAndValidity();
		companyName?.updateValueAndValidity();
		name?.updateValueAndValidity();
	}

	changeTaxCode(event) {
		const value = event?.target?.value ?? this.formGroup.get('TaxCode')?.value ?? '';
		if (!value) return;

		if (value.length <= 9) {
			this.env.showMessage('INVALID_TAX_CODE', 'danger');
			this.formGroup.get('TaxCode')?.setValue('');
			this.formGroup.get('TaxCode')?.markAsDirty();
			return;
		}

		this.showSpinner = true;
		this.pageProvider.commonService
			.connect('GET', 'CRM/Contact/SearchUnitInforByTaxCode', {
				TaxCode: value,
			})
			.toPromise()
			.then((result: any) => {
				this.showSpinner = false;
				if (result?.TenChinhThuc) {
					this.patchValue(result);
					this.saveAddress(this.formGroup);
				} else {
					const errorMessage = result?.Message || 'INVALID_TAX_CODE';
					this.env.showMessage(errorMessage, 'danger');
					this.formGroup.get('TaxCode')?.setValue('');
					this.formGroup.get('TaxCode')?.markAsDirty();
				}
			})
			.catch(() => {
				this.showSpinner = false;
				this.env.showMessage('INVALID_TAX_CODE', 'danger');
			});
	}

	patchValue(data) {
		this.formGroup.get('CompanyName')?.setValue(data.TenChinhThuc || '');
		this.formGroup.get('CompanyName')?.markAsDirty();
		this.formGroup.get('BillingAddress')?.setValue(data.DiaChiGiaoDichChinh || '');
		this.formGroup.get('BillingAddress')?.markAsDirty();
	}

	delete(publishEventCode = this.pageConfig.pageName) {
		if (this.pageConfig.ShowDelete) {
			this.env
				.actionConfirm('delete', this.selectedItems.length, this.item?.Name, this.pageConfig.pageTitle, () =>
					this.pageProvider.delete(this.pageConfig.isDetailPage ? this.item : this.selectedItems)
				)
				.then(() => {
					this.env.showMessage('DELETE_RESULT_SUCCESS', 'success');
					this.env.publishEvent({ Code: publishEventCode });
					this.deleted();
					this.closeModal();
				})
				.catch((err: any) => {
					if (err != 'User abort action') this.env.showMessage('DELETE_RESULT_FAIL', 'danger');
					console.log(err);
				});
		}
	}
}
