var buster = require('buster');
var ok = buster.referee.assert;
var _ = require('underscore');
var stream = require('../lib/riffle');


var after = function (times, cb) {
  var i = 0;
  return function () {
    i++;
    if (i >= times) cb();
  };
};

buster.testCase('Stream API', {
  setUp : function () {
    this.timeout = 10000;
  },

  'Stream, invoke, onOutput': function (cb) {
    var start = after(1, cb);
  
    var s = stream()
      .onOutput(function (a) {
        ok(a.args[0] === 2, 'onOutput correctly receives value passed to invoked stream');
        start();
      });
    setTimeout(function () { s.invoke(2); }, 100);
  },

  'Repeat invoke': function (cb) {
    var start = after(1, cb);
    var seen = new Array(6);
    var s = stream()
      .onOutput(function (x) {
        seen[x.args[0]] = true;
        ok(x.args[0] === 3 || x.args[0] === 6, 'onOutput correctly receives value passed to invoked stream');
        if (seen[6] && seen[3]) start();
      });
    s.invoke(6);
    s.invoke(3);
  },

  'Invoke should send each argument to stream in its own event loop': function (cb) {
    var start = after(1, cb); // TODO how to error if called more than expecting?
    
    var s = stream()
      .onOutput(function () {
        ok(true);
        start();
      });
    s.invoke(6, 5, 4, 3, 2, 1);
    setTimeout(function () { start(); }, 500);
  },

  'Multiple input streams funnel together': function (cb) {
    var start = after(1, cb);
    var a = stream();
    var b = stream();
    var seen = new Array(6);
    var s = stream()
      .onOutput(function (_x) {
        var x = _x.args[0];
        seen[x] = true;
        ok(x === 3 || x === 4, 'onOutput correctly receives value through chain of streams');
        if (seen[3] && seen[4]) {
          start();
        }
      });
    s.input(a);
    s.input(b);
    a.invoke(3);
    b.invoke(4);
  },

  'Multiple input streams funnel together (array argument)': function (cb) {
    var start = after(1, cb);
    var a = stream();
    var b = stream();
    var seen = new Array(6);
    var s = stream()
      .onOutput(function (_x) {
        var x = _x.args[0];
        seen[x] = true;
        ok(x === 3 || x === 4, 'onOutput correctly receives value through chain of streams');
        if (seen[3] && seen[4]) {
          start();
        }
      });
    s.input([a, b]);
    a.invoke(3);
    b.invoke(4);
  },

  'Multiple identical input streams de-duped': function (cb) {
    var start = after(1, cb);
    var a = stream();
    var seen = 0;
    var s = stream()
      .onOutput(function (_x) {
        var x = _x.args[0];
        if (x === 2) {
          seen++;
        }
        ok(true, 'onOutput correctly receives value through chain of streams');
        if (x !== 2 && seen === 1) {
          start();
        }
      });
    s.input([a, a]);
    a.invoke(2);
    setTimeout(function () { a.invoke(3); }, 3000);
  },

  'Input with non-stream arguments should be ignored': function (cb) {
    var start = after(1, cb);
    var a = stream();
    var seen = 0;
    var s = stream()
      .onOutput(function (_x, _y) {
        var x = _x.args[0];      
        ok(x === 2 && typeof _y === 'undefined', 'onOutput correctly receives value through chain of streams');
      });
    s.input(a);
    s.input(3, 1);
    a.invoke(2);
    setTimeout(function () { start(); }, 500);
  },

  'Replace existing inputs by calling input': function (cb) {
    var start = after(1, cb);
    var a = stream();
    var b = stream();
    var c = stream();
    var seen = 0;
    var s = stream()
      .onOutput(function (_x, _y) {
        var x = _x.args[0];
        ok(typeof _y === 'undefined', 'onOutput correctly receives value through chain of streams');
        if (x === 1) return seen++;
        if (x === 2) return seen++;
        if (x === 3) return seen++;
        return null;
      });
    s.input([a, b]);
    s.input(c);
    
    setTimeout(function () { a.invoke(1); }, 50);
    setTimeout(function () { b.invoke(2); }, 50);
    setTimeout(function () { c.invoke(3); }, 50);
    setTimeout(function () { ok(seen === 3, 'onOutput correctly unions all streams'); start(); }, 500);
  },

  'Multiple onOutput': function (cb) {
    var start = after(3, cb);
    var p = stream();
    var s = stream()
        .onOutput(function(a) {
          ok(a.args[0] === 2, 'First onOutput receives value passed to invoked stream');
          start();
        })
        .onOutput(function(a) {
          ok(a.args[0] === 2, 'Second onOutput receives value passed to invoked stream');
          start();
        });
    p.input(s)
        .onOutput(function(a) {
          ok(a.args[0] === 2, 'onOutput receives value passed to dependent stream');
          start();
        });
    setTimeout(function () { s.invoke(2); }, 100);
  },

  'On onOutput exception, crash interal to stream, execute other onOutputs (should never happen)': function(cb) {
    var start = after(3, cb);
    try {
      var s = stream()
        .onOutput(function (a) {
          start();
          throw "test";
        })
        .onOutput(function (a) {
          ok(true, 'Second onOutput receives value passed to invoked stream when first onOutput throws an exception');
          start();
        });
      setTimeout(function () {
        try {
          s.invoke('a');
        } catch (e) {
          ok(false, 'Invoking scope does not catch an exception thrown in onOutput');
        }
      }, 50);
    } catch (e) {
      ok(false, 'Stream construct scope does not catch an exception thrown in onOutput');
    }
    setTimeout(function () {
      start();
    }, 100);
  },

  'Multiple input streams to multiple ports': function (cb) {
    var start = after(1, cb);
    var a = stream();
    var b = stream();
    var _a;
    var _b;
    var s = stream(function (output, a, b) {
      _a = _a || a;
      _b = _b || b;
      if (_a && _b) {
        ok((_a + _b) === 7, 'Stream received values from multiple input ports');
        start();
      }
    });
    s.input(a, 0);
    s.input(b, 1);
    a.invoke(3);
    b.invoke(4);
  },
  
  '// Multiple input streams to single port, 2': function () {
    var start = sinon.spy();
    var a = stream();
    var b = stream();
    var seen = new Array(6);
    var s = stream(function (output, x) {
      seen[x] = true;
      ok(true, 'Stream received value a single time');
      if (seen[3] && seen[4]) {
        start();
      }
    });
    s.input([a, b]);
    a.invoke(3);
    b.invoke(4);
  },

  '// Exception, crash interally. onOutput still runs, 1': function() {
    try {
      var s = stream(function (output, a) {
        output(a);
        throw "test";
      })
      .onOutput(function (a) {
        ok(a === 'a', 'onOutput receives value correctly when stream throws an exception');
      });
      setTimeout(function () {
        try {
          s.invoke('a');
        } catch (e) {
          ok(false, 'Invoking scope does not catch an exception thrown in stream function');
        }
      }, 50);
    } catch (e) {
      ok(false, 'Stream constructor scope does not catch an exception thrown in stream function');
    }
    setTimeout(function () {
      start();
    }, 100);
  },

  '// Stream output becomes onOutput param, 1': function () {
    var a = stream();
    var b = stream();
    var _a;
    var _b;
    var plus = stream(function (output, a, b) {
      _a = _a || a;
      _b = _b || b;
      output(_a + _b, 'foo');
    });
    plus.input(a, b);
    plus.onOutput(function (result, foo) {
      if (isNaN(result)) { return; }
      ok(result === 5 && foo === 'foo', 'Stream function correctly passes multiple values to onOutput via output continuation function');
      start();
    });
    setTimeout(function () { a.invoke(2) }, 100);
    setTimeout(function () { b.invoke(3) }, 100);
  },

  '// offOutput unregisters onOutput callback, 1': function () {
    var handler = function () {
      ok(false, 'Handler should not be called after being unbound by offOutput');
    };
    var a = stream();
    a.onOutput(handler);
    a.offOutput(handler);

    setTimeout(function () { a.invoke() }, 50);
    setTimeout(function () {
      ok(true, 'After a period of time elapses, handler should not be called because it was unbound by offOutput');
      start();
    }, 100);
  },

  '// Composition, 1': function () {
    var a = stream();
    var b = stream();
    var c = stream();
    var plus = (function () {
      var _a;
      var _b;
      return stream(function plus(output, a, b) {
        _a = _a || a;
        _b = _b || b;
        output(_a + _b);
      });
    }());
    var times = (function () {
      var _a;
      var _b;
      return stream(function times(output, a, b) {
        _a = _a || a;
        _b = _b || b;
        output(_a * _b);
      });
    }());
    times.input(c, plus.input(a, b));
    times.onOutput(function (result) {
      if (isNaN(result)) { return; }
      ok(result === 20, 'onOutput correctly receives value of composed math operations');
      start();
    });
    setTimeout(function () { a.invoke(2) }, 100);
    setTimeout(function () { b.invoke(3) }, 100);
    setTimeout(function () { c.invoke(4) }, 100);
  }
});

buster.testCase('Pathologically streaming', {

  '// Join onOutput, 2': function () {
    var a = stream.promise();
    var b = stream.promise();
    var abJoin = stream.join(a, b);
    setTimeout(function () { a.fulfill(2); }, 50);
    setTimeout(function () { b.fulfill(3); }, 100);
    abJoin.onOutput(function(aVal, bVal) {
        ok(aVal === 2, 'Join passes the first parameter');
        ok(bVal === 3, 'Join passes the second parameter');
        start();
    });
    stop(3000);
  },

  '// Join zero arguments, 1': function () {
    var z = stream.join();
    z.onOutput(function (aVal) {
        ok(false, 'Joining nothing should not invoke onOutput handlers');
    });
    setTimeout(function () {
        ok(true, 'Joining nothing should not invoke output handlers');
        start();
    }, 500);
    stop(3000);
  },

  '// Function composition, 1': function () {
    var a = stream();
    var b = stream();
    var c = stream();
    var plus = stream.func(function (a, b) {
        return a + b;
    });
    var times = stream.func(function (a, b) {
        return a * b;
    });
    var result = times(c, plus(a, b));
    result.onOutput(function (result) {
            if (isNaN(result)) { return; }
            ok(result === 20, 'onOutput correctly receives value of composed math operations');
            start();
        });
    setTimeout(function () { a.invoke(2) }, 100);
    setTimeout(function () { b.invoke(3) }, 100);
    setTimeout(function () { c.invoke(4) }, 100);
    stop(3000);
  },

  '// Mixed parameter types, 1': function () {
    var a = stream.promise();
    var b = 3;
    var c = stream();
    var plus = stream.func(function (a, b) {
        return a + b;
    });
    var times = stream.func(function (a, b) {
        return a * b;
    });
    var result = times(c, plus(a, b));
    result.onOutput(function (result) {
        if (isNaN(result)) { return; }
        ok(result === 20, 'onOutput correctly receives value of composed math operations');
        start();
    });
    setTimeout(function () { a.fulfill(2) }, 100);
    setTimeout(function () { c.invoke(4) }, 100);
    stop(3000);
  }
});
