
import { useEffect, useMemo, useState } from "react";
import { buildAnalysisRange } from "../utils/dateRange";

import type {
  LunarSite,
  SolarPowerSettings,
  SiteAnalysis,
  SiteTimeline,
} from "../types/mission";

import { fetchLunarVisibility } from "../services/lunarApi";
import {
  adaptBackendResponse,
  type BackendVisibilityResponse,
} from "../services/lunarAdapter";

const MAX_CACHED_RESPONSES = 64;
const responseCache = new Map<string, BackendVisibilityResponse>();

function getCachedResponse(key: string) {
  const response = responseCache.get(key);
  if (!response) return undefined;
  responseCache.delete(key);
  responseCache.set(key, response);
  return response;
}

function cacheResponse(key: string, response: BackendVisibilityResponse) {
  responseCache.delete(key);
  responseCache.set(key, response);
  while (responseCache.size > MAX_CACHED_RESPONSES) {
    const oldestKey = responseCache.keys().next().value;
    if (oldestKey === undefined) break;
    responseCache.delete(oldestKey);
  }
}

interface LoadedData {
  timelines: SiteTimeline[];
  error: string | null;
  requestKey: string;
}

const TERRAIN_SETTINGS = {
  max_terrain_distance_m: 1000,
  azimuth_interval_deg: 10,
  terrain_sample_spacing_m: 100,
};

function nearestAnalysis(
  timeline: SiteTimeline,
  timestamp: string
): SiteAnalysis | null {
  if (timeline.samples.length === 0) {
    return null;
  }

  const target = new Date(timestamp).getTime();

  let nearest = timeline.samples[0];
  let nearestDifference = Math.abs(
    new Date(nearest.timestamp).getTime() - target,
  );
  for (let index = 1; index < timeline.samples.length; index += 1) {
    const sample = timeline.samples[index];
    const difference = Math.abs(new Date(sample.timestamp).getTime() - target);
    if (difference < nearestDifference) {
      nearest = sample;
      nearestDifference = difference;
    }
  }

  return {
    siteId: timeline.siteId,
    timestamp: nearest.timestamp,
    sun: nearest.sun,
    earth: nearest.earth,
  };
}

export function useLunarBackend(
  sites: LunarSite[],
  selectedTimestamp: string,
  startDate: string,
  endDate: string,
  powerSettings: SolarPowerSettings,
) {
  const [data, setData] = useState<LoadedData>({
    timelines: [],
    error: null,
    requestKey: "",
  });

  const sitesKey = JSON.stringify(
    sites.map((site) => ({
      siteId: site.siteId,
      latitudeDeg: site.latitudeDeg,
      longitudeDeg: site.longitudeDeg,
    }))
  );

  // Keep slider movement local to the loaded timeline. Recalculate only when
  // site coordinates or either end of the requested date range changes.
  const range = useMemo(
    () => buildAnalysisRange(startDate, endDate),
    [startDate, endDate],
  );
  const powerRequest = useMemo(() => ({
    panel_tilt_deg: powerSettings.panelTiltDeg,
    panel_azimuth_deg: powerSettings.panelAzimuthDeg,
    cell_efficiency: powerSettings.cellEfficiencyPercent / 100,
  }), [
    powerSettings.panelTiltDeg,
    powerSettings.panelAzimuthDeg,
    powerSettings.cellEfficiencyPercent,
  ]);
  const requestKey = `${sitesKey}|${range.startTimeUtc}|${range.endTimeUtc}|${JSON.stringify(powerRequest)}`;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const requestSites = JSON.parse(sitesKey) as Array<
      Pick<LunarSite, "siteId" | "latitudeDeg" | "longitudeDeg">
    >;

    if (requestSites.length === 0) {
      return () => {
        active = false;
        controller.abort();
      };
    }

    async function load() {
      try {
        const results = await Promise.all(
          requestSites.map(async (site) => {
            const request = {
              start_time_utc: range.startTimeUtc,
              end_time_utc: range.endTimeUtc,
              latitude_deg: site.latitudeDeg,
              longitude_deg: site.longitudeDeg,
              time_step_minutes: range.timeStepMinutes,

              ...TERRAIN_SETTINGS,
              ...powerRequest,
            };

            // Reuse a completed calculation when another site is added or the
            // user returns to the same site and date range. Coordinates and
            // every backend setting are part of the request key.
            const responseKey = JSON.stringify(request);
            const response =
              getCachedResponse(responseKey) ??
              await fetchLunarVisibility(request, controller.signal);
            cacheResponse(responseKey, response);

            return adaptBackendResponse(
              site.siteId,
              response,
              range.sampleIntervalSec
            );
          })
        );

        if (!active) return;

        setData({
          timelines: results.map(
            (result) => result.timeline
          ),
          error: null,
          requestKey,
        });
      } catch (error) {
        if (!active || controller.signal.aborted) {
          return;
        }

        setData({
          timelines: [],
          error:
            error instanceof Error
              ? error.message
              : "Unknown backend error",
          requestKey,
        });
      }
    }

    const requestTimer = window.setTimeout(() => {
      void load();
    }, 200);

    return () => {
      active = false;
      window.clearTimeout(requestTimer);
      controller.abort();
    };

  }, [sitesKey, requestKey, range, powerRequest]);

  const current = data.requestKey === requestKey;

  const timelines = useMemo(
    () => (current ? data.timelines : []),
    [current, data.timelines]
  );

  const analyses = useMemo(
    () =>
      timelines
        .map((timeline) =>
          nearestAnalysis(timeline, selectedTimestamp)
        )
        .filter(
          (analysis): analysis is SiteAnalysis =>
            analysis !== null
        ),
    [timelines, selectedTimestamp]
  );

  return {
    analyses,
    timelines,
    loading: sites.length > 0 && !current,
    error: current ? data.error : null,
    source: current ? "live" : "none",
  };
}
