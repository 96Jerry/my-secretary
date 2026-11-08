# 1단계: 빌드 (devDependencies 포함)
FROM node:24-slim AS build
WORKDIR /app
RUN corepack enable

# 의존성 파일만 먼저 복사해 코드만 바뀌었을 때는 설치 단계를 캐시로 건너뜀
COPY package.json pnpm-lock.yaml ./
# lockfile과 package.json이 어긋나면 조용히 버전을 바꾸지 않고 실패
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

# 빌드가 끝났으니 devDependencies 제거
RUN pnpm prune --prod

# 2단계: 실행 (빌드 결과물과 운영 의존성만)
FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# 정적 페이지. nest build는 .ts만 dist로 옮기므로 따로 복사한다
COPY --from=build /app/public ./public

# root 대신 이미지에 기본 포함된 node 유저로 실행
USER node

EXPOSE 3000
CMD ["node", "dist/main.js"]
