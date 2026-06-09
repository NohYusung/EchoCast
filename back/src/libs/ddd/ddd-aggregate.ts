import { CreateDateColumn, Entity, Column, UpdateDateColumn, DeleteDateColumn } from 'typeorm';
import { DddEvent } from './ddd-event';
import { stripUndefined } from '../utils/helper';
import { plainToInstance } from 'class-transformer';
import { isDeepStrictEqual } from 'util';

@Entity()
export abstract class DddAggregate {
    private events: DddEvent[] = [];

    @CreateDateColumn()
    readonly createdAt: Date;

    @Column({ type: 'varchar', select: false, nullable: true })
    private createdBy?: string;

    @UpdateDateColumn()
    readonly updatedAt!: Date;

    /**
     * TypeORM `select: false`는 기본 조회 결과에서 이 컬럼을 제외한다.
     * 감사 추적용 trace 값은 명시적으로 선택한 쿼리에서만 읽히게 한다.
     */
    @Column({ type: 'varchar', select: false, nullable: true })
    private updatedBy?: string;

    @DeleteDateColumn()
    deletedAt!: Date | null;

    publishEvent(event: DddEvent) {
        this.events.push(event);
    }

    getPublishedEvents() {
        return [...this.events];
    }

    setTraceId(traceId: string) {
        if (!this.createdAt) {
            this.createdBy = traceId;
        }
        this.updatedBy = traceId;
    }

    /**
     * @param changed 변경된 obj
     * @returns 현재 객체의 changed를 비교해서 변경된 부분만 반환한다. 바뀐게 없다면 undefined 를 반환한다.
     */
    protected stripUnchanged(changed: { [key: string]: any }) {
        const compared = Object.keys(changed).reduce((acc: { [key: string]: any }, prop) => {
            const originValue = this[prop as keyof typeof this];
            const changedValue = changed[prop];
            acc[prop] = !isDeepStrictEqual(originValue, changedValue) ? changedValue : undefined;
            return acc;
        }, {});

        return stripUndefined(compared);
    }

    toInstance<T>(dto: new (args: any[]) => T) {
        return plainToInstance(dto, this);
    }
}
