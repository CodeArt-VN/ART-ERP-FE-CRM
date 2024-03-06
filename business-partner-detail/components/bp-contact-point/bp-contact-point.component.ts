import { Component, ChangeDetectorRef, Input, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormControl, FormArray } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AlertController, LoadingController, NavController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { EnvService } from 'src/app/services/core/env.service';
import { CRM_ContactProvider, CRM_PersonInfoProvider } from 'src/app/services/static/services.service';

import { CommonService } from 'src/app/services/core/common.service';
import { ApiSetting } from 'src/app/services/static/api-setting';
import { concat, of, Subject } from 'rxjs';
import { catchError, distinctUntilChanged, mergeMap, switchMap, tap } from 'rxjs/operators';
import { lib } from 'src/app/services/static/global-functions';

@Component({
  selector: 'app-bp-contact-point',
  templateUrl: './bp-contact-point.component.html',
  styleUrls: ['./bp-contact-point.component.scss'],
})
export class BpContactPointComponent extends PageBase {
  @Input() canEdit;
  @Input() set bpId(value) {
    this.id = value;
    this.query.IDParent = this.id;
  }

  constructor(
    public pageProvider: CRM_ContactProvider,
    public personInfoProvider: CRM_PersonInfoProvider,
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
      ContactPoints: this.formBuilder.array([]),
    });
    this.query.IgnoredBranch = true;
    this.query.IsPersonal = true;
    this.pageConfig.isForceCreate = true;
  }

  loadedData() {
    this.items.forEach((i) => {
      i.DateOfBirth = lib.dateFormat(i.DateOfBirth);
      i.disabled = true;
    });

    this.item = { Id: this.id };
    super.loadedData();
    this.setContactPoints();
    this.pageConfig.canEdit = this.canEdit;
    if (!this.canEdit) this.formGroup?.disable();
    this.contactList$ = concat(of(this.items), of([]));
    this.contactSearch();
  }

  setContactPoints() {
    this.items.forEach((c) => {
      this.addContactPoint(c);
    });
  }

  addContactPoint(contact, doSave = false) {
    let groups = <FormArray>this.formGroup.controls.ContactPoints;
    let group = this.formBuilder.group({
      IDParent: this.id,
      Id: contact.Id,
      Name: [contact.Name, Validators.required],
      Title: contact.Title,
      IsPersonal: [true],
      PersonInfo: this.formBuilder.group({
        Id: contact.Id,
        FullName: [''],
        FirstName: [''],
        LastName: [''],
        WorkPhone: [contact.WorkPhone],
        DateOfBirth: [lib.dateFormat(contact.PersonInfo.DateOfBirth)],
        Gender: [contact.PersonInfo.Gender],
      }),
    });

    groups.push(group);
    if (doSave) {
      group.controls.IDParent.markAsDirty();
      group.controls.Name.markAsDirty();
      group.controls.IsPersonal.markAsDirty();
      group.controls.PersonInfo['controls'].WorkPhone.markAsDirty();
      group.controls.PersonInfo['controls'].Gender.markAsDirty();
      this.saveContact(group);
    }
  }

  removeContactPoint(index) {
    let groups = <FormArray>this.formGroup.controls.ContactPoints;
    let submitItem = {
      IDParent: null,
      Id: groups.controls[index]['controls'].Id.value,
    };
    if (submitItem.Id)
      this.pageProvider.save(submitItem).then((resp) => {
        this.items = this.items.filter((d) => d.Id != submitItem.Id);
        groups.removeAt(index);
        this.env.showTranslateMessage('Contacts deleted', 'success');
      });
  }

  saveContact(form: FormGroup) {
    if (form.controls.Name.dirty) {
      this.calcName(form);
    }
    this.saveChange2(form, null);
  }

  savePersonInfo(form: FormGroup) {
    this.saveChange2(form, null, this.personInfoProvider);
  }

  calcName(form: FormGroup) {
    let fullName = lib.personNameFormat(form.controls.Name.value);
    form.controls.Name.setValue(fullName);
    form.controls.PersonInfo['controls'].FullName.setValue(fullName);
    form.controls.PersonInfo['controls'].FullName.markAsDirty();
    let names = fullName.split(' ');
    if (names.length > 1) {
      form.controls.PersonInfo['controls'].FirstName.setValue(names[names.length - 1]);
      form.controls.PersonInfo['controls'].LastName.setValue(names[0]);

      form.controls.PersonInfo['controls'].FirstName.markAsDirty();
      form.controls.PersonInfo['controls'].LastName.markAsDirty();
    }
  }

  contactList$;
  contactListLoading = false;
  contactListInput$ = new Subject<string>();
  contactSearch() {
    this.contactListLoading = false;
    this.contactList$ = concat(
      of(this.items),
      this.contactListInput$.pipe(
        distinctUntilChanged(),
        tap(() => (this.contactListLoading = true)),
        switchMap((term) =>
          this.searchConnect({
            Take: 20,
            Skip: 0,
            IsPersonal: true,
            Keyword: term,
          }).pipe(
            catchError(() => of([])), // empty list on error
            tap(() => (this.contactListLoading = false)),
          ),
        ),
      ),
    );
  }

  searchConnect(query) {
    return this.pageProvider.commonService.connect('GET', ApiSetting.apiDomain('CRM/Contact'), query);
  }

  addContactLine(name) {
    return {
      IDParent: this.id,
      IsPersonal: true,
      Name: name,
      PersonInfo: { Gender: true },
    };
  }

  selectContact(i) {
    if (i) {
      if (this.items.findIndex((d) => d.Id == i.Id) == -1) {
        this.items.push(i);
        i.IDParent = this.id;
        this.addContactPoint(i, true);
      }
      i.disabled = true;
    }
  }
}
