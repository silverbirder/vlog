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
import { Bell, BellRing, FolderOpen, Play, Square } from "lucide-react";

export const Top = () => {
  const {
    notificationPermission,
    canRequest,
    requestNotificationPermission,
    sendTestNotification,
    saveDirectory,
    chooseSaveDirectory,
    recording,
    monitorAudio,
    setMonitorAudio,
    attachScreenRef,
    attachCameraRef,
    attachAudioRef,
    startAll,
    stopAll,
  } = useTop();

  const notifVariant =
    notificationPermission === "granted"
      ? "default"
      : notificationPermission === "denied"
      ? "destructive"
      : "secondary";

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
            onClick={() => void stopAll()}
            disabled={!recording}
          >
            <Square /> 停止
          </Button>
        </div>
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
            </div>
          </CardContent>
        </Card>
      </section>
      <section className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>ライブプレビュー</CardTitle>
            <CardDescription>
              共有中の画面とカメラを表示します。音声モニターはデフォルトでミュートです。
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black">
              <video
                ref={attachScreenRef}
                className="absolute inset-0 h-full w-full object-contain"
                playsInline
                muted
                autoPlay
              />
              <video
                ref={attachCameraRef}
                className="absolute bottom-3 right-3 w-1/4 aspect-video rounded-md ring-2 ring-white/60 bg-black"
                playsInline
                muted
                autoPlay
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={monitorAudio}
                  onChange={(e) => setMonitorAudio(e.target.checked)}
                  className="h-4 w-4"
                />
                音声モニター（ハウリングに注意）
              </label>
              <audio ref={attachAudioRef} hidden />
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};
