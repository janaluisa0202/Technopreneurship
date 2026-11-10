import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { demoPlaces } from '../src/apps/commuter/data/locations';
import { sampleTrips } from '../src/apps/commuter/data/demo';
import { demoLocationSearch, finalizeLocation, findDemoTrip, hasAddressDetails, isJourneyLocations, isRecentLocations, manualPlace, matchesSavedLocation, samePlace, selectPlace } from '../src/apps/commuter/lib/locations';

const ust = demoPlaces.find(place => place.id === 'ust-frassati')!;
const north = demoPlaces.find(place => place.id === 'sm-north')!;

test('search matches names, partial streets, buildings, landmarks, barangays, municipalities, and cities', async () => {
  for (const [query, id] of [
    ['uSt', 'ust-frassati'], ['espa', 'ust-frassati'], ['Pier Giorgio', 'ust-frassati'],
    ['University of Santo Tomas', 'ust-frassati'], ['bagong pag', 'sm-north'],
    ['San Mateo', 'san-mateo-plaza'], ['paranaque', 'pitx'], ['Quezon City North', 'sm-north'],
  ]) assert.ok((await demoLocationSearch.search(query)).some(place => place.id === id), query);
  assert.deepEqual(await demoLocationSearch.search('nonexistent-987654'), []);
});

test('all existing supported demo journeys still resolve by place identity', () => {
  for (const trip of sampleTrips) {
    const from = selectPlace(demoPlaces.find(place => place.name === trip.from)!);
    const to = selectPlace(demoPlaces.find(place => place.name === trip.to)!);
    from.details.landmark = 'User-specific boarding point';
    assert.equal(findDemoTrip({ from, to })?.id, trip.id);
  }
});

test('custom addresses and additional demo places never acquire invented route estimates', () => {
  const custom = selectPlace({ ...manualPlace('123 Sample Lane, Manila'), name: ust.name });
  assert.equal(findDemoTrip({ from: finalizeLocation(custom), to: selectPlace(north) }), undefined);
  assert.equal(findDemoTrip({ from: selectPlace(demoPlaces[6]), to: selectPlace(north) }), undefined);
  assert.equal(findDemoTrip({ from: null, to: selectPlace(north) }), undefined);
});

test('only an exact manual catalog name or address resolves to a known place', () => {
  assert.equal(finalizeLocation(selectPlace(manualPlace('  UST FRASSATI (ESPANA)  '))).place.id, ust.id);
  assert.equal(finalizeLocation(selectPlace(manualPlace('UST'))).place.source, 'manual');
});

test('duplicate identity and normalized addresses are blocked, while distinct same-name places remain independent', () => {
  assert.ok(samePlace(ust, { ...ust }));
  assert.ok(samePlace(manualPlace('123 España St., Manila'), manualPlace('123 ESPANA ST MANILA')));
  assert.equal(samePlace({ ...manualPlace('123 Sample Lane'), name: 'Home' }, { ...manualPlace('456 Other Lane'), name: 'Home' }), false);
});

test('finalizing edits trims details without mutating confirmed state or provider records', () => {
  const confirmed = selectPlace(ust);
  const edited = finalizeLocation({ ...confirmed, details: { ...confirmed.details, landmark: '  Main gate  ', notes: '  Board near the stop.  ' } });
  assert.equal(edited.details.landmark, 'Main gate');
  assert.equal(edited.details.notes, 'Board near the stop.');
  assert.equal(confirmed.details.landmark, '');
  assert.equal(hasAddressDetails(confirmed), false);
  assert.equal(hasAddressDetails(edited), true);
  assert.equal(ust.landmark, 'University of Santo Tomas');
  assert.ok(matchesSavedLocation(edited, 'main gate'));
});

test('confirmed location data round-trips through JSON, with independent optional details and clearing', () => {
  const from = selectPlace(ust);
  const to = selectPlace(north);
  from.details.landmark = 'Main gate';
  to.details.notes = 'Annex entrance';
  const restored: unknown = JSON.parse(JSON.stringify({ from, to }));
  assert.ok(isJourneyLocations(restored));
  if (isJourneyLocations(restored)) {
    assert.equal(restored.from?.details.notes, '');
    assert.equal(restored.to?.details.notes, 'Annex entrance');
  }
  assert.ok(isJourneyLocations({ from: null, to }));
  assert.ok(isRecentLocations([from, to]));
});

test('malformed storage, unknown demo identities, and duplicate endpoints fail validation', () => {
  assert.equal(isJourneyLocations(null), false);
  assert.equal(isJourneyLocations({ from: {}, to: null }), false);
  assert.equal(isJourneyLocations({ from: selectPlace(ust), to: selectPlace(ust) }), false);
  assert.equal(isJourneyLocations({ from: selectPlace({ ...ust, id: 'unknown' }), to: null }), false);
  assert.equal(isRecentLocations([{ ...selectPlace(ust), details: { ...selectPlace(ust).details, unexpected: 42 } }]), false);
  assert.equal(isRecentLocations(Array.from({ length: 9 }, () => selectPlace(ust))), false);
});
