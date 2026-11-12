import type { AdvisoryCategory, AdvisorySeverity, AnnouncementChannel, PromoType, SupportCategory } from '../types';

export const supportCategoryLabels: Record<SupportCategory, string> = {
  route: 'Route concern', fare: 'Fare concern', roadwatch: 'Road incident concern', queue: 'Queue concern',
  bug: 'Technical issue', general: 'General inquiry', other: 'Other',
};
export const promoTypeLabels: Record<PromoType, string> = {
  student: 'Student fare', 'route-discount': 'Route discount', partner: 'Partner business', seasonal: 'Seasonal / event',
};
export const incidentCategoryLabels: Record<AdvisoryCategory, string> = {
  traffic: 'Heavy traffic', closure: 'Road closure / diversion', flooding: 'Flooded road', transport: 'Transport service interruption', roadworks: 'Road works',
};
export const severityLabels: Record<AdvisorySeverity, string> = { low: 'Low', moderate: 'Moderate', high: 'High', critical: 'Critical' };
export const channelLabels: Record<AnnouncementChannel, string> = { 'para-alerts': 'Para Alerts', roadwatch: 'RoadWatch', promo: 'Promo notice', general: 'General' };
export const queueLevelLabels = { low: 'Low queue', mid: 'Moderate queue', high: 'Heavy queue' } as const;
