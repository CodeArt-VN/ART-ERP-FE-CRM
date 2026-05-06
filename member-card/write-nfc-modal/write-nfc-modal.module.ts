import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';

import { ShareModule } from 'src/app/share.module';
import { WriteNfcModalPage } from './write-nfc-modal.page';


@NgModule({
	imports: [IonicModule, CommonModule, FormsModule, ShareModule],
	declarations: [WriteNfcModalPage],
	exports: [WriteNfcModalPage],
})
export class WriteNfcModalPageModule {}
