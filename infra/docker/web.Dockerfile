# 画面（Vite でビルド）を Caddy で配信する。リポジトリ直下をビルドコンテキストにする:
#   docker build -f infra/docker/web.Dockerfile --build-arg VITE_GOOGLE_BOOKS_API_KEY=... .

FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
# tsconfig.json が他の tsconfig.*.json を参照しているので、すべてコピーする
COPY index.html vite.config.ts env.d.ts tsconfig*.json ./
COPY public ./public
COPY src ./src
# Google Books APIキーはビルド時に画面へ埋め込まれる（ファイルには書かず、ビルド引数で渡す）。
# 無くても動くが、共有クォータのため検索が 429 になることがある
ARG VITE_GOOGLE_BOOKS_API_KEY=""
ENV VITE_GOOGLE_BOOKS_API_KEY=$VITE_GOOGLE_BOOKS_API_KEY
# 型チェックは品質チェック（npm run build）で済ませているので、ここでは Vite のビルドだけ行う
RUN npm run build-only

FROM caddy:2-alpine
COPY --from=build /app/dist /srv
COPY infra/docker/Caddyfile /etc/caddy/Caddyfile
