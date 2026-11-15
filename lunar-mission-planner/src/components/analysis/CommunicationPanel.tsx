
import { Radio } from "lucide-react";
import type { SiteAnalysis } from "../../types/mission";

interface CommunicationPanelProps {
  analysis: SiteAnalysis | null;
}

export default function CommunicationPanel({
  analysis,
}: CommunicationPanelProps) {
  const earth = analysis?.earth;

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
      <h2 className="mb-5 flex items-center gap-2 font-semibold">
        <Radio size={18} className="text-cyan-400" />
        Communication Availability
      </h2>

      {!earth ? (
        <p className="text-sm text-slate-400">
          Select a landing site to view Earth visibility.
        </p>
      ) : (
        <>
          <p className={`mb-4 text-xl font-bold ${
            earth.directCommunicationAvailable
              ? "text-green-400"
              : "text-red-400"
          }`}>
            {earth.directCommunicationAvailable
              ? "Direct Earth Link Available"
              : "Direct Earth Link Unavailable"}
          </p>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <Metric label="Earth elevation"
              value={`${earth.geometricElevationDeg.toFixed(2)}°`} />
            <Metric label="Earth azimuth"
              value={`${earth.azimuthDeg.toFixed(2)}°`} />
            <Metric label="Terrain horizon"
              value={`${earth.terrainHorizonElevationDeg.toFixed(2)}°`} />
            <Metric label="Earth visible"
              value={earth.visible ? "Yes" : "No"} />
          </div>
        </>
      )}
    </section>
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
