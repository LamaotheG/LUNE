import { useMemo } from "react";
import type { LunarSite } from "../../types/mission";
import { latLonToVector } from "../../utils/coordinates";

interface SiteMarkerProps {
  site: LunarSite;
  active: boolean;
  onSelect: (siteId: string) => void;
}

export default function SiteMarker({
  site,
  active,
  onSelect,
}: SiteMarkerProps) {
  const position = useMemo(
    () => latLonToVector(site.latitudeDeg, site.longitudeDeg),
    [site.latitudeDeg, site.longitudeDeg],
  );

  return (
    <mesh
      position={position}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(site.siteId);
      }}
      scale={active ? 1.4 : 1}
    >
      <sphereGeometry args={[0.045, 16, 16]} />
      <meshBasicMaterial color={site.color} depthTest={false} />
    </mesh>
  );
}
