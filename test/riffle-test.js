var buster = require('buster');
var ok = buster.referee.assert;
var _ = require('underscore');
var stream = require('../lib/riffle');

buster.testCase('Stream API', {
  'Stream, invoke, onOutput': function (cb) {
    var spy = this.spy();
  
    var s = stream()
      .onOutput(function (a) {
        ok(a.args[0] === 2, 'onOutput correctly receives value passed to invoked stream');
        spy();
      });
    setTimeout(function () {
      s.invoke(2);
    }, 100);
    setTimeout(function () {
      ok(spy.callCount, 1, 'Output only called once');
      cb();
    }, 200);
  },

  'Repeat invoke': function (cb) {
    var spy = this.spy();
    var seen = new Array(6);
    var s = stream()
      .onOutput(function (x) {
        seen[x.args[0]] = true;
        ok(x.args[0] === 3 || x.args[0] === 6, 'onOutput correctly receives value passed to invoked stream');
        if (seen[6] && seen[3]) spy();
      });
    s.invoke(6);
    s.invoke(3);
    setTimeout(function () {
      ok(spy.callCount, 1, 'Output only called once');
      cb();
    }, 200);
  },

  'Invoke should send each argument to stream in its own event loop': function (cb) {
    var spy = this.spy();
    var s = stream()
      .onOutput(function () {
        ok(true);
        spy();
      });
    s.invoke(6, 5, 4, 3, 2, 1);
    setTimeout(function () {
      ok(spy.callCount, 1, 'Output only called once');
      cb();
    }, 200);
  },

  'Multiple input streams funnel together': function (cb) {
    var spy = this.spy();
    var a = stream();
    var b = stream();
    var seen = new Array(6);
    var s = stream()
      .onOutput(function (_x) {
        var x = _x.args[0];
        seen[x] = true;
        ok(x === 3 || x === 4, 'onOutput correctly receives value through chain of streams');
        if (seen[3] && seen[4]) {
          spy();
        }
      });
    s.input(a);
    s.input(b);
    a.invoke(3);
    b.invoke(4);
    setTimeout(function () {
      ok(spy.callCount, 1, 'Multiple calls to input correctly funnels streams together');
      cb();
    }, 200);
  },

  'Multiple input streams funnel together (array argument)': function (cb) {
    var spy = this.spy();
    var a = stream();
    var b = stream();
    var seen = new Array(6);
    var s = stream()
      .onOutput(function (_x) {
        var x = _x.args[0];
        seen[x] = true;
        ok(x === 3 || x === 4, 'onOutput correctly receives value through chain of streams');
        if (seen[3] && seen[4]) {
          spy();
        }
      });
    s.input([a, b]);
    a.invoke(3);
    b.invoke(4);
    setTimeout(function () {
      ok(spy.callCount, 1, 'Multi-input notation correctly funnels streams together');
      cb();
    }, 200);
  },

  'Multiple identical input streams de-duped': function (cb) {
    var spy = this.spy();
    var a = stream();
    var seen = 0;
    var s = stream()
      .onOutput(function (_x) {
        var x = _x.args[0];
        spy();
        ok(true, 'onOutput correctly receives value through chain of streams');
      });
    s.input([a, a]);
    a.invoke(2);
    setTimeout(function () { a.invoke(3); }, 200);
    setTimeout(function () {
      ok(spy.callCount, 2, 'onOutput correctly unions all streams');
      cb();
    }, 200);
  },

  'Input with non-stream arguments should be ignored': function (cb) {
    var spy = this.spy();
    var a = stream();
    var seen = 0;
    var s = stream()
      .onOutput(function (_x, _y) {
        var x = _x.args[0];      
        ok(x === 2 && typeof _y === 'undefined', 'onOutput correctly receives value through chain of streams');
        spy();
      });
    s.input(a);
    s.input(3, 1);
    a.invoke(2);
    setTimeout(function () {
      ok(spy.callCount, 1, 'onOutput correctly unions all streams');
      cb();
    }, 200);
  },

  'Replace existing inputs by calling input': function (cb) {
    var spy = this.spy();
    var a = stream();
    var b = stream();
    var c = stream();
    var seen = 0;
    var s = stream()
      .onOutput(function (_x, _y) {
        var x = _x.args[0];
        ok(typeof _y === 'undefined', 'onOutput correctly receives value through chain of streams');
        if (x === 1) return spy();
        if (x === 2) return spy();
        if (x === 3) return spy();
        return null;
      });
    s.input([a, b]);
    s.input(c);
    
    setTimeout(function () { a.invoke(1); }, 50);
    setTimeout(function () { b.invoke(2); }, 50);
    setTimeout(function () { c.invoke(3); }, 50);
    setTimeout(function () {
      ok(spy.callCount, 3, 'onOutput correctly unions all streams');
      cb();
    }, 200);
  },

  'Multiple onOutput': function (cb) {
    var spy = this.spy();
    var p = stream();
    var s = stream()
      .onOutput(function(a) {
        ok(a.args[0] === 2, 'First onOutput receives value passed to invoked stream');
        spy();
      })
      .onOutput(function(a) {
        ok(a.args[0] === 2, 'Second onOutput receives value passed to invoked stream');
        spy();
      });
    p.input(s)
      .onOutput(function(a) {
        ok(a.args[0] === 2, 'onOutput receives value passed to dependent stream');
        spy();
      });
    setTimeout(function () { s.invoke(2); }, 100);
    setTimeout(function () {
      ok.equals(spy.callCount, 3, 'Stream only called once');
      cb();
    }, 200);
  },

  'On onOutput exception, crash interal to stream, execute other onOutputs (should never happen)': function(cb) {
    var spy = this.spy();
    try {
      var s = stream()
        .onOutput(function (a) {
          spy();
          throw "test";
        })
        .onOutput(function (a) {
          ok(true, 'Second onOutput receives value passed to invoked stream when first onOutput throws an exception');
          spy();
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
      ok.equals(spy.callCount, 2, 'Stream only called once');
      cb();
    }, 100);
  },

  'Multiple input streams to multiple ports': function (cb) {
    var spy = this.spy();
    var a = stream();
    var b = stream();
    var _a;
    var _b;
    var s = stream(function (output, a, b) {
      _a = _a || a;
      _b = _b || b;
      if (_a && _b) {
        spy();
        ok((_a + _b) === 7, 'Stream received values from multiple input ports');
        cb();
      }
    });
    s.input(a, 0);
    s.input(b, 1);
    a.invoke(3);
    b.invoke(4);
    setTimeout(function () {
      ok.equals(spy.callCount, 1, 'Stream only called once');
    }, 50);
  },
  
  'Multiple input streams to single port': function (cb) {
    var spy = this.spy();
    var a = stream();
    var b = stream();
    var seen = {};
    var s = stream(function (output, x) {
      seen[x] = true;
      spy();
      if (seen['a'] && seen['b']) {
        ok(spy.callCount === 2, 'Stream received an input from both streams on a single port');
        cb();
      }
    });
    s.input([a, b]);
    a.invoke('a');
    b.invoke('b');
  },

  'Exception, crash interally. onOutput still runs': function(cb) {
    try {
      var s = stream(function (output, a) {
        output(a);
        throw "test";
      })
      .onOutput(function (a) {
        ok(a.args[0] === 'a', 'onOutput receives value correctly when stream throws an exception');
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
      cb();
    }, 100);
  },

  'Stream output becomes onOutput param': function (cb) {
    var a = stream();
    var b = stream();
    var aSave;
    var bSave;
    var plus = stream(function (output, _a, _b) {
      aSave = aSave || _a;
      bSave = bSave || _b;
      if (aSave && bSave) output(aSave + bSave, 'foo');
    });
    plus.input(a, 0);
    plus.input(b, 1);
    plus.onOutput(function (result, foo) {
      ok(result.args[0] === 5 && typeof foo === 'undefined', 'Stream function correctly passes a single value to onOutput via output continuation function');
      cb();
    });
    setTimeout(function () { a.invoke(2); }, 100);
    setTimeout(function () { b.invoke(3); }, 100);
  },

  'offOutput unregisters onOutput callback': function (cb) {
    var handler = function () {
      ok(false, 'Handler should not be called after being unbound by offOutput');
    };
    var a = stream();
    a.onOutput(handler);
    a.offOutput(handler);

    setTimeout(function () { a.invoke(); }, 50);
    setTimeout(function () {
      ok(true, 'After a period of time elapses, handler should not be called because it was unbound by offOutput');
      cb();
    }, 100);
  },

  'Composition': function (cb) {
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
    plus.input(a);
    plus.input(b, 1);
    times.input(c);
    times.input(plus, 1);
    times.onOutput(function (result) {
      if (isNaN(result.args[0])) { return; }
      ok.same(result.args[0], 20, 'onOutput correctly receives value of composed math operations');
      cb();
    });
    setTimeout(function () { a.invoke(2); }, 100);
    setTimeout(function () { b.invoke(3); }, 100);
    setTimeout(function () { c.invoke(4); }, 100);
  }
});

buster.testCase('Pathologically streaming', {
  'Join onOutput': function (cb) {
    var spy = this.spy();
    var a = stream();
    var b = stream();
    setTimeout(function () { a.invoke(2); }, 50);
    setTimeout(function () { b.invoke(3); }, 100);
    var abJoin = stream.join(function(out, aVal, bVal) {
      spy();
      ok(aVal.args[0] === 2, 'Join passes the first parameter');
      ok(bVal.args[1] === 3, 'Join passes the second parameter');
    });
    abJoin.input(a);
    abJoin.input(b, 1);
    setTimeout(function () {
      ok.equals(spy.callCount, 1, 'Join only called once');
      cb();
    }, 200);
  },

  'Join zero arguments': function (cb) {
    var z = stream.join();
    z.onOutput(function (aVal) {
        ok(false, 'Joining nothing should not invoke onOutput handlers');
    });
    setTimeout(function () {
        ok(true, 'Joining nothing should not invoke output handlers');
        cb();
    }, 200);
  },

  'Function composition': function (cb) {
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
      if (isNaN(result.args[0])) { return; }
      ok(result.args[0] === 20, 'onOutput correctly receives value of composed math operations');
      cb();
    });
    setTimeout(function () { a.invoke(2); }, 100);
    setTimeout(function () { b.invoke(3); }, 100);
    setTimeout(function () { c.invoke(4); }, 100);
  },

  'Mixed parameter types': function (cb) {
    var a = stream();
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
      if (isNaN(result.args[0])) { return; }
      ok(result.args[0] === 20, 'onOutput correctly receives value of composed math operations');
      cb();
    });
    setTimeout(function () { a.invoke(2); }, 100);
    setTimeout(function () { c.invoke(4); }, 100);
  }
});
