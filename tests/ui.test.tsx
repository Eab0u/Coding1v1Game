import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Badge, Button, Card } from "../src/components/ui";

describe("design system", () => {
  it("defaults to a non-submitting button and forwards interactions and accessible labels", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick} aria-label="Join queue">Play</Button>);
    const button = screen.getByRole("button", { name: "Join queue" });
    expect(button).toHaveAttribute("type", "button");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });
  it("preserves native disabled behavior", () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Unavailable</Button>);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });
  it.each(["primary", "secondary", "ghost"] as const)("supports the %s variant and explicit submit behavior", (variant) => {
    render(<Button variant={variant} type="submit" className="extra">Submit</Button>);
    expect(screen.getByRole("button")).toHaveClass(`button--${variant}`, "extra");
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });
  it("allows cards and badges to carry accessible descriptions and custom classes", () => {
    render(<Card role="region" aria-label="Match" className="extra"><Badge tone="accent" title="Language">Python</Badge></Card>);
    expect(screen.getByRole("region", { name: "Match" })).toHaveClass("card", "extra");
    expect(screen.getByTitle("Language")).toHaveClass("badge--accent");
  });
});
