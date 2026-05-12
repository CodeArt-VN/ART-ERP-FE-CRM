import { ChangeDetectorRef, Component, Input } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AlertController, NavController, LoadingController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { EnvService } from 'src/app/services/core/env.service';
import { CRM_MembershipLoyaltyHistoryProvider } from 'src/app/services/static/services.service';

@Component({
	selector: 'app-bp-membership-loyalty-history',
	templateUrl: './bp-membership-loyalty-history.component.html',
	styleUrls: ['./bp-membership-loyalty-history.component.scss'],
	standalone: false,
})
export class BpMembershipLoyaltyHistoryComponent extends PageBase {
	@Input() membershipLoyalty = [];

	constructor(
		public pageProvider: CRM_MembershipLoyaltyHistoryProvider,
		public env: EnvService,
		public route: ActivatedRoute,
		public alertCtrl: AlertController,
		public navCtrl: NavController,
		public formBuilder: FormBuilder,
		public cdr: ChangeDetectorRef,
		public loadingController: LoadingController
	) {
		super();
	}

	loadData(event?: any, forceReload?: boolean): void {
		const ids = this.membershipLoyalty?.map((i) => i.Id) || [];
		if (!ids.length) {
			this.items = [];
			this.pageConfig.showSpinner = false;
			return;
		}
		this.query.IDMembershipLoyalty = ids;
		this.query.SortBy = ['PointDate_desc', 'Id_desc'];
		this.query.Take = 200;
		this.query.Skip = 0;
		super.loadData(event, forceReload);
	}

	loadedData(event?: any, ignoredFromGroup?: boolean): void {
		this.items = (this.items || []).map((i) => ({
			...i,
			_MembershipLoyalty: this.membershipLoyalty.find((m) => m.Id == i.IDMembershipLoyalty),
		}));
		this.pageConfig.showSpinner = false;
	}
}
