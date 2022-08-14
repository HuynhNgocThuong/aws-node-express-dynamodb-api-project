/* istanbul ignore next */
if (!process.env.AWS_REGION) {
  process.env.AWS_REGION = 'us-east-1';
}

/* istanbul ignore next */
if (!process.env.DYNAMODB_NAMESPACE) {
  process.env.DYNAMODB_NAMESPACE = 'dev';
}
// const AWS = require('aws-sdk');
import AWS from 'aws-sdk';

// In offline mode, use DynamoDB local server
let DocumentClient = null;

/* istanbul ignore next */
if (process.env.IS_OFFLINE) {
  AWS.config.update({
    region: 'localhost',
    endpoint: 'http://localhost:8000',
  });
}

DocumentClient = new AWS.DynamoDB.DocumentClient();

async function ping() {
  return envelop({
    pong: new Date(),
    AWS_REGION: process.env.AWS_REGION,
    DYNAMODB_NAMESPACE: process.env.DYNAMODB_NAMESPACE,
  });
}

async function purgeData() {
  await purgeTable('users', 'username');
  await purgeTable('articles', 'slug');
  await purgeTable('comments', 'id');
  return envelop('Purged all data!');
}

function getTableName(aName) {
  return `realworld-${process.env.DYNAMODB_NAMESPACE}-${aName}`;
}

function getDocumentClient() {
  return DocumentClient;
}

function envelop(res, statusCode = 200) {
  let body;
  if (statusCode == 200) {
    body = JSON.stringify(res, null, 2);
  } else {
    body = JSON.stringify({ errors: { body: [res] } }, null, 2);
  }
  return {
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body,
  };
}

async function purgeTable(aTable, aKeyName) {
  const tableName = getTableName(aTable);
  if (!tableName.includes('dev') && !tableName.includes('test')) {
    console.log(
      `WARNING: Table name [${tableName}] ` +
        `contains neither dev nor test, not purging`
    );
    return;
  }
  const allRecords = await DocumentClient.scan({
    TableName: tableName,
  }).promise();
  const deletePromises = [];
  for (let i = 0; i < allRecords.Items.length; ++i) {
    const recordToDelete = { TableName: tableName, Key: {} };
    recordToDelete.Key[aKeyName] = allRecords.Items[i][aKeyName];
    deletePromises.push(DocumentClient.delete(recordToDelete).promise());
  }
  await Promise.all(deletePromises);
}

export { ping, purgeData, getDocumentClient, getTableName, envelop };
