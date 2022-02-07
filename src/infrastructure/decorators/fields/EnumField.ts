import {applyDecorators} from '@nestjs/common';
import {Column} from 'typeorm';
import {IsEnum, ValidateIf} from 'class-validator';
import {BaseField, IBaseFieldOptions} from './BaseField';
import BaseEnum from '../../../domain/base/BaseEnum';

interface IBEnumFieldOptions extends IBaseFieldOptions {
    enum?: object | string[] | any,
}

export function EnumField(options: IBEnumFieldOptions = {}) {
    if (Array.isArray(options.enum)) {
        options.enum = options.enum.reduce((obj, value) => {
            if (value.prototype instanceof BaseEnum) {
                obj = {
                    ...obj,
                    ...value.toEnum(),
                };
            } else if (typeof value === 'string') {
                obj[value] = value;
            }
            return obj;
        }, {});
    } else if (typeof options.enum === 'function' && options.enum.prototype instanceof BaseEnum) {
        options.enum = options.enum.toEnum();
    }

    return applyDecorators(...[
            BaseField({
                ...options,
                decoratorName: 'EnumField',
                appType: 'enum',
            }),
            Column({
                type: 'varchar',
                default: options.defaultValue,
                nullable: options.nullable,
            }),
            options.nullable && ValidateIf((object, value) => value !== null),
            IsEnum(options.enum),
        ].filter(Boolean)
    );
}
