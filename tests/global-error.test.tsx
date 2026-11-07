import { renderToStaticMarkup } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { act } from "react";
import { expect, it, vi } from "vitest";
import GlobalError from "../src/app/global-error";

it("owns a styled recovery document and hides internal failure details", () => {
  const markup = renderToStaticMarkup(<GlobalError error={Object.assign(new Error("private credentials"), { digest: "secret-digest" })} reset={() => {}} />);
  const doc = new DOMParser().parseFromString(markup, "text/html");
  expect(doc.documentElement.lang).toBe("en");
  expect(doc.title).toBe("Page recovery | CodeDuel");
  expect(doc.querySelector("style")?.textContent).toContain("@media");
  expect(doc.querySelector('main[tabindex="-1"]')?.id).toBe("global-recovery");
  expect(doc.querySelector('[role="alert"]')?.textContent).toContain("Try loading it again");
  expect(doc.body.textContent).toContain("match clock may still be running");
  expect(markup).not.toMatch(/private credentials|secret-digest/);
  expect([...doc.querySelectorAll("nav a")].map(link => link.getAttribute("href"))).toEqual(["/", "/leaderboard"]);
});

it("hydrates the standalone document and retries only on explicit activation", async () => {
  const reset = vi.fn();
  const view = <GlobalError error={new Error("private")} reset={reset} />;
  const doc = new DOMParser().parseFromString(renderToStaticMarkup(view), "text/html");
  const root = await act(async () => hydrateRoot(doc, view));
  try {
    expect(reset).not.toHaveBeenCalled();
    const button = doc.querySelector("button")!;
    expect(button.type).toBe("button");
    const guidanceId = button.getAttribute("aria-describedby")!;
    const guidance = doc.getElementById(guidanceId)!;
    expect(guidance.className).toBe("recovery-guidance");
    expect(guidance.textContent).toContain("does not submit code or start a new duel");
    expect(guidance.textContent).toContain("match clock may still be running");
    await act(async () => root.render(<GlobalError error={new Error("next failure")} reset={reset} />));
    expect(doc.querySelector("button")?.getAttribute("aria-describedby")).toBe(guidanceId);
    expect(doc.getElementById(guidanceId)).toBe(guidance);
    await act(async () => { button.click(); button.click(); });
    expect(reset).toHaveBeenCalledTimes(2);
  } finally { await act(async () => root.unmount()); }
});
