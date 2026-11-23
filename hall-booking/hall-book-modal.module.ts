import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { ShareModule } from 'src/app/share.module';
import { HallBookModalPage } from './hall-book-modal.page';

@NgModule({
	imports: [CommonModule, FormsModule, ReactiveFormsModule, IonicModule, ShareModule],
	declarations: [HallBookModalPage],
	exports: [HallBookModalPage],
})
export class HallBookModalModule {}
