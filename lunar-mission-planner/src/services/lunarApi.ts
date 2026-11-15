
import type { BackendVisibilityResponse } from "./lunarAdapter";

// Empty by default so Vite proxies /api to FastAPI during development.
// Set VITE_API_BASE_URL when the frontend and backend are deployed separately.
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

export interface LunarVisibilityRequest {
  start_time_utc: string;
  end_time_utc: string;
  latitude_deg: number;
  longitude_deg: number;
  time_step_minutes?: number;
  max_terrain_distance_m?: number;
  azimuth_interval_deg?: number;
  terrain_sample_spacing_m?: number;
  panel_tilt_deg?: number;
  panel_azimuth_deg?: number;
  cell_efficiency?: number;
}

export async function fetchLunarVisibility(
  request: LunarVisibilityRequest,
  signal?: AbortSignal
): Promise<BackendVisibilityResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/lunar-visibility`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error(
      "Cannot reach the lunar backend. Start it with `npm run dev:backend`, then try again.",
    );
  }

  if (!response.ok) {
    const body = await response.text();
    let message = body;
    try {
      const parsed = JSON.parse(body) as { detail?: string };
      message = parsed.detail ?? body;
    } catch {
      // Keep the original response body when the backend did not return JSON.
    }
    throw new Error(`Backend error ${response.status}: ${message}`);
  }

  return (await response.json()) as BackendVisibilityResponse;
}
