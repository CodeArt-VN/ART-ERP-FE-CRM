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
    // { path: 'storer', loadChildren: () => import('./business-partner/business-partner.module').then(m => m.BusinessPartnerPageModule), canActivate: [AuthGuard] },
    // { path: 'storer/:id', loadChildren: () => import('./business-partner-detail/business-partner-detail.module').then(m => m.ContactDetailPageModule), canActivate: [AuthGuard] },
    { path: 'carrier', loadChildren: () => import('./business-partner/business-partner.module').then(m => m.BusinessPartnerPageModule), canActivate: [AuthGuard] },
    { path: 'carrier/:id', loadChildren: () => import('./business-partner-detail/business-partner-detail.module').then(m => m.ContactDetailPageModule), canActivate: [AuthGuard] },
  
    { path: 'customer', loadChildren: () => import('./business-partner/business-partner.module').then(m => m.BusinessPartnerPageModule), canActivate: [AuthGuard] },
    { path: 'customer/:id', loadChildren: () => import('./business-partner-detail/business-partner-detail.module').then(m => m.ContactDetailPageModule), canActivate: [AuthGuard] },
    { path: 'vendor', loadChildren: () => import('./business-partner/business-partner.module').then(m => m.BusinessPartnerPageModule), canActivate: [AuthGuard] },
    { path: 'vendor/:id', loadChildren: () => import('./business-partner-detail/business-partner-detail.module').then(m => m.ContactDetailPageModule), canActivate: [AuthGuard] },
  
    { path: 'mcp', loadChildren: () => import('./mcp/mcp.module').then(m => m.MCPPageModule), canActivate: [AuthGuard] },
    { path: 'mcp/:id', loadChildren: () => import('./mcp-detail/mcp-detail.module').then(m => m.MCPDetailPageModule), canActivate: [AuthGuard] },


     { path: 'lead', loadChildren: () => import('./lead/lead.module').then(m => m.LeadPageModule), canActivate: [AuthGuard] },
    { path: 'lead/:id', loadChildren: () => import('./lead-detail/lead-detail.module').then(m => m.LeadDetailPageModule), canActivate: [AuthGuard] },

    { path: 'campaign', loadChildren: () => import('./campaign/campaign.module').then(m => m.CampaignPageModule), canActivate: [AuthGuard] },
    { path: 'campaign/:id', loadChildren: () => import('./campaign-detail/campaign-detail.module').then(m => m.CampaignDetailPageModule), canActivate: [AuthGuard] },
  
     { path: 'brand', loadChildren: () => import('./brand/brand.module').then(m => m.BrandPageModule), canActivate: [AuthGuard] },
    { path: 'brand/:id', loadChildren: () => import('./brand-detail/brand-detail.module').then(m => m.BrandDetailPageModule), canActivate: [AuthGuard] },

     { path: 'level-policy', loadChildren: () => import('./level-policy/level-policy.module').then(m => m.LevelPolicyPageModule), canActivate: [AuthGuard] },
    { path: 'level-policy/:id', loadChildren: () => import('./level-policy-detail/level-policy-detail.module').then(m => m.LevelPolicyDetailPageModule), canActivate: [AuthGuard] },
  
     { path: 'benefit-policy', loadChildren: () => import('./benefit-policy/benefit-policy.module').then(m => m.BenefitPolicyPageModule), canActivate: [AuthGuard] },
    { path: 'benefit-policy/:id', loadChildren: () => import('./benefit-policy-detail/benefit-policy-detail.module').then(m => m.BenefitPolicyDetailPageModule), canActivate: [AuthGuard] },

    { path: 'loyalty-policy', loadChildren: () => import('./loyalty-policy/loyalty-policy.module').then(m => m.LoyaltyPolicyPageModule), canActivate: [AuthGuard] },
    { path: 'loyalty-policy/:id', loadChildren: () => import('./loyalty-policy-detail/loyalty-policy-detail.module').then(m => m.LoyaltyPolicyDetailPageModule), canActivate: [AuthGuard] },
  

     { path: 'membership-loyalty', loadChildren: () => import('./membership-loyalty/membership-loyalty.module').then(m => m.MembershipLoyaltyPageModule), canActivate: [AuthGuard] },
    { path: 'membership-loyalty/:id', loadChildren: () => import('./membership-loyalty-detail/membership-loyalty-detail.module').then(m => m.MembershipLoyaltyDetailPageModule), canActivate: [AuthGuard] },

     { path: 'reward-category', loadChildren: () => import('./reward-category/reward-category.module').then(m => m.RewardCategoryPageModule), canActivate: [AuthGuard] },
    { path: 'reward-category/:id', loadChildren: () => import('./reward-category-detail/reward-category-detail.module').then(m => m.RewardCategoryDetailPageModule), canActivate: [AuthGuard] },

     { path: 'reward', loadChildren: () => import('./reward/reward.module').then(m => m.RewardPageModule), canActivate: [AuthGuard] },
    { path: 'reward/:id', loadChildren: () => import('./reward-detail/reward-detail.module').then(m => m.RewardDetailPageModule), canActivate: [AuthGuard] },
];
