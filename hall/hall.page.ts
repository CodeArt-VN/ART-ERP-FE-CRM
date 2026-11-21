import { Component, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { NavController, ModalController, AlertController, LoadingController, PopoverController } from '@ionic/angular';
import { Location } from '@angular/common';
import { PageBase } from 'src/app/page-base';
import { EnvService } from 'src/app/services/core/env.service';
import { CRM_HallProvider } from 'src/app/services/static/services.service';
import { HALL_FLOORS, HALL_KINDS, centerDivider, centerOptions, floorDivider, countLines, hallKindColor, hallKindIcon, primaryCapacity } from '../hall-detail/hall.util';

/** Catalogue of top-level halls. The lines of a hall are managed in the detail page (`hall/:id`, tab Lines). */
@Component({
	selector: 'app-hall',
	templateUrl: 'hall.page.html',
	styleUrls: ['hall.page.scss'],
	standalone: false,
})
export class HallPage extends PageBase {
	private translate = inject(TranslateService);
	centerList: any[] = [];
	kindList: { Code: string; Name: string }[] = HALL_KINDS.map((c) => ({ Code: c, Name: c }));
	floorList: { Code: string; Name: string }[] = HALL_FLOORS.map((f) => ({ Code: f, Name: f }));
	statusList: { Code: boolean; Name: string }[] = [
		{ Code: false, Name: 'Active' },
		{ Code: true, Name: 'Disabled' },
	];
	hallKindColor = hallKindColor;
	hallKindIcon = hallKindIcon;
	primaryCapacity = primaryCapacity;

	constructor(
		public pageProvider: CRM_HallProvider,
		public modalController: ModalController,
		public popoverCtrl: PopoverController,
		public alertCtrl: AlertController,
		public loadingController: LoadingController,
		public env: EnvService,
		public navCtrl: NavController,
		public location: Location
	) {
		super();
		// Center and floor are not shown as columns: dividers start each group (sort is Center, Floor, Sort).
		// Level 1 = center, level 2 = floor inside the center. Both go off when the list is sorted by another column.
		this.pageConfig.dividers = [
			{ fields: ['IDBranch'], dividerFn: (item, index, items) => centerDivider(item, index, items, this.env.branchList) },
			{ fields: ['Floor'], dividerFn: (item, index, items) => floorDivider(item, index, items, this.translate.instant('Floor')) },
		];
	}

	preLoadData(event?: any): void {
		// Center, then floor, then the hall's own order.
		this.pageConfig.sort = [
			{ Dimension: 'IDBranch', Order: 'ASC' },
			{ Dimension: 'Floor', Order: 'ASC' },
			{ Dimension: 'Sort', Order: 'ASC' },
		];
		// Top-level halls only: the lines are listed in the hall detail. (Plain key, so a hall saved in the detail also matches the list.)
		this.query.HallType = 'Hall';
		this.centerList = centerOptions(this.env.branchList);
		// ng-select shows the label as is, so translate the options before the table renders.
		this.buildOptionLists()
			.catch(() => {})
			.finally(() => super.preLoadData(event));
		// On a cold reload the language is applied after the page starts: rebuild the labels and the dividers once it is.
		this.subscriptions.push(
			this.translate.onLangChange.subscribe(() => {
				this.buildOptionLists().then(() => this.refresh());
			})
		);
	}

	private buildOptionLists(): Promise<void> {
		const word = (k: string) => this.env.translateResource(k) as Promise<string>;
		return Promise.all([Promise.all(HALL_KINDS.map(async (c) => ({ Code: c, Name: (await word(c)) || c }))), word('Floor'), word('Active'), word('Disabled')]).then(
			([kinds, floor, active, disabled]) => {
				this.kindList = kinds;
				this.floorList = HALL_FLOORS.map((f) => ({ Code: f, Name: `${floor || 'Floor'} ${f}` }));
				this.statusList = [
					{ Code: false, Name: active || 'Active' },
					{ Code: true, Name: disabled || 'Disabled' },
				];
			}
		);
	}

	loadedData(event?: any, ignoredFromGroup?: boolean): void {
		super.loadedData(event, ignoredFromGroup);
		this.loadLineCounts();
	}

	/** Back from the detail page the number of lines may have changed. */
	ionViewWillEnter() {
		super.ionViewWillEnter();
		if (this.items?.length) this.loadLineCounts(true);
	}

	/** Search by name or code (the API's Keyword matches both). */
	searchKeyword() {
		this.refresh();
	}

	/** One extra request for the lines of the listed halls; the generated API has no count field. */
	async loadLineCounts(force = false) {
		const halls = (this.items || []).filter((h) => h?.Id && (force || h._lineCount === undefined));
		if (!halls.length) return;
		const branches = Array.from(new Set(halls.map((h) => h.IDBranch)));
		const q = {
			IDParent: JSON.stringify(halls.map((h) => h.Id)),
			IDBranch: JSON.stringify(branches),
			HallType_eq: 'Line',
			IsDisabled: 'skipped',
			Take: 5000,
		};
		try {
			const res: any = await this.pageProvider.read(q, true);
			const counts = countLines(res.data || []);
			halls.forEach((h) => (h._lineCount = counts[h.Id] || 0));
			this.items = [...this.items];
		} catch {
			// the list still works without the counts
		}
	}

	/** A hall that still has lines must lose them first (the DB would leave them orphaned). */
	delete(publishEventCode = this.pageConfig.pageName) {
		if ((this.selectedItems || []).some((h) => h._lineCount > 0)) {
			this.env.showMessage('This hall still has lines. Delete its lines first.', 'warning', null, 6000, true);
			return;
		}
		super.delete(publishEventCode);
	}
}
