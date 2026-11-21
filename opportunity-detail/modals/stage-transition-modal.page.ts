import { ChangeDetectorRef, Component, Input } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AlertController, LoadingController, ModalController, NavController } from '@ionic/angular';

import { PageBase } from 'src/app/page-base';
import { EnvService } from 'src/app/services/core/env.service';
import { ApiSetting } from 'src/app/services/static/api-setting';
import { CRM_OpportunityProvider } from 'src/app/services/static/services.service';
import { MoveStageResponse, PlanStage } from '../pipeline.models';
import { gateMessages, isTaskFinished, missingRequiredFields } from '../pipeline-view.util';

@Component({
	selector: 'app-stage-transition-modal',
	templateUrl: './stage-transition-modal.page.html',
	standalone: false,
})
export class StageTransitionModalPage extends PageBase {
	@Input() opportunity: any;
	@Input() currentStage: PlanStage;
	@Input() targetStage: PlanStage;
	@Input() lostReasonList: any[] = [];
	@Input() canForceMoveStage = false;

	busy = false;
	missingFields: string[] = [];
	pendingTasks: string[] = [];
	serverGateMessages: string[] = [];

	constructor(
		public pageProvider: CRM_OpportunityProvider,
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
		this.formGroup = formBuilder.group({
			IDLostReason: [null],
			LostRemark: [''],
			Note: [''],
			Force: [false],
		});
	}

	ngOnInit() {
		this.item = this.opportunity || {};
		if (!this.isLostTarget) {
			this.missingFields = missingRequiredFields(this.targetStage, this.opportunity);
			this.pendingTasks = (this.currentStage?.Tasks || []).filter((t) => t.IsRequired && !isTaskFinished(t)).map((t) => t.Name);
		}
		if (this.opportunity?.IDLostReason) {
			this.formGroup.patchValue({ IDLostReason: this.opportunity.IDLostReason, LostRemark: this.opportunity.LostRemark || '' });
		}
		this.pageConfig.showSpinner = false;
	}

	get isLostTarget(): boolean {
		return this.targetStage?.Outcome === 'Lost' || !!this.targetStage?.IsRequireLostReason;
	}

	get isLostReasonMissing(): boolean {
		if (!this.targetStage?.IsRequireLostReason) return false;
		const v = this.formGroup.getRawValue();
		return !v.IDLostReason && !(v.LostRemark || '').trim();
	}

	get hasGateWarnings(): boolean {
		return this.missingFields.length > 0 || this.pendingTasks.length > 0 || this.serverGateMessages.length > 0;
	}

	async confirmMove() {
		if (!this.opportunity?.Id || !this.targetStage?.Id || this.busy || this.isLostReasonMissing) return;
		const v = this.formGroup.getRawValue();
		this.busy = true;
		this.serverGateMessages = [];
		try {
			const res = (await this.pageProvider.commonService
				.connect('POST', ApiSetting.apiDomain('CRM/Opportunity/MoveStage'), {
					IDOpportunity: this.opportunity.Id,
					IDStage: this.targetStage.Id,
					IDLostReason: v.IDLostReason || null,
					LostRemark: (v.LostRemark || '').trim() || null,
					Note: (v.Note || '').trim() || null,
					Force: !!v.Force,
				})
				.toPromise()) as unknown as MoveStageResponse;

			if (!res?.Success) {
				this.serverGateMessages = gateMessages(res?.Errors, res?.MissingFields, res?.PendingTasks);
				this.busy = false;
				this.cdr.detectChanges();
				return;
			}
			this.env.showMessage('Saving completed!', 'success');
			await this.modalController.dismiss(res, 'saved');
		} catch (err: any) {
			const e = err?.error;
			this.serverGateMessages = [typeof e === 'string' ? e : e?.Message || e?.ExceptionMessage || 'Cannot move to this stage'];
		}
		this.busy = false;
		this.cdr.detectChanges();
	}
}
