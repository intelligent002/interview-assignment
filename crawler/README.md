# Pub Kafka App

[![cov](https://we-cli.github.io/jayin/badges/coverage.svg)](https://github.com/we-cli/jayin/actions)

This app pulls street IDs from Kafka, queries street data using `data-gov-il-client`, and pushes the data into MongoDB.

## Prerequisites
- node 16
- npm 8
- typescript 4
- data-gov-il-client package published
- Kafka running locally or on a server
- MongoDB running locally or on a server