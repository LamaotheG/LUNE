import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

import type { SiteTimeline } from "../../types/mission";

interface TimelineProps {
  timeline: SiteTimeline | null;
  selectedTimestamp: string;
}

export default function Timeline({
  timeline,
  selectedTimestamp,
}: TimelineProps) {
  if (!timeline) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="font-semibold">Visibility Timeline</h2>
        <p className="mt-3 text-sm text-slate-400">
          Select a landing site to view its timeline.
        </p>
      </section>
    );
  }

  const data = timeline.samples.map((sample) => ({
    time: sample.timestamp.slice(11, 16),
    sunElevation: sample.sun.geometricElevationDeg,
    earthElevation: sample.earth.geometricElevationDeg,
  }));

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
      <h2 className="mb-2 font-semibold">Sun & Earth Elevation Timeline</h2>

      <p className="mb-5 text-xs text-slate-400">
        Selected time: {selectedTimestamp}
      </p>

      <div className="h-75 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid stroke="#493729" strokeDasharray="3 3" />
            <XAxis dataKey="time" stroke="#b6a58f" minTickGap={30} />
            <YAxis stroke="#b6a58f" unit="°" />
            <Tooltip
              contentStyle={{
                backgroundColor: "#17110c",
                border: "1px solid #493729",
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="sunElevation"
              name="Sun elevation"
              stroke="#e38a4c"
              dot={false}
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="earthElevation"
              name="Earth elevation"
              stroke="#f2e5d2"
              dot={false}
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
