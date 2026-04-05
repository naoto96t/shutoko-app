export type MapPoint = { x: number; y: number };
export type MapRoute = {
  id: string;
  label: string;
  color: string;
  points: MapPoint[];
};

// MVP schematic layout. This is intentionally not geographically exact.
// The structure is optimized so route points and node coordinates can be
// replaced later with values exported from Figma / Illustrator.
export const MAP_ROUTES: MapRoute[] = [
  {
    id: "C1",
    label: "C1",
    color: "#14b8a6",
    points: [
      { x: 425, y: 360 },
      { x: 470, y: 360 },
      { x: 500, y: 390 },
      { x: 500, y: 455 },
      { x: 470, y: 485 },
      { x: 405, y: 485 },
      { x: 375, y: 455 },
      { x: 375, y: 390 },
      { x: 405, y: 360 },
      { x: 425, y: 360 },
    ],
  },
  {
    id: "C2",
    label: "C2",
    color: "#0ea5e9",
    points: [
      { x: 210, y: 205 },
      { x: 150, y: 260 },
      { x: 150, y: 410 },
      { x: 240, y: 500 },
      { x: 360, y: 500 },
      { x: 540, y: 500 },
      { x: 675, y: 430 },
      { x: 675, y: 230 },
      { x: 575, y: 150 },
      { x: 380, y: 150 },
      { x: 260, y: 150 },
      { x: 210, y: 205 },
    ],
  },
  {
    id: "BAY",
    label: "湾岸",
    color: "#06b6d4",
    points: [
      { x: 705, y: 500 },
      { x: 760, y: 560 },
      { x: 885, y: 560 },
      { x: 980, y: 645 },
      { x: 1080, y: 645 },
      { x: 1160, y: 565 },
    ],
  },
  {
    id: "BAY_WEST",
    label: "湾岸西側",
    color: "#06b6d4",
    points: [
      { x: 705, y: 500 },
      { x: 610, y: 595 },
      { x: 455, y: 595 },
      { x: 310, y: 680 },
      { x: 205, y: 770 },
      { x: 80, y: 770 },
    ],
  },
  {
    id: "R1H",
    label: "1号羽田",
    color: "#22c55e",
    points: [
      { x: 565, y: 260 },
      { x: 565, y: 380 },
      { x: 565, y: 535 },
      { x: 565, y: 650 },
    ],
  },
  {
    id: "R1U",
    label: "1号上野",
    color: "#10b981",
    points: [
      { x: 565, y: 260 },
      { x: 565, y: 180 },
      { x: 565, y: 85 },
    ],
  },
  {
    id: "R3A",
    label: "3号",
    color: "#f97316",
    points: [
      { x: 375, y: 455 },
      { x: 315, y: 535 },
      { x: 235, y: 535 },
      { x: 145, y: 605 },
      { x: 40, y: 605 },
    ],
  },
  {
    id: "R4A",
    label: "4号A",
    color: "#eab308",
    points: [
      { x: 375, y: 390 },
      { x: 260, y: 390 },
      { x: 150, y: 390 },
      { x: 65, y: 390 },
    ],
  },
  {
    id: "R4B",
    label: "4号B",
    color: "#ca8a04",
    points: [
      { x: 230, y: 310 },
      { x: 170, y: 250 },
      { x: 100, y: 250 },
    ],
  },
  {
    id: "R5A",
    label: "5号A",
    color: "#84cc16",
    points: [
      { x: 405, y: 360 },
      { x: 325, y: 280 },
      { x: 245, y: 200 },
      { x: 220, y: 120 },
      { x: 205, y: 55 },
    ],
  },
  {
    id: "R5B",
    label: "5号B",
    color: "#65a30d",
    points: [
      { x: 325, y: 280 },
      { x: 270, y: 235 },
      { x: 225, y: 215 },
    ],
  },
  {
    id: "R6A",
    label: "6号向島",
    color: "#38bdf8",
    points: [
      { x: 500, y: 390 },
      { x: 590, y: 310 },
      { x: 630, y: 230 },
      { x: 625, y: 160 },
      { x: 700, y: 85 },
    ],
  },
  {
    id: "R6B",
    label: "6号三郷",
    color: "#0284c7",
    points: [
      { x: 590, y: 310 },
      { x: 650, y: 245 },
      { x: 735, y: 165 },
      { x: 830, y: 75 },
    ],
  },
  {
    id: "R7A",
    label: "7号A",
    color: "#a855f7",
    points: [
      { x: 500, y: 390 },
      { x: 620, y: 390 },
      { x: 740, y: 390 },
      { x: 845, y: 390 },
    ],
  },
  {
    id: "R7B",
    label: "7号B",
    color: "#7c3aed",
    points: [
      { x: 740, y: 390 },
      { x: 740, y: 470 },
      { x: 740, y: 560 },
    ],
  },
  {
    id: "R9",
    label: "9号",
    color: "#14b8a6",
    points: [
      { x: 565, y: 455 },
      { x: 650, y: 535 },
      { x: 705, y: 500 },
    ],
  },
  {
    id: "R10",
    label: "10号",
    color: "#f43f5e",
    points: [
      { x: 565, y: 485 },
      { x: 610, y: 540 },
      { x: 650, y: 575 },
    ],
  },
  {
    id: "R11",
    label: "11号",
    color: "#14b8a6",
    points: [
      { x: 500, y: 455 },
      { x: 565, y: 520 },
      { x: 640, y: 595 },
      { x: 705, y: 500 },
    ],
  },
  {
    id: "K1",
    label: "K1",
    color: "#06b6d4",
    points: [
      { x: 455, y: 595 },
      { x: 335, y: 595 },
      { x: 210, y: 680 },
    ],
  },
  {
    id: "K2",
    label: "K2",
    color: "#06b6d4",
    points: [
      { x: 210, y: 680 },
      { x: 120, y: 740 },
      { x: 55, y: 805 },
    ],
  },
  {
    id: "K3",
    label: "K3",
    color: "#06b6d4",
    points: [
      { x: 210, y: 680 },
      { x: 235, y: 770 },
      { x: 280, y: 845 },
    ],
  },
  {
    id: "K5",
    label: "K5",
    color: "#06b6d4",
    points: [
      { x: 455, y: 595 },
      { x: 340, y: 645 },
      { x: 270, y: 645 },
      { x: 210, y: 680 },
    ],
  },
  {
    id: "K6",
    label: "K6",
    color: "#06b6d4",
    points: [
      { x: 565, y: 650 },
      { x: 650, y: 650 },
      { x: 705, y: 595 },
      { x: 745, y: 645 },
    ],
  },
  {
    id: "S1",
    label: "S1",
    color: "#22c55e",
    points: [
      { x: 565, y: 150 },
      { x: 565, y: 95 },
      { x: 565, y: 35 },
    ],
  },
  {
    id: "S2",
    label: "S2",
    color: "#22c55e",
    points: [
      { x: 245, y: 200 },
      { x: 205, y: 115 },
      { x: 160, y: 55 },
    ],
  },
  {
    id: "S5",
    label: "S5",
    color: "#16a34a",
    points: [
      { x: 220, y: 120 },
      { x: 190, y: 70 },
      { x: 170, y: 35 },
    ],
  },
];

export const MAP_NODES: Record<string, MapPoint> = {
  箱崎PA: { x: 470, y: 455 },
  芝浦PA: { x: 610, y: 520 },
  大黒PA: { x: 255, y: 655 },
  "辰巳PA(第1)": { x: 690, y: 400 },
  "辰巳PA(第2)": { x: 705, y: 485 },

  五反田: { x: 330, y: 555 },
  渋谷: { x: 330, y: 505 },
  初台南: { x: 160, y: 390 },
  西池袋: { x: 170, y: 280 },
  板橋本町: { x: 235, y: 205 },
  錦糸町: { x: 710, y: 395 },
  宝町: { x: 520, y: 430 },
  向島: { x: 625, y: 315 },
  平和島: { x: 565, y: 600 },
  勝島: { x: 565, y: 560 },
  空港西: { x: 565, y: 635 },
  大井: { x: 705, y: 555 },
  晴海: { x: 640, y: 525 },
  豊洲: { x: 650, y: 475 },
  有明: { x: 760, y: 560 },
  枝川: { x: 690, y: 455 },
  四つ木: { x: 740, y: 265 },

  みなとみらい: { x: 150, y: 705 },
  横浜駅東口: { x: 175, y: 685 },
  横浜駅西口: { x: 135, y: 705 },
  横浜公園: { x: 205, y: 735 },
  浅田: { x: 410, y: 595 },
  汐入: { x: 335, y: 595 },
  横浜港北: { x: 110, y: 620 },
  横浜青葉: { x: 40, y: 605 },

  新都心: { x: 170, y: 55 },
  新都心西: { x: 200, y: 75 },
  与野: { x: 190, y: 100 },
};

export const MAP_NODE_ALIASES: Record<string, string> = {
  HakozakiRotary: "箱崎PA",
  ShibauraPA: "芝浦PA",
  DaikokuPA: "大黒PA",
  TatsumiPA1: "辰巳PA(第1)",
  TatsumiPA2: "辰巳PA(第2)",
};

