import { useState, type FormEvent } from "react";
import { Check, MapPin, Pencil, Plus, Trash2, X } from "lucide-react";

import type { LunarSite } from "../../types/mission";
import type { LunarCoordinates } from "../../utils/coordinates";

interface SiteManagerProps {
  sites: LunarSite[];
  activeSiteId: string | null;
  pendingCoordinates: LunarCoordinates | null;
  onAddSite: () => void;
  onAddCoordinates: (latitudeDeg: number, longitudeDeg: number) => void;
  onSelectSite: (siteId: string) => void;
  onRemoveSite: (siteId: string) => void;
  onRenameSite: (siteId: string, siteName: string) => void;
}

export default function SiteManager({
  sites,
  activeSiteId,
  pendingCoordinates,
  onAddSite,
  onAddCoordinates,
  onSelectSite,
  onRemoveSite,
  onRenameSite,
}: SiteManagerProps) {
  const [latitudeInput, setLatitudeInput] = useState("");
  const [longitudeInput, setLongitudeInput] = useState("");
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");

  const latitude = Number(latitudeInput);
  const longitude = Number(longitudeInput);
  const coordinatesValid =
    latitudeInput.trim() !== "" &&
    longitudeInput.trim() !== "" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 && latitude <= 90 &&
    longitude >= -180 && longitude <= 180;

  const handleCoordinateSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!coordinatesValid) return;
    onAddCoordinates(latitude, longitude);
    setLatitudeInput("");
    setLongitudeInput("");
  };

  const beginRename = (site: LunarSite) => {
    setEditingSiteId(site.siteId);
    setNameInput(site.siteName);
  };

  const saveRename = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanName = nameInput.trim();
    if (!editingSiteId || !cleanName) return;
    onRenameSite(editingSiteId, cleanName);
    setEditingSiteId(null);
  };

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
      <h2 className="mb-4 flex items-center gap-2 font-semibold">
        <MapPin size={18} className="text-cyan-400" />
        Selected Landing Sites
      </h2>

      {pendingCoordinates && (
        <div className="mb-4 rounded-lg border border-cyan-800 bg-cyan-950/30 p-3 text-sm">
          <p className="mb-2 font-semibold text-cyan-400">Globe Selection</p>
          <p>Latitude: {pendingCoordinates.latitudeDeg.toFixed(4)}°</p>
          <p>Longitude: {pendingCoordinates.longitudeDeg.toFixed(4)}°</p>
          <button
            type="button"
            onClick={onAddSite}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 font-medium text-white hover:bg-cyan-500"
          >
            <Plus size={16} /> Add Selected Location
          </button>
        </div>
      )}

      <form className="site-coordinate-entry" onSubmit={handleCoordinateSubmit}>
        <p className="site-form-label">Enter coordinates manually</p>
        <div className="site-coordinate-fields">
          <label>
            <span>Latitude</span>
            <input
              type="number"
              inputMode="decimal"
              min="-90"
              max="90"
              step="any"
              value={latitudeInput}
              onChange={(event) => setLatitudeInput(event.target.value)}
              placeholder="-89.9000"
              aria-label="Landing site latitude"
            />
          </label>
          <label>
            <span>Longitude</span>
            <input
              type="number"
              inputMode="decimal"
              min="-180"
              max="180"
              step="any"
              value={longitudeInput}
              onChange={(event) => setLongitudeInput(event.target.value)}
              placeholder="0.0000"
              aria-label="Landing site longitude"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={!coordinatesValid}
          className="site-coordinate-submit"
        >
          <Plus size={15} /> Add Coordinates
        </button>
        {(latitudeInput || longitudeInput) && !coordinatesValid && (
          <p className="site-coordinate-error" role="status">
            Latitude must be −90 to 90 and longitude −180 to 180.
          </p>
        )}
      </form>

      <div className="space-y-3">
        {sites.length === 0 ? (
          <p className="text-sm text-slate-400">
            No sites selected yet. Click the Moon or enter coordinates.
          </p>
        ) : (
          sites.map((site) => (
            <div
              key={site.siteId}
              className={`site-card rounded-lg border p-3 ${
                site.siteId === activeSiteId
                  ? "border-cyan-500 bg-slate-800"
                  : "border-slate-700 bg-slate-950"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                {editingSiteId === site.siteId ? (
                  <form className="site-rename-form" onSubmit={saveRename}>
                    <input
                      autoFocus
                      value={nameInput}
                      maxLength={48}
                      onChange={(event) => setNameInput(event.target.value)}
                      aria-label={`New name for ${site.siteName}`}
                    />
                    <button
                      type="submit"
                      disabled={!nameInput.trim()}
                      aria-label="Save site name"
                      title="Save name"
                    ><Check size={15} /></button>
                    <button
                      type="button"
                      onClick={() => setEditingSiteId(null)}
                      aria-label="Cancel renaming"
                      title="Cancel"
                    ><X size={15} /></button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSelectSite(site.siteId)}
                    aria-pressed={site.siteId === activeSiteId}
                    className="site-card-select"
                  >
                    <span className="site-card-title">
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: site.color }}
                      />
                      <span className="truncate font-medium">{site.siteName}</span>
                    </span>
                    <span className="site-card-coordinates">
                      <span>Lat: {site.latitudeDeg.toFixed(4)}°</span>
                      <span>Lon: {site.longitudeDeg.toFixed(4)}°</span>
                    </span>
                  </button>
                )}

                {editingSiteId !== site.siteId && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => beginRename(site)}
                      className="site-icon-button"
                      aria-label={`Rename ${site.siteName}`}
                      title="Rename site"
                    ><Pencil size={14} /></button>
                    <button
                      type="button"
                      onClick={() => onRemoveSite(site.siteId)}
                      className="site-icon-button hover:text-red-400"
                      aria-label={`Remove ${site.siteName}`}
                      title="Remove site"
                    ><Trash2 size={15} /></button>
                  </div>
                )}
              </div>

              {editingSiteId === site.siteId && (
                <div className="site-card-coordinates mt-2">
                  <span>Lat: {site.latitudeDeg.toFixed(4)}°</span>
                  <span>Lon: {site.longitudeDeg.toFixed(4)}°</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {sites.length >= 2 && (
        <p className="mt-4 text-sm text-green-400">
          {sites.length} sites ready for comparison.
        </p>
      )}
    </section>
  );
}
