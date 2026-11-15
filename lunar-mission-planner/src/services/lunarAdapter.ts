import type { SiteAnalysis, SiteTimeline } from "../types/mission";

interface BackendSnapshot {
  timestamp_utc: string;
  sun: {
    azimuth_deg: number;
    elevation_deg: number;
    terrain_horizon_elevation_deg: number;
    solar_power: {
      sun_visible: boolean;
      solar_disk_fraction: number;
      incident_direct_flux_w_m2: number;
      horizontal_power_w_m2: number;
      vertical_mast_power_w_m2: number;
      custom_panel_power_w_m2: number;
    };
  };
  earth: {
    azimuth_deg: number;
    elevation_deg: number;
    terrain_horizon_elevation_deg: number;
    dsn_communication: {
      earth_visible_on_moon: boolean;
      any_dsn_link_active: boolean;
    };
  };
}

export interface BackendVisibilityResponse {
  status: string;
  timeline: BackendSnapshot[];
}

function convertSnapshot(
  siteId: string,
  snapshot: BackendSnapshot,
): SiteAnalysis {
  return {
    siteId,
    timestamp: snapshot.timestamp_utc,
    sun: {
      azimuthDeg: snapshot.sun.azimuth_deg,
      geometricElevationDeg: snapshot.sun.elevation_deg,
      terrainHorizonElevationDeg: snapshot.sun.terrain_horizon_elevation_deg,
      visible: snapshot.sun.solar_power.sun_visible,
      solarDiskFraction: snapshot.sun.solar_power.solar_disk_fraction,
      irradianceWM2: snapshot.sun.solar_power.incident_direct_flux_w_m2,
      horizontalPanelPowerWM2: snapshot.sun.solar_power.horizontal_power_w_m2,
      verticalMastPowerWM2: snapshot.sun.solar_power.vertical_mast_power_w_m2,
      configuredPanelPowerWM2: snapshot.sun.solar_power.custom_panel_power_w_m2,
    },
    earth: {
      azimuthDeg: snapshot.earth.azimuth_deg,
      geometricElevationDeg: snapshot.earth.elevation_deg,
      terrainHorizonElevationDeg: snapshot.earth.terrain_horizon_elevation_deg,
      visible: snapshot.earth.dsn_communication.earth_visible_on_moon,
      directCommunicationAvailable:
        snapshot.earth.dsn_communication.any_dsn_link_active,
    },
  };
}


export function adaptBackendResponse(
  siteId: string,
  response: BackendVisibilityResponse,
  sampleIntervalSec = 600
): {
  analyses: SiteAnalysis[];
  timeline: SiteTimeline;
} {
  if (
    response.status !== "success" ||
    !Array.isArray(response.timeline) ||
    response.timeline.length === 0
  ) {
    throw new Error("Invalid backend visibility response");
  }

  const analyses = response.timeline.map((snapshot) =>
    convertSnapshot(siteId, snapshot),
  );

  const timeline: SiteTimeline = {
    siteId,
    startTime: analyses[0].timestamp,
    endTime: analyses[analyses.length - 1].timestamp,
    sampleIntervalSec,
    samples: analyses.map((analysis) => ({
      timestamp: analysis.timestamp,
      sun: analysis.sun,
      earth: analysis.earth,
    })),
    solarSummary: calculateSolarSummary(analyses),
  };

  return { analyses, timeline };
}

function calculateSolarSummary(analyses: SiteAnalysis[]) {
  let totalDurationSec = 0;
  let sunVisibleDurationSec = 0;
  let configuredPanelEnergyWhM2 = 0;
  let peakConfiguredPanelPowerWM2 = 0;
  let peakIrradianceWM2 = 0;

  for (let index = 0; index < analyses.length; index += 1) {
    const current = analyses[index];
    const power = current.sun.configuredPanelPowerWM2 ?? 0;
    peakConfiguredPanelPowerWM2 = Math.max(peakConfiguredPanelPowerWM2, power);
    peakIrradianceWM2 = Math.max(peakIrradianceWM2, current.sun.irradianceWM2 ?? 0);
    if (index === analyses.length - 1) continue;

    const next = analyses[index + 1];
    const elapsedSec = Math.max(
      0,
      (new Date(next.timestamp).getTime() - new Date(current.timestamp).getTime()) / 1000,
    );
    totalDurationSec += elapsedSec;
    if (current.sun.visible) sunVisibleDurationSec += elapsedSec;
    configuredPanelEnergyWhM2 += power * elapsedSec / 3600;
  }

  return {
    totalDurationSec,
    sunVisibleDurationSec,
    sunVisiblePercentage: totalDurationSec > 0
      ? 100 * sunVisibleDurationSec / totalDurationSec
      : 0,
    configuredPanelEnergyWhM2,
    averageConfiguredPanelPowerWM2: totalDurationSec > 0
      ? configuredPanelEnergyWhM2 * 3600 / totalDurationSec
      : 0,
    peakConfiguredPanelPowerWM2,
    peakIrradianceWM2,
  };
}
