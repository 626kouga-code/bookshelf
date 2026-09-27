#!/bin/bash
# EC2の初回起動時に1回だけ実行される。Docker と Docker Compose を入れ、スワップを作る。
set -eux

dnf update -y
dnf install -y docker git
systemctl enable --now docker
usermod -aG docker ec2-user

# Docker Compose（プラグインとして入れ、`docker compose` で使えるようにする）
mkdir -p /usr/local/lib/docker/cli-plugins
curl -fsSL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-${compose_arch}" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# メモリが1GBしかないので、画面のビルド（Vite）で足りなくならないようスワップを2GB作る
if [ ! -f /swapfile ]; then
  dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap defaults 0 0' >> /etc/fstab
fi
