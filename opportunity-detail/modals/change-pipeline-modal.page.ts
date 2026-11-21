import { ChangeDetectorRef, Component, Input } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AlertController, LoadingController, ModalController, NavController } from '@ionic/angular';

import { PageBase } from 'src/app/page-base';
import { EnvService } from 'src/app/services/core/env.service';
import { ApiSetting } from 'src/app/services/static/api-setting';
import { CRM_PipelineProvider } from 'src/app/services/static/services.service';
import { TASK_ICONS, buildStageRowsFromPlan, outcomeColor } from '../../pipeline-detail/pipeline-config.util';
import { PipelinePlan, QualifyResponse } from '../pipeline.models';
import { PipelineOption, buildPipelineOptions } from '../pipeline-view.util';

/** Lists the pipelines a deal can use, previews the picked one and applies it through CRM/Pipeline/Qualify (Apply = true). */
@Component({
	selector: 'app-change-pipeline-modal',
	templateUrl: './change-pipeline-modal.page.html',
	styleUrls: ['./change-pipeline-modal.page.scss'],
	standalone: false,
})
export class ChangePipelineModalPage extends PageBase {
	@Input() opportunity: any;
	/** Pipelines from CRM_PipelineProvider (Id, Name). */
	@Input() pipelineList: any[] = [];
	/** Qualify body of the deal (service type, guests, event date...) without IDPipeline / Apply. */
	@Input() qualifyBody: any = {};

	options: PipelineOption[] = [];
	plans: Record<number, PipelinePlan | null> = {};
	selectedId: number = null;
	currentId: number = null;
	previewPlan: PipelinePlan = null;
	/** Same tree rows as pipeline-detail edit (read-only: no edit / sort / add). */
	stageRows: any[] = [];
	warnings: string[] = [];
	loading = true;
	busy = false;
	errorMessage = '';

	taskIcons = TASK_ICONS;
	outcomeColor = outcomeColor;

	constructor(
		public pageProvider: CRM_PipelineProvider,
		public env: EnvService,
		public navCtrl: NavController,
		public route: ActivatedRoute,
		public modalController: ModalController,
		public alertCtrl: AlertController,
		public formBuilder: FormBuilder,
		public cdr: ChangeDetectorRef,
		public loadingController: LoadingController
	) {
		super();
		this.pageConfig.isDetailPage = true;
	}

	async ngOnInit() {
		this.item = this.opportunity || {};
		this.currentId = this.opportunity?.IDPipeline || null;
		this.selectedId = this.currentId;
		this.pageConfig.showSpinner = false;
		await this.load();
	}

	private api<T>(method: 'GET' | 'POST', path: string, data?: any): Promise<T> {
		return this.pageProvider.commonService.connect(method, ApiSetting.apiDomain(path), data).toPromise() as unknown as Promise<T>;
	}

	private async load() {
		this.loading = true;
		const qualifyPromise = this.api<QualifyResponse>('POST', 'CRM/Pipeline/Qualify', { ...this.qualifyBody, IDPipeline: null, Apply: false }).catch(() => null);
		const planPromises = (this.pipelineList || []).map((p) =>
			this.api<PipelinePlan>('GET', 'CRM/Pipeline/Plan', { idPipeline: p.Id })
				.then((plan) => [p.Id, plan] as [number, PipelinePlan])
				.catch(() => [p.Id, null] as [number, PipelinePlan])
		);
		const [qualify, planRows] = await Promise.all([qualifyPromise, Promise.all(planPromises)]);
		planRows.forEach(([id, plan]) => (this.plans[id] = plan));
		this.warnings = qualify?.Warnings || [];
		this.options = buildPipelineOptions(this.pipelineList, qualify?.Candidates || [], this.plans, this.currentId, qualify?.Recommended?.IDPipeline ?? null);
		this.previewPlan = this.plans[this.selectedId] || null;
		await this.refreshStageRows();
		this.loading = false;
		this.cdr.detectChanges();
	}

	async select(option: PipelineOption) {
		this.selectedId = option.IDPipeline;
		this.previewPlan = this.plans[option.IDPipeline] || null;
		this.errorMessage = '';
		await this.refreshStageRows();
		this.cdr.detectChanges();
	}

	private async refreshStageRows() {
		const raw = buildStageRowsFromPlan(this.previewPlan);
		this.isAllRowOpened = true;
		this.stageRows = (await this.buildFlatTree(raw, [], true)) as any[];
	}

	trackByPipeline(_i: number, o: PipelineOption) {
		return o.IDPipeline;
	}

	/** Selected row in the picker — Icon / Color match the pipeline list page. */
	get selectedOption(): PipelineOption | null {
		return this.options.find((o) => o.IDPipeline === this.selectedId) || null;
	}

	get canConfirm(): boolean {
		return !this.busy && !this.loading && !!this.selectedId && this.selectedId !== this.currentId;
	}

	async confirm() {
		if (!this.canConfirm) return;
		this.busy = true;
		this.errorMessage = '';
		try {
			const res = await this.api<QualifyResponse>('POST', 'CRM/Pipeline/Qualify', { ...this.qualifyBody, IDPipeline: this.selectedId, Apply: true });
			if (res?.Applied) {
				this.env.showMessage('Saving completed!', 'success');
				await this.modalController.dismiss(res, 'saved');
				return;
			}
			this.errorMessage = (res?.Warnings || []).join('\n') || 'Cannot save, please try again';
		} catch (err: any) {
			const e = err?.error;
			this.errorMessage = typeof e === 'string' ? e : e?.Message || e?.ExceptionMessage || 'Cannot save, please try again';
		}
		this.busy = false;
		this.cdr.detectChanges();
	}
}
