import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BusinessPartnerPage } from './business-partner.page';
import { ShareModule } from 'src/app/share.module';
import { MergeContactModalModule } from './merge-contact-modal/merge-contact-modal.module';

@NgModule({
	imports: [
		IonicModule,
		CommonModule,
		FormsModule,
		ShareModule,
		MergeContactModalModule,
		RouterModule.forChild([{ path: '', component: BusinessPartnerPage }]),
	],
	declarations: [BusinessPartnerPage],
})
export class BusinessPartnerPageModule {}
