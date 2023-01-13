import { NgModule } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { ShareModule } from 'src/app/share.module';
import { NgSelectModule } from '@ng-select/ng-select';
import { NgOptionHighlightModule } from '@ng-select/ng-option-highlight';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BpPersonInfoComponent } from './bp-person-info/bp-person-info.component';
import { BpReferenceCodeComponent } from './bp-reference-code/bp-reference-code.component';
import { BpContactPointComponent } from './bp-contact-point/bp-contact-point.component';
import { BpStorerInfoComponent } from './bp-storer-info/bp-storer-info.component';
import { NgxMaskModule } from 'ngx-mask';
import { GoogleMapsModule } from '@angular/google-maps'
import { BpAddressComponent } from './bp-address/bp-address.component';
import { BpMapComponent } from './bp-map/bp-map.component';
import { BpOutletInfoComponent } from './bp-outlet-info/bp-outlet-info.component';
import { BPItemsComponent } from './bp-items/bp-items.component';
import { RouterModule } from '@angular/router';
import { MapCompsModule } from 'src/app/components/map-comps/map-comps.module';



@NgModule({
	imports: [IonicModule,
		CommonModule,
		ShareModule,
		RouterModule,
		NgSelectModule,
		NgOptionHighlightModule,
		FormsModule,
		MapCompsModule,
		ReactiveFormsModule,
		GoogleMapsModule,
		NgxMaskModule.forRoot(),
	],
	declarations: [
		BpPersonInfoComponent, 
		BpReferenceCodeComponent, 
		BpContactPointComponent,
		BpStorerInfoComponent,
		BpAddressComponent,
		BpMapComponent,
		BpOutletInfoComponent,
		BPItemsComponent,
	],
	exports: [
		BpPersonInfoComponent, 
		BpReferenceCodeComponent, 
		BpContactPointComponent,
		BpStorerInfoComponent,
		BpAddressComponent,
		BpMapComponent,
		BpOutletInfoComponent,
		BPItemsComponent
	],
})
export class BusinessPartnerComponentsModule { }
