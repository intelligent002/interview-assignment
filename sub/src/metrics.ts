import client from 'prom-client';
import express from 'express';
import {PROMETHEUS_METRICS_PORT} from './config';

// Create an instance of the registry
const register = new client.Registry();

// Define and register metrics
export const counterCities = new client.Counter({
    name: 'processed_cities',
    help: 'Total number of processed Kafka messages about cities',
    labelNames: ['status']
});

export const counterStreets = new client.Counter({
    name: 'processed_streets',
    help: 'Total number of processed Kafka messages about streets',
    labelNames: ['status']
});

register.registerMetric(counterCities);
register.registerMetric(counterStreets);

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
        console.log(`Metrics server listening on http://localhost:${port}/metrics`);
    });
};
