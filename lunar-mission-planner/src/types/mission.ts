export interface LunarSite {
  siteId: string;
  siteName: string;
  latitudeDeg: number;
  longitudeDeg: number;
  color: string;
}

export interface CelestialBodyData {
  azimuthDeg: number;
  geometricElevationDeg: number;
  terrainHorizonElevationDeg: number;
  visible: boolean;
}

export interface SunData extends CelestialBodyData {
  solarDiskFraction: number;
  irradianceWM2: number | null;
  horizontalPanelPowerWM2: number | null;
  verticalMastPowerWM2: number | null;
  configuredPanelPowerWM2: number | null;
}

export interface SolarPowerSettings {
  panelAreaM2: number;
  panelTiltDeg: number;
  panelAzimuthDeg: number;
  cellEfficiencyPercent: number;
}

export interface SolarTimelineSummary {
  totalDurationSec: number;
  sunVisibleDurationSec: number;
  sunVisiblePercentage: number;
  configuredPanelEnergyWhM2: number;
  averageConfiguredPanelPowerWM2: number;
  peakConfiguredPanelPowerWM2: number;
  peakIrradianceWM2: number;
}

export interface EarthData extends CelestialBodyData {
  directCommunicationAvailable: boolean;
}

export interface SiteAnalysis {
  siteId: string;
  timestamp: string;
  sun: SunData;
  earth: EarthData;
}

export interface TimelineSample {
  timestamp: string;
  sun: SunData;
  earth: EarthData;
}

export interface SiteTimeline {
  siteId: string;
  startTime: string;
  endTime: string;
  sampleIntervalSec: number;
  samples: TimelineSample[];
  solarSummary: SolarTimelineSummary;
}
