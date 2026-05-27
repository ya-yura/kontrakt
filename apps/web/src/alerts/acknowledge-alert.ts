import { AlertChannel, AlertDeliveryType } from "@prisma/client";
import { z } from "zod";
import {
  boardActionFailure,
  boardValidationFailure,
  type ActionResult
} from "@/src/board/service";

export type AlertOwnerRecord = {
  id: string;
  ownerId: string | null;
};

export type AcknowledgeAlertStore = {
  findOwnedTender(tenderId: string, userId: string): Promise<AlertOwnerRecord | null>;
  acknowledgeAlerts(input: {
    userId: string;
    tenderId: string;
    channel: AlertChannel;
    type: AlertDeliveryType;
    acknowledgedAt: Date;
  }): Promise<{ count: number }>;
};

export type AcknowledgeAlertData = {
  tenderId: string;
  channel: AlertChannel;
  type: AlertDeliveryType;
  acknowledgedCount: number;
  acknowledgedAt: string;
};

const acknowledgeAlertInputSchema = z
  .object({
    tenderId: z.string().trim().min(1, "Tender is required."),
    channel: z.enum([AlertChannel.EMAIL, AlertChannel.TELEGRAM]),
    type: z.enum([
      AlertDeliveryType.NEW_MATCH,
      AlertDeliveryType.DEADLINE_T48,
      AlertDeliveryType.DEADLINE_T24,
      AlertDeliveryType.DEADLINE_T2,
      AlertDeliveryType.NEW_CHANGE,
      AlertDeliveryType.NEW_CLARIFICATION,
      AlertDeliveryType.STAGE_SLA_BREACH
    ])
  })
  .strict();

export async function acknowledgeAlertForUser(
  store: AcknowledgeAlertStore,
  userId: string,
  input: unknown,
  now = new Date()
): Promise<ActionResult<AcknowledgeAlertData>> {
  const parsed = acknowledgeAlertInputSchema.safeParse(input);

  if (!parsed.success) {
    return boardValidationFailure(parsed.error, "Проверьте параметры alert acknowledgment.");
  }

  const tender = await store.findOwnedTender(parsed.data.tenderId, userId);

  if (!tender) {
    return boardActionFailure("NOT_FOUND", "Алерт не найден или закупка принадлежит другому пользователю.");
  }

  const result = await store.acknowledgeAlerts({
    userId,
    tenderId: tender.id,
    channel: parsed.data.channel,
    type: parsed.data.type,
    acknowledgedAt: now
  });

  return {
    ok: true,
    data: {
      tenderId: tender.id,
      channel: parsed.data.channel,
      type: parsed.data.type,
      acknowledgedCount: result.count,
      acknowledgedAt: now.toISOString()
    }
  };
}
