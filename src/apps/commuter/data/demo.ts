import type { QueueReport, Trip } from '../types';

// SAMPLE VALUES ONLY: none of these are official verified schedules, fares, or live reports.
export const locations = [
  'UST Frassati (España)', 'SM North EDSA / Annex', 'Pasay Rotonda',
  'One Ayala, Makati', 'PITX, Parañaque', 'SM Mall of Asia',
] as const;

export const sampleTrips: Trip[] = [
  {
    id:'ust-north',from:locations[0],to:locations[1],mode:'JEEPNEY / UV EXPRESS',
    via:'UST Frassati (España) → Quezon Ave → West Ave → SM North',
    minutes:[25,35],price:25,queue:'low',
    steps:[['Board a Quezon Avenue-bound jeepney','Near UST España; verify the signboard'],['Continue to West Avenue','Follow the designated vehicle route'],['Alight near SM North EDSA','Walk toward The Annex']],
    alts:[['Jeepney + short walk',25,35],['Rail + transfer',49,42]],
  },
  {
    id:'pasay-ayala',from:locations[2],to:locations[3],mode:'MRT-3 / BUS',
    via:'Pasay Rotonda → MRT Taft Ave → Ayala Station → One Ayala',
    minutes:[25,40],price:28,queue:'mid',
    steps:[['Enter MRT-3 Taft Avenue Station','Check station entry and northbound platforms'],['Ride to Ayala Station','Alight at Ayala Station'],['Walk to One Ayala','Follow station connection signs']],
    alts:[['Bus via EDSA',35,48]],
  },
  {
    id:'pitx-moa',from:locations[4],to:locations[5],mode:'BUS / E-JEEP',
    via:'PITX → Macapagal Boulevard → MOA transport terminal',
    minutes:[20,35],price:16,queue:'mid',
    steps:[['Find the MOA-bound service','Ask terminal staff about the current bay'],['Ride to Mall of Asia','Alight at the designated MOA stop']],
    alts:[['Alternative shuttle / bus',22,35]],
  },
  {
    id:'ayala-pitx',from:locations[3],to:locations[4],mode:'BUS / UV EXPRESS',
    via:'One Ayala → EDSA → PITX transport terminal',
    minutes:[35,50],price:35,queue:'low',
    steps:[['Proceed to One Ayala terminal','Check PITX-bound vehicle board'],['Board the assigned service','Follow vehicle announcement to PITX']],
    alts:[['Rail + bus transfer',45,52]],
  },
  {
    id:'ust-moa',from:locations[0],to:locations[5],mode:'JEEPNEY / LRT-1 / BUS',
    via:'UST España → LRT-1 station → EDSA area → SM Mall of Asia',
    minutes:[55,75],price:56,queue:'high',
    steps:[['Take a jeepney to an LRT-1 connection','Verify the vehicle signboard'],['Board LRT-1 southbound','Alight at your chosen connecting station'],['Transfer to an MOA-bound vehicle','Follow terminal signs to the mall']],
    alts:[['Two buses',48,84]],
  },
];

export const demoQueues: QueueReport[] = [
  {id:'ust',place:'UST España',where:'Jeepneys near university entrance',level:'low',estimate:'About 5–10 min',updated:'Illustrative sample',progress:23},
  {id:'north',place:'SM North EDSA',where:'Bus / UV pickup areas',level:'mid',estimate:'About 10–20 min',updated:'Illustrative sample',progress:57},
  {id:'pitx',place:'PITX',where:'Main commuter terminal',level:'high',estimate:'About 20–30 min',updated:'Illustrative sample',progress:88},
  {id:'ayala',place:'One Ayala',where:'Bus and UV loading area',level:'mid',estimate:'About 10–20 min',updated:'Illustrative sample',progress:61},
];

export const demoAlerts = [
  { title:'Heavy traffic along EDSA', description:'Illustrative advisory. Check your usual route before traveling.', tag:'Traffic',kind:'red'},
  { title:'Possible terminal queue changes', description:'Crowdsourced conditions can change quickly near major terminals.', tag:'Queue',kind:'blue'},
  { title:'Verify your fare before boarding', description:'Compare your expected fare with the latest official fare matrix.', tag:'Fare tip',kind:''},
];
