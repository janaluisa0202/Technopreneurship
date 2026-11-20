import { catalogPlaces, legacyTrips } from '../services/catalog';
import { analyzeRouteRecommendations } from './routeEngine';
import { advisoryMatchesRoute } from './advisoryImpact';
import { advisoryState } from './roadwatchService';
import type { Passenger, QueueReport, SavedTrip } from '../types';
import type { RoadAdvisory, RoadWatchPreferences } from '../types/roadwatch';

export function watchedPair(value:string|null):{originId:string;destinationId:string}|undefined {
  if(!value)return undefined;
  const [originId,destinationId]=value.split(':');
  if(catalogPlaces.some(place=>place.id===originId) && catalogPlaces.some(place=>place.id===destinationId))return {originId,destinationId};
  const legacy=legacyTrips.find(trip=>trip.id===value);
  const from=catalogPlaces.find(place=>place.name===legacy?.from),to=catalogPlaces.find(place=>place.name===legacy?.to);
  return from && to?{originId:from.id,destinationId:to.id}:undefined;
}
export function personalAdvisoryMatches(advisories:RoadAdvisory[],watch:string|null,saved:SavedTrip[],preferences:RoadWatchPreferences,passenger:Passenger,reports:QueueReport[],now:number){
  const routesFor=(value:string|null)=>{
    const pair=watchedPair(value);
    return pair?analyzeRouteRecommendations({...pair,passenger,priority:'time'},reports,now).baselineRoutes:[];
  };
  const watchRoutes=routesFor(watch);
  // Legacy guides have no segment snapshot. Keep them readable, but do not
  // claim a precise saved-route match until they are resaved in the new format.
  const savedRoutes=preferences.savedTrips?saved.flatMap(guide=>guide.route?[guide.route]:[]):[];
  const active=advisories.filter(item=>advisoryState(item,now).applicable && preferences[item.category]);
  const watchedIds=new Set(active.filter(item=>watchRoutes.some(route=>advisoryMatchesRoute(item,route))).map(item=>item.id));
  const savedIds=new Set(active.filter(item=>savedRoutes.some(route=>advisoryMatchesRoute(item,route))).map(item=>item.id));
  return {watchedIds,savedIds,badgeCount:new Set([...watchedIds,...savedIds]).size};
}
