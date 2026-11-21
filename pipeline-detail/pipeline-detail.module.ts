import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Routes, RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { ShareModule } from 'src/app/share.module';
import { PipelineDetailPage } from './pipeline-detail.page';
import { PipelineStageModalPage } from './modals/pipeline-stage-modal.page';
import { PipelineTaskModalPage } from './modals/pipeline-task-modal.page';
import { PipelineReorderModalPage } from './modals/pipeline-reorder-modal.page';
import { PipelineRuleModalPage } from './modals/pipeline-rule-modal.page';

const routes: Routes = [
	{
		path: '',
		component: PipelineDetailPage,
	},
];

@NgModule({
	imports: [CommonModule, FormsModule, IonicModule, ReactiveFormsModule, ShareModule, RouterModule.forChild(routes)],
	declarations: [PipelineDetailPage, PipelineStageModalPage, PipelineTaskModalPage, PipelineReorderModalPage, PipelineRuleModalPage],
})
export class PipelineDetailPageModule {}
