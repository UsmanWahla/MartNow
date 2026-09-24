import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import Modal from "./components/Modal";

describe("Modal", () => {
  it("closes when Escape is pressed", () => {
    const onClose = vi.fn();
    render(
      <Modal title="Add Product" onClose={onClose}>
        <p>Form</p>
      </Modal>
    );

    expect(screen.getByText("Add Product")).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
