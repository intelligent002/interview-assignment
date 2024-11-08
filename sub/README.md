# Pub Kafka App

This app pulls street IDs from Kafka, queries street data using `data-gov-il-client`, and pushes the data into MongoDB.

## Prerequisites
- node 16
- npm 8
- typescript 4
- data-gov-il-client package published
- Kafka running locally or on a server
- MongoDB running locally or on a server