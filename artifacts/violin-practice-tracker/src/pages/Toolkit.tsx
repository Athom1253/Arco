import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { useGetRepertoire } from '@workspace/api-client-react';
import { Activity, AudioLines, CircleStop, Clock3, Headphones, Minus, Music2, Pause, Play, Plus, RotateCcw, ShieldCheck, Timer, Volume2 } from 'lucide-react';
import { Card, PageHeading } from '@/components/Primitives';
import { detectPitch, pitchName } from '@/lib/pitch-detection';

const signatures = [
  { label: '2 / 4', beats: 2, unit: 4 },
  { label: '3 / 4', beats: 3, unit: 4 },
  { label: '4 / 4', beats: 4, unit: 4 },
  { label: '5 / 4', beats: 5, unit: 4 },
  { label: '6 / 8', beats: 6, unit: 8 },
];
const subdivisionChoices = [1, 2, 3, 4];
const referenceNotes = [
  { name: 'G3', frequency: 196 },
  { name: 'D4', frequency: 293.66 },
  { name: 'A4', frequency: 440 },
  { name: 'E5', frequency: 659.25 },
];

type TunerStatus = 'idle' | 'requesting' | 'listening' | 'denied' | 'no-device' | 'unsupported' | 'insecure' | 'error';

function getAudioContextConstructor(): typeof AudioContext | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.AudioContext
    || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    || null;
}

function scheduleMetronomeClick(
  context: AudioContext,
  strong: boolean,
  atTime: number,
  onEnded: () => void,
): OscillatorNode | null {
  if (context.state !== 'running') {
    return null;
  }
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = strong ? 1120 : 760;
  gain.gain.setValueAtTime(0.001, atTime);
  gain.gain.exponentialRampToValueAtTime(strong ? 0.19 : 0.11, atTime + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.001, atTime + 0.06);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.onended = () => {
    oscillator.disconnect();
    gain.disconnect();
    onEnded();
  };
  oscillator.start(atTime);
  oscillator.stop(atTime + 0.065);
  return oscillator;
}

export default function Toolkit() {
  const repertoireQuery = useGetRepertoire();
  const [bpm, setBpm] = useState(84);
  const [signature, setSignature] = useState(signatures[2]);
  const [subdivision, setSubdivision] = useState(1);
  const [accent, setAccent] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [metronomeError, setMetronomeError] = useState('');
  const [beat, setBeat] = useState(-1);
  const [tunerStatus, setTunerStatus] = useState<TunerStatus>('idle');
  const [detected, setDetected] = useState<{ note: string; octave: number; cents: number } | null>(null);
  const [stopwatchRunning, setStopwatchRunning] = useState(false);
  const [stopwatchElapsed, setStopwatchElapsed] = useState(0);
  const audioRef = useRef<AudioContext | null>(null);
  const tunerRef = useRef<{ stream: MediaStream; context: AudioContext; source: MediaStreamAudioSourceNode; analyser: AnalyserNode } | null>(null);
  const rafRef = useRef<number | null>(null);
  const tunerRequestRef = useRef(0);
  const pitchHistoryRef = useRef<number[]>([]);
  const tapTimesRef = useRef<number[]>([]);
  const stopwatchStartRef = useRef(0);
  const stopwatchAccumulatedRef = useRef(0);

  useEffect(() => {
    if (!playing) return;
    const context = audioRef.current;
    if (!context || context.state !== 'running') {
      setPlaying(false);
      setMetronomeError('Your browser could not start audio. Check sound settings, then try again.');
      return;
    }

    let currentBeat = 0;
    let currentSubdivision = 0;
    let nextNoteTime = context.currentTime + 0.05;
    let cancelled = false;
    const visualTimers = new Set<number>();
    const scheduledNodes = new Set<OscillatorNode>();
    const scheduler = () => {
      if (cancelled) return;
      while (nextNoteTime < context.currentTime + 0.12) {
        const beatForClick = currentBeat;
        const isBeatStart = currentSubdivision === 0;
        let scheduledNode: OscillatorNode | null = null;
        scheduledNode = scheduleMetronomeClick(
          context,
          isBeatStart && accent && currentBeat === 0,
          nextNoteTime,
          () => {
            if (scheduledNode) {
              scheduledNodes.delete(scheduledNode);
            }
          },
        );
        if (scheduledNode) {
          scheduledNodes.add(scheduledNode);
        }
        if (isBeatStart) {
          const delay = Math.max(0, (nextNoteTime - context.currentTime) * 1000);
          const visualTimer = window.setTimeout(() => {
            visualTimers.delete(visualTimer);
            setBeat(beatForClick);
          }, delay);
          visualTimers.add(visualTimer);
        }
        currentSubdivision += 1;
        if (currentSubdivision >= subdivision) {
          currentSubdivision = 0;
          currentBeat = (currentBeat + 1) % signature.beats;
        }
        const beatMs = (60000 / bpm) * (signature.unit === 8 ? 0.5 : 1);
        nextNoteTime += beatMs / subdivision / 1000;
      }
    };
    scheduler();
    const interval = window.setInterval(scheduler, 25);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      visualTimers.forEach((timer) => window.clearTimeout(timer));
      visualTimers.clear();
      scheduledNodes.forEach((node) => {
        try {
          node.stop();
        } catch {
          node.disconnect();
        }
      });
      scheduledNodes.clear();
      setBeat(-1);
    };
  }, [playing, bpm, signature, subdivision, accent]);

  const releaseTuner = () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    const tuner = tunerRef.current;
    if (tuner) {
      tuner.source.disconnect();
      tuner.analyser.disconnect();
      tuner.stream.getTracks().forEach((track) => track.stop());
      if (tuner.context.state !== 'closed') {
        void tuner.context.close();
      }
      tunerRef.current = null;
    }
  };

  useEffect(() => () => {
    tunerRequestRef.current += 1;
    releaseTuner();
    if (audioRef.current) void audioRef.current.close();
  }, []);

  useEffect(() => {
    if (!stopwatchRunning) return;
    const interval = window.setInterval(() => {
      setStopwatchElapsed(stopwatchAccumulatedRef.current + Date.now() - stopwatchStartRef.current);
    }, 100);
    return () => window.clearInterval(interval);
  }, [stopwatchRunning]);

  const startMetronome = async () => {
    const AudioContextConstructor = getAudioContextConstructor();
    if (!AudioContextConstructor) {
      setMetronomeError('This browser does not support Web Audio. Try a current browser with audio support.');
      return;
    }
    try {
      let context = audioRef.current;
      if (!context || context.state === 'closed') {
        context = new AudioContextConstructor();
      }
      audioRef.current = context;
      await context.resume();
      if (context.state !== 'running') {
        throw new Error('Audio is not running.');
      }
      setMetronomeError('');
      setPlaying(true);
    } catch {
      setMetronomeError('Your browser could not start audio. Check sound settings, then try again.');
    }
  };

  const toggleMetronome = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    void startMetronome();
  };

  const playReferenceTone = async (frequency: number) => {
    const AudioContextConstructor = getAudioContextConstructor();
    if (!AudioContextConstructor) {
      setMetronomeError('This browser does not support Web Audio playback.');
      return;
    }
    try {
      let context = audioRef.current;
      if (!context || context.state === 'closed') {
        context = new AudioContextConstructor();
      }
      audioRef.current = context;
      await context.resume();
      if (context.state !== 'running') {
        throw new Error('Audio playback did not start.');
      }
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const startAt = context.currentTime;
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.001, startAt);
      gain.gain.exponentialRampToValueAtTime(0.12, startAt + 0.015);
      gain.gain.setValueAtTime(0.12, startAt + 0.95);
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + 1.1);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
      oscillator.start(startAt);
      oscillator.stop(startAt + 1.12);
      setMetronomeError('');
    } catch {
      setMetronomeError('Your browser could not play the reference tone. Check sound settings and try again.');
    }
  };

  const startTuner = async () => {
    if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      setTunerStatus('insecure');
      return;
    }
    const AudioContextConstructor = getAudioContextConstructor();
    if (!navigator.mediaDevices?.getUserMedia || !AudioContextConstructor) {
      setTunerStatus('unsupported');
      return;
    }
    const requestId = ++tunerRequestRef.current;
    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;
    setTunerStatus('requesting');
    try {
      context = new AudioContextConstructor();
      await context.resume();
      if (context.state !== 'running') {
        throw new Error('Microphone analysis audio could not start.');
      }
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      if (requestId !== tunerRequestRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        await context.close();
        return;
      }
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 4096;
      source.connect(analyser);
      tunerRef.current = { stream, context, source, analyser };
      setTunerStatus('listening');
      const buffer = new Float32Array(analyser.fftSize);
      let lastAnalysis = 0;
      const analyse = (timestamp: number) => {
        const active = tunerRef.current;
        if (!active) return;
        if (timestamp - lastAnalysis >= 50) {
          lastAnalysis = timestamp;
          active.analyser.getFloatTimeDomainData(buffer);
          const frequency = detectPitch(buffer, active.context.sampleRate);
          if (frequency) {
            pitchHistoryRef.current = [...pitchHistoryRef.current, frequency].slice(-3);
            const stableFrequencies = [...pitchHistoryRef.current].sort((a, b) => a - b);
            const stableFrequency = stableFrequencies[Math.floor(stableFrequencies.length / 2)];
            const pitch = pitchName(stableFrequency);
            const cents = Math.round(1200 * Math.log2(stableFrequency / pitch.target));
            setDetected({ note: `${pitch.note}${pitch.octave}`, octave: pitch.octave, cents });
          } else {
            pitchHistoryRef.current = [];
            setDetected(null);
          }
        }
        rafRef.current = requestAnimationFrame(analyse);
      };
      pitchHistoryRef.current = [];
      analyse(0);
    } catch (error) {
      stream?.getTracks().forEach((track) => track.stop());
      if (context && context.state !== 'closed') {
        void context.close();
      }
      if (requestId !== tunerRequestRef.current) {
        return;
      }
      const name = error && typeof error === 'object' && 'name' in error
        ? String(error.name)
        : '';
      setTunerStatus(name === 'NotAllowedError' || name === 'PermissionDeniedError' ? 'denied' : name === 'NotFoundError' || name === 'DevicesNotFoundError' ? 'no-device' : 'error');
    }
  };

  const stopTuner = () => {
    tunerRequestRef.current += 1;
    releaseTuner();
    pitchHistoryRef.current = [];
    setDetected(null);
    setTunerStatus('idle');
  };

  const tapTempo = () => {
    const now = Date.now();
    const recent = [...tapTimesRef.current.filter((time) => now - time < 5000), now];
    tapTimesRef.current = recent.slice(-5);
    if (recent.length >= 2) {
      const intervals = recent.slice(1).map((time, index) => time - recent[index]).filter((interval) => interval >= 250 && interval <= 2000).sort((a, b) => a - b);
      if (intervals.length) {
        const middle = Math.floor(intervals.length / 2);
        const median = intervals.length % 2 ? intervals[middle] : (intervals[middle - 1] + intervals[middle]) / 2;
        setBpm(Math.max(30, Math.min(240, Math.round(60000 / median))));
      }
    }
  };

  const toggleStopwatch = () => {
    if (stopwatchRunning) {
      stopwatchAccumulatedRef.current += Date.now() - stopwatchStartRef.current;
      setStopwatchElapsed(stopwatchAccumulatedRef.current);
      setStopwatchRunning(false);
    } else {
      stopwatchStartRef.current = Date.now();
      setStopwatchRunning(true);
    }
  };

  const resetStopwatch = () => {
    stopwatchAccumulatedRef.current = 0;
    stopwatchStartRef.current = Date.now();
    setStopwatchElapsed(0);
  };

  const elapsedSeconds = Math.floor(stopwatchElapsed / 1000);
  const audioSupported = Boolean(getAudioContextConstructor());
  const tunerMessage = {
    idle: 'Allow microphone access to listen for a note.',
    requesting: 'Waiting for microphone permission…',
    denied: 'Microphone access was denied. Allow it in your browser settings, then try again.',
    'no-device': 'No microphone was found. Connect a microphone and try again.',
    unsupported: 'This browser does not support microphone audio analysis. Try a current browser with Web Audio support.',
    insecure: 'Microphone access requires a secure connection (HTTPS or localhost).',
    error: 'The microphone could not be started. Check browser permissions and try again.',
    listening: detected ? 'Listening for your open strings.' : 'Listening. Play a steady, sustained note near your microphone.',
  } satisfies Record<TunerStatus, string>;

  return (
    <div className="page-enter toolkit-page">
      <PageHeading eyebrow="TOOLS FOR THE STAND" title="Your practice toolkit." subtitle="A few useful instruments, close at hand. No setup between the room and the music." />
      <div className="toolkit-layout">
        <div className="toolkit-main">
          <Card className="tool-card metronome-card">
            <div className="tool-card-heading">
              <div className="tool-icon metronome-icon"><Activity size={19} /></div>
              <div><div className="eyebrow">KEEP THE PULSE</div><h2>Metronome</h2></div>
              <span className={`tool-state ${playing ? 'state-live' : ''}`} aria-live="polite">{playing ? 'Running' : 'At rest'}</span>
            </div>
            <div className="metronome-display">
              <div className="tempo-readout">
                <span className="tempo-caption">PULSE PER MINUTE</span>
                <div className="tempo-number"><button type="button" aria-label="Decrease tempo by one beat per minute" onClick={() => setBpm((value) => Math.max(30, value - 1))} data-testid="button-tempo-decrease"><Minus size={18} /></button><strong aria-live="polite" data-testid="text-tempo">{bpm}</strong><button type="button" aria-label="Increase tempo by one beat per minute" onClick={() => setBpm((value) => Math.min(240, value + 1))} data-testid="button-tempo-increase"><Plus size={18} /></button></div>
                <label className="tempo-slider-label" htmlFor="tempo-slider">Tempo: {bpm} BPM, {signature.unit === 8 ? 'eighth-note' : 'quarter-note'} pulse</label>
                <input id="tempo-slider" className="tempo-slider" type="range" min="30" max="240" value={bpm} onChange={(event) => setBpm(Number(event.target.value))} aria-label="Tempo in beats per minute" data-testid="input-tempo-slider" />
              </div>
              <div className="beat-orbit" role="img" aria-label={`Beat ${beat >= 0 ? beat + 1 : 0} of ${signature.beats}${playing ? ', metronome playing' : ', metronome stopped'}`}>
                <div className="beat-lights">{Array.from({ length: signature.beats }, (_, index) => <span key={index} className={`${beat === index ? 'beat-active' : ''} ${index === 0 ? 'beat-first' : ''}`} />)}</div>
                <span className="measure-readout">{signature.label}</span>
              </div>
            </div>
            <div className="metronome-settings">
              <fieldset className="tool-setting"><legend>Time signature</legend><div className="choice-row">{signatures.map((item) => <button type="button" className={`choice-button ${signature.label === item.label ? 'selected' : ''}`} key={item.label} onClick={() => { setSignature(item); setBeat(-1); }} aria-pressed={signature.label === item.label} data-testid={`button-meter-${item.label.replaceAll(' ', '')}`}>{item.label}</button>)}</div></fieldset>
              <fieldset className="tool-setting"><legend>Subdivisions</legend><div className="choice-row">{subdivisionChoices.map((count) => <button type="button" className={`choice-button ${subdivision === count ? 'selected' : ''}`} key={count} onClick={() => setSubdivision(count)} aria-pressed={subdivision === count} aria-label={`${count} equal subdivision${count === 1 ? '' : 's'} per beat`} data-testid={`button-subdivision-${count}`}>{['Beat', '2 notes', 'Triplets', '4 notes'][count - 1]}</button>)}</div></fieldset>
              <label className="toggle-setting"><input type="checkbox" checked={accent} onChange={(event) => setAccent(event.target.checked)} data-testid="toggle-accent" /><span className="toggle-visual" /><span><strong>Accent beat one</strong><small>Make the downbeat distinct</small></span></label>
            </div>
            <div className="metronome-actions"><button className="button button-primary metronome-start" type="button" onClick={toggleMetronome} disabled={!audioSupported && !playing} aria-label={playing ? 'Stop metronome' : 'Start metronome'} data-testid="button-metronome-toggle">{playing ? <CircleStop size={18} /> : <Play size={18} />}{playing ? 'Stop metronome' : 'Start metronome'}</button><button className="button button-secondary tap-button" type="button" onClick={tapTempo} data-testid="button-tap-tempo"><Timer size={16} />Tap tempo</button><span className="keyboard-hint">Tap a few times to find the pulse</span></div>
            {(metronomeError || !audioSupported) && <p className="toolkit-audio-message" role="status">{metronomeError || 'Web Audio is unavailable in this browser, so sound playback is disabled.'}</p>}
          </Card>

          <Card className="tool-card tuner-card">
            <div className="tool-card-heading">
              <div className="tool-icon tuner-icon"><AudioLines size={19} /></div>
              <div><div className="eyebrow">LISTEN CLOSELY</div><h2>Violin tuner</h2></div>
              <span className={`tool-state ${tunerStatus === 'listening' ? 'state-live' : ''}`} aria-live="polite">{tunerStatus === 'listening' ? 'Microphone on' : 'Microphone off'}</span>
            </div>
            <div className="tuner-body">
              <div className={`tuner-face ${detected ? (Math.abs(detected.cents) <= 5 ? 'tuner-in-tune' : 'tuner-hearing') : ''}`} role="group" aria-label="Live tuner reading">
                <div className="tuner-needle" style={{ transform: `translateX(${detected ? Math.max(-45, Math.min(45, detected.cents * 1.1)) : 0}px)` }} />
                <div className="tuner-scale"><span>−50</span><span>0</span><span>+50</span></div>
                {detected ? <><strong className="detected-note" aria-live="polite">{detected.note}</strong><span className="tuner-cents">{Math.abs(detected.cents) <= 5 ? 'In tune' : `${Math.abs(detected.cents)} cents ${detected.cents < 0 ? 'flat' : 'sharp'}`}</span></> : <><strong className="detected-note tuner-placeholder" aria-live="polite">—</strong><span className="tuner-cents">Waiting for a note</span></>}
              </div>
              <div className="tuner-explainer"><p>{tunerMessage[tunerStatus]}</p><div className="tuner-caution"><ShieldCheck size={15} /><span>Adjust pegs carefully. Avoid sudden changes in string tension.</span></div></div>
            </div>
            <div className="tuner-controls">
              {tunerStatus === 'listening' ? <button type="button" className="button button-secondary" onClick={stopTuner} data-testid="button-tuner-stop"><Pause size={16} />Stop listening</button> : <button type="button" className="button button-primary" onClick={startTuner} disabled={tunerStatus === 'requesting'} data-testid="button-tuner-start"><Headphones size={17} />{tunerStatus === 'requesting' ? 'Requesting access…' : 'Enable microphone'}</button>}
              <span className="permission-note">Your microphone is used only while listening.</span>
            </div>
              <div className="reference-row"><div><span className="eyebrow">REFERENCE TONES</span><small>Play a clean open-string pitch</small></div>{referenceNotes.map(({ name, frequency }) => <button type="button" className="reference-tone" key={name} onClick={() => void playReferenceTone(frequency)} disabled={!audioSupported} aria-label={`Play ${name} reference tone`} data-testid={`button-reference-${name.toLowerCase()}`}><Volume2 size={14} /><strong>{name}</strong></button>)}</div>
          </Card>
        </div>

        <aside className="toolkit-aside">
          <Card className="tool-card stopwatch-card">
            <div className="tool-card-heading compact-tool-heading"><div className="tool-icon stopwatch-icon"><Clock3 size={18} /></div><div><div className="eyebrow">A LITTLE TIME</div><h2>Stopwatch</h2></div></div>
            <div className="stopwatch-time" role="timer" aria-live="off" data-testid="text-stopwatch">{`${String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:${String(elapsedSeconds % 60).padStart(2, '0')}`}<small>.{String(Math.floor((stopwatchElapsed % 1000) / 100)).padStart(1, '0')}</small></div>
            <div className="stopwatch-actions"><button type="button" className="button button-primary" onClick={toggleStopwatch} data-testid="button-stopwatch-toggle">{stopwatchRunning ? <Pause size={16} /> : <Play size={16} />}{stopwatchRunning ? 'Pause' : 'Start'}</button><button type="button" className="icon-button" onClick={resetStopwatch} aria-label="Reset stopwatch" data-testid="button-stopwatch-reset"><RotateCcw size={17} /></button></div>
            <p className="stopwatch-caption">Time a passage, a rest, or a focused minute.</p>
            <Link href="/practice" className="subtle-action toolkit-practice-link">Open practice timer and session notes <span aria-hidden="true">→</span></Link>
          </Card>
          <Card className="tool-card repertoire-shortcut">
            <div className="section-title"><div><div className="eyebrow">ON YOUR STAND</div><h2>Current repertoire</h2></div><Music2 size={18} className="repertoire-mark" /></div>
            {repertoireQuery.isLoading ? <div className="toolkit-skeleton" aria-label="Loading repertoire"><span /><span /><span /></div> : repertoireQuery.error ? <div className="repertoire-message" role="status">Your saved repertoire could not be reached right now.<Link href="/repertoire" className="text-link">Open repertoire</Link></div> : (repertoireQuery.data || []).filter((piece) => !piece.archived).length ? <div className="tool-repertoire-list">{(repertoireQuery.data || []).filter((piece) => !piece.archived).slice(0, 4).map((piece) => <Link href="/repertoire" className="tool-piece-row" key={piece.id} data-testid={`link-tool-piece-${piece.id}`}><span className="tool-piece-mark">{piece.title.slice(0, 1).toLocaleUpperCase()}</span><span className="tool-piece-copy"><strong>{piece.title}</strong><small>{piece.composer}</small></span><span className="tool-piece-status">{piece.status.replaceAll('-', ' ')}</span></Link>)}</div> : <div className="repertoire-message">Your stand is clear. Add a piece when you are ready.<Link href="/repertoire" className="text-link">Browse repertoire</Link></div>}
            <Link href="/repertoire" className="subtle-action toolkit-all-pieces" data-testid="link-toolkit-repertoire">View all repertoire <span aria-hidden="true">→</span></Link>
          </Card>
          <div className="toolkit-note"><span className="toolkit-note-rule" /><p>Listen before you adjust.<br />The instrument will tell you what it needs.</p></div>
        </aside>
      </div>
    </div>
  );
}
