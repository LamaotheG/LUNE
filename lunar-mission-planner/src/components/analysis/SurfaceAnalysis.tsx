import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ExternalLink, LocateFixed, MapPinned, Minus, Plus } from "lucide-react";

import type { LunarSite } from "../../types/mission";

interface SurfaceAnalysisProps {
  sites: LunarSite[];
  activeSite: LunarSite | null;
  onSelectSite: (siteId: string) => void;
}

interface MapCenter {
  latitude: number;
  longitude: number;
}

let moonTexturePromise: Promise<HTMLImageElement> | null = null;

function loadMoonTexture() {
  if (!moonTexturePromise) {
    moonTexturePromise = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Could not load the local Moon texture."));
      image.src = "/textures/moon/color.jpg";
    });
  }
  return moonTexturePromise;
}

function makeLrocMapUrl(center: MapCenter) {
  const url = new URL("https://data.lroc.im-ldi.com/lroc");
  url.searchParams.set("c_lat", center.latitude.toFixed(5));
  url.searchParams.set("c_lon", center.longitude.toFixed(5));
  url.searchParams.set("layers", "LUNA_WAC_GLOBAL,NAC_STAMPS");
  url.searchParams.set("projection", "ORTHO");
  url.searchParams.set("resolution", "25");
  url.searchParams.set("x", "0");
  url.searchParams.set("y", "0");
  return url.toString();
}

function LocalMoonMap({ center, zoom }: { center: MapCenter; zoom: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mapError, setMapError] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) {
      setMapError(true);
      return;
    }

    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    let image: HTMLImageElement | null = null;
    const render = () => {
      if (cancelled || !image || !canvas.clientWidth || !canvas.clientHeight) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.fillStyle = "#090705";
      context.fillRect(0, 0, width, height);

      const cropWidth = image.width / zoom;
      const cropHeight = cropWidth * height / width;
      const centerX = ((0.5 - center.longitude / 360) * image.width % image.width + image.width) % image.width;
      const centerY = (0.5 - center.latitude / 180) * image.height;
      const left = (centerX - cropWidth / 2 + image.width) % image.width;
      const top = centerY - cropHeight / 2;
      const validTop = Math.max(0, top);
      const validBottom = Math.min(image.height, top + cropHeight);
      if (validBottom <= validTop) return;

      const destTop = (validTop - top) / cropHeight * height;
      const destHeight = (validBottom - validTop) / cropHeight * height;
      const firstSourceWidth = Math.min(cropWidth, image.width - left);
      const firstDestWidth = firstSourceWidth / cropWidth * width;
      context.drawImage(
        image,
        left, validTop, firstSourceWidth, validBottom - validTop,
        0, destTop, firstDestWidth, destHeight,
      );
      const remainingWidth = cropWidth - firstSourceWidth;
      if (remainingWidth > 0) {
        context.drawImage(
          image,
          0, validTop, remainingWidth, validBottom - validTop,
          firstDestWidth, destTop, width - firstDestWidth, destHeight,
        );
      }

      context.beginPath();
      context.arc(width / 2, height / 2, 7, 0, Math.PI * 2);
      context.fillStyle = "#dc743d";
      context.fill();
      context.lineWidth = 2;
      context.strokeStyle = "#fff0dd";
      context.stroke();
      context.beginPath();
      context.arc(width / 2, height / 2, 14, 0, Math.PI * 2);
      context.lineWidth = 1;
      context.strokeStyle = "rgba(220, 116, 61, .75)";
      context.stroke();
      setMapError(false);
    };

    void loadMoonTexture().then((loadedImage) => {
      if (cancelled) return;
      image = loadedImage;
      resizeObserver = new ResizeObserver(render);
      resizeObserver.observe(canvas);
      render();
    }).catch(() => {
      if (!cancelled) setMapError(true);
    });
    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
    };
  }, [center.latitude, center.longitude, zoom]);

  return (
    <div className="surface-map-frame">
      <canvas ref={canvasRef} className="surface-local-map" aria-label="Local Moon imagery centered on the selected coordinates" />
      {mapError && <div className="surface-map-error">The local Moon image could not be loaded.</div>}
      <div className="surface-map-coordinates">
        CENTER {center.latitude.toFixed(4)}° / {center.longitude.toFixed(4)}°
      </div>
    </div>
  );
}

export default function SurfaceAnalysis({
  sites,
  activeSite,
  onSelectSite,
}: SurfaceAnalysisProps) {
  const [latitude, setLatitude] = useState(activeSite ? String(activeSite.latitudeDeg) : "");
  const [longitude, setLongitude] = useState(activeSite ? String(activeSite.longitudeDeg) : "");
  const [selectedSiteId, setSelectedSiteId] = useState(activeSite?.siteId ?? "");
  const [center, setCenter] = useState<MapCenter | null>(
    activeSite
      ? { latitude: activeSite.latitudeDeg, longitude: activeSite.longitudeDeg }
      : null,
  );
  const [zoom, setZoom] = useState(16);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!activeSite) return;
    setLatitude(String(activeSite.latitudeDeg));
    setLongitude(String(activeSite.longitudeDeg));
    setSelectedSiteId(activeSite.siteId);
    setCenter({
      latitude: activeSite.latitudeDeg,
      longitude: activeSite.longitudeDeg,
    });
    setError("");
  }, [activeSite?.siteId, activeSite?.latitudeDeg, activeSite?.longitudeDeg]);

  const mapUrl = useMemo(() => center && makeLrocMapUrl(center), [center]);

  const handleSiteChange = (siteId: string) => {
    setSelectedSiteId(siteId);
    if (!siteId) return;
    const site = sites.find((item) => item.siteId === siteId);
    if (!site) return;
    onSelectSite(siteId);
    setLatitude(String(site.latitudeDeg));
    setLongitude(String(site.longitudeDeg));
    setCenter({ latitude: site.latitudeDeg, longitude: site.longitudeDeg });
    setError("");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const lat = Number(latitude);
    const lon = Number(longitude);
    if (!latitude.trim() || !longitude.trim() || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      setError("Enter a valid latitude and longitude.");
      return;
    }
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      setError("Latitude must be −90 to 90° and longitude −180 to 180°.");
      return;
    }
    setCenter({ latitude: lat, longitude: lon });
    setError("");
  };

  return (
    <section className="surface-analysis" aria-label="Lunar surface analysis">
      <header className="surface-analysis-header">
        <div className="surface-title-block">
          <div className="surface-eyebrow"><MapPinned size={14} /> LROC SURFACE IMAGERY</div>
          <h1>Landing site detail</h1>
          <p>Center the map on a saved site or enter lunar coordinates.</p>
        </div>
        {center && mapUrl && (
          <a className="surface-source-link" href={mapUrl} target="_blank" rel="noreferrer">
            Open in LROC <ExternalLink size={14} />
          </a>
        )}
      </header>

      <form className="surface-coordinate-form" onSubmit={handleSubmit}>
        <label className="surface-site-select">
          <span>Saved landing site</span>
          <select value={selectedSiteId} onChange={(event) => handleSiteChange(event.target.value)}>
            <option value="">Custom coordinates</option>
            {sites.map((site) => (
              <option key={site.siteId} value={site.siteId}>{site.siteName}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Latitude</span>
          <input
            type="number"
            min="-90"
            max="90"
            step="any"
            value={latitude}
            onChange={(event) => setLatitude(event.target.value)}
            placeholder="e.g. -75.7367"
            required
          />
        </label>
        <label>
          <span>Longitude</span>
          <input
            type="number"
            min="-180"
            max="180"
            step="any"
            value={longitude}
            onChange={(event) => setLongitude(event.target.value)}
            placeholder="e.g. 29.5997"
            required
          />
        </label>
        <button className="surface-load-button" type="submit"><LocateFixed size={15} /> View location</button>
      </form>
      {error && <p className="surface-form-error" role="alert">{error}</p>}

      <div className="surface-map-toolbar">
        <span>Global 8K LROC-derived color mosaic · centered on selected coordinates</span>
        <div className="surface-zoom-controls" aria-label="Map zoom controls">
          <button type="button" onClick={() => setZoom((value) => Math.max(8, value / 2))} disabled={zoom <= 8} aria-label="Zoom out"><Minus size={14} /></button>
          <span>{zoom}×</span>
          <button type="button" onClick={() => setZoom((value) => Math.min(64, value * 2))} disabled={zoom >= 64} aria-label="Zoom in"><Plus size={14} /></button>
        </div>
      </div>

      {center ? (
        <LocalMoonMap center={center} zoom={zoom} />
      ) : (
        <div className="surface-map-empty">
          <MapPinned size={28} />
          <strong>Select a site or enter coordinates</strong>
          <span>The local Moon map will center on that location.</span>
        </div>
      )}

      <footer className="surface-analysis-footer">
        <span>Base map: NASA CGI Moon Kit / LROC / LOLA · 8K global texture</span>
        <span>Regional NAC imagery, when available, can be opened in LROC.</span>
      </footer>
    </section>
  );
}
