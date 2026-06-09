import { FindOptionsRelations } from 'typeorm';
import { LessThan, MoreThanOrEqual, And, ILike, In } from 'typeorm';

export interface PaginationOptions {
    page?: number;

    limit?: number;

    sort?: string;

    order?: 'ASC' | 'DESC';
}

export interface TypeormRelationOptions<T> {
    relations?: FindOptionsRelations<T>;

    options?: PaginationOptions;

    lock?:
        | {
              mode: 'optimistic';
              version: number | Date;
          }
        | {
              mode: 'pessimistic_read' | 'pessimistic_write';
              tables?: string[];
              onLocked?: 'nowait' | 'skip_locked';
          };
}

export const convertOptions = <T>(args?: TypeormRelationOptions<T>) => {
    let skip;
    let take;
    let order;

    if (args && args.options && args.options.page) {
        skip = ((args.options.page || 1) - 1) * (args.options.limit || 1);
    }

    if (args && args.options && args.options.limit) {
        take = args.options.limit;
    }

    if (args && args.options && args.options.sort && args.options.order) {
        order = { [args.options.sort]: args.options.order };
    }

    return { skip, take, order, relations: args?.relations, lock: args?.lock };
};

export interface TypeormRelationOptions<T> extends PaginationOptions {
    relations?: FindOptionsRelations<T>;
}

/**
 * 범위 값 체크
 * @param minValue 최소값
 * @param maxValue 최대값
 * @returns 범위 값
 */
export function checkRangeValue(minValue?: any, maxValue?: any) {
    if (!minValue && maxValue) {
        return LessThan(maxValue);
    }

    if (minValue && !maxValue) {
        return MoreThanOrEqual(minValue);
    }

    if (minValue && maxValue) {
        return And(MoreThanOrEqual(minValue), LessThan(maxValue));
    }

    return undefined;
}

/**
 * 문자열 포함 여부 체크
 * @param searchKey 검색 키워드
 * @param searchValue 검색 값
 * @returns 검색 키워드와 검색 값
 */
export function checkLikeValue({ searchKey, searchValue }: { searchKey?: string; searchValue?: string }) {
    if (searchKey && searchValue) {
        return { [searchKey]: ILike(`%${searchValue}%`) };
    }

    return undefined;
}

export function checkInValue(values?: any[]) {
    return values && In(values);
}
