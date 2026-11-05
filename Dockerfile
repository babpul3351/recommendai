# ─────────────────────────────────────────────
# Look at Life - Spring Boot 백엔드 이미지
# 빌드:  docker build -t lal-backend .   (저장소 루트에서)
# 설정:  application.properties는 이미지에 넣지 않는다.
#        실행할 때 /app/config/application.properties 로 연결(마운트)한다.
#        Spring Boot는 실행 위치의 config/ 폴더에 있는 설정 파일을 자동으로 읽는다.
# ─────────────────────────────────────────────

# 1단계: 빌드 (JDK + Gradle wrapper)
FROM eclipse-temurin:17-jdk AS build
WORKDIR /workspace

# 의존성 정의 파일만 먼저 복사 → 소스만 바뀌면 의존성 다운로드 단계를 캐시에서 재사용
COPY gradlew settings.gradle build.gradle ./
COPY gradle ./gradle
RUN chmod +x gradlew && ./gradlew dependencies --no-daemon > /dev/null 2>&1 || true

# 소스 복사 후 실행용 jar만 생성 (테스트는 CI에서 돌린다)
COPY src ./src
RUN ./gradlew bootJar --no-daemon -x test \
 && cp "$(ls build/libs/*.jar | grep -v -- '-plain.jar' | head -1)" /workspace/app.jar

# 2단계: 실행 (JRE만)
FROM eclipse-temurin:17-jre
WORKDIR /app

# root가 아닌 전용 사용자로 실행
RUN groupadd --system app && useradd --system --gid app --home /app app \
 && mkdir -p /app/config && chown -R app:app /app

COPY --from=build --chown=app:app /workspace/app.jar /app/app.jar

USER app
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
