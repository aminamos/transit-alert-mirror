import type {
  AlertSeverity,
  AlertDirection,
  InformedEntity,
  ClosedStopInfo,
  ActivePeriodFormatted,
} from '../types/index.js';
import { cleanDispatcherText, toTitleCase, isShouting } from './textCleaner.js';

export function extractRoutes(
  header: string,
  description: string,
  entities: InformedEntity[] = []
): string[] {
  const routes = new Set<string>();

  // 1. From informed entities
  for (const ent of entities) {
    if (ent.routeLabel) {
      routes.add(ent.routeLabel.replace(/^Route\s+/i, 'Route '));
    } else if (ent.routeId) {
      routes.add(`Route ${ent.routeId}`);
    }
  }

  // 2. From text via regex
  const combined = `${header} \n ${description}`;

  // Match METRO lines: METRO Orange Line, METRO E Line, E Line, Blue Line
  const metroLineRegex = /\b(?:METRO\s+)?([A-Z]|Blue|Green|Red|Orange|Gold|Purple|Bronze|[A-Ga-g])\s+Line\b/gi;
  let metroMatch: RegExpExecArray | null;
  while ((metroMatch = metroLineRegex.exec(combined)) !== null) {
    const rawName = metroMatch[1];
    const normalizedName = rawName.length === 1
      ? rawName.toUpperCase()
      : rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase();
    routes.add(`METRO ${normalizedName} Line`);
  }

  // Match Route 11, Routes 537 and 538, Route 11A, RTE 21
  const routeRegex = /\b(?:Routes?|Rte\.?|Rt\.?)\s+([0-9]+[A-Za-z]?)(?:\s*(?:,|and|&)\s*([0-9]+[A-Za-z]?))?/gi;
  let rMatch: RegExpExecArray | null;
  while ((rMatch = routeRegex.exec(combined)) !== null) {
    if (rMatch[1]) routes.add(`Route ${rMatch[1]}`);
    if (rMatch[2]) routes.add(`Route ${rMatch[2]}`);
  }

  const result = Array.from(routes);
  return result.length > 0 ? result : ['Systemwide'];
}

export function extractDirection(
  header: string,
  description: string,
  entities: InformedEntity[] = []
): AlertDirection {
  // Check informed entity directions
  const dirIds = entities.map(e => e.directionId).filter(d => d !== undefined);
  if (dirIds.length > 0) {
    const has0 = dirIds.includes(0);
    const has1 = dirIds.includes(1);
    if (has0 && has1) return 'Both Directions';
  }

  const text = `${header} ${description}`.toLowerCase();

  const hasNB = /\b(?:northbound|nb)\b/.test(text);
  const hasSB = /\b(?:southbound|sb)\b/.test(text);
  const hasEB = /\b(?:eastbound|eb)\b/.test(text);
  const hasWB = /\b(?:westbound|wb)\b/.test(text);

  if ((hasNB && hasSB) || (hasEB && hasWB) || text.includes('both direction') || text.includes('both ways')) {
    return 'Both Directions';
  }

  if (hasNB) return 'Northbound';
  if (hasSB) return 'Southbound';
  if (hasEB) return 'Eastbound';
  if (hasWB) return 'Westbound';
  if (text.includes('inbound') || /\bib\b/.test(text)) return 'Inbound';
  if (text.includes('outbound') || /\bob\b/.test(text)) return 'Outbound';

  return 'All';
}

export function extractClosedStops(
  header: string,
  description: string,
  entities: InformedEntity[] = []
): { stopIds: string[]; details: ClosedStopInfo[] } {
  const stopMap = new Map<string, ClosedStopInfo>();

  // 1. Check text for "Affected stops:" block
  const affectedBlockMatch = /(?:Affected stops?|Stops? closed|Closed stops?):?\s*([\s\S]+?)(?:\n\n|\n[A-Z][a-z]+ [0-9]|$)/i.exec(
    description
  );
  if (affectedBlockMatch) {
    const block = affectedBlockMatch[1];
    const lines = block.split('\n');
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      // Pattern: "Dale St & Grand Ave - Stop #10680 (northbound)" or "Stop #50603"
      const match = /(?:(.*?)\s*-\s*)?Stop\s*#?\s*([0-9]{3,6})(?:\s*\((.*?)\))?/i.exec(line);
      if (match) {
        const id = match[2];
        const name = match[1]?.trim() || undefined;
        const direction = match[3]?.trim() || undefined;
        stopMap.set(id, { id, name, direction });
      }
    }
  }

  // 2. Check for "STOPS CLOSED: #1234, #1235"
  const combined = `${header} \n ${description}`;
  const closedStopsLineMatch = /(?:stops?\s+closed|closed\s+stops?):?\s*([#0-9,\s]+)(?:\.|$|\n)/i.exec(combined);
  if (closedStopsLineMatch) {
    const numbers = closedStopsLineMatch[1].match(/[0-9]{3,6}/g);
    if (numbers) {
      for (const num of numbers) {
        if (!stopMap.has(num)) {
          stopMap.set(num, { id: num });
        }
      }
    }
  }

  // 3. Scan entire header and description for any Stop #12345 or #1234
  const genericStopRegex = /(?:Stop\s*#?|#)\s*([0-9]{4,6})/gi;
  let gMatch: RegExpExecArray | null;
  while ((gMatch = genericStopRegex.exec(combined)) !== null) {
    const id = gMatch[1];
    if (!stopMap.has(id)) {
      stopMap.set(id, { id });
    }
  }

  // 4. Check entity stopIds if effect is STOP_CLOSURE or NO_SERVICE
  for (const ent of entities) {
    if (ent.stopId && !stopMap.has(ent.stopId)) {
      stopMap.set(ent.stopId, { id: ent.stopId });
    }
  }

  const details = Array.from(stopMap.values());
  const stopIds = details.map(d => d.id);
  return { stopIds, details };
}

export function extractIntersections(header: string, description: string): string[] {
  const intersections = new Set<string>();
  const text = `${header} \n ${description}`;

  // Matches like "off Lake St at Chicago Ave" or "off Lake St from 4th to 5th"
  const offAtRegex = /off\s+([0-9A-Za-z\s.'-]+?\s+(?:St|Ave|Avenue|Street|Rd|Road|Blvd|Boulevard|Pkwy|Parkway|Dr|Drive|Way|Hwy|Highway))\s+at\s+([0-9A-Za-z\s.'-]+?\s+(?:St|Ave|Avenue|Street|Rd|Road|Blvd|Boulevard|Pkwy|Parkway|Dr|Drive|Way|Hwy|Highway|Station))/gi;
  let match: RegExpExecArray | null;
  while ((match = offAtRegex.exec(text)) !== null) {
    const street1 = cleanDispatcherText(match[1].trim());
    const street2 = cleanDispatcherText(match[2].trim());
    if (street1.length > 2 && street2.length > 2) {
      intersections.add(`${street1} & ${street2}`);
    }
  }

  // Matches like "70th St W & Target", "Dale St & Grand Ave", "Upton Ave / Sheridan Ave"
  const streetSuffix = '(?:St|Ave|Avenue|Street|Rd|Road|Blvd|Boulevard|Pkwy|Parkway|Dr|Drive|Way|Hwy|Highway)';
  const dirSuffix = '(?:\\s+[NSEW]|\\s+NE|\\s+NW|\\s+SE|\\s+SW)?';
  const intersectionRegex = new RegExp(
    `([0-9A-Za-z\\s.'-]+?\\s+${streetSuffix}${dirSuffix})\\s*(?:&|and|\\/)\\s*([0-9A-Za-z\\s.'-]+?(?:\\s+${streetSuffix}|Target|Station|Driveway|Transit Center)${dirSuffix})`,
    'gi'
  );

  while ((match = intersectionRegex.exec(text)) !== null) {
    let street1 = cleanDispatcherText(match[1].trim());
    let street2 = cleanDispatcherText(match[2].trim());

    street1 = street1.replace(/^(?:temporary\s+stop\s+(?:on|at)|stop\s+(?:on|at)|layover\s+on|at|on|for|from|to)\s+/i, '').trim();
    street2 = street2.replace(/^(?:temporary\s+stop\s+(?:on|at)|stop\s+(?:on|at)|layover\s+on|at|on|for|from|to)\s+/i, '').trim();

    if (street1.length > 2 && street2.length > 2 && street1.length < 40 && street2.length < 40) {
      intersections.add(`${street1} & ${street2}`);
    }
  }

  // Matches like "off Upton Ave/Sheridan Ave from 44th St to 39th St"
  const corridorRegex = /off\s+([0-9A-Za-z\s/.'-]+?)\s+from\s+([0-9A-Za-z\s.'-]+?)\s+to\s+([0-9A-Za-z\s.'-]+?)(?:\s+beginning|\s+due|\s+until|\n|$)/gi;
  while ((match = corridorRegex.exec(text)) !== null) {
    const corridor = match[1].trim();
    const from = match[2].trim();
    const to = match[3].trim();
    intersections.add(`${corridor} (${from} to ${to})`);
  }

  return Array.from(intersections).slice(0, 5);
}

export function extractRiderAlternative(description: string, header: string): string | null {
  // Pattern 1: Multi-line or bullet block in description
  const altBlockRegex = /(?:Get on\/off\s+(?:[^\n:]+)?buses at|Board at|Catch buses? at|Temporary stop(?:s)? on|Alternative boarding:?):\s*([\s\S]+?)(?:\n\n|\n[A-Z][a-z]+ buses will travel|Affected stops:|Get on\/off|$)/i;
  const altMatch = altBlockRegex.exec(description);
  if (altMatch) {
    const rawStops = altMatch[1]
      .split('\n')
      .map(s => s.trim())
      .filter(s => {
        if (!s) return false;
        const lower = s.toLowerCase();
        return (
          !lower.startsWith('for ') &&
          !lower.includes('will travel') &&
          !lower.includes('affected stops') &&
          !lower.includes('is closed') &&
          !lower.includes('are closed') &&
          !lower.includes('beginning ') &&
          !lower.includes('until further notice')
        );
      });

    if (rawStops.length > 0) {
      const cleaned = rawStops.slice(0, 3).map(s => cleanDispatcherText(s)).join('; ');
      return `Board at: ${cleaned}`;
    }
  }

  const combined = `${description}\n${header}`;

  // Pattern 2: Single inline "Board at [stop]" or "Board buses at [stop]"
  const singleMatch = /\b(?:Board(?: buses)? at|Catch bus at|Use temporary stop at)\s+([^\n\r.]+)/i.exec(combined);
  if (singleMatch) {
    let alt = cleanDispatcherText(singleMatch[1].trim());
    if (isShouting(singleMatch[1])) {
      alt = toTitleCase(alt);
    }
    return `Board at ${alt}`;
  }

  // Pattern 3: Temporary stop mention
  const tempStopMatch = /Temporary stop (?:on|at)\s+([^\n\r.]+)/i.exec(combined);
  if (tempStopMatch) {
    return `Temporary stop at ${cleanDispatcherText(tempStopMatch[1].trim())}`;
  }

  return null;
}

export function extractDetourDetails(description: string): string | null {
  const match = /(?:(?:Northbound|Southbound|Eastbound|Westbound)?\s*buses will travel[^\n\r]+(?:\n[^\n\r]+)?)/i.exec(description);
  if (match) {
    return cleanDispatcherText(match[0].trim());
  }
  return null;
}

export function computeSeverity(
  cause?: string,
  effect?: string,
  effectDetail?: string,
  header = '',
  description = ''
): AlertSeverity {
  const combined = `${effect ?? ''} ${effectDetail ?? ''} ${cause ?? ''} ${header} ${description}`.toLowerCase();

  // Check cancellations and full service suspensions first (Critical)
  if (
    effectDetail === 'CANCELLATION' ||
    combined.includes('canceled') ||
    combined.includes('cancelled') ||
    combined.includes('suspended') ||
    combined.includes('service suspended') ||
    combined.includes('no trains') ||
    (effect === 'NO_SERVICE' && effectDetail !== 'STOP_CLOSURE')
  ) {
    return 'Critical';
  }

  // Moderate: Detours, stop closures, reroutes, significant delays
  if (
    effect === 'DETOUR' ||
    effectDetail === 'STOP_CLOSURE' ||
    effectDetail === 'DETOUR' ||
    combined.includes('detour') ||
    combined.includes('detoured') ||
    combined.includes('closed') ||
    combined.includes('closure') ||
    combined.includes('reroute')
  ) {
    return 'Moderate';
  }

  return 'Minor';
}

export function formatActivePeriod(
  activePeriod?: Array<{ start?: number; end?: number }>,
  text = ''
): ActivePeriodFormatted {
  let startStr: string | undefined;
  let endStr: string | undefined;
  let textDesc: string | undefined;

  if (activePeriod && activePeriod.length > 0) {
    const first = activePeriod[0];
    if (first.start) {
      startStr = new Date(first.start * 1000).toISOString();
    }
    if (first.end) {
      endStr = new Date(first.end * 1000).toISOString();
    }
  }

  // Parse human date/time from text e.g. "beginning Mon Sep 14 at 7:00 AM until further notice"
  const timeMatch = /beginning\s+([A-Za-z0-9,:\s]+?)\s+until\s+([A-Za-z0-9,:\s]+?)(?:\s+due|\n|$)/i.exec(text);
  if (timeMatch) {
    textDesc = `Beginning ${timeMatch[1].trim()} until ${timeMatch[2].trim()}`;
  } else {
    const singleTimeMatch = /(?:beginning|starting)\s+([A-Za-z0-9,:\s]+?)(?:\s+due|\n|$)/i.exec(text);
    if (singleTimeMatch) {
      textDesc = `Beginning ${singleTimeMatch[1].trim()}`;
    }
  }

  return {
    start: startStr,
    end: endStr,
    textDescription: textDesc,
  };
}

export function generatePlainTitle(
  routes: string[],
  direction: AlertDirection,
  severity: AlertSeverity,
  header: string,
  intersections: string[]
): string {
  const cleanedHeader = cleanDispatcherText(header);
  const routePrefix = routes.length > 0 && routes[0] !== 'Systemwide'
    ? routes.join(', ')
    : 'System Advisory';

  // Check if header contains trip cancellation
  const cancelMatch = /trip departing ([^,]+?) at ([0-9:]+\s*[AP]M) canceled/i.exec(cleanedHeader);
  if (cancelMatch) {
    return `${routePrefix}: ${direction !== 'All' ? direction + ' ' : ''}${cancelMatch[2]} Trip Canceled (${cancelMatch[1].trim()})`;
  }

  const isStopClosure = cleanedHeader.toLowerCase().includes('closed');
  const isDetour = cleanedHeader.toLowerCase().includes('detour');
  const isCanceled = cleanedHeader.toLowerCase().includes('canceled') || cleanedHeader.toLowerCase().includes('cancelled');
  const isSuspended = cleanedHeader.toLowerCase().includes('suspended');

  if (isCanceled) {
    return `${routePrefix}: Service Canceled`;
  }
  if (isSuspended) {
    return `${routePrefix}: Service Suspended`;
  }
  if (isDetour) {
    const loc = intersections[0] || 'Regular Corridor';
    return `${routePrefix}: Detour via ${loc}`;
  }
  if (isStopClosure) {
    const loc = intersections[0] || 'Selected Stop';
    return `${routePrefix}: Stop Closed at ${loc}`;
  }

  // Fallback to title-cased cleaned header if short enough
  if (cleanedHeader.length > 0 && cleanedHeader.length < 90) {
    return toTitleCase(cleanedHeader);
  }

  return `${routePrefix}: Service Advisory`;
}

export function generatePlainSummary(
  header: string,
  description: string,
  severity: AlertSeverity,
  riderAlternative: string | null
): string {
  const cleanedHeader = cleanDispatcherText(header);

  // Extract "due to [cause]"
  const dueToMatch = /due to ([^.\n\r]+)/i.exec(cleanedHeader) || /due to ([^.\n\r]+)/i.exec(description);
  const reason = dueToMatch ? ` due to ${dueToMatch[1].trim()}` : '';

  let summary = cleanedHeader;
  if (!summary) {
    summary = cleanDispatcherText(description.split('\n')[0] || 'Transit advisory in effect.');
  }

  // Append rider alternative note if present and not already mentioned
  if (riderAlternative && !summary.includes(riderAlternative)) {
    summary = `${summary}. ${riderAlternative}.`;
  }

  return summary.replace(/\.\.+/g, '.').trim();
}
