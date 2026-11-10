import { useEffect, useState } from 'react';
import { demoLocationSearch } from '../lib/locations';
import type { LocationSearchProvider, Place } from '../types';

// A provider can later use a geocoding service without changing address forms.
// Ignore stale responses when the query changes or the picker closes.
export function useLocationSearch(query: string, provider: LocationSearchProvider = demoLocationSearch) {
  const [attempt,setAttempt]=useState(0);
  const [result, setResult] = useState<{ query: string; places: Place[]; error: boolean }>();
  useEffect(() => {
    let active = true;
    Promise.resolve().then(()=>provider.search(query)).then(places => {
      if (active) setResult({ query, places, error: false });
    }).catch(() => {
      if (active) setResult({ query, places: [], error: true });
    });
    return () => { active = false; };
  }, [query, provider,attempt]);
  return { retry:()=>{setResult(undefined);setAttempt(value=>value+1);}, places: result?.query === query ? result.places : [], loading: result?.query !== query, error: result?.query === query && result.error };
}
