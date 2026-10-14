export type MeterSignature = {
  label: string;
  beats: number;
  unit: 4 | 8;
  groups: readonly number[];
};

export type SubdivisionId =
  | "quarter"
  | "eighth"
  | "eighth-triplet"
  | "sixteenth"
  | "sixteenth-triplet"
  | "thirty-second";

export type SwingFeel = "straight" | "light" | "shuffle";

export type SubdivisionChoice = {
  id: SubdivisionId;
  label: string;
  clicksPerQuarter: number;
};

export type MetronomeEvent = {
  offsetBeats: number;
  beatIndex: number;
  groupIndex: number;
  groupStart: boolean;
  kind: "beat" | "subdivision";
};

export const METRONOME_METERS: readonly MeterSignature[] = [
  { label: "2 / 4", beats: 2, unit: 4, groups: [2] },
  { label: "3 / 4", beats: 3, unit: 4, groups: [3] },
  { label: "4 / 4", beats: 4, unit: 4, groups: [4] },
  { label: "5 / 4", beats: 5, unit: 4, groups: [3, 2] },
  { label: "6 / 8", beats: 6, unit: 8, groups: [3, 3] },
  { label: "9 / 8", beats: 9, unit: 8, groups: [3, 3, 3] },
  { label: "12 / 8", beats: 12, unit: 8, groups: [3, 3, 3, 3] },
];

export const METRONOME_SUBDIVISIONS: readonly SubdivisionChoice[] = [
  { id: "quarter", label: "Quarter notes", clicksPerQuarter: 1 },
  { id: "eighth", label: "Eighth notes", clicksPerQuarter: 2 },
  { id: "eighth-triplet", label: "Eighth-note triplets", clicksPerQuarter: 3 },
  { id: "sixteenth", label: "Sixteenth notes", clicksPerQuarter: 4 },
  { id: "sixteenth-triplet", label: "Sixteenth-note triplets", clicksPerQuarter: 6 },
  { id: "thirty-second", label: "Thirty-second notes", clicksPerQuarter: 8 },
];

const SWING_RATIOS: Record<Exclude<SwingFeel, "straight">, number> = {
  light: 3 / 2,
  shuffle: 2,
};

const FLOAT_TOLERANCE = 1e-8;

export function getBaseBeatIntervalSeconds(
  bpm: number,
  meter: MeterSignature,
): number {
  if (!Number.isInteger(bpm) || bpm < 30 || bpm > 240) {
    throw new RangeError("Tempo must be an integer from 30 to 240 BPM.");
  }

  return (60 / bpm) * (4 / meter.unit);
}

export function getGroupStartIndices(meter: MeterSignature): number[] {
  const starts: number[] = [];
  let beatIndex = 0;

  for (const groupSize of meter.groups) {
    starts.push(beatIndex);
    beatIndex += groupSize;
  }

  if (beatIndex !== meter.beats) {
    throw new RangeError(
      `The beat groups for ${meter.label} must add up to ${meter.beats}.`,
    );
  }

  return starts;
}

export function isSwingAvailable(
  meter: MeterSignature,
  subdivision: SubdivisionId,
  subdivisionClicks: boolean,
): boolean {
  return subdivisionClicks && meter.unit === 4 && subdivision === "eighth";
}

export function buildMetronomePattern(
  meter: MeterSignature,
  subdivision: SubdivisionId,
  subdivisionClicks: boolean,
  swing: SwingFeel = "straight",
): MetronomeEvent[] {
  const groupStarts = new Set(getGroupStartIndices(meter));
  const groupIndexByBeat: number[] = [];
  let beatCursor = 0;
  meter.groups.forEach((groupSize, groupIndex) => {
    for (let offset = 0; offset < groupSize; offset += 1) {
      groupIndexByBeat[beatCursor + offset] = groupIndex;
    }
    beatCursor += groupSize;
  });

  const events: MetronomeEvent[] = Array.from(
    { length: meter.beats },
    (_, beatIndex) => ({
      offsetBeats: beatIndex,
      beatIndex,
      groupIndex: groupIndexByBeat[beatIndex],
      groupStart: groupStarts.has(beatIndex),
      kind: "beat",
    }),
  );

  if (!subdivisionClicks) {
    return events;
  }

  const choice = METRONOME_SUBDIVISIONS.find(
    (item) => item.id === subdivision,
  );
  if (!choice) {
    throw new RangeError(`Unknown subdivision: ${subdivision}.`);
  }

  const periodInBeats = meter.unit / (4 * choice.clicksPerQuarter);
  const swingEnabled =
    isSwingAvailable(meter, subdivision, subdivisionClicks) &&
    swing !== "straight";
  const swingRatio = swingEnabled
    ? SWING_RATIOS[swing as Exclude<SwingFeel, "straight">]
    : null;

  for (let gridIndex = 0; ; gridIndex += 1) {
    const straightOffset = gridIndex * periodInBeats;
    if (straightOffset >= meter.beats - FLOAT_TOLERANCE) {
      break;
    }

    let offsetBeats = straightOffset;
    if (swingRatio !== null && gridIndex % 2 === 1) {
      const quarterBeatIndex = Math.floor(gridIndex / 2);
      offsetBeats = quarterBeatIndex + swingRatio / (swingRatio + 1);
    }

    const beatIndex = Math.min(
      meter.beats - 1,
      Math.floor(offsetBeats + FLOAT_TOLERANCE),
    );
    const alreadyHasBeat = events.some(
      (event) =>
        event.kind === "beat" &&
        Math.abs(event.offsetBeats - offsetBeats) < FLOAT_TOLERANCE,
    );
    if (!alreadyHasBeat) {
      events.push({
        offsetBeats,
        beatIndex,
        groupIndex: groupIndexByBeat[beatIndex],
        groupStart: false,
        kind: "subdivision",
      });
    }
  }

  return events.sort((left, right) => left.offsetBeats - right.offsetBeats);
}
