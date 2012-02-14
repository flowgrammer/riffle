QUnit.moduleStart = function (name) {
    if (name === 'Stream API') {
        stop();
        $script('https://raw.github.com/flowgrammer/Riffle/master/riffleLib.js', function () {
            start();
        });
    }

    if (name === 'Asyncify all the things!') {
        // plucked from Underscore JS
        _ = {
            breaker: {}
            ,each: function each(obj, iterator, context) {
                if (obj == null) {
                    return;
                }
                if (Array.prototype.forEach && obj.forEach === Array.prototype.forEach) {
                    obj.forEach(iterator, context);
                }
                else if (obj.length === +obj.length) {
                    for (var i = 0, l = obj.length; i < l; i++) {
                        if (i in obj && iterator.call(context, obj[i], i, obj) === _.breaker) {
                            return;
                        }
                    }
                } else {
                    for (var key in obj) {
                        if (obj.hasOwnProperty(key)) {
                            if (iterator.call(context, obj[key], key, obj) === _.breaker) {
                                return;
                            }
                        }
                    }
                }
            }
            ,map: function(obj, iterator, context) {
                var results = [];
                if (obj == null) {
                    return results;
                }
                if (Array.prototype.map && obj.map === Array.prototype.map) {
                    return obj.map(iterator, context);
                }
                _.each(obj, function(value, index, list) {
                    results[results.length] = iterator.call(context, value, index, list);
                });
                if (obj.length === +obj.length) {
                    results.length = obj.length;
                }
                return results;
            }
        };   
    }
};

module('Stream noConflict');

asyncTest('noConflict', 4, function () {
    ok(typeof window.stream === 'undefined', 'Stream is initially not defined on the window object');
    $script('https://raw.github.com/flowgrammer/Riffle/master/riffleLib.js', function () {
        var s;
        ok(stream.call, 'Once loaded, Stream is defined on the window object');
        s = stream.noConflict();
        ok(typeof stream === 'undefined', 'When noConflict runs, Stream is not defined on the window object');
        ok(s.call, 'noConflict returns a reference to the Stream constructor');
        start();
    });
    stop(3000);
});

module('Stream API');

asyncTest('Stream, invoke, onOutput', 1, function () {
    var s = stream()
        .onOutput(function (a) {
            ok(a === 2, 'onOutput correctly receives value passed to invoked stream');
            start();
        });
    setTimeout(function () { s.invoke(2) }, 100);
    stop(3000);
});

asyncTest('Repeat invoke', 2, function () {
    var seen = new Array(6);
    var s = stream()
        .onOutput(function (x) {
            seen[x] = true;
            ok(x === 3 || x === 6, 'onOutput correctly receives value passed to invoked stream');
            if (seen[6] && seen[3]) {
                start();
            }
        });
    s.invoke(6);
    s.invoke(3);
    stop(3000);
});

asyncTest('Invoke should send each argument to stream in its own event loop', 6, function () {
    var s = stream()
        .onOutput(function (t, u, v, w, x, y) {
            ok(true);
        });
    s.invoke(6, 5, 4, 3, 2, 1);
    setTimeout(function () { start(); }, 500);
    stop(3000);
});

asyncTest('Multiple input streams funnel together', 2, function () {
    var a = stream();
    var b = stream();
    var seen = new Array(6);
    var s = stream()
        .onOutput(function (x) {
            seen[x] = true;
            ok(x === 3 || x === 4, 'onOutput correctly receives value through chain of streams');
            if (seen[3] && seen[4]) {
                start();
            }
        })
        .input(a, b)
    a.invoke(3);
    b.invoke(4);
    stop(3000);
});

asyncTest('Multiple identical input streams funnel together', 2, function () {
    var a = stream();
    var seen = 0;
    var s = stream()
        .onOutput(function (x) {
            if (x === 2) {
                seen++;
            }
            ok(true, 'onOutput correctly receives value through chain of streams');
            if (seen === 2) {
                start();
            }
        })
        .input(a, a);
    a.invoke(2);
    stop(3000);
});

asyncTest('Input with non-stream arguments should be ignored', 1, function () {
    var a = stream();
    var seen = 0;
    var s = stream()
        .onOutput(function (x, y) {
            ok(x === 2 && typeof y === 'undefined', 'onOutput correctly receives value through chain of streams');
        })
        .input(a, 3);
    a.invoke(2);
    setTimeout(function () { start(); }, 500);
    stop(3000);
});

asyncTest('Replace existing inputs by calling input', 1, function () {
    var a = stream();
    var b = stream();
    var c = stream();
    var s = stream()
        .onOutput(function (x, y) {
            ok(x === 3 && typeof y === 'undefined', 'onOutput correctly receives value through chain of streams');
        })
        .input(a, b);
    s.input(c);
    
    setTimeout(function () { a.invoke(1); }, 50);
    setTimeout(function () { b.invoke(2); }, 50);
    setTimeout(function () { c.invoke(3); }, 50);
    setTimeout(function () { start(); }, 500);
    stop(3000);
});

asyncTest('Multiple onOutput', 3, function () {
    var p = stream();
    var s = stream()
        .onOutput(function(a) {
            ok(a === 2, 'First onOutput receives value passed to invoked stream');
        })
        .onOutput(function(a) {
            ok(a === 2, 'Second onOutput receives value passed to invoked stream');
        });
    p.input(s)
        .onOutput(function(a) {
            ok(a === 2, 'onOutput receives value passed to dependent stream');
            start();
        })
    setTimeout(function () { s.invoke(2) }, 100);
    stop(3000);
});

asyncTest('On onOutput exception, crash interal to stream, execute other onOutputs (should never happen)', 1, function() {
    try {
        var s = stream()
            .onOutput(function (a) {
                throw "test";
            })
            .onOutput(function (a) {
                ok(true, 'Second onOutput receives value passed to invoked stream when first onOutput throws an exception');
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
    stop(3000);
});

asyncTest('Multiple input streams to multiple ports', function () {
    expect(1);
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
        })
        .input(a, b);
    a.invoke(3);
    b.invoke(4);
    stop(3000);
});

asyncTest('Multiple input streams to single port', 2, function () {
    var a = stream();
    var b = stream();
    var seen = new Array(6);
    var s = stream(function (output, x) {
            seen[x] = true;
            ok(true, 'Stream received value a single time');
            if (seen[3] && seen[4]) {
                start();
            }
        })
        .input([a, b])
    a.invoke(3);
    b.invoke(4);
    stop(3000);
});

asyncTest('Exception, crash interally. onOutput still runs', 1, function() {
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
    stop(3000);
});

asyncTest('Stream output becomes onOutput param', 1, function () {
    var a = stream();
    var b = stream();
    var _a;
    var _b;
    var plus = stream(function (output, a, b) {
            _a = _a || a;
            _b = _b || b;
            output(_a + _b, 'foo');
        })
        .input(a, b)
        .onOutput(function (result, foo) {
            if (isNaN(result)) { return; }
            ok(result === 5 && foo === 'foo', 'Stream function correctly passes multiple values to onOutput via output continuation function');
            start();
        });
    setTimeout(function () { a.invoke(2) }, 100);
    setTimeout(function () { b.invoke(3) }, 100);
    stop(3000);
});

asyncTest('offOutput unregisters onOutput callback', 1, function () {
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
    stop(3000);
});

asyncTest('Composition', 1, function () {
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
    stop(3000);
});

module('Promises');

asyncTest('Promise, onFulfill, fulfill', 1, function () {
    var a = stream.promise();
    a.onFulfill(function (aVal) {
        ok(aVal === 2, 'Promise fulfill works');
        start();
    });
    a.onSmash(function (failVal) {
        ok(false, 'Promise smash was not invoked for fulfilled promise');
    });
    setTimeout(function () { a.fulfill(2); }, 100);
    stop(3000);
});

asyncTest('Promise onSmash, smash with timeout', 1, function () {
    var a = stream.promise();
    a.onFulfill(function (aVal) {
        ok(false, 'Promise fulfill not invoked for smashed promise');
    });
    a.onSmash(function (failVal) {
        ok(true, 'Promise smash works');
        start();
    });
    setTimeout(function () { a.smash('smashing'); }, 100);
    stop(10000);
});

asyncTest('Promise onOutput exception', 1, function() {
    var a = stream.promise();
    setTimeout(function () { 
        try {
            a.fulfill('fulfilling');
        } catch (e) {
            ok(false, 'Exceptions not forwarded to promise constructor scope');
        }
    }, 50);
    try {
        a.onFulfill(function (aVal) {
            throw "test";
        });
    } catch (e) {
        ok(false, 'Exceptions not forwarded to promise fulfill scope');
    }
    a.onSmash(function (failVal) {
        ok(false, 'Promise not smashed via exceptions');
    });
    setTimeout(function () {
        ok(true, 'Exceptions are entirely absorbed by promises');
        start();
    }, 500);
    stop(3000);
});

asyncTest('Promise status', 2, function () {
    var a = stream.promise();
    a.onFulfill(function (aVal) {
        ok(a.status() === 'fulfilled', 'Promise fulfilled status works');
        start();
    });
    ok(a.status() === 'unresolved', 'Promise unresolved status works');
    setTimeout(function () { a.fulfill('whatevs'); }, 50);
    stop(3000);
});

asyncTest("Promise duplicate fulfillment", 1, function () {
    var a = stream.promise();
    setTimeout(function () { a.fulfill('lolz') }, 50);
    a.onFulfill(function (aVal) {
        ok(a.status() === 'fulfilled', 'Promise fulfillment occurs only once');
    });
    a.onSmash(function (failVal) {
        ok(false, 'Smash does not occur on duplicate fulfillment, the fulfillment is simply ignored');
    });
    a.fulfill('hey!');
    a.fulfill('hey again!');
    setTimeout(function () { start(); }, 300);
    stop(10000);
});

asyncTest('Not', 1, function () {
    var a = stream.promise();
    stream.promise.not(stream.promise.not(stream.promise.not(a))).onFulfill(function (aVal) {
        ok(false, 'Promises can be notted');
    });
    stream.promise.not(stream.promise.not(stream.promise.not(a))).onSmash(function (failVal) {
        ok(true, 'Promises can be notted');
        start();
    });
    a.fulfill("hey!");
    stop(3000);
});

asyncTest('Join onOutput', 2, function () {
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
});

asyncTest('Join zero arguments', 1, function () {
    var z = stream.join();
    z.onOutput(function (aVal) {
        ok(false, 'Joining nothing should not invoke onOutput handlers');
    });
    setTimeout(function () {
        ok(true, 'Joining nothing should not invoke output handlers');
        start();
    }, 500);
    stop(3000);
});

asyncTest('Join identical promises', 2, function () {
    var a = stream.promise();
    var z = stream.join(a, a);
    setTimeout(function () { a.fulfill(2); }, 50);
    z.onOutput(function (aVal, bVal) {
        ok(aVal === 2, 'Join passes the first parameter');
        ok(bVal === 2, 'Join passes the second parameter, which is the same as the second');
        start();
    });
    stop(3000);
});

asyncTest('Function composition', 1, function () {
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
});

asyncTest('Mixed parameter types', 1, function () {
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
});

asyncTest('Mixed return types: Promise', 1, function () {
    var plus2 = stream.func(function (plusVal) {
        var a = stream.promise();
        setTimeout(function () { a.fulfill(plusVal + 2) }, 100);
        return a;
    });
    var result = plus2(plus2(4));
    result.onOutput(function (r) {
        ok(r === 8, 'Function transparently fulfills promise');
        start();
    });
    stop(3000);
});

asyncTest('Mixed return types: undefined', 1, function () {
    var undef = stream.func(function (a) {
        // returns undefined
    });
    var result = undef("test");
    result.onOutput(function (r) {
        ok(r === undefined, 'Function passes undefined through to onOutput');
        start();
    });
    stop(3000);
});

module('Multimethod');

asyncTest('Dispatch, onDispatch, named dispatch', 1, function () {
    var a = stream();
    var s = stream.multi()
        .input(a)
        .dispatch(function (x) {
            return x === 2 ? 'two': undefined;
        })
        .onDispatch(function (event) {
            ok(true, 'Dispatch invokes the correct onDispatch handler');
            start();
        }, 'two')
        .onDispatch(function (event) {
            ok(false, 'Dispatch does not invoke the default onDispatch handler');
        });
    setTimeout(function () { a.invoke(2); }, 50);
    stop(3000);
});

asyncTest('Multiple input to multiple ports', 1, function () {
    var a = stream();
    var b = stream();
    var c = stream();
    var d = stream();
    var s = stream.multi()
        .dispatch(function (a, b, c, d) {
            return (!a && b === 'foo' && !c && !d) ? 'bar': undefined;
        })
        .onDispatch(function (a, b, c, d) {
            ok(true, 'Dispatch invokes the correct onDispatch handler');
            start();
        }, 'bar')
        .onDispatch(function (a, b, c, d) {
            ok(false, 'Dispatch does not invoke the default onDispatch handler');
        });
    stream.join(a, b, c, d).onOutput(function (av, bv, cv, dv) {
        s.invoke(av, bv, cv, dv);
    });
    setTimeout(function () { a.invoke(false); }, 50);
    setTimeout(function () { b.invoke('foo'); }, 100);
    setTimeout(function () { c.invoke(false); }, 500);
    setTimeout(function () { d.invoke(0); }, 50);
    stop(3000);
});

module('Pattern matching');

asyncTest('Temporal pattern matching with regex', 1, function () {
    // saves last-seen inputs for all inputs
    var a = stream();
    var b = stream();
    var c = stream();
    var d = stream();
    var s = stream.timePattern()
        .input(a, b, c, d)
        .spot('.*ab*c$', function () {
            ok(true, 'Pattern spotted');
            start();
        });
    a.invoke('a'); // start matching
    b.invoke('b');
    b.invoke('more b'); // good so far
    d.invoke('d'); // fail match
    c.invoke('c');
    a.invoke('a'); // start matching again
    b.invoke('b');
    b.invoke('more b');
    b.invoke('more b');
    c.invoke('c'); // success!
    stop(3000);
});

module('Lazy streams');

asyncTest('Print', 10, function () {
    var range = stream.lazy(function (output, min, max) {
        for (var i = min; i < max; ++i) {
            output(i);
        }
    });
    range.invoke(0, 10);
    setTimeout(function () {
        // invokes no sooner than value can be output
        range.onOutput(function (x) {
            ok(true, 'Range invoked once')
            if(x === 9) {
                start();
            }
        });
    }, 500);
    stop(3000);
});

asyncTest('Map', 10, function () {
    var map = stream(function (output, x, f) {
        output(f(x));
    });

    var range = stream.lazy(function (output, min, max) {
        for (var i = min; i < max; ++i) {
            output(i);
        }
    });

    stream()
        .input(map)
        .onOutput(function (x) {
            ok(true, 'Range invoked once');
            if (x === 18) {
                start();
            }
        });

    stream.join(range.invoke(0, 10), function (v) { return 2 * v; }).onOutput(map.invoke);
    stop(3000);
});

asyncTest('Filter', 4, function () {
    var filter = stream(function (output, x, f) {
        if (f(x)) {
            output(x);
        }
    });

    var range = stream.lazy(function (output, min, max) {
        for (var i = min; i < max; ++i) {
            output(i);
        }
    });

    stream()
        .input(filter) 
        .onOutput(function (x) {
            ok(true, 'Range invoked once');
            if (x === 9) {
                setTimeout(start, 500);
            }
        });

    stream.join(range.invoke(0, 10), function (v) { return v % 3 === 0; }).onOutput(filter.invoke);
    stop(3000);
});

module('Asyncify all the things!');

asyncTest('Browser\'s parseInt', 2, function () {
    var nums = stream();

    var asyncParseInt = stream.func(parseInt);
    asyncParseInt(nums, 10)
        .onOutput(function (x) {
            ok(x === 50, 'asyncParseInt parses the string correctly');
        });

    setTimeout(function () { nums.invoke("50"); }, 50);
    setTimeout(function () { nums.invoke("050.000"); }, 50);
    setTimeout(function () { start(); }, 500);
});

asyncTest('Underscore.js\'s map', 3, function () {
    // utility functions for test only, not for production use!
    var asyncArray = function asyncArray(numToCollect) {
        var result = new Array(numToCollect);
        var numCollected = 0;
        return !parseInt(numToCollect, 10) ? stream(): stream(function (output, x) {
            result[numCollected] = x;
            numCollected++;
            if (numCollected === numToCollect) {
                output(result.slice(0));
                numCollected = 0;
                result = new Array(numToCollect);
            }
        });
    };

    var range = stream.lazy(function (output, min, max) {
        for (var i = min; i < max; ++i) {
            output(i);
        }
    });

    // use Stream.Function to get params asynchronously into a synchronously called function
    var asyncMap = stream.func(_.map);
    var asyncTen = asyncArray(10).input(range.invoke(0, 10));

    // single invocation stream
    asyncMap(asyncTen, function (v) { return 2 * v; })
        .onOutput(function (mapped) {
            ok(mapped.length === 10, 'The whole asynchronously filled list is passed to asyncMap at once');
            ok(mapped[0] === 0, 'The first element of the map is correct');
            ok(mapped[9] === 18, 'The last element of the map is correct');
            start();
        });
    stop(3000);
});
