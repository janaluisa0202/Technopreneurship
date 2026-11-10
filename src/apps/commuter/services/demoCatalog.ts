// Single explicit demo-data boundary. Presentation imports this module instead
// of reaching into individual fixture files. This is not a live-data fallback.
export { demoPlaces, demoRoutePlaces } from '../data/locations';
export { transportNetwork, popularJourneys } from '../data/transportNetwork';
export { sampleTrips, demoQueues } from '../data/demo';
export { sampleFareTables, sampleDistanceProfiles } from '../data/fares';
export { roadWatchDemoProvider } from '../data/roadwatchDemoData';
// Existing report-form choices, centralized with the other demo catalog data.
export const queueReportTerminals=['UST España','SM North EDSA','PITX','One Ayala','Pasay Rotonda','MOA Terminal'] as const;
