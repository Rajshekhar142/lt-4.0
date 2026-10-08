/**
 * CAT Knowledge Tree — syllabus definition + layout helpers.
 *
 * SVG space is 500 x 520. Trunk runs at x = 250 from y = 480 (base) to y = 70 (top).
 * Angles are SVG polar degrees: 0 = right, -90 = straight up, -180 = left.
 *
 * ID RULES: every `id` is unique, lowercase snake_case and IMMUTABLE once drills are logged.
 * Leaf ids are the foreign key in `drill_logs.topic_id`. Rename `name` freely, never `id`.
 */

export type Section = "VARC" | "DILR" | "QA";

/** A sub-branch sprouting from its parent's tip. Leaves (no children) are drillable. */
export type SubTopicConfig = {
  id: string;
  name: string;
  section: Section;
  /** Angle relative to the parent branch direction. Negative = turns up, positive = turns down. */
  relativeAngleDeg: number;
  /** Branch length in SVG units (35–60 recommended). */
  length: number;
  /** Quadratic Bézier bend, as a fraction of length (-0.3..0.3). Default 0.12. */
  curvature?: number;
  /** Optional coverage notes shown in tooltips; they are not separate drill targets. */
  covers?: string[];
  children?: SubTopicConfig[];
};

/** A primary branch attached to the central trunk. */
export type TopicNodeConfig = {
  id: string;
  name: string;
  section: Section;
  /** Height above the trunk base (0 = bottom, 410 = top). SVG y = TRUNK_BASE_Y - baseY. */
  baseY: number;
  /** Absolute SVG angle. Left -115..-165, right -15..-65, crown -70..-110. */
  angleDeg: number;
  /** Primary branch length (90–105 recommended, 55–70 for crown). */
  length: number;
  curvature?: number;
  covers?: string[];
  children?: SubTopicConfig[];
};

export const SVG_WIDTH = 500;
export const SVG_HEIGHT = 520;
export const TRUNK_X = 250;
export const TRUNK_BASE_Y = 480;
export const TRUNK_TOP_Y = 70;
export const DEFAULT_CURVATURE = 0.12;

/** Spec: baseY 0 = bottom (y = 480), baseY 410 = top (y = 70). */
export const trunkY = (baseY: number): number => TRUNK_BASE_Y - baseY;

export const SECTION_LABELS: Record<Section, string> = {
  VARC: "Verbal Ability & RC",
  DILR: "Data Interpretation & Logical Reasoning",
  QA: "Quantitative Aptitude",
};

/**
 * Interleaved bottom -> crown: QA, VARC, DILR, QA, VARC, QA, DILR, QA.
 * Sides alternate right/left so branch fans never stack on one side.
 */
export const SYLLABUS_TREE: TopicNodeConfig[] = [
  // ───────── Lower trunk ─────────
  {
    id: "qa_arithmetic",
    name: "Arithmetic",
    section: "QA",
    baseY: 25,
    angleDeg: -30,
    length: 100,
    curvature: 0.1,
    children: [
      {
        id: "qa_arith_percent_pl",
        name: "Percentages & Profit/Loss",
        section: "QA",
        relativeAngleDeg: -60,
        length: 50,
        curvature: 0.12,
        covers: ["Percentages", "Profit & loss", "Discount", "Simple & compound interest"],
      },
      {
        id: "qa_arith_ratio_avg_mix",
        name: "Ratio, Averages & Mixtures",
        section: "QA",
        relativeAngleDeg: -24,
        length: 50,
        curvature: -0.1,
        covers: ["Ratio & proportion", "Variation", "Averages", "Alligation & mixtures"],
      },
      {
        id: "qa_arith_tsd",
        name: "Time, Speed & Distance",
        section: "QA",
        relativeAngleDeg: 12,
        length: 48,
        curvature: 0.12,
        covers: ["Relative speed", "Trains", "Boats & streams", "Races", "Circular motion"],
      },
      {
        id: "qa_arith_work_pipes",
        name: "Time & Work, Pipes",
        section: "QA",
        relativeAngleDeg: 48,
        length: 44,
        curvature: -0.1,
        covers: ["Efficiency method", "Pipes & cisterns", "Work with leaving/joining"],
      },
    ],
  },
  {
    id: "varc_rc_foundations",
    name: "RC Foundations",
    section: "VARC",
    baseY: 80,
    angleDeg: -150,
    length: 100,
    curvature: -0.1,
    children: [
      {
        id: "varc_rc_main_idea_tone",
        name: "Main Idea & Author Tone",
        section: "VARC",
        relativeAngleDeg: 40,
        length: 50,
        curvature: -0.12,
        covers: ["Central idea", "Primary purpose", "Tone & attitude", "Passage structure"],
      },
      {
        id: "varc_rc_inference_cr",
        name: "Inference & Critical Reasoning",
        section: "VARC",
        relativeAngleDeg: 2,
        length: 52,
        curvature: 0.1,
        covers: ["Inference", "Assumption", "Strengthen/weaken", "Logical consistency"],
      },
      {
        id: "varc_rc_detail_vocab",
        name: "Detail, Function & Vocab-in-Context",
        section: "VARC",
        relativeAngleDeg: -36,
        length: 46,
        curvature: -0.1,
        covers: ["Detail & specific-fact questions", "Function of a paragraph", "Word/phrase in context", "Passage-type exposure"],
      },
    ],
  },
  {
    id: "dilr_analytical",
    name: "DILR Analytical",
    section: "DILR",
    baseY: 135,
    angleDeg: -50,
    length: 100,
    curvature: 0.1,
    children: [
      {
        id: "dilr_an_arrangements",
        name: "Linear & Circular Arrangements",
        section: "DILR",
        relativeAngleDeg: -38,
        length: 50,
        curvature: 0.12,
        covers: ["Linear seating", "Circular seating", "Multi-attribute arrangements", "Scheduling & ordering"],
      },
      {
        id: "dilr_an_matrix_grid",
        name: "Matrix & Grid Puzzles",
        section: "DILR",
        relativeAngleDeg: 0,
        length: 50,
        curvature: -0.1,
        covers: ["Matching / assignment grids", "Truth-teller puzzles", "Distribution & allocation"],
      },
      {
        id: "dilr_an_venn_selection",
        name: "Venn, Sets & Selections",
        section: "DILR",
        relativeAngleDeg: 38,
        length: 46,
        curvature: 0.1,
        covers: ["2/3/4-set Venn", "Selection & team formation", "Logical conditions"],
      },
    ],
  },

  // ───────── Mid trunk ─────────
  {
    id: "qa_number_modern",
    name: "Number Systems & Modern Math",
    section: "QA",
    baseY: 185,
    angleDeg: -135,
    length: 100,
    curvature: -0.1,
    children: [
      {
        id: "qa_nm_divisibility_remainders",
        name: "Divisibility & Remainders",
        section: "QA",
        relativeAngleDeg: 54,
        length: 50,
        curvature: -0.1,
        covers: ["Divisibility rules", "Remainder theorems", "Cyclicity & last digits", "Factorials & trailing zeroes"],
      },
      {
        id: "qa_nm_factors_hcf_base",
        name: "Factors, HCF/LCM & Bases",
        section: "QA",
        relativeAngleDeg: 18,
        length: 48,
        curvature: 0.12,
        covers: ["Number of factors", "HCF & LCM", "Base systems", "Primes"],
      },
      {
        id: "qa_nm_perm_comb",
        name: "Permutations & Combinations",
        section: "QA",
        relativeAngleDeg: -18,
        length: 50,
        curvature: -0.12,
        covers: ["Arrangements & selections", "Circular & restricted cases", "Distribution", "Derangements"],
      },
      {
        id: "qa_nm_probability",
        name: "Probability",
        section: "QA",
        relativeAngleDeg: -54,
        length: 46,
        curvature: 0.1,
        covers: ["Classical probability", "Conditional probability", "Complement", "Sets & Venn counting"],
      },
    ],
  },
  {
    id: "varc_verbal",
    name: "Verbal Ability",
    section: "VARC",
    baseY: 235,
    angleDeg: -25,
    length: 95,
    curvature: 0.1,
    children: [
      {
        id: "varc_va_para_jumbles",
        name: "Para Jumbles",
        section: "VARC",
        relativeAngleDeg: -42,
        length: 48,
        curvature: 0.12,
        covers: ["Mandatory pairs", "Opening/closing sentence", "Pronoun & connector links"],
      },
      {
        id: "varc_va_summary_odd",
        name: "Para Summary & Odd Sentence",
        section: "VARC",
        relativeAngleDeg: -4,
        length: 50,
        curvature: -0.1,
        covers: ["Para summary", "Odd sentence out", "Central-theme elimination"],
      },
      {
        id: "varc_va_completion",
        name: "Para Completion & Sentence Placement",
        section: "VARC",
        relativeAngleDeg: 34,
        length: 44,
        curvature: 0.1,
        covers: ["Para completion", "Sentence insertion", "Concluding-line logic"],
      },
    ],
  },
  {
    id: "qa_algebra",
    name: "Algebra",
    section: "QA",
    baseY: 285,
    angleDeg: -160,
    length: 100,
    curvature: 0.1,
    children: [
      {
        id: "qa_alg_quadratics_poly",
        name: "Quadratics & Polynomials",
        section: "QA",
        relativeAngleDeg: 50,
        length: 48,
        curvature: -0.12,
        covers: ["Roots & nature of roots", "Vieta relations", "Polynomial remainders", "Max/min of expressions"],
      },
      {
        id: "qa_alg_inequalities_modulus",
        name: "Inequalities & Modulus",
        section: "QA",
        relativeAngleDeg: 17,
        length: 48,
        curvature: 0.1,
        covers: ["Linear/quadratic inequalities", "Modulus equations", "AM-GM", "Graph-based solving"],
      },
      {
        id: "qa_alg_log_sequences",
        name: "Logarithms & Sequences",
        section: "QA",
        relativeAngleDeg: -16,
        length: 48,
        curvature: -0.1,
        covers: ["Log properties", "AP, GP, HP", "Series sums", "Recursive sequences"],
      },
      {
        id: "qa_alg_functions_equations",
        name: "Functions, Indices & Linear Equations",
        section: "QA",
        relativeAngleDeg: -48,
        length: 46,
        curvature: 0.12,
        covers: ["Functions & graphs", "Indices & surds", "Linear & simultaneous equations", "Floor/ceiling"],
      },
    ],
  },

  // ───────── Upper canopy ─────────
  {
    id: "dilr_quantitative",
    name: "DILR Quantitative Reasoning",
    section: "DILR",
    baseY: 325,
    angleDeg: -55,
    length: 90,
    curvature: -0.1,
    children: [
      {
        id: "dilr_qr_games_tournaments",
        name: "Games & Tournaments",
        section: "DILR",
        relativeAngleDeg: -38,
        length: 45,
        curvature: 0.12,
        covers: ["League & knockout tables", "Points tables & rankings", "Match-result inference"],
      },
      {
        id: "dilr_qr_charts_tables",
        name: "Charts, Tables & Missing Data",
        section: "DILR",
        relativeAngleDeg: 0,
        length: 45,
        curvature: -0.1,
        covers: ["Tables", "Bar/line/pie charts", "Caselets", "Missing-data reconstruction"],
      },
      {
        id: "dilr_qr_networks_routes",
        name: "Networks, Routes & Scheduling",
        section: "DILR",
        relativeAngleDeg: 38,
        length: 42,
        curvature: 0.1,
        covers: ["Route/graph networks", "Shortest & cost paths", "Process & project scheduling"],
      },
    ],
  },

  // ───────── Crown ─────────
  {
    id: "qa_geometry",
    name: "Geometry & Mensuration",
    section: "QA",
    baseY: 365,
    angleDeg: -100,
    length: 55,
    curvature: 0.08,
    children: [
      {
        id: "qa_geo_triangles_circles",
        name: "Triangles & Circles",
        section: "QA",
        relativeAngleDeg: -45,
        length: 38,
        curvature: 0.1,
        covers: ["Similarity & congruence", "Centres of a triangle", "Circle theorems", "Polygons"],
      },
      {
        id: "qa_geo_coordinate",
        name: "Coordinate Geometry",
        section: "QA",
        relativeAngleDeg: 0,
        length: 36,
        curvature: -0.08,
        covers: ["Lines & distances", "Areas from coordinates", "Loci", "Basic trigonometry & heights/distances"],
      },
      {
        id: "qa_geo_mensuration",
        name: "Mensuration",
        section: "QA",
        relativeAngleDeg: 45,
        length: 38,
        curvature: 0.1,
        covers: ["2D areas", "3D volumes & surface areas", "Cones, spheres, cylinders"],
      },
    ],
  },
];

/* ──────────────────────────────────────────────────────────────
 * Layout: absolute SVG geometry for every branch (render-ready)
 * ────────────────────────────────────────────────────────────── */

export type LayoutNode = {
  id: string;
  name: string;
  section: Section;
  parentId: string | null;
  depth: number; // 0 = primary branch, 1+ = sub-branches
  isLeaf: boolean;
  absAngleDeg: number;
  length: number;
  /** Start point (trunk for primaries, parent's tip for sub-branches). */
  x0: number;
  y0: number;
  /** Tip point. */
  x1: number;
  y1: number;
  /** Quadratic Bézier control point: path = `M x0 y0 Q cx cy x1 y1`. */
  cx: number;
  cy: number;
  covers?: string[];
};

const toRad = (deg: number) => (deg * Math.PI) / 180;

// Replace layoutBranch with this version that rounds coordinates:
const roundCoord = (val: number) => Number(val.toFixed(2));

function layoutBranch(
  node: TopicNodeConfig | SubTopicConfig,
  parent: { id: string; x: number; y: number; angle: number } | null,
  depth: number,
  out: LayoutNode[],
): void {
  const isPrimary = "baseY" in node;
  const x0 = roundCoord(isPrimary ? TRUNK_X : parent!.x);
  const y0 = roundCoord(isPrimary ? trunkY((node as TopicNodeConfig).baseY) : parent!.y);
  const absAngleDeg = isPrimary
    ? (node as TopicNodeConfig).angleDeg
    : parent!.angle + (node as SubTopicConfig).relativeAngleDeg;

  const rawX1 = x0 + node.length * Math.cos(toRad(absAngleDeg));
  const rawY1 = y0 + node.length * Math.sin(toRad(absAngleDeg));
  const x1 = roundCoord(rawX1);
  const y1 = roundCoord(rawY1);

  // Control point = midpoint pushed along the left-hand normal by curvature * length.
  const k = node.curvature ?? DEFAULT_CURVATURE;
  const dx = (rawX1 - x0) / node.length;
  const dy = (rawY1 - y0) / node.length;
  const cx = roundCoord((x0 + rawX1) / 2 + -dy * k * node.length);
  const cy = roundCoord((y0 + rawY1) / 2 + dx * k * node.length);

  out.push({
    id: node.id,
    name: node.name,
    section: node.section,
    parentId: parent?.id ?? null,
    depth,
    isLeaf: !node.children || node.children.length === 0,
    absAngleDeg,
    length: node.length,
    x0,
    y0,
    x1,
    y1,
    cx,
    cy,
    covers: node.covers,
  });

  node.children?.forEach((child) =>
    layoutBranch(child, { id: node.id, x: x1, y: y1, angle: absAngleDeg }, depth + 1, out),
  );
}

export function computeTreeLayout(tree: TopicNodeConfig[] = SYLLABUS_TREE): LayoutNode[] {
  const out: LayoutNode[] = [];
  tree.forEach((primary) => layoutBranch(primary, null, 0, out));
  return out;
}

/* ──────────────────────────────────────────────────────────────
 * Drill helpers (DrillLogger dropdowns, SQLite foreign keys)
 * ────────────────────────────────────────────────────────────── */

export type DrillTopic = {
  id: string;
  name: string;
  section: Section;
  sectionLabel: string;
  parentId: string;
  parentName: string;
  /** e.g. "QA · Arithmetic › Percentages & Profit/Loss" */
  label: string;
};

function collectLeaves(
  nodes: SubTopicConfig[],
  parent: { id: string; name: string },
  acc: DrillTopic[],
): void {
  for (const n of nodes) {
    if (n.children && n.children.length > 0) {
      collectLeaves(n.children, { id: n.id, name: n.name }, acc);
    } else {
      acc.push({
        id: n.id,
        name: n.name,
        section: n.section,
        sectionLabel: SECTION_LABELS[n.section],
        parentId: parent.id,
        parentName: parent.name,
        label: `${n.section} · ${parent.name} › ${n.name}`,
      });
    }
  }
}

/** Every drillable (leaf) topic, in trunk order. A primary with no children is itself drillable. */
export function getAllDrillTopics(tree: TopicNodeConfig[] = SYLLABUS_TREE): DrillTopic[] {
  const acc: DrillTopic[] = [];
  for (const p of tree) {
    if (p.children && p.children.length > 0) {
      collectLeaves(p.children, { id: p.id, name: p.name }, acc);
    } else {
      acc.push({
        id: p.id,
        name: p.name,
        section: p.section,
        sectionLabel: SECTION_LABELS[p.section],
        parentId: p.id,
        parentName: p.name,
        label: `${p.section} · ${p.name}`,
      });
    }
  }
  return acc;
}

export const ALL_LEAF_TOPICS: DrillTopic[] = getAllDrillTopics();

export const getDrillTopicsBySection = (section: Section): DrillTopic[] =>
  ALL_LEAF_TOPICS.filter((t) => t.section === section);

export const getDrillTopicById = (id: string): DrillTopic | undefined =>
  ALL_LEAF_TOPICS.find((t) => t.id === id);

/* ──────────────────────────────────────────────────────────────
 * Dev-time validation. Returns a list of problems (empty = OK).
 * ────────────────────────────────────────────────────────────── */

export function validateSyllabus(margin = 15): string[] {
  const problems: string[] = [];
  const layout = computeTreeLayout();

  const seen = new Set<string>();
  for (const n of layout) {
    if (seen.has(n.id)) problems.push(`Duplicate id: ${n.id}`);
    seen.add(n.id);
    if (!/^[a-z0-9_]+$/.test(n.id)) problems.push(`Id not lowercase snake_case: ${n.id}`);

    for (const [label, x, y] of [
      ["tip", n.x1, n.y1],
      ["control", n.cx, n.cy],
    ] as const) {
      if (x < margin || x > SVG_WIDTH - margin || y < margin || y > SVG_HEIGHT - margin) {
        problems.push(`${n.id} ${label} out of bounds: (${x.toFixed(1)}, ${y.toFixed(1)})`);
      }
    }
  }

  const primaries = SYLLABUS_TREE.map((p) => p.baseY).sort((a, b) => a - b);
  for (let i = 1; i < primaries.length; i++) {
    if (primaries[i] - primaries[i - 1] < 35) {
      problems.push(`Primary baseY gap < 35 near ${primaries[i]}`);
    }
  }
  return problems;
}