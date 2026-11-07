// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ current: vi.fn(), change: vi.fn() }));
vi.mock("../src/lib/auth-server", () => ({ auth: { current: mocks.current }, database: () => ({}) }));
vi.mock("../src/lib/friends", () => ({ changeFriend: mocks.change }));
import { POST } from "../src/app/api/friends/route";
const request = (body="action=request&username=Bob", origin="http://localhost:3000") => POST(new NextRequest("http://localhost:3000/api/friends", {method:"POST",headers:{origin,cookie:"codeduel_session=token"},body}));
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("APP_ORIGIN","http://localhost:3000"); mocks.current.mockResolvedValue({id:"server-user"}); mocks.change.mockResolvedValue("Friend list updated."); });
it("requires same-origin authenticated bounded valid requests", async () => {
  expect((await request(undefined,"https://evil.test")).status).toBe(403);
  expect(mocks.current).not.toHaveBeenCalled();
  mocks.current.mockResolvedValueOnce(null);
  expect((await request()).status).toBe(401);
  expect((await request("a".repeat(1025))).status).toBe(413);
  expect((await request("action=unknown&username=Bob")).status).toBe(400);
  expect(mocks.change).not.toHaveBeenCalled();
});
it("uses the session actor, redirects and hides infrastructure errors", async () => {
  expect((await request("action=accept&username=Bob&userId=forged")).status).toBe(303);
  expect(mocks.change).toHaveBeenCalledWith({},"server-user","accept","Bob");
  mocks.change.mockRejectedValue(new Error("SECRET"));
  const response = await request();
  expect(response.headers.get("location")).toContain("Friends%20unavailable");
  expect(response.headers.get("location")).not.toContain("SECRET");
});
