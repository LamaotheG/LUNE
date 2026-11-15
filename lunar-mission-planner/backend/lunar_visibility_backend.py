"""
LUNAR MISSION EPHEMERIS & POWER/COMMUNICATION ENGINE
Developer: Mah (NASA Space Apps Challenge)

Core algorithmic module providing:
- Ephemeris transformations (J2000 Ecliptic to MCMF & Topocentric ENU)
- Solar disk circular-segment occultation and multi-panel flux/power modeling
- Direct-to-Earth (DTE) and NASA Deep Space Network (DSN) link geometric validation
- Mission timeline simulations and multi-site tradeoff analysis
"""

import math
from functools import lru_cache
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Callable
import numpy as np


# =====================================================================
# ASTRONOMICAL CONSTANTS (IAU / JPL DE440 STANDARDS)
# =====================================================================
MOON_MEAN_RADIUS_KM = 1737.4
EARTH_EQUATORIAL_RADIUS_KM = 6378.137
AU_KM = 149597870.7
SOLAR_CONSTANT_1AU_W_M2 = 1361.0

# Angular radii at mean distances
SOLAR_ANGULAR_RADIUS_DEG = 0.2665   # ~16 arcmin
EARTH_ANGULAR_RADIUS_DEG = 0.9500   # ~57 arcmin (seen from Moon)

# Lunar Orbital / Rotational Parameters
LUNAR_INCLINATION_RAD = math.radians(1.5424)  # Cassini state inclination

CURATED_SITES = {
    "shackleton_rim": {"name": "Shackleton Crater Rim", "lat": -89.90, "lon": 0.0, "elev_m": 2100.0},
    "malapert_massif": {"name": "Malapert Massif", "lat": -84.90, "lon": 12.90, "elev_m": 4500.0},
    "nobile_crater": {"name": "Nobile Crater Rim", "lat": -85.20, "lon": 31.00, "elev_m": 1600.0},
    "connecting_ridge": {"name": "Connecting Ridge (Shackleton-de Gerlache)", "lat": -89.45, "lon": -137.0, "elev_m": 1850.0},
    "apollo_11": {"name": "Apollo 11 Landing Site", "lat": 0.6741, "lon": 23.4730, "elev_m": -1900.0}
}

NASA_DSN_COMPLEXES = {
    "Goldstone": {"lat": 35.4267, "lon": -116.8900, "alt_km": 1.036, "mask_deg": 10.0},
    "Madrid": {"lat": 40.4314, "lon": -4.2481, "alt_km": 0.830, "mask_deg": 10.0},
    "Canberra": {"lat": -35.4014, "lon": 148.9817, "alt_km": 0.680, "mask_deg": 10.0}
}

_DSN_STATION_GEOMETRY = {
    name: (
        math.radians(station["lat"]),
        math.radians(station["lon"]),
        EARTH_EQUATORIAL_RADIUS_KM + station["alt_km"],
    )
    for name, station in NASA_DSN_COMPLEXES.items()
}


# =====================================================================
# TIME & ROTATION UTILITIES
# =====================================================================
def utc_to_jd(dt: datetime) -> float:
    """Convert UTC datetime object to Julian Date."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return dt.timestamp() / 86400.0 + 2440587.5


def gmst_radians(jd: float) -> float:
    """Greenwich Mean Sidereal Time in radians for Earth rotation."""
    T = (jd - 2451545.0) / 36525.0
    deg = (280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T**2) % 360.0
    return math.radians(deg)


# =====================================================================
# EPHEMERIS CORE: J2000 ECLIPTIC TO MOON-CENTERED MOON-FIXED (MCMF)
# =====================================================================
@lru_cache(maxsize=4096)
def get_ephemeris_vectors(jd: float) -> Dict:
    """
    Computes accurate relative positions in:
    1) MCMF (Moon-Centered Moon-Fixed frame)
    2) Earth-Centered J2000 Equatorial frame (for DSN ground station visibility)
    3) Lunar Optical Libration angles in longitude (l) and latitude (b).
    """
    T = (jd - 2451545.0) / 36525.0

    # 1. Solar Orbit Parameters (Ecliptic J2000)
    M_sun = math.radians((357.5291092 + 35999.0502909 * T) % 360.0)
    L_sun = math.radians((280.46646 + 36000.76983 * T) % 360.0)
    C_sun = math.radians((1.914602 - 0.004817 * T) * math.sin(M_sun) + 0.019993 * math.sin(2 * M_sun))
    lambda_sun = L_sun + C_sun
    r_sun_km = (1.000001018 * (1.0 - 0.016708634 * math.cos(M_sun))) * AU_KM

    r_earth_to_sun_ecl = np.array([
        r_sun_km * math.cos(lambda_sun),
        r_sun_km * math.sin(lambda_sun),
        0.0
    ])

    # 2. Lunar Orbit Parameters (Brown / Chapront-Touzé Series)
    L_moon = math.radians((218.3164477 + 481267.88123421 * T) % 360.0)
    D_moon = math.radians((297.8501921 + 445267.1114034 * T) % 360.0)
    M_moon = math.radians((134.9633964 + 477198.8675055 * T) % 360.0)
    F_moon = math.radians((93.2720950 + 483202.0175233 * T) % 360.0)

    # Lunar perturbations
    lon_moon = L_moon + math.radians(
        6.288774 * math.sin(M_moon)
        + 1.274027 * math.sin(2 * D_moon - M_moon)
        + 0.658314 * math.sin(2 * D_moon)
        + 0.213618 * math.sin(2 * M_moon)
        - 0.185116 * math.sin(M_sun)
        - 0.114332 * math.sin(2 * F_moon)
    )
    lat_moon = math.radians(
        5.128122 * math.sin(F_moon)
        + 0.280602 * math.sin(M_moon + F_moon)
        + 0.277693 * math.sin(M_moon - F_moon)
        + 0.173237 * math.sin(2 * D_moon - F_moon)
    )
    dist_moon_km = (
        385000.56
        - 20905.355 * math.cos(M_moon)
        - 3699.111 * math.cos(2 * D_moon - M_moon)
        - 2955.968 * math.cos(2 * D_moon)
        - 569.925 * math.cos(2 * M_moon)
    )

    r_earth_to_moon_ecl = np.array([
        dist_moon_km * math.cos(lat_moon) * math.cos(lon_moon),
        dist_moon_km * math.cos(lat_moon) * math.sin(lon_moon),
        dist_moon_km * math.sin(lat_moon)
    ])

    r_moon_to_earth_ecl = -r_earth_to_moon_ecl
    r_moon_to_sun_ecl = r_earth_to_sun_ecl - r_earth_to_moon_ecl

    # 3. Cassini Orientation Frame (Ecliptic -> MCMF Frame)
    Omega = (L_moon - F_moon) % (2.0 * math.pi)

    def rz(angle):
        c, s = math.cos(angle), math.sin(angle)
        return np.array([[c, s, 0], [-s, c, 0], [0, 0, 1]])

    def rx(angle):
        c, s = math.cos(angle), math.sin(angle)
        return np.array([[1, 0, 0], [0, c, s], [0, -s, c]])

    R_ecl_to_mcmf = rz(F_moon) @ rx(-LUNAR_INCLINATION_RAD) @ rz(Omega + math.pi)

    r_sun_mcmf = R_ecl_to_mcmf @ r_moon_to_sun_ecl
    r_earth_mcmf = R_ecl_to_mcmf @ r_moon_to_earth_ecl

    # 4. Earth-Centered Equatorial Transformation
    eps = math.radians(23.439291 - 0.0130042 * T)
    R_ecl_to_eq = rx(-eps)
    r_earth_to_moon_eq = R_ecl_to_eq @ r_earth_to_moon_ecl

    gmst_r = gmst_radians(jd)
    dsn_station_positions_eq = {}
    for name, (lat_r, lon_r, radius_km) in _DSN_STATION_GEOMETRY.items():
        lst_r = gmst_r + lon_r
        dsn_station_positions_eq[name] = np.array([
            radius_km * math.cos(lat_r) * math.cos(lst_r),
            radius_km * math.cos(lat_r) * math.sin(lst_r),
            radius_km * math.sin(lat_r),
        ])

    # 5. Optical Libration Angles
    u_earth = r_earth_mcmf / np.linalg.norm(r_earth_mcmf)
    libration_lon_deg = math.degrees(math.atan2(u_earth[1], u_earth[0]))
    libration_lat_deg = math.degrees(math.asin(max(-1.0, min(1.0, u_earth[2]))))

    return {
        "r_sun_mcmf": r_sun_mcmf,
        "r_earth_mcmf": r_earth_mcmf,
        "r_earth_to_moon_eq": r_earth_to_moon_eq,
        "R_ecl_to_mcmf": R_ecl_to_mcmf,
        "R_ecl_to_eq": R_ecl_to_eq,
        "dsn_station_positions_eq": dsn_station_positions_eq,
        "libration": {"lon_deg": round(libration_lon_deg, 3), "lat_deg": round(libration_lat_deg, 3)}
    }


# =====================================================================
# COORDINATE CONVERSIONS: MCMF TO TOPOCENTRIC HORIZON (ENU)
# =====================================================================
@lru_cache(maxsize=512)
def get_site_position_mcmf(lat_deg: float, lon_deg: float, elev_m: float = 0.0) -> np.ndarray:
    """Computes Cartesian coordinates of a landing site in the MCMF frame (km)."""
    radius = MOON_MEAN_RADIUS_KM + (elev_m / 1000.0)
    lat_r = math.radians(lat_deg)
    lon_r = math.radians(lon_deg)
    return np.array([
        radius * math.cos(lat_r) * math.cos(lon_r),
        radius * math.cos(lat_r) * math.sin(lon_r),
        radius * math.sin(lat_r)
    ])


@lru_cache(maxsize=512)
def get_site_enu_basis(lat_deg: float, lon_deg: float):
    """Return the fixed local ENU basis shared by every epoch at one site."""
    lat_r, lon_r = math.radians(lat_deg), math.radians(lon_deg)
    east = np.array([-math.sin(lon_r), math.cos(lon_r), 0.0])
    north = np.array([
        -math.sin(lat_r) * math.cos(lon_r),
        -math.sin(lat_r) * math.sin(lon_r),
        math.cos(lat_r),
    ])
    up = np.array([
        math.cos(lat_r) * math.cos(lon_r),
        math.cos(lat_r) * math.sin(lon_r),
        math.sin(lat_r),
    ])
    return east, north, up


def mcmf_to_topocentric_enu(target_mcmf: np.ndarray, site_mcmf: np.ndarray, lat_deg: float, lon_deg: float) -> Dict:
    """
    Transforms a target position in MCMF into local East-North-Up (ENU) coordinates
    at the landing site, computing true topocentric Azimuth, Elevation, and unit vectors.
    """
    rel = target_mcmf - site_mcmf
    dist = float(np.linalg.norm(rel))
    u_mcmf = rel / dist

    east, north, up = get_site_enu_basis(lat_deg, lon_deg)

    e = float(np.dot(u_mcmf, east))
    n = float(np.dot(u_mcmf, north))
    u = float(np.dot(u_mcmf, up))

    elevation_deg = math.degrees(math.asin(max(-1.0, min(1.0, u))))
    azimuth_deg = (math.degrees(math.atan2(e, n)) + 360.0) % 360.0

    return {
        "azimuth_deg": round(azimuth_deg, 4),
        "elevation_deg": round(elevation_deg, 4),
        "distance_km": round(dist, 2),
        "u_enu": np.array([e, n, u]),
        "u_mcmf": u_mcmf
    }


# =====================================================================
# SOLAR OCCULTATION & POWER MODELING
# =====================================================================
def compute_solar_disk_fraction(apparent_elevation_deg: float) -> float:
    """
    Calculates visible fractional area of the solar disk (0.0 to 1.0)
    using circular segment geometry for horizon grazing angles.
    """
    R = SOLAR_ANGULAR_RADIUS_DEG
    h = apparent_elevation_deg

    if h >= R:
        return 1.0
    if h <= -R:
        return 0.0

    d = -h
    theta = 2.0 * math.acos(d / R)
    segment_area = 0.5 * (R ** 2) * (theta - math.sin(theta))
    total_area = math.pi * (R ** 2)

    visible_area = total_area - segment_area
    return max(0.0, min(1.0, visible_area / total_area))


def compute_solar_power(sun_topocentric: Dict,
                        dist_au: float,
                        panel_tilt_deg: float = 90.0,
                        panel_azimuth_deg: float = 0.0,
                        cell_efficiency: float = 0.30,
                        horizon_elevation_mask_deg: float = 0.0) -> Dict:
    """Computes direct solar flux and electrical power outputs."""
    raw_elevation = sun_topocentric["elevation_deg"]
    apparent_elevation = raw_elevation - horizon_elevation_mask_deg

    disk_fraction = compute_solar_disk_fraction(apparent_elevation)
    incident_direct_flux = (SOLAR_CONSTANT_1AU_W_M2 / (dist_au ** 2)) * disk_fraction

    sin_el = max(0.0, math.sin(math.radians(raw_elevation)))
    horiz_power = incident_direct_flux * sin_el * cell_efficiency

    cos_el = max(0.0, math.cos(math.radians(raw_elevation)))
    vert_mast_power = incident_direct_flux * cos_el * cell_efficiency

    t_rad = math.radians(panel_tilt_deg)
    a_rad = math.radians(panel_azimuth_deg)
    normal_enu = np.array([
        math.sin(t_rad) * math.sin(a_rad),
        math.sin(t_rad) * math.cos(a_rad),
        math.cos(t_rad)
    ])
    cos_incidence = max(0.0, float(np.dot(normal_enu, sun_topocentric["u_enu"])))
    custom_power = incident_direct_flux * cos_incidence * cell_efficiency

    return {
        "sun_visible": disk_fraction > 0.0,
        "solar_disk_fraction": round(disk_fraction, 4),
        "incident_direct_flux_w_m2": round(incident_direct_flux, 2),
        "horizontal_power_w_m2": round(horiz_power, 2),
        "vertical_mast_power_w_m2": round(vert_mast_power, 2),
        "custom_panel_power_w_m2": round(custom_power, 2)
    }


# =====================================================================
# NASA DSN DIRECT-TO-EARTH (DTE) ENGINE
# =====================================================================
def evaluate_dsn_link(jd: float,
                      earth_topocentric: Dict,
                      site_mcmf: np.ndarray,
                      ephem: Dict,
                      horizon_elevation_mask_deg: float = 0.0) -> Dict:
    """Evaluates two-way line-of-sight and ground station RF elevation masks."""
    earth_el = earth_topocentric["elevation_deg"]
    earth_visible_on_moon = (earth_el + EARTH_ANGULAR_RADIUS_DEG) > horizon_elevation_mask_deg

    R_ecl_to_eq = ephem["R_ecl_to_eq"]
    R_ecl_to_mcmf = ephem["R_ecl_to_mcmf"]

    site_offset_eq = R_ecl_to_eq @ (R_ecl_to_mcmf.T @ site_mcmf)
    r_earth_to_site_eq = ephem["r_earth_to_moon_eq"] + site_offset_eq

    active_complexes = []
    complex_details = {}

    for name, station in NASA_DSN_COMPLEXES.items():
        st_pos_eq = ephem["dsn_station_positions_eq"][name]
        r_station = _DSN_STATION_GEOMETRY[name][2]

        dish_to_lander_vec = r_earth_to_site_eq - st_pos_eq
        dist_km = float(np.linalg.norm(dish_to_lander_vec))
        dish_u = dish_to_lander_vec / dist_km
        zenith_u = st_pos_eq / r_station

        dish_el_deg = math.degrees(math.asin(max(-1.0, min(1.0, float(np.dot(dish_u, zenith_u))))))
        station_active = (dish_el_deg >= station["mask_deg"]) and earth_visible_on_moon

        if station_active:
            active_complexes.append(name)

        complex_details[name] = {
            "dish_elevation_on_earth_deg": round(dish_el_deg, 2),
            "antenna_mask_satisfied": dish_el_deg >= station["mask_deg"],
            "one_way_light_time_sec": round(dist_km / 299792.458, 3),
            "link_active": station_active
        }

    return {
        "earth_visible_on_moon": earth_visible_on_moon,
        "any_dsn_link_active": len(active_complexes) > 0,
        "active_dsn_complexes": active_complexes,
        "details": complex_details
    }


# =====================================================================
# SITE EVALUATION & MULTI-DAY MISSION TIMELINE
# =====================================================================
def evaluate_site(lat_deg: float,
                  lon_deg: float,
                  elev_m: float,
                  iso_timestamp: str,
                  panel_tilt_deg: float = 90.0,
                  panel_azimuth_deg: float = 0.0,
                  terrain_mask_func: Optional[Callable[[float], float]] = None,
                  cell_efficiency: float = 0.30) -> Dict:
    """Single-epoch site evaluation pipeline."""
    dt = datetime.fromisoformat(iso_timestamp.replace("Z", "+00:00"))
    jd = utc_to_jd(dt)

    site_mcmf = get_site_position_mcmf(lat_deg, lon_deg, elev_m)
    ephem = get_ephemeris_vectors(jd)

    sun_topo = mcmf_to_topocentric_enu(ephem["r_sun_mcmf"], site_mcmf, lat_deg, lon_deg)
    earth_topo = mcmf_to_topocentric_enu(ephem["r_earth_mcmf"], site_mcmf, lat_deg, lon_deg)

    sun_mask_el = terrain_mask_func(sun_topo["azimuth_deg"]) if terrain_mask_func else 0.0
    earth_mask_el = terrain_mask_func(earth_topo["azimuth_deg"]) if terrain_mask_func else 0.0

    dist_au = sun_topo["distance_km"] / AU_KM
    solar = compute_solar_power(
        sun_topo, dist_au, panel_tilt_deg, panel_azimuth_deg,
        cell_efficiency=cell_efficiency,
        horizon_elevation_mask_deg=sun_mask_el
    )

    dsn = evaluate_dsn_link(
        jd, earth_topo, site_mcmf, ephem,
        horizon_elevation_mask_deg=earth_mask_el
    )

    return {
        "timestamp_utc": dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "julian_date": round(jd, 5),
        "landing_site": {
            "lat_deg": lat_deg,
            "lon_deg": lon_deg,
            "elevation_m": elev_m,
            "position_mcmf_km": [round(float(x), 4) for x in site_mcmf]
        },
        "lunar_libration": ephem["libration"],
        "sun": {
            "azimuth_deg": sun_topo["azimuth_deg"],
            "elevation_deg": sun_topo["elevation_deg"],
            "distance_km": sun_topo["distance_km"],
            "raycast_vector_enu": [round(float(x), 6) for x in sun_topo["u_enu"]],
            "raycast_vector_mcmf": [round(float(x), 6) for x in sun_topo["u_mcmf"]],
            "solar_power": solar
        },
        "earth": {
            "azimuth_deg": earth_topo["azimuth_deg"],
            "elevation_deg": earth_topo["elevation_deg"],
            "distance_km": earth_topo["distance_km"],
            "raycast_vector_enu": [round(float(x), 6) for x in earth_topo["u_enu"]],
            "raycast_vector_mcmf": [round(float(x), 6) for x in earth_topo["u_mcmf"]],
            "dsn_communication": dsn
        }
    }


def evaluate_mission_timeline(lat_deg: float,
                              lon_deg: float,
                              elev_m: float,
                              start_iso: str,
                              duration_hours: int = 72,
                              step_hours: int = 6,
                              terrain_mask_func: Optional[Callable[[float], float]] = None) -> Dict:
    """Generates sequential ephemeris timeline steps and counts hours to sunset/earthset."""
    start_dt = datetime.fromisoformat(start_iso.replace("Z", "+00:00"))
    steps = int(duration_hours // step_hours) + 1

    timeline = []
    sunlit_steps = 0
    comm_steps = 0
    hours_until_sunset: Optional[float] = None
    hours_until_earthset: Optional[float] = None

    initial_sun_up = None
    initial_earth_up = None

    for i in range(steps):
        current_dt = start_dt + timedelta(hours=i * step_hours)
        snap = evaluate_site(lat_deg, lon_deg, elev_m, current_dt.isoformat(), terrain_mask_func=terrain_mask_func)
        timeline.append(snap)

        sun_up = snap["sun"]["solar_power"]["sun_visible"]
        earth_up = snap["earth"]["dsn_communication"]["any_dsn_link_active"]

        if i == 0:
            initial_sun_up = sun_up
            initial_earth_up = earth_up
        else:
            if initial_sun_up and not sun_up and hours_until_sunset is None:
                hours_until_sunset = float(i * step_hours)
            if initial_earth_up and not earth_up and hours_until_earthset is None:
                hours_until_earthset = float(i * step_hours)

        if sun_up:
            sunlit_steps += 1
        if earth_up:
            comm_steps += 1

    return {
        "mission_summary": {
            "start_utc": start_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "duration_hours": duration_hours,
            "step_hours": step_hours,
            "sunlight_coverage_pct": round(100.0 * sunlit_steps / steps, 1),
            "dsn_comm_coverage_pct": round(100.0 * comm_steps / steps, 1),
            "hours_until_next_sunset": hours_until_sunset,
            "hours_until_next_earthset": hours_until_earthset
        },
        "timeline": timeline
    }


def run_mission_tradeoff_analysis(site_a: Dict,
                                  site_b: Dict,
                                  start_iso: str,
                                  duration_hours: int = 708,
                                  step_hours: int = 2) -> Dict:
    """Comparative multi-day analysis for site selection."""
    start_dt = datetime.fromisoformat(start_iso.replace("Z", "+00:00"))
    steps = int(duration_hours // step_hours) + 1

    site_a_mcmf = get_site_position_mcmf(site_a["lat"], site_a["lon"], site_a["elev_m"])
    site_b_mcmf = get_site_position_mcmf(site_b["lat"], site_b["lon"], site_b["elev_m"])

    def create_tracker():
        return {
            "sunlit_hours": 0.0,
            "comm_hours": 0.0,
            "both_active_hours": 0.0,
            "total_energy_wh_m2": 0.0,
            "max_consecutive_night_hours": 0.0,
            "current_night_hours": 0.0
        }

    res_a, res_b = create_tracker(), create_tracker()

    for i in range(steps):
        dt = start_dt + timedelta(hours=i * step_hours)
        jd = utc_to_jd(dt)
        ephem = get_ephemeris_vectors(jd)

        for site_info, site_mcmf, tr in [(site_a, site_a_mcmf, res_a), (site_b, site_b_mcmf, res_b)]:
            sun = mcmf_to_topocentric_enu(ephem["r_sun_mcmf"], site_mcmf, site_info["lat"], site_info["lon"])
            earth = mcmf_to_topocentric_enu(ephem["r_earth_mcmf"], site_mcmf, site_info["lat"], site_info["lon"])

            dist_au = sun["distance_km"] / AU_KM
            pwr = compute_solar_power(sun, dist_au)
            dsn = evaluate_dsn_link(jd, earth, site_mcmf, ephem)

            sun_ok = pwr["sun_visible"]
            comm_ok = dsn["any_dsn_link_active"]

            if sun_ok:
                tr["sunlit_hours"] += step_hours
                tr["total_energy_wh_m2"] += pwr["vertical_mast_power_w_m2"] * step_hours
                tr["current_night_hours"] = 0.0
            else:
                tr["current_night_hours"] += step_hours
                if tr["current_night_hours"] > tr["max_consecutive_night_hours"]:
                    tr["max_consecutive_night_hours"] = tr["current_night_hours"]

            if comm_ok:
                tr["comm_hours"] += step_hours

            if sun_ok and comm_ok:
                tr["both_active_hours"] += step_hours

    total_time = steps * step_hours
    return {
        "metadata": {
            "start_time": start_iso,
            "simulation_hours": total_time,
            "site_a_name": site_a["name"],
            "site_b_name": site_b["name"]
        },
        "site_a_performance": {
            "illumination_percentage": round(100.0 * res_a["sunlit_hours"] / total_time, 1),
            "dsn_coverage_percentage": round(100.0 * res_a["comm_hours"] / total_time, 1),
            "concurrent_power_and_comm_hours": res_a["both_active_hours"],
            "total_generation_wh_m2": round(res_a["total_energy_wh_m2"], 1),
            "max_survival_blackout_hours": res_a["max_consecutive_night_hours"]
        },
        "site_b_performance": {
            "illumination_percentage": round(100.0 * res_b["sunlit_hours"] / total_time, 1),
            "dsn_coverage_percentage": round(100.0 * res_b["comm_hours"] / total_time, 1),
            "concurrent_power_and_comm_hours": res_b["both_active_hours"],
            "total_generation_wh_m2": round(res_b["total_energy_wh_m2"], 1),
            "max_survival_blackout_hours": res_b["max_consecutive_night_hours"]
        }
    }

# =====================================================================
# TERRAIN ENGINE + INTEGRATED FRONT-END ENTRY POINT
# Reconstructed from the supplied terrain-horizon source and connected
# directly to the ephemeris engine above.
# =====================================================================
import os
import json
import rasterio
from rasterio.enums import Resampling
from rasterio.windows import Window
from pyproj import CRS, Transformer

MOON_RADIUS_M = 1_737_400.0
MAX_API_TIMELINE_INTERVALS = 50
LUNAR_GEOGRAPHIC_CRS = CRS.from_proj4(
    "+proj=longlat +a=1737400 +b=1737400 +no_defs"
)

# The files are expected in ./terrain next to this Python file.
DATASETS = [
    {"name": "South Polar LOLA 20m", "filename": "LDEM_80S_20MPP_ADJ.tiff", "priority": 1},
    {"name": "North Polar LOLA 20m", "filename": "LDSM_80N_20MPP_ADJ.tiff", "priority": 1},
    # The SLDEM JP2 uses 30,720 x 30,720 pixel blocks. Random site reads can
    # force GDAL to decode a multi-gigabyte block, so prefer the tiled polar
    # DEMs where available and the global LOLA GeoTIFF for other latitudes.
    # Its 118 m cells closely match the default 100 m horizon sample spacing.
    {"name": "Global LOLA 118m", "filename": "Lunar_LRO_LOLA_Global_LDEM_118m_Mar2014.tif", "priority": 2},
    {"name": "SLDEM2015 512 pixels per degree", "filename": "SLDEM2015_512_60S_60N_000_360.JP2", "priority": 3},
]


def destination_point(lat_deg, lon_deg, azimuth_deg, distance_m):
    lat1, lon1 = math.radians(lat_deg), math.radians(lon_deg)
    bearing = math.radians(azimuth_deg)
    delta = distance_m / MOON_RADIUS_M
    lat2 = math.asin(
        math.sin(lat1) * math.cos(delta)
        + math.cos(lat1) * math.sin(delta) * math.cos(bearing)
    )
    lon2 = lon1 + math.atan2(
        math.sin(bearing) * math.sin(delta) * math.cos(lat1),
        math.cos(delta) - math.sin(lat1) * math.sin(lat2),
    )
    return math.degrees(lat2), (math.degrees(lon2) + 180.0) % 360.0 - 180.0


def _transformer_for(dataset):
    if dataset.crs is None:
        raise ValueError(f"DEM has no CRS: {dataset.name}")
    return Transformer.from_crs(LUNAR_GEOGRAPHIC_CRS, dataset.crs, always_xy=True)


def _read_dem(dataset, transformer, lat, lon):
    x, y = transformer.transform(lon, lat)
    try:
        sample = next(dataset.sample([(x, y)], indexes=1, masked=True))
        value = sample[0]
        if np.ma.is_masked(value):
            return float("nan")
        value = float(value)
        if not math.isfinite(value):
            return float("nan")
        if dataset.nodata is not None and value == dataset.nodata:
            return float("nan")
        return value
    except Exception:
        return float("nan")


def _covers_search_area(dataset, transformer, lat, lon, max_distance_m):
    # As in the supplied source: observer plus 72 points on the radius perimeter.
    test_points = [(lat, lon)]
    for bearing in range(0, 360, 5):
        test_points.append(destination_point(lat, lon, bearing, max_distance_m))
    for test_lat, test_lon in test_points:
        try:
            x, y = transformer.transform(test_lon, test_lat)
            row, col = dataset.index(x, y)
            if row < 0 or row >= dataset.height or col < 0 or col >= dataset.width:
                return False
        except Exception:
            return False
    return True


def select_dem(terrain_dir, lat, lon, max_distance_m):
    available = []
    checked = []
    best_priority = None
    for item in sorted(DATASETS, key=lambda candidate: candidate["priority"]):
        if best_priority is not None and item["priority"] > best_priority:
            checked.append({
                "name": item["name"],
                "filename": item["filename"],
                "status": "skipped_lower_priority",
            })
            continue
        path = os.path.join(terrain_dir, item["filename"])
        if not os.path.isfile(path):
            checked.append({"name": item["name"], "filename": item["filename"], "status": "not_found"})
            continue
        try:
            ds = rasterio.open(path)
            transformer = _transformer_for(ds)
            covers = _covers_search_area(ds, transformer, lat, lon, max_distance_m)
            pixel_size = max(abs(ds.res[0]), abs(ds.res[1]))
            checked.append({"name": item["name"], "filename": item["filename"], "status": "covers" if covers else "does_not_cover", "resolution": list(ds.res)})
            if covers:
                available.append({"dataset": ds, "name": item["name"], "filename": item["filename"],
                                  "priority": item["priority"], "pixel_size": pixel_size,
                                  "transformer": transformer, "path": path})
                best_priority = item["priority"] if best_priority is None else min(best_priority, item["priority"])
            else:
                ds.close()
        except Exception as exc:
            checked.append({"name": item["name"], "filename": item["filename"], "status": "error", "error": str(exc)})
            try:
                ds.close()
            except Exception:
                pass
    if not available:
        raise RuntimeError(
            "No configured DEM covers the landing site and the complete terrain search radius. "
            "Check the four filenames, CRS, and MAX_DISTANCE_M. Dataset scan: " + json.dumps(checked)
        )
    # Resolution values use each raster's native units, so compare declared
    # dataset priority first and only compare pixel size within the same tier.
    available.sort(key=lambda x: (x["priority"], x["pixel_size"]))
    selected = available[0]
    for item in available[1:]:
        item["dataset"].close()
    selected["scan"] = checked
    selected["resolution"] = list(selected["dataset"].res)
    selected["crs"] = str(selected["dataset"].crs)
    return selected


def _apparent_terrain_angle(observer_ground_m, observer_height_m, terrain_m, distance_m):
    observer_radius = MOON_RADIUS_M + observer_ground_m + observer_height_m
    terrain_radius = MOON_RADIUS_M + terrain_m
    central_angle = distance_m / MOON_RADIUS_M
    horizontal = terrain_radius * math.sin(central_angle)
    vertical = terrain_radius * math.cos(central_angle) - observer_radius
    return math.degrees(math.atan2(vertical, horizontal))


def _sample_raster_points(dataset, sample_x, sample_y, overview_factor=1):
    """Read a compact DEM window once, then gather all horizon samples in memory."""
    pixel_indices = np.asarray([
        dataset.index(float(x), float(y))
        for x, y in zip(sample_x, sample_y)
    ], dtype=np.int64)
    rows, cols = pixel_indices[:, 0], pixel_indices[:, 1]
    in_bounds = (
        (rows >= 0) & (rows < dataset.height)
        & (cols >= 0) & (cols < dataset.width)
    )
    if not np.any(in_bounds):
        return np.ma.masked_all(len(rows), dtype=np.float32)

    factor = max(1, int(overview_factor))
    min_block_row = int(rows[in_bounds].min()) // factor
    max_block_row = int(rows[in_bounds].max()) // factor
    min_block_col = int(cols[in_bounds].min()) // factor
    max_block_col = int(cols[in_bounds].max()) // factor
    block_width = max_block_col - min_block_col + 1
    block_height = max_block_row - min_block_row + 1
    min_row, min_col = min_block_row * factor, min_block_col * factor
    window_width = min(block_width * factor, dataset.width - min_col)
    window_height = min(block_height * factor, dataset.height - min_row)
    output_width = int(math.ceil(window_width / factor))
    output_height = int(math.ceil(window_height / factor))
    window_area = window_width * window_height
    raster_area = dataset.width * dataset.height

    # A wrapped or unusual projection can make a compact geographic ring span
    # most of the raster. Keep memory use bounded in that uncommon case.
    if window_area > max(1_000_000, raster_area * 0.05):
        coordinates = zip(sample_x, sample_y)
        return np.ma.concatenate([
            np.ma.asarray(value)
            for value in dataset.sample(coordinates, indexes=1, masked=True)
        ])

    window = Window(min_col, min_row, window_width, window_height)
    raster_window = dataset.read(
        1,
        window=window,
        out_shape=(output_height, output_width),
        masked=True,
        resampling=Resampling.average if factor > 1 else Resampling.nearest,
    )
    samples = np.ma.masked_all(len(rows), dtype=raster_window.dtype)
    valid_indices = np.flatnonzero(in_bounds)
    local_rows = rows[valid_indices] // factor - min_block_row
    local_cols = cols[valid_indices] // factor - min_block_col
    samples[valid_indices] = raster_window[local_rows, local_cols]
    return samples


def calculate_terrain_horizon(selected, lat, lon, observer_height_m=1.0,
                              max_distance_m=10000.0, azimuth_interval_deg=1.0,
                              sample_spacing_m=None):
    ds, transformer = selected["dataset"], selected["transformer"]
    observer_ground_m = _read_dem(ds, transformer, lat, lon)
    if not math.isfinite(observer_ground_m):
        raise RuntimeError("The selected DEM has no valid elevation at the landing-site coordinate.")
    spacing = float(sample_spacing_m if sample_spacing_m is not None else selected["pixel_size"])
    if spacing <= 0 or max_distance_m <= 0 or azimuth_interval_deg <= 0:
        raise ValueError("Terrain sampling distance, maximum distance and azimuth interval must be positive.")
    distances = np.arange(spacing, max_distance_m + 1e-9, spacing, dtype=float)
    azimuths = np.arange(0.0, 360.0, azimuth_interval_deg, dtype=float)
    azimuth_grid, distance_grid = np.meshgrid(azimuths, distances, indexing="ij")

    # Generate horizon coordinates and transform the whole array together.
    lat1 = math.radians(lat)
    lon1 = math.radians(lon)
    bearing = np.radians(azimuth_grid)
    delta = distance_grid / MOON_RADIUS_M
    lat2 = np.arcsin(
        math.sin(lat1) * np.cos(delta)
        + math.cos(lat1) * np.sin(delta) * np.cos(bearing)
    )
    lon2 = lon1 + np.arctan2(
        np.sin(bearing) * np.sin(delta) * math.cos(lat1),
        np.cos(delta) - math.sin(lat1) * np.sin(lat2),
    )
    sample_lats = np.degrees(lat2).ravel()
    sample_lons = ((np.degrees(lon2) + 180.0) % 360.0 - 180.0).ravel()
    sample_x, sample_y = transformer.transform(sample_lons, sample_lats)
    # Read from a matching DEM overview when its ground resolution is close to
    # the requested radial sample spacing. This avoids decoding a massive JP2
    # tile for a small site window while retaining the detail the horizon
    # sampler can represent at its configured spacing.
    if ds.crs and ds.crs.is_geographic:
        native_pixel_m = abs(ds.res[0]) * math.pi / 180.0 * MOON_RADIUS_M
    else:
        native_pixel_m = max(abs(ds.res[0]), abs(ds.res[1]))
    overview_factor = 1
    available_overviews = ds.overviews(1)
    if native_pixel_m > 0 and available_overviews:
        ideal_factor = spacing / native_pixel_m
        eligible = [factor for factor in available_overviews if factor <= ideal_factor * 1.25]
        if eligible:
            overview_factor = max(eligible)
    sampled = _sample_raster_points(
        ds, sample_x, sample_y, overview_factor
    ).astype(float)
    terrain_grid = np.ma.filled(sampled, np.nan).reshape(len(azimuths), len(distances))

    observer_radius = MOON_RADIUS_M + observer_ground_m + observer_height_m
    terrain_radius = MOON_RADIUS_M + terrain_grid
    central_angle = distance_grid / MOON_RADIUS_M
    horizontal = terrain_radius * np.sin(central_angle)
    vertical = terrain_radius * np.cos(central_angle) - observer_radius
    apparent_angles = np.degrees(np.arctan2(vertical, horizontal))

    results = []
    for index, azimuth in enumerate(azimuths):
        arr = apparent_angles[index]
        if np.any(np.isfinite(arr)):
            idx = int(np.nanargmax(arr))
            results.append({"azimuth_deg": float(azimuth), "horizon_elevation_deg": float(arr[idx]),
                            "horizon_distance_m": float(distances[idx]),
                            "valid_samples": int(np.count_nonzero(np.isfinite(arr)))})
        else:
            results.append({"azimuth_deg": float(azimuth), "horizon_elevation_deg": None,
                            "horizon_distance_m": None, "valid_samples": 0})
    return observer_ground_m, results, spacing


def _terrain_cache_signature(terrain_dir):
    signature = []
    for item in DATASETS:
        path = os.path.join(terrain_dir, item["filename"])
        try:
            stat = os.stat(path)
            signature.append((item["filename"], stat.st_size, stat.st_mtime_ns))
        except OSError:
            signature.append((item["filename"], None, None))
    return tuple(signature)


@lru_cache(maxsize=64)
def _cached_terrain_profile(terrain_dir, signature, lat, lon, observer_height_m,
                            max_distance_m, azimuth_interval_deg, sample_spacing_m):
    """Reuse site terrain horizons across date-range and timeline requests."""
    del signature  # Included in the cache key so replacing DEM files invalidates entries.
    selected = select_dem(terrain_dir, lat, lon, max_distance_m)
    try:
        observer_ground_m, horizon_results, actual_spacing = calculate_terrain_horizon(
            selected, lat, lon, observer_height_m, max_distance_m,
            azimuth_interval_deg, sample_spacing_m
        )
        metadata = {
            "selected_dataset": selected["name"],
            "filename": selected["filename"],
            "crs": selected["crs"],
            "resolution": selected["resolution"],
            "observer_ground_elevation_m": round(float(observer_ground_m), 3),
            "observer_height_m": float(observer_height_m),
            "sample_spacing_m": float(actual_spacing),
            "azimuth_interval_deg": float(azimuth_interval_deg),
            "horizon_profile": horizon_results,
            "dataset_scan": selected["scan"],
        }
        return float(observer_ground_m), horizon_results, float(actual_spacing), metadata
    finally:
        selected["dataset"].close()


def make_horizon_function(horizon_results, max_gap_deg=5.0):
    """Circular linear interpolation; refuses to bridge large missing-data gaps."""
    valid = [(r["azimuth_deg"], r["horizon_elevation_deg"])
             for r in horizon_results if r["horizon_elevation_deg"] is not None
             and math.isfinite(r["horizon_elevation_deg"])]
    if len(valid) < 2:
        raise RuntimeError("Insufficient valid terrain-horizon directions to test visibility.")
    valid.sort()
    az = np.array([p[0] for p in valid], dtype=float)
    el = np.array([p[1] for p in valid], dtype=float)
    # The gap check is based on the configured/resulting azimuth sample spacing.
    base_steps = np.diff(az)
    typical = float(np.median(base_steps)) if len(base_steps) else 1.0
    extended_az = np.concatenate(([az[-1] - 360.0], az, [az[0] + 360.0]))
    extended_el = np.concatenate(([el[-1]], el, [el[0]]))
    def horizon_at(azimuth_deg):
        a = float(azimuth_deg) % 360.0
        right = int(np.searchsorted(extended_az, a, side="right"))
        left = right - 1
        gap = extended_az[right] - extended_az[left]
        if gap > max(max_gap_deg, typical * 1.5) + 1e-9:
            raise RuntimeError(f"No reliable terrain horizon near azimuth {a:.3f} degrees (missing-data gap {gap:.2f} degrees).")
        fraction = (a - extended_az[left]) / gap
        return float(extended_el[left] + fraction * (extended_el[right] - extended_el[left]))
    return horizon_at


def _parse_utc(value, field_name):
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception as exc:
        raise ValueError(f"{field_name} must be an ISO-8601 date/time, e.g. 2026-11-14T00:00:00Z") from exc
    if dt.tzinfo is None:
        raise ValueError(f"{field_name} must include a timezone (preferably Z for UTC).")
    return dt.astimezone(timezone.utc)


def run_lunar_visibility_analysis(
    start_time_utc, end_time_utc, latitude_deg, longitude_deg,
    time_step_minutes=60, terrain_dir=None, observer_height_m=1.0,
    max_terrain_distance_m=10000.0, azimuth_interval_deg=1.0,
    terrain_sample_spacing_m=None, panel_tilt_deg=90.0,
    panel_azimuth_deg=0.0, cell_efficiency=0.30,
):
    """Single public API for the frontend: inputs -> JSON-ready visibility time series."""
    start_dt = _parse_utc(start_time_utc, "start_time_utc")
    end_dt = _parse_utc(end_time_utc, "end_time_utc")
    if end_dt < start_dt:
        raise ValueError("end_time_utc must be later than or equal to start_time_utc.")
    if not -90.0 <= float(latitude_deg) <= 90.0:
        raise ValueError("latitude_deg must be between -90 and 90.")
    if not -180.0 <= float(longitude_deg) <= 180.0:
        raise ValueError("longitude_deg must be between -180 and 180.")
    if time_step_minutes <= 0:
        raise ValueError("time_step_minutes must be greater than zero.")

    lat, lon = float(latitude_deg), float(longitude_deg)
    if terrain_dir is None:
        terrain_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "terrain")
    terrain_dir = os.path.abspath(terrain_dir)
    cache_spacing = None if terrain_sample_spacing_m is None else float(terrain_sample_spacing_m)
    observer_ground_m, horizon_results, actual_spacing, terrain_metadata = _cached_terrain_profile(
        terrain_dir,
        _terrain_cache_signature(terrain_dir),
        lat,
        lon,
        float(observer_height_m),
        float(max_terrain_distance_m),
        float(azimuth_interval_deg),
        cache_spacing,
    )
    terrain_mask = make_horizon_function(horizon_results)
    observer_elevation_for_ephemeris = observer_ground_m + float(observer_height_m)

    duration_seconds = (end_dt - start_dt).total_seconds()
    requested_step_seconds = float(time_step_minutes) * 60.0
    requested_intervals = (
        math.ceil(duration_seconds / requested_step_seconds)
        if duration_seconds > 0 else 0
    )
    if requested_intervals > MAX_API_TIMELINE_INTERVALS:
        # Preserve both endpoints while limiting long requests to 50 evenly
        # spaced intervals (51 timestamp samples).
        effective_step_seconds = duration_seconds / MAX_API_TIMELINE_INTERVALS
    else:
        effective_step_seconds = requested_step_seconds
    interval = timedelta(seconds=effective_step_seconds)
    effective_time_step_minutes = interval.total_seconds() / 60.0
    steps = int(math.floor(duration_seconds / interval.total_seconds())) + 1
    steps = min(steps, MAX_API_TIMELINE_INTERVALS + 1)
    timeline = []
    sun_visible_seconds = 0.0
    earth_visible_seconds = 0.0
    both_visible_seconds = 0.0
    dsn_active_seconds = 0.0
    energy_wh_m2 = 0.0

    for i in range(steps):
        current = start_dt + i * interval
        snap = evaluate_site(
            lat, lon, observer_elevation_for_ephemeris,
            current.isoformat(), panel_tilt_deg, panel_azimuth_deg,
            terrain_mask_func=terrain_mask, cell_efficiency=cell_efficiency
        )
        sun_az = snap["sun"]["azimuth_deg"]
        earth_az = snap["earth"]["azimuth_deg"]
        sun_horizon = terrain_mask(sun_az)
        earth_horizon = terrain_mask(earth_az)
        sun_visible = bool(snap["sun"]["solar_power"]["sun_visible"])
        earth_visible = bool(snap["earth"]["dsn_communication"]["earth_visible_on_moon"])
        dsn_active = bool(snap["earth"]["dsn_communication"]["any_dsn_link_active"])
        snap["sun"]["terrain_horizon_elevation_deg"] = round(sun_horizon, 4)
        snap["sun"]["terrain_blocked"] = not sun_visible
        snap["sun"]["visibility"] = "visible" if sun_visible else "blocked"
        snap["earth"]["terrain_horizon_elevation_deg"] = round(earth_horizon, 4)
        snap["earth"]["terrain_blocked"] = not earth_visible
        snap["earth"]["visibility"] = "visible" if earth_visible else "blocked"
        snap["earth"]["dsn_communication"]["communication_available"] = dsn_active
        timeline.append(snap)

        # Accumulate elapsed intervals only; the final sample is an instant, not a full interval.
        elapsed = min(interval.total_seconds(), max(0.0, (end_dt - current).total_seconds()))
        if sun_visible: sun_visible_seconds += elapsed
        if earth_visible: earth_visible_seconds += elapsed
        if sun_visible and earth_visible: both_visible_seconds += elapsed
        if dsn_active: dsn_active_seconds += elapsed
        energy_wh_m2 += snap["sun"]["solar_power"]["vertical_mast_power_w_m2"] * elapsed / 3600.0

    total_seconds = duration_seconds
    def pct(value):
        return round(100.0 * value / total_seconds, 2) if total_seconds > 0 else (100.0 if value == 0 else 0.0)
    return {
            "status": "success",
            "input": {
                "start_time_utc": start_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "end_time_utc": end_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "latitude_deg": lat, "longitude_deg": lon,
                "time_step_minutes": effective_time_step_minutes,
                "observer_height_m_above_dem": float(observer_height_m),
                "terrain_max_distance_m": float(max_terrain_distance_m),
            },
            "terrain": terrain_metadata,
            "summary": {
                "sample_count": len(timeline),
                "calculation_steps": max(len(timeline) - 1, 0),
                "total_duration_seconds": total_seconds,
                "sun_visible_duration_seconds": sun_visible_seconds,
                "sun_visible_percentage": pct(sun_visible_seconds),
                "earth_visible_duration_seconds": earth_visible_seconds,
                "earth_visible_percentage": pct(earth_visible_seconds),
                "both_visible_duration_seconds": both_visible_seconds,
                "both_visible_percentage": pct(both_visible_seconds),
                "dsn_available_duration_seconds": dsn_active_seconds,
                "dsn_available_percentage": pct(dsn_active_seconds),
                "estimated_vertical_mast_energy_wh_m2": round(energy_wh_m2, 3),
            },
            "timeline": timeline,
    }


def _json_safe(value):
    """Convert NumPy values and non-finite floats into JSON-safe values."""
    if isinstance(value, dict):
        return {str(k): _json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(v) for v in value]
    if isinstance(value, (np.integer,)): return int(value)
    if isinstance(value, (np.floating, float)):
        return float(value) if math.isfinite(float(value)) else None
    if isinstance(value, np.ndarray): return _json_safe(value.tolist())
    return value


# Optional HTTP API for a web frontend. Install fastapi and uvicorn to use it.
try:
    from fastapi import FastAPI, HTTPException
    from pydantic import BaseModel, Field
    app = FastAPI(title="Lunar Sun/Earth Terrain Visibility API", version="1.0.0")

    class LunarVisibilityRequest(BaseModel):
        start_time_utc: str
        end_time_utc: str
        latitude_deg: float = Field(ge=-90.0, le=90.0)
        longitude_deg: float = Field(ge=-180.0, le=180.0)
        time_step_minutes: float = Field(default=60.0, gt=0.0)
        max_terrain_distance_m: float = Field(default=1000.0, gt=0.0, le=10000.0)
        azimuth_interval_deg: float = Field(default=10.0, gt=0.0, le=360.0)
        terrain_sample_spacing_m: Optional[float] = Field(default=100.0, gt=0.0)
        panel_tilt_deg: float = Field(default=90.0, ge=0.0, le=180.0)
        panel_azimuth_deg: float = Field(default=0.0, ge=0.0, le=360.0)
        cell_efficiency: float = Field(default=0.30, gt=0.0, le=1.0)

    from fastapi.middleware.cors import CORSMiddleware

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ],
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type"],
    )

    @app.get("/health")
    def health_check():
        return {"status": "ok", "service": "lunar-visibility-backend"}

    @app.post("/api/lunar-visibility")
    def lunar_visibility_api(payload: LunarVisibilityRequest):
        try:
            result = run_lunar_visibility_analysis(
                **payload.dict(exclude_none=True)
            )
            return _json_safe(result)
        except (ValueError, TypeError) as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc))
except ImportError:
    app = None


if __name__ == "__main__":
    # Example command-line run. Your frontend should call
    # run_lunar_visibility_analysis(...) from its API/service layer.
    result = run_lunar_visibility_analysis(
        start_time_utc="2026-11-14T00:00:00Z",
        end_time_utc="2026-11-14T06:00:00Z",
        latitude_deg=89.5,
        longitude_deg=0.0,
        time_step_minutes=60,
        terrain_dir=r"C:\Users\HP\Desktop\NASA APP\terrain",
        observer_height_m=1.0,
        max_terrain_distance_m=10000,
        azimuth_interval_deg=1.0,
        terrain_sample_spacing_m=200
    )
    
    output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "results")
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, "lunar_visibility_results.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(_json_safe(result), f, indent=2, allow_nan=False)
    print(f"Completed. Frontend JSON output: {output_path}")
