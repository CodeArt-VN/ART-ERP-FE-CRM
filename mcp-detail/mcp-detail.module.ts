import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Routes, RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { ShareModule } from 'src/app/share.module';
import { MCPDetailPage } from './mcp-detail.page';
import { FileUploadModule } from 'ng2-file-upload';
import { NgxMaskModule } from 'ngx-mask';
import { NgSelectModule } from '@ng-select/ng-select';
import { NgOptionHighlightModule } from '@ng-select/ng-option-highlight';
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
    NgSelectModule,
    MapCompsModule,
    NgOptionHighlightModule,
    ShareModule,
    NgxMaskModule.forRoot(),
    RouterModule.forChild(routes)
  ],
  declarations: [MCPDetailPage, MCPCustomerPickerModalPage]
})
export class MCPDetailPageModule { }
