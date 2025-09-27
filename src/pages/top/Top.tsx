import { useTop } from "./Top.hook";
import { Button } from "@/components/ui/button";

export const Top = () => {
  const {
    notificationPermission,
    canRequest,
    requestNotificationPermission,
    sendTestNotification,
    microphoneStatus,
    cameraStatus,
    screenStatus,
    requestMicrophone,
    requestCamera,
    requestScreen,
    validateMicrophone,
    validateCamera,
    validateScreen,
    saveDirectory,
    chooseSaveDirectory,
    recording,
    startAll,
    stopAll,
  } = useTop();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">
          通知権限: {notificationPermission}
        </span>
        <Button
          disabled={!canRequest}
          onClick={() => void requestNotificationPermission()}
        >
          権限をリクエスト
        </Button>
        <Button
          disabled={notificationPermission !== "granted"}
          onClick={() => void sendTestNotification()}
        >
          通知テスト
        </Button>
      </div>
      <div className="flex items-center gap-3">
        <span className="w-24 text-sm text-muted-foreground">マイク</span>
        <span className="text-sm">{microphoneStatus}</span>
        <Button
          disabled={microphoneStatus === "granted"}
          onClick={() => void requestMicrophone()}
        >
          権限をリクエスト
        </Button>
        <Button
          disabled={microphoneStatus !== "granted"}
          onClick={() => void validateMicrophone()}
        >
          マイクテスト
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <span className="w-24 text-sm text-muted-foreground">カメラ</span>
        <span className="text-sm">{cameraStatus}</span>
        <Button
          disabled={cameraStatus === "granted"}
          onClick={() => void requestCamera()}
        >
          権限をリクエスト
        </Button>
        <Button
          disabled={cameraStatus !== "granted"}
          onClick={() => void validateCamera()}
        >
          カメラテスト
        </Button>
      </div>
      <div className="flex items-center gap-3">
        <span className="w-24 text-sm text-muted-foreground">スクリーン</span>
        <span className="text-sm">{screenStatus}</span>
        <Button
          disabled={screenStatus === "granted"}
          onClick={() => void requestScreen()}
        >
          権限をリクエスト
        </Button>
        <Button
          disabled={screenStatus !== "granted"}
          onClick={() => void validateScreen()}
        >
          スクリーンテスト
        </Button>
      </div>
      <div className="flex items-center gap-3">
        <span>保存先</span>
        <span title={saveDirectory ?? "未設定"}>
          {saveDirectory ?? "未設定"}
        </span>
        <Button onClick={() => void chooseSaveDirectory()}>保存先を選択</Button>
      </div>
      <div className="flex items-center gap-3">
        <Button disabled={recording} onClick={() => void startAll()}>
          開始
        </Button>
        <Button disabled={!recording} onClick={() => void stopAll()}>
          停止
        </Button>
      </div>
    </div>
  );
};
