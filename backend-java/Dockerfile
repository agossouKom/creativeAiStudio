# ── Images Runtime pour les microservices Java ──────────────────────────
FROM eclipse-temurin:21-jre-alpine AS api-gateway
WORKDIR /app
COPY ./backend-java/api-gateway/target/api-gateway-1.0.0-SNAPSHOT.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]

FROM eclipse-temurin:21-jre-alpine AS auth-service
WORKDIR /app
COPY ./backend-java/auth-service/target/*.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]

FROM eclipse-temurin:21-jre-alpine AS search-service
WORKDIR /app
COPY ./backend-java/search-service/target/*.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]

FROM eclipse-temurin:21-jre-alpine AS docfusion-service
WORKDIR /app
COPY ./backend-java/docfusion-service/target/*.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]

FROM eclipse-temurin:21-jre-alpine AS agent-team-service
WORKDIR /app
COPY ./backend-java/agent-team-service/target/*.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]

# generation-service consomme les topics de résultats qui peuvent être compressés
# (snappy) par n'importe quel producteur Kafka : la lib native de snappy-java
# nécessite une glibc, absente d'eclipse-temurin:*-alpine (musl).
FROM eclipse-temurin:21-jre-jammy AS generation-service
WORKDIR /app
COPY ./backend-java/generation-service/target/*.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]

FROM eclipse-temurin:21-jre-alpine AS telegram-mcp-service
WORKDIR /app
COPY ./backend-java/telegram-mcp-service/target/*.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]
