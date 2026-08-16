# ── Stage 1 : compilation Maven dans Docker ─────────────────────────────────
FROM maven:3.9-eclipse-temurin-21-alpine AS builder
WORKDIR /workspace

# Parent POM installé en local (-N = non-recursive, pas besoin des autres modules)
COPY pom.xml .
RUN --mount=type=cache,target=/root/.m2 \
    mvn -N install --no-transfer-progress

# Source du rag-service
COPY rag-service/pom.xml rag-service/pom.xml
COPY rag-service/src     rag-service/src

# Build depuis le dossier rag-service — Maven résout le parent depuis ../pom.xml
WORKDIR /workspace/rag-service
RUN --mount=type=cache,target=/root/.m2 \
    mvn clean package -DskipTests --no-transfer-progress

# ── Stage 2 : image runtime Debian (glibc requis par DJL/ONNX tokenizers) ──
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app
COPY --from=builder /workspace/rag-service/target/rag-service-*.jar app.jar
EXPOSE 8084
ENTRYPOINT ["java", "-jar", "app.jar"]
