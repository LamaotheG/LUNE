
import { memo } from "react";
import type { SiteComparison } from "../../utils/comparison";

interface VisibilityWindowsProps {
  comparisons: SiteComparison[];
}

function VisibilityWindows({
  comparisons,
}: VisibilityWindowsProps) {
  if (comparisons.length < 2) {
    return null;
  }

  const formatTime = (timestamp: string) =>
    timestamp.slice(0, 16).replace("T", " ");

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
      <h2 className="mb-2 font-semibold">
        Mission Visibility Windows
      </h2>

      <p className="mb-5 text-xs text-slate-400">
        Yellow = Sun visible · Cyan = Earth link available
      </p>

      <div className="space-y-6">
        {comparisons.map((item) => {
          const samples = item.timeline.samples;
          const intervals = samples.slice(0, -1);
          const intervalHours = item.timeline.sampleIntervalSec / 3600;

          return (
            <div key={item.site.siteId}>
              <div className="mb-2 flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{
                    backgroundColor: item.site.color,
                  }}
                />
                <span className="text-sm font-medium">
                  {item.site.siteName}
                </span>
              </div>
              <p className="mb-2 text-xs text-slate-500">
                {intervals.length} steps · {intervalHours.toFixed(2)} h per step
              </p>

              <div className="space-y-1">
                <div className="flex h-3 overflow-hidden rounded-sm bg-slate-800">
                  {intervals.map((sample, index) => (
                    <div
                      key={`sun-${sample.timestamp}-${index}`}
                      className="h-full flex-1"
                      style={{
                        backgroundColor: sample.sun.visible
                          ? "#d16a34"
                          : "#493729",
                      }}
                      title={`Sun: ${sample.timestamp}`}
                    />
                  ))}
                </div>

                <div className="flex h-3 overflow-hidden rounded-sm bg-slate-800">
                  {intervals.map((sample, index) => (
                    <div
                      key={`earth-${sample.timestamp}-${index}`}
                      className="h-full flex-1"
                      style={{
                        backgroundColor:
                          sample.earth.directCommunicationAvailable
                            ? "#f2e5d2"
                            : "#493729",
                      }}
                      title={`Earth link: ${sample.timestamp}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex justify-between gap-4 text-xs text-slate-500">
        <span>{formatTime(comparisons[0].timeline.startTime)} UTC</span>
        <span>{formatTime(comparisons[0].timeline.endTime)} UTC</span>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Each segment represents one calculation step.
      </p>
    </section>
  );
}

export default memo(VisibilityWindows);
