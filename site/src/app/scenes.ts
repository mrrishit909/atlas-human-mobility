/**
 * Scene registry (VISUAL_DESIGN 3.1, landing p from MOTION_SYSTEM 6.2).
 * Track heights are the design's; headings use only copy-deck text that needs
 * no data binding (chapter titles, or statements without placeholders).
 */
export interface SceneDef {
  id: string;
  nav?: string;
  track: string;
  landing: number;
  kicker: string;
  heading: string;
}

export const SCENES: SceneDef[] = [
  { id: "city", nav: "CITY", track: "200vh", landing: 0.78, kicker: "01 · THE CITY AWAKENS", heading: "Millions of journeys. One living system." },
  { id: "anatomy", nav: "ANATOMY", track: "300vh", landing: 0.14, kicker: "02 · ANATOMY OF A JOURNEY", heading: "Anatomy of a journey." },
  { id: "rush-hour", nav: "RUSH HOUR", track: "200vh", landing: 0.35, kicker: "03 · THE RUSH HOUR", heading: "The rush hour." },
  { id: "corridors", nav: "CORRIDORS", track: "300vh", landing: 0.05, kicker: "04 · INVISIBLE CORRIDORS", heading: "Draw every ride as a line, and the city's hidden corridors appear." },
  { id: "demand", nav: "DEMAND", track: "300vh", landing: 0.89, kicker: "05 · WHERE DEMAND CONCENTRATES", heading: "Flatten the ring and the city reappears." },
  { id: "pressure", nav: "PRESSURE", track: "250vh", landing: 0.4, kicker: "06 · A CITY UNDER PRESSURE", heading: "A city under pressure." },
  { id: "futures", nav: "FUTURES", track: "200vh", landing: 0.1, kicker: "07 · ALTERNATIVE FUTURES", heading: "Alternative futures." },
  { id: "evidence", nav: "EVIDENCE", track: "250vh", landing: 0.05, kicker: "08 · HOW WE KNOW", heading: "How we know." },
  { id: "observatory", nav: "OBSERVATORY", track: "auto", landing: 0, kicker: "THE URBAN INTELLIGENCE OBSERVATORY", heading: "The urban intelligence observatory." },
  {
    id: "closing", track: "200vh", landing: 0.9, kicker: "CLOSING", // past the paragraph reveal and the echo
    heading: "A city is not only its streets. It is everyone deciding, every hour, to be somewhere else, and the lines those decisions draw.",
  },
];

export const NAV_ITEMS = SCENES.filter((s) => s.nav).map((s) => ({ id: s.id, label: s.nav! }));
/** S08 has no nav item; it keeps OBSERVATORY active (6.1). */
export const navActive = (id: string | null) => (id === "closing" ? "observatory" : id);
