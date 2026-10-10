pipeline {
  agent any
  options {
    timestamps()
    disableConcurrentBuilds()
    timeout(time: 30, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '20'))
  }

  triggers {
    // Auto-build when GitHub sends a push webhook to Jenkins.
    // One-time setup in the repo: Settings -> Webhooks -> Add webhook
    //   Payload URL : http://141.147.71.111:8080/github-webhook/
    //   Content type: application/json
    //   Events      : Just the push event
    githubPush()
    // Fallback if you ever can't use a webhook (Jenkins polls every 5 min):
    // pollSCM('H/5 * * * *')
  }
  environment {

    OCIR_REGISTRY  = 'lhr.ocir.io'
    OCI_TENANCY_NS = 'lryjhgnewmyj'
    IMAGE_REPO     = 'microservices-frontend'
    IMAGE_NAME     = "${OCIR_REGISTRY}/${OCI_TENANCY_NS}/${IMAGE_REPO}"
    // ---- k3s target ----
    K8S_NAMESPACE  = 'microservices'
    K8S_DEPLOYMENT = 'frontend'
    K8S_CONTAINER  = 'frontend'
    PULL_SECRET    = 'ocir-secret'
  }
  stages {
    stage('Checkout') {
      steps {
        checkout scm
        script {
          env.GIT_SHA   = sh(returnStdout: true, script: 'git rev-parse --short HEAD').trim()
          env.IMAGE_TAG = "${env.BUILD_NUMBER}-${env.GIT_SHA}"
          echo "Building ${IMAGE_NAME}:${env.IMAGE_TAG}"
        }
      }
    }
    stage('Build image (arm64)') {
      steps {
        sh '''
          set -eu
          docker build --pull \
            -t "${IMAGE_NAME}:${IMAGE_TAG}" \
            -t "${IMAGE_NAME}:latest" \
            .
        '''
      }
    }

    stage('Test') {
      steps {
        sh '''
          set -eu
          docker build --target build -t "${IMAGE_NAME}:test-${IMAGE_TAG}" .
          docker run --rm "${IMAGE_NAME}:test-${IMAGE_TAG}" npm run test
        '''
      }
    }
    stage('Scan image (Trivy, optional)') {
      steps {
        sh '''
          set -eu
          if command -v trivy >/dev/null 2>&1; then
            trivy image --severity HIGH,CRITICAL --ignore-unfixed "${IMAGE_NAME}:${IMAGE_TAG}" || true
          else
            echo "trivy not installed on agent; skipping image scan"
          fi
        '''
      }
    }
    stage('Push to OCIR') {
      steps {
        withCredentials([usernamePassword(
          credentialsId: 'ocir-credentials',
          usernameVariable: 'OCIR_USER',
          passwordVariable: 'OCIR_TOKEN')]) {
          sh '''
            set -eu
            echo "${OCIR_TOKEN}" | docker login "${OCIR_REGISTRY}" -u "${OCIR_USER}" --password-stdin
            docker push "${IMAGE_NAME}:${IMAGE_TAG}"
            docker push "${IMAGE_NAME}:latest"
            docker logout "${OCIR_REGISTRY}" || true
          '''
        }
      }
    }
    stage('Deploy to k3s') {
      steps {
        withCredentials([
          file(credentialsId: 'kubeconfig', variable: 'KUBECONFIG_FILE'),
          usernamePassword(credentialsId: 'ocir-credentials',
                           usernameVariable: 'OCIR_USER',
                           passwordVariable: 'OCIR_TOKEN')]) {
          sh '''
            set -eu
            export KUBECONFIG="${KUBECONFIG_FILE}"
            # 1. Namespace.
            kubectl apply -f k8s/namespace.yaml
            # 2. Private-registry pull secret (idempotent create-or-update).
            kubectl -n "${K8S_NAMESPACE}" create secret docker-registry "${PULL_SECRET}" \
              --docker-server="${OCIR_REGISTRY}" \
              --docker-username="${OCIR_USER}" \
              --docker-password="${OCIR_TOKEN}" \
              --dry-run=client -o yaml | kubectl apply -f -
            # 3. Service (NodePort 30080).
            kubectl apply -f k8s/service.yaml
            # 4. Deployment with the freshly built, immutable tag substituted in.
            sed "s#${IMAGE_NAME}:v1#${IMAGE_NAME}:${IMAGE_TAG}#g" k8s/deployment.yaml \
              | kubectl apply -f -
            # 5. Ensure the rollout targets the exact tag (covers re-runs).
            kubectl -n "${K8S_NAMESPACE}" set image \
              "deployment/${K8S_DEPLOYMENT}" \
              "${K8S_CONTAINER}=${IMAGE_NAME}:${IMAGE_TAG}"
            # 6. Wait for rollout; auto-rollback on failure.
            if ! kubectl -n "${K8S_NAMESPACE}" rollout status \
                 "deployment/${K8S_DEPLOYMENT}" --timeout=180s; then
              echo "Rollout failed; rolling back."
              kubectl -n "${K8S_NAMESPACE}" rollout undo "deployment/${K8S_DEPLOYMENT}"
              exit 1
            fi
          '''
        }
      }
    }
  }
  post {
    success {
      echo "Deployed ${IMAGE_NAME}:${IMAGE_TAG} to k3s namespace ${K8S_NAMESPACE} (NodePort 30080)."
    }
    always {
      sh 'docker image rm "${IMAGE_NAME}:${IMAGE_TAG}" "${IMAGE_NAME}:latest" "${IMAGE_NAME}:test-${IMAGE_TAG}" >/dev/null 2>&1 || true'
    }
  }
}
