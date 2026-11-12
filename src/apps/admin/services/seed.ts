import type { AdminState } from '../types';

/** Demo-only starter data. Every name, number and report below is fictional. */
export function createSeedState(now = Date.now()): AdminState {
  const at = (minutes: number) => new Date(now + minutes * 60000).toISOString();
  const day = (offset: number) => {
    const d = new Date(now + offset * 86400000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  return {
    version: 2,
    promos: [
      { id: 'promo-1', title: 'Student fare weekdays', description: 'Verified students get a discounted fare on participating jeepney and UV Express routes from Monday to Friday.', type: 'student', startDate: day(-20), endDate: day(40), appliesTo: 'Jeepney / UV Express · UST – España area', status: 'active', createdBy: 'Admin Demo', createdAt: at(-28800), updatedAt: at(-2880) },
      { id: 'promo-2', title: 'Weekend rail + bus transfer discount', description: 'Reduced transfer cost when pairing LRT-1 with a participating bus service on Saturdays and Sundays.', type: 'route-discount', startDate: day(-5), endDate: day(25), appliesTo: 'LRT-1 + bus · Pasay Rotonda', status: 'active', createdBy: 'Ops Moderator', createdAt: at(-7200), updatedAt: at(-7200) },
      { id: 'promo-3', title: 'Partner café stamp card', description: 'Show your SakayWise trip screen to a partner café near One Ayala to earn a stamp.', type: 'partner', startDate: day(3), endDate: day(60), appliesTo: 'One Ayala terminal area', status: 'inactive', createdBy: 'Admin Demo', createdAt: at(-4300), updatedAt: at(-4300) },
      { id: 'promo-4', title: 'Back-to-school commute week', description: 'Seasonal announcement of discounted student passes during the first school week.', type: 'seasonal', startDate: day(-60), endDate: day(-30), appliesTo: 'All routes', status: 'active', createdBy: 'Admin Demo', createdAt: at(-90000), updatedAt: at(-90000) },
    ],
    incidents: [
      { id: 'inc-1', title: 'Flooding near España boarding area', description: 'Water is reported along the España jeepney boarding segment. Expect slower travel and possible skipped stops.', category: 'flooding', severity: 'high', status: 'active', areaName: 'España Boulevard, Manila', suggestedAction: 'Consider the UV Express alternative and verify conditions before boarding.', startsAt: at(-180), endsAt: at(240), postedAt: at(-170), updatedAt: at(-35), postedBy: 'Ops Moderator' },
      { id: 'inc-2', title: 'Heavy traffic toward Ayala', description: 'Slow-moving traffic on the EDSA southbound approach to Ayala.', category: 'traffic', severity: 'moderate', status: 'active', areaName: 'EDSA – Ayala', suggestedAction: 'Add 10–15 minutes to bus trips.', startsAt: at(-90), endsAt: at(120), postedAt: at(-80), updatedAt: at(-80), postedBy: 'Admin Demo' },
      { id: 'inc-3', title: 'Road works on Taft Avenue', description: 'Lane reductions planned this weekend near the Pasay Rotonda connection.', category: 'roadworks', severity: 'low', status: 'scheduled', areaName: 'Taft Avenue, Pasay', suggestedAction: '', startsAt: at(2880), endsAt: at(4300), postedAt: at(-600), updatedAt: at(-600), postedBy: 'Admin Demo' },
      { id: 'inc-4', title: 'MRT-3 service delay cleared', description: 'Earlier delay between Taft and Ayala has been cleared.', category: 'transport', severity: 'moderate', status: 'resolved', areaName: 'MRT-3 Taft – Ayala', suggestedAction: '', startsAt: at(-2000), endsAt: at(-1800), postedAt: at(-1990), updatedAt: at(-1750), postedBy: 'Ops Moderator' },
    ],
    messages: [
      { id: 'dm-1', audience: 'all', recipientLabel: 'All users', purpose: 'announcement', subject: 'Welcome to SakayWise', body: 'Thanks for using SakayWise. Tell us how we can make your commute easier through the Help Center.', sentAt: at(-4000), sentBy: 'Admin Demo', delivery: 'saved-demo' },
      { id: 'dm-2', audience: 'route', recipientLabel: 'UST Frassati → SM North', purpose: 'advisory', subject: 'Flooding near España', body: 'Flooding is reported near the España boarding area. Please check RoadWatch before leaving.', sentAt: at(-160), sentBy: 'Ops Moderator', delivery: 'saved-demo' },
    ],
    queueReports: [
      { id: 'qr-1', terminal: 'One Ayala, Makati', level: 'high', details: 'Line reaches the stairs.', reportedAt: at(-8), reporterId: 'guest-91ab', status: 'pending' },
      { id: 'qr-2', terminal: 'PITX, Parañaque', level: 'low', details: '', reportedAt: at(-14), reporterId: 'guest-33cd', status: 'pending' },
      { id: 'qr-3', terminal: 'UST Frassati (España)', level: 'mid', details: 'About 15 people, moving steadily.', reportedAt: at(-22), reporterId: 'guest-5e10', status: 'approved', reviewedBy: 'Ops Moderator', reviewedAt: at(-18) },
      { id: 'qr-4', terminal: 'SM Mall of Asia', level: 'high', details: 'asdfgh test test', reportedAt: at(-50), reporterId: 'guest-0001', status: 'pending' },
      { id: 'qr-5', terminal: 'Pasay Rotonda', level: 'low', details: 'No line at the platform entrance.', reportedAt: at(-190), reporterId: 'guest-77ef', status: 'approved', reviewedBy: 'Admin Demo', reviewedAt: at(-185) },
      { id: 'qr-6', terminal: 'SM North EDSA / Annex', level: 'high', details: 'Buy followers at example.invalid', reportedAt: at(-400), reporterId: 'guest-bad9', status: 'spam', reviewedBy: 'Admin Demo', reviewedAt: at(-395) },
    ],
    announcements: [
      { id: 'ann-1', title: 'Traffic advisory near España', body: 'Expect delays around España Boulevard until evening. Check RoadWatch for alternative routes.', channel: 'roadwatch', status: 'published', createdBy: 'Ops Moderator', createdAt: at(-170), publishedAt: at(-165), updatedAt: at(-165) },
      { id: 'ann-2', title: 'New promo available this week', body: 'Student fare weekdays is live on selected routes. See Promos for details.', channel: 'promo', status: 'published', createdBy: 'Admin Demo', createdAt: at(-1500), publishedAt: at(-1490), updatedAt: at(-1490) },
      { id: 'ann-3', title: 'Heavy queue at One Ayala terminal', body: 'Draft: waiting for confirmation from queue reports before publishing.', channel: 'para-alerts', status: 'draft', createdBy: 'Ops Moderator', createdAt: at(-6), updatedAt: at(-6) },
    ],
    activity: [
      { id: 'act-1', at: at(-35), adminId: 'adm-2', adminName: 'Ops Moderator', area: 'incident', action: 'Edited incident', target: 'Flooding near España boarding area' },
      { id: 'act-2', at: at(-95), adminId: 'adm-2', adminName: 'Ops Moderator', area: 'support', action: 'Replied to commuter', target: 'Carlo · Queue reports' },
      { id: 'act-3', at: at(-165), adminId: 'adm-2', adminName: 'Ops Moderator', area: 'announcement', action: 'Published announcement', target: 'Traffic advisory near España' },
      { id: 'act-4', at: at(-395), adminId: 'adm-1', adminName: 'Admin Demo', area: 'queue', action: 'Marked report as spam', target: 'SM North EDSA / Annex' },
      { id: 'act-5', at: at(-2880), adminId: 'adm-1', adminName: 'Admin Demo', area: 'promo', action: 'Edited promo', target: 'Student fare weekdays' },
    ],
  };
}
