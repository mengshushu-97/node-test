# GitHub Runner Setup

本仓库使用 GitHub self-hosted runner 构建镜像并推送到 Harbor。runner 建议安装在 k3s/Harbor 所在服务器上，并使用 `monitor` 用户运行。

## 1. 准备 monitor 用户权限

```bash
sudo usermod -aG docker monitor

mkdir -p ~/.kube
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown "$USER:$USER" ~/.kube/config
chmod 600 ~/.kube/config
```

执行 `usermod` 后需要重新登录 `monitor`，否则 docker 用户组可能不生效。

## 2. 安装仓库级 runner

在 GitHub 进入：

`node-test -> Settings -> Actions -> Runners -> New self-hosted runner -> Linux x64`

按页面提示下载并解压 runner。建议目录：

```bash
sudo mkdir -p /data/github-runners/node-test
sudo chown -R monitor:monitor /data/github-runners/node-test
cd /data/github-runners/node-test
```

执行 GitHub 页面给出的下载命令后，用下面的形式配置 runner：

```bash
./config.sh \
  --url https://github.com/mengshushu-97/node-test \
  --token '<GITHUB_GENERATED_RUNNER_TOKEN>' \
  --name monitor-1-node-test \
  --labels k3s,test,prod \
  --work _work
```

不要把 token 写入仓库或日志。

## 3. 注册为系统服务

```bash
cd /data/github-runners/node-test
sudo ./svc.sh install monitor
sudo ./svc.sh start
sudo ./svc.sh status
```

## 4. 部署前自检

先用运行 runner 的 `monitor` 用户在服务器本地登录 Harbor：

```bash
export HARBOR_REGISTRY=harbor.local
export HARBOR_USERNAME=admin
export HARBOR_PASSWORD="$(sudo awk -F= '/^HARBOR_ADMIN_PASSWORD=/{print $2}' /data/harbor/secrets.env)"

echo "$HARBOR_PASSWORD" | docker login "$HARBOR_REGISTRY" -u "$HARBOR_USERNAME" --password-stdin
```

再在本仓库代码目录执行：

```bash
CHECK_NAMESPACE=test ./scripts/check-runner-prereqs.sh
CHECK_NAMESPACE=prod ./scripts/check-runner-prereqs.sh
```

必须确认 `FAIL=0` 后再触发 workflow。

## 5. 触发部署

推送到 `main` 会自动部署测试环境，也可以在 GitHub 页面手动执行测试或生产发布：

`Actions -> Deploy Test -> Run workflow`

`Actions -> Deploy Prod -> Run workflow`，`confirm` 输入 `deploy-prod`
