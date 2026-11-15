import { useMemo } from "react";
import * as THREE from "three";
import { Line } from "@react-three/drei";

import { latLonToVector } from "../../utils/coordinates";

interface CoordinateGraticuleProps {
  latitudeDeg?: number;
  longitudeDeg?: number;
}

const GRID_RADIUS = 2.018;
const HIGHLIGHT_RADIUS = 2.024;
const ARROW_RADIUS = 2.033;

function pointAt(latitudeDeg: number, longitudeDeg: number, radius: number) {
  return latLonToVector(latitudeDeg, longitudeDeg, radius);
}

function createGlobalGridGeometry() {
  const points: THREE.Vector3[] = [];
  const addSegment = (a: THREE.Vector3, b: THREE.Vector3) => {
    points.push(a, b);
  };

  for (let latitude = -75; latitude <= 75; latitude += 15) {
    for (let longitude = -180; longitude < 180; longitude += 2) {
      addSegment(
        pointAt(latitude, longitude, GRID_RADIUS),
        pointAt(latitude, longitude + 2, GRID_RADIUS),
      );
    }
  }

  for (let longitude = -180; longitude < 180; longitude += 15) {
    for (let latitude = -88; latitude < 90; latitude += 2) {
      addSegment(
        pointAt(latitude, longitude, GRID_RADIUS),
        pointAt(Math.min(90, latitude + 2), longitude, GRID_RADIUS),
      );
    }
  }

  return points;
}

function tangentDirection(latitudeDeg: number, longitudeDeg: number, direction: "north" | "east") {
  const latitude = THREE.MathUtils.degToRad(latitudeDeg);
  const longitude = THREE.MathUtils.degToRad(longitudeDeg);
  if (direction === "north") {
    return new THREE.Vector3(
      -Math.sin(latitude) * Math.cos(longitude),
      Math.cos(latitude),
      -Math.sin(latitude) * Math.sin(longitude),
    ).normalize();
  }
  return new THREE.Vector3(-Math.sin(longitude), 0, Math.cos(longitude)).normalize();
}

function DirectionArrow({
  latitudeDeg,
  longitudeDeg,
  direction,
  color,
}: {
  latitudeDeg: number;
  longitudeDeg: number;
  direction: "north" | "east";
  color: string;
}) {
  const { position, quaternion } = useMemo(() => {
    const anchorLatitude = direction === "north"
      ? (latitudeDeg > 86 ? latitudeDeg - 3 : latitudeDeg + 3)
      : latitudeDeg;
    const anchorLongitude = direction === "east" ? longitudeDeg + 4 : longitudeDeg;
    const tangent = tangentDirection(anchorLatitude, anchorLongitude, direction);
    return {
      position: pointAt(anchorLatitude, anchorLongitude, ARROW_RADIUS),
      quaternion: new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        tangent,
      ),
    };
  }, [latitudeDeg, longitudeDeg, direction]);

  return (
    <mesh position={position} quaternion={quaternion} raycast={() => null}>
      <coneGeometry args={[0.018, 0.055, 8]} />
      <meshBasicMaterial color={color} depthTest />
    </mesh>
  );
}

export default function CoordinateGraticule({
  latitudeDeg,
  longitudeDeg,
}: CoordinateGraticuleProps) {
  const globalGrid = useMemo(createGlobalGridGeometry, []);
  const hasSelection = latitudeDeg !== undefined && longitudeDeg !== undefined;

  const latitudeLine = useMemo(() => {
    if (!hasSelection) return null;
    return Array.from({ length: 361 }, (_, index) =>
      pointAt(latitudeDeg, -180 + index, HIGHLIGHT_RADIUS),
    );
  }, [hasSelection, latitudeDeg]);

  const longitudeLine = useMemo(() => {
    if (!hasSelection) return null;
    return Array.from({ length: 181 }, (_, index) =>
      pointAt(-90 + index, longitudeDeg, HIGHLIGHT_RADIUS),
    );
  }, [hasSelection, longitudeDeg]);

  return (
    <>
      <Line
        points={globalGrid}
        segments
        color="#f2e5d2"
        lineWidth={1.35}
        transparent
        opacity={0.28}
        depthTest
        raycast={() => null}
      />

      {hasSelection && latitudeLine && longitudeLine && (
        <>
          <Line
            points={longitudeLine}
            color="#ff9657"
            lineWidth={2.25}
            transparent
            opacity={1}
            depthTest
            raycast={() => null}
          />
          <Line
            points={latitudeLine}
            color="#fff4e6"
            lineWidth={2.25}
            transparent
            opacity={1}
            depthTest
            raycast={() => null}
          />
          <DirectionArrow
            latitudeDeg={latitudeDeg}
            longitudeDeg={longitudeDeg}
            direction="north"
            color="#d16a34"
          />
          <DirectionArrow
            latitudeDeg={latitudeDeg}
            longitudeDeg={longitudeDeg}
            direction="east"
            color="#f2e5d2"
          />
        </>
      )}
    </>
  );
}
