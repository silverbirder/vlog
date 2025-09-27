import { useTop } from "./Top.hook";
import { Button } from "@/components/ui/button";

export const Top = () => {
  const { notificationPermission, canRequest, requestNotificationPermission, sendTestNotification } = useTop();
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground">
        通知権限: {notificationPermission}
      </span>
      <Button disabled={!canRequest} onClick={() => void requestNotificationPermission()}>
        権限をリクエスト
      </Button>
      <Button disabled={notificationPermission !== "granted"} onClick={() => void sendTestNotification()}>
        通知テスト
      </Button>
    </div>
  );
};
