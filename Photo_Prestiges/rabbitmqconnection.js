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

async function sendMessageToQueue(queueName, message, routingKey) {
  if (!isConnected) {
    throw new Error("RabbitMQ connection is not established.");
  }
  try {
    const channel = await rabbitmqconnection.createChannel();
    await channel.assertExchange(queueName, 'fanout', { durable: true });
    await channel.publish(queueName, routingKey, Buffer.from(message));
    return Promise.resolve();
  } catch (error) {
    console.log(error);
    return Promise.reject(error);
  }
}

async function consumeFromQueue(queueName, dbname, routingKey, callback) {
  if (!isConnected) {
    throw new Error("RabbitMQ connection is not established.");
  } else {
    try {
      const channel = await rabbitmqconnection.createChannel();
      const assertQueue = await channel.assertQueue(routingKey, { exclusive: false, durable: true });
      await channel.assertExchange(queueName, 'fanout', { durable: true });
      await channel.bindQueue(assertQueue.queue, queueName, routingKey);
      channel.consume(assertQueue.queue, async (msg) => {
        const data = JSON.parse(msg.content.toString());
        await callback(data, dbname);
        console.log(`Received message from ${queueName} with routing key ${routingKey}: ${msg.content.toString()}`);
      }, { noAck: true });
    } catch (error) {
      return Promise.reject(error);
    }
  }
}

// Apparte functie maken voor direct exchange met daarbij de consumer tag en de queue naam

module.exports = { connectToRabbitMQ, sendMessageToQueue, consumeFromQueue, uri };
