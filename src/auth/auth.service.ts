import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from 'common-libs';

import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';

import { KafkaService } from '../services/kafka.service';

import { User } from '../user/schemas/user.schema';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel('User') private readonly userModel: Model<User>,
    private readonly kafkaService: KafkaService,
    private readonly jwtService: JwtService,
  ) {
    this.listenForTokenValidationRequests();
  }

  async register(registerDto: RegisterDto): Promise<{ accessToken: string }> {
    this.logger.log('Начата регистрация пользователя');

    const { username, password } = registerDto;

    const existingUser = await this.userModel.findOne({ username });
    if (existingUser) {
      throw new ConflictException('Username already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new this.userModel({ username, password: hashedPassword });
    await newUser.save();

    const payload = { username: newUser.name, sub: newUser._id };
    const accessToken = this.jwtService.sign(payload);

    return { accessToken };
  }

  async validateUser(username: string, password: string): Promise<User | null> {
    const user = await this.userModel.findOne({ username });
    if (user && (await bcrypt.compare(password, user.password))) {
      return user;
    }
    return null;
  }

  async login(loginDto: LoginDto): Promise<{ accessToken: string }> {
    this.logger.log('Начата регистрация пользователя');

    const { username, password } = loginDto;

    const user = await this.validateUser(username, password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { username: user.name, sub: user._id };
    const accessToken = this.jwtService.sign(payload);

    return { accessToken };
  }

  async validateToken(token: string): Promise<boolean> {
    try {
      const decoded = this.jwtService.verify(token);
      this.logger.log('Токен успешно валидирован');
      return !!decoded;
    } catch (error) {
      return false;
    }
  }

  private async listenForTokenValidationRequests() {
    await this.kafkaService.listenToTopic(
      'validate-token-request',
      async (token: string) => {
        this.logger.log(`Received token validation request: ${token}`);

        const isValid = await this.validateToken(token);

        try {
          await this.kafkaService.sendMessage(
            'validate-token-response',
            JSON.stringify({ token, isValid }),
          );
          this.logger.log(`Token validation result sent: ${isValid}`);
        } catch (error) {
          this.logger.error(
            `Error sending validation response: ${error.message}`,
          );
        }
      },
    );
  }
}
