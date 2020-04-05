const aws = require('aws-sdk');
const crypto = require('crypto');

const dynamo = new aws.DynamoDB();

const tableName = 'gps';

const authenticateUser = (email, password) => {
    return new Promise((resolve, reject) => {
        const params = {
            Key: {
                "email": {
                    S: email
                }
            },
            TableName: tableName
        }

        dynamo.getItem(params, async (err, res) => {
            const item = res.Item;
            if (item){
                const now = new Date();
                if (item.password.S === crypto.createHash('sha256').update(password).digest("hex")) {
                    resolve(true)
                } else {
                    console.log(`Wrong password by ${email}`);
                    reject(false);
                }
            } else {
                console.log(`No user found with email ${email}`);
                reject(false);
            }
        });
    });
}

const lookupUser = email => {
    return new Promise((resolve, reject) => {
        const params = {
            Key: {
                "email": {
                    S: email
                }
            },
            TableName: tableName
        }

        dynamo.getItem(params, async (err, res) => {
            const item = res.Item;
            if (item){
                resolve(true);
            } else {
                console.log(`No user found with email ${email}`);
                reject(false);
            }
        });
    });
};

exports.handler = async (event, context, callback) => {

    var user;

    console.log('Received event', event);

    if ( event.triggerSource === "UserMigration_Authentication" ) {

        // authenticate the user with your existing user directory service
        user = await authenticateUser(event.userName, event.request.password);
        if ( user ) {
            event.response.userAttributes = {
                "email": event.userName,
                "email_verified": "true"
            };
            event.response.finalUserStatus = "CONFIRMED";
            event.response.messageAction = "SUPPRESS";
            context.succeed(event);
        }
        else {
            // Return error to Amazon Cognito
            callback("Bad password");
        }
    } else if ( event.triggerSource === "UserMigration_ForgotPassword" ) {

        // Lookup the user in your existing user directory service
        user = await lookupUser(event.userName);
        if ( user ) {
            event.response.userAttributes = {
                "email": event.userName,
                // required to enable password-reset code to be sent to user
                "email_verified": "true"
            };
            event.response.messageAction = "SUPPRESS";
            context.succeed(event);
        }
        else {
            // Return error to Amazon Cognito
            callback("Bad password");
        }
    } else {
        // Return error to Amazon Cognito
        callback("Bad triggerSource " + event.triggerSource);
    }
};
