import { Injectable } from '@nestjs/common';
import { DddService } from '../../../libs/ddd';
import { Audio, type AudioType } from '../domain/audio.entity';
import { AudioRepository } from '../repository/audio.repository';

@Injectable()
export class AudioService extends DddService {
    constructor(private readonly audioRepository: AudioRepository) {
        super();
    }

    async create({
        episodeId,
        cueId,
        audioType,
        name,
        audioUrl,
        duration,
    }: {
        episodeId: number;
        cueId?: number;
        audioType: AudioType;
        name: string;
        audioUrl: string;
        duration: number;
    }) {
        const audio = new Audio({
            episodeId,
            cueId,
            audioType,
            name,
            audioUrl,
            duration,
        });
        await this.audioRepository.save([audio]);

        return {
            id: audio.id,
            episodeId: audio.episodeId,
            cueId: audio.cueId ?? undefined,
            audioType: audio.audioType,
            name: audio.name,
            audioUrl: audio.audioUrl,
            duration: audio.duration,
        };
    }

    async list({ episodeId }: { episodeId: number }) {
        const [audios, total] = await Promise.all([
            this.audioRepository.findByEpisodeId(episodeId),
            this.audioRepository.countByEpisodeId(episodeId),
        ]);
        const items = audios.map((audio) => {
            return {
                id: audio.id,
                episodeId: audio.episodeId,
                cueId: audio.cueId ?? undefined,
                audioType: audio.audioType,
                name: audio.name,
                audioUrl: audio.audioUrl,
                duration: audio.duration,
            };
        });

        return { items, total };
    }
}
