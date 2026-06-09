import { DddAggregate } from '../../../libs/ddd';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

type Ctor = {
    script: string;
    characterId: string;
};

@Entity('scripts')
export class Script extends DddAggregate {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'text', comment: '스크립트 본문' })
    script!: string;

    @Column({ comment: '캐릭터 id' })
    characterId!: string;

    constructor(args?: Ctor) {
        super();
        if (args) {
            this.script = args.script;
            this.characterId = args.characterId;
        }
    }
}
