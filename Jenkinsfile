// CI only: test -> build -> push to Docker Hub -> bump image tag in the GitOps config repo.
// Deployment is done by Argo CD, which watches microservices-app-config (apps/microservices-frontend-service).
// Jenkins holds NO cluster credentials (no kubeconfig).
pipeline {
  agent any
  options {
    timestamps()
    disableConcurrentBuilds()
    timeout(time: 30, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '20'))
  }
  triggers {
    githubPush()
  }
  environment {
    DOCKERHUB_NS   = 'nandul2424'
    IMAGE_REPO     = 'microservices-frontend-service'
    IMAGE_NAME     = "${DOCKERHUB_NS}/${IMAGE_REPO}"
    // ---- GitOps config repo ----
    CONFIG_REPO    = 'git@github.com:microservices-web-test/microservices-app-config.git'
    CONFIG_BRANCH  = 'main'
    CONFIG_DIR     = 'apps/microservices-frontend-service'
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
    stage('Test') {
      steps {
        sh '''
          set -eu
          docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp \
            -v "$PWD":/app -w /app node:20-alpine \
            sh -c "npm ci && npm test"
        '''
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
    stage('Push to Docker Hub') {
      steps {
        withCredentials([usernamePassword(
          credentialsId: 'dockerhub-credentials',
          usernameVariable: 'DH_USER',
          passwordVariable: 'DH_TOKEN')]) {
          sh '''
            set -eu
            echo "${DH_TOKEN}" | docker login -u "${DH_USER}" --password-stdin
            docker push "${IMAGE_NAME}:${IMAGE_TAG}"
            docker push "${IMAGE_NAME}:latest"
            docker logout || true
          '''
        }
      }
    }
    stage('Update GitOps config repo') {
      steps {
        withCredentials([sshUserPrivateKey(
          credentialsId: 'config-repo-ssh',
          keyFileVariable: 'CONFIG_SSH_KEY')]) {
          sh '''
            set -eu
            export GIT_SSH_COMMAND="ssh -i ${CONFIG_SSH_KEY} -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"
            rm -rf .config-repo
            git clone --depth 1 --branch "${CONFIG_BRANCH}" "${CONFIG_REPO}" .config-repo
            cd .config-repo
            git config user.name  "jenkins-ci"
            git config user.email "jenkins-ci@users.noreply.github.com"
            K="${CONFIG_DIR}/kustomization.yaml"
            # point the manifests at the new immutable image tag
            sed -i -E "s/^([[:space:]]*newTag:).*/\\1 ${IMAGE_TAG}/" "$K"
            git add -A "${CONFIG_DIR}"
            if git diff --cached --quiet; then
              echo "No config changes to commit."
              exit 0
            fi
            git commit -m "microservices-frontend-service: deploy ${IMAGE_TAG} [skip ci]"
            # retry if another service's pipeline pushed meanwhile
            for i in 1 2 3; do
              git push origin "HEAD:${CONFIG_BRANCH}" && break
              git pull --rebase origin "${CONFIG_BRANCH}"
            done
          '''
        }
      }
    }
  }
  post {
    success {
      echo "Pushed ${IMAGE_NAME}:${IMAGE_TAG} and updated the config repo. Argo CD will deploy it."
    }
    always {
      sh 'rm -rf .config-repo; docker image rm "${IMAGE_NAME}:${IMAGE_TAG}" "${IMAGE_NAME}:latest" >/dev/null 2>&1 || true'
    }
  }
}
