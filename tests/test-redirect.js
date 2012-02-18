var server = require('./server')
  , assert = require('assert')
  , request = require('../main.js')
  , Cookie = require('../vendor/cookie')
  , Jar = require('../vendor/cookie/jar')

var s = server.createServer()

s.listen(s.port, function () {
  var server = 'http://localhost:' + s.port;
  var hits = {}
  var passed = 0;

  bouncer(301, 'temp')
  bouncer(302, 'perm')
  bouncer(302, 'nope')

  function bouncer(code, label) {
    var landing = label+'_landing';

    s.on('/'+label, function (req, res) {
      hits[label] = true;
      res.writeHead(code, {'location':server + '/'+landing})
      res.end()
    })

    s.on('/'+landing, function (req, res) {
      if (req.method !== 'GET') { // We should only accept GET redirects
        console.error("Got a non-GET request to the redirect destination URL");
        resp.writeHead(400);
        resp.end();
        return;
      }
      // Make sure the cookie doesn't get included twice, see #139:
      assert.equal(req.headers.cookie, 'foo=bar; quux=baz');
      hits[landing] = true;
      res.writeHead(200)
      res.end(landing)
    })
  }

  // Permanent bounce
  var jar = new Jar()
  jar.add(new Cookie('quux=baz'))
  request({uri: server+'/perm', jar: jar, headers: {cookie: 'foo=bar'}}, function (er, res, body) {
    try {
      assert.ok(hits.perm, 'Original request is to /perm')
      assert.ok(hits.perm_landing, 'Forward to permanent landing URL')
      assert.equal(body, 'perm_landing', 'Got permanent landing content')
      passed += 1
    } finally {
      done()
    }
  })

  // Temporary bounce
  request({uri: server+'/temp', jar: jar, headers: {cookie: 'foo=bar'}}, function (er, res, body) {
    try {
      assert.ok(hits.temp, 'Original request is to /temp')
      assert.ok(hits.temp_landing, 'Forward to temporary landing URL')
      assert.equal(body, 'temp_landing', 'Got temporary landing content')
      passed += 1
    } finally {
      done()
    }
  })

  // Prevent bouncing.
  request({uri:server+'/nope', jar: jar, headers: {cookie: 'foo=bar'}, followRedirect:false}, function (er, res, body) {
    try {
      assert.ok(hits.nope, 'Original request to /nope')
      assert.ok(!hits.nope_landing, 'No chasing the redirect')
      assert.equal(res.statusCode, 302, 'Response is the bounce itself')
      passed += 1
    } finally {
      done()
    }
  })

  // Should not follow post redirects by default
  request.post({uri:server+'/temp', jar: jar, headers: {cookie: 'foo=bar'}}, function (er, res, body) {
    try {
      assert.ok(hits.temp, 'Original request is to /temp')
      assert.ok(!hits.temp_landing, 'No chasing the redirect when post')
      assert.equal(res.statusCode, 301, 'Response is the bounce itself')
      passed += 1
    } finally {
      done()
    }
  })

  // Should follow post redirects when followAllRedirects true
  request.post({uri:server+'/temp', followAllRedirects:true, jar: jar, headers: {cookie: 'foo=bar'}}, function (er, res, body) {
    try {
      assert.ok(hits.temp, 'Original request is to /temp')
      assert.ok(hits.temp_landing, 'Forward to temporary landing URL')
      assert.equal(body, 'temp_landing', 'Got temporary landing content')
      passed += 1
    } finally {
      done()
    }
  })

  request.post({uri:server+'/temp', followAllRedirects:false, jar: jar, headers: {cookie: 'foo=bar'}}, function (er, res, body) {
    try {
      assert.ok(hits.temp, 'Original request is to /temp')
      assert.ok(!hits.temp_landing, 'No chasing the redirect')
      assert.equal(res.statusCode, 301, 'Response is the bounce itself')
      passed += 1
    } finally {
      done()
    }
  })

  var reqs_done = 0;
  function done() {
    reqs_done += 1;
    if(reqs_done == 6) {
      console.log(passed + ' tests passed.')
      s.close()
    }
  }
})