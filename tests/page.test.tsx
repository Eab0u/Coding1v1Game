import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "../src/app/page";

describe("application entry page", () => {
  it("explains the game and makes availability clear", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Your next rival");
    expect(screen.getByText(/Ranked Python duels/)).toBeVisible();
    expect(screen.getByText(/Matchmaking will open in a future update/)).toBeVisible();
    expect(screen.queryByRole("button", { name: /play/i })).not.toBeInTheDocument();
  });
});
