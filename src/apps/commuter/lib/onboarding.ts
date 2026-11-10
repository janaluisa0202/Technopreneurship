export const INTRODUCTION_KEY = 'sakaywise:introduction:v1';
export const introductionSlides = [
  { feature:'SMART ROUTES', title:'Find Your Best Commute', description:'Compare transportation routes based on travel time, fare, and waiting conditions.', icon:'route' },
  { feature:'FAREGUARD', title:'Know the Right Fare', description:'Check transportation fare estimates and applicable passenger discounts.', icon:'shield' },
  { feature:'QUEUESENSE', title:'Spend Less Time Waiting', description:'View commuter-reported terminal queue conditions before choosing a route.', icon:'users' },
  { feature:'ROADWATCH', title:'Stay Updated on the Road', description:'Check road closures, transport disruptions, and relevant travel advisories.', icon:'road' },
] as const;
export function hasCompletedIntroduction(storage:Pick<Storage,'getItem'>):boolean {
  try { const value:unknown=JSON.parse(storage.getItem(INTRODUCTION_KEY) || 'null');return typeof value==='object' && value!==null && 'version' in value && value.version===1 && 'completed' in value && value.completed===true; }
  catch { return false; }
}
export function completeIntroduction(storage:Pick<Storage,'setItem'>):boolean {
  try { storage.setItem(INTRODUCTION_KEY,JSON.stringify({version:1,completed:true}));return true; }
  catch { return false; }
}
