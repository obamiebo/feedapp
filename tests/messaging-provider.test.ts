import { afterEach, describe, expect, it, vi } from "vitest";
import { createConfiguredMessagingProvider, getMessagingProviderStatuses } from "@/lib/messaging";

const originalEnv = process.env;

afterEach(() => {
  process.env = originalEnv;
  vi.unstubAllGlobals();
});

function setEnv(values: Record<string, string | undefined>) {
  process.env = {
    ...originalEnv,
    ...values
  };
}

describe("messaging provider configuration", () => {
  it("uses stub providers by default", async () => {
    setEnv({
      EMAIL_PROVIDER: "stub",
      SMS_PROVIDER: "stub"
    });

    const statuses = getMessagingProviderStatuses();
    const provider = createConfiguredMessagingProvider();

    await expect(
      provider.send({
        caseId: "case-1",
        channel: "Email",
        recipient: "customer@example.com",
        body: "Hello"
      })
    ).resolves.toEqual({
      providerMessageId: "stub-email-case-1",
      status: "accepted"
    });
    expect(statuses).toEqual([
      expect.objectContaining({ channel: "Email", provider: "stub", configured: true, mode: "stub" }),
      expect.objectContaining({ channel: "SMS", provider: "stub", configured: true, mode: "stub" })
    ]);
  });

  it("sends HTTP provider payloads and reads provider responses", async () => {
    setEnv({
      EMAIL_PROVIDER: "http",
      EMAIL_HTTP_ENDPOINT: "https://messaging.example.test/email",
      EMAIL_HTTP_BEARER_TOKEN: "email-token",
      SMS_PROVIDER: "stub"
    });
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ providerMessageId: "email-123", status: "sent" })
    });
    vi.stubGlobal("fetch", fetch);

    const provider = createConfiguredMessagingProvider();

    await expect(
      provider.send({
        caseId: "case-1",
        channel: "Email",
        recipient: "customer@example.com",
        subject: "Custom case subject",
        body: "Hello"
      })
    ).resolves.toEqual({
      providerMessageId: "email-123",
      status: "sent"
    });
    expect(fetch).toHaveBeenCalledWith(
      "https://messaging.example.test/email",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer email-token",
          "content-type": "application/json"
        })
      })
    );
  });

  it("fails clearly when HTTP provider config is missing", async () => {
    setEnv({
      EMAIL_PROVIDER: "http",
      EMAIL_HTTP_ENDPOINT: "",
      SMS_PROVIDER: "stub"
    });

    const statuses = getMessagingProviderStatuses();
    const provider = createConfiguredMessagingProvider();

    expect(statuses[0]).toEqual(
      expect.objectContaining({
        channel: "Email",
        provider: "http",
        configured: false,
        mode: "disabled"
      })
    );
    await expect(
      provider.send({
        caseId: "case-1",
        channel: "Email",
        recipient: "customer@example.com",
        subject: "Custom case subject",
        body: "Hello"
      })
    ).rejects.toThrow('Email provider "http" is not configured');
  });

  it("sends ITC email provider payloads", async () => {
    setEnv({
      EMAIL_PROVIDER: "itc",
      EMAIL_ITC_ENDPOINT: "https://apis.itcsrvc.com/messaging/send-message",
      SMS_PROVIDER: "stub"
    });
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ traceId: "provider-trace-1", status: "queued" })
    });
    vi.stubGlobal("fetch", fetch);
    vi.spyOn(crypto, "randomUUID").mockReturnValue("trace-1");

    const statuses = getMessagingProviderStatuses();
    const provider = createConfiguredMessagingProvider();

    await expect(
      provider.send({
        caseId: "case-1",
        channel: "Email",
        recipient: "customer@example.com",
        subject: "Custom case subject",
        body: "Hello"
      })
    ).resolves.toEqual({
      providerMessageId: "provider-trace-1",
      status: "accepted"
    });
    expect(statuses[0]).toEqual(
      expect.objectContaining({
        channel: "Email",
        provider: "itc",
        configured: true,
        mode: "itc"
      })
    );
    expect(fetch).toHaveBeenCalledWith(
      "https://apis.itcsrvc.com/messaging/send-message",
      expect.objectContaining({
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          traceId: "trace-1",
          sendingMethod: "e-mail",
          source: "third_party",
          details: {
            subject: "Custom case subject",
            msg: "Hello"
          },
          control: {
            recipients: ["customer@example.com"]
          }
        })
      })
    );
  });

  it("sends TFSG SMS provider payloads", async () => {
    setEnv({
      EMAIL_PROVIDER: "stub",
      SMS_PROVIDER: "tfsg",
      SMS_TFSG_ENDPOINT: "http://52.89.222.13/tfsg/public/api/send",
      SMS_TFSG_API_KEY: "test-key",
      SMS_TFSG_MERCHANT_ID: "1"
    });
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messageId: "sms-123", status: "queued" })
    });
    vi.stubGlobal("fetch", fetch);

    const statuses = getMessagingProviderStatuses();
    const provider = createConfiguredMessagingProvider();

    await expect(
      provider.send({
        caseId: "case-1",
        channel: "SMS",
        recipient: "233240000000",
        body: "Hello"
      })
    ).resolves.toEqual({
      providerMessageId: "sms-123",
      status: "accepted"
    });
    expect(statuses[1]).toEqual(
      expect.objectContaining({
        channel: "SMS",
        provider: "tfsg",
        configured: true,
        mode: "tfsg"
      })
    );
    expect(fetch).toHaveBeenCalledWith(
      "http://52.89.222.13/tfsg/public/api/send",
      expect.objectContaining({
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          api_key: "test-key",
          merchant_id: 1,
          message: "Hello",
          recipients: ["233240000000"]
        })
      })
    );
  });

  it("fails clearly when TFSG SMS config is missing", async () => {
    setEnv({
      EMAIL_PROVIDER: "stub",
      SMS_PROVIDER: "tfsg",
      SMS_TFSG_API_KEY: "",
      SMS_TFSG_MERCHANT_ID: "1"
    });

    const statuses = getMessagingProviderStatuses();
    const provider = createConfiguredMessagingProvider();

    expect(statuses[1]).toEqual(
      expect.objectContaining({
        channel: "SMS",
        provider: "tfsg",
        configured: false,
        mode: "disabled"
      })
    );
    await expect(
      provider.send({
        caseId: "case-1",
        channel: "SMS",
        recipient: "233240000000",
        body: "Hello"
      })
    ).rejects.toThrow('SMS provider "tfsg" is not configured');
  });
});
