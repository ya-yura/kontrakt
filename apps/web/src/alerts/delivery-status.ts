export type AlertDeliveryDisplayMode = "live" | "mock" | "stub";

export type AlertDeliveryDisplayStatus =
  | "failed"
  | "mocked"
  | "pending"
  | "sent"
  | "stubbed";

export type AlertDeliveryDisplay = {
  mode: AlertDeliveryDisplayMode;
  status: AlertDeliveryDisplayStatus;
};

type AlertDeliveryStatusInput = {
  sentAt: Date | string | null;
  errorMessage: string | null;
};

export function deriveAlertDeliveryDisplay(
  alert: AlertDeliveryStatusInput
): AlertDeliveryDisplay {
  if (alert.sentAt) {
    return {
      mode: "live",
      status: "sent"
    };
  }

  if (alert.errorMessage) {
    if (alert.errorMessage.includes("live delivery skipped")) {
      return {
        mode: "stub",
        status: "stubbed"
      };
    }

    return {
      mode: "live",
      status: "failed"
    };
  }

  return {
    mode: "mock",
    status: "mocked"
  };
}
