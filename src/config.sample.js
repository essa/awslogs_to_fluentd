"use strict";

var main = require('./main');

exports["ap-northeast-1"] = {
  fluentd_url:  'http://fluentd.xxxxxx-production.local:1234/',
  parsers:  [
    [ /s3.*/, main.parseS3Log, 's3'],
    [ /elb.*/, main.parseELBLog, 'elb']
  ]
};

exports["us-east-1"] = {
  fluentd_url:  'http://fluentd.xxxxxx.degica.com:1234/',
  authorization: "Basic xxxxxxxxxxxxxxxxxx",
  parsers:  [
    [ /s3.*/, main.parseS3Log, 's3'],
  ]
};
