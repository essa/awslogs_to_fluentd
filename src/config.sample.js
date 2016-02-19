'use strict';

var main = require('./main');

exports.fluentd_url = 'http://aggregator.fluentd.bcn/';
exports.parsers = [
  [ /s3.*/, main.parseS3Log, 's3']
];
