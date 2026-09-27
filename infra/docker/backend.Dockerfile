# バックエンド（Hono + SQLite）。リポジトリ直下をビルドコンテキストにする:
#   docker build -f infra/docker/backend.Dockerfile .

# better-sqlite3 はネイティブモジュールなので、ビルド用のツールがある段階で依存関係を入れる
FROM node:24-slim AS deps
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./
# tsx（TypeScriptをそのまま実行する）が devDependencies にあるため、dev も含めて入れる
RUN npm ci

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production \
  HOST=0.0.0.0 \
  DB_PATH=/data/reading.db
COPY --from=deps /app/node_modules ./node_modules
COPY backend/package.json backend/tsconfig.json ./
COPY backend/src ./src
# DBファイルはボリュームに置く（コンテナを作り直しても消えないように）。
# 名前付きボリュームは初回にこのディレクトリの所有者を引き継ぐので、node ユーザーが書き込めるようにしておく
RUN mkdir /data && chown node:node /data
VOLUME /data
EXPOSE 8080
USER node
CMD ["npm", "run", "start"]
