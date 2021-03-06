'use strict';

const SimpleClient = require('./SimpleClient.js');
const winston = require('winston');

function assert (condition, message) {
    if (!condition) {
        logger.error('!!! assert FAILED !!! message: ' + message);
        logger.error('!!! stack trace:');
        const err = new Error(message);
        logger.error(err.stack);
        throw err;
    }
}

function sleep (milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

const logger = new(winston.Logger)({
    level: 'debug',
    transports: [
        new(winston.transports.Console)({
            colorize: true
        }),
    ]
});

// Make node do something more reasonable with this type of error.
process.on('unhandledRejection', (r) => logger.error(r));

// ./netcfg.json is the read-only configuration for peer network
// ./appcfg.json is the read-only configuration for application
const simple_client = new SimpleClient(require('./netcfg.json'), require('./appcfg.json'));

function sleep__p (delay_milliseconds) {
    for (let i = 0; i < 10; i++) {
        logger.debug('---------------------------------------------------------------------------');
    }
    logger.debug('-- BEGIN sleeping for %d ms', delay_milliseconds);
    return sleep(delay_milliseconds)
    .then(() => {
        logger.debug('-- DONE sleeping for %d ms', delay_milliseconds);
        for (let i = 0; i < 10; i++) {
            logger.debug('---------------------------------------------------------------------------');
        }
    });
}

Promise.resolve()
.then(() => {
    return simple_client.create_kvs_for_each_org__p()
})
.then(() => {
    return simple_client.enroll_all_users_for_each_org__p()
})
.then(() => {
    return simple_client.create_channels__p()
})
.then(() => {
    // This wait appears to be necessary -- is there some event that must be listened for
    // in order to wait for channel creation to complete?  Why doesn't it do that already?
    return sleep__p(1000)
})
.then(() => {
    return simple_client.join_channels__p()
})
.then(() => {
    const channel_name = 'mychannel';
    return simple_client.install_and_instantiate_chaincode_on_channel__p({
        channel_name: channel_name,
        invoking_user_name_for_org: { // TEMP HACK -- probably use channel joiner user
            'org0': 'Admin',
            'org1': 'Admin'
        },
        fcn: 'init',
        args: ['alice', '123', 'bob', '456']
    });
})
.then(() => {
    // This wait appears to be necessary -- is there some event that must be listened for
    // in order to wait for install/instantiate to complete?  Why doesn't it do that already?
    return sleep__p(5000)
})
.then(() => {
    const channel_name = 'mychannel';
    return Promise.all([
        simple_client.query__p({
            channel_name: channel_name,
            invoking_user_name: 'Admin', // TEMP HACK
            invoking_user_org_name: 'org0',
            fcn: 'query',
            args: ['alice']
        }),
        simple_client.query__p({
            channel_name: channel_name,
            invoking_user_name: 'Admin', // TEMP HACK
            invoking_user_org_name: 'org0',
            fcn: 'query',
            args: ['bob']
        })
    ]);
})
.then(balances => {
    logger.debug('balances = %j', balances);
    assert(balances[0] == '123' && balances[1] == '456', 'got incorrect balances from queries');
})
.then(() => {
    const channel_name = 'mychannel';
    return simple_client.invoke__p({
        channel_name: channel_name,
        invoking_user_name: 'Admin', // TEMP HACK
        invoking_user_org_name: 'org0',
        fcn: 'move',
        args: ['alice', 'bob', '20'],
        query_only: false
    });
})
.then(() => {
    const channel_name = 'mychannel';
    return Promise.all([
        simple_client.query__p({
            channel_name: channel_name,
            invoking_user_name: 'Admin', // TEMP HACK
            invoking_user_org_name: 'org0',
            fcn: 'query',
            args: ['alice']
        }),
        simple_client.query__p({
            channel_name: channel_name,
            invoking_user_name: 'Admin', // TEMP HACK
            invoking_user_org_name: 'org0',
            fcn: 'query',
            args: ['bob']
        })
    ]);
})
.then(balances => {
    logger.debug('balances = %j', balances);
    assert(balances[0] == '103' && balances[1] == '476', 'got incorrect balances from queries');
})
.then(() => {
    logger.debug('all calls behaved as expected.');
})
.catch(err => {
    logger.error('CAUGHT UNHANDLED ERROR: ', err);
    process.exit(1);
});
