const PRESERVED_ACRONYMS = new Set([
  'METRO',
  'BRT',
  'LRT',
  'AM',
  'PM',
  'TC',
  'PR',
  'ADA',
  'DOT',
  'MNDOT',
  'ID',
  'COVID',
  'US',
  'MN',
]);

const LOWERCASE_WORDS = new Set([
  'a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at',
  'to', 'from', 'by', 'in', 'of', 'off', 'with', 'via', 'due', 'until',
]);

export function cleanWhitespace(text: string): string {
  if (!text) return '';
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
}

export function isShouting(text: string): boolean {
  const letters = text.replace(/[^a-zA-Z]/g, '');
  if (letters.length < 4) return false;
  const upper = text.replace(/[^A-Z]/g, '').length;
  return upper / letters.length > 0.65;
}

export function expandAcronyms(text: string): string {
  if (!text) return '';

  return text
    // Directions
    .replace(/\bNB\b/gi, (match) => (match === match.toUpperCase() ? 'Northbound' : 'northbound'))
    .replace(/\bSB\b/gi, (match) => (match === match.toUpperCase() ? 'Southbound' : 'southbound'))
    .replace(/\bEB\b/gi, (match) => (match === match.toUpperCase() ? 'Eastbound' : 'eastbound'))
    .replace(/\bWB\b/gi, (match) => (match === match.toUpperCase() ? 'Westbound' : 'westbound'))
    .replace(/\bOB\b/gi, (match) => (match === match.toUpperCase() ? 'Outbound' : 'outbound'))
    .replace(/\bIB\b/gi, (match) => (match === match.toUpperCase() ? 'Inbound' : 'inbound'))

    // Transit terms
    .replace(/\b(?:RTE|RT|Rte)\.?\s*([0-9]+[A-Za-z]?|[A-Za-z]\s*Line)\b/gi, 'Route $1')
    .replace(/\b(?:RTE|RT)\b/gi, 'Route')
    .replace(/\bSTN\b/gi, 'Station')
    .replace(/\b(?:TC|TRANSIT CTR)\b/g, 'Transit Center')
    .replace(/\b(?:PNR|P&R)\b/gi, 'Park & Ride')
    .replace(/\bBETW\.?\b|\bBTW\.?\b/gi, 'between')
    .replace(/\bDTR\b/gi, 'detour')
    .replace(/\bX-?ING\b/gi, 'crossing')
    .replace(/\bTWP\b/gi, 'Township')
    .replace(/\bTEMP\.?\b/gi, 'temporary')
    .replace(/\bCONSTR\.?\b/gi, 'construction')
    .replace(/\bMAINT\.?\b/gi, 'maintenance')
    .replace(/\bEMERG\.?\b/gi, 'emergency')
    .replace(/\bSERV\.?\b/gi, 'service')
    .replace(/\bDISRUPT\.?\b/gi, 'disruption')
    .replace(/\bRESUME\s+REG(?:ULAR)?\s+R(?:OUT)?E\b/gi, 'resume regular route')
    .replace(/\bREG(?:ULAR)?\s+R(?:OUT)?E\b/gi, 'regular route');
}

const STREET_SUFFIXES = new Set([
  'st', 'street', 'ave', 'avenue', 'rd', 'road', 'blvd', 'boulevard',
  'pkwy', 'parkway', 'dr', 'drive', 'way', 'ct', 'court', 'pl', 'place',
  'ln', 'lane', 'hwy', 'highway', 'cir', 'circle', 'terr', 'terrace',
]);

const PROPER_TRANSIT_WORDS = new Set([
  'route', 'station', 'transit', 'center', 'park', 'ride',
]);

const DAYS_AND_MONTHS = new Set([
  'mon', 'monday', 'tue', 'tues', 'tuesday', 'wed', 'wednesday',
  'thu', 'thur', 'thurs', 'thursday', 'fri', 'friday', 'sat', 'saturday', 'sun', 'sunday',
  'jan', 'january', 'feb', 'february', 'mar', 'march', 'apr', 'april', 'may', 'jun', 'june',
  'jul', 'july', 'aug', 'august', 'sep', 'sept', 'september', 'oct', 'october', 'nov', 'november', 'dec', 'december',
]);

export function unshout(text: string): string {
  if (!text) return '';
  if (!isShouting(text)) {
    return text;
  }

  // Sentence split and transform
  const sentences = text.split(/([.?!:\n]+)/);
  const transformed = sentences.map((segment) => {
    if (/^[.?!:\n]+$/.test(segment)) {
      return segment;
    }

    const words = segment.split(' ');
    const cleanedWords = words.map((word, idx) => {
      const bareWord = word.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
      const prefix = word.slice(0, word.indexOf(bareWord));
      const suffix = word.slice(word.indexOf(bareWord) + bareWord.length);
      const lower = bareWord.toLowerCase();

      if (PRESERVED_ACRONYMS.has(bareWord.toUpperCase())) {
        return prefix + bareWord.toUpperCase() + suffix;
      }

      // If alphanumeric like 11A, 21B, 50603, keep uppercase letter
      if (/^[0-9]+[A-Z]$/.test(bareWord)) {
        return prefix + bareWord + suffix;
      }

      // If Roman numeral
      if (/^(?:I|II|III|IV|V|VI)$/i.test(bareWord)) {
        return prefix + bareWord.toUpperCase() + suffix;
      }

      // Directional letters in street names (e.g. 44th St W, Nicollet Mall S)
      if (/^(?:N|S|E|W|NE|NW|SE|SW)$/i.test(bareWord)) {
        return prefix + bareWord.toUpperCase() + suffix;
      }

      // Days of week and months
      if (DAYS_AND_MONTHS.has(lower)) {
        return prefix + bareWord.charAt(0).toUpperCase() + bareWord.slice(1).toLowerCase() + suffix;
      }

      // Street suffixes like St, Ave, Blvd, Rd
      if (STREET_SUFFIXES.has(lower)) {
        return prefix + bareWord.charAt(0).toUpperCase() + bareWord.slice(1).toLowerCase() + suffix;
      }

      // Proper transit words like Route, Station
      if (PROPER_TRANSIT_WORDS.has(lower)) {
        return prefix + bareWord.charAt(0).toUpperCase() + bareWord.slice(1).toLowerCase() + suffix;
      }

      // Check if word immediately precedes a street suffix (e.g. Lake St -> Lake)
      const nextWord = words[idx + 1]?.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '').toLowerCase();
      if (nextWord && (STREET_SUFFIXES.has(nextWord) || nextWord === '&' || nextWord === 'and')) {
        return prefix + bareWord.charAt(0).toUpperCase() + bareWord.slice(1).toLowerCase() + suffix;
      }

      // Check if word immediately follows a transit word (e.g. Route 21, Station Lake)
      const prevWord = words[idx - 1]?.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '').toLowerCase();
      if (prevWord && (prevWord === 'route' || prevWord === 'station' || prevWord === 'at' || prevWord === 'on' || prevWord === 'via' || prevWord === '&' || prevWord === 'and')) {
        if (!LOWERCASE_WORDS.has(lower)) {
          return prefix + bareWord.charAt(0).toUpperCase() + bareWord.slice(1).toLowerCase() + suffix;
        }
      }

      if (idx === 0) {
        return prefix + bareWord.charAt(0).toUpperCase() + bareWord.slice(1).toLowerCase() + suffix;
      }

      return prefix + bareWord.toLowerCase() + suffix;
    });

    return cleanedWords.join(' ');
  });

  return transformed.join('');
}

export function cleanDispatcherText(text: string): string {
  if (!text) return '';
  let cleaned = cleanWhitespace(text);
  cleaned = expandAcronyms(cleaned);
  cleaned = unshout(cleaned);

  // Post-clean capitalization for Route and directions
  cleaned = cleaned.replace(/\broute\s+([0-9]+[A-Za-z]?|[A-Za-z]\s*Line)/gi, 'Route $1');
  cleaned = cleaned.replace(/\bmetro\s+([A-Za-z]+)\s+line/gi, 'METRO $1 Line');

  return cleanWhitespace(cleaned);
}

export function toTitleCase(text: string): string {
  if (!text) return '';
  const words = text.split(/\s+/);
  return words
    .map((word, index) => {
      const lower = word.toLowerCase();
      // Handle Route numbers or hyphenated words
      if (word.includes('-')) {
        return word.split('-').map(toTitleCase).join('-');
      }
      if (PRESERVED_ACRONYMS.has(word.toUpperCase())) {
        return word.toUpperCase();
      }
      if (/^(?:[0-9]+[A-Z]?|[A-Z])$/i.test(word)) {
        return word.toUpperCase();
      }
      if (index !== 0 && index !== words.length - 1 && LOWERCASE_WORDS.has(lower)) {
        return lower;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}
