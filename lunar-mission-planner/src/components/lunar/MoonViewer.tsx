
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { memo, Suspense } from "react";
import * as THREE from "three";

import MoonModel from "./MoonModel";
import SiteMarker from "./SiteMarker";
import CoordinateGraticule from "./CoordinateGraticule";

import type { LunarSite } from "../../types/mission";
import {
  vectorToLatLon,
  latLonToVector,
  type LunarCoordinates,
} from "../../utils/coordinates";

interface MoonViewerProps {
  sites: LunarSite[];
  activeSiteId: string | null;
  pendingCoordinates: LunarCoordinates | null;
  onSurfaceSelect: (coordinates: LunarCoordinates) => void;
  onSiteSelect: (siteId: string) => void;
}

function MoonViewer({
  sites,
  activeSiteId,
  pendingCoordinates,
  onSurfaceSelect,
  onSiteSelect,
}: MoonViewerProps) {
  const activeSite = sites.find((site) => site.siteId === activeSiteId) ?? null;
  const indicatedCoordinates = pendingCoordinates ?? (activeSite
    ? { latitudeDeg: activeSite.latitudeDeg, longitudeDeg: activeSite.longitudeDeg }
    : null);

  const handleSurfaceClick = (position: THREE.Vector3) => {
    onSurfaceSelect(vectorToLatLon(position));
  };

  return (
    <div className="relative h-105 w-full overflow-hidden rounded-lg bg-[#050a13]">
      <Canvas
        frameloop="demand"
        dpr={[1, 1.5]}
        camera={{
          position: [0, -5.5, 2],
          up: [0, 0, -1],
          fov: 45,
        }}
      >
        <ambientLight intensity={0.7} />

        <directionalLight
          position={[5, -3, 5]}
          intensity={2}
        />

        <Suspense fallback={null}>
          <MoonModel onSurfaceClick={handleSurfaceClick} />
        </Suspense>

        <CoordinateGraticule
          latitudeDeg={indicatedCoordinates?.latitudeDeg}
          longitudeDeg={indicatedCoordinates?.longitudeDeg}
        />

        {sites.map((site) => (
          <SiteMarker
            key={site.siteId}
            site={site}
            active={site.siteId === activeSiteId}
            onSelect={onSiteSelect}
          />
        ))}

        {pendingCoordinates && (
          <mesh
            position={latLonToVector(
              pendingCoordinates.latitudeDeg,
              pendingCoordinates.longitudeDeg
            )}
          >
            <sphereGeometry args={[0.035, 16, 16]} />
            <meshBasicMaterial
              color="#f2e5d2"
              depthTest={false}
            />
          </mesh>
        )}

        <OrbitControls
          enableZoom
          enablePan={false}
          minDistance={3}
          maxDistance={12}
        />
      </Canvas>

      <div className="pointer-events-none absolute left-4 top-4 rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs text-slate-300">
        South Pole View · Click to select · Drag to rotate
      </div>

      <div className="moon-coordinate-legend" aria-label="Moon coordinate directions">
        <span><i className="moon-longitude-key" />N / S · Longitude</span>
        <span><i className="moon-latitude-key" />E / W · Latitude</span>
      </div>

      {pendingCoordinates && (
        <div className="pointer-events-none absolute bottom-4 left-4 rounded-lg border border-cyan-800 bg-slate-950/90 p-3 text-sm">
          <p className="font-semibold text-cyan-400">
            Pending Location
          </p>

          <p>
            Latitude: {pendingCoordinates.latitudeDeg.toFixed(4)}°
          </p>

          <p>
            Longitude: {pendingCoordinates.longitudeDeg.toFixed(4)}°
          </p>
        </div>
      )}
    </div>
  );
}

export default memo(MoonViewer);
