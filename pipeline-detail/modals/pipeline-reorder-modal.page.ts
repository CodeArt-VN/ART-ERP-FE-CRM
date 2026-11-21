import { ChangeDetectorRef, Component, Input } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AlertController, LoadingController, ModalController, NavController } from '@ionic/angular';

import { PageBase } from 'src/app/page-base';
import { EnvService } from 'src/app/services/core/env.service';
import { CRM_PipelineStageProvider, CRM_PipelineStageTaskProvider } from 'src/app/services/static/services.service';
import { changedSortRows, renumberRows, toPayload } from '../pipeline-config.util';

/** Popup to drag stages (or the tasks of one stage) into a new order. Dismisses with role `saved`. */
@Component({
	selector: 'app-pipeline-reorder-modal',
	templateUrl: './pipeline-reorder-modal.page.html',
	standalone: false,
})
export class PipelineReorderModalPage extends PageBase {
	/** Rows to reorder, already sorted. The popup works on a copy. */
	@Input() rows: any[] = [];
	@Input() kind: 'stage' | 'task' = 'stage';
	@Input() pipeline: { Id?: number };
	@Input() stage: { Id?: number };

	list: any[] = [];
	changed: any[] = [];
	private before: { Id: number; Sort: number }[] = [];

	constructor(
		public pageProvider: CRM_PipelineStageProvider,
		public taskProvider: CRM_PipelineStageTaskProvider,
		public env: EnvService,
		public navCtrl: NavController,
		public route: ActivatedRoute,
		public modalController: ModalController,
		public alertCtrl: AlertController,
		public cdr: ChangeDetectorRef,
		public loadingController: LoadingController
	) {
		super();
	}

	// A popup has no route data to load, so skip the PageBase page bootstrap.
	ngOnInit() {
		this.list = JSON.parse(JSON.stringify(this.rows || []));
		this.before = this.list.map((r) => ({ Id: r.Id, Sort: r.Sort }));
		this.pageConfig.showSpinner = false;
	}

	onReorder(sorted: any[]) {
		this.list = renumberRows(sorted);
		this.changed = changedSortRows(this.list, this.before);
	}

	async saveChange() {
		const provider: any = this.kind === 'task' ? this.taskProvider : this.pageProvider;
		try {
			for (const row of this.changed) {
				await provider.save(toPayload(row));
			}
			this.env.showMessage('Saving completed!', 'success');
			await this.modalController.dismiss(null, 'saved');
		} catch (err: any) {
			this.env.showMessage(err?.error?.Message || err?.message || String(err), 'danger');
		}
	}
}
