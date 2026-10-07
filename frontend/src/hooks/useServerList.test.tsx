import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useServerList, type Paged } from "./useServerList";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });

  return { promise, resolve };
}

function ListHarness({
  extraKey,
  fetcher,
}: {
  extraKey: string;
  fetcher: () => Promise<Paged<string>>;
}) {
  const { rows } = useServerList(fetcher, () => undefined, extraKey);
  return <p>{rows.join(",")}</p>;
}

describe("useServerList", () => {
  it("ignores an older response after a newer request completes", async () => {
    const first = deferred<Paged<string>>();
    const second = deferred<Paged<string>>();
    const fetcher = vi
      .fn<() => Promise<Paged<string>>>()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    const view = render(<ListHarness extraKey="first" fetcher={fetcher} />);

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    view.rerender(<ListHarness extraKey="second" fetcher={fetcher} />);
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));

    await act(async () => {
      second.resolve({ rows: ["new"], total: 1 });
    });
    expect(screen.getByText("new")).toBeTruthy();

    await act(async () => {
      first.resolve({ rows: ["old"], total: 1 });
    });
    expect(screen.getByText("new")).toBeTruthy();
  });
});
