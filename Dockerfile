# ========== Build Stage ==========
FROM gradle:8.5-jdk21 AS builder

WORKDIR /app

# Copy project files
COPY . .

# Build the application
RUN gradle build -x test

# ========== Runtime Stage ==========
FROM eclipse-temurin:21-jdk-jammy

WORKDIR /app

# Copy the built JAR from builder stage
COPY --from=builder /app/build/libs/*.jar app.jar

# Expose port
EXPOSE 8080

# Run the application
ENTRYPOINT ["java", "-jar", "app.jar"]
