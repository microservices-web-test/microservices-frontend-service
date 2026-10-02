import { useState } from "react";
import {
  callBackend,
  isBackendError,
  type BackendResponse,
  type ServiceName,
} from "./api";
import "./App.css";

type Status = "idle" | "loading" | "done";

export default function App() {
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<BackendResponse | null>(null);
  const [loadingLabel, setLoadingLabel] = useState<ServiceName | null>(null);

  async function handleClick(service: ServiceName) {
    setStatus("loading");
    setLoadingLabel(service);
    setResult(null);
    try {
      const data = await callBackend(service);
      setResult(data);
    } catch (err) {
      setResult({
        service,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setStatus("done");
      setLoadingLabel(null);
    }
  }

  return (
    <main>
      <h1>Microservices Demo Frontend</h1>
      <p className="sub">
        Each button asks the gateway to call a backend Service inside the
        cluster and shows the response.
      </p>

      <div className="buttons">
        <button
          id="authBtn"
          disabled={status === "loading"}
          onClick={() => handleClick("auth")}
        >
          Call Auth Service
        </button>
        <button
          id="paymentBtn"
          disabled={status === "loading"}
          onClick={() => handleClick("payment")}
        >
          Call Payment Service
        </button>
      </div>

      <pre id="output">
        <Output
          status={status}
          loadingLabel={loadingLabel}
          result={result}
        />
      </pre>
    </main>
  );
}

function Output({
  status,
  loadingLabel,
  result,
}: {
  status: Status;
  loadingLabel: ServiceName | null;
  result: BackendResponse | null;
}) {
  if (status === "loading") {
    return <>Calling {loadingLabel} service…</>;
  }
  if (!result) {
    return <>Click a button to call a backend service…</>;
  }
  if (isBackendError(result)) {
    return (
      <span className="err">
        ERROR calling {result.service}
        {result.target ? ` (${result.target})` : ""}: {result.error}
      </span>
    );
  }
  return (
    <>
      <span className="ok">
        [{result.service.toUpperCase()}] {result.target} → HTTP{" "}
        {result.upstreamStatus}
      </span>
      {"\n\n"}
      {result.body}
    </>
  );
}
