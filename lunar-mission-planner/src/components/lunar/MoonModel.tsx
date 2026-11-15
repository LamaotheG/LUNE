
import * as THREE from "three";
import { useLoader } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { TextureLoader } from "three";
import { useMemo } from "react";

// NASA CGI Moon Kit color and LOLA elevation maps; see public/data/moon/README.md.

const MOON_RADIUS_MODEL_UNITS = 2;
const LUNAR_RADIUS_KM = 1737.4;
const HEIGHT_MAP_RANGE_KM = 24;

interface MoonModelProps {
  onSurfaceClick: (position: THREE.Vector3) => void;
}

export default function MoonModel({
  onSurfaceClick,
}: MoonModelProps) {
  const [albedoTexture, elevationTexture] = useLoader(
    TextureLoader,
    [
      "/textures/moon/color.jpg",
      "/textures/moon/height.png",
    ]
  );
  const [albedo, elevation] = useMemo(() => {
    albedoTexture.colorSpace = THREE.SRGBColorSpace;
    albedoTexture.anisotropy = 8;
    elevationTexture.anisotropy = 8;
    return [albedoTexture, elevationTexture];
  }, [albedoTexture, elevationTexture]);

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSurfaceClick(event.point.clone());
  };

  return (
    <mesh onClick={handleClick}>
      <sphereGeometry args={[MOON_RADIUS_MODEL_UNITS, 384, 192]} />

      <meshStandardMaterial
        map={albedo}
        displacementMap={elevation}
        displacementScale={
          (HEIGHT_MAP_RANGE_KM / LUNAR_RADIUS_KM) * MOON_RADIUS_MODEL_UNITS
        }
        displacementBias={
          (-HEIGHT_MAP_RANGE_KM / 2 / LUNAR_RADIUS_KM) * MOON_RADIUS_MODEL_UNITS
        }
        bumpMap={elevation}
        bumpScale={
          (HEIGHT_MAP_RANGE_KM / LUNAR_RADIUS_KM) * MOON_RADIUS_MODEL_UNITS
        }
        color="white"
        roughness={1}
        metalness={0}
        side={THREE.FrontSide}
      />
    </mesh>
  );
}
