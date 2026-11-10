import type { Place, QueueLevel, QueueReport, Trip, FareMode } from '../types';
import type { FareTable, DistanceFareProfile, TransportNetwork, TransportSegment } from '../types/route';
import type { RoadWatchProvider } from '../types/roadwatch';
import type { SupportService } from '../types/support';
export type DataProvenance='illustrative-demo'|'verified-source'|'community-unverified';
export interface DataResult<T> {data:T;provenance:DataProvenance;sourceName:string;retrievedAt:string;updatedAt?:string;}
export interface ReadOptions {signal?:AbortSignal;}
export interface JourneyPair {originId:string;destinationId:string;}
export interface RouteCatalog {places:Place[];popularJourneys:JourneyPair[];legacyTrips:Trip[];}
export interface RouteInformation {serviceId:string;segments:TransportSegment[];}
export interface FareMatrices {segmentFares:Record<string,FareTable>;distanceProfiles:Record<FareMode,DistanceFareProfile>;}
export interface TransportNetworkService {getNetwork:(options?:ReadOptions)=>Promise<DataResult<TransportNetwork>>;}
export interface RouteInformationService {
  getCatalog:(options?:ReadOptions)=>Promise<DataResult<RouteCatalog>>;
  getRouteInformation:(serviceId:string,options?:ReadOptions)=>Promise<DataResult<RouteInformation|null>>;
}
export interface FareMatrixService {getMatrices:(options?:ReadOptions)=>Promise<DataResult<FareMatrices>>;}
export interface QueueSubmission {terminal:string;level:QueueLevel;details?:string;requestId:string;}
export interface QueueReportService {
  getReports:(options?:ReadOptions)=>Promise<DataResult<QueueReport[]>>;
  submitReport:(input:QueueSubmission)=>Promise<DataResult<QueueReport>>;
}
export interface CommuterDataServices {
  mode:'local-demo'|'remote';network:TransportNetworkService;routes:RouteInformationService;fares:FareMatrixService;
  queues:QueueReportService;roadwatch:RoadWatchProvider;support:SupportService;
}
export type DataErrorCode='unavailable'|'invalid-input'|'storage';
export class DataAccessError extends Error {constructor(public code:DataErrorCode){super(code);}}
