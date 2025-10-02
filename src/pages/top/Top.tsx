import { H1, Lead, Muted } from "@/components/ui/typography";
import { useTop } from "./Top.hook";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Bell,
  BellRing,
  FolderOpen,
  Play,
  Square,
  RefreshCcw,
  X,
} from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
export const Top = () => {
  const {
    notificationPermission,
    canRequest,
    requestNotificationPermission,
    sendTestNotification,
    saveDirectory,
    chooseSaveDirectory,
    recording,
    attachScreenRef,
    attachCameraRef,
    cameraDevices,
    microphoneDevices,
    selectedCameraId,
    setSelectedCameraId,
    selectedMicId,
    setSelectedMicId,
    refreshDevices,
    autoMinutes,
    autoSeconds,
    autoContinue,
    setAutoMinutes,
    setAutoSeconds,
    setAutoContinue,
    remainingMs,
    startAll,
    stopAll,
    pipEnabled,
    setPipEnabled,
    pipActive,
    handlePipPointerDown,
  } = useTop();

  const notifVariant =
    notificationPermission === "granted"
      ? "default"
      : notificationPermission === "denied"
      ? "destructive"
      : "secondary";

  if (pipActive) {
    return (
      <div
        className="relative flex h-screen w-screen cursor-move items-center justify-center bg-black"
        data-tauri-drag-region=""
        onPointerDown={handlePipPointerDown}
      >
        <video
          ref={attachCameraRef}
          className="h-full w-full object-cover"
          playsInline
          muted
          autoPlay
          data-tauri-drag-region=""
        />
        <div
          className="absolute top-3 right-3 flex gap-2"
          data-no-drag=""
          data-tauri-drag-region="false"
        >
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setPipEnabled(false)}
            data-no-drag=""
            data-tauri-drag-region="false"
            aria-label="ピクチャインピクチャを終了"
          >
            <X className="h-2 w-2" aria-hidden="true" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:py-14">
      <section className="mb-10 text-center">
        <H1 className="mt-4">Vlog Recorder</H1>
        <Lead className="mt-2">
          スクリーン・カメラ・マイクを同時に記録。シンプル操作で素早く収録。
        </Lead>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button
            className="min-w-40"
            size="lg"
            onClick={() => void startAll()}
            disabled={recording}
          >
            <Play /> 録画を開始
          </Button>
          <Button
            className="min-w-32"
            size="lg"
            variant="outline"
            onClick={() => void stopAll("manual")}
            disabled={!recording}
          >
            <Square /> 停止
          </Button>
        </div>
        {recording && typeof remainingMs === "number" ? (
          <div className="mt-3 text-sm text-muted-foreground">
            自動停止まで {new Date(remainingMs).toISOString().substring(14, 19)}
          </div>
        ) : null}
      </section>
      <section>
        <Card>
          <CardHeader>
            <CardTitle>収録コントロール</CardTitle>
            <CardDescription>
              保存先の設定と通知の確認をしてから開始してください。
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-24 text-sm text-muted-foreground">
                  通知
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={notifVariant} className="capitalize">
                    {notificationPermission}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!canRequest}
                    onClick={() => void requestNotificationPermission()}
                  >
                    <Bell /> 権限をリクエスト
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={notificationPermission !== "granted"}
                    onClick={() => void sendTestNotification()}
                  >
                    <BellRing /> 通知テスト
                  </Button>
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-24 text-sm text-muted-foreground">
                  保存先
                </div>
                <div className="flex flex-1 items-center justify-end gap-3 overflow-hidden">
                  <Muted className="truncate" title={saveDirectory ?? "未設定"}>
                    {saveDirectory ?? "未設定"}
                  </Muted>
                  <Button size="sm" onClick={() => void chooseSaveDirectory()}>
                    <FolderOpen /> 選択
                  </Button>
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-24 text-sm text-muted-foreground">
                  カメラ
                </div>
                <div className="flex flex-1 items-center justify-end gap-3 overflow-hidden">
                  <Select
                    disabled={recording}
                    value={selectedCameraId}
                    onValueChange={(v) => setSelectedCameraId(v as any)}
                  >
                    <SelectTrigger aria-label="カメラを選択">
                      <SelectValue placeholder="システムデフォルト" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">
                        システムデフォルト
                      </SelectItem>
                      {cameraDevices
                        .filter((d) => d.deviceId && d.deviceId.length > 0)
                        .map((d) => (
                          <SelectItem key={d.deviceId} value={d.deviceId}>
                            {d.label ||
                              `カメラ (${d.deviceId.substring(0, 6)}…)`}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void refreshDevices(true)}
                  >
                    <RefreshCcw /> 更新
                  </Button>
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-24 text-sm text-muted-foreground">
                  マイク
                </div>
                <div className="flex flex-1 items-center justify-end gap-3 overflow-hidden">
                  <Select
                    disabled={recording}
                    value={selectedMicId}
                    onValueChange={(v) => setSelectedMicId(v as any)}
                  >
                    <SelectTrigger aria-label="マイクを選択">
                      <SelectValue placeholder="システムデフォルト" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">
                        システムデフォルト
                      </SelectItem>
                      {microphoneDevices
                        .filter((d) => d.deviceId && d.deviceId.length > 0)
                        .map((d) => (
                          <SelectItem key={d.deviceId} value={d.deviceId}>
                            {d.label ||
                              `マイク (${d.deviceId.substring(0, 6)}…)`}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void refreshDevices(true)}
                  >
                    <RefreshCcw /> 更新
                  </Button>
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-24 text-sm text-muted-foreground">
                  自動停止
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    className="h-9 w-20 rounded-md border px-2 text-right"
                    value={autoMinutes}
                    disabled={recording}
                    onChange={(e) =>
                      setAutoMinutes(Math.max(0, Number(e.target.value || 0)))
                    }
                  />
                  <span className="text-sm text-muted-foreground">分</span>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    className="h-9 w-20 rounded-md border px-2 text-right"
                    value={autoSeconds}
                    disabled={recording}
                    onChange={(e) =>
                      setAutoSeconds(
                        Math.min(59, Math.max(0, Number(e.target.value || 0)))
                      )
                    }
                  />
                  <span className="text-sm text-muted-foreground">秒</span>
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-24 text-sm text-muted-foreground">
                  連続保存
                </div>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={autoContinue}
                    onChange={(e) => setAutoContinue(e.target.checked)}
                  />
                  自動停止後も録画を継続
                </label>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-24 text-sm text-muted-foreground">
                  前面表示
                </div>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={pipEnabled}
                    onChange={(e) => setPipEnabled(e.target.checked)}
                  />
                  録画中にカメラを常時前面に表示
                </label>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
      <section className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>ライブプレビュー</CardTitle>
            <CardDescription>
              共有中の画面とカメラを表示します。
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black">
              <video
                ref={attachScreenRef}
                className="h-full w-full object-contain"
                playsInline
                muted
                autoPlay
              />
            </div>
            <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black">
              <video
                ref={attachCameraRef}
                className="h-full w-full object-contain"
                playsInline
                muted
                autoPlay
              />
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};
