#!/bin/bash

# Function to display the help message and exit
show_help() {
    echo "
Usage: cli.sh --cities \"city1\" \"city2\" ... [--help]
--cities: Specify one or more city names, each enclosed in quotes and separated by space.
--help: Show this help message.

Examples:
./cli.sh --cities \"Tel-Aviv\"
./cli.sh --cities \"Tel-Aviv\" \"Ashdod\" \"Jerusalem\"
./cli.sh --help
"
    exit 0
}

# Check if no arguments are passed
if [ $# -eq 0 ]; then
    show_help
fi

# no --cities argument - show help
if [ "$1" != "--cities" ]; then
    show_help
fi

# only --cities argument without actual cities - show help
if [ $# -lt 2 ]; then
    show_help
fi

# Collect city names, ignoring empty or too-short strings
cities=()
shift  # Shift to skip the '--cities' argument
for city in "$@"; do
    city=$(echo "$city" | xargs)  # Trim leading/trailing spaces

    # Skip city if too short or empty
    if [ ${#city} -lt 2 ] || [ -z "$city" ]; then
        continue
    fi

    # Add kosher city to the list
    cities+=("$city")
done

# Check if any kosher city names were collected
if [ ${#cities[@]} -eq 0 ]; then
    show_help
fi

# Run the container for each valid city
for city in "${cities[@]}"; do
    echo "Processing city: $city"
    docker run --rm \
        --env LOG_LEVEL="error" \
        --env-file=".env-cluster" \
        --env KAFKAJS_NO_PARTITIONER_WARNING=1 \
        --network interview-assignment_default \
        -v ./certs:/certs \
        interview-assignment-cli:latest "$city"
done
