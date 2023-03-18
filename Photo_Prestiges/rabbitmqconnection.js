const amqp = require('amqplib');
const uri = 'amqp://127.0.0.1:5672';
let rabbitmqconnection;
const mongoose = require('mongoose');

const db = mongoose.connection;

async function connectToRabbitMQ() {
    try {
        const url = uri;
        rabbitmqconnection = await amqp.connect(url);
    } catch (error) {
        console.log(error);
    }
}

async function sendMessageToQueue(queueName, message) {
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
    const channel = await rabbitmqconnection.createChannel();
    await channel.assertQueue(queueName, { durable: true });
    channel.consume(queueName, async (msg) => {
        const data = JSON.parse(msg.content.toString());
        await callback(data, dbname);
        console.log(`Received message from ${queueName}: ${msg.content.toString()}`);
    }, { noAck: true });
}


module.exports = { connectToRabbitMQ, sendMessageToQueue , consumeFromQueue };

