const NOTE_NAMES = [
  'C',
  'C♯',
  'D',
  'D♯',
  'E',
  'F',
  'F♯',
  'G',
  'G♯',
  'A',
  'A♯',
  'B',
];

export function detectPitch(buffer: Float32Array, sampleRate: number): number | null {
  if (buffer.length < 512 || !Number.isFinite(sampleRate) || sampleRate <= 0) {
    return null;
  }

  let mean = 0;
  for (let index = 0; index < buffer.length; index += 1) {
    mean += buffer[index];
  }
  mean /= buffer.length;

  let squaredSignal = 0;
  for (let index = 0; index < buffer.length; index += 1) {
    const sample = buffer[index] - mean;
    buffer[index] = sample;
    squaredSignal += sample * sample;
  }

  const rms = Math.sqrt(squaredSignal / buffer.length);
  if (rms < 0.008) {
    return null;
  }

  const minFrequency = 120;
  const maxFrequency = 3000;
  const minOffset = Math.max(2, Math.floor(sampleRate / maxFrequency));
  const maxOffset = Math.min(
    Math.floor(sampleRate / minFrequency),
    Math.floor(buffer.length / 2),
  );
  const comparisonLength = buffer.length - maxOffset;
  const normalizedDifference = new Float64Array(maxOffset + 1);
  let runningDifference = 0;

  for (let offset = 1; offset <= maxOffset; offset += 1) {
    let difference = 0;
    for (let index = 0; index < comparisonLength; index += 1) {
      const delta = buffer[index] - buffer[index + offset];
      difference += delta * delta;
    }
    runningDifference += difference;
    normalizedDifference[offset] =
      runningDifference === 0
        ? 1
        : (difference * offset) / runningDifference;
  }

  let bestOffset = -1;
  for (let offset = minOffset; offset < maxOffset; offset += 1) {
    if (normalizedDifference[offset] < 0.16) {
      while (
        offset + 1 <= maxOffset &&
        normalizedDifference[offset + 1] < normalizedDifference[offset]
      ) {
        offset += 1;
      }
      bestOffset = offset;
      break;
    }
  }

  if (bestOffset === -1) {
    let bestDifference = Number.POSITIVE_INFINITY;
    for (let offset = minOffset; offset <= maxOffset; offset += 1) {
      if (normalizedDifference[offset] < bestDifference) {
        bestDifference = normalizedDifference[offset];
        bestOffset = offset;
      }
    }
  }

  if (
    bestOffset <= minOffset
    || bestOffset >= maxOffset
    || normalizedDifference[bestOffset] > 0.35
  ) {
    return null;
  }

  const left = normalizedDifference[bestOffset - 1];
  const center = normalizedDifference[bestOffset];
  const right = normalizedDifference[bestOffset + 1];
  const denominator = left + right - 2 * center;
  const correction =
    denominator === 0 ? 0 : (0.5 * (left - right)) / denominator;
  const frequency = sampleRate / (bestOffset + correction);

  return frequency >= minFrequency && frequency <= maxFrequency
    ? frequency
    : null;
}

export function pitchName(frequency: number) {
  const midi = Math.round(69 + 12 * Math.log2(frequency / 440));
  return {
    note: NOTE_NAMES[(midi + 1200) % 12],
    octave: Math.floor(midi / 12) - 1,
    target: 440 * Math.pow(2, (midi - 69) / 12),
  };
}
