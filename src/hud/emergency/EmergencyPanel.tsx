import { useEffect, useRef, useState } from "react";
import { triageTree } from "../../core/content";
import type { TriageState } from "../../core/rules/triage";
import {
  answerTriage,
  backTriage,
  getNode,
  startTriage,
} from "../../core/rules/triage";
import { usePda } from "../../core/store";
import { Button } from "../../ui/Button";
import { StatusBadge } from "../../ui/Panel";
import { formatClock } from "../hudStore";

function useElapsed() {
  const start = useRef(Date.now());
  const [ms, setMs] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setMs(Date.now() - start.current), 250);
    return () => clearInterval(id);
  }, []);
  return ms;
}

function formatTimer(ms: number) {
  const total = Math.floor(ms / 1000);
  const m = String(Math.floor(total / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function useMetronome(bpm: number | undefined, muted: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const [beat, setBeat] = useState(false);

  useEffect(() => {
    if (!bpm) return;
    const tick = () => {
      setBeat((b) => !b);
      if (muted) return;
      try {
        const AC =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!AC) return;
        ctxRef.current ??= new AC();
        const ctx = ctxRef.current;
        if (ctx.state === "suspended") void ctx.resume();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.09);
      } catch {
        // audio unavailable. the visual metronome still works
      }
    };
    tick();
    const id = setInterval(tick, 60_000 / bpm);
    return () => clearInterval(id);
  }, [bpm, muted]);

  useEffect(
    () => () => {
      void ctxRef.current?.close();
      ctxRef.current = null;
    },
    [],
  );

  return beat;
}

function useVoice(text: string | undefined, enabled: boolean) {
  useEffect(() => {
    if (!enabled || !text || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-US";
      u.rate = 0.95;
      window.speechSynthesis.speak(u);
    } catch {}
    return () => {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    };
  }, [text, enabled]);
}

export function EmergencyPanel() {
  const [state, setState] = useState<TriageState>(() =>
    startTriage(triageTree),
  );
  const [voiceOn, setVoiceOn] = useState(true);
  const [muted, setMuted] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const elapsed = useElapsed();
  const log = usePda((s) => s.emergencyLog);
  const alarm = usePda((s) =>
    s.alerts.find((a) => a.suggestsEmergency && !a.acknowledged),
  );

  const node = getNode(triageTree, state.nodeId);
  const action = state.finished ? node.action : undefined;

  const beat = useMetronome(action?.metronomeBpm, muted);
  const spoken = action
    ? (node.voice ?? `${action.title}. ${action.steps.join(" ")}`)
    : (node.voice ?? node.question);
  useVoice(spoken, voiceOn);

  // camera flies to the zone of the protocol
  useEffect(() => {
    if (action?.cameraTarget) {
      usePda.getState().setCameraTarget(action.cameraTarget);
    }
  }, [action]);

  // move focus to the new heading so keyboard and screen reader users follow along
  useEffect(() => {
    headingRef.current?.focus();
  }, [state.nodeId, state.finished]);

  const logEvent = (text: string) => usePda.getState().logEmergency(text);

  const answer = (index: number) => {
    const option = node.options?.[index];
    if (!option) return;
    const next = answerTriage(triageTree, state, index);
    logEvent(`${node.question} → ${option.label}`);
    const nextNode = getNode(triageTree, next.nodeId);
    if (next.finished && nextNode.action) {
      logEvent(`Protocol: ${nextNode.action.title}`);
    }
    setState(next);
  };

  const back = () => {
    if (state.path.length === 0) return;
    logEvent("Went back one step.");
    setState(backTriage(state));
  };

  const restart = () => {
    logEvent("Triage restarted.");
    setState(startTriage(triageTree));
  };

  return (
    <div
      className="emergency-overlay"
      role="alertdialog"
      aria-label="Emergency mode"
    >
      <div className="em-top">
        <h1 className="em-title">⚠ EMERGENCY MODE</h1>
        <div className="em-timer mono" role="timer" aria-label="Elapsed time">
          {formatTimer(elapsed)}
        </div>
        <div className="em-tools">
          <Button
            size="sm"
            variant="ghost"
            aria-pressed={voiceOn}
            onClick={() => setVoiceOn((v) => !v)}
          >
            Voice: {voiceOn ? "on" : "off"}
          </Button>
          {action?.metronomeBpm && (
            <Button
              size="sm"
              variant="ghost"
              aria-pressed={!muted}
              onClick={() => setMuted((m) => !m)}
            >
              Beat sound: {muted ? "off" : "on"}
            </Button>
          )}
        </div>
      </div>

      {alarm && (
        <p className="em-banner" role="alert">
          <StatusBadge status={alarm.severity} /> {alarm.message}
        </p>
      )}

      <div className="em-main" aria-live="polite">
        {!action ? (
          <>
            <h2 className="em-question" tabIndex={-1} ref={headingRef}>
              {node.question}
            </h2>
            <div className="em-options">
              {node.options?.map((o, i) => (
                <Button
                  key={o.label}
                  size="lg"
                  variant={i === 0 ? "primary" : "ghost"}
                  block
                  onClick={() => answer(i)}
                >
                  {o.label}
                </Button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="em-protocol-head">
              <StatusBadge status={action.severity} />
              <h2 className="em-question" tabIndex={-1} ref={headingRef}>
                {action.title}
              </h2>
            </div>

            {action.metronomeBpm && (
              <div className="metronome" aria-label="CPR metronome">
                <span
                  className={`metronome-dot ${beat ? "on" : ""}`}
                  aria-hidden="true"
                />
                <span className="mono">
                  {action.metronomeBpm} beats per minute
                </span>
              </div>
            )}

            <ol className="em-steps">
              {action.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>

            {node.unverified && (
              <p className="note">
                This text is not yet verified against its source. Follow your
                crew training and the flight surgeon first.
              </p>
            )}
          </>
        )}
      </div>

      <div className="em-nav">
        <Button
          size="lg"
          variant="ghost"
          onClick={back}
          disabled={state.path.length === 0}
        >
          ← Back
        </Button>
        {state.finished && (
          <Button size="lg" variant="ghost" onClick={restart}>
            Restart
          </Button>
        )}
        <Button
          size="lg"
          variant={state.finished ? "primary" : "ghost"}
          onClick={() => usePda.getState().endEmergency()}
        >
          {state.finished ? "End emergency" : "Cancel (false alarm)"}
        </Button>
      </div>

      <section className="em-log" aria-label="Action log">
        <h3 className="section-title">Action log</h3>
        <ul className="mono">
          {log.slice(-5).map((l, i) => (
            <li key={`${l.at}-${i}`}>
              {formatClock(l.at)} {l.text}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
