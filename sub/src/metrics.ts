import client from 'prom-client';
import express from 'express';
import {PROMETHEUS_METRICS_PORT} from './config';

// Create an instance of the registry
const register = new client.Registry();

// Define and register metrics
const processedMessagesCounter = new client.Counter({
    name: 'processed_messages_total',
    help: 'Total number of processed Kafka messages',
});

const processingErrorsCounter = new client.Counter({
    name: 'processing_errors_total',
    help: 'Total number of errors during Kafka message processing',
});

register.registerMetric(processedMessagesCounter);
register.registerMetric(processingErrorsCounter);

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

// Export metric increment functions
export const incrementProcessedMessages = () => {
    processedMessagesCounter.inc();
};

export const incrementProcessingErrors = () => {
    processingErrorsCounter.inc();
};
