import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { ShareModule } from 'src/app/share.module';
import { MergeContactModalComponent } from './merge-contact-modal.component';

@NgModule({
	imports: [IonicModule, CommonModule, FormsModule, ShareModule],
	declarations: [MergeContactModalComponent],
	exports: [MergeContactModalComponent],
})
export class MergeContactModalModule {}
