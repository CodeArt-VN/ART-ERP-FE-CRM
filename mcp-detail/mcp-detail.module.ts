import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Routes, RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { ShareModule } from 'src/app/share.module';
import { MCPDetailPage } from './mcp-detail.page';
import { FileUploadModule } from 'ng2-file-upload';
import { MCPCustomerPickerModalPage } from '../mcp-customer-picker-modal/mcp-customer-picker-modal.page';
import { MapCompsModule } from '../../../components/map-comps/map-comps.module';

const routes: Routes = [
  {
    path: '',
    component: MCPDetailPage
  }
];

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ReactiveFormsModule,
    FileUploadModule,
    MapCompsModule,
    ShareModule,
    RouterModule.forChild(routes)
  ],
  declarations: [MCPDetailPage, MCPCustomerPickerModalPage]
})
export class MCPDetailPageModule { }
