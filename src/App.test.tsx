import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function mockFetchJson(body: unknown, status = 200) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
}

describe("App", () => {
  it("renders the two service buttons", () => {
    render(<App />);
    expect(
      screen.getByRole("button", { name: /call auth service/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /call payment service/i }),
    ).toBeInTheDocument();
  });

  it("shows a successful auth response", async () => {
    mockFetchJson({
      service: "auth",
      target: "/api/auth",
      upstreamStatus: 200,
      body: "hello from auth",
    });

    render(<App />);
    await userEvent.click(
      screen.getByRole("button", { name: /call auth service/i }),
    );

    await waitFor(() =>
      expect(screen.getByText(/hello from auth/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/\[AUTH\]/)).toBeInTheDocument();
  });

  it("renders an error response from the backend", async () => {
    mockFetchJson({ service: "payment", error: "upstream unreachable" });

    render(<App />);
    await userEvent.click(
      screen.getByRole("button", { name: /call payment service/i }),
    );

    await waitFor(() =>
      expect(
        screen.getByText(/upstream unreachable/i),
      ).toBeInTheDocument(),
    );
  });
});
