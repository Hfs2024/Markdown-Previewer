const { createClient } = require("redis");
const redis = createClient({
    url: 'redis://127.0.0.1:6379'
});

// Handle error
redis.on('error', (err) => console.error('Redis Client Error:', err));

// Connect to Redis
async function connectRedis() {
    if (!redis.isOpen) {
        await redis.connect();
        console.log("Successfully connected to Redis!");
    }

    return true;
}

connectRedis();

module.exports = {
    redis
}