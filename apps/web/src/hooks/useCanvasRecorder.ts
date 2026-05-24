"use client";
import { useCallback, useRef, useState } from "react";

export type RecordingState = "idle" | "recording" | "saving";

export interface UseCanvasRecorderReturn {
  recordingState: RecordingState;
  elapsed: number; // seconds
  startRecording: (canvas: HTMLCanvasElement, fps?: number) => void;
  stopRecording: () => void;
}

export function useCanvasRecorder(): UseCanvasRecorderReturn {
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [elapsed, setElapsed] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startRecording = useCallback((canvas: HTMLCanvasElement, fps = 30) => {
    if (mediaRecorderRef.current) return;

    // Pick best supported codec
    const mimeType = [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
    ].find((m) => MediaRecorder.isTypeSupported(m)) ?? "video/webm";

    const stream = canvas.captureStream(fps);
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });

    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      setRecordingState("saving");
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const now = new Date();
      const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
      a.href = url;
      a.download = `bloks-world-${stamp}.webm`;
      a.click();
      URL.revokeObjectURL(url);
      chunksRef.current = [];
      mediaRecorderRef.current = null;
      setElapsed(0);
      setRecordingState("idle");
    };

    recorder.start(200); // collect chunks every 200ms
    mediaRecorderRef.current = recorder;
    startTimeRef.current = Date.now();
    setRecordingState("recording");
    setElapsed(0);

    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
  }, []);

  const stopRecording = useCallback(() => {
    stopTimer();
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  return { recordingState, elapsed, startRecording, stopRecording };
}
