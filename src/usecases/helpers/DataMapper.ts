import {has as _has} from 'lodash';
import {getFieldOptions, getMetaFields, isMetaClass} from '../../infrastructure/decorators/fields/BaseField';
import {IRelationFieldOptions} from '../../infrastructure/decorators/fields/RelationField';
import {DECORATORS} from '@nestjs/swagger/dist/constants';
import {
    getTransformCallbacks,
    ITransformType,
    TRANSFORM_TYPE_COMPUTABLE,
    TRANSFORM_TYPE_DEFAULT
} from '../../infrastructure/decorators/Transform';

export class DataMapper {

    static create<T>(MetaClass, values: Partial<T>, transformType: ITransformType = TRANSFORM_TYPE_DEFAULT) {
        // Check empty
        if (values === null) {
            return null;
        }

        const result = new MetaClass();

        /**
         * Is schema implements [[IManualSchema]]?
         * @see IManualSchema
         */
        // TODO May be @BeforeCreate() decorator?
        if (result['updateFromModel'] && typeof result['updateFromModel'] === 'function' && values) {
            result['updateFromModel'](values);
            return result;
        }

        this.applyValues(result, values, transformType);

        return result;
    }

    static applyValues(object, values, transformType: ITransformType = TRANSFORM_TYPE_DEFAULT) {
        const MetaClass = object.constructor;
        const keys = isMetaClass(MetaClass) ? getMetaFields(MetaClass) : Object.keys(values);

        const transformTypes = transformType === TRANSFORM_TYPE_DEFAULT
            ? [transformType, TRANSFORM_TYPE_COMPUTABLE]
            : [transformType];

        keys.forEach(name => {
            const options = getFieldOptions(MetaClass, name);
            const sourceName = options?.sourceFieldName || name;

            if (_has(values, sourceName)) {
                object[name] = values[sourceName];
            }

            for (let type of transformTypes) {
                if (_has(values, sourceName) || type !== TRANSFORM_TYPE_DEFAULT) {
                    const callbacks = getTransformCallbacks(MetaClass.prototype, name, type);
                    for (let callback of callbacks) {
                        const value = callback({
                            value: object[name],
                            item: values,
                            key: name,
                            transformType: type,
                            options,
                            object,
                        });
                        if (typeof value !== 'undefined') {
                            object[name] = value;
                        }
                    }
                }
            }
        });
    }

    static exportModels(types: any[]) {
        const result = {};
        types.forEach(type => {
            const fieldNames = getMetaFields(type);
            result[type.name] = {
                attributes: fieldNames.map(fieldName => {
                    const apiMeta = Reflect.getMetadata(DECORATORS.API_MODEL_PROPERTIES, type.prototype, fieldName);
                    const options = getFieldOptions(type, fieldName);

                    const fieldData = {
                        attribute: fieldName,
                        type: options.appType || 'string',
                        label: options.label || apiMeta.description,
                        required: apiMeta.required,
                        ...(options.enum
                            ? {
                                items: (Array.isArray(options.enum) ? options.enum[0] : options.enum).name
                            }
                            : {}),
                    };

                    if (fieldData.type === 'relation') {
                        fieldData['modelClass'] = (options as IRelationFieldOptions).relationClass().name;
                    }

                    return fieldData;
                }),
            };
        });
        return result;
    }

    static exportEnums(types: any[]) {
        const result = {};
        types.forEach(type => {
            if (type.toArray) {
                result[type.name] = {
                    labels: type.toArray(),
                };
            }
        });
        return result;
    }
}