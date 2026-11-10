import { locations } from './demo';
import type { Place } from '../types';

// Illustrative search records only. Addresses and landmarks are not verified
// boarding points, geocoded results, or a live places directory.
export const demoPlaces: Place[] = [
  { id: 'ust-frassati', name: locations[0], source: 'demo', formattedAddress: 'España Boulevard, Sampaloc, Manila', street: 'España Boulevard', barangay: 'Sampaloc', city: 'Manila', building: 'UST Blessed Pier Giorgio Frassati Building', landmark: 'University of Santo Tomas' },
  { id: 'sm-north', name: locations[1], source: 'demo', formattedAddress: 'North Avenue corner EDSA, Bagong Pag-asa, Quezon City', street: 'North Avenue, EDSA', barangay: 'Bagong Pag-asa', city: 'Quezon City', building: 'SM North EDSA Annex', landmark: 'The Annex entrance' },
  { id: 'pasay-rotonda', name: locations[2], source: 'demo', formattedAddress: 'EDSA corner Taft Avenue, Pasay City', street: 'EDSA, Taft Avenue', city: 'Pasay City', landmark: 'MRT Taft Avenue Station' },
  { id: 'one-ayala', name: locations[3], source: 'demo', formattedAddress: 'Ayala Avenue corner EDSA, San Lorenzo, Makati City', street: 'Ayala Avenue, EDSA', barangay: 'San Lorenzo', city: 'Makati City', building: 'One Ayala', landmark: 'Ayala MRT Station' },
  { id: 'pitx', name: locations[4], source: 'demo', formattedAddress: 'Kennedy Road, Tambo, Parañaque City', street: 'Kennedy Road', barangay: 'Tambo', city: 'Parañaque City', building: 'Parañaque Integrated Terminal Exchange', landmark: 'PITX terminal' },
  { id: 'sm-moa', name: locations[5], source: 'demo', formattedAddress: 'Seaside Boulevard, Bay City, Pasay City', street: 'Seaside Boulevard', barangay: 'Bay City', city: 'Pasay City', building: 'SM Mall of Asia', landmark: 'MOA Globe, transport terminal' },
  { id: 'gateway-cubao', name: 'Gateway Mall, Cubao', source: 'demo', formattedAddress: 'General Roxas Avenue, Socorro, Cubao, Quezon City', street: 'General Roxas Avenue', barangay: 'Socorro', city: 'Quezon City', building: 'Gateway Mall', landmark: 'Araneta City, LRT-2 Cubao' },
  { id: 'manila-city-hall', name: 'Manila City Hall', source: 'demo', formattedAddress: 'Padre Burgos Avenue, Ermita, Manila', street: 'Padre Burgos Avenue', barangay: 'Ermita', city: 'Manila', building: 'Manila City Hall', landmark: 'Bonifacio and the Katipunan monument' },
  { id: 'quezon-circle', name: 'Quezon Memorial Circle', source: 'demo', formattedAddress: 'Elliptical Road, Diliman, Quezon City', street: 'Elliptical Road', barangay: 'Diliman', city: 'Quezon City', landmark: 'Quezon Memorial Shrine' },
  { id: 'marikina-sports', name: 'Marikina Sports Center', source: 'demo', formattedAddress: 'Sumulong Highway, Santo Niño, Marikina City', street: 'Sumulong Highway', barangay: 'Santo Niño', city: 'Marikina City', building: 'Marikina Sports Center', landmark: 'Marikina City Hall' },
  { id: 'antipolo-cathedral', name: 'Antipolo Cathedral', source: 'demo', formattedAddress: 'P. Oliveros Street, San Roque, Antipolo City, Rizal', street: 'P. Oliveros Street', barangay: 'San Roque', city: 'Antipolo City', landmark: 'Our Lady of Peace and Good Voyage' },
  { id: 'san-mateo-plaza', name: 'San Mateo Municipal Plaza', source: 'demo', formattedAddress: 'General Luna Avenue, Guitnang Bayan, San Mateo, Rizal', street: 'General Luna Avenue', barangay: 'Guitnang Bayan', city: 'San Mateo', landmark: 'Municipal hall' },
];

// Explicit allowlist: adding a searchable demo place does not create transit data.
export const demoRoutePlaces = demoPlaces.slice(0, locations.length);
