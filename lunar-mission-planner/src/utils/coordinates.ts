import * as THREE from "three";

export interface LunarCoordinates {
  latitudeDeg: number;
  longitudeDeg: number;
}

export function vectorToLatLon(position: THREE.Vector3): LunarCoordinates {
  const p = position.clone().normalize();

  return {
    latitudeDeg: THREE.MathUtils.radToDeg(Math.asin(p.y)),
    longitudeDeg: THREE.MathUtils.radToDeg(Math.atan2(p.z, p.x)),
  };
}

export function latLonToVector(
  latitudeDeg: number,
  longitudeDeg: number,
  radius = 2.04,
): THREE.Vector3 {
  const lat = THREE.MathUtils.degToRad(latitudeDeg);
  const lon = THREE.MathUtils.degToRad(longitudeDeg);

  return new THREE.Vector3(
    radius * Math.cos(lat) * Math.cos(lon),
    radius * Math.sin(lat),
    radius * Math.cos(lat) * Math.sin(lon),
  );
}
