# ─────────────────────────────────────────────
# Look at Life - 프론트엔드(React, Create React App) + nginx 이미지
# 빌드:  docker build -t lal-web ./frontend   (저장소 루트에서)
#
# - 1단계: Node로 CRA 빌드 → build/ 폴더(HTML/JS/CSS) 생성
# - 2단계: nginx가 build/ 파일을 내주고, /api/ 요청은 Spring(backend:8080)으로 넘긴다
# - REACT_APP_* 값은 빌드할 때 JS에 그대로 들어가 누구나 볼 수 있다. 비밀 값을 넣지 않는다.
# ─────────────────────────────────────────────

# 1단계: 빌드 (로컬 Node 24와 맞춤)
FROM node:24-bookworm-slim AS build
WORKDIR /app

# 의존성 먼저 설치 → 소스만 바뀌면 캐시 재사용
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# API 주소: 같은 주소의 /api 로 보낸다 → nginx가 Spring으로 전달 (CORS 불필요)
ARG REACT_APP_API_URL=/api
ENV REACT_APP_API_URL=${REACT_APP_API_URL}
# 소스맵(.map)을 만들지 않는다: 소스맵이 배포되면 브라우저에서 원본 소스 코드를 그대로 볼 수 있다
ENV GENERATE_SOURCEMAP=false
RUN npm run build

# 2단계: 정적 파일 제공 (nginx)
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
