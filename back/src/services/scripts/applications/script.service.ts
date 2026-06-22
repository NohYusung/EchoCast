import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DddService } from '../../../libs/ddd';
import { Script } from '../domain/script.entity';
import { ScriptRepository } from '../repository/script.repository';

@Injectable()
export class ScriptService extends DddService {
    constructor(private readonly scriptRepository: ScriptRepository) {
        super();
    }

    async create({
        line,
    }: {
        line: string;
    }) {
        const trimmedLine = line.trim();
        if (!trimmedLine) {
            throw new BadRequestException('대사 내용이 필요합니다.');
        }

        const script = new Script({
            line: trimmedLine,
        });
        await this.scriptRepository.save([script]);

        return toScriptResponse(script);
    }

    async list() {
        const [scripts, total] = await Promise.all([
            this.scriptRepository.find({}, { options: { sort: 'id', order: 'ASC' } }),
            this.scriptRepository.count({}),
        ]);

        return { items: scripts.map(toScriptResponse), total };
    }

    async update({
        scriptId,
        line,
    }: {
        scriptId: number;
        line?: string;
    }) {
        const [script] = await this.scriptRepository.find({ id: scriptId });
        if (!script) {
            throw new NotFoundException('대사를 찾을 수 없습니다.');
        }

        const trimmedLine = line?.trim();
        if (line !== undefined && !trimmedLine) {
            throw new BadRequestException('대사 내용이 필요합니다.');
        }

        script.update({
            line: trimmedLine,
        });
        await this.scriptRepository.save([script]);
    }
}

function toScriptResponse(script: Script) {
    return {
        id: script.id,
        line: script.line,
    };
}
