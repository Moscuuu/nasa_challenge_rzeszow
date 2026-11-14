import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("renders the title and the four layout slots", () => {
    const { container } = render(<App />);
    expect(screen.getByText("Analog Finder")).toBeInTheDocument();
    for (const slot of ["mars", "soil", "earth", "card"]) {
      expect(container.querySelector(`[data-slot="${slot}"]`)).not.toBeNull();
    }
  });
});
