
import { CalendarDays } from "lucide-react";

type DateControllerProps = {
  startDate: string;
  endDate: string;
  selectedStep: number;
  selectedTimestamp: string;
  intervalCount: number;
  intervalHours: number;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onStepChange: (step: number) => void;
};

export default function DateController({
  startDate,
  endDate,
  selectedStep,
  selectedTimestamp,
  intervalCount,
  intervalHours,
  onStartDateChange,
  onEndDateChange,
  onStepChange,
}: DateControllerProps) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold">
          <CalendarDays size={18} className="text-cyan-400" />
          Mission Date Range & Time
        </h2>

        <span className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-400">
          UTC
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm">
          <span className="text-slate-300">Start Date (UTC)</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              if (e.target.value) {
                onStartDateChange(e.target.value);
              }
            }}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm">
          <span className="text-slate-300">End Date (UTC)</span>
          <input
            type="date"
            value={endDate}
            min={startDate}
            onChange={(e) => {
              if (e.target.value && e.target.value >= startDate) {
                onEndDateChange(e.target.value);
              }
            }}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
          />
        </label>
      </div>

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm text-slate-300">
            Mission Timeline
          </span>

          <span className="text-sm font-semibold text-cyan-400">
            Step {selectedStep} / {intervalCount}
          </span>
        </div>

        <input
          type="range"
          min={0}
          max={intervalCount}
          step={1}
          value={selectedStep}
          onChange={(e) =>
            onStepChange(Number(e.target.value))
          }
          className="w-full accent-cyan-400"
        />

        <div className="mt-2 flex justify-between text-xs text-slate-500">
          <span>Start</span>
          <span>Midpoint</span>
          <span>End</span>
        </div>

        <p className="mt-3 text-xs text-slate-400">
          {intervalCount} calculation steps · {intervalCount + 1} timestamp samples
          <span className="ml-2">· {intervalHours.toFixed(2)} hours per step</span>
        </p>
      </div>

      <div className="mt-5 rounded-lg bg-slate-950 p-4">
        <p className="mb-1 text-xs text-slate-400">
          Selected Timestamp (UTC)
        </p>

        <p className="font-mono text-sm text-cyan-400">
          {selectedTimestamp}
        </p>
      </div>
    </section>
  );
}
