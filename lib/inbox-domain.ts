export function countUnread(sequences: readonly bigint[], acknowledgedThroughSeq: bigint): number {
  let count = 0;
  for (const sequence of sequences) if (sequence > acknowledgedThroughSeq) count += 1;
  return count;
}

export function nextAcknowledgedSequence(current: bigint, requested: bigint, latest: bigint): bigint {
  const capped = requested < latest ? requested : latest;
  return current > capped ? current : capped;
}
import type { Platform } from "@prisma/client";

export type IncomingMessageEvent = {
  platform: Platform;
  externalChatId: string;
  externalTitle: string | null;
  platformEventId: string;
  externalMessageId: string;
  messageAt: Date;
  receivedAt: Date;
};
