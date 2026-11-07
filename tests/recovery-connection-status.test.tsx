import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import ErrorRecovery from "../src/app/error";
import GlobalError from "../src/app/global-error";
import { RecoveryConnectionStatus } from "../src/components/recovery-connection-status";

afterEach(() => vi.restoreAllMocks());

function browserConnection(initial: boolean) {
  let online = initial;
  vi.spyOn(navigator, "onLine", "get").mockImplementation(() => online);
  return (value: boolean) => {
    online = value;
    fireEvent(window, new Event(value ? "online" : "offline"));
  };
}

it("keeps a silent stable region until an outage and preserves manual recovery and focus", () => {
  const connect = browserConnection(true);
  const reset = vi.fn();
  render(<ErrorRecovery error={new Error("private")} reset={reset} />);
  const status = screen.getByRole("status");
  expect(status).toBeEmptyDOMElement();
  expect(status).toHaveAttribute("aria-live", "polite");
  expect(status).toHaveAttribute("aria-atomic", "true");
  connect(true);
  expect(status).toBeEmptyDOMElement();
  const retry = screen.getByRole("button", { name: "Try this page again" });
  const description = retry.getAttribute("aria-describedby");
  retry.focus();
  connect(false);
  expect(status).toHaveTextContent("Browser offline.");
  expect(status).toHaveTextContent("live duel server clock continues");
  expect(status.querySelector("p")).toHaveClass("recovery-guidance");
  expect(retry).toHaveFocus();
  connect(true);
  expect(screen.getByRole("status")).toBe(status);
  expect(status).toHaveTextContent("Server availability is not yet confirmed");
  expect(status).toHaveTextContent("does not retry automatically");
  expect(retry).toHaveFocus();
  expect(retry).toHaveAttribute("aria-describedby", description);
  expect(reset).not.toHaveBeenCalled();
  fireEvent.click(retry);
  expect(reset).toHaveBeenCalledTimes(1);
  connect(false);
  expect(status).not.toHaveTextContent("Browser back online");
});

it("detects initial offline state, cleans up listeners and starts fresh on reopening", () => {
  const connect = browserConnection(false);
  const remove = vi.spyOn(window, "removeEventListener");
  const first = render(<RecoveryConnectionStatus />);
  expect(screen.getByRole("status")).toHaveTextContent("Browser offline");
  connect(true);
  expect(screen.getByRole("status")).toHaveTextContent("Browser back online");
  first.unmount();
  for (const event of ["offline", "online"]) expect(remove).toHaveBeenCalledWith(event, expect.any(Function));
  render(<RecoveryConnectionStatus />);
  expect(screen.getByRole("status")).toBeEmptyDOMElement();
});

it("hydrates the standalone root error document offline and keeps controls stable through reconnection", async () => {
  const connect = browserConnection(false);
  const reset = vi.fn();
  const view = <GlobalError error={new Error("private")} reset={reset} />;
  const doc = new DOMParser().parseFromString(renderToStaticMarkup(view), "text/html");
  expect(doc.querySelector('[role="status"]')?.textContent).toBe("");
  const root = await act(async () => hydrateRoot(doc, view));
  try {
    const status = doc.querySelector('[role="status"]')!;
    const retry = doc.querySelector("button")!;
    expect(status.textContent).toContain("Browser offline");
    expect(status.querySelector("p")?.className).toBe("recovery-guidance");
    expect(doc.querySelector("style")?.textContent).toContain(".recovery-guidance");
    connect(true);
    expect(status.textContent).toContain("Server availability is not yet confirmed");
    expect(doc.querySelector("button")).toBe(retry);
    expect(reset).not.toHaveBeenCalled();
    await act(async () => retry.click());
    expect(reset).toHaveBeenCalledTimes(1);
    connect(false);
    expect(status.textContent).toContain("Browser offline");
  } finally { await act(async () => root.unmount()); }
});
