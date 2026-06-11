export class CueCreateDto {
    script!: string;
    startTime!: number;
    endTime!: number;
    ttsVoiceId?: number;
    volume?: number;
}
