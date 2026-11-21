import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Routes, RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { ShareModule } from 'src/app/share.module';
import { HallDetailPage } from './hall-detail.page';
import { HallLineModalPage } from './modals/hall-line-modal.page';

const routes: Routes = [
	{
		path: '',
		component: HallDetailPage,
	},
];

@NgModule({
	imports: [CommonModule, FormsModule, IonicModule, ReactiveFormsModule, ShareModule, RouterModule.forChild(routes)],
	declarations: [HallDetailPage, HallLineModalPage],
})
export class HallDetailPageModule {}
