import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";

function pickSupportedMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = [
    "video/mp4;codecs=h264,aac",
    "video/mp4;codecs=h264",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (const m of candidates) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((MediaRecorder as any).isTypeSupported(m)) return m;
    } catch {
      // ignore
    }
  }
  return null;
}

export const Test = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [recording, setRecording] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  // queue to buffer chunks so ondataavailable returns fast
  const chunkQueue = useRef<Uint8Array[]>([]);
  const processingRef = useRef<boolean>(false);

  const processQueue = async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    try {
      while (chunkQueue.current.length > 0) {
        const chunk = chunkQueue.current.shift();
        if (!chunk) continue;
        try {
          // send chunk (await to preserve order)
          // convert to regular array for invoke serialization
          await invoke("append_chunk", { data: Array.from(chunk) });
        } catch (e) {
          console.error("invoke append_chunk failed", e);
        }
      }
    } finally {
      processingRef.current = false;
    }
  };

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => {
          t.stop();
        });
      }
    };
  }, [stream]);

  const startCapture = async () => {
    try {
      const s = await (navigator.mediaDevices as MediaDevices).getDisplayMedia({
        audio: true,
        video: true,
      });
      setStream(s as MediaStream);
      if (videoRef.current) videoRef.current.srcObject = s;

      const selected = pickSupportedMime();
      try {
        await invoke("init_recording", { mime: selected });
      } catch (e) {
        console.error("init_recording failed", e);
      }
      const options: MediaRecorderOptions = selected
        ? { mimeType: selected }
        : {};
      const mr = new MediaRecorder(
        s as MediaStream,
        options as MediaRecorderOptions,
      );

      mr.ondataavailable = async (ev: BlobEvent) => {
        if (ev.data && ev.data.size > 0) {
          // Read blob as ArrayBuffer and enqueue for background send
          const ab = await ev.data.arrayBuffer();
          const u8 = new Uint8Array(ab);
          chunkQueue.current.push(u8);
          // start background processing if not already
          void processQueue();
        }
      };

      mr.onstop = async () => {
        try {
          // wait until queued chunks are flushed
          while (processingRef.current || chunkQueue.current.length > 0) {
            // eslint-disable-next-line no-await-in-loop
            await new Promise((r) => setTimeout(r, 100));
          }
          await invoke("finalize_recording");
          alert("Recording saved successfully!");
        } catch (e) {
          console.error("finalize_recording failed", e);
        }
      };

      mediaRecorderRef.current = mr;
      mr.start(1000); // deliver data every second
      setRecording(true);
    } catch (e) {
      console.error("startCapture failed", e);
    }
  };

  const stopCapture = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    if (stream) {
      stream.getTracks().forEach((t) => {
        t.stop();
      });
      setStream(null);
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <h2>Screen Recording (MVP)</h2>
      <div style={{ display: "flex", gap: 12 }}>
        <button disabled={recording} onClick={startCapture} type="button">
          Start
        </button>
        <button disabled={!recording} onClick={stopCapture} type="button">
          Stop
        </button>
      </div>
      <div style={{ marginTop: 12 }}>
        <video
          autoPlay
          muted
          playsInline
          ref={videoRef}
          style={{ maxHeight: 480, width: "100%" }}
        />
      </div>
    </div>
  );
};
