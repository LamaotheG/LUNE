# LUNE — Lunar Mission Planner

LUNE is an interactive lunar landing-site planning web app. Explore a textured 3D Moon, add and compare landing sites, inspect sunlight and Earth visibility, and estimate solar-panel output over a mission date range.

## Features

- Interactive 3D Moon with selectable coordinates, saved landing sites, and coordinate guides.
- Add, select, rename, and remove landing sites.
- Mission timeline with UTC date controls. Calculations use two-hour steps when possible and are capped at 50 intervals (51 samples) for longer ranges.
- Solar availability, illumination, terrain horizon, estimated solar power, and estimated DSN communication availability.
- Adjustable solar-panel area, tilt, azimuth, and cell efficiency. Calculated power is an estimate; dust and other operating conditions can reduce actual output.
- Site comparison and visibility-window views.
- Surface Analysis with a coordinate-centered local Moon map and a link to explore imagery through LROC.

Landing sites and settings are held in browser memory and reset when the page is refreshed.

## Tech stack

- React, TypeScript, Vite
- Three.js with React Three Fiber
- FastAPI, NumPy, Rasterio, and PyProj

## Run locally

Requirements: Node.js with npm, and Python with the packages in `backend/requirements.txt` available for your platform.

Install dependencies from the project directory:

```sh
npm install
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements.txt
```

On Windows PowerShell, activate the environment with:

```powershell
.venv\Scripts\Activate.ps1
```

Start the backend and frontend in separate terminals, both from the project directory. Activate `.venv` in the backend terminal first.

```sh
npm run dev:backend
```

```sh
npm run dev
```

Open the Vite URL printed in the frontend terminal, usually `http://localhost:5173`. Vite forwards `/api` and `/health` requests to the backend at `http://127.0.0.1:8000`.

Useful backend URLs:

- Health check: `http://127.0.0.1:8000/health`
- Interactive API documentation: `http://127.0.0.1:8000/docs`

## Lunar terrain data

The backend reads DEM files from `backend/terrain/`. These rasters are multi-gigabyte scientific datasets and are excluded from normal Git commits. Download data separately and place it in that directory using the exact filenames below.

The global LOLA DEM is recommended for general coverage:

```text
Lunar_LRO_LOLA_Global_LDEM_118m_Mar2014.tif
```

It is available from the [USGS Astrogeology planetary maps archive](https://planetarymaps.usgs.gov/mosaic/Lunar_LRO_LOLA_Global_LDEM_118m_Mar2014.tif) and documented by [USGS Astrogeology](https://astrogeology.usgs.gov/search/map/moon_lro_lola_dem_118m).

Optional higher-resolution terrain files recognized by the backend are:

```text
LDEM_80S_20MPP_ADJ.tiff
LDSM_80N_20MPP_ADJ.tiff
SLDEM2015_512_60S_60N_000_360.JP2
```

The polar LOLA files are selected when their coverage includes the site. The SLDEM2015 file is a fallback for its coverage area. It is a very large file; the [SLDEM2015 archive](https://imbrium.mit.edu/DATA/SLDEM2015/GLOBAL/JP2/) also provides lower-resolution global versions. The bundled `.LBL` file describes the SLDEM2015 product. For the underlying LOLA data, see the [NASA PDS Geosciences Node](https://pds-geosciences.wustl.edu/missions/lro/lola.htm).

At least one available DEM must cover the selected site and its configured terrain search radius. The backend reports an error if it cannot find coverage.

## Configuration and scripts

If the frontend and backend are hosted separately, set `VITE_API_BASE_URL` to the backend origin when building the frontend. Update the backend CORS allowlist in `backend/lunar_visibility_backend.py` to include the frontend origin.

```sh
VITE_API_BASE_URL=https://your-backend.example npm run build
```

Available npm scripts:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server. |
| `npm run dev:backend` | Start FastAPI with Uvicorn reload enabled. |
| `npm run build` | Type-check and build the production frontend. |
| `npm run preview` | Preview the production frontend locally. |
| `npm run lint` | Run ESLint. |

## Data and attribution

The Moon color and elevation textures are derived from NASA CGI Moon Kit, LROC, and LOLA data. See [`public/data/moon/README.md`](public/data/moon/README.md) for sources, preparation details, and credit.

The backend terrain models are derived from Lunar Reconnaissance Orbiter LOLA data; SLDEM2015 combines LOLA and Kaguya terrain-camera data. NASA and its partner institutions are data sources and do not endorse this application.

This planner is an educational and planning aid. Its analytical ephemeris, terrain sampling, communications, and power outputs are estimates, not certified mission-navigation or spacecraft power predictions.
