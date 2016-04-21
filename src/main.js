'use strict';

function processS3Events(event, modules, callback=null) {
  const s3 = modules.s3;
  const request = modules.request;
  const moment = modules.moment;

  var r = event.Records[0];

  console.log('start main');
  var params = {
    Bucket: r.s3.bucket.name,
    Key: r.s3.object.key
  };
  s3.getObject(params, (error, data)=>{
    
    console.log('callback');
    if (error)
      console.log(error, error.stack);
    else {

      let lines = data.Body.toString().split("\n");
      console.log(lines[0]);
      callback(params.Key, lines);
    }
  });

  console.log('end of main');
  return true;
}

// 2016-02-19T07:51:48.940573Z bluegreen-haproxy-live 54.238.207.205:42994 10.67.2.23:13497 0.002432 0.000011 0.000013 - - 185 8386

const ELBLogFormat = /^(\S+) (\S+) (\S+):(\S+) (\S+):(\S+) (\S+) (\S+) (\S+) (\S+) (\S+) (\S+) (\S+)/;

function parseELBLog(modules, key, line) {
  let ret = {};
  if (line === '')
    return ret;
  const matched = line.match(ELBLogFormat);
  if (matched) {
    let [_, datetime, elbname, srcaddr, srcport, destaddr, destport, t1, t2, t3, x, y, z, size] = matched;
    ret.datetime = datetime;
    const m = modules.moment.utc(datetime);
    ret.timestamp = m.unix();
    ret.srcaddr = srcaddr;
    ret.srcport = srcport;
    ret.elbname = elbname;
    ret.destaddr = destaddr;
    ret.destport = destport;
    ret.request_time = t1;
    ret.size = size;
  } else {
    console.log(`log didn't match regexp '${line}'`);
  }
  return ret;
}

const S3LogFormat = /^(\S+) (\S+) \[(.+)\] (\S+) (\S+) (\S+) (\S+) (\S+) "([^"]+)" (\S+) (\S+) (\d+|\-) (\d+|\-) (\d+|\-) (\d+|\-) "([^"]+)" "([^"]+)" (\S+).*/;

function parseDateTime(moment, t) {
  const m = moment.utc(t, 'DD/MMM/YYYY:HH:mm:ss +0000');
  return m;
}

function parseS3Log(modules, key, line) {
  let ret = {};
  if (line === '')
    return ret;

  const matched = line.match(S3LogFormat);
  // console.log(matched);
  if (matched) {
    let[ _, bucketOwner, bucket, time, remoteAddr, requester, requestId, operation, path, request, status, errorCode, sent, size, totalTime, turnAroundTime, referrer, userAgent, versionId] = matched;
    ret.bucketOwner = bucketOwner;
    ret.bucket = bucket;
    const t = parseDateTime(modules.moment, time);
    ret.timestamp = t.unix();
    ret['@timestamp'] = t.format();
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
}

function processFile(event, context, modules, config, key, tag, lines, parseFunc){
  const request = modules.request;
  const data = lines.map((line)=>parseFunc(modules, key, line)).filter((h)=>h.timestamp);

  const options = {
    uri: `${config.fluentd_url}${tag}`,
    headers: {
      "Content-Type": "application/json",
      "Authorization": config.authorization
    },
    body: JSON.stringify(data)
  };
  if (data.length > 0) {
    console.log(`sending ${data.length} data to fluentd`); request.post(options, (error, response, body)=>{
      if (!error && response.statusCode == 200) {
        //console.log(`success response=${JSON.stringify(response)} body=${body}`);
        context.succeed('success');
      } else {
        console.log(`error ${error}`);
        console.log(response.statusCode);
        context.fail(`fluentd api returns error ${error}`);
      }
    });
  } else {
    console.log(`No data to send to Insights`);
    context.succeed('end');
  }
}

function sendAwsLogsToFluentd(event, context, modules, config) {
  console.log(config);
  processS3Events(event, modules, (key, lines)=>{
    let processed = false;
    config.parsers.forEach((a)=>{
      let [matcher, parseFunc, tag] = a;
      if (matcher.exec(key)) {
        processFile(event, context, modules, config, key, tag, lines, parseFunc);
        processed = true;
      }
    });
    if (!processed)
      context.fail(`unknown key ${key}`);
  });
}

exports.processS3Events = processS3Events;
exports.parseS3Log = parseS3Log;
exports.parseELBLog = parseELBLog;
exports.sendAwsLogsToFluentd = sendAwsLogsToFluentd;
