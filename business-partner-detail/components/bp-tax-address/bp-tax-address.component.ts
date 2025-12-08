import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef, Component, Input } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AlertController, LoadingController, ModalController, NavController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { PageBase } from 'src/app/page-base';
import { EnvService } from 'src/app/services/core/env.service';
import { CRM_PartnerTaxInfoProvider } from 'src/app/services/static/services.service';
import { BpTaxAddressModal } from '../../bp-tax-address-modal/bp-tax-address-modal.component';

@Component({
	selector: 'app-bp-tax-address',
	templateUrl: './bp-tax-address.component.html',
	styleUrls: ['./bp-tax-address.component.scss'],
	standalone: false,
})
export class BpTaxAddressComponent extends PageBase {
	@Input() canEdit;

	@Input() set bpId(value) {
		this.query.IDPartner = value;
	}

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
		this.formGroup = formBuilder.group({
			Id: new FormControl({ value: '', disabled: true }),
			TaxAddresses: this.formBuilder.array([]),
		});
		this.alwaysReturnProps.push('IDPartner');
	}

	loadedData() {
		this.item = { Id: this.query.IDPartner };
		super.loadedData();
		this.setAddresses();
		this.pageConfig.canEdit = this.canEdit;
		if (!this.canEdit) this.formGroup?.disable();
	}

	setAddresses() {
		this.formGroup.controls.TaxAddresses = this.formBuilder.array([]);
		if (this.items.length) {
			this.items.forEach((c) => {
				this.addAddress(c);
			});
		}
	}

	addAddress(address) {
		let groups = <FormArray>this.formGroup.controls.TaxAddresses;

		let group = this.formBuilder.group({
			IDPartner: this.query.IDPartner,
			Id: address.Id,
			CompanyName: [address.CompanyName, Validators.required],
			TaxCode: [address.TaxCode, Validators.required],
			WorkPhone: address.WorkPhone,
			Email: address.Email,
			BillingAddress: [address.BillingAddress, Validators.required],
			IsDefault: address.IsDefault,
			Remark: address.Remark,
			IdentityCardNumber: address.IdentityCardNumber,
			Sort: address.Sort,
		});

		groups.push(group);
	}

	changeIsDefault(value) {
		const groups = this.formGroup.get('TaxAddresses') as FormArray;
		const selectedId = value.Id;
		const selectedValue = !value.IsDefault;

		this.items.forEach(item => {
			item.IsDefault = (item.Id === selectedId) ? selectedValue : false;
		});
		groups.controls.forEach(ctrl => {
			const isSelected = ctrl.get('Id').value === selectedId;
			ctrl.get('IsDefault').setValue(isSelected ? selectedValue : false);
		});

		this.pageProvider.commonService
			.connect('GET', 'CRM/Contact/ChangeIsDefaultTaxAddresses', {
				Id: selectedId,
				Value: selectedValue,
				IDPartner: this.query.IDPartner,
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

	removeLine(index) {
		this.alertCtrl
			.create({
				header: 'Xóa thông tin xuất hóa đơn',
				//subHeader: '---',
				message: 'Bạn có chắc muốn xóa thông tin xuất hóa đơn này?',
				buttons: [
					{
						text: 'Không',
						role: 'cancel',
					},
					{
						text: 'Đồng ý xóa',
						cssClass: 'danger-btn',
						handler: () => {
							let groups = <FormArray>this.formGroup.controls.TaxAddresses;
							let Ids = [];
							Ids.push({
								Id: groups.controls[index]['controls'].Id.value,
							});
							this.pageProvider.delete(Ids).then((resp) => {
								this.items = this.items.filter((d) => d.Id != Ids[0].Id);
								groups.removeAt(index);
								this.env.showMessage('Deleted! ', 'success');
							});
						},
					},
				],
			})
			.then((alert) => {
				alert.present();
			});
	}

	removeSelectedLine() {
		const groups = this.formGroup.get('TaxAddresses') as FormArray;

		if (this.selectedItems.length === 0) return;

		this.alertCtrl.create({
			header: 'Xóa thông tin xuất hóa đơn',
			message: 'Bạn có chắc muốn xóa các thông tin được chọn?',
			buttons: [
				{ text: 'Không', role: 'cancel' },
				{
					text: 'Đồng ý xóa',
					cssClass: 'danger-btn',
					handler: () => {
						const Ids = this.selectedItems.map(item => ({ Id: item.Id }));

						this.pageProvider.delete(Ids).then(() => {
							this.items = this.items.filter(i => !Ids.some(x => x.Id === i.Id));

							Ids.forEach(({ Id }) => {
								const idx = groups.controls.findIndex(c => c.get('Id').value === Id);
								if (idx >= 0) groups.removeAt(idx);
							});

							this.env.showMessage('Đã xóa thành công!', 'success');
						});
					}
				}
			]
		}).then(alert => alert.present());
	}


	async showModal(i) {
		const modal = await this.modalController.create({
			component: BpTaxAddressModal,
			componentProps: {
				id: i.Id,
				item: i,
				TaxAddressList: this.items,
				IDPartner: this.query.IDPartner,
			},
			cssClass: 'my-custom-class',
		});
		
		await modal.present();
		const { data } = await modal.onWillDismiss();
		this.preLoadData();
		
	}

	add() {
		this.showModal({
			Id: 0,
		});
	}
}
