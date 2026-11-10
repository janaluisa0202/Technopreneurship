import { demoPlaces, demoRoutePlaces, sampleTrips } from '../services/demoCatalog';
import type { AddressDetails, JourneyLocations, LocationSearchProvider, Place, SelectedLocation } from '../types';

export const emptyAddressDetails = (): AddressDetails => ({
  streetNumber: '', building: '', unit: '', street: '', barangay: '', city: '', landmark: '', notes: '',
});

export function normalizeLocationText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
export function matchesLocation(place: Place, query: string): boolean {
  const text = normalizeLocationText([place.name, place.formattedAddress, place.street, place.building, place.barangay, place.city, place.landmark].filter(Boolean).join(' '));
  return normalizeLocationText(query).split(' ').every(token => text.includes(token));
}
export function matchesSavedLocation(location: SelectedLocation, query: string): boolean {
  return matchesLocation({ ...location.place, formattedAddress: `${location.place.formattedAddress} ${Object.values(location.details).join(' ')}` }, query);
}
export const demoLocationSearch: LocationSearchProvider = {
  async search(query) { return demoPlaces.filter(place => matchesLocation(place, query)); },
};
export function selectPlace(place: Place): SelectedLocation {
  return { place, details: emptyAddressDetails() };
}
export function manualPlace(address: string): Place {
  const formattedAddress = address.trim();
  return { id: `manual:${normalizeLocationText(formattedAddress)}`, name: formattedAddress, formattedAddress, source: 'manual' };
}
export function samePlace(first: Place, second: Place): boolean {
  return first.id === second.id ||
    normalizeLocationText(first.formattedAddress) === normalizeLocationText(second.formattedAddress);
}
export function hasAddressDetails(location: SelectedLocation): boolean {
  return Object.values(location.details).some(value => value.trim().length > 0);
}
export function finalizeLocation(location: SelectedLocation): SelectedLocation {
  const address = location.place.formattedAddress.trim();
  let place = { ...location.place, name: location.place.name.trim() || address, formattedAddress: address };
  if (place.source === 'manual') {
    // Exact manually typed catalog names resolve to their real local identity;
    // a mere partial match never grants access to demo transit estimates.
    const known = demoPlaces.find(candidate =>
      normalizeLocationText(candidate.name) === normalizeLocationText(address) ||
      normalizeLocationText(candidate.formattedAddress) === normalizeLocationText(address));
    place = known || { ...place, id: `manual:${normalizeLocationText(address)}` };
  }
  const details = { ...location.details };
  for (const key of Object.keys(details) as (keyof AddressDetails)[]) details[key] = details[key].trim();
  return { place, details };
}
export function findDemoTrip(journey: JourneyLocations) {
  const routeName = (location: SelectedLocation | null) => location?.place.source === 'demo'
    ? demoRoutePlaces.find(place => place.id === location.place.id)?.name : undefined;
  const from = routeName(journey.from);
  const to = routeName(journey.to);
  return from && to ? sampleTrips.find(trip => trip.from === from && trip.to === to) : undefined;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
export function isSelectedLocation(value: unknown): value is SelectedLocation {
  if (!isRecord(value) || !isRecord(value.place) || !isRecord(value.details)) return false;
  const place = value.place;
  if (!['id', 'name', 'formattedAddress'].every(key => typeof place[key] === 'string' && (place[key] as string).trim().length > 0)) return false;
  if (place.source !== 'demo' && place.source !== 'manual') return false;
  if (place.source === 'demo' && !demoPlaces.some(candidate => candidate.id === place.id)) return false;
  const details = value.details;
  return Object.keys(emptyAddressDetails()).every(key => typeof details[key] === 'string') && Object.values(details).every(value => typeof value === 'string');
}
export function isJourneyLocations(value: unknown): value is JourneyLocations {
  return isRecord(value) && (value.from === null || isSelectedLocation(value.from)) && (value.to === null || isSelectedLocation(value.to)) &&
    !(value.from && value.to && samePlace((value.from as SelectedLocation).place, (value.to as SelectedLocation).place));
}
export function isRecentLocations(value: unknown): value is SelectedLocation[] {
  return Array.isArray(value) && value.length <= 8 && value.every(isSelectedLocation);
}

export function swapJourneyLocations(journey:JourneyLocations):JourneyLocations {
  return {from:journey.to,to:journey.from};
}
