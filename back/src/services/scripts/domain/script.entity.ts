import { DddAggregate } from '../../../libs/ddd';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

type Ctor = {
    line: string;
    duration?: number;
};

@Entity('scripts')
export class Script extends DddAggregate {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ comment: '대사 녹음 길이', nullable: true })
    duration?: number;

    @Column({ type: 'text', comment: '대사 내용' })
    line!: string;

    constructor(args?: Ctor) {
        super();
        if (args) {
            this.line = args.line;
            this.duration = args.duration;
        }
    }

    update({ line, duration }: { line?: string; duration?: number }) {
        const changedArgs = this.stripUnchanged({
            line,
            duration,
        });

        if (!changedArgs) {
            return;
        }

        Object.assign(this, changedArgs);
    }
}
