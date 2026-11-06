// @vitest-environment node
import { expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
const service = vi.hoisted(() => ({ authenticate: vi.fn(), logout: vi.fn() }));
vi.mock("../src/lib/auth-server", () => ({ auth: service }));
import { POST } from "../src/app/api/auth/[action]/route";
function request(action: string, origin = "http://localhost:3000", body = "username=duelist&password=longpasswordhere") {
  return POST(new NextRequest(`http://localhost:3000/api/auth/${action}`, { method: "POST", headers: { origin, cookie: "codeduel_session=old" }, body }), { params: Promise.resolve({ action }) });
}
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("APP_ORIGIN", "http://localhost:3000"); });
it("rejects foreign and missing origins before touching auth", async () => {
  expect((await request("login", "https://evil.example")).status).toBe(403);
  expect((await request("login", "")).status).toBe(403);
  expect(service.authenticate).not.toHaveBeenCalled();
});
it("sets a private session cookie and rotates the previous session", async () => {
  service.authenticate.mockResolvedValue({ token: "fresh" });
  const response = await request("login");
  expect(response.status).toBe(303);
  expect(response.cookies.get("codeduel_session")?.value).toBe("fresh");
  expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  expect(response.headers.get("set-cookie")).toContain("SameSite=lax");
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(service.authenticate).toHaveBeenCalledWith("login", "duelist", "longpasswordhere", "old");
});
it("revokes the session before clearing its cookie", async () => {
  const response = await request("logout");
  expect(service.logout).toHaveBeenCalledWith("old");
  expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
});
it("hides infrastructure errors and rejects oversized bodies and unknown actions", async () => {
  service.authenticate.mockRejectedValue(new Error("secret database password"));
  const response = await request("signup");
  expect(response.headers.get("location")).toContain("Account%20service%20unavailable");
  expect(response.headers.get("location")).not.toContain("secret");
  expect((await request("login", undefined, "x".repeat(4097))).status).toBe(413);
  expect((await request("unknown")).status).toBe(404);
});
it("requires secure cookies in production", async () => {
  vi.stubEnv("NODE_ENV", "production");
  service.authenticate.mockResolvedValue({ token: "fresh" });
  expect((await request("login")).headers.get("set-cookie")).toContain("Secure");
  vi.unstubAllEnvs();
});
