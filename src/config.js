'use strict';

var winston = require('winston'),
    uuid = require('node-uuid'),
    _ = require('lodash'); // jshint ignore:line

winston.info('Environment variables:', {
    NODE_ENV: process.env.NODE_ENV,
    PJ_APP_URL: process.env.PJ_APP_URL,
    PJ_APP_SERVER_PORT: process.env.PJ_APP_SERVER_PORT,

    PJ_S3_DOC_PREFIX: process.env.PJ_S3_DOC_PREFIX,
    PJ_S3_KEY: process.env.PJ_S3_KEY,
    PJ_S3_SECRET: process.env.PJ_S3_SECRET ? '***' : '',
    PJ_S3_BUCKET: process.env.PJ_S3_BUCKET,
    PJ_S3_TMP_BUCKET: process.env.PJ_S3_TMP_BUCKET,
    PJ_S3_REGION: process.env.PJ_S3_REGION,
    PJ_CLOUDFRONT_URL: process.env.PJ_CLOUDFRONT_URL,

    PJ_COOKIE_SECRET: process.env.PJ_COOKIE_SECRET ? '***' : '',

    PJ_SESSION_COOKIE_KEY1: process.env.PJ_SESSION_COOKIE_KEY1 ? '***' : '',
    PJ_SESSION_COOKIE_KEY2: process.env.PJ_SESSION_COOKIE_KEY2 ? '***' : '',

    PJ_WEB_LOG_LEVEL: process.env.PJ_WEB_LOG_LEVEL,
    PJ_WEB_HOST_NAME: process.env.PJ_WEB_HOST_NAME,

    PJ_MONGO_CONNECTION_STRING: process.env.PJ_MONGO_CONNECTION_STRING,

    PJ_MANDRILL_SMTP_HOST: process.env.PJ_MANDRILL_SMTP_HOST,
    PJ_MANDRILL_SMTP_PORT: process.env.PJ_MANDRILL_SMTP_PORT,
    sPJ_MANDRILL_USER: process.env.PJ_MANDRILL_USER,
    PJ_MANDRILL_PASS: process.env.PJ_MANDRILL_PASS ? '***' : '',
    PJ_MAIL_FROM: process.env.PJ_MAIL_FROM,

    PJ_REDIS_HOST: process.env.PJ_REDIS_HOST,
    PJ_REDIS_PASS: process.env.PJ_REDIS_PASS,

    PJ_GA_TRACKING_ID: process.env.PJ_GA_TRACKING_ID,

    PJ_MONITORING_PATH: process.env.PJ_MONITORING_PATH,
    PJ_MONITORING_USER: process.env.PJ_MONITORING_USER,
    PJ_MONITORING_PASS: process.env.PJ_MONITORING_PASS,
    PJ_MONITORING_LOG_LEVEL: process.env.PJ_MONITORING_LOG_LEVEL,
    PJ_MONITORING_HOST: process.env.PJ_MONITORING_HOST,

    PJ_GOOGLE_CLIENT_ID: process.env.PJ_GOOGLE_CLIENT_ID,
    PJ_GOOGLE_CLIENT_SECRET: process.env.PJ_GOOGLE_CLIENT_SECRET ? '***' : '',

    PJ_FACEBOOK_CLIENT_ID: process.env.PJ_FACEBOOK_CLIENT_ID,
    PJ_FACEBOOK_CLIENT_SECRET: process.env.PJ_FACEBOOK_CLIENT_SECRET ? '***' : '',

    PJ_STRIPE_PUBLIC_KEY: process.env.PJ_STRIPE_PUBLIC_KEY,
    PJ_STRIPE_SECRET_KEY: process.env.PJ_STRIPE_SECRET_KEY ? '***' : '',
    PJ_STRIPE_PLAN_MONTHLY: process.env.PJ_STRIPE_PLAN_MONTHLY,
    PJ_STRIPE_PLAN_YEARLY: process.env.PJ_STRIPE_PLAN_YEARLY,

    PJ_SUPPORT_EMAIL: process.env.PJ_SUPPORT_EMAIL,

    PJ_SSL_KEY: process.env.PJ_SSL_KEY,
    PJ_SSL_CERT: process.env.PJ_SSL_CERT,

    PJ_SKIP_CONFLICTS_KEY: process.env.PJ_SKIP_CONFLICTS_KEY,
    PJ_REDIRECT_TO_WWW: process.env.PJ_REDIRECT_TO_WWW,

    PJ_PRIVATE_MODE: process.env.PJ_PRIVATE_MODE,

    PJ_LOG_EMAIL_RECIPIENTS: process.env.PJ_LOG_EMAIL_RECIPIENTS,
    PJ_LOG_EMAIL_LEVEL: process.env.PJ_LOG_EMAIL_LEVEL
});

var path = require('path'),
    env = {
        development: {
            appUrl: process.env.PJ_APP_URL || ('http://localhost:' + (process.env.PJ_APP_SERVER_PORT || 3000)),
            auth: {
                cookieSecret: process.env.PJ_COOKIE_SECRET || 'aa5cbe4d-b771-4cac-a8ac-4056cf326dc4',
                sessionCookieKey1: process.env.PJ_SESSION_COOKIE_KEY1 || '05005499-69b9-4b66-969d-ba30c89f2b56',
                sessionCookieKey2: process.env.PJ_SESSION_COOKIE_KEY2 || ''
            },
            enablePapertrail: false,
            enableNewRelic: false,
            cloudConvert: {
                apiKey: 'x7NAAvgn2Bv8Lk_z4kXqd2K0W6aX9I3HOwxOFqMxj0dT46LVt6t7v-0e5cu1CL1avMij_VJL8EvPc_Na-KSjgw'
            }
        },
        production: {
            appUrl: process.env.PJ_APP_URL,
            auth: {
                cookieSecret: process.env.PJ_COOKIE_SECRET || '756e40b7-01e2-4059-873a-7142c70a5a07',
                sessionCookieKey1: process.env.PJ_SESSION_COOKIE_KEY1 || '30ec70d3-6a4b-4325-beef-87999aa902f5',
                sessionCookieKey2: process.env.PJ_SESSION_COOKIE_KEY2 || ''
            },
            enablePapertrail: true,
            enableNewRelic: false,
            cloudConvert: {
                apiKey: 'x7NAAvgn2Bv8Lk_z4kXqd2K0W6aX9I3HOwxOFqMxj0dT46LVt6t7v-0e5cu1CL1avMij_VJL8EvPc_Na-KSjgw'
            }
        }
    };


module.exports = function() {
    var currentEnv = process.env.NODE_ENV || 'development',
        // var config = env[currentEnv];

        config = _.assign(env[currentEnv], {
            env: currentEnv,
            companyAddress: 'PO box 1632 Palo Alto 94302',
            freeUploadsQuota: 10,
            privateMode: process.env.PJ_PRIVATE_MODE || false,
            paperjetBrandHost: 'https://www.paperjet.com',
            branding: {
                allangray: {
                    favicon: '/images/branding/allangray-favicon.ico',
                    email: {
                        buttonStyle: 'background-color:#f85054;border-color:#f85054;',
                        from: 'instructions@allangray.co.za',
                        footerHtml: 'Allan Gray Proprietary Limited',
                        footerText: 'Allan Gray Proprietary Limited'
                    }
                }
            },
            webPagesNotAvailable: {
                'allangray': true
            },
            adminPagesNotAvailable: {
                'allangray': true
            },
            uploadNotAvailable: {
                'allangray': true
            },
            myDocumentsNotAvailable: {
                'allangray': true
            },
            manageFoldersNotAvailable: {
                'allangray': true
            },
            logging: {
                level: process.env.PJ_WEB_LOG_LEVEL || 'silly',
                emailFrom: process.env.PJ_LOG_EMAIL_FROM,
                emailRecipients: process.env.PJ_LOG_EMAIL_RECIPIENTS,
                emailLevel: process.env.PJ_LOG_EMAIL_LEVEL || 'warn'
            },
            mailer: {
                service: 'Mandrill',
                user: process.env.PJ_MANDRILL_USER || 'admin@paperjet.com',             //''
                pass: process.env.PJ_MANDRILL_PASS || '8MkioD6rqCiGDfK',                //''
                smtpHost: process.env.PJ_MANDRILL_SMTP_HOST || 'smtp-pulse.com',        //'smtp.mandrillapp.com'
                smtpPort: process.env.PJ_MANDRILL_SMTP_PORT || 465,                     //587
                from: process.env.PJ_MAIL_FROM || 'Paperjet <hello@paperjet.com>',      //'Paperjet <noreply@paperjet.com>',
                supportEmail: process.env.PJ_SUPPORT_EMAIL || 'chris@paperjet.com',
                footerHtml: '&mdash; The Paperjet Team',
                footerText: '- The Paperjet Team'
            },
            server: {
                port: process.env.PJ_APP_SERVER_PORT || 3000,
                sslPort: process.env.PJ_SSL_PORT || 3001,
                sslKey: process.env.PJ_SSL_KEY,
                sslCert: process.env.PJ_SSL_CERT
            },
            monitoring: {
                host: process.env.PJ_MONITORING_HOST || 'http://localhost:3000',
                path: process.env.PJ_MONITORING_PATH || (currentEnv === 'development' ? 'monitoring' : uuid.v4()),
                user: process.env.PJ_MONITORING_USER,
                pass: process.env.PJ_MONITORING_PASS,
                logLevel: process.env.PJ_MONITORING_LOG_LEVEL || process.env.PJ_WEB_LOG_LEVEL || 'silly'
            },
            pricing: {
                pro: {
                    monthly: 5,
                    // annualPerMonth: 5,
                    annual: 50
                }
                // business: {
                //     monthly: 15,
                //     annualPerMonth: 9,
                //     annual: 108,
                //     user: 2
                // }
            },
            db: {
                connectionString: process.env.PJ_MONGO_CONNECTION_STRING || 'mongodb://localhost/paperjet'
            },
            google: {
                // these credentials are valid for localhost only
                clientID: process.env.PJ_GOOGLE_CLIENT_ID || '989253347083-tbsvnvrcgkbep7n4h8vvm33f3h8053s9.apps.googleusercontent.com',
                analyticsTrackingID: process.env.PJ_GA_TRACKING_ID,
                clientSecret: process.env.PJ_GOOGLE_CLIENT_SECRET || 'aSzAx2ayC6MRPmqk3Dy-a4DS'
            },
            facebook: {
                clientID: process.env.PJ_FACEBOOK_CLIENT_ID || '460083704100943',
                clientSecret: process.env.PJ_FACEBOOK_CLIENT_SECRET || 'd011c242b5c154075ffd574779c04ffd'
            },
            redis: {
                expiration: 30 * 60, // 30 minutes
                host: process.env.PJ_REDIS_HOST || 'localhost',
                port: 6379,
                password: process.env.PJ_REDIS_PASS
            },
            stripe: {
                secretKey: process.env.PJ_STRIPE_SECRET_KEY || 'sk_test_I417ill1npSP2cUqVMwW1IkO', // test key  //sk_test_BQokikJOvBiI2HlWgH4olfQ2
                publicKey: process.env.PJ_STRIPE_PUBLIC_KEY || 'pk_test_rnVRoTZ9nt8hMXJ0TSBGVJPw', // test key  //pk_test_6pRNASCoBOKtIshFeQd4XMUh
                plans: {
                    monthly: process.env.PJ_STRIPE_PLAN_MONTHLY || 'monthly1',
                    annual: process.env.PJ_STRIPE_PLAN_YEARLY || 'yearly1'
                }
            },
            papertrail: {
                host: 'logs2.papertrailapp.com',
                port: 36411,
                hostname: process.env.PJ_WEB_HOST_NAME || 'web-whatever', // should be web-* to appear in a group in Papertrail UI
                level: process.env.PJ_WEB_LOG_LEVEL || 'info'
            },
            s3: {
                accessKeyId: process.env.PJ_S3_KEY || 'AKIAJV77UYRY7MFC6MFA',
                secretAccessKey: process.env.PJ_S3_SECRET || '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',
                instancePrefix: process.env.PJ_S3_DOC_PREFIX || 'dev',
                documentsBucket: process.env.PJ_S3_BUCKET || 'paperjet-web-dev-documents',
                documentsRegion: process.env.PJ_S3_REGION || 'us-west-1',
                layerPrefix: 'layer',
                tmpBucket: process.env.PJ_S3_TMP_BUCKET || 'paperjet-web-dev-tmp',
                tmpRegion: process.env.PJ_S3_REGION || 'us-west-1',
                cdn: {
                    // WARN: configured below
                    // 'paperjet-web-dev-documents': 'd3ah3ip7c5aodf.cloudfront.net'
                }
            },
            skipConflictsKey: process.env.PJ_SKIP_CONFLICTS_KEY || '', // for load testing
            redirectToWww: process.env.PJ_REDIRECT_TO_WWW || false
        });

    config.s3.cdn[config.s3.documentsBucket] = process.env.PJ_CLOUDFRONT_URL || 'd3ah3ip7c5aodf.cloudfront.net';

    return config;
};
