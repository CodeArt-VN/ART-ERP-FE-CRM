import { Routes } from '@angular/router';
import { AuthGuard } from 'src/app/guards/app.guard';

export const CRMRoutes: Routes = [
    
    { path: 'contact-mobile', loadChildren: () => import('./outlet/outlet.module').then(m => m.OutletPageModule), canActivate: [AuthGuard] },
    { path: 'contact-mobile/:id', loadChildren: () => import('./outlet-detail/outlet-detail.module').then(m => m.OutletDetailPageModule), canActivate: [AuthGuard] },
    { path: 'outlet', loadChildren: () => import('./outlet/outlet.module').then(m => m.OutletPageModule), canActivate: [AuthGuard] },
    { path: 'outlet/:id', loadChildren: () => import('./outlet-detail/outlet-detail.module').then(m => m.OutletDetailPageModule), canActivate: [AuthGuard] },
  
    { path: 'attendance-booking', loadChildren: () => import('./attendance-booking/attendance-booking.module').then(m => m.AttendanceBookingPageModule), canActivate: [AuthGuard] },
    { path: 'attendance-booking/:id', loadChildren: () => import('./attendance-booking-detail/attendance-booking-detail.module').then(m => m.AttendanceBookingDetailPageModule), canActivate: [AuthGuard] },
  
    { path: 'business-partner', loadChildren: () => import('./business-partner/business-partner.module').then(m => m.BusinessPartnerPageModule), canActivate: [AuthGuard] },
    { path: 'business-partner/:id', loadChildren: () => import('./business-partner-detail/business-partner-detail.module').then(m => m.ContactDetailPageModule), canActivate: [AuthGuard] },
    { path: 'distributor', loadChildren: () => import('./business-partner/business-partner.module').then(m => m.BusinessPartnerPageModule), canActivate: [AuthGuard] },
    { path: 'distributor/:id', loadChildren: () => import('./business-partner-detail/business-partner-detail.module').then(m => m.ContactDetailPageModule), canActivate: [AuthGuard] },
    { path: 'storer', loadChildren: () => import('./business-partner/business-partner.module').then(m => m.BusinessPartnerPageModule), canActivate: [AuthGuard] },
    { path: 'storer/:id', loadChildren: () => import('./business-partner-detail/business-partner-detail.module').then(m => m.ContactDetailPageModule), canActivate: [AuthGuard] },
    { path: 'carrier', loadChildren: () => import('./business-partner/business-partner.module').then(m => m.BusinessPartnerPageModule), canActivate: [AuthGuard] },
    { path: 'carrier/:id', loadChildren: () => import('./business-partner-detail/business-partner-detail.module').then(m => m.ContactDetailPageModule), canActivate: [AuthGuard] },
  
    { path: 'customer', loadChildren: () => import('./business-partner/business-partner.module').then(m => m.BusinessPartnerPageModule), canActivate: [AuthGuard] },
    { path: 'customer/:id', loadChildren: () => import('./business-partner-detail/business-partner-detail.module').then(m => m.ContactDetailPageModule), canActivate: [AuthGuard] },
    { path: 'vendor', loadChildren: () => import('./business-partner/business-partner.module').then(m => m.BusinessPartnerPageModule), canActivate: [AuthGuard] },
    { path: 'vendor/:id', loadChildren: () => import('./business-partner-detail/business-partner-detail.module').then(m => m.ContactDetailPageModule), canActivate: [AuthGuard] },
  
    { path: 'mcp', loadChildren: () => import('./mcp/mcp.module').then(m => m.MCPPageModule), canActivate: [AuthGuard] },
    { path: 'mcp/:id', loadChildren: () => import('./mcp-detail/mcp-detail.module').then(m => m.MCPDetailPageModule), canActivate: [AuthGuard] },
  
];
