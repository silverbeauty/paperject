var winston = require('winston');

winston.info('NewRelic environment variables:', {
    PJ_WEB_HOST_NAME: process.env.PJ_WEB_HOST_NAME,
    PJ_NEWRELIC_KEY: process.env.PJ_NEWRELIC_KEY ? '***' : '',
    PJ_NEWRELIC_LOG_LEVEL: process.env.PJ_NEWRELIC_LOG_LEVEL
});

/**
 * New Relic agent configuration.
 *
 * See lib/config.defaults.js in the agent distribution for a more complete
 * description of configuration variables and their potential values.
 */
exports.config = {
    /**
     * Array of application names.
     */
    app_name: [process.env.PJ_WEB_HOST_NAME || 'Set App Name'],
    /**
     * Your New Relic license key.
     */
    license_key: process.env.PJ_NEWRELIC_KEY || '',
    logging: {
        /**
         * Level at which to log. 'trace' is most useful to New Relic when diagnosing
         * issues with the agent, 'info' and higher will impose the least overhead on
         * production applications.
         */
        level: process.env.PJ_NEWRELIC_LOG_LEVEL || 'info'
    },
    rules: {
        ignore: [
            '^/' + (process.env.PJ_MONITORING_PATH || 'monitoring'),
            '^/api/*/users/*/documents/*/file'
        ]
    }
};
