import {NestFactory, Reflector} from '@nestjs/core';
import {json, urlencoded} from 'body-parser';
import {DocumentBuilder, SwaggerModule} from '@nestjs/swagger';
import {LogLevel, VersioningType} from '@nestjs/common';
import {SentryExceptionFilter} from './SentryExceptionFilter';
import {SchemaSerializer} from './SchemaSerializer';
import {IRestAppModuleConfig} from './IRestAppModuleConfig';
import {CreateDtoPipe} from '../../pipes/CreateDtoPipe';
import {ValidationExceptionFilter} from '../../filters/ValidationExceptionFilter';
import {UserExceptionFilter} from '../../filters/UserExceptionFilter';
import {BaseApplication} from '../BaseApplication';
import {ModuleHelper} from '../../helpers/ModuleHelper';
import {AppModule} from '../AppModule';

function getLoggingLevels(isEnable: boolean): LogLevel[] {
    const logLevels: LogLevel[] = ['error', 'warn'];

    if (isEnable) {
        logLevels.push('debug');
    }

    return logLevels;
}

export class RestApplication extends BaseApplication {

    protected _app: any;
    protected _moduleClass: any;
    protected _config: IRestAppModuleConfig;

    constructor(moduleClass = AppModule) {
        super();

        this._moduleClass = moduleClass;
    }

    protected initConfig() {
        const custom = ModuleHelper.getConfig<IRestAppModuleConfig>(this._moduleClass);
        this._config = {
            requestSizeLimit: '32mb',
            ...custom,
            cors: {
                allowHeaders: [
                    'Origin',
                    'X-Requested-With',
                    'Content-Type',
                    'Accept',
                    'Authorization',
                    'Admin-Authorization',
                    'X-CSRF-Token',

                    // For file PUT upload
                    'If-None-Match',
                    'If-Modified-Since',
                    'Cache-Control',
                    'X-Requested-With',
                    'Content-Disposition',
                    'Content-Range',
                ],
                allowMethods: [
                    'POST',
                    'PUT',
                    'GET',
                    'OPTIONS',
                    'DELETE',
                ],
                ...custom?.cors,
            },
        };
    }

    protected initSwagger() {
        // Versioning
        this._app.setGlobalPrefix('/api/v1');
        this._app.enableVersioning({
            type: VersioningType.URI,
        });

        // Swagger config
        const swaggerConfig = new DocumentBuilder()
            .setTitle(this._config.title || 'Application')
            .setDescription('Документация REST API')
            .setVersion(this._config.version || '1.0')
            .build();
        const document = SwaggerModule.createDocument(this._app, swaggerConfig);
        SwaggerModule.setup('/api/docs', this._app, document);
    }

    protected initCors() {
        // Cors
        const origin = [];
        (this._config.cors.allowDomains || []).forEach(domain => {
            if (domain.indexOf('://') !== -1) {
                origin.push(domain);
            } else {
                origin.push('https://' + domain);
                origin.push('http://' + domain);
            }
        });
        this._app.enableCors({
            credentials: true,
            origin,
            methods: this._config.cors.allowMethods,
            allowedHeaders: this._config.cors.allowHeaders,
        });
    }

    protected initPipes() {
        // Validation
        this._app.useGlobalPipes(new CreateDtoPipe());
    }

    protected initFilters() {
        // Validation
        this._app.useGlobalFilters(new ValidationExceptionFilter());
        this._app.useGlobalFilters(new UserExceptionFilter());
    }

    protected initSentry() {
        if (process.env.APP_SENTRY_DSN) {
            this._app.useGlobalFilters(new SentryExceptionFilter());
        }
    }

    protected initInterceptors() {
        this._app.useGlobalInterceptors(
            new SchemaSerializer(this._app.get(Reflector)),
        );
    }

    protected initSettings() {
        this._app.use(json({ limit: this._config.requestSizeLimit }));
        this._app.use(urlencoded({ extended: true, limit: this._config.requestSizeLimit }));
    }

    protected initGraceful() {
        if (this._config.gracefulEnabled) {
            this._app.enableShutdownHooks();
        }
    }

    public async init() {
        await super.init();

        this._app = await NestFactory.create(this._moduleClass, {
            logger: getLoggingLevels(this._config.isEnableLogging),
        });

        this.initSwagger();
        this.initCors();
        this.initPipes();
        this.initFilters();
        this.initSentry();
        this.initInterceptors();
        this.initSettings();
        this.initGraceful();
    }

    public async start() {
        await this.init();

        // Start application
        const port = parseInt(process.env.PORT, 10);
        await this._app.listen(
            port,
            () => console.log(`Server started http://localhost:${port}`), // eslint-disable-line no-console
        );
    }

    public getApp() {
        return this._app;
    }
}
