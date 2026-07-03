# node-test CI/CD

本仓库使用 Harbor + Argo CD 发布。GitHub Actions 只负责测试、构建镜像、推送 Harbor、更新 Git 里的 Kubernetes manifest；Argo CD 负责把 Git 中的目标状态同步到 k3s。

## 服务器前置条件

- Harbor 可通过 `harbor.local` 访问，并已创建 `test`、`prod` 项目。
- k3s 已配置 `/etc/rancher/k3s/registries.yaml`，可以通过 HTTP 拉取 `harbor.local`。
- GitHub self-hosted runner 带有标签：`self-hosted`、`k3s`、`test`、`prod`。
- runner 用户已在服务器本地执行 `docker login harbor.local`。
- `test`、`prod` namespace 中都存在 `harbor-auth`。

runner 用户本地登录 Harbor：

```bash
export HARBOR_REGISTRY=harbor.local
export HARBOR_USERNAME=admin
export HARBOR_PASSWORD="$(sudo awk -F= '/^HARBOR_ADMIN_PASSWORD=/{print $2}' /data/harbor/secrets.env)"

echo "$HARBOR_PASSWORD" | docker login "$HARBOR_REGISTRY" -u "$HARBOR_USERNAME" --password-stdin
```

创建 namespace 和镜像拉取 Secret：

```bash
export HARBOR_REGISTRY=harbor.local
export HARBOR_USERNAME=admin
export HARBOR_PASSWORD="$(sudo awk -F= '/^HARBOR_ADMIN_PASSWORD=/{print $2}' /data/harbor/secrets.env)"

for ns in test prod; do
  kubectl create namespace "$ns" --dry-run=client -o yaml | kubectl apply -f -
  kubectl create secret docker-registry harbor-auth \
    -n "$ns" \
    --docker-server="$HARBOR_REGISTRY" \
    --docker-username="$HARBOR_USERNAME" \
    --docker-password="$HARBOR_PASSWORD" \
    --dry-run=client -o yaml | kubectl apply -f -
done
```

部署前自检：

```bash
CHECK_NAMESPACE=test HARBOR_REGISTRY=harbor.local ./scripts/check-runner-prereqs.sh
CHECK_NAMESPACE=prod HARBOR_REGISTRY=harbor.local ./scripts/check-runner-prereqs.sh
```

## 部署流程

测试环境：push 到 `main` 后自动执行：

```text
npm ci + npm test
docker build -t harbor.local/test/node-test:$GITHUB_SHA .
docker push harbor.local/test/node-test:$GITHUB_SHA
更新 k8s/test/deployment.yaml image
git commit + push
Argo CD 自动同步 test
```

生产环境：手动触发 `Deploy Prod`，`confirm` 输入 `deploy-prod`：

```text
npm ci + npm test
docker build -t harbor.local/prod/node-test:$GITHUB_SHA .
docker push harbor.local/prod/node-test:$GITHUB_SHA
更新 k8s/prod/deployment.yaml image
git commit + push
Argo CD 自动同步 prod
```

`k8s/test` 和 `k8s/prod` 默认 2 副本，使用 `maxUnavailable: 0`、`maxSurge: 1` 和 readiness probe。生产环境额外配置 `preStop` 延迟和 PDB。

## Argo CD

如果仓库是私有仓库，先在 Argo CD 中添加仓库凭证。然后应用：

```bash
kubectl apply -f argocd/applications.yaml
kubectl get applications -n argocd | grep node-test
```

## 回滚

推荐通过 Git 回滚 `k8s/<env>/deployment.yaml` 中的镜像 tag，然后由 Argo CD 同步。应急时可执行：

```bash
kubectl rollout undo deployment/node-test -n test
kubectl rollout undo deployment/node-test -n prod
```
