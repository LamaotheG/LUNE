import { useEffect, useState } from "react";
import { Sun } from "lucide-react";
import type {
  SiteAnalysis,
  SiteTimeline,
  SolarPowerSettings,
} from "../../types/mission";

interface SolarPanelProps {
  analysis: SiteAnalysis | null;
  timeline: SiteTimeline | null;
  settings: SolarPowerSettings;
  onSettingsChange: (settings: SolarPowerSettings) => void;
}

function formatDuration(durationMs: number): string {
  const totalMinutes = Math.max(0, Math.ceil(durationMs / 60_000));
  if (totalMinutes === 0) return "Less than 1 min";

  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes && parts.length < 2) parts.push(`${minutes}m`);
  return parts.join(" ");
}

function getNextSunTransition(
  timeline: SiteTimeline | null,
  currentTimestamp: string | undefined,
  currentlyVisible: boolean,
): number | null {
  if (!timeline || !currentTimestamp || timeline.samples.length < 2) return null;

  const selectedMs = new Date(currentTimestamp).getTime();
  let currentIndex = 0;
  let closestDifference = Number.POSITIVE_INFINITY;
  timeline.samples.forEach((sample, index) => {
    const difference = Math.abs(new Date(sample.timestamp).getTime() - selectedMs);
    if (difference < closestDifference) {
      closestDifference = difference;
      currentIndex = index;
    }
  });

  const currentMs = new Date(timeline.samples[currentIndex].timestamp).getTime();
  for (let index = currentIndex + 1; index < timeline.samples.length; index += 1) {
    if (timeline.samples[index].sun.visible !== currentlyVisible) {
      return new Date(timeline.samples[index].timestamp).getTime() - currentMs;
    }
  }
  return null;
}

export default function SolarPanel({
  analysis,
  timeline,
  settings,
  onSettingsChange,
}: SolarPanelProps) {
  const sun = analysis?.sun;
  const summary = timeline?.solarSummary;
  const transitionMs = sun
    ? getNextSunTransition(timeline, analysis?.timestamp, sun.visible)
    : null;

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
      <h2 className="mb-5 flex items-center gap-2 font-semibold">
        <Sun size={18} className="text-yellow-400" />
        Solar Availability
      </h2>

      <div className="solar-panel-settings">
        <p className="solar-settings-title">Power model inputs</p>
        <div className="solar-settings-grid">
          <SettingInput
            label="Panel area (m²)"
            value={settings.panelAreaM2}
            min={0.01}
            max={10000}
            step={0.1}
            onChange={(value) => onSettingsChange({ ...settings, panelAreaM2: value })}
          />
          <SettingInput
            label="Panel tilt (°)"
            value={settings.panelTiltDeg}
            min={0}
            max={180}
            step={1}
            onChange={(value) => onSettingsChange({ ...settings, panelTiltDeg: value })}
          />
          <SettingInput
            label="Panel azimuth (°)"
            value={settings.panelAzimuthDeg}
            min={0}
            max={360}
            step={1}
            onChange={(value) => onSettingsChange({ ...settings, panelAzimuthDeg: value })}
          />
          <SettingInput
            label="Cell efficiency (%)"
            value={settings.cellEfficiencyPercent}
            min={1}
            max={100}
            step={1}
            onChange={(value) => onSettingsChange({ ...settings, cellEfficiencyPercent: value })}
          />
        </div>
        <p className="solar-settings-hint">Tilt: 0° horizontal · 90° vertical. Azimuth: 0° north · 90° east.</p>
      </div>

      {!sun ? (
        <p className="text-sm text-slate-400">
          Select a landing site to view solar analysis.
        </p>
      ) : (
        <>
          <p className={`mb-3 text-xl font-bold ${
            sun.visible ? "text-green-400" : "text-red-400"
          }`}>
            {sun.visible ? "Direct Sunlight" : "Terrain Shadow"}
          </p>

          <div className="solar-transition">
            <span>{sun.visible ? "Sunlight ends in" : "Next sunlight in"}</span>
            <strong>
              {transitionMs === null
                ? "No transition in selected window"
                : formatDuration(transitionMs)}
            </strong>
            {timeline && (
              <small>
                Estimated from {Math.round(timeline.sampleIntervalSec / 60)}-minute calculation steps
              </small>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <Metric label="Sun elevation"
              value={`${sun.geometricElevationDeg.toFixed(2)}°`} />
            <Metric label="Sun azimuth"
              value={`${sun.azimuthDeg.toFixed(2)}°`} />
            <Metric label="Terrain horizon"
              value={`${sun.terrainHorizonElevationDeg.toFixed(2)}°`} />
            <Metric label="Direct solar flux"
              value={sun.irradianceWM2 === null
                ? "N/A" : `${sun.irradianceWM2.toFixed(1)} W/m²`} />
            <Metric label="Sun disk illuminated"
              value={`${(sun.solarDiskFraction * 100).toFixed(1)}%`} />
            <Metric label="Horizontal panel potential"
              value={sun.horizontalPanelPowerWM2 === null
                ? "N/A" : `${sun.horizontalPanelPowerWM2.toFixed(1)} W/m²`} />
            <Metric label="Vertical mast potential"
              value={sun.verticalMastPowerWM2 === null
                ? "N/A" : `${sun.verticalMastPowerWM2.toFixed(1)} W/m²`} />
            <div className="solar-power-output">
              <Metric label="Configured panel output"
                value={sun.configuredPanelPowerWM2 === null
                  ? "N/A" : `${(sun.configuredPanelPowerWM2 * settings.panelAreaM2).toFixed(1)} W`} />
              <p className="solar-dust-note">
                Dust accumulation can reduce actual panel output, so calculated power may differ.
              </p>
            </div>
            <Metric label="Sunlight availability"
              value={summary ? `${summary.sunVisiblePercentage.toFixed(1)}%` : "N/A"} />
            <Metric label="Energy over selected window"
              value={summary
                ? `${(summary.configuredPanelEnergyWhM2 * settings.panelAreaM2).toFixed(1)} Wh`
                : "N/A"} />
            <Metric label="Peak sampled panel output"
              value={summary
                ? `${(summary.peakConfiguredPanelPowerWM2 * settings.panelAreaM2).toFixed(1)} W`
                : "N/A"} />
            <Metric label="Average output across window"
              value={summary
                ? `${(summary.averageConfiguredPanelPowerWM2 * settings.panelAreaM2).toFixed(1)} W`
                : "N/A"} />
            <Metric label="Peak direct solar flux"
              value={summary ? `${summary.peakIrradianceWM2.toFixed(1)} W/m²` : "N/A"} />
          </div>
        </>
      )}
    </section>
  );
}

function SettingInput({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    const parsed = Number(draft);
    if (!draft.trim() || !Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }
    const normalized = Math.min(max, Math.max(min, parsed));
    setDraft(String(normalized));
    onChange(normalized);
  };

  return (
    <label className="solar-setting-input">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") setDraft(String(value));
        }}
      />
    </label>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="mb-1 text-xs text-slate-400">{label}</p>
      <p className="font-mono font-semibold">{value}</p>
    </div>
  );
}
