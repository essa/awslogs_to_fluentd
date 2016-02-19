
const zlib = require('zlib');
const moment = require('moment');
const assert = require('power-assert');
const sinon = require('sinon');
const sprintf = require('sprintf');


describe('testPowerAssert', ()=>{
  it('should fail', ()=>{
    let a = 1;
    let b = 2;
    let c = 3;
    assert.deepEqual([1, 5], [a, b + c])
  })
});

/*
describe('', ()=>{
  it('', ()=>{
  });
});
*/

const SampleEvent =
{
  "Records": [
        {
            "eventVersion": "2.0",
            "eventSource": "aws:s3",
            "awsRegion": "ap-northeast-1",
            "eventTime": "2016-01-12T03:46:05.900Z",
            "eventName": "ObjectCreated:Put",
            "userIdentity": {
                "principalId": "A2XXXXXXXXXX"
            },
            "requestParameters": {
                "sourceIPAddress": "10.115.xx.yy"
            },
            "responseElements": {
                "x-amz-request-id": "307FA6227B18DA35",
                "x-amz-id-2": "XXXXXXX"
            },
            "s3": {
                "s3SchemaVersion": "1.0",
                "configurationId": "XXXXXXXXXX",
                "bucket": {
                    "name": "degica2-logs",
                    "ownerIdentity": {
                        "principalId": "XXXXXXXXX"
                    },
                    "arn": "arn:aws:s3:::degica2-logs"
                },
                "object": {
                    "key": "s3/logs/product-files/2016-01-12-03-46-05-XXXXXXXXXX",
                    "size": 5985,
                    "eTag": "e635396d7f406870ff75ea9670d8aaf8",
                    "sequencer": "00569476FDD402F1B6"
                }
            }
        }
    ]
};

const SampleData =`
1ad5a20070ef4d665151672345b1a37578142c1f6473945ac68b0992ecced46d degica-downloads [09/Jan/2016:23:20:26 +0000] 202.134.26.9 - DFF22B6C434A325E REST.GET.OBJECT RPGMV_W_TRIAL.zip "GET /degica-downloads/RPGMV_W_TRIAL.zip HTTP/1.1" 200 - 126965445 1143005032 195454 170 "http://www.rpgmakerweb.com/download/free-trials/trial-rpg-maker-mv/thankyou-mv" "Mozilla/5.0 (Windows NT 6.0; rv:43.0) Gecko/20100101 Firefox/43.0" -
1ad5a20070ef4d665151672345b1a37578142c1f6473945ac68b0992ecced46d degica-downloads [09/Jan/2016:23:02:32 +0000] 151.73.38.224 - 9D450EE7E819B7D2 REST.GET.OBJECT RPGMV_W_TRIAL.zip "GET /degica-downloads/RPGMV_W_TRIAL.zip HTTP/1.1" 200 - 42693277 1143005032 10905067 121 "http://www.rpgmakerweb.com/download/free-trials/trial-rpg-maker-mv/thankyou-mv" "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/47.0.2526.106 Safari/537.36" -
1ad5a20070ef4d665151672345b1a37578142c1f6473945ac68b0992ecced46d degica-downloads [09/Jan/2016:22:36:28 +0000] 212.252.81.92 - 91A0B205F5957B97 REST.GET.OBJECT RPGMV_W_TRIAL.zip "GET /degica-downloads/RPGMV_W_TRIAL.zip HTTP/1.1" 200 - 1143005032 1143005032 1741551 109 "http://www.rpgmakerweb.com/download/free-trials/trial-rpg-maker-mv/thankyou-mv" "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/47.0.2526.106 Safari/537.36" -
1ad5a20070ef4d665151672345b1a37578142c1f6473945ac68b0992ecced46d degica-prod.cms-assets [22/Jan/2016:05:00:29 +0000] 54.239.196.19 - 7D1852D9179E4E26 REST.GET.OBJECT steam-degica-assets/product_sales/preview_images/thumb/DOTABlindboxPins-8b.png "GET /steam-degica-assets/product_sales/preview_images/thumb/DOTABlindboxPins-8b.png HTTP/1.1" 304 - - 18965 26 - "-" "Amazon CloudFront" -
`;


describe('AwsLogsToFluentd#main', ()=>{
  const main = require('./main')
  const nullCallback = ()=>true;
  const modules = {
    s3: {
      getObject: (params, callback)=>true
    },
    moment: moment,
    request: {
      post: (options, callback)=>callback()
    }
  };

  describe('#processS3Events', ()=>{

    it('should define function', ()=>{
      assert.equal('function', typeof main.processS3Events);
    });
    it('should return true', ()=>{
      assert.equal(true, main.processS3Events(SampleEvent, modules, ()=>true));
    });

    it('should call s3.getObject', ()=>{
      let spy = sinon.spy(modules.s3, 'getObject');
      main.processS3Events(SampleEvent, modules, nullCallback);

      assert(spy.called);
      let s = SampleEvent.Records[0].s3;
      let arg = spy.lastCall.args[0];
      assert.equal(s.object.key, arg.Key);
      assert.equal(s.bucket.name, arg.Bucket);
      spy.restore();
    });

    describe('callback', ()=>{
      let spyCallback = null;
      beforeEach(()=>{
        sinon.stub(modules.s3, 'getObject', (param, callback)=>{
          callback(null, { Body: SampleData } );
        });
        spyCallback = sinon.spy();
      });
      afterEach(()=> modules.s3.getObject.restore());

      it('should call callback', ()=>{
        main.processS3Events(SampleEvent, modules, spyCallback);
        assert(spyCallback.called);
      });

      it('should call callback with lines', ()=>{
        main.processS3Events(SampleEvent, modules, spyCallback);
        assert(spyCallback.called);

        let s = SampleEvent.Records[0].s3;
        let lines = SampleData.split("\n");
        const [k, l] = spyCallback.getCall(0).args ;
        assert.equal(s.object.key, k);
        assert.deepEqual(lines, l);
      });
    })
  });

  describe('#parseS3Log', ()=>{
    const key ='s3/logs/product-files/2016-01-12-03-46-05-XXXXXXXXXX';

    it('should define function', ()=>{
      assert.equal('function', typeof main.parseS3Log);
    });
    it('should return {} for null line', ()=>{
      assert.deepEqual({}, main.parseS3Log(modules, key, ''));
    });
    it('should parse s3 log', ()=>{
      const line = '1ad5a20070ef4d665151672345b1a37578142c1f6473945ac68b0992ecced46d degica-downloads [09/Jan/2016:22:36:28 +0000] 212.252.81.92 - 91A0B205F5957B97 REST.GET.OBJECT RPGMV_W_TRIAL.zip "GET /degica-downloads/RPGMV_W_TRIAL.zip HTTP/1.1" 200 - 1143005032 1143005032 1741551 109 "http://www.rpgmakerweb.com/download/free-trials/trial-rpg-maker-mv/thankyou-mv" "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/47.0.2526.106 Safari/537.36" -'
      const ret = main.parseS3Log(modules, key, line);
      assert.equal(key, ret.key);
      assert.equal('1ad5a20070ef4d665151672345b1a37578142c1f6473945ac68b0992ecced46d', ret.bucketOwner);
      assert.equal('degica-downloads', ret.bucket);

      const d = moment.utc('2016-01-09 22:36:28');
      assert.equal(d.unix(), ret.timestamp);

      assert.equal('212.252.81.92', ret.remoteAddr);
      assert.equal('-', ret.requester);
      assert.equal('91A0B205F5957B97', ret.requestId);
      assert.equal('REST.GET.OBJECT', ret.operation);
      assert.equal('RPGMV_W_TRIAL.zip', ret.path);
      assert.equal('GET /degica-downloads/RPGMV_W_TRIAL.zip HTTP/1.1', ret.request);
      assert.equal('200', ret.status);
      assert.equal('-', ret.errorCode);
      assert.equal(1143005032, ret.sent);
      assert.equal(1143005032, ret.size);
      assert.equal(1741551, ret.totalTime);
      assert.equal(109, ret.turnAroundTime);
      assert.equal('http://www.rpgmakerweb.com/download/free-trials/trial-rpg-maker-mv/thankyou-mv', ret.referrer);
      assert.equal('Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/47.0.2526.106 Safari/537.36', ret.userAgent);
      assert.equal('-', ret.versionId);
    });
  });

  describe('#sendAwsLogsToFluentd', ()=>{
    const context = {
      succeed: ()=>true,
      fail: ()=>true
    };
    beforeEach(()=>{
      sinon.stub(modules.request, 'post', (options, callback)=>{
        callback(null, {responseCode: 200});
      });
      sinon.stub(modules.s3, 'getObject', (param, callback)=>{
        callback(null, { Body: SampleData } );
      });
    });
    afterEach(()=>{
      modules.request.post.restore();
      modules.s3.getObject.restore();
    });

    it('should define function', ()=>{
      assert.equal('function', typeof main.sendAwsLogsToFluentd);
    });

    it('should send s3logs to Insights', ()=>{
      const config = {
        fluentd_url: 'http://fluentd.local/',
        parsers: [
          [ /s3.*/, main.parseS3Log, 'test.abc' ]
        ]
      };

      main.sendAwsLogsToFluentd(SampleEvent, context, modules, config);
      const post = modules.request.post;
      assert(post.called);
      const [options, callback] = post.getCall(0).args;
      assert.equal('http://fluentd.local/test.abc', options.uri);
    });
  });
});
