import client from 'prom-client';
import express from 'express';
import {PROMETHEUS_METRICS_PORT} from './config';
import logger from "./logger";

// Create an instance of the registry
const register = new client.Registry();

// Define and register metrics
export const metricsCounterCities = new client.Counter({
    name: 'processed_cities',
    help: 'Total number of processed Kafka messages about cities',
    labelNames: ['status']
});

export const metricCounterStreets = new client.Counter({
    name: 'processed_streets',
    help: 'Total number of processed Kafka messages about streets',
    labelNames: ['status']
});

export const metricRateLimit = new client.Gauge({
    name: 'rate_limit',
    help: 'Global rate limit applied to all requests towards data.gov.il',
    labelNames: ['host']
});

register.registerMetric(metricsCounterCities);
register.registerMetric(metricCounterStreets);
register.registerMetric(metricRateLimit);

// Collect default metrics
client.collectDefaultMetrics({ register });

// Start the metrics server
export const startMetricsServer = (port = PROMETHEUS_METRICS_PORT) => {
    const app = express();
    app.get('/metrics', async (req, res) => {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
    });

    app.listen(port, () => {
        logger.info(`Metrics server listening on http://localhost:${port}/metrics`);
    });
};
