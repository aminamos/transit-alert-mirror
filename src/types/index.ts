export type AlertSeverity = 'Critical' | 'Moderate' | 'Minor';

export type AlertDirection =
  | 'Northbound'
  | 'Southbound'
  | 'Eastbound'
  | 'Westbound'
  | 'Both Directions'
  | 'Inbound'
  | 'Outbound'
  | 'Loop'
  | 'All';

export interface InformedEntity {
  agencyId?: string;
  routeId?: string;
  routeLabel?: string;
  stopId?: string;
  directionId?: number;
  tripId?: string;
}

export interface RawAlert {
  id: string;
  agency: string;
  lastModifiedTimestamp?: number;
  alertLifecycle?: string;
  activePeriod?: Array<{ start?: number; end?: number }>;
  informedEntities: InformedEntity[];
  cause?: string;
  effect?: string;
  effectDetail?: string;
  url?: string;
  headerText: string;
  descriptionText: string;
  raw?: unknown;
}

export interface ClosedStopInfo {
  id: string;
  name?: string;
  direction?: string;
}

export interface ActivePeriodFormatted {
  start?: string;
  end?: string;
  textDescription?: string;
}

export interface EnrichedAlert {
  id: string;
  agency: string;
  severity: AlertSeverity;
  title: string;
  summary: string;
  affectedRoutes: string[];
  direction: AlertDirection;
  intersections: string[];
  closedStopIds: string[];
  closedStopDetails: ClosedStopInfo[];
  riderAlternative: string | null;
  detourDetails: string | null;
  activePeriod: ActivePeriodFormatted;
  cause: string;
  effect: string;
  url?: string;
  updatedAt: string;
  rawHeader?: string;
  rawDescription?: string;
}

export interface AlertDatasetMetadata {
  generatedAt: string;
  totalAlerts: number;
  criticalCount: number;
  moderateCount: number;
  minorCount: number;
  affectedRoutesCount: number;
  agencies: string[];
}

export interface AlertDataset {
  metadata: AlertDatasetMetadata;
  alerts: EnrichedAlert[];
}

export interface SyncOptions {
  outputDir?: string;
  agency?: string;
  offlineFixturePath?: string;
  dryRun?: boolean;
  verbose?: boolean;
}
