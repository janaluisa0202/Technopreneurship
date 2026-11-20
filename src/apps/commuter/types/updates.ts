/** Staff-published content shown in Para Alerts → Updates. */
export interface CommuterUpdate {
  id: string;
  kind: 'announcement' | 'promo' | 'message';
  title: string;
  body: string;
  /** When it was published / sent (ISO). Promos use their last update. */
  at: string;
  /** announcement channel, promo type, or message purpose */
  label: string;
  /** Promo validity, e.g. "Until 2026-12-31 · Jeepney / UV Express" */
  detail?: string;
  /** Route-targeted messages: "originId:destinationId" plus a display label. */
  routeKey?: string;
  routeLabel?: string;
}
export interface CommuterUpdatesState {
  mode: 'demo' | 'live';
  status: 'loading' | 'ready' | 'error';
  items: CommuterUpdate[];
  retry: () => void;
}
