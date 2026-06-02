import { Module } from '@nestjs/common';
import generalsModule from './services/generals';

@Module({
    imports: [...generalsModule],
})
export class AppModule {}

