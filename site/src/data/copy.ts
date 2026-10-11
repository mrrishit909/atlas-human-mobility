/**
 * Copy deck bindings (VISUAL_DESIGN 5). Every number on screen is formatted
 * here from a named facts.json / meta.json field, so the Vitest parity test can
 * check the rendered copy against facts.json.
 */
import type { Facts, Meta } from "./types";

export const int = (n: number) => Math.round(n).toLocaleString("en-US");
export const pct1 = (n: number) => (Math.round(n * 10) / 10).toFixed(1);
export const pct0 = (n: number) => String(Math.round(n));

export const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

export function copyS00() {
  return {
    headline: "Millions of journeys. One living system.",
    note: "LINES = TOP 600 ZONE-TO-ZONE CORRIDORS, 2024. NOT ROUTES.",
    alt: "Animated introduction: the 600 busiest zone-to-zone corridors of 2024 appear and gather into a ring of 263 taxi zones.",
  };
}

export function copyS01(f: Facts) {
  const b = f.busiest_zone_how;
  return {
    statement: "Every ride begins in one of 263 zones and ends in another.",
    card1Head: `FROM: ZONE ${b.zone} · ${b.name.toUpperCase()} / ${b.how_label.toUpperCase()}`,
    card1Body: `${int(b.mean_trips)} PICKUPS IN AN AVERAGE HOUR LIKE THIS ONE.`,
    // The busiest zone-hour is the Sunday 1 AM hour that the DST fall-back repeats (data agent note).
    card1Foot: "SUN 1 AM COUNTS INCLUDE THE REPEATED 1 AM OF THE NOV 3 DST FALL-BACK, WHICH INFLATES THESE CELLS BY ABOUT 1.9%.",
    card2Head: "FROM: ALL 263 ZONES / EVERY MINUTE OF 2024",
    card2Body: `${int(f.trips_per_minute_mean)} RIDES BEGAN, ON AVERAGE. ${int(f.trips_kept_total)} IN ALL.`,
  };
}

export function copyS02(f: Facts, m: Meta | null) {
  return [
    { chip: "ANATOMY 01 · THE ROW", title: "A journey, as the city records it.",
      body: "A PICKUP ZONE. A DROPOFF ZONE. TWO TIMESTAMPS. MILES AND SECONDS. THAT IS ALL THE CITY KNOWS ABOUT WHERE YOU WENT." },
    { chip: "ANATOMY 02 · THREE FLEETS", title: "Three fleets, one ledger.",
      body: `APP-BASED RIDES (UBER, LYFT, VIA, JUNO): ${pct1(f.share_pct.fhvhv)}%. YELLOW CABS: ${pct1(f.share_pct.yellow)}%. GREEN CABS: ${pct1(f.share_pct.green)}%. SAME ZONES, SAME CLOCK.` },
    { chip: "ANATOMY 03 · WHAT WE REMOVED", title: `${int(f.excluded_total)} rows didn't make it.`,
      body: "TIMESTAMPS OUTSIDE THEIR MONTH. TRIPS THAT END BEFORE THEY BEGIN. ZERO MILES. FASTER THAN 80 MPH. EVERY EXCLUSION IS COUNTED, AND THE COUNTS ADD BACK TO THE RAW TOTAL.",
      foot: m ? `PIPELINE v${m.pipeline_version} · GENERATED ${m.generated_at.slice(0, 10)}` : "" },
    { chip: "ANATOMY 04 · WHERE PRECISION ENDS", title: "A zone, not a street.",
      body: `NO COORDINATES. NO ROUTES. EVERY LINE ON THIS SITE JOINS TWO ZONE CENTERS. CORRIDORS WITH FEWER THAN 11 TRIPS ARE HIDDEN: ${int(f.suppressed_cells_total)} OF THEM.` },
  ];
}

export function copyS03a(f: Facts, peaksOk: boolean) {
  return {
    statement: peaksOk ? `The city inhales at ${f.am_peak_hour.label} and exhales at ${f.pm_peak_hour.label}.` : "The city keeps two rush hours.",
    weekendStatement: "Weekends keep a different clock.",
    weekendBody: `THE BUSIEST WEEKEND HOUR IS ${f.weekend_peak_hour.label.toUpperCase()}.`,
    body: (day: string) => `EACH SQUARE IS A ZONE. ITS SIZE IS THE AVERAGE NUMBER OF PICKUPS IN THAT HOUR. SCROLL TO MOVE THROUGH ${day}.`,
  };
}

export function copyS03b(f: Facts) {
  const mn = f.mn_internal_share_pct >= 50, bk = f.bk_internal_share_pct >= 50;
  return {
    statement: "Draw every ride as a line, and the city's hidden corridors appear.",
    states: {
      MN: { title: mn ? "Manhattan" : "Manhattan's corridors",
        body: mn ? `${pct0(f.mn_internal_share_pct)}% OF RIDES THAT START IN MANHATTAN END THERE. SHORT CHORDS, BARELY BENDING.` : null },
      AIR: { title: "The airports", body: `JFK AND LAGUARDIA SEND RIDES TO ${int(f.airport_dest_zone_count)} DIFFERENT ZONES. THE LONGEST CHORDS ON THE RING.` },
      BK: { title: bk ? "Brooklyn" : "Brooklyn's corridors",
        body: bk ? `${pct0(f.bk_internal_share_pct)}% OF BROOKLYN PICKUPS NEVER LEAVE BROOKLYN.` : null },
      HINGE: { title: f.hinge_zone.name,
        body: "MORE SHORTEST PATHS THROUGH THE CITY'S TRIP NETWORK PASS THROUGH THIS ZONE THAN ANY OTHER. THE HINGE." },
    },
  };
}

export function copyS04(f: Facts) {
  return {
    s1: "Flatten the ring and the city reappears.",
    s2: `Half of all pickups come from ${f.zones_for_half_pickups} of 263 zones.`,
    s3: `${f.clusters.k} kinds of neighborhood, sorted by when they move.`,
    clusterNote: `K-MEANS, K=${f.clusters.k}, SILHOUETTE ${f.clusters.silhouette.toFixed(2)}. A WEAK SEPARATION: READ THE TYPES AS TENDENCIES, NOT CATEGORIES.`,
  };
}

export const mph = (n: number) => (Math.round(n * 10) / 10).toFixed(1);
export const signed = (n: number, digits = 1) => `${n >= 0 ? "+" : "-"}${Math.abs(n).toFixed(digits)}`;

export function copyS05(f: Facts) {
  const mn = f.borough_am_peak_speed_ratio.Manhattan;
  return {
    s1: mn ? `At ${f.am_peak_hour.label}, Manhattan moves at ${pct0(mn.speed_ratio_pct)}% of its overnight speed.` : "Every borough slows when the city wakes.",
    s2: "Push the city.",
    chip: "BPR VOLUME-DELAY CURVE, FITTED TO 2024 ZONE-HOUR SPEEDS",
    limitation: "NOT A TRAFFIC MODEL: NO ROAD NETWORK, NO ROUTING, NO CHANGE IN HOW PEOPLE TRAVEL. SPEED IS A PROXY FROM TRIP DISTANCE AND DURATION.",
    extrapolated: "BEYOND THE OBSERVED RANGE: EXTRAPOLATED.",
  };
}

export const FUTURES = [
  { id: "busier", label: "A BUSIER YEAR", sub: "+15% DEMAND", dm: 1.15, cm: 1 },
  { id: "lane", label: "A LANE LOST", sub: "-10% CAPACITY", dm: 1, cm: 0.9 },
  { id: "quieter", label: "A QUIETER CITY", sub: "-15% DEMAND", dm: 0.85, cm: 1 },
  { id: "yours", label: "YOUR FUTURE", sub: "FROM THE LAB", dm: NaN, cm: NaN },
] as const;

export function copyS06() {
  return {
    statement: "Three futures, one curve.",
    chip: "NOT A FORECAST",
    caption: "THE MODEL HAS NO ROUTING AND NO MODE SHIFT: ONLY SPEED CHANGES.",
  };
}

export interface Exchange { q: string; a: string; tag: "OBSERVED" | "DERIVED" | null; receipt: string }

/** S07 argument stack: copy deck answers with every number bound to an artifact field. */
export function copyS07(f: Facts, x: {
  bpr: Record<string, { rmse: number; holdout?: { borough_level?: { test: { rmse: number; rmse_const_train_mean: number; rmse_freeflow_const: number } } } }>;
  clusters: { k: number; silhouette: number; silhouette_by_k: Record<string, number>; random_label_silhouette: { max: number }; stability_ari: { ari_min: number; n_seeds: number } };
}): Exchange[] {
  const w = f.weather_prcp_effect_10mm;
  const spansZero = w.ci_low_pct <= 0 && w.ci_high_pct >= 0;
  const b = x.bpr;
  const short: Record<string, string> = { Manhattan: "MN", Brooklyn: "BK", Queens: "QN", Bronx: "BX", "Staten Island": "SI" };
  const rmse = Object.entries(b).map(([k, v]) => `${short[k] ?? k} ${v.rmse.toFixed(2)}`).join(", ");
  const mn = b.Manhattan?.holdout?.borough_level?.test;
  const k4 = x.clusters.silhouette_by_k["4"];
  return [
    { q: "THIS IS JUST TAXIS.", a: 'CORRECT. YELLOW, GREEN AND APP-BASED RIDES ONLY. NO SUBWAY, BUS, BIKE, WALKING OR PRIVATE CARS. "DEMAND" ON THIS SITE MEANS FOR-HIRE TRIP DEMAND.', tag: null, receipt: "meta.json" },
    { q: "DO THE NUMBERS ADD UP?", a: `${int(f.raw_rows_total)} RAW ROWS = ${int(f.trips_kept_total)} KEPT + ${int(f.excluded_total)} EXCLUDED, BY REASON, PER FLEET AND MONTH. A TEST FAILS THE BUILD IF THEY DON'T.`, tag: "OBSERVED", receipt: "reconciliation.json" },
    { q: "THOSE LINES LOOK LIKE ROUTES.", a: "THEY AREN'T. SINCE 2016 THE CITY PUBLISHES ZONES, NOT COORDINATES. EVERY LINE JOINS TWO ZONE CENTERS. MOVING PULSES ARE PLACED ON ZONE-TO-ZONE LINES WITH FIXED, SEEDED TIMING.", tag: null, receipt: "od_top.json" },
    { q: "DOES RAIN CHANGE HOW MANY RIDES THERE ARE?", a: spansZero
      ? `CONTROLLING FOR WEEKDAY, MONTH, TEMPERATURE, SNOW AND HOLIDAYS, WE FIND NO CLEAR ASSOCIATION BETWEEN RAIN AND DAILY RIDES (95% CI ${signed(w.ci_low_pct)}% TO ${signed(w.ci_high_pct)}%). ONE STATION, CENTRAL PARK.`
      : `WE CAN'T SAY "CAUSE". CONTROLLING FOR WEEKDAY, MONTH, TEMPERATURE, SNOW AND HOLIDAYS, EACH 10 MM OF RAIN IS ASSOCIATED WITH A ${signed(w.pct)}% CHANGE IN DAILY RIDES (95% CI ${signed(w.ci_low_pct)}% TO ${signed(w.ci_high_pct)}%). ONE STATION, CENTRAL PARK. ASSOCIATION, NOT CAUSE.`, tag: "DERIVED", receipt: "weather_model.json" },
    { q: "HOW GOOD IS THE CONGESTION CURVE?", a: `FITTED PER BOROUGH ON OBSERVED HOURLY VOLUME AND SPEED. FIT ERROR (RMSE, TRAVEL-TIME INDEX): ${rmse}.${mn ? ` FIT ON JAN-SEP AND SCORED ON OCT-DEC, MANHATTAN'S ERROR IS ${mn.rmse.toFixed(2)}, AGAINST ${mn.rmse_const_train_mean.toFixed(2)} FOR A CONSTANT AND ${mn.rmse_freeflow_const.toFixed(2)} FOR "ALWAYS FREE-FLOW".` : ""} AT 1.0x DEMAND IT REPRODUCES THE OBSERVED CITY EXACTLY, BY CONSTRUCTION.`, tag: "DERIVED", receipt: "bpr_fit.json" },
    { q: "WHO GETS HIDDEN?", a: `ANY ZONE-TO-ZONE CELL WITH FEWER THAN 11 TRIPS: ${int(f.suppressed_cells_total)} CELLS, ${int(f.suppressed_trips_total)} TRIPS. THEY STAY IN THE TOTALS. THEY'RE ONLY REMOVED FROM THE CORRIDOR VIEWS.`, tag: "OBSERVED", receipt: "reconciliation.json" },
    { q: "ARE THE NEIGHBORHOOD TYPES REAL?", a: `WEAKLY. K = ${x.clusters.k} WAS CHOSEN BY SILHOUETTE OVER 3 TO 8 (${x.clusters.silhouette.toFixed(2)}${k4 !== undefined ? `; ${k4.toFixed(2)} AT K = 4` : ""}). RANDOM LABELS SCORE ${x.clusters.random_label_silhouette.max.toFixed(2)} AT BEST, AND THE TYPES HOLD ACROSS ${x.clusters.stability_ari.n_seeds} SEEDS (ADJUSTED RAND ${x.clusters.stability_ari.ari_min.toFixed(2)} OR MORE). READ THEM AS TENDENCIES.`, tag: "DERIVED", receipt: "clusters.json" },
  ];
}

export function limitations() {
  return [
    "FOR-HIRE TRIPS ONLY: NO SUBWAY, BUS, BIKE, WALKING OR PRIVATE CARS.",
    "ZONES, NOT COORDINATES: EVERY LINE JOINS TWO ZONE CENTERS.",
    "SPEED IS A PROXY FROM TRIP DISTANCE AND DURATION, NOT A ROAD MEASUREMENT.",
    "THE PRESSURE LAB IS ONE FITTED CURVE PER BOROUGH: NO ROAD NETWORK, ROUTING OR CHANGE IN HOW PEOPLE TRAVEL.",
    "WEATHER COMES FROM ONE STATION (CENTRAL PARK) APPLIED CITYWIDE.",
    "SUN 1 AM CELLS INCLUDE THE REPEATED HOUR OF THE NOV 3 DST FALL-BACK (ABOUT 1.9% HIGH).",
    "CORRIDORS WITH FEWER THAN 11 TRIPS ARE HIDDEN FROM CORRIDOR VIEWS.",
  ];
}

export function copyS08(f: Facts) {
  return {
    paragraph: "A city is not only its streets. It is everyone deciding, every hour, to be somewhere else, and the lines those decisions draw.",
    caption: `THE BUSIEST CORRIDOR OF 2024: ${f.top_od_pair.o_name.toUpperCase()} → ${f.top_od_pair.d_name.toUpperCase()} · ${int(f.top_od_pair.trips)} RIDES.`,
  };
}

/** Minimum citywide margin (minutes) before the asymmetry is worth a headline: 15 seconds. */
export const ASYM_MIN_MARGIN = 0.25;
/**
 * S06 asymmetry callout (QA D-011): scoped to what was computed (citywide, trip-weighted, at the
 * selected hour) and shown only when the margin clears ASYM_MIN_MARGIN. Otherwise null.
 */
export function asymmetryCallout(up: number, down: number, when: string): string | null {
  const margin = Math.abs(up) - Math.abs(down);
  if (margin < ASYM_MIN_MARGIN) return null;
  return `Citywide at ${when}, adding 15% costs more than removing 15% saves.`;
}

/** D-010: the S05 statement's ratio and the lab's speed are different quantities; name both. */
export function speedDefinitions(f: Facts, labSpeed: number, labFreeFlow: number, when: string) {
  const mn = f.borough_am_peak_speed_ratio.Manhattan;
  if (!mn) return "";
  return `${pct0(mn.speed_ratio_pct)}% IS THE MEDIAN ZONE SPEED AGAINST ITS OWN OVERNIGHT FREE-FLOW, ${f.am_peak_hour.label.toUpperCase()} WEEKDAYS. THE LAB POOLS ALL MANHATTAN TRIPS: ${mph(labSpeed)} MPH AT ${when}, ${pct0((100 * labSpeed) / labFreeFlow)}% OF ${mph(labFreeFlow)} MPH.`;
}
