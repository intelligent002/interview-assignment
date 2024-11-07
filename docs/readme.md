# Demo Project Roadmap

## Overview

This demo project is designed to implement a system that handles data from a public source and processes it using a publish/subscribe (pub/sub) model. The data flows through Kafka and is stored in MongoDB, with optional metrics and monitoring via Prometheus and Grafana.

### Project Roadmap:

1. **Create an NPM package** with interfaces for pub/sub communication.
2. **Develop a Redis-based rate limiter** to manage request load.
3. **Develop the publisher (pub)** to push street data into Kafka.
4. **Develop the subscriber (sub)** to consume data from Kafka and push it into MongoDB.
5. *(Optional)* **Publish metrics** and integrate them with Prometheus.
6. *(Optional)* **Create a Grafana dashboard** to visualize the process and identify potential issues.

---

## Detailed Breakdown

### 1. NPM Package

**Dockerfile Configuration:**
- **Base Image**: Node version 16.x
- **NPM Version**: 8.x
- **TypeScript Version**: 4.x

**Containerization Steps:**
- **Pack**: Build and package the application.
- **Publish**: Publish the package for use by pub/sub services.

**Package Contents:**
- Interfaces used for communication between the publisher and subscriber.
- A client for interacting with `data.gov.il`.

---

### 2. Centralized "Leaking Bucket" Rate Limiter

**Dockerfile Configuration:**
- **Base Image**: Redis version 6.x or higher.
- **NPM Version**: 8.x for any related client library integration.
- **TypeScript Version**: 4.x for any utility scripts.

**Functionality:**
- **Rate Limiting**: Implements a "leaking bucket" algorithm to manage and distribute request load evenly over time. This ensures the service remains under the API provider's rate limits and prevents service throttling or bans.
- **Load Management**: Controls the volume of API calls made to `data.gov.il` by queueing and releasing requests at controlled intervals.
- **Scalability**: Configurable via environment variables to handle different loads and scaling requirements.

**Integration**:
- The Redis-based rate limiter is integrated into both the publisher and subscriber components to maintain coordinated request management.
- Provides real-time tracking of pending and processed requests, ensuring that any API call exceeds limits are promptly handled with retries or fallback mechanisms.

**Metrics to Monitor**:
- Count of requests held and released by Redis.
- Queue wait times for each request.
- API call counts that exceed rate limits.

**Containerization Steps**:
- **Setup**: Deploy Redis as a service within Docker Compose or as a standalone container.
- **Configuration**: Use `REDIS_HOST`, `REDIS_PORT`, and rate-limiting parameters configured via environment variables.
- **Run**: Include Redis client integration in the Node.js services to manage requests.

**Error Handling**:
- Provides detailed error logs when the Redis service fails or if rate-limiting thresholds are exceeded.
- Graceful fallback mechanisms to pause and retry API calls when limits are hit.

---

### 3. Publisher (Pub)

**Dockerfile Configuration:**
- **Base Image**: Node version 16.x
- **NPM Version**: 8.x
- **TypeScript Version**: 4.x

**Functionality**:
- Executed via CLI with a parameter specifying the city.
- Sends requests to `data.gov.il` to pull street data by city with pagination.
- Pushes the data into Kafka.
- Outputs a progress bar in the CLI.

**Message Contract**:
- SQL-like commands: `INSERT`, `DELETE`, `UPDATE`.

**Metrics to Publish**:
- Count of `data.gov.il` API calls labeled "OK/ERROR".
- Duration of `data.gov.il` requests.

**Containerization Steps**:
- **Build**: Build the Docker image.
- **Test**: Run mock requests, covering both optimistic and pessimistic scenarios.
- **Run**: Execute a bash command to keep the container running and responsive to CLI commands.
- **Connection Handling**: Ensure the service waits for connections and handles CLI commands.

---

### 4. Subscriber (Sub)

**Dockerfile Configuration:**
- **Base Image**: Node version 16.x
- **NPM Version**: 8.x
- **TypeScript Version**: 4.x

**Functionality**:
- Runs in the background with two replicas for scalability.
- Listens to a Kafka topic specified via environment variables.
- Processes messages based on the SQL-like command received, ensuring idempotency:
  - `INSERT`: Inserts data into MongoDB.
  - `DELETE`: Removes data from MongoDB.
  - `UPDATE`: Updates existing records in MongoDB.

**Metrics to Publish**:
- Count of executed commands with labels for "command" and "OK/ERROR".
- Duration of executed commands with labels for "command" and "OK/ERROR".

**Containerization Steps**:
- **Build**: Build the Docker image.
- **Test**: Simulate Kafka reads and command parsing.
- **Run**: Run the `sub.ts` script.

---

## Optional Enhancements

### 5. Metrics with Prometheus

- Collect and expose the defined metrics.
- Monitor API call counts, request durations, and command executions.

### 6. Grafana Dashboard

- Set up a Grafana dashboard to visualize the process flow.
- Include alerts and visual indicators for potential issues or ricochets.

---
