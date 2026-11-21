import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Routes, RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { ShareModule } from 'src/app/share.module';
import { OpportunityDetailPage } from './opportunity-detail.page';
import { StageTransitionModalPage } from './modals/stage-transition-modal.page';
import { ChangePipelineModalPage } from './modals/change-pipeline-modal.page';
import { CrmQuotationModalPage } from './modals/crm-quotation-modal.page';
import { CrmContractModalPage } from './modals/crm-contract-modal.page';
import { ActivityModalPage } from './modals/activity-modal.page';

const routes: Routes = [
	{
		path: '',
		component: OpportunityDetailPage,
	},
];

@NgModule({
	imports: [CommonModule, FormsModule, IonicModule, ReactiveFormsModule, ShareModule, RouterModule.forChild(routes)],
	declarations: [OpportunityDetailPage, StageTransitionModalPage, ChangePipelineModalPage, CrmQuotationModalPage, CrmContractModalPage, ActivityModalPage],
})
export class OpportunityDetailPageModule {}
