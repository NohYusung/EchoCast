import { DddAggregate } from '../../../libs/ddd';
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Record } from '../../records/domain/record.entity';

type Ctor = {
    name: string;
};

@Entity('artists')
export class Artist extends DddAggregate {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ comment: '아티스트 이름' })
    name!: string;

    @OneToMany(() => Record, (record) => record.artist)
    records!: Record[];

    constructor(args?: Ctor) {
        super();
        if (args) {
            this.name = args.name;
        }
    }
}
