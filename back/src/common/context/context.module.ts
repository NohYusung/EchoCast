import { Module } from '@nestjs/common';
import { Context } from './context.service';

@Module({
    providers: [Context],
    exports: [Context],
})
export class ContextModule {}
