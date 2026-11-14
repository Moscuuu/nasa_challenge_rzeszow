import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { appStore } from "../state/store";
import { SoilPicker } from "./SoilPicker";

const selectLayer = vi.fn(() => Promise.resolve());

beforeEach(() => {
  selectLayer.mockClear();
  appStore.setState({
    layer: "0-1m",
    selectLayer,
    manifest: {
      layers: [
        { id: "0-1m", label: "0–1 m", available: true },
        { id: "1-5m", label: "1–5 m", available: false },
        { id: "gt5m", label: "> 5 m", available: false },
      ],
    } as never,
  });
});

describe("SoilPicker", () => {
  it("marks undelivered slabs 'coming', selected one pressed", () => {
    render(<SoilPicker />);
    const slab = screen.getByRole("button", { name: /1–5 m/ });
    expect(slab).toHaveTextContent("coming");
    expect(screen.getByRole("button", { name: /0–1 m/ })).toHaveAttribute("aria-pressed", "true");
    expect(slab).toHaveAttribute("aria-pressed", "false");
  });

  it("calls selectLayer on click", () => {
    render(<SoilPicker />);
    fireEvent.click(screen.getByRole("button", { name: /1–5 m/ }));
    expect(selectLayer).toHaveBeenCalledWith("1-5m");
  });
});
