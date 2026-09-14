import type {
  RawAlert,
  EnrichedAlert,
  AlertDataset,
  AlertDatasetMetadata,
  AlertSeverity,
} from '../types/index.js';
import {
  extractRoutes,
  extractDirection,
  extractClosedStops,
  extractIntersections,
  extractRiderAlternative,
  extractDetourDetails,
  computeSeverity,
  formatActivePeriod,
  generatePlainTitle,
  generatePlainSummary,
} from './heuristics.js';
import { cleanDispatcherText } from './textCleaner.js';

export * from './textCleaner.js';
export * from './heuristics.js';

export function enrichAlert(raw: RawAlert): EnrichedAlert {
  const cleanedHeader = cleanDispatcherText(raw.headerText);
  const cleanedDescription = cleanDispatcherText(raw.descriptionText);

  const affectedRoutes = extractRoutes(cleanedHeader, cleanedDescription, raw.informedEntities);
  const direction = extractDirection(cleanedHeader, cleanedDescription, raw.informedEntities);
  const { stopIds: closedStopIds, details: closedStopDetails } = extractClosedStops(
    cleanedHeader,
    cleanedDescription,
    raw.informedEntities
  );
  const intersections = extractIntersections(cleanedHeader, cleanedDescription);
  const riderAlternative = extractRiderAlternative(cleanedDescription, cleanedHeader);
  const detourDetails = extractDetourDetails(cleanedDescription);
  const severity = computeSeverity(raw.cause, raw.effect, raw.effectDetail, cleanedHeader, cleanedDescription);
  const activePeriod = formatActivePeriod(raw.activePeriod, cleanedHeader);

  const title = generatePlainTitle(affectedRoutes, direction, severity, cleanedHeader, intersections);
  const summary = generatePlainSummary(cleanedHeader, cleanedDescription, severity, riderAlternative);

  const updatedAt = raw.lastModifiedTimestamp
    ? new Date(raw.lastModifiedTimestamp * 1000).toISOString()
    : new Date().toISOString();

  return {
    id: raw.id,
    agency: raw.agency,
    severity,
    title,
    summary,
    affectedRoutes,
    direction,
    intersections,
    closedStopIds,
    closedStopDetails,
    riderAlternative,
    detourDetails,
    activePeriod,
    cause: raw.cause || 'GENERAL',
    effect: raw.effect || 'ADVISORY',
    url: raw.url,
    updatedAt,
    rawHeader: raw.headerText,
    rawDescription: raw.descriptionText,
  };
}

export function enrichAlerts(rawAlerts: RawAlert[]): AlertDataset {
  const alerts = rawAlerts.map(enrichAlert);

  // Sort by severity (Critical first, then Moderate, then Minor) and then by route
  const severityRank: Record<AlertSeverity, number> = {
    Critical: 0,
    Moderate: 1,
    Minor: 2,
  };

  alerts.sort((a, b) => {
    const rankDiff = severityRank[a.severity] - severityRank[b.severity];
    if (rankDiff !== 0) return rankDiff;
    return a.affectedRoutes[0].localeCompare(b.affectedRoutes[0], undefined, { numeric: true });
  });

  const criticalCount = alerts.filter(a => a.severity === 'Critical').length;
  const moderateCount = alerts.filter(a => a.severity === 'Moderate').length;
  const minorCount = alerts.filter(a => a.severity === 'Minor').length;

  const routesSet = new Set<string>();
  alerts.forEach(a => a.affectedRoutes.forEach(r => routesSet.add(r)));

  const agenciesSet = new Set<string>();
  alerts.forEach(a => agenciesSet.add(a.agency));

  const metadata: AlertDatasetMetadata = {
    generatedAt: new Date().toISOString(),
    totalAlerts: alerts.length,
    criticalCount,
    moderateCount,
    minorCount,
    affectedRoutesCount: routesSet.size,
    agencies: Array.from(agenciesSet),
  };

  return {
    metadata,
    alerts,
  };
}
