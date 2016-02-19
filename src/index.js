
console.log('Loading function');
var AWS = require('aws-sdk')
 , moment = require('moment')
 , request = require('request');

var main = require('./main');
var insightsConfig = require('./config');

exports.handler = function(event, context) {
  // console.log('Received event:', JSON.stringify(event, null, 2));

  if (event.Records && event.Records[0] && event.Records[0].eventSource === "aws:s3") {
    var r = event.Records[0];
    var s3 = new AWS.S3({ region: r.awsRegion });
    var modules = {
      s3: s3,
      moment: moment,
      request: request
    };
    main.sendS3logToInsights(event, context, modules, insightsConfig);
  } else {
    if (event.source === 'aws.events') {
      const { accountId, queryKey } = insightsConfig;
      const query = "SELECT sum(sent) FROM S3Logs  FACET remoteAddr SINCE 2 hours ago";
      const options = {
        uri: `https://insights-api.newrelic.com/v1/accounts/${accountId}/query?nrql=${encodeURIComponent(query)}`,
        headers: {
          "Content-Type": "application/json",
           "X-Query-Key": queryKey
        }
      };
      request.get(options, (error, response, body)=>{
        if (!error && response.statusCode == 200) {
          // console.log(`success response=${JSON.stringify(response)} body=${body}`);
          const j = JSON.parse(body);
          const sumSentMax = j.facets[0].results[0].sum;
          console.log(`sum=${sumSentMax}`);
          if (sumSentMax > 1024 * 1024 * 1024) {
            const msg = `s3 traffic is ${sumSentMax} from ${j.facets[0].name}`;
            const {slackOpts} = insightsConfig;
            const options = {
              uri: 'https://slack.com/api/chat.postMessage',
              form: {
                token: slackOpts.token,
                channel: slackOpts.channel,
                text: msg,
                username: slackOpts.username
              }
            };
            request.post(options, (error, response, body)=>{
              console.log(`posted to slack ${response}`);
            });
          };
          context.succeed('success');
        } else {
          console.log(`error ${error}`);
          console.log(`response=${JSON.stringify(response)}`);
          context.fail(`Insights api returns error ${error}`);
        }
      });
    } else {
      console.log(event);
      context.fail('unknown event, ignored');
    }
  }
};
