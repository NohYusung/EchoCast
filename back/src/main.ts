import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigsService } from './configs';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    const configsService = app.get(ConfigsService);
    app.enableCors({
        origin: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['content-type'],
    });
    await app.listen(configsService.server.port);
}

void bootstrap();
