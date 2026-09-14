import type { AlertDataset } from '../types/index.js';

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function generateRss(dataset: AlertDataset): string {
  const { metadata, alerts } = dataset;
  const buildDate = new Date(metadata.generatedAt).toUTCString();

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Transit Alert Mirror - Enriched Advisories</title>
    <link>https://github.com/aminamos/transit-alert-mirror</link>
    <description>Plain-English transit alert, detour, and service advisory enrichment mirror</description>
    <lastBuildDate>${buildDate}</lastBuildDate>
    <language>en-us</language>
    <generator>transit-alert-mirror</generator>
`;

  for (const alert of alerts) {
    const pubDate = new Date(alert.updatedAt).toUTCString();
    const link = alert.url || 'https://github.com/aminamos/transit-alert-mirror';
    const routes = alert.affectedRoutes.join(', ');
    const desc = escapeXml(
      `${alert.summary}${alert.riderAlternative ? ' | Action: ' + alert.riderAlternative : ''}`
    );

    xml += `    <item>
      <title>[${alert.severity}] ${escapeXml(alert.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="false">${escapeXml(alert.agency)}-${escapeXml(alert.id)}-${escapeXml(alert.updatedAt)}</guid>
      <pubDate>${pubDate}</pubDate>
      <category>${escapeXml(alert.severity)}</category>
      <category>${escapeXml(routes)}</category>
      <description>${desc}</description>
    </item>\n`;
  }

  xml += `  </channel>
</rss>`;

  return xml;
}
