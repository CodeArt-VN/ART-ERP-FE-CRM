import { Component, ChangeDetectorRef, Input, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormControl, FormArray } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AlertController, LoadingController, NavController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { EnvService } from 'src/app/services/core/env.service';
import { CRM_ContactProvider, CRM_ContactReferenceProvider } from 'src/app/services/static/services.service';

@Component({
    selector: 'app-bp-reference-code',
    templateUrl: './bp-reference-code.component.html',
    styleUrls: ['./bp-reference-code.component.scss'],
    standalone: false
})
export class BpReferenceCodeComponent extends PageBase {
  @Input() canEdit;
  @Input() set bpId(value) {
    this.id = value;
    this.query.IDContact = this.id;
  }

  constructor(
    public pageProvider: CRM_ContactReferenceProvider,
    public businessPartnerProvider: CRM_ContactProvider,
    public env: EnvService,
    public route: ActivatedRoute,
    public alertCtrl: AlertController,
    public navCtrl: NavController,
    public formBuilder: FormBuilder,
    public cdr: ChangeDetectorRef,
    public loadingController: LoadingController,
  ) {
    super();
    this.formGroup = formBuilder.group({
      Id: new FormControl({ value: '', disabled: true }),
      ContactReferences: this.formBuilder.array([]),
    });
  }

  vendorList = [];
  preLoadData() {
    this.businessPartnerProvider.read({ IsProvideReferenceCode: true, IgnoredBranch: true }).then((resp) => {
      this.vendorList = resp['data'];
      super.preLoadData();
    });
  }

  loadedData() {
    this.pageConfig?.subscribeEvent?.unsubscribe();
    this.vendorList.forEach((i) => {
      let reff = this.items.find((d) => d.IDVendor == i.Id);
      if (reff) i.ContactReference = reff;
      else
        i.ContactReference = {
          IDContact: this.id,
          IDVendor: i.Id,
          Id: 0,
          Code: '',
        };
    });
    this.item = { Id: this.id };
    super.loadedData();
    this.setContactReferences();
    this.pageConfig.canEdit = this.canEdit;
    if (!this.canEdit) this.formGroup?.disable();
  }

  setContactReferences() {
    this.vendorList.forEach((v) => {
      this.AddContactReference(v);
    });
  }

  AddContactReference(vendor) {
    let groups = <FormArray>this.formGroup.controls.ContactReferences;
    groups.push(
      this.formBuilder.group({
        IDContact: this.id,
        IDVendor: vendor.Id,
        VendorName: vendor.Name,
        Id: vendor.ContactReference.Id,
        Code: vendor.ContactReference.Code,
      }),
    );
  }

  changeCode(form) {
    Object.keys(form.controls).forEach((c) => {
      form.controls[c].markAsDirty();
    });

    this.saveChange2(form, null);
  }
}
