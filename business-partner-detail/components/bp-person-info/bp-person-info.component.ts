import { Component, ChangeDetectorRef, Input, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormControl, FormArray } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AlertController, LoadingController, NavController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { EnvService } from 'src/app/services/core/env.service';
import { lib } from 'src/app/services/static/global-functions';

import { CRM_PersonInfoProvider } from 'src/app/services/static/services.service';

@Component({
  selector: 'app-bp-person-info',
  templateUrl: './bp-person-info.component.html',
  styleUrls: ['./bp-person-info.component.scss'],
})
export class BpPersonInfoComponent extends PageBase {
  @Input() canEdit;
  @Input() set bpId(value) {
    this.id = value;
  }

  minDateOfBirth;
  maxDateOfBirth;

  constructor(
    public pageProvider: CRM_PersonInfoProvider,
    public env: EnvService,
    public route: ActivatedRoute,
    public alertCtrl: AlertController,
    public navCtrl: NavController,
    public formBuilder: FormBuilder,
    public cdr: ChangeDetectorRef,
    public loadingController: LoadingController,
  ) {
    super();
    this.pageConfig.isDetailPage = true;
    this.pageConfig.isForceCreate = true; //Id===IDContact

    let cYear = new Date().getFullYear();
    this.minDateOfBirth = cYear - 70 + '-01-01';
    this.maxDateOfBirth = cYear - 16 + '-12-31';

    this.formGroup = formBuilder.group({
      Id: new FormControl(),
      FullName: ['', Validators.required],
      FirstName: [''],
      LastName: [''],
      Gender: [true, Validators.required],
      DateOfBirth: [''],
      PlaceOfBirth: [''],

      PlaceOfOrigin: [''],
      IdentityCardNumber: [''],
      DateOfIssue: [''],
      PlaceOfIssue: [''],
      DateOfExpiration: [''],

      Nationality: [''],
      Ethnic: [''],
      Religion: [''],
      MaritalStatus: [''],

      MobilePhone: [''],
      HomePhone: [''],
      Email: [''],
      Remark: [''],
    });
  }

  loadedData() {
    if (!this.item) {
      this.item = { Id: this.id };
    }
    if (this.item.Gender == undefined) {
      this.item.Gender = true;
    }
    this.pageConfig.canEdit = this.canEdit;

    super.loadedData();
    if (this.item) {
      this.item.DateOfIssue = lib.dateFormat(this.item.DateOfIssue);
      this.item.DateOfBirth = lib.dateFormat(this.item.DateOfBirth);
      this.formGroup.controls.Id.setValue(this.id);
    }
  }

  calcName() {
    let fullName = this.formGroup.controls.FullName.value;
    fullName = fullName.trim().replace(/(^\w|\s\w)/g, (m) => m.toUpperCase());
    fullName = fullName
      .replace(
        /[^aAàÀảẢãÃáÁạẠăĂằẰẳẲẵẴắẮặẶâÂầẦẩẨẫẪấẤậẬbBcCdDđĐeEèÈẻẺẽẼéÉẹẸêÊềỀểỂễỄếẾệỆfFgGhHiIìÌỉỈĩĨíÍịỊjJkKlLmMnNoOòÒỏỎõÕóÓọỌôÔồỒổỔỗỖốỐộỘơƠờỜởỞỡỠớỚợỢpPqQrRsStTuUùÙủỦũŨúÚụỤưƯừỪửỬữỮứỨựỰvVwWxXyYỳỲỷỶỹỸýÝỵỴzZ|\s]?/g,
        '',
      )
      .trim();

    this.formGroup.controls.FullName.setValue(fullName);
    this.formGroup.controls.FullName.markAsDirty();
    let names = fullName.split(' ');
    if (names.length > 1) {
      this.formGroup.controls.FirstName.setValue(names[names.length - 1]);
      this.formGroup.controls.LastName.setValue(names[0]);

      this.formGroup.controls.FirstName.markAsDirty();
      this.formGroup.controls.LastName.markAsDirty();
    }

    this.saveChange();
  }

  async saveChange() {
    super.saveChange2();
  }
}
