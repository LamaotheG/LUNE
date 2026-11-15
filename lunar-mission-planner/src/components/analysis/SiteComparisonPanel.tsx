
import { GitCompareArrows } from "lucide-react";

import type { SiteComparison } from "../../utils/comparison";

interface SiteComparisonPanelProps {
  comparisons: SiteComparison[];
  activeSiteId: string | null;
  onSelectSite: (siteId: string) => void;
}

export default function SiteComparisonPanel({
  comparisons,
  activeSiteId,
  onSelectSite,
}: SiteComparisonPanelProps) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
      <h2 className="mb-4 flex items-center gap-2 font-semibold">
        <GitCompareArrows size={18} className="text-cyan-400" />
        Landing Site Comparison
      </h2>

      {comparisons.length < 2 ? (
        <p className="text-sm text-slate-400">
          Add at least two landing sites to compare
          their solar and communication conditions.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-150 text-left text-sm">
            <thead className="border-b border-slate-700 text-xs text-slate-400">
              <tr>
                <th className="pb-3 pr-4">Landing Site</th>
                <th className="pb-3 pr-4">Sunlight</th>
                <th className="pb-3 pr-4">Earth Link</th>
                <th className="pb-3 pr-4">Both</th>
                <th className="pb-3">Solar %</th>
              </tr>
            </thead>

            <tbody>
              {comparisons.map((item) => (
                <tr
                  key={item.site.siteId}
                  className={`border-b border-slate-800 ${
                    item.site.siteId === activeSiteId
                      ? "bg-slate-800/70"
                      : ""
                  }`}
                >
                  <td className="py-4 pr-4">
                    <button
                      onClick={() =>
                        onSelectSite(item.site.siteId)
                      }
                      className="flex items-center gap-2 hover:text-cyan-400"
                    >
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{
                          backgroundColor: item.site.color,
                        }}
                      />
                      {item.site.siteName}
                    </button>
                  </td>

                  <td className="py-4 pr-4">
                    {item.sunlightHours.toFixed(1)} h
                  </td>

                  <td className="py-4 pr-4">
                    {item.communicationHours.toFixed(1)} h
                  </td>

                  <td className="py-4 pr-4">
                    {item.simultaneousHours.toFixed(1)} h
                  </td>

                  <td className="py-4">
                    {item.sunlightPercent.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {comparisons.length >= 2 && (
        <p className="mt-4 text-xs text-slate-400">
          Metrics calculated from backend mission timelines.
        </p>
      )}
    </section>
  );
}
