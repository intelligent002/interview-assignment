#!/bin/sh

# Set up Redis configuration directory
mkdir -p /usr/local/etc/redis

# Dynamically generate Redis configuration and ACL files here, using environment variables
echo "aclfile /usr/local/etc/redis/custom_aclfile.acl" > /usr/local/etc/redis/redis.conf

# Generate ACL file using environment variables
if [ -n "${REDIS_USERNAME}" ] && [ -n "${REDIS_PASSWORD}" ]; then
    echo "user ${REDIS_USERNAME} on allkeys allchannels allcommands >${REDIS_PASSWORD}" > /usr/local/etc/redis/custom_aclfile.acl
fi

# Configure the default user
if [ "$(echo ${REDIS_DISABLE_DEFAULT_USER})" == "true" ]; then
    # Disable the default user if specified
    echo "user default off nopass nocommands" >> /usr/local/etc/redis/custom_aclfile.acl
else
    # Set a password for the default user if not disabled
    if [ -n "${REDIS_DEFAULT_PASSWORD}" ]; then
        echo "user default on allkeys allchannels allcommands >${REDIS_DEFAULT_PASSWORD}" >> /usr/local/etc/redis/custom_aclfile.acl
    else
        echo "Warning: Default user is enabled without a password!"
        echo "user default on allkeys allchannels allcommands" >> /usr/local/etc/redis/custom_aclfile.acl
    fi
fi

# Call the original Docker entrypoint script with redis-server and the path to the custom Redis configuration
exec docker-entrypoint.sh redis-server /usr/local/etc/redis/redis.conf