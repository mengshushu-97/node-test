# node-test

Express 示例服务，输出 JSON 日志到 stdout，并通过 OpenTelemetry OTLP HTTP 接入 Collector。

## 功能

- `GET /health` 健康检查
- `GET /api/data` 返回 Node 服务数据
- `POST /api/trigger/node-chain` 触发 `node -> java -> agent`
- `POST /api/trigger/node-simple` 触发 `node -> java`
- `POST /api/java-chain` 供 Java 调用，内部继续调用 Agent，形成 `java -> node -> agent`
- 每秒输出 heartbeat 日志
- 每分钟自动执行 `node -> java -> agent` 和 `node -> java`

## 本地启动

```bash
npm install
cp .env.example .env
npm start
```

## Kubernetes

```bash
kubectl apply -f k8s/test
kubectl get pods -n test -l app.kubernetes.io/name=node-test
```

## CI/CD

当前不使用镜像仓库，使用 GitHub self-hosted runner 在 k3s 服务器本机构建镜像并部署。测试环境 push `main` 自动发布，生产环境通过手动 workflow 发布。先按 [docs/github-runner-setup.md](docs/github-runner-setup.md) 配置 runner，再看 [docs/cicd-local-k3s.md](docs/cicd-local-k3s.md)。

生产多副本时，定时任务会在每个副本执行。正式环境建议把定时任务拆成独立 CronJob，或增加 leader election。
