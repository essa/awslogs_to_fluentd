'use strict';


function processS3Events(event, modules, callback=null) {
  const s3 = modules.s3;
  const request = modules.request;
  const moment = modules.moment;

  console.log('start main');
  var r = event.Records[0];

  var params = {
    Bucket: r.s3.bucket.name,
    Key: r.s3.object.key
  };
  s3.getObject(params, (error, data)=>{
    if (error)
      console.log(err, err.stack);
    else {
      let lines = data.Body.toString().split("\n");
      callback(params.Key, lines);
    }
  });

  console.log('end of main');
  return true;
};

const S3LogFormat = /^(\S+) (\S+) \[(.+)\] (\S+) (\S+) (\S+) (\S+) (\S+) "([^"]+)" (\S+) (\S+) (\d+|\-) (\d+|\-) (\d+|\-) (\d+|\-) "([^"]+)" "([^"]+)" (\S+).*/;

function parseDateTime(moment, t) {
  const m = moment.utc(t, 'DD/MMM/YYYY:HH:mm:ss +0000');
  return m;
}

function parseS3Log(modules, key, line) {
  let ret = {};
  if (line == '')
    return ret;

  const matched = line.match(S3LogFormat);
  // console.log(matched);
  if (matched) {
    let[ _, bucketOwner, bucket, time, remoteAddr, requester, requestId, operation, path, request, status, errorCode, sent, size, totalTime, turnAroundTime, referrer, userAgent, versionId] = matched;
    ret.bucketOwner = bucketOwner;
    ret.bucket = bucket;
    const t = parseDateTime(modules.moment, time);
    ret.timestamp = t.unix();
    ret.datetime = t.format();
    ret.remoteAddr = remoteAddr;
    ret.requester = requester;
    ret.requestId = requestId;
    ret.operation = operation;
    ret.path = path;
    ret.request = request;
    ret.status = status;
    ret.errorCode = errorCode;
    ret.sent = parseInt(sent);
    ret.size = parseInt(size);
    ret.totalTime = parseInt(totalTime);
    ret.turnAroundTime = parseInt(turnAroundTime);
    ret.referrer = referrer;
    ret.userAgent = userAgent;
    ret.versionId = versionId;
    ret.key = key;
  } else {
    console.log(`log didn't match regexp '${line}'`);
  }
  return ret;
};

function processFile(event, context, modules, config, key, tag, lines, parseFunc){
  const request = modules.request;
  const data = lines.map((line)=>parseFunc(modules, key, line))
    .filter((r)=>r.key);

  const options = {
    uri: `${config.fluentd_url}${tag}`,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data)
  };
  if (data.length > 0) {
    console.log(`sending ${data.length} data to Insights`); request.post(options, (error, response, body)=>{
      if (!error && response.statusCode == 200) {
        //console.log(`success response=${JSON.stringify(response)} body=${body}`);
        context.succeed('success');
      } else {
        console.log(`error ${error}`);
        context.fail(`Insights api returns error ${error}`)
      }
    });
  } else {
    console.log(`No data to send to Insights`);
    context.succeed('end');
  }
}

function sendAwsLogsToFluentd(event, context, modules, config) {
  processS3Events(event, modules, (key, lines)=>{
    config.parsers.forEach((a)=>{
      let [matcher, parseFunc, tag] = a;
      if (matcher.exec(key)) {
        processFile(event, context, modules, config, key, tag, lines, parseFunc);
        return ;
      }
    })
    context.fail(`unknown key ${key}`)
  });
};

exports.processS3Events = processS3Events;
exports.parseS3Log = parseS3Log;
exports.sendAwsLogsToFluentd = sendAwsLogsToFluentd;
