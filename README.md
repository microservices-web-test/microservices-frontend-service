# microservices-frontend-service

The **frontend microservice** for the microservices demo. A small Node.js /
Express app that serves a web page with two buttons and acts as a
**Backend-for-Frontend (BFF)**: it proxies the browser's button clicks, over the
internal Docker/Kubernetes network, to the `auth-service` and `payment-service`
(which live in their own separate repositories).

This is a standalone repository containing **only** the frontend application.
Infrastructure (Terraform, Kubernetes manifests, OCI config) lives in a separate
`microservices-infra` directory.

## Contents

```
.
├── server.js            # Express app + server-side proxy to the backends
├── public/index.html    # The two-button UI
├── package.json
├── Dockerfile           # node:20-alpine, non-root, listens on :8080
└── docker-compose.yml   # Runs the frontend on the shared microservices-net
```

## How it works

- Serves static UI from `public/`.
- `GET /api/auth`    → proxies to `BACKEND_AUTH_URL`    (default `http://auth-service:3000`)
- `GET /api/payment` → proxies to `BACKEND_PAYMENT_URL` (default `http://payment-service:5000`)
- `GET /healthz`     → liveness/readiness probe

The browser can't resolve in-cluster service names, so this service forwards the
calls from inside the network and relays the responses back.

## Run locally

This service talks to the other services over a shared external Docker network.

```bash
# once (shared by all services):
docker network create microservices-net

docker-compose up -d --build
# open http://localhost:8088
```

> Mapped to host port **8088** (host 8080 was already in use). Change the
> `ports:` mapping in `docker-compose.yml` if you prefer another port.

For the full multi-service walkthrough (auth + payment + their databases) see
`microservices-infra/LOCAL-SETUP.md`.

## Configuration (env vars)

| Variable              | Default                        |
| --------------------- | ------------------------------ |
| `PORT`                | `8080`                         |
| `BACKEND_AUTH_URL`    | `http://auth-service:3000`     |
| `BACKEND_PAYMENT_URL` | `http://payment-service:5000`  |
