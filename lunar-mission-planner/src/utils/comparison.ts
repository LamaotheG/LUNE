
import type {
  LunarSite,
  SiteTimeline,
} from "../types/mission";

export interface SiteComparison {
  site: LunarSite;
  timeline: SiteTimeline;
  sunlightHours: number;
  communicationHours: number;
  simultaneousHours: number;
  sunlightPercent: number;
  communicationPercent: number;
}


export function buildSiteComparisons(
  sites: LunarSite[],
  timelines: SiteTimeline[]
): SiteComparison[] {
  const timelineBySiteId = new Map(
    timelines.map((timeline) => [timeline.siteId, timeline]),
  );

  return sites.flatMap((site) => {
    const timeline = timelineBySiteId.get(site.siteId);

    // Do not generate fake results for missing sites.
    if (!timeline || timeline.samples.length === 0) {
      return [];
    }

    const samples = timeline.samples;
    const intervals = samples.slice(0, -1);
    if (intervals.length === 0) return [];
    const intervalHours =
      timeline.sampleIntervalSec / 3600;

    let sunlightIntervals = 0;
    let communicationIntervals = 0;
    let simultaneousIntervals = 0;
    for (const sample of intervals) {
      const sunVisible = sample.sun.visible;
      const communicationAvailable = sample.earth.directCommunicationAvailable;
      if (sunVisible) sunlightIntervals += 1;
      if (communicationAvailable) communicationIntervals += 1;
      if (sunVisible && communicationAvailable) simultaneousIntervals += 1;
    }

    const totalIntervals = intervals.length;

    return [{
      site,
      timeline,
      sunlightHours: sunlightIntervals * intervalHours,
      communicationHours:
        communicationIntervals * intervalHours,
      simultaneousHours:
        simultaneousIntervals * intervalHours,
      sunlightPercent:
        (sunlightIntervals / totalIntervals) * 100,
      communicationPercent:
        (communicationIntervals / totalIntervals) * 100,
    }];
  });
}
