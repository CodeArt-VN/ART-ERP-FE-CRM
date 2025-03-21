import { Component, ChangeDetectorRef, Input, Output, EventEmitter, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormControl, FormArray } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AlertController, LoadingController, NavController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { EnvService } from 'src/app/services/core/env.service';
import { PROD_ItemInVendorProvider, WMS_ItemProvider } from 'src/app/services/static/services.service';

import { concat, of, Subject } from 'rxjs';
import { catchError, distinctUntilChanged, mergeMap, switchMap, tap } from 'rxjs/operators';

@Component({
	selector: 'app-bp-items',
	templateUrl: './bp-items.component.html',
	styleUrls: ['./bp-items.component.scss'],
	standalone: false,
})
export class BPItemsComponent extends PageBase {
	@ViewChild('importfile') importfile: any;
	@Input() canEdit;
	@Input() idPriceList;
	@Input() set bpId(value) {
		this.id = value;
		this.query.IDVendor = this.id;
	}
	AcceptFile = '.xlsx';
	constructor(
		public pageProvider: PROD_ItemInVendorProvider,
		public itemProvider: WMS_ItemProvider,
		public env: EnvService,
		public route: ActivatedRoute,
		public alertCtrl: AlertController,
		public navCtrl: NavController,
		public formBuilder: FormBuilder,
		public cdr: ChangeDetectorRef,
		public loadingController: LoadingController
	) {
		super();
		this.formGroup = formBuilder.group({
			Id: new FormControl({ value: '', disabled: true }),
			Items: this.formBuilder.array([]),
		});
		this.query.IgnoredBranch = true;
		this.query.IsPersonal = true;
		this.pageConfig.isForceCreate = true;
	}

	loadedData() {
		this.items.forEach((i) => {
			i.disabled = true;
		});
		this.formGroup.controls.Items = this.formBuilder.array([]);
		this.item = { Id: this.id };
		super.loadedData();
		this.setItems();
		this.pageConfig.canEdit = this.canEdit;
		if (!this.canEdit) this.formGroup?.disable();
		this.itemList$ = concat(of(this.items), of([]));
		this.itemSearch();
	}

	setItems() {
		this.items.forEach((c) => {
			this.addItem(c);
		});
	}

	addItem(it, doSave = false) {
		let groups = <FormArray>this.formGroup.controls.Items;
		let group = this.formBuilder.group({
			IDVendor: this.id,
			Id: it.Id,
			_Item: it._Item,
			IDParent: it.IDParent,

			Name: it.Name,
			Price: [],
		});

		groups.push(group);
		if (doSave) {
			group.controls.IDParent.markAsDirty();
			group.controls.Name.markAsDirty();
			// group.controls.IsPersonal.markAsDirty();
			// group.controls.PersonInfo['controls'].WorkPhone.markAsDirty();
			// group.controls.PersonInfo['controls'].Gender.markAsDirty();
		}
	}

	removeItem(index) {
		let groups = <FormArray>this.formGroup.controls.Items;
		let submitItem = {
			IDParent: null,
			Id: groups.controls[index]['controls'].Id.value,
		};
		if (submitItem.Id)
			this.pageProvider.save(submitItem).then((resp) => {
				this.items = this.items.filter((d) => d.Id != submitItem.Id);
				groups.removeAt(index);
				this.env.showMessage('Contacts deleted', 'success');
			});
	}

	itemList$;
	itemListLoading = false;
	itemListInput$ = new Subject<string>();
	itemListSelected = [];

	itemSearch() {
		this.itemListLoading = false;
		this.itemList$ = concat(
			of(this.itemListSelected),
			this.itemListInput$.pipe(
				distinctUntilChanged(),
				tap(() => (this.itemListLoading = true)),
				switchMap((term) =>
					this.itemProvider.search({ Take: 20, Skip: 0, Term: term }).pipe(
						catchError(() => of([])), // empty list on error
						tap(() => (this.itemListLoading = false))
					)
				)
			)
		);
	}

	onClickImport() {
		this.importfile.nativeElement.value = '';
		this.importfile.nativeElement.click();
	}
	importFileChange(event) {
		const formData: FormData = new FormData();
		formData.append('fileKey', event.target.files[0], event.target.files[0].name);
		this.env
			.showLoading(
				'Please wait for a few moments',
				this.pageProvider.commonService.connect('UPLOAD', 'PROD/ItemInVendor/ImportItemInVendor/' + this.id, formData).toPromise()
			)
			.then((resp: any) => {
				this.refresh();
				if (resp.ErrorList && resp.ErrorList.length) {
					let message = '';
					for (let i = 0; i < resp.ErrorList.length && i <= 5; i++)
						if (i == 5) message += '<br> Còn nữa...';
						else {
							const e = resp.ErrorList[i];
							message += '<br> ' + e.Id + '. Tại dòng ' + e.Line + ': ' + e.Message;
						}
					this.env
						.showPrompt(
							{
								code: 'Có {{value}} lỗi khi import: {{value1}}',
								value: { value: resp.ErrorList.length, value1: message },
							},
							'Bạn có muốn xem lại các mục bị lỗi?',
							'Có lỗi import dữ liệu'
						)
						.then((_) => {
							this.downloadURLContent(resp.FileUrl);
						})
						.catch((e) => {});
				} else {
					this.env.showMessage('Import completed!', 'success');
				}
			})
			.catch((err) => {
				if (err.statusText == 'Conflict') {
					// var contentDispositionHeader = err.headers.get('Content-Disposition');
					// var result = contentDispositionHeader.split(';')[1].trim().split('=')[1];
					// this.downloadContent(result.replace(/"/g, ''),err._body);
					this.downloadURLContent(err._body);
				}
			});
	}
}
