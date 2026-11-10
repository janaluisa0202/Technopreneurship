export type Tab = 'routes' | 'fares' | 'queues' | 'alerts';
export type Passenger = 'regular' | 'student' | 'senior' | 'pwd';
export type Priority = 'time' | 'wait' | 'cost' | 'transfers';
export type QueueLevel = 'low' | 'mid' | 'high';
export type FareMode = 'jeep' | 'bus' | 'uv';
export type Step = [instruction: string, detail: string];

export interface Trip {
  id: string;
  from: string;
  to: string;
  mode: string;
  via: string;
  minutes: [number, number];
  price: number;
  queue: QueueLevel;
  steps: Step[];
  alts: [name: string, price: number, rideMinutes: number][];
}
export interface QueueReport {
  id: string;
  place: string;
  where: string;
  level: QueueLevel;
  estimate: string;
  updated: string;
  progress: number;
  isLocal?: boolean;
  reportedAt?: string;
  segmentId?: string;
}
export interface SavedTrip {
  key: string;
  tripId: string;
  ix: number;
  from: string;
  to: string;
  name: string;
  price: number | null;
  passenger: Passenger;
  steps: Step[];
  savedAt: string;
  route?: import('./types/route').RouteItinerary;
}
export interface AlertPreferences {route: boolean; queue: boolean; price: boolean;}

export type LocationField = 'from' | 'to';

// Provider-owned place identity. User instructions belong in AddressDetails.
export interface Place {
  id: string;
  name: string;
  formattedAddress: string;
  source: 'demo' | 'manual';
  street?: string;
  building?: string;
  barangay?: string;
  city?: string;
  landmark?: string;
  latitude?: number;
  longitude?: number;
}
export interface AddressDetails {
  streetNumber: string;
  building: string;
  unit: string;
  street: string;
  barangay: string;
  city: string;
  landmark: string;
  notes: string;
}
export interface SelectedLocation { place: Place; details: AddressDetails; }
export interface JourneyLocations { from: SelectedLocation | null; to: SelectedLocation | null; }
export interface LocationSearchProvider { search: (query: string) => Promise<Place[]>; }

export type Sheet =
  | {type: 'location'; field: LocationField}
  | {type: 'saved'}
  | {type: 'saved-trip'; key: string}
  | {type: 'report'}
  | {type: 'route'; route: import('./types/route').RouteItinerary}
  | {type: 'advisory'; id: string}
  | null;
