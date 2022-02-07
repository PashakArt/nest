import {applyDecorators} from '@nestjs/common';
import {Column} from 'typeorm';
import {IsInt, Max, Min, ValidateIf} from 'class-validator';
import {BaseField, IBaseFieldOptions} from './BaseField';

export function IntegerField(options: IBaseFieldOptions = {}) {
    return applyDecorators(...[
        BaseField({
            ...options,
            decoratorName: 'IntegerField',
            appType: 'integer',
        }),
        Column({
            type: 'integer',
            default: options.defaultValue,
            nullable: options.nullable,
        }),
        options.nullable && ValidateIf((object, value) => value !== null),
        IsInt(),
        typeof options.min === 'number' && Min(options.min),
        typeof options.max === 'number' && Max(options.max),
    ].filter(Boolean));
}
