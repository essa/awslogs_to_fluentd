
// rename this file to lambda-config.js and edit it

module.exports = {
  region: 'ap-northeast-1',
  handler: 'index.handler',
  role: 'arn:aws:iam::999999999999:role/xxxxxxxxxxxxxxxx',
  functionName: 'AwsLogsToFluentd',
  timeout: 10
}
