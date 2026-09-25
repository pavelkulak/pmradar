-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('TELEGRAM', 'MAX');

-- CreateTable
CREATE TABLE "Chat" (
    "id" UUID NOT NULL,
    "platform" "Platform" NOT NULL,
    "externalChatId" TEXT NOT NULL,
    "externalTitle" TEXT,
    "displayName" TEXT,
    "openUrl" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastEventSeq" BIGINT NOT NULL DEFAULT 0,
    "lastMessageAt" TIMESTAMP(3),
    "lastWebhookAt" TIMESTAMP(3),
    "acknowledgedThroughSeq" BIGINT NOT NULL DEFAULT 0,
    "acknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageEvent" (
    "seq" BIGSERIAL NOT NULL,
    "chatId" UUID NOT NULL,
    "platform" "Platform" NOT NULL,
    "platformEventId" TEXT NOT NULL,
    "externalMessageId" TEXT,
    "messageAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageEvent_pkey" PRIMARY KEY ("seq")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationStatus" (
    "platform" "Platform" NOT NULL,
    "lastWebhookAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3),
    "providerStatus" TEXT,
    "pendingUpdates" INTEGER,
    "lastError" TEXT,
    "lastErrorAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationStatus_pkey" PRIMARY KEY ("platform")
);

-- CreateIndex
CREATE INDEX "Chat_enabled_lastMessageAt_idx" ON "Chat"("enabled", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "Chat_platform_externalChatId_key" ON "Chat"("platform", "externalChatId");

-- CreateIndex
CREATE INDEX "MessageEvent_chatId_seq_idx" ON "MessageEvent"("chatId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "MessageEvent_platform_platformEventId_key" ON "MessageEvent"("platform", "platformEventId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- AddForeignKey
ALTER TABLE "MessageEvent" ADD CONSTRAINT "MessageEvent_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

