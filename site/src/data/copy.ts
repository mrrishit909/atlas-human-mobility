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
