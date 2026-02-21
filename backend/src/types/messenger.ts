// ─── Unified Messenger Types ───

export type Channel = "max" | "telegram" | "web" | "cli";

export interface UnifiedMessage {
  id: string;
  channel: Channel;
  chatId: string;
  userId: string;
  userName: string;
  text: string;
  attachments?: Attachment[];
  timestamp: Date;
  rawEvent?: unknown;
}

export interface Attachment {
  type: "photo" | "document" | "voice";
  url?: string;
  fileId?: string;
  mimeType?: string;
}

export interface OutboundMessage {
  chatId: string;
  text: string;
  parseMode?: "markdown" | "html" | "plain";
}

export interface MessengerAdapter {
  readonly channel: Channel;
  start(): Promise<void>;
  stop(): Promise<void>;
  sendMessage(msg: OutboundMessage): Promise<void>;
  onMessage(handler: (msg: UnifiedMessage) => Promise<void>): void;
}
