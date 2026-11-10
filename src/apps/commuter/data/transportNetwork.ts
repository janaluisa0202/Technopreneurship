import { demoPlaces } from './locations';
import { sampleFareTables as fares } from './fares';
import type { FareTable, TransportMode, TransportNetwork, TransportSegment } from '../types/route';

// FICTIONAL DEMO CONNECTIONS. These are explicit training scenarios, not
// verified vehicle routes, boarding bays, schedules, or official fare data.
const stops = [
  ['ust-road', 'UST España sample boarding area'], ['legarda', 'Legarda sample LRT platform'],
  ['cubao-lrt', 'Cubao sample LRT drop-off'], ['cubao-mrt', 'Cubao sample MRT platform'],
  ['north-jeep', 'SM North sample jeepney drop-off'], ['north-uv', 'SM North sample UV drop-off'], ['north-mrt', 'North Avenue sample MRT exit'],
  ['pasay-road', 'Pasay Rotonda sample boarding area'], ['taft-mrt', 'Taft sample MRT platform'],
  ['libertad', 'Libertad sample local stop'], ['libertad-bus', 'Libertad sample bus boarding area'],
  ['moa-jeep', 'MOA sample modern jeepney stop'], ['moa-bus', 'MOA sample bus drop-off'],
  ['ayala-road', 'One Ayala sample road terminal'], ['ayala-mrt', 'Ayala sample MRT platform'],
  ['taft-bus', 'Taft sample PITX-bound bus stop'], ['pitx-platform', 'PITX sample boarding / drop-off area'],
  ['ust-taft', 'España sample Taft-bound bus stop'],
] as const;
const names = new Map<string, string>([...demoPlaces.map(place => [place.id, place.name] as [string, string]), ...stops.map(([id, name]) => [id, name] as [string, string])]);
const name = (id: string) => names.get(id)!;
const stopAreas: Record<string,string> = {
  'ust-road':'ust-frassati','ust-taft':'ust-frassati',legarda:'legarda','cubao-lrt':'cubao','cubao-mrt':'cubao',
  'north-jeep':'sm-north','north-uv':'sm-north','north-mrt':'sm-north','pasay-road':'pasay-rotonda','taft-mrt':'pasay-rotonda','taft-bus':'pasay-rotonda',
  libertad:'libertad','libertad-bus':'libertad','moa-jeep':'sm-moa','moa-bus':'sm-moa','ayala-road':'one-ayala','ayala-mrt':'one-ayala','pitx-platform':'pitx',
};
function walk(id: string, from: string, to: string, minutes: number, instruction: string): TransportSegment {
  return { id, from, to, mode: 'walk', service: 'Walking connection', signboard: 'Follow the sample walking connection', boarding: name(from), alighting: name(to), instruction, travelMinutes: minutes, transferMinutes: 0, boardingWaitMinutes: 0, fares: {} };
}
function ride(id: string, from: string, to: string, mode: TransportMode, service: string, signboard: string, minutes: number, table: FareTable, terminal: string, level: 'low'|'mid'|'high', waits: [number,number,number], boarding = 1): TransportSegment {
  return { id, from, to, mode, service, serviceId: `srv:${id}`, signboard, boarding: name(from), alighting: name(to), instruction: `Board the sample ${service} service; confirm the actual stop and signboard with the operator.`, travelMinutes: minutes, transferMinutes: 3, boardingWaitMinutes: boarding, fares: table, queue: { terminal, defaultLevel: level, minutes: { low: waits[0], mid: waits[1], high: waits[2] } } };
}
export const transportNetwork: TransportNetwork = {
  nodes: [...demoPlaces.map(place => ({ id: place.id, name: place.name, placeId: place.id, areaId:place.id })), ...stops.map(([id, name]) => ({ id, name, areaId:stopAreas[id] }))],
  segments: [
    walk('ust-road-walk','ust-frassati','ust-road',3,'Walk to the sample España boarding area; verify pedestrian access.'),
    ride('ust-north-jeep','ust-road','north-jeep','jeepney','España–SM North jeepney','Quezon Ave / West Ave / SM North',30,fares.jeepNorth,'UST España','low',[4,12,28]),
    ride('ust-north-uv','ust-road','north-uv','uv','España–SM North UV Express','SM North / UV Express',24,fares.uvNorth,'UST España','low',[8,16,30],2),
    walk('north-jeep-entry','north-jeep','sm-north',6,'Walk from the sample drop-off toward the Annex entrance.'),
    walk('north-uv-entry','north-uv','sm-north',4,'Walk from the sample UV drop-off to SM North.'),
    walk('ust-legarda','ust-frassati','legarda',12,'Walk along the sample connection to Legarda; confirm safe pedestrian access.'),
    ride('legarda-cubao','legarda','cubao-lrt','lrt','LRT sample eastbound leg','Cubao / eastbound',12,fares.lrt,'Legarda LRT','low',[3,7,15]),
    walk('cubao-rail-transfer','cubao-lrt','cubao-mrt',5,'Walk between the sample LRT and MRT transfer points.'),
    ride('cubao-north','cubao-mrt','north-mrt','mrt','MRT sample northbound leg','North Avenue / northbound',10,fares.mrt,'Cubao MRT','low',[2,6,14]),
    walk('north-mrt-entry','north-mrt','sm-north',8,'Walk from the sample North Avenue exit toward the mall entrance.'),

    walk('pasay-road-walk','pasay-rotonda','pasay-road',3,'Walk to the sample Pasay boarding area.'),
    ride('pasay-moa-modern','pasay-road','moa-jeep','modern-jeepney','Pasay–MOA modern jeepney','MOA / modern jeepney',18,fares.modernMoa,'Pasay Rotonda','low',[4,10,23]),
    ride('pasay-moa-bus','pasay-road','moa-bus','bus','Pasay–MOA city bus','Mall of Asia / city bus',14,fares.busMoa,'Pasay Rotonda','mid',[3,8,24],2),
    ride('pasay-libertad-tricycle','pasay-road','libertad','tricycle','Sample local tricycle connection','Libertad local stop',6,fares.localTricycle,'Pasay local tricycle','low',[3,7,18]),
    walk('libertad-transfer','libertad','libertad-bus',2,'Walk to the mapped sample bus connection at Libertad.'),
    ride('libertad-moa','libertad-bus','moa-jeep','bus','Libertad–MOA sample bus','MOA terminal',12,fares.localBus,'Libertad bus','low',[4,8,20]),
    walk('moa-jeep-entry','moa-jeep','sm-moa',5,'Walk from the sample stop to the designated mall entrance.'),
    walk('moa-bus-entry','moa-bus','sm-moa',6,'Walk from the sample bus drop-off toward the mall entrance.'),

    walk('ayala-road-walk','one-ayala','ayala-road',3,'Walk to the sample One Ayala road terminal.'),
    ride('ayala-pitx-bus','ayala-road','pitx-platform','bus','One Ayala–PITX city bus','PITX / southbound',40,fares.ayalaBus,'One Ayala','mid',[4,8,25],2),
    ride('ayala-pitx-uv','ayala-road','pitx-platform','uv','One Ayala–PITX UV Express','PITX / UV Express',31,fares.ayalaUv,'One Ayala','mid',[6,10,28],2),
    walk('ayala-mrt-walk','one-ayala','ayala-mrt',7,'Walk to the sample Ayala MRT boarding point.'),
    ride('ayala-taft-mrt','ayala-mrt','taft-mrt','mrt','MRT sample southbound leg','Taft Avenue / southbound',12,fares.mrt,'Ayala MRT','low',[2,6,15]),
    walk('taft-bus-transfer','taft-mrt','taft-bus',5,'Walk to the sample PITX-bound bus transfer point.'),
    ride('taft-pitx-bus','taft-bus','pitx-platform','bus','Taft–PITX sample bus','PITX terminal',18,fares.taftPitx,'Pasay Rotonda','low',[4,9,24]),
    walk('pitx-arrival','pitx-platform','pitx',4,'Walk into the sample PITX arrival area.'),

    // Existing demo journeys remain supported. Every direction is explicit.
    walk('pasay-mrt-walk','pasay-rotonda','taft-mrt',5,'Walk to the sample Taft MRT platform.'),
    ride('taft-ayala-mrt','taft-mrt','ayala-mrt','mrt','MRT sample northbound leg','Ayala / northbound',12,fares.mrt,'Pasay MRT','low',[4,8,20]),
    walk('ayala-mrt-arrival','ayala-mrt','one-ayala',7,'Walk from the sample MRT exit to One Ayala.'),
    ride('pasay-ayala-bus','pasay-road','ayala-road','bus','Pasay–Ayala sample bus','Ayala / northbound',42,fares.ayalaBus,'Pasay Rotonda','mid',[4,10,24]),
    ride('pasay-ayala-uv','pasay-road','ayala-road','uv','Pasay–Ayala sample UV','Ayala / UV Express',32,fares.pasayAyalaUv,'Pasay Rotonda','low',[6,12,26]),
    walk('ayala-road-arrival','ayala-road','one-ayala',3,'Walk from the sample road drop-off to One Ayala.'),
    walk('pitx-departure','pitx','pitx-platform',4,'Walk to the sample MOA-bound boarding area; confirm the actual bay.'),
    ride('pitx-moa-bus','pitx-platform','moa-bus','bus','PITX–MOA sample bus','MOA terminal',22,fares.pitxMoa,'PITX','mid',[4,12,27]),
    ride('pitx-moa-modern','pitx-platform','moa-jeep','modern-jeepney','PITX–MOA modern jeepney','MOA / modern jeepney',18,fares.pitxModern,'PITX','low',[6,13,28]),
    ride('pitx-moa-uv','pitx-platform','moa-jeep','uv','PITX–MOA sample UV','MOA / UV Express',15,fares.pitxUv,'PITX','low',[3,9,22]),
    walk('ust-taft-walk','ust-frassati','ust-taft',4,'Walk to the sample Taft-bound boarding stop.'),
    ride('ust-taft-bus','ust-taft','taft-bus','bus','España–Taft sample bus','Taft / EDSA connection',45,fares.ustTaft,'UST España','mid',[5,13,29]),
    walk('taft-road-transfer','taft-bus','pasay-road',4,'Walk to the sample MOA-bound transfer point.'),
  ],
};
export const popularJourneys = [
  { originId: 'ust-frassati', destinationId: 'sm-north' },
  { originId: 'pasay-rotonda', destinationId: 'sm-moa' },
  { originId: 'one-ayala', destinationId: 'pitx' },
  { originId: 'pasay-rotonda', destinationId: 'one-ayala' },
  { originId: 'pitx', destinationId: 'sm-moa' },
  { originId: 'ust-frassati', destinationId: 'sm-moa' },
];
