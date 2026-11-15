import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

describe("App", () => {
  // Data loading is covered by the store tests; keep fetch pending here.
  beforeEach(() => vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {}))));
  afterEach(() => vi.unstubAllGlobals());

  it("renders the title and the four layout slots", () => {
    const { container } = render(<App />);
    expect(screen.getByText("DeepFrost Bridge")).toBeInTheDocument();
    for (const slot of ["mars", "soil", "earth", "card"]) {
      expect(container.querySelector(`[data-slot="${slot}"]`)).not.toBeNull();
    }
  });

  it("shows the no-WebGL message in the Mars slot when WebGL is unavailable", () => {
    const { container } = render(<App />);
    expect(container.querySelector('[data-slot="mars"]')).toHaveTextContent("Your browser can't show the 3D globes.");
  });
});
