export class AnchorEventUpsertDto {
    type!: 'scroll' | 'pause';
    endAnchorId?: number;
    duration?: number;
}
