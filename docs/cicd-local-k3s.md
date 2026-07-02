# node-test CI/CD

本仓库暂时不使用镜像仓库。GitHub Actions 运行在 k3s 服务器上的 self-hosted runner，本机执行测试、构建 Docker 镜像、导入 k3s containerd，再滚动更新 Deployment。

## 服务器前置条件

- GitHub self-hosted runner 安装在 k3s 服务器上，并带有标签：`self-hosted`、`k3s`、`test`
- runner 用户可以执行 `docker`
- runner 用户可以执行 `kubectl`
- runner 用户可以免密执行 `k3s ctr -n k8s.io images import`

免密 sudo 示例，假设 runner 用户是 `monitor`：

```bash
sudo tee /etc/sudoers.d/monitor-k3s-runner >/dev/null <<'EOF'
monitor ALL=(root) NOPASSWD: /usr/local/bin/k3s
EOF
sudo chmod 440 /etc/sudoers.d/monitor-k3s-runner
```

## 部署流程

push 到 `main` 后自动执行：

```text
npm ci + npm test
docker build -t node-test:$GITHUB_SHA .
docker save node-test:$GITHUB_SHA
sudo k3s ctr -n k8s.io images import /tmp/node-test-$GITHUB_SHA.tar
kubectl apply -f k8s/test
kubectl -n test set image deployment/node-test node-test=node-test:$GITHUB_SHA
kubectl -n test rollout status deployment/node-test
```

## 手动触发

在 GitHub 仓库进入 `Actions -> Deploy Test -> Run workflow`。

## 限制

- 该方案只适合当前单节点 k3s。扩容到多节点后，每个节点都必须有同一个镜像，建议切换到阿里云 ACR。
- 不建议让 Argo CD 对这个应用开启 automated self-heal，否则可能把 Actions 设置的镜像 tag 回滚到 YAML 中的 `node-test:local`。
