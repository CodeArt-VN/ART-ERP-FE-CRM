import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Routes, RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { ShareModule } from 'src/app/share.module';
import { OutletDetailPage } from './outlet-detail.page';
import { FileUploadModule } from 'ng2-file-upload';
import { NgSelectModule } from '@ng-select/ng-select';
import { NgOptionHighlightModule } from '@ng-select/ng-option-highlight';
import { NgxMaskModule } from 'ngx-mask';
import { BpPersonInfoComponent } from '../business-partner-detail/components/bp-person-info/bp-person-info.component';
import { BpOutletInfoComponent } from '../business-partner-detail/components/bp-outlet-info/bp-outlet-info.component';
import { BpAddressComponent } from '../business-partner-detail/components/bp-address/bp-address.component';
import { MapCompsModule } from 'src/app/components/map-comps/map-comps.module';
import { BusinessPartnerComponentsModule } from '../business-partner-detail/components/business-partner-components.module';

const routes: Routes = [
  {
    path: '',
    component: OutletDetailPage
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
    NgOptionHighlightModule,
    ShareModule,
    MapCompsModule,
    BusinessPartnerComponentsModule,
    NgxMaskModule.forRoot(),
    RouterModule.forChild(routes)
  ],
  declarations: [OutletDetailPage]
})
export class OutletDetailPageModule { }
