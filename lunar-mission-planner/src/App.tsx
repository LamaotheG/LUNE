import { lazy, Suspense, useMemo, useState } from "react";
import {
  Activity,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  RadioTower,
} from "lucide-react";

import { useLunarBackend } from "./hooks/useLunarBackend";
import SolarPanel from "./components/analysis/SolarPanel";
import CommunicationPanel from "./components/analysis/CommunicationPanel";
import SiteComparisonPanel from "./components/analysis/SiteComparisonPanel";
import VisibilityWindows from "./components/analysis/VisibilityWindows";
import SiteManager from "./components/controls/SiteManager";
import DateController from "./components/controls/DateController";
import { buildSiteComparisons } from "./utils/comparison";
import { buildAnalysisRange } from "./utils/dateRange";
import type { LunarSite, SolarPowerSettings } from "./types/mission";
import type { LunarCoordinates } from "./utils/coordinates";
import "./App.css";

const SITE_COLORS = ["#d16a34", "#ec9b5e", "#a84d27", "#f2d0ae", "#7f3b20"];
const DEFAULT_POWER_SETTINGS: SolarPowerSettings = {
  panelAreaM2: 1,
  panelTiltDeg: 90,
  panelAzimuthDeg: 0,
  cellEfficiencyPercent: 30,
};
type DashboardTab = "mission" | "surface";
const Timeline = lazy(() => import("./components/analysis/Timeline"));
const SurfaceAnalysis = lazy(() => import("./components/analysis/SurfaceAnalysis"));
const MoonViewer = lazy(() => import("./components/lunar/MoonViewer"));

function App() {
  const [sites, setSites] = useState<LunarSite[]>([]);
  const [activeSiteId, setActiveSiteId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("2026-11-14");
  const [endDate, setEndDate] = useState("2026-11-14");
  const [selectedStep, setSelectedStep] = useState(6);
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<DashboardTab>("mission");
  const [powerSettings, setPowerSettings] = useState(DEFAULT_POWER_SETTINGS);
  const [pendingCoordinates, setPendingCoordinates] =
    useState<LunarCoordinates | null>(null);

  const range = useMemo(
    () => buildAnalysisRange(startDate, endDate),
    [startDate, endDate],
  );
  const selectedTimestamp = useMemo(() => {
    const startMs = new Date(range.startTimeUtc).getTime();
    return new Date(
      startMs + selectedStep * range.sampleIntervalSec * 1000,
    ).toISOString();
  }, [range, selectedStep]);

  const addSiteAtCoordinates = (latitudeDeg: number, longitudeDeg: number) => {
    let nextNameNumber = sites.length + 1;
    while (sites.some((site) => site.siteName === `Landing Site ${nextNameNumber}`)) {
      nextNameNumber += 1;
    }
    const newSite: LunarSite = {
      siteId: crypto.randomUUID(),
      siteName: `Landing Site ${nextNameNumber}`,
      latitudeDeg,
      longitudeDeg,
      color: SITE_COLORS[sites.length % SITE_COLORS.length],
    };
    setSites((previous) => [...previous, newSite]);
    setActiveSiteId(newSite.siteId);
    setPendingCoordinates(null);
  };

  const handleAddSite = () => {
    if (!pendingCoordinates) return;
    addSiteAtCoordinates(
      pendingCoordinates.latitudeDeg,
      pendingCoordinates.longitudeDeg,
    );
  };

  const handleRenameSite = (siteId: string, siteName: string) => {
    setSites((previous) => previous.map((site) =>
      site.siteId === siteId ? { ...site, siteName } : site,
    ));
  };

  const handleRemoveSite = (siteId: string) => {
    setSites((previous) => previous.filter((site) => site.siteId !== siteId));
    if (activeSiteId === siteId) setActiveSiteId(null);
  };

  const { analyses, timelines, loading, error } = useLunarBackend(
    sites,
    selectedTimestamp,
    startDate,
    endDate,
    powerSettings,
  );
  const activeAnalysis =
    analyses.find((analysis) => analysis.siteId === activeSiteId) ?? null;
  const activeTimeline =
    timelines.find((timeline) => timeline.siteId === activeSiteId) ?? null;
  const activeSite = sites.find((site) => site.siteId === activeSiteId) ?? null;
  const comparisons = useMemo(
    () => buildSiteComparisons(sites, timelines),
    [sites, timelines],
  );

  return (
    <div className="mission-app">
      <header className="topbar">
        <div className="brand">
          <img
            className="brand-logo"
            src="/lunar-mission-logo.png"
            alt=""
            aria-hidden="true"
          />
          <span className="brand-name">LUNE</span>
          <span className="brand-subtitle">LUNAR MISSION PLANNER</span>
        </div>
        <nav className="top-nav" aria-label="Dashboard sections">
          <button
            className={activeTab === "mission" ? "active" : ""}
            onClick={() => setActiveTab("mission")}
            aria-current={activeTab === "mission" ? "page" : undefined}
          >MISSION CONTROL</button>
          <button
            className={activeTab === "surface" ? "active" : ""}
            onClick={() => setActiveTab("surface")}
            aria-current={activeTab === "surface" ? "page" : undefined}
          >SURFACE ANALYSIS</button>
        </nav>
      </header>

      <main className={`mission-shell ${leftSidebarOpen ? "" : "left-collapsed"}`}>
        <aside className={`sidebar ${leftSidebarOpen ? "" : "collapsed"}`}>
          <div className="sidebar-top">
            <button
              className="sidebar-collapse"
              onClick={() => setLeftSidebarOpen((open) => !open)}
              aria-label={leftSidebarOpen ? "Collapse left sidebar" : "Expand left sidebar"}
              aria-expanded={leftSidebarOpen}
              title={leftSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              {leftSidebarOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
            </button>
            <div className="context-badge">
              <div className="context-main">
                <div className="micro-label">Current target</div>
                <div className="context-name">{activeSite?.siteName ?? "No landing site selected"}</div>
                {activeSite && <div className="context-coords">{activeSite.latitudeDeg.toFixed(4)}° / {activeSite.longitudeDeg.toFixed(4)}°</div>}
              </div>
              <span className="context-state">{activeSite ? "TRACKING" : "STANDBY"}</span>
            </div>
          </div>

          <div className="sidebar-scroll">
            <div className="sidebar-group">
              <div className="sidebar-group-title">Assets & sites</div>
              <SiteManager
                sites={sites}
                activeSiteId={activeSiteId}
                pendingCoordinates={pendingCoordinates}
                onAddSite={handleAddSite}
                onAddCoordinates={addSiteAtCoordinates}
                onSelectSite={setActiveSiteId}
                onRemoveSite={handleRemoveSite}
                onRenameSite={handleRenameSite}
              />
            </div>

            <div className="sidebar-group">
              <div className="sidebar-group-title">Time & simulation</div>
              <DateController
                startDate={startDate}
                endDate={endDate}
                selectedStep={selectedStep}
                selectedTimestamp={selectedTimestamp}
                intervalCount={range.intervalCount}
                intervalHours={range.sampleIntervalSec / 3600}
                onStartDateChange={(value) => {
                  setStartDate(value);
                  if (value > endDate) setEndDate(value);
                  setSelectedStep(0);
                }}
                onEndDateChange={(value) => {
                  setEndDate(value);
                  setSelectedStep(0);
                }}
                onStepChange={setSelectedStep}
              />
            </div>

            <div className="sidebar-group">
              <div className="sidebar-group-title">Site comparison</div>
              <SiteComparisonPanel
                comparisons={comparisons}
                activeSiteId={activeSiteId}
                onSelectSite={setActiveSiteId}
              />
            </div>

            <div className="sidebar-group">
              <div className="sidebar-group-title">Visibility windows</div>
              <VisibilityWindows comparisons={comparisons} />
            </div>
          </div>

          <div className="sidebar-footer">
            <span>UTC · {startDate}</span>
            <span>{sites.length} ASSETS</span>
          </div>
        </aside>

        <section
          className="viewport"
          aria-label={activeTab === "surface" ? "Lunar surface analysis" : "Interactive lunar globe"}
        >
          {activeTab === "surface" ? (
            <Suspense fallback={<div className="analysis-status pending">Loading surface analysis…</div>}>
              <SurfaceAnalysis
                sites={sites}
                activeSite={activeSite}
                onSelectSite={setActiveSiteId}
              />
            </Suspense>
          ) : (
            <>
          <div className="moon-viewer">
            <Suspense fallback={<div className="moon-loading">Loading lunar surface…</div>}>
              <MoonViewer
                sites={sites}
                activeSiteId={activeSiteId}
                pendingCoordinates={pendingCoordinates}
                onSurfaceSelect={setPendingCoordinates}
                onSiteSelect={setActiveSiteId}
              />
            </Suspense>
          </div>
          <div className="view-label">
            <div className="view-label-title">LUNAR SURFACE / SOUTH POLAR VIEW</div>
            <div className="view-label-sub">INTERACTIVE GLOBE · SELECT A LOCATION TO ADD A SITE</div>
          </div>
          <div className="view-tools" aria-hidden="true">
            <span className="view-tool">{sites.length.toString().padStart(2, "0")} SITES</span>
            <span className="view-tool">DRAG TO ROTATE · SCROLL TO ZOOM</span>
          </div>

          <div className="timeline-hud">
            <Suspense fallback={<div className="analysis-status pending">Loading timeline…</div>}>
              <Timeline timeline={activeTimeline} selectedTimestamp={selectedTimestamp} />
            </Suspense>
          </div>

          {rightSidebarOpen ? (
          <aside className="telemetry-hud" aria-label="Live site telemetry">
            <div className="telemetry-heading telemetry-header">
              <span><Activity size={14} style={{ display: "inline", marginRight: 8, color: "var(--cyan)" }} />LIVE TELEMETRY</span>
              <button
                className="telemetry-collapse"
                onClick={() => setRightSidebarOpen(false)}
                aria-label="Collapse right sidebar"
                title="Collapse telemetry sidebar"
              ><PanelRightClose size={15} /></button>
            </div>
            {loading ? (
              <div className="analysis-status pending">Calculating lunar visibility…</div>
            ) : error ? (
              <div className="analysis-status error" role="alert">Backend unavailable · {error}</div>
            ) : timelines.length > 0 ? (
              <div className="analysis-status ready">Backend calculations loaded</div>
            ) : (
              <div className="analysis-status">Select a landing site to begin analysis</div>
            )}
            <SolarPanel
              analysis={activeAnalysis}
              timeline={activeTimeline}
              settings={powerSettings}
              onSettingsChange={setPowerSettings}
            />
            <CommunicationPanel analysis={activeAnalysis} />
            <div className="telemetry-heading"><RadioTower size={12} style={{ display: "inline", marginRight: 7, color: "var(--cyan)" }} />VIEW TELEMETRY</div>
            <div className="analysis-status">
              <div>ZOOM / ORBIT <span style={{ float: "right", color: "var(--text)" }}>INTERACTIVE</span></div>
              <div style={{ marginTop: 7 }}>LAT / LON <span style={{ float: "right", color: "var(--text)" }}>{activeSite ? `${activeSite.latitudeDeg.toFixed(2)} / ${activeSite.longitudeDeg.toFixed(2)}` : "— / —"}</span></div>
              <div style={{ marginTop: 7 }}>UTC <span style={{ float: "right", color: "var(--cyan)" }}>{selectedTimestamp.slice(11, 19)}</span></div>
              <div style={{ marginTop: 7 }}>MISSION STEP <span style={{ float: "right", color: "var(--text)" }}>{selectedStep.toString().padStart(2, "0")} / {range.intervalCount}</span></div>
            </div>
          </aside>
          ) : (
            <button
              className="telemetry-expand"
              onClick={() => setRightSidebarOpen(true)}
              aria-label="Expand right sidebar"
              title="Expand telemetry sidebar"
            ><PanelRightOpen size={16} /><span>TELEMETRY</span></button>
          )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
