import { demoPlaces, popularJourneys, sampleTrips, transportNetwork, sampleDistanceProfiles, demoQueues, queueReportTerminals } from './demoCatalog';
import { queueEstimate, queueProgress } from '../lib/commute';
import type { QueueReport } from '../types';
import type { DataResult, FareMatrixService, ReadOptions, RouteInformationService, TransportNetworkService, QueueReportService } from './contracts';
import { DataAccessError } from './contracts';
const result=<T>(data:T,options?:ReadOptions):DataResult<T>=>{options?.signal?.throwIfAborted();return {data:structuredClone(data),provenance:'illustrative-demo',sourceName:'SakayWise local demonstration',retrievedAt:new Date().toISOString()};};
// Implementations use the same canonical graph/fares as the existing engine.
// Supplying environment variables does NOT switch these adapters to live mode.
export const demoNetworkService:TransportNetworkService={async getNetwork(options){return result(transportNetwork,options);}};
export const demoRouteInformationService:RouteInformationService={
  async getCatalog(options){return result({places:demoPlaces,popularJourneys,legacyTrips:sampleTrips},options);},
  async getRouteInformation(serviceId,options){const segments=transportNetwork.segments.filter(segment=>segment.serviceId===serviceId);return result(segments.length?{serviceId,segments}:null,options);},
};
export const demoFareMatrixService:FareMatrixService={async getMatrices(options){return result({segmentFares:Object.fromEntries(transportNetwork.segments.map(segment=>[segment.id,segment.fares])),distanceProfiles:sampleDistanceProfiles},options);}};
export interface LocalQueueRepository {list:()=>QueueReport[];save:(report:QueueReport)=>void;}
export function createDemoQueueService(repository:LocalQueueRepository,clock=()=>Date.now()):QueueReportService {
  return {
    async getReports(options){return result([...repository.list(),...demoQueues].filter((item,index,list)=>list.findIndex(other=>other.place===item.place)===index),options);},
    async submitReport(input){
      const terminals=new Set<string>([...queueReportTerminals,...transportNetwork.segments.flatMap(segment=>segment.queue?[segment.queue.terminal]:[])]);
      if(!terminals.has(input.terminal) || !['low','mid','high'].includes(input.level) || !input.requestId || input.requestId.length>100 || (input.details!==undefined && typeof input.details!=='string'))throw new DataAccessError('invalid-input');
      const id=`local-${input.requestId}`;const existing=repository.list().find(item=>item.id===id);if(existing)return result(existing);
      const report:QueueReport={id,place:input.terminal,where:input.details?.trim().slice(0,150)||'Community-submitted local demo',level:input.level,estimate:queueEstimate(input.level),updated:'Your local report',reportedAt:new Date(clock()).toISOString(),progress:queueProgress(input.level),isLocal:true};
      try{repository.save(report);}catch{throw new DataAccessError('storage');}
      return result(report);
    },
  };
}
