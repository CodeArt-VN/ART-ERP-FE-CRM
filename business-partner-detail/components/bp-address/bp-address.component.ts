import { HttpClient } from '@angular/common/http';
import { Component, ChangeDetectorRef, Input, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormControl, FormArray } from '@angular/forms';
import { MapMarker } from '@angular/google-maps';
import { ActivatedRoute } from '@angular/router';
import { AlertController, LoadingController, NavController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { PageBase } from 'src/app/page-base';
import { EnvService } from 'src/app/services/core/env.service';
import { CRM_PartnerAddressProvider } from 'src/app/services/static/services.service';

@Component({
  selector: 'app-bp-address',
  templateUrl: './bp-address.component.html',
  styleUrls: ['./bp-address.component.scss'],
})
export class BpAddressComponent extends PageBase {
  @Input() canEdit;
  @Input() set config(value) {
    this.pageConfig = value;
    console.log(value);
  }
  @Input() set bpId(value) {
    this.query.IDPartner = value;
  }
  mapLoaded: Observable<boolean>;
  center: google.maps.LatLngLiteral = {
    lat: 11.0517262,
    lng: 106.8842023,
  };
  options = {
    scrollwheel: false,
    disableDoubleClickZoom: true,
    streetViewControl: false,
    mapTypeControl: false,
    controlSize: 30,
    zoom: 16,
    styles: [
      {
        featureType: 'poi',
        stylers: [
          {
            visibility: 'off',
          },
        ],
      },
      {
        featureType: 'transit',
        stylers: [
          {
            visibility: 'off',
          },
        ],
      },
    ],
  };
  markerOptions: google.maps.MarkerOptions = {
    draggable: true,
  };

  constructor(
    public pageProvider: CRM_PartnerAddressProvider,
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
      Addresses: this.formBuilder.array([]),
    });
    this.alwaysReturnProps.push('IDPartner');
    if (!this.env.isMapLoaded) {
      this.mapLoaded = httpClient
        .jsonp('https://maps.googleapis.com/maps/api/js?key=AIzaSyAtyM-Th784YwQUTquYa0WlFIj8C6RB2uM', 'callback')
        .pipe(
          map(() => {
            this.env.isMapLoaded = true;
            this.initMap();
            return true;
          }),
          catchError((err) => {
            console.log(err);
            return of(false);
          }),
        );
    } else {
      this.initMap();
    }
  }

  loadedData() {
    this.item = { Id: this.query.IDPartner };
    super.loadedData();
    this.setAddresses();
    this.pageConfig.canEdit = this.canEdit;
    if (!this.canEdit) this.formGroup?.disable();
  }

  setAddresses() {
    this.formGroup.controls.Addresses = this.formBuilder.array([]);
    if (this.items.length) {
      this.items.forEach((c) => {
        this.addAddress(c);
      });
    } else {
      this.addAddress({ IDPartner: this.query.IDPartner, Id: 0 });
    }
  }

  addAddress(address) {
    let groups = <FormArray>this.formGroup.controls.Addresses;
    let lat: number = +address.Lat;
    let long: number = +address.Long;

    let group = this.formBuilder.group({
      IDPartner: this.query.IDPartner,
      Id: address.Id,
      Country: address.Country,
      Province: address.Province,
      District: address.District,
      Ward: address.Ward,
      AddressLine1: [address.AddressLine1, Validators.required],
      AddressLine2: address.AddressLine2,
      ZipCode: address.ZipCode,
      Lat: lat,
      Long: long,
      Contact: [address.Contact, Validators.required],
      Phone1: [address.Phone1, Validators.required],
      Phone2: address.Phone2,
      Remark: address.Remark,
      Sort: address.Sort,
    });

    groups.push(group);
  }

  removeAddress(index) {
    this.alertCtrl
      .create({
        header: 'Xóa địa chỉ',
        //subHeader: '---',
        message: 'Bạn chắc muốn xóa địa chỉ này?',
        buttons: [
          {
            text: 'Không',
            role: 'cancel',
          },
          {
            text: 'Đồng ý xóa',
            cssClass: 'danger-btn',
            handler: () => {
              let groups = <FormArray>this.formGroup.controls.Addresses;
              let Ids = [];
              Ids.push({
                Id: groups.controls[index]['controls'].Id.value,
              });
              this.pageProvider.delete(Ids).then((resp) => {
                this.items = this.items.filter((d) => d.Id != Ids[0].Id);
                groups.removeAt(index);
                this.env.showTranslateMessage('Delete this address', 'success');
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

  initMap() {
    // navigator.geolocation.getCurrentPosition((position) => {
    //   this.center = {
    //     lat: position.coords.latitude,
    //     lng: position.coords.longitude,
    //   }
    // });
  }

  changeCoordinate(coordinate, form: FormGroup) {
    console.log(coordinate);

    form.controls.Lat.setValue(coordinate.Lat);
    form.controls.Long.setValue(coordinate.Long);
    form.controls.Lat.markAsDirty();
    form.controls.Long.markAsDirty();
    this.saveAddress(form);
  }
}
