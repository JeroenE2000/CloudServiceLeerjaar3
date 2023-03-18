const amqp = require('amqplib');
require('dotenv').config();
const uri = 'amqp://127.0.0.1:5672';
let rabbitmqconnection = null;
let isConnected = false;

async function connectToRabbitMQ() {
    try {
        const url = uri;
        rabbitmqconnection = await amqp.connect(url);
        isConnected = true;
    } catch (error) {
        console.log(error);
        isConnected = false;
    }
    return isConnected;
}

async function sendMessageToQueue(queueName, message) {
    if (!isConnected) {
        throw new Error("RabbitMQ connection is not established.");
    }
    try {
        const channel = await rabbitmqconnection.createChannel();
        await channel.assertQueue(queueName);
        await channel.sendToQueue(queueName, Buffer.from(message));
        return Promise.resolve();
    } catch (error) {
        console.log(error);
        return Promise.reject(error);
    }
}

async function consumeFromQueue(queueName, dbname, callback) {
    if (!isConnected) {
        throw new Error("RabbitMQ connection is not established.");
    } else {
        try {
            const channel = await rabbitmqconnection.createChannel();
            await channel.assertQueue(queueName, { durable: true });
            channel.consume(queueName, async (msg) => {
                const data = JSON.parse(msg.content.toString());
                await callback(data, dbname);
                console.log(`Received message from ${queueName}: ${msg.content.toString()}`);
            }, { noAck: true });
        } catch (error) {
            return Promise.reject(error);
        }
    }
}


module.exports = { connectToRabbitMQ, sendMessageToQueue , consumeFromQueue };

