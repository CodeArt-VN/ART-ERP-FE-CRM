import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef, Component, Input } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AlertController, LoadingController, NavController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { PageBase } from 'src/app/page-base';
import { EnvService } from 'src/app/services/core/env.service';
import { CRM_PartnerTaxInfoProvider } from 'src/app/services/static/services.service';

@Component({
  selector: 'app-bp-tax-address',
  templateUrl: './bp-tax-address.component.html',
  styleUrls: ['./bp-tax-address.component.scss'],
})
export class BpTaxAddressComponent extends PageBase {
  @Input() canEdit;

  @Input() set bpId(value) {
    this.query.IDPartner = value;
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
    public httpClient: HttpClient,
    public translate: TranslateService,
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
    } else {
      this.addAddress({ IDPartner: this.query.IDPartner, Id: 0 });
    }
  }

  addAddress(address) {
    let groups = <FormArray>this.formGroup.controls.TaxAddresses;
    let lat: number = +address.Lat;
    let long: number = +address.Long;

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
      Sort: address.Sort,
    });

    groups.push(group);
  }

  removeAddress(index) {
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
                this.env.showTranslateMessage('Deleted! ', 'success');
              });
            },
          },
        ],
      })
      .then((alert) => {
        alert.present();
      });
  }

  saveAddress(form: FormGroup) {
    this.saveChange2(form, null);
  }

  onChangedTaxCode(event, form) {
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
            form.controls.CompanyName.setValue(result.TenChinhThuc);
            form.controls.CompanyName.markAsDirty();

            form.controls.BillingAddress.setValue(result.DiaChiGiaoDichChinh);
            form.controls.BillingAddress.markAsDirty();
            this.saveAddress(form);
          }
        })
        .catch((err) => {
          this.env.showTranslateMessage('Mã số thuế không hợp lệ!', 'danger');
        });
    }
  }
}
