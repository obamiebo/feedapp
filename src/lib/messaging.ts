import type { MessageChannel } from "@/domain/types";

export type OutboundMessage = {
  caseId: string;
  channel: Exclude<MessageChannel, "Internal Note">;
  recipient: string;
  subject?: string;
  body: string;
};

export type MessageSendResult = {
  providerMessageId: string;
  status: "accepted" | "sent" | "failed";
};

export type MessagingProviderStatus = {
  channel: "Email" | "SMS";
  provider: string;
  label: string;
  configured: boolean;
  mode: "stub" | "http" | "itc" | "tfsg" | "disabled";
  live: boolean;
  detail: string;
};

export interface MessagingProvider {
  send(message: OutboundMessage): Promise<MessageSendResult>;
}

function env(name: string) {
  return process.env[name]?.trim() || "";
}

export class StubMessagingProvider implements MessagingProvider {
  async send(message: OutboundMessage): Promise<MessageSendResult> {
    return {
      providerMessageId: `stub-${message.channel.toLowerCase()}-${message.caseId}`,
      status: "accepted"
    };
  }
}

export class MissingMessagingProvider implements MessagingProvider {
  constructor(private readonly channel: Exclude<MessageChannel, "Internal Note">, private readonly provider: string) {}

  async send(): Promise<MessageSendResult> {
    throw new Error(`${this.channel} provider "${this.provider}" is not configured`);
  }
}

export class HttpMessagingProvider implements MessagingProvider {
  constructor(
    private readonly input: {
      channel: Exclude<MessageChannel, "Internal Note">;
      provider: string;
      endpoint: string;
      bearerToken?: string;
    }
  ) {}

  async send(message: OutboundMessage): Promise<MessageSendResult> {
    const response = await fetch(this.input.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.input.bearerToken ? { authorization: `Bearer ${this.input.bearerToken}` } : {})
      },
      body: JSON.stringify({
        caseId: message.caseId,
        channel: message.channel,
        recipient: message.recipient,
        body: message.body
      })
    });

    if (!response.ok) {
      throw new Error(`${this.input.channel} provider returned ${response.status}`);
    }

    const parsed = (await response.json().catch(() => ({}))) as { id?: unknown; providerMessageId?: unknown; status?: unknown };
    const providerMessageId =
      typeof parsed.providerMessageId === "string"
        ? parsed.providerMessageId
        : typeof parsed.id === "string"
          ? parsed.id
          : `${this.input.provider}-${message.caseId}-${Date.now()}`;
    const status =
      parsed.status === "sent" || parsed.status === "failed" || parsed.status === "accepted"
        ? parsed.status
        : "accepted";

    return {
      providerMessageId,
      status
    };
  }
}

export class ItcEmailMessagingProvider implements MessagingProvider {
  constructor(private readonly endpoint: string) {}

  async send(message: OutboundMessage): Promise<MessageSendResult> {
    const traceId = crypto.randomUUID();
    const subject = message.subject ?? `Update on your case ${message.caseId}`;
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        traceId,
        sendingMethod: "e-mail",
        source: "third_party",
        details: {
          subject,
          msg: message.body
        },
        control: {
          recipients: [message.recipient]
        }
      })
    });

    if (!response.ok) {
      throw new Error(`ITC email provider returned ${response.status}`);
    }

    const parsed = (await response.json().catch(() => ({}))) as {
      id?: unknown;
      traceId?: unknown;
      providerMessageId?: unknown;
      status?: unknown;
    };
    const providerMessageId =
      typeof parsed.providerMessageId === "string"
        ? parsed.providerMessageId
        : typeof parsed.id === "string"
          ? parsed.id
          : typeof parsed.traceId === "string"
            ? parsed.traceId
            : traceId;
    const status =
      parsed.status === "sent" || parsed.status === "failed" || parsed.status === "accepted"
        ? parsed.status
        : "accepted";

    return {
      providerMessageId,
      status
    };
  }
}

export class TfsgSmsMessagingProvider implements MessagingProvider {
  constructor(
    private readonly input: {
      endpoint: string;
      apiKey: string;
      merchantId: number;
    }
  ) {}

  async send(message: OutboundMessage): Promise<MessageSendResult> {
    const response = await fetch(this.input.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        api_key: this.input.apiKey,
        merchant_id: this.input.merchantId,
        message: message.body,
        recipients: [message.recipient]
      })
    });

    if (!response.ok) {
      throw new Error(`TFSG SMS provider returned ${response.status}`);
    }

    const parsed = (await response.json().catch(() => ({}))) as {
      id?: unknown;
      messageId?: unknown;
      providerMessageId?: unknown;
      status?: unknown;
    };
    const providerMessageId =
      typeof parsed.providerMessageId === "string"
        ? parsed.providerMessageId
        : typeof parsed.messageId === "string"
          ? parsed.messageId
          : typeof parsed.id === "string"
            ? parsed.id
            : `tfsg-${message.caseId}-${Date.now()}`;
    const status =
      parsed.status === "sent" || parsed.status === "failed" || parsed.status === "accepted"
        ? parsed.status
        : "accepted";

    return {
      providerMessageId,
      status
    };
  }
}

export class ChannelMessagingProvider implements MessagingProvider {
  constructor(
    private readonly emailProvider: MessagingProvider,
    private readonly smsProvider: MessagingProvider
  ) {}

  send(message: OutboundMessage): Promise<MessageSendResult> {
    return message.channel === "SMS" ? this.smsProvider.send(message) : this.emailProvider.send(message);
  }
}

function buildProvider(channel: "Email" | "SMS"): { provider: MessagingProvider; status: MessagingProviderStatus } {
  const prefix = channel === "Email" ? "EMAIL" : "SMS";
  const providerName = env(`${prefix}_PROVIDER`) || "stub";

  if (providerName === "stub") {
    return {
      provider: new StubMessagingProvider(),
      status: {
        channel,
        provider: "stub",
        label: "Local stub",
        configured: true,
        mode: "stub",
        live: false,
        detail: "Local stub delivery is active."
      }
    };
  }

  if (providerName === "http") {
    const endpoint = env(`${prefix}_HTTP_ENDPOINT`);
    const token = env(`${prefix}_HTTP_BEARER_TOKEN`);

    return {
      provider: endpoint
        ? new HttpMessagingProvider({ channel, provider: "http", endpoint, bearerToken: token || undefined })
        : new MissingMessagingProvider(channel, "http"),
      status: {
        channel,
        provider: "http",
        label: "Generic HTTP gateway",
        configured: Boolean(endpoint),
        mode: endpoint ? "http" : "disabled",
        live: Boolean(endpoint),
        detail: endpoint ? endpoint : `${prefix}_HTTP_ENDPOINT is not set.`
      }
    };
  }

  if (channel === "Email" && providerName === "itc") {
    const endpoint = env("EMAIL_ITC_ENDPOINT") || "https://apis.itcsrvc.com/messaging/send-message";

    return {
      provider: new ItcEmailMessagingProvider(endpoint),
      status: {
        channel,
        provider: "itc",
        label: "ITC email service",
        configured: Boolean(endpoint),
        mode: "itc",
        live: true,
        detail: endpoint
      }
    };
  }

  if (channel === "SMS" && providerName === "tfsg") {
    const endpoint = env("SMS_TFSG_ENDPOINT") || "http://52.89.222.13/tfsg/public/api/send";
    const apiKey = env("SMS_TFSG_API_KEY");
    const merchantId = Number(env("SMS_TFSG_MERCHANT_ID") || "1");
    const configured = Boolean(endpoint && apiKey && Number.isInteger(merchantId) && merchantId > 0);

    return {
      provider: configured
        ? new TfsgSmsMessagingProvider({ endpoint, apiKey, merchantId })
        : new MissingMessagingProvider(channel, "tfsg"),
      status: {
        channel,
        provider: "tfsg",
        label: "TFSG SMS gateway",
        configured,
        mode: configured ? "tfsg" : "disabled",
        live: configured,
        detail: configured ? endpoint : "SMS_TFSG_API_KEY or SMS_TFSG_MERCHANT_ID is not set."
      }
    };
  }

  return {
    provider: new MissingMessagingProvider(channel, providerName),
    status: {
      channel,
      provider: providerName,
      label: providerName,
      configured: false,
      mode: "disabled",
      live: false,
      detail: `${prefix}_PROVIDER is not supported by this build.`
    }
  };
}

export function getMessagingProviderStatuses(): MessagingProviderStatus[] {
  return [buildProvider("Email").status, buildProvider("SMS").status];
}

export function createConfiguredMessagingProvider(): MessagingProvider {
  const email = buildProvider("Email");
  const sms = buildProvider("SMS");
  return new ChannelMessagingProvider(email.provider, sms.provider);
}
