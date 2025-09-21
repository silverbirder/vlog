import { VideoStream } from "@/components";
import type { MediaRecorderController } from "@/types";
import "./recorder-card.css";
import { useRecorderCard } from "./recorder-card.hook";

const FALLBACK_CAPTIONS_SRC = "data:text/vtt,WEBVTT";

type Props = {
  title: string;
  description: string;
  controller: MediaRecorderController;
  mediaKind: "video" | "audio";
  previewMirror?: boolean;
  onDownload?: () => Promise<void> | void;
};

export const RecorderCard = ({
  title,
  description,
  controller,
  mediaKind,
  previewMirror,
  onDownload,
}: Props) => {
  const { status, error, mediaUrl, stream, isRecording } = controller;
  const { statusLabel, handleDownload } = useRecorderCard({
    controller,
    onDownload,
  });

  return (
    <section className="card">
      <header>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </header>

      <div className="status-row">
        <span className={`indicator ${status}`}></span>
        <span>{statusLabel}</span>
        {isRecording && (
          <span className="muted">録画中は設定を変更できません</span>
        )}
      </div>

      {stream && mediaKind === "video" && (
        <VideoStream mirrored={previewMirror} stream={stream} />
      )}

      {mediaUrl &&
        (mediaKind === "audio" ? (
          <audio className="playback" controls src={mediaUrl}>
            <track
              kind="captions"
              label="空のキャプション"
              src={FALLBACK_CAPTIONS_SRC}
            />
          </audio>
        ) : (
          <video className="playback" controls src={mediaUrl}>
            <track
              kind="captions"
              label="空のキャプション"
              src={FALLBACK_CAPTIONS_SRC}
            />
          </video>
        ))}

      <div className="card-actions">
        <button disabled={!mediaUrl} onClick={handleDownload} type="button">
          保存
        </button>
      </div>

      {error && <p className="error">{error}</p>}
    </section>
  );
};
