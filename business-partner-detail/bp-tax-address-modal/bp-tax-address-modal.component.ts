import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef, Component, Input } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { el } from '@fullcalendar/core/internal-common';
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
	IDPartner;
	TaxAddressList;
	hasTaxCode = true;
	constructor(
		public pageProvider: CRM_PartnerTaxInfoProvider,
		public modalController: ModalController,
		public env: EnvService,
		public route: ActivatedRoute,
		public alertCtrl: AlertController,
		public navCtrl: NavController,
		public formBuilder: FormBuilder,
		public cdr: ChangeDetectorRef,
		public loadingController: LoadingController,
		public httpClient: HttpClient,
		public translate: TranslateService
	) {
		super();
		this.pageConfig.isDetailPage = true;
		this.formGroup = formBuilder.group({
			IDPartner: [''],
			Id: [''],
			Code: [''],
			Name: [''],
			CompanyName:  ['', Validators.required],
			TaxCode:  ['', Validators.required],
			WorkPhone: [''],
			Email: [''],
			BillingAddress:  ['', Validators.required],
			IsDefault: [''],
			Remark: [''],
			IdentityCardNumber: [''],
			Sort: [''],
		});
	}

	
	preLoadData(event?: any): void {
		this.loadedData();
	}

	loadedData() {
		this.item.IDPartner = this.IDPartner;
		if(this.item.IdentityCardNumber == '' || this.item.IdentityCardNumber == null){
			this.hasTaxCode = true;
			this.formGroup.get('Name')?.clearValidators();
			this.formGroup.get('Name')?.updateValueAndValidity();
			this.formGroup.get('IdentityCardNumber')?.clearValidators();
			this.formGroup.get('IdentityCardNumber')?.updateValueAndValidity();
		} 
		else {
			this.hasTaxCode = false;
			this.formGroup.get('TaxCode')?.clearValidators();
			this.formGroup.get('TaxCode')?.updateValueAndValidity();

		}
		super.loadedData();
		
	}

	changeIsDefault(form){
		
		this.pageProvider.commonService
			.connect('GET', 'CRM/Contact/ChangeIsDefaultTaxAddresses', {
				Id: form.get('Id').value, 
				Value: form.get('IsDefault').value, 
				IDPartner: this.IDPartner,
			})
			.toPromise()
			.then((result: any) => {
				this.env.showMessage('Cập nhật thành công!', 'success');
				this.cdr.detectChanges();
			})
			.catch((err) => {
				this.env.showMessage('Cập nhật thất bại!', 'danger');
			});
	}



	saveAddress(form: FormGroup) {
		
		if(!this.id){
			this.formGroup.get('IDPartner')?.markAsDirty();
		}
		return this.saveChange2(form, null);
		
	}


	
    onChangedHasCode(value) {
		this.hasTaxCode = value;
        if (value) {
			this.formGroup.get('TaxCode').setValue('');
            this.formGroup.get('TaxCode').markAsDirty();
			this.formGroup.get('TaxCode')?.setValidators([Validators.required]);
			this.formGroup.get('Name')?.clearValidators();	
			this.formGroup.get('Name')?.setValue('');
			this.formGroup.get('Name')?.markAsDirty();
			this.formGroup.get('IdentityCardNumber')?.clearValidators();	
			this.formGroup.get('IdentityCardNumber')?.setValue('');
			this.formGroup.get('IdentityCardNumber')?.markAsDirty();
		} else {
		
			this.formGroup.get('TaxCode')?.clearValidators();
			this.formGroup.get('TaxCode')?.setValue('');
			this.formGroup.get('TaxCode')?.markAsDirty();

			this.formGroup.get('Name')?.setValidators([Validators.required]);
			this.formGroup.get('Name')?.markAsDirty();
			this.formGroup.get('IdentityCardNumber')?.setValidators([Validators.required]);
			this.formGroup.get('IdentityCardNumber')?.setValue('');
    		this.formGroup.get('IdentityCardNumber')?.markAsDirty();
		}
		this.formGroup.get('CompanyName')?.setValue('');
		this.formGroup.get('CompanyName')?.markAsDirty();
		this.formGroup.get('WorkPhone')?.setValue('');
		this.formGroup.get('WorkPhone')?.markAsDirty();
		this.formGroup.get('Email')?.setValue('');
		this.formGroup.get('Email')?.markAsDirty();
		this.formGroup.get('BillingAddress')?.setValue('');
		this.formGroup.get('BillingAddress')?.markAsDirty();
		this.formGroup.get('TaxCode')?.updateValueAndValidity();
		this.formGroup.get('Name')?.updateValueAndValidity();
		this.formGroup.get('IdentityCardNumber')?.updateValueAndValidity();

    }

	onChangedTaxCode(event, form) {
		let value = event.target.value;
		if(value.length <= 9) {
			this.env.showMessage('Mã số thuế phải từ 9 số!', 'danger');
			form.controls.TaxCode.setValue('');
			return;
		}
		this.pageProvider.commonService
				.connect('GET', 'CRM/Contact/SearchUnitInforByTaxCode', {
					TaxCode: value,
				})
				.toPromise()
				.then((result: any) => {
					if (result.TenChinhThuc) {
						form.controls.CompanyName.setValue(result.TenChinhThuc);
						form.controls.CompanyName.markAsDirty();

						form.controls.BillingAddress.setValue(result.DiaChiGiaoDichChinh);
						form.controls.BillingAddress.markAsDirty();
						this.saveAddress(form);
						
					}else {
						this.env.showMessage(result?.Message, 'danger');
						form.controls.TaxCode.setValue('');
					}
				})
				.catch((err) => {
					this.env.showMessage('Mã số thuế không hợp lệ!', 'danger');
				});
	}

	delete(publishEventCode = this.pageConfig.pageName) {
		if (this.pageConfig.ShowDelete) {
			this.env
				.actionConfirm('delete', this.selectedItems.length, this.item?.Name, this.pageConfig.pageTitle, () =>
					this.pageProvider.delete(this.pageConfig.isDetailPage ? this.item : this.selectedItems)
				)
				.then((_) => {
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
