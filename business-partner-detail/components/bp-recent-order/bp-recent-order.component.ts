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
	selector: 'app-bp-recent-order',
	templateUrl: './bp-recent-order.component.html',
	styleUrls: ['./bp-recent-order.component.scss'],
	standalone: false,
})
export class BpRecentOrderComponent extends PageBase {
	@Input() canEdit;

	@Input() _LastSOs;

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
		public translate: TranslateService
	) {
		super();

	}
	preLoadData(event?: any): void {
		this.loadedData();
	}

	loadedData() {
		this.pageConfig.showSpinner = false;
	}

}
