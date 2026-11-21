import { Component } from '@angular/core';
import { NavController, ModalController, AlertController, LoadingController, PopoverController } from '@ionic/angular';
import { Location } from '@angular/common';
import { PageBase } from 'src/app/page-base';
import { EnvService } from 'src/app/services/core/env.service';
import { CRM_ContactProvider, CRM_OpportunityProvider, CRM_PipelineProvider, CRM_PipelineStageProvider, HRM_StaffProvider } from 'src/app/services/static/services.service';
import { daysInStage, indexById, isOverdue, missingIds, opportunityStatus, sortStages, serviceTypeIcon } from './opportunity-list.util';

@Component({
	selector: 'app-opportunity',
	templateUrl: 'opportunity.page.html',
	styleUrls: ['opportunity.page.scss'],
	standalone: false,
})
export class OpportunityPage extends PageBase {
	pipelineList: any[] = [];
	stageList: any[] = [];
	/** Stage filter options: the stage name with its pipeline, because stage names repeat between pipelines. */
	stageFilterList: any[] = [];
	serviceTypeList: any[] = [];
	ownerList: any[] = [];
	statusFilterList = [
		{ Id: 'false', Name: 'Open' },
		{ Id: 'true', Name: 'Closed' },
	];

	opportunityStatus = opportunityStatus;
	daysInStage = daysInStage;
	isOverdue = isOverdue;

	private stageById: { [id: number]: any } = {};
	private pipelineById: { [id: number]: any } = {};
	private serviceTypeById: { [id: number]: any } = {};
	private ownerById: { [id: number]: any } = {};
	private contactById: { [id: number]: any } = {};
	private stagesByPipeline: { [id: number]: any[] } = {};

	constructor(
		public pageProvider: CRM_OpportunityProvider,
		public pipelineProvider: CRM_PipelineProvider,
		public stageProvider: CRM_PipelineStageProvider,
		public contactProvider: CRM_ContactProvider,
		public staffProvider: HRM_StaffProvider,
		public modalController: ModalController,
		public popoverCtrl: PopoverController,
		public alertCtrl: AlertController,
		public loadingController: LoadingController,
		public env: EnvService,
		public navCtrl: NavController,
		public location: Location
	) {
		super();
	}

	preLoadData(event?: any): void {
		this.pageConfig.sort = [{ Dimension: 'Id', Order: 'DESC' }];
		// Pipeline config scope (company -> child branches) is decided by the BE, not by the client
		Promise.all([
			this.pipelineProvider.read({ Take: 100 }),
			this.stageProvider.read({ Take: 500 }),
			this.env.getType('CRMServiceType'),
			this.staffProvider.read({ Take: 1000 }),
		])
			.then((values: any) => {
				this.pipelineList = values[0].data;
				this.stageList = values[1].data;
				this.serviceTypeList = values[2];
				this.ownerList = (values[3].data || []).map((s) => ({ Id: s.Id, Name: s.FullName || s.Name }));
				this.pipelineById = indexById(this.pipelineList);
				this.stageById = indexById(this.stageList);
				this.serviceTypeById = indexById(this.serviceTypeList);
				this.ownerById = indexById(this.ownerList);
				this.stagesByPipeline = {};
				// Status bar = every stage of the pipeline, in Sort order
				this.stageList.forEach((st) => (this.stagesByPipeline[st.IDPipeline] = (this.stagesByPipeline[st.IDPipeline] || []).concat(st)));
				Object.keys(this.stagesByPipeline).forEach((k) => (this.stagesByPipeline[k] = sortStages(this.stagesByPipeline[k])));
				this.stageFilterList = this.stageList.map((s) => ({ Id: s.Id, Name: s.Name + (this.pipelineName(s.IDPipeline) ? ' · ' + this.pipelineName(s.IDPipeline) : '') }));
				super.preLoadData(event);
			})
			.catch(() => super.preLoadData(event));
	}

	loadedData(event?: any) {
		this.resolveNames()
			.catch(() => {})
			.then(() => super.loadedData(event));
	}

	/** The list API returns ids only: load the missing customers, then put the customer, owner, service type icon, current stage and the stages of its pipeline in order (for the status bar) on each row. */
	private async resolveNames() {
		const ids = missingIds(this.items, 'IDContact', this.contactById);
		if (ids.length) {
			const result: any = await this.contactProvider.read({ Id: JSON.stringify(ids), Take: ids.length });
			Object.assign(this.contactById, indexById(result.data));
		}
		this.items.forEach((i) => {
			i._Customer = this.contactById[i.IDContact]?.Name || '';
			i._Owner = this.ownerById[i.IDOwner]?.Name || '';
			i._TypeIcon = serviceTypeIcon(this.serviceTypeById[i.IDType]);
			i._Stage = this.stageById[i.IDStage];
			i._Stages = this.stagesByPipeline[i.IDPipeline] || [];
		});
	}

	pipelineName(id: number): string {
		return this.pipelineById[id]?.Name || '';
	}

	serviceTypeName(id: number): string {
		return this.serviceTypeById[id]?.Name || '';
	}
}
