import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum DddEventStatus {
    PENDING = 'pending',
    PROCESSED = 'processed',
    FAILED = 'failed',
}

@Entity('ddd_events')
@Index(['eventStatus', 'createdAt'])
export class DddEvent {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'varchar' })
    traceId!: string;

    @Column({ type: 'varchar', comment: '이벤트의 타입' })
    eventType!: string;

    @Column({ type: 'text' })
    payload!: string;

    @Column({ type: 'simple-enum', enum: DddEventStatus, default: DddEventStatus.PENDING })
    eventStatus!: DddEventStatus;

    @Column({ type: 'datetime', nullable: true, comment: '예약 실행 시각' })
    scheduledAt?: Date;

    @Column({ type: 'datetime' })
    private occurredAt!: Date;

    @CreateDateColumn()
    private readonly createdAt!: Date;

    @UpdateDateColumn()
    private readonly updatedAt!: Date;

    constructor() {
        this.eventType = this.constructor.name;
        this.occurredAt = new Date();
    }

    static fromEvent(event: DddEvent) {
        const dddEvent = new DddEvent();
        const { occurredAt, eventType, scheduledAt, ...payload } = event;
        dddEvent.eventType = event.constructor.name;
        dddEvent.payload = JSON.stringify(payload);
        dddEvent.scheduledAt = scheduledAt;
        return dddEvent;
    }

    setTraceId(traceId: string) {
        this.traceId = traceId;
    }

    setScheduledAt(scheduledAt: Date) {
        this.scheduledAt = scheduledAt;
    }
}
