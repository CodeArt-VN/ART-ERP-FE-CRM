import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Routes, RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { ShareModule } from 'src/app/share.module';
import { BusinessPartnerDetailPage } from './business-partner-detail.page';
import { FileUploadModule } from 'ng2-file-upload';
import { BusinessPartnerComponentsModule } from './components/business-partner-components.module';
import { MapCompsModule } from 'src/app/components/map-comps/map-comps.module';

const routes: Routes = [
  {
    path: '',
    component: BusinessPartnerDetailPage
  }
];

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ReactiveFormsModule,
    BusinessPartnerComponentsModule,
    MapCompsModule,
    FileUploadModule,
    ShareModule,
    RouterModule.forChild(routes)
  ],
  declarations: [BusinessPartnerDetailPage]
})
export class ContactDetailPageModule { }
