FROM grafana/grafana:11.2.2 AS addons

# Switch to root user to install curl
USER root

# Download statically compiled curl binary and place it in /usr/bin
RUN CURL_SHA256="e1cd382311300fe1cef7bf99fbb88a015cd634a5516a21f8d8d16c3c257606d1" \
 && wget https://github.com/moparisthebest/static-curl/releases/download/v8.10.1/curl-amd64 -O /usr/bin/curl \
 && echo "${CURL_SHA256} /usr/bin/curl" | sha256sum -c \
 && chmod +x /usr/bin/curl

COPY --chown=grafana:grafana provisioning/dashboards /etc/grafana/provisioning/dashboards
COPY --chown=grafana:grafana provisioning/datasources/prometheus.yaml /etc/grafana/provisioning/datasources/prometheus.yaml

# Switch back to non-root user (nobody)
USER grafana