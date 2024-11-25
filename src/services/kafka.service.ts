import { Injectable } from '@nestjs/common';
import { Kafka, Consumer, Producer } from 'kafkajs';

@Injectable()
export class KafkaService {
  private kafka = new Kafka({ brokers: ['localhost:9092'] });
  private consumer: Consumer = this.kafka.consumer({
    groupId: 'auth-service-group',
  });
  private producer: Producer = this.kafka.producer();

  async sendMessage(topic: string, message: string) {
    try {
      await this.producer.connect();
      await this.producer.send({
        topic,
        messages: [{ value: message }],
      });
      console.log(`Message sent to topic ${topic}`);
    } catch (error) {
      console.error('Error sending message to Kafka:', error);
      throw new Error('Kafka message sending failed');
    }
  }

  async listenToTopic(topic: string, handler: (message: string) => void) {
    try {
      await this.consumer.connect();
      await this.consumer.subscribe({ topic });
      console.log(`Listening to topic ${topic}`);

      await this.consumer.run({
        eachMessage: async ({ message }) => {
          try {
            handler(message.value.toString());
          } catch (error) {
            console.error('Error handling Kafka message:', error);
          }
        },
      });
    } catch (error) {
      console.error('Error listening to Kafka topic:', error);
    }
  }
}
