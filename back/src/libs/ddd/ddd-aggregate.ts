import {
  CreateDateColumn,
  Entity,
  Index,
  Column,
  UpdateDateColumn,
  DeleteDateColumn,
} from "typeorm";
import { DddEvent } from "./ddd-event";
import { stripUndefined } from "@libs/utils/helper";
import { plainToInstance } from "class-transformer";

@Entity()
@Index(["eventStatus", "createdAt"])
export abstract class DddAggregate {
  private events: DddEvent[] = [];

  @CreateDateColumn()
  readonly createdAt: Date;

  @Column({ select: false, nullable: true })
  private createdBy?: string;

  @UpdateDateColumn()
  readonly updatedAt!: Date;

  /*
  AGENT
  - select: false 가 무슨뜻인지 이 위치에 주석 설명 추가. 
  */
  @Column({ select: false, nullable: true })
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
    const compared = Object.keys(changed).reduce(
      (acc: { [key: string]: any }, prop) => {
        const originValue = this[prop as keyof typeof this];
        const changedValue = changed[prop];
        acc[prop] = !isEqual(originValue, changedValue)
          ? changedValue
          : undefined;
        return acc;
      },
      {},
    );

    return stripUndefined(compared);
  }

  toInstance<T>(dto: new (args: any[]) => T) {
    return plainToInstance(dto, this);
  }
}
