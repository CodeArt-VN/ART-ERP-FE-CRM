import { Component, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormControl, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { NavController, LoadingController, AlertController, ModalController } from '@ionic/angular';

import { PageBase } from 'src/app/page-base';
import { EnvService } from 'src/app/services/core/env.service';
import { BRA_BranchProvider, CRM_PipelineProvider, CRM_PipelineRuleProvider, CRM_PipelineStageProvider, CRM_PipelineStageTaskProvider } from 'src/app/services/static/services.service';
import {
	CUSTOMER_HISTORIES,
	CUSTOMER_TYPES,
	POST_SIGN_LABELS,
	POST_SIGN_MODES,
	TASK_ICONS,
	buildStageRows,
	outcomeColor,
	newRule,
	newStage,
	newTask,
	RULE_CHIP_ICONS,
	ruleConditions,
	ruleScore,
	tasksOfStage,
} from './pipeline-config.util';
import { PipelineStageModalPage } from './modals/pipeline-stage-modal.page';
import { PipelineTaskModalPage } from './modals/pipeline-task-modal.page';
import { PipelineReorderModalPage } from './modals/pipeline-reorder-modal.page';
import { PipelineRuleModalPage } from './modals/pipeline-rule-modal.page';

@Component({
	selector: 'app-pipeline-detail',
	templateUrl: './pipeline-detail.page.html',
	styleUrls: ['./pipeline-detail.page.scss'],
	standalone: false,
})
export class PipelineDetailPage extends PageBase {
	serviceTypeList: any[] = [];
	stages: any[] = [];
	tasks: any[] = [];
	rules: any[] = [];

	postSignModes: { Code: string; Name: string }[] = POST_SIGN_MODES.map((c) => ({ Code: c, Name: POST_SIGN_LABELS[c] }));
	segmentView = 's1';
	customerTypes = CUSTOMER_TYPES;
	customerHistories = CUSTOMER_HISTORIES;
	tasksOfStage = tasksOfStage;
	taskIcons = TASK_ICONS;
	outcomeColor = outcomeColor;
	/** Stages (roots) and their tasks (children) as the flat tree rows of the stage table. */
	stageRows: any[] = [];

	constructor(
		public pageProvider: CRM_PipelineProvider,
		public stageProvider: CRM_PipelineStageProvider,
		public taskProvider: CRM_PipelineStageTaskProvider,
		public ruleProvider: CRM_PipelineRuleProvider,
		public branchProvider: BRA_BranchProvider,
		public env: EnvService,
		public navCtrl: NavController,
		public route: ActivatedRoute,
		public alertCtrl: AlertController,
		public modalController: ModalController,
		public formBuilder: FormBuilder,
		public cdr: ChangeDetectorRef,
		public loadingController: LoadingController
	) {
		super();
		this.pageConfig.isDetailPage = true;

		this.formGroup = formBuilder.group({
			IDBranch: [this.env.selectedBranch],
			Id: new FormControl({ value: '', disabled: true }),
			Name: ['', Validators.required],
			Remark: [''],
			Icon: [''],
			Color: [''],
			IsDefault: [false],
			PostSignMode: ['Track'],
			Sort: [''],
			IsDisabled: new FormControl({ value: '', disabled: true }),
			IsDeleted: new FormControl({ value: '', disabled: true }),
			CreatedBy: new FormControl({ value: '', disabled: true }),
			CreatedDate: new FormControl({ value: '', disabled: true }),
			ModifiedBy: new FormControl({ value: '', disabled: true }),
			ModifiedDate: new FormControl({ value: '', disabled: true }),
		});
	}

	segmentChanged(ev: any) {
		this.segmentView = ev.detail.value;
	}

	preLoadData(event?: any): void {
		// ng-select shows the label as is, so translate the options before the form renders.
		const modes = Promise.all(
			POST_SIGN_MODES.map(async (c) => ({ Code: c, Name: ((await this.env.translateResource(POST_SIGN_LABELS[c])) as string) || POST_SIGN_LABELS[c] }))
		).then((list) => (this.postSignModes = list));

		Promise.all([this.env.getType('CRMServiceType'), modes])
			.then(([list]: any) => {
				this.serviceTypeList = list;
				super.preLoadData(event);
			})
			.catch(() => super.preLoadData(event));
	}

	loadedData(event?: any, ignoredFromGroup?: boolean): void {
		super.loadedData(event, ignoredFromGroup);
		if (this.item?.Id) {
			this.loadChildren();
		} else {
			// Stages and rules need a saved pipeline, so a new one opens on the general tab.
			this.segmentView = 's3';
		}
	}

	async saveChange() {
		await super.saveChange2();
	}

	/** After a save reload the children. */
	savedChange(savedItem = null, form = this.formGroup) {
		super.savedChange(savedItem, form);
		if (savedItem?.Id && form === this.formGroup) {
			this.item = { ...this.item, ...savedItem };
			this.loadChildren();
		}
	}

	// ---------------------------------------------------------------- children

	private async loadChildren() {
		// stages, tasks and rules belong to the pipeline, whatever branch is selected
		const q = { IDPipeline: this.item.Id, Take: 1000, Sort: JSON.stringify([{ Dimension: 'Sort', Order: 'ASC' }]) };
		try {
			const [stages, tasks, rules]: any = await Promise.all([this.stageProvider.read(q), this.taskProvider.read(q), this.ruleProvider.read(q)]);
			this.stages = (stages.data || []).sort((a, b) => (a.Sort || 0) - (b.Sort || 0));
			this.tasks = tasks.data || [];
			// the backend picks the best score, so the list shows the strongest rule first
			this.rules = (rules.data || [])
				.map((r) => ({ ...r, _score: ruleScore(r), _chips: ruleConditions(r, this.serviceTypeName) }))
				.sort((a, b) => b._score - a._score || (a.Sort || 0) - (b.Sort || 0));
			// the previous rows carry which stage is open, so the tree keeps its state across a reload
			this.stageRows = (await this.buildFlatTree(buildStageRows(this.stages, this.tasks), this.stageRows, this.isAllRowOpened)) as any[];
		} catch (err) {
			this.env.showMessage(this.errorText(err), 'danger');
		}
	}

	private errorText(err: any): string {
		return err?.error?.Message || err?.message || String(err);
	}

	// ---------------------------------------------------------------- stages and tasks (popups)

	/** cssClass sizes the popup (see common.scss). Opens as the same sheet as the sale-order3 customer picker. */
	private async openModal(component: any, componentProps: any, cssClass: string) {
		// Same sheet behaviour as the sale-order3 customer picker / cart: 3 snap points, cycle on handle tap.
		const modal = await this.modalController.create({
			component,
			componentProps,
			cssClass,
			breakpoints: [0, 0.25, 0.5, 0.75, 1],
			initialBreakpoint: 0.75,
			handleBehavior: 'cycle',
			expandToScroll: false,
		});
		await modal.present();
		// Reload on any close: a task reorder inside the stage popup can change the tree even when the popup is cancelled.
		await modal.onWillDismiss();
		await this.loadChildren();
	}

	/** A click on a row of the stage table edits that stage or task. */
	editRow(row: any) {
		return row.Kind === 'task' ? this.editTask(row.Stage, row.Task) : this.editStage(row.Stage);
	}

	addStage() {
		this.editStage(newStage(this.item, this.stages));
	}

	editStage(s: any) {
		return this.openModal(PipelineStageModalPage, { item: { ...s }, pipeline: this.item, tasks: tasksOfStage(this.tasks, s.Id), stages: this.stages, allTasks: this.tasks }, 'form-1column');
	}

	addTask(s: any) {
		this.editTask(s, newTask(s, tasksOfStage(this.tasks, s.Id)));
	}

	editTask(s: any, t: any) {
		return this.openModal(PipelineTaskModalPage, { item: { ...t }, pipeline: this.item, stage: s, stages: this.stages, tasks: this.tasks }, 'form-1column');
	}

	reorderStages() {
		return this.openModal(PipelineReorderModalPage, { rows: this.stages, kind: 'stage', pipeline: this.item }, 'form-1column');
	}

	reorderTasks(s: any) {
		return this.openModal(PipelineReorderModalPage, { rows: tasksOfStage(this.tasks, s.Id), kind: 'task', pipeline: this.item, stage: s }, 'form-1column');
	}

	// ---------------------------------------------------------------- rules

	ruleChipIcons = RULE_CHIP_ICONS;

	/** Display name of a CRMServiceType on the rule chips. */
	serviceTypeName = (id: number): string => this.serviceTypeList.find((o) => o.Id === id)?.Name || '';

	addRule() {
		return this.editRule(newRule(this.item, this.rules));
	}

	editRule(r: any) {
		const serviceTypes = this.serviceTypeList.map((o) => ({ Id: o.Id, Name: o.Name }));
		return this.openModal(PipelineRuleModalPage, { item: { ...r }, pipeline: this.item, serviceTypes }, 'form-1column');
	}
}
