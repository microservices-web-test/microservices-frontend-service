# Kubernetes deployment — frontend service

Deploys the frontend (static React SPA served by nginx, acting as a BFF that
proxies `/api/auth` and `/api/payment` to the internal backend Services) onto the
2-node **k3s** cluster on OCI (UK London, arm64).

| Thing            | Value                                                        |
| ---------------- | ------------------------------------------------------------ |
| Namespace        | `microservices`                                              |
| Registry (OCIR)  | `lhr.ocir.io/lryjhgnewmyj/microservices-frontend`            |
| Image tag        | `v1`                                                         |
| Node port        | `30080` (NodePort Service)                                   |
| kubeconfig       | `~/microservices-infra/oci-uk/kubeconfig`                    |
| Node public IPs  | node1 `141.147.71.111`, node2 `132.145.15.27`                |

> The nodes are **arm64** — images MUST be built for `linux/arm64`.

## 0. Point kubectl at the cluster

```bash
export KUBECONFIG=~/microservices-infra/oci-uk/kubeconfig
kubectl get nodes
```

## 1. Build & push the arm64 image

Built natively on node1 (arm64) via SSH. See the repo root automation, or:

```bash
# tag
IMAGE=lhr.ocir.io/lryjhgnewmyj/microservices-frontend:v1
# docker login (username + OCIR auth token):
#   username: lryjhgnewmyj/nadulsrinee@gmail.com
#   password: <OCIR auth token>  (terraform output -raw ocir_auth_token)
docker build -t "$IMAGE" .
docker push "$IMAGE"
```

## 2. Create the OCIR pull secret (one-time, per namespace)

The image is private, so the cluster needs credentials to pull it.

```bash
export KUBECONFIG=~/microservices-infra/oci-uk/kubeconfig
kubectl create namespace microservices --dry-run=client -o yaml | kubectl apply -f -

OCIR_TOKEN=$(cd ~/microservices-infra/oci-uk && terraform output -raw ocir_auth_token)
kubectl -n microservices create secret docker-registry ocir-secret \
  --docker-server=lhr.ocir.io \
  --docker-username='lryjhgnewmyj/nadulsrinee@gmail.com' \
  --docker-password="$OCIR_TOKEN" \
  --docker-email='nadulsrinee@gmail.com'
```

## 3. Deploy

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl -n microservices rollout status deploy/frontend
```

## 4. Access

```
http://141.147.71.111:30080     # (also works via node2 IP)
```

The OCI security list must allow inbound TCP on the NodePort (30080). See
`~/microservices-infra/oci-uk/network.tf`.

> The `/api/auth` and `/api/payment` buttons return 502 until the auth and
> payment backends are deployed into the `microservices` namespace.

