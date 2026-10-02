// // CD pipeline for microservices-frontend-service.
// //
// // Trigger: GitHub webhook (push to the default branch) -> Jenkins.
// // Flow:    checkout -> build image -> scan -> push to OCIR -> deploy to OKE.
// //
// // GitHub webhook setup (one-time, in the repo settings):
// //   Payload URL: https://<your-jenkins>/github-webhook/
// //   Content type: application/json
// //   Events: "Just the push event"
// // The `githubPush()` trigger below reacts to that webhook.
// //
// // Required Jenkins credentials (Manage Jenkins > Credentials):
// //   - ocir-credentials      : Username/password. Username = "<tenancy-namespace>/<oci-username>"
// //                             (or "<tenancy-namespace>/oracleidentitycloudservice/<user>").
// //                             Password = an OCI Auth Token.
// //   - oci-cli-config         : Secret file = your ~/.oci/config (for `oci ce ... create-kubeconfig`).
// //   - oci-api-key            : Secret file = the API signing private key referenced by that config.
// // Adjust the OCIR_* / OKE_* values below to your tenancy.
//
// pipeline {
//   agent any
//
//   options {
//     timestamps()
//     disableConcurrentBuilds()
//     timeout(time: 30, unit: 'MINUTES')
//     buildDiscarder(logRotator(numToKeepStr: '30'))
//   }
//
//   triggers {
//     // Build when the GitHub webhook delivers a push event.
//     githubPush()
//   }
//
//   environment {
//     // ---- OCIR (Oracle Cloud Infrastructure Registry) ----
//     OCIR_REGION_KEY     = 'bom'                         // e.g. bom (Mumbai), iad (Ashburn), phx (Phoenix)
//     OCIR_REGISTRY       = "${OCIR_REGION_KEY}.ocir.io"
//     OCI_TENANCY_NS      = 'mytenancynamespace'          // Object Storage namespace of the tenancy
//     IMAGE_REPO          = 'microservices/frontend'      // repo path inside OCIR
//     IMAGE_NAME          = "${OCIR_REGISTRY}/${OCI_TENANCY_NS}/${IMAGE_REPO}"
//
//     // ---- OKE (Oracle Kubernetes Engine) ----
//     OKE_CLUSTER_OCID    = 'ocid1.cluster.oc1.ap-mumbai-1.aaaa....'  // target cluster OCID
//     OCI_REGION          = 'ap-mumbai-1'
//     K8S_NAMESPACE       = 'microservices'
//     K8S_DEPLOYMENT      = 'frontend'
//     K8S_CONTAINER       = 'frontend'
//
//     // ---- Image tags ----
//     GIT_SHA             = "${env.GIT_COMMIT ?: 'local'}"
//     IMAGE_TAG           = "${env.BUILD_NUMBER}-${GIT_SHA.take(7)}"
//   }
//
//   stages {
//     stage('Checkout') {
//       steps {
//         checkout scm
//         script {
//           env.GIT_SHA = sh(returnStdout: true, script: 'git rev-parse HEAD').trim()
//           env.IMAGE_TAG = "${env.BUILD_NUMBER}-${env.GIT_SHA.take(7)}"
//         }
//       }
//     }
//
//     stage('Build image') {
//       steps {
//         sh '''
//           set -eu
//           docker build \
//             --pull \
//             -t "${IMAGE_NAME}:${IMAGE_TAG}" \
//             -t "${IMAGE_NAME}:latest" \
//             .
//         '''
//       }
//     }
//
//     stage('Scan image (Trivy)') {
//       steps {
//         // Gate the deploy on image CVEs. Remove `|| true` to hard-fail.
//         sh '''
//           set -eu
//           if command -v trivy >/dev/null 2>&1; then
//             trivy image --severity HIGH,CRITICAL --ignore-unfixed \
//               --exit-code 1 "${IMAGE_NAME}:${IMAGE_TAG}"
//           else
//             echo "trivy not installed on agent; skipping image scan"
//           fi
//         '''
//       }
//     }
//
//     stage('Push to OCIR') {
//       steps {
//         withCredentials([usernamePassword(
//           credentialsId: 'ocir-credentials',
//           usernameVariable: 'OCIR_USER',
//           passwordVariable: 'OCIR_TOKEN')]) {
//           sh '''
//             set -eu
//             echo "${OCIR_TOKEN}" | docker login "${OCIR_REGISTRY}" \
//               -u "${OCIR_USER}" --password-stdin
//             docker push "${IMAGE_NAME}:${IMAGE_TAG}"
//             docker push "${IMAGE_NAME}:latest"
//             docker logout "${OCIR_REGISTRY}"
//           '''
//         }
//       }
//     }
//
//     stage('Deploy to OKE') {
//       steps {
//         withCredentials([
//           file(credentialsId: 'oci-cli-config', variable: 'OCI_CONFIG_FILE'),
//           file(credentialsId: 'oci-api-key',    variable: 'OCI_API_KEY_FILE')]) {
//           sh '''
//             set -eu
//             export OCI_CLI_CONFIG_FILE="${OCI_CONFIG_FILE}"
//
//             # Fetch a kubeconfig for the target OKE cluster.
//             mkdir -p "${WORKSPACE}/.kube"
//             export KUBECONFIG="${WORKSPACE}/.kube/config"
//             oci ce cluster create-kubeconfig \
//               --cluster-id "${OKE_CLUSTER_OCID}" \
//               --file "${KUBECONFIG}" \
//               --region "${OCI_REGION}" \
//               --token-version 2.0.0 \
//               --kube-endpoint PUBLIC_ENDPOINT
//
//             # Roll the deployment to the freshly pushed, immutable tag.
//             kubectl -n "${K8S_NAMESPACE}" set image \
//               "deployment/${K8S_DEPLOYMENT}" \
//               "${K8S_CONTAINER}=${IMAGE_NAME}:${IMAGE_TAG}" \
//               --record
//
//             # Wait for the rollout; auto-rollback on failure.
//             if ! kubectl -n "${K8S_NAMESPACE}" rollout status \
//                  "deployment/${K8S_DEPLOYMENT}" --timeout=180s; then
//               echo "Rollout failed; rolling back."
//               kubectl -n "${K8S_NAMESPACE}" rollout undo "deployment/${K8S_DEPLOYMENT}"
//               exit 1
//             fi
//           '''
//         }
//       }
//     }
//   }
//
//   post {
//     success {
//       echo "Deployed ${IMAGE_NAME}:${IMAGE_TAG} to OKE namespace ${K8S_NAMESPACE}."
//     }
//     always {
//       // Keep the agent clean.
//       sh 'docker image rm "${IMAGE_NAME}:${IMAGE_TAG}" "${IMAGE_NAME}:latest" || true'
//       cleanWs()
//     }
//   }
// }
