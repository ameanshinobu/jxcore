// Copyright & License details are available under JXCORE_LICENSE file


var domain = require('domain');
var http = require('http');
var assert = require('assert');
var common = require('../common.js');

var objects = { foo: 'bar', baz: {}, num: 42, arr: [1,2,3] };
objects.baz.asdf = objects;

var serverCaught = 0;
var clientCaught = 0;
var disposeEmit = 0;

var server = http.createServer(function(req, res) {
  var dom = domain.create();
  req.resume();
  dom.add(req);
  dom.add(res);

  dom.on('error', function(er) {
    serverCaught++;
    console.log('horray! got a server error', er);
    // try to send a 500.  If that fails, oh well.
    res.writeHead(500, {'content-type':'text/plain'});
    res.end(er.stack || er.message || 'Unknown error');
  });

  var data;
  dom.run(function() {
    console.log("url", req.url);
    data = req.url;
    // this line will throw if you pick an unknown key
    assert(data !== undefined, 'Data should not be undefined');

    res.writeHead(200);
    res.end(data);
  });
});

server.listen(common.PORT, next);

function next() {
  console.log('listening on localhost:%d', common.PORT);

  // now hit it a few times
  var dom = domain.create();
  var requests = 0;
  var responses = 0;

  makeReq('/');
  makeReq('/foo');
  makeReq('/arr');
  makeReq('/baz');
  makeReq('/num');

  function makeReq(p) {
    requests++;

    var dom = domain.create();
    dom.on('error', function(er) {
      clientCaught++;
      console.log('client error', er);
      req.socket.destroy();
    });

    var req = http.get({ host: 'localhost', port: common.PORT, path: p });
    dom.add(req);
    req.on('response', function(res) {
      responses++;
      console.error('requests=%d responses=%d', requests, responses);
      if (responses === requests) {
        console.error('done, closing server');
        // no more coming.
        server.close();
      }

      dom.add(res);
      var d = '';
      res.on('data', function(c) {
        d += c;
      });
      res.on('end', function() {
        console.log('data received: ', d);
      });
    });
  }
}

process.on('exit', function() {
  assert.equal(serverCaught, 0);
  assert.equal(clientCaught, 0);
  console.log('ok');
});