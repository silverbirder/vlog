import type { UseAppReturn } from "@/pages";
import { formatDuration } from "@/utils";
import "./control-panel.css";
import { useControlPanel } from "./control-panel.hook";

type Props = Pick<
  UseAppReturn,
  | "screenRecorder"
  | "cameraRecorder"
  | "audioRecorder"
  | "enabledSources"
  | "setEnabledSources"
  | "isStartingAll"
  | "autoStopMinutesInput"
  | "setAutoStopMinutesInput"
  | "autoStopSecondsInput"
  | "setAutoStopSecondsInput"
  | "autoStopMinutesId"
  | "autoStopSecondsId"
  | "autoStopDeadline"
  | "autoStopMessage"
  | "scheduledAutoStopSeconds"
  | "isAnyRecording"
  | "isAnyEnabled"
  | "hasDownloads"
  | "startAll"
  | "stopAll"
  | "downloadAll"
>;

export const ControlPanel = (props: Props) => {
  const {
    screenRecorder,
    cameraRecorder,
    audioRecorder,
    enabledSources,
    isStartingAll,
    autoStopMinutesInput,
    autoStopSecondsInput,
    autoStopMinutesId,
    autoStopSecondsId,
    autoStopDeadline,
    autoStopMessage,
    scheduledAutoStopSeconds,
    startAll,
    downloadAll,
  } = props;

  const {
    handleToggleSource,
    handleAutoStopMinutesChange,
    handleAutoStopSecondsChange,
    handleStopAll,
    startDisabled,
    stopDisabled,
    downloadDisabled,
  } = useControlPanel(props);

  return (
    <section className="control-panel">
      <div className="toggles">
        <label>
          <input
            checked={enabledSources.screen}
            disabled={screenRecorder.isRecording}
            onChange={handleToggleSource("screen")}
            type="checkbox"
          />
          スクリーン
        </label>
        <label>
          <input
            checked={enabledSources.camera}
            disabled={cameraRecorder.isRecording}
            onChange={handleToggleSource("camera")}
            type="checkbox"
          />
          カメラ
        </label>
        <label>
          <input
            checked={enabledSources.audio}
            disabled={audioRecorder.isRecording}
            onChange={handleToggleSource("audio")}
            type="checkbox"
          />
          マイク音声
        </label>
      </div>

      <div className="auto-stop-controls">
        <label htmlFor={autoStopMinutesId}>
          <span>自動停止タイマー（分）</span>
          <input
            disabled={isStartingAll}
            id={autoStopMinutesId}
            min={0}
            onChange={handleAutoStopMinutesChange}
            step={1}
            type="number"
            value={autoStopMinutesInput}
          />
        </label>
        <label htmlFor={autoStopSecondsId}>
          <span>秒</span>
          <input
            disabled={isStartingAll}
            id={autoStopSecondsId}
            max={59}
            min={0}
            onChange={handleAutoStopSecondsChange}
            step={1}
            type="number"
            value={autoStopSecondsInput}
          />
        </label>
        <span className="muted auto-stop-note">
          分・秒を両方 0 にすると無効。変更は次回の開始時に適用されます。
        </span>
      </div>

      {autoStopDeadline && scheduledAutoStopSeconds && (
        <p className="muted auto-stop-deadline">
          自動停止予定: {autoStopDeadline.toLocaleTimeString()}（
          {formatDuration(scheduledAutoStopSeconds)}後）
        </p>
      )}

      {autoStopMessage && (
        <p className="auto-stop-message">{autoStopMessage}</p>
      )}

      <div className="global-controls">
        <button
          className="primary"
          disabled={startDisabled}
          onClick={startAll}
          type="button"
        >
          開始
        </button>
        <button
          className="warning"
          disabled={stopDisabled}
          onClick={handleStopAll}
          type="button"
        >
          停止
        </button>
        <button
          disabled={downloadDisabled}
          onClick={() => void downloadAll()}
          type="button"
        >
          全て保存
        </button>
      </div>
      <p className="muted">
        録画開始時に選択されている対象のみが同時にスタートします。停止すると各カードから保存が可能です。
      </p>
    </section>
  );
};
