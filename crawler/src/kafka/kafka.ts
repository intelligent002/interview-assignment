import {Kafka} from "kafkajs";
import {KAFKA_APP, KAFKA_BROKER} from "../config";

export const kafka = new Kafka({
    clientId: KAFKA_APP,
    brokers: [KAFKA_BROKER]
});