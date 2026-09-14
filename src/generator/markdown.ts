import type { AlertDataset, EnrichedAlert } from '../types/index.js';

export function formatMarkdownAlert(alert: EnrichedAlert): string {
  const sevEmoji = alert.severity === 'Critical' ? '🚨' : alert.severity === 'Moderate' ? '⚠️' : 'ℹ️';
  const routesFormatted = alert.affectedRoutes.map(r => `\`${r}\``).join(' ');

  let md = `### ${sevEmoji} ${alert.title}\n\n`;
  md += `- **Affected Routes**: ${routesFormatted}\n`;
  md += `- **Direction**: ${alert.direction}\n`;
  md += `- **Severity**: \`${alert.severity}\`\n`;

  if (alert.activePeriod.textDescription) {
    md += `- **Schedule**: ${alert.activePeriod.textDescription}\n`;
  }

  if (alert.intersections.length > 0) {
    md += `- **Corridors & Intersections**: ${alert.intersections.join('; ')}\n`;
  }

  if (alert.closedStopIds.length > 0) {
    const stopsStr = alert.closedStopDetails.length > 0
      ? alert.closedStopDetails.map(s => s.name ? `${s.name} (Stop #${s.id})` : `Stop #${s.id}`).slice(0, 8).join(', ')
      : alert.closedStopIds.map(id => `#${id}`).slice(0, 8).join(', ');
    const moreCount = alert.closedStopIds.length > 8 ? ` *(+${alert.closedStopIds.length - 8} more)*` : '';
    md += `- **Closed Stops**: ${stopsStr}${moreCount}\n`;
  }

  md += `\n**Summary**: ${alert.summary}\n\n`;

  if (alert.riderAlternative) {
    md += `> 💡 **Rider Action**: ${alert.riderAlternative}\n\n`;
  }

  if (alert.detourDetails) {
    md += `> 🔄 **Detour Path**: ${alert.detourDetails}\n\n`;
  }

  if (alert.url) {
    md += `[Official Agency Advisory](${alert.url})\n\n`;
  }

  if (alert.rawHeader || alert.rawDescription) {
    md += `<details>\n<summary>Raw Dispatcher Message</summary>\n\n`;
    if (alert.rawHeader) {
      md += `**Header**: ${alert.rawHeader}\n\n`;
    }
    if (alert.rawDescription) {
      md += `\`\`\`text\n${alert.rawDescription}\n\`\`\`\n\n`;
    }
    md += `</details>\n\n`;
  }

  md += `---\n\n`;
  return md;
}

export function generateMarkdown(dataset: AlertDataset): string {
  const { metadata, alerts } = dataset;
  const critical = alerts.filter(a => a.severity === 'Critical');
  const moderate = alerts.filter(a => a.severity === 'Moderate');
  const minor = alerts.filter(a => a.severity === 'Minor');

  // Collect unique routes for index
  const routeMap = new Map<string, number>();
  for (const a of alerts) {
    for (const r of a.affectedRoutes) {
      routeMap.set(r, (routeMap.get(r) || 0) + 1);
    }
  }

  const sortedRoutes = Array.from(routeMap.entries()).sort((a, b) =>
    a[0].localeCompare(b[0], undefined, { numeric: true })
  );

  let md = `# 🚌 Transit Alert Mirror\n\n`;
  md += `> Automated plain-English enrichment engine for transit alerts, detours, and stop closures.\n\n`;

  md += `[![Alerts](https://img.shields.io/badge/Total%20Alerts-${metadata.totalAlerts}-blue)](#)\n`;
  md += `[![Critical](https://img.shields.io/badge/Critical-${metadata.criticalCount}-red)](#-critical-disruptions)\n`;
  md += `[![Moderate](https://img.shields.io/badge/Moderate-${metadata.moderateCount}-orange)](#-moderate-detours--changes)\n`;
  md += `[![Minor](https://img.shields.io/badge/Minor-${metadata.minorCount}-lightgrey)](#-minor-advisories)\n`;
  md += `[![Routes](https://img.shields.io/badge/Affected%20Routes-${metadata.affectedRoutesCount}-brightgreen)](#-routes-index)\n\n`;

  md += `*Last synchronized: **${metadata.generatedAt}** across **${metadata.agencies.join(', ')}**.*\n\n`;

  md += `## 📋 Routes Index\n\n`;
  if (sortedRoutes.length === 0) {
    md += `*No active route disruptions reported.*\n\n`;
  } else {
    md += sortedRoutes.map(([r, count]) => `**${r}** (${count})`).join(' • ') + '\n\n';
  }

  md += `## 🚨 Critical Disruptions\n\n`;
  if (critical.length === 0) {
    md += `*No critical suspensions or cancellations at this time.*\n\n`;
  } else {
    for (const alert of critical) {
      md += formatMarkdownAlert(alert);
    }
  }

  md += `## ⚠️ Moderate Detours & Changes\n\n`;
  if (moderate.length === 0) {
    md += `*No moderate detours or stop closures active.*\n\n`;
  } else {
    for (const alert of moderate) {
      md += formatMarkdownAlert(alert);
    }
  }

  md += `## ℹ️ Minor Advisories\n\n`;
  if (minor.length === 0) {
    md += `*No minor service advisories reported.*\n\n`;
  } else {
    for (const alert of minor) {
      md += formatMarkdownAlert(alert);
    }
  }

  md += `\n---\n*Generated automatically by [transit-alert-mirror](https://github.com/aminamos/transit-alert-mirror).*`;

  return md;
}
