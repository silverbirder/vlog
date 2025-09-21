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
  enabled: boolean;
  onToggle: (value: boolean) => void;
  toggleDisabled?: boolean;
  onDownload?: () => void;
  onReset?: () => void;
};

export const RecorderCard = ({
  title,
  description,
  controller,
  mediaKind,
  previewMirror,
  enabled,
  onToggle,
  toggleDisabled,
  onDownload,
  onReset,
}: Props) => {
  const { status, error, mediaUrl, stream, isRecording } = controller;
  const { statusLabel, handleDownload, handleReset, canReset } =
    useRecorderCard({ controller, onDownload, onReset });

  return (
    <section className="card">
      <header>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <label className={`feature-toggle${enabled ? " active" : ""}`}>
          <input
            checked={enabled}
            disabled={toggleDisabled}
            onChange={(event) => {
              const checked =
                (event.target instanceof HTMLInputElement &&
                  event.target.checked) ||
                false;
              onToggle(checked);
            }}
            type="checkbox"
          />
          <span>{enabled ? "使用中" : "無効"}</span>
        </label>
      </header>

      <div className="status-row">
        <span className={`indicator ${status}`}></span>
        <span>{statusLabel}</span>
        {isRecording && (
          <span className="muted">録画中は設定を変更できません</span>
        )}
      </div>

      {!enabled && (
        <p className="muted">この録画タイプは現在オフになっています。</p>
      )}

      {enabled && stream && mediaKind === "video" && (
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
        <button disabled={!canReset} onClick={handleReset} type="button">
          個別リセット
        </button>
      </div>

      {error && <p className="error">{error}</p>}
    </section>
  );
};
