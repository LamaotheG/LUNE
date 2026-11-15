
export const TARGET_STEP_HOURS = 2;
export const MAX_ANALYSIS_INTERVALS = 50;

export function buildAnalysisRange(
  startDate: string,
  endDate: string,
) {
  if (!startDate || !endDate) {
    throw new Error("Select both a start and end date.");
  }

  // Treat selected calendar dates as UTC.
  // Include the entire selected end date.
  const start = new Date(`${startDate}T00:00:00Z`);
  const endExclusive = new Date(`${endDate}T00:00:00Z`);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);

  if (
    !Number.isFinite(start.getTime()) ||
    !Number.isFinite(endExclusive.getTime())
  ) {
    throw new Error("Invalid date range.");
  }

  if (start.getTime() >= endExclusive.getTime()) {
    throw new Error("End date must not precede start date.");
  }

  const durationMs = endExclusive.getTime() - start.getTime();
  const requestedIntervals = Math.ceil(
    durationMs / (TARGET_STEP_HOURS * 60 * 60 * 1000),
  );
  const intervalCount = Math.min(requestedIntervals, MAX_ANALYSIS_INTERVALS);
  const intervalMs = durationMs / intervalCount;

  return {
    startTimeUtc: start.toISOString(),
    endTimeUtc: endExclusive.toISOString(),
    timeStepMinutes: intervalMs / 60_000,
    sampleIntervalSec: intervalMs / 1000,
    intervalCount,
    expectedSampleCount: intervalCount + 1,
  };
}
