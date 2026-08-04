import { beforeEach, describe, expect, it, vi } from "vitest";
import { setEntryContext, setSessionCookie } from "@/lib/session-cookie";
import { createAuthService } from "@/services/auth";
import { createExternalEntryService } from "@/services/external-entry";
import { GET } from "@/app/external-entry/route";

vi.mock("@/lib/session-cookie", () => ({
  setEntryContext: vi.fn(),
  setSessionCookie: vi.fn()
}));

vi.mock("@/services/auth", () => ({
  createAuthService: vi.fn()
}));

vi.mock("@/services/external-entry", () => ({
  createExternalEntryService: vi.fn()
}));

describe("/external-entry", () => {
  const authenticate = vi.fn();
  const createSession = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(createExternalEntryService).mockReturnValue({ authenticate });
    vi.mocked(createAuthService).mockReturnValue({ createSession } as never);
    createSession.mockResolvedValue({
      token: "session-token",
      expiresAt: new Date("2026-07-31T22:00:00.000Z")
    });
  });

  it("creates a FeedApp session and redirects to the requested product scope", async () => {
    authenticate.mockResolvedValue({
      ok: true,
      user: { id: "user-fihankra" },
      sourceKeys: ["fihankra-feedback"]
    });

    const response = await GET(new Request("https://feedapp.example.com/external-entry?token=signed-token"));

    expect(authenticate).toHaveBeenCalledWith("signed-token");
    expect(createSession).toHaveBeenCalledWith("user-fihankra");
    expect(setSessionCookie).toHaveBeenCalledWith("session-token", new Date("2026-07-31T22:00:00.000Z"));
    expect(setEntryContext).toHaveBeenCalledWith({
      mode: "portal",
      sourceSystem: "fihankra-feedback",
      expiresAt: new Date("2026-07-31T22:00:00.000Z")
    });
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://feedapp.example.com/?sourceSystem=fihankra-feedback");
  });

  it("creates an embedded session and redirects to the embedded landing route", async () => {
    authenticate.mockResolvedValue({
      ok: true,
      user: { id: "user-fihankra" },
      sourceKeys: ["fihankra-feedback"]
    });

    const response = await GET(
      new Request("https://feedapp.example.com/external-entry?token=signed-token&mode=embed")
    );

    expect(authenticate).toHaveBeenCalledWith("signed-token");
    expect(createSession).toHaveBeenCalledWith("user-fihankra");
    expect(setSessionCookie).toHaveBeenCalledWith("session-token", new Date("2026-07-31T22:00:00.000Z"));
    expect(setEntryContext).toHaveBeenCalledWith({
      mode: "embed",
      sourceSystem: "fihankra-feedback",
      expiresAt: new Date("2026-07-31T22:00:00.000Z")
    });
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://feedapp.example.com/embed?sourceSystem=fihankra-feedback");
  });

  it("redirects to a clean error page when the token is rejected", async () => {
    authenticate.mockResolvedValue({
      ok: false,
      reason: "expired-token"
    });

    const response = await GET(new Request("https://feedapp.example.com/external-entry?token=signed-token"));

    expect(createSession).not.toHaveBeenCalled();
    expect(setSessionCookie).not.toHaveBeenCalled();
    expect(setEntryContext).not.toHaveBeenCalled();
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://feedapp.example.com/external-entry/error?reason=expired-token");
  });
});
