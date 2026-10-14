import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMetronomePattern,
  getBaseBeatIntervalSeconds,
  getGroupStartIndices,
  isSwingAvailable,
  METRONOME_METERS,
  METRONOME_SUBDIVISIONS,
} from "./metronome.ts";

const meter = (label) =>
  METRONOME_METERS.find((item) => item.label === label);

test("quarter-note BPM stays in range and compound meters use eighth-note beat intervals", () => {
  const simple = meter("4 / 4");
  const compound = meter("6 / 8");

  assert.equal(getBaseBeatIntervalSeconds(30, simple), 2);
  assert.equal(getBaseBeatIntervalSeconds(240, simple), 0.25);
  assert.equal(getBaseBeatIntervalSeconds(30, compound), 1);
  assert.equal(getBaseBeatIntervalSeconds(240, compound), 0.125);
  assert.throws(() => getBaseBeatIntervalSeconds(29, simple), RangeError);
  assert.throws(() => getBaseBeatIntervalSeconds(241, simple), RangeError);
});

test("all six note-value grids produce even quarter-note patterns in 4/4", () => {
  const fourFour = meter("4 / 4");

  for (const subdivision of METRONOME_SUBDIVISIONS) {
    const pattern = buildMetronomePattern(
      fourFour,
      subdivision.id,
      true,
    );
    const positions = pattern.map((event) => event.offsetBeats);
    const expectedCount = 4 * subdivision.clicksPerQuarter;

    assert.equal(pattern.length, expectedCount, subdivision.label);
    assert.equal(new Set(positions).size, positions.length, subdivision.label);
    for (let index = 1; index < positions.length; index += 1) {
      assert.ok(
        Math.abs(
          positions[index] -
            positions[index - 1] -
            1 / subdivision.clicksPerQuarter,
        ) < 1e-8,
        `${subdivision.label} has even spacing`,
      );
    }
  }
});

test("beat-only patterns preserve every numerator beat in simple and compound meters", () => {
  for (const signature of METRONOME_METERS) {
    const pattern = buildMetronomePattern(
      signature,
      "quarter",
      false,
    );

    assert.equal(pattern.length, signature.beats, signature.label);
    assert.deepEqual(
      pattern.map((event) => event.offsetBeats),
      Array.from({ length: signature.beats }, (_, index) => index),
    );
  }
});

test("compound and asymmetric meters expose musically sensible group starts", () => {
  assert.deepEqual(getGroupStartIndices(meter("5 / 4")), [0, 3]);
  assert.deepEqual(getGroupStartIndices(meter("6 / 8")), [0, 3]);
  assert.deepEqual(getGroupStartIndices(meter("9 / 8")), [0, 3, 6]);
  assert.deepEqual(getGroupStartIndices(meter("12 / 8")), [0, 3, 6, 9]);
});

test("subdivision grids remain unique and align to denominator beats in compound meters", () => {
  const twelveEight = meter("12 / 8");
  const greatestCommonDivisor = (left, right) => {
    let a = left;
    let b = right;
    while (b !== 0) {
      [a, b] = [b, a % b];
    }
    return a;
  };

  for (const subdivision of METRONOME_SUBDIVISIONS) {
    const pattern = buildMetronomePattern(
      twelveEight,
      subdivision.id,
      true,
    );
    const positions = pattern.map((event) => event.offsetBeats);
    const gridCount = 6 * subdivision.clicksPerQuarter;
    const sharedClicks =
      6 * greatestCommonDivisor(subdivision.clicksPerQuarter, 2);
    const expectedGridCount = twelveEight.beats + gridCount - sharedClicks;

    assert.equal(pattern.length, expectedGridCount, subdivision.label);
    assert.equal(new Set(positions).size, positions.length, subdivision.label);
    assert.equal(
      pattern.filter((event) => event.kind === "beat").length,
      twelveEight.beats,
      `${subdivision.label} retains compound meter beats`,
    );
  }
});

test("light swing and shuffle alter eighth-note pairs only in quarter-note meters", () => {
  const fourFour = meter("4 / 4");
  const light = buildMetronomePattern(fourFour, "eighth", true, "light")
    .filter((event) => event.kind === "subdivision")
    .map((event) => event.offsetBeats);
  const shuffle = buildMetronomePattern(
    fourFour,
    "eighth",
    true,
    "shuffle",
  )
    .filter((event) => event.kind === "subdivision")
    .map((event) => event.offsetBeats);

  assert.ok(Math.abs(light[0] - 0.6) < 1e-8);
  assert.ok(Math.abs(shuffle[0] - 2 / 3) < 1e-8);
  assert.equal(isSwingAvailable(fourFour, "eighth", true), true);
  assert.equal(isSwingAvailable(meter("6 / 8"), "eighth", true), false);
  assert.equal(isSwingAvailable(fourFour, "sixteenth", true), false);
  assert.equal(isSwingAvailable(fourFour, "eighth", false), false);
});

test("maximum-rate clicks stay distinct at 240 BPM", () => {
  const simple = meter("4 / 4");
  const compound = meter("12 / 8");
  const thirtySeconds = METRONOME_SUBDIVISIONS.find(
    (item) => item.id === "thirty-second",
  );
  const simpleInterval =
    getBaseBeatIntervalSeconds(240, simple) /
    thirtySeconds.clicksPerQuarter;
  const compoundInterval =
    getBaseBeatIntervalSeconds(240, compound) /
    (thirtySeconds.clicksPerQuarter / 2);

  assert.equal(simpleInterval, 0.03125);
  assert.equal(compoundInterval, 0.03125);
});
