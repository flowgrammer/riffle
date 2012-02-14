/*jshint laxbreak:true, laxcomma:true, asi:true */
(function (global) {
    "use strict";
    var old,
        _;

    if (!global.setTimeout) {
        return;
    }

    function stream(userSuppliedStreamFn) {
        var chain = {};

        function defaultStreamFn(output) {
            var inputs = _.argumentsToArray(arguments);
            inputs.shift();
            if (inputs.length === 0) {
                global.setTimeout(function () {
                    output();
                }, 0);
            }
            _.each(inputs, function invokeOutput(input) {
                if (!_.isUndefined(input)) {
                    global.setTimeout(function delayedInvokeOutput() {
                        output(input);
                    }, 0);
                }
            });
        }

        (function () {
            var outputFns = [], streamFn;
            function outputAllFns() {
                var outputs = _.argumentsToArray(arguments);
                _.each(outputFns, function applyFunction(f) {
                    _.applyArgsToFn(f, outputs);
                });
            }
            streamFn = _.isFunction(userSuppliedStreamFn) ? userSuppliedStreamFn : defaultStreamFn;
            chain.invoke = function invoke() {
                var outputs = _.argumentsToArray(arguments);
                outputs.unshift(outputAllFns);
                _.applyArgsToFn(streamFn, outputs);
                return chain;
            };
            chain.onOutput = function onOutput(f) {
                if (!_.isFunction(f)) {
                    throw new Error('onOutput expecting callback function');
                }
                outputFns.push(f);
                return chain;
            };
            chain.offOutput = function offOutput(f) {
                if (!_.isFunction(f)) {
                    throw new Error('offOutput expecting callback function');
                }
                outputFns = _.reject(outputFns, function isSameAsReferenceInScope(x) {
                    return x === f;
                });
                return chain;
            };
        }());

        (function () {
            var callbacks = [],
                inputStreams = [];
            function wait(streams, idx) {
                var unbindStreams = inputStreams[idx];
                function invokeWithOneArg(x) {
                    var outputs = [];
                    outputs.length = idx + 1;
                    outputs[idx] = x;
                    chain.invoke.apply(global, _.isUndefined(x) ? [] : outputs);
                }
                if (unbindStreams) {
                    _.each(unbindStreams, function unbindInputs(s) {
                        s.offOutput(callbacks[idx]);
                    });
                    delete callbacks[idx];
                    delete inputStreams[idx];
                }
                _.each(streams, function registerOnOutput(stream) {
                    stream.onOutput(invokeWithOneArg);
                });
                callbacks[idx] = invokeWithOneArg;
                inputStreams[idx] = streams;
            }
            chain.input = function input() {
                var i, removeStreamIndexes = [];
                _.each(arguments, function bindInputs(inputs, inIdx) {
                    if (stream.isStream(inputs)) {
                        inputs = [inputs];
                    }
                    if (_.isArray(inputs)) {
                        inputs = _.reject(inputs, function isNotStream(obj) {
                            return !stream.isStream(obj);
                        });
                        wait(inputs, inIdx);
                    }
                });
                for (i = arguments.length; i < inputStreams.length; i += 1) {
                    removeStreamIndexes.push(i);
                }
                _.each(removeStreamIndexes, function (idx) {
                    _.each(inputStreams[idx], function (stream) { stream.offOutput(callbacks[idx]); });
                    delete callbacks[idx];
                    delete inputStreams[idx];
                });
                return chain;
            };
        }());
        return chain;
    }

    stream.isStream = function isStream(x) {
        return !!(x && x.invoke && x.onOutput && x.offOutput && x.input);
    };

    stream.promise = function promise() {
        var value,
            status = 'unresolved',
            s,
            t = stream(),
            smashCallbacks = [];
        s = stream(function (out, v) {
            if (!_.isUndefined(v)) {
                out(v);
                value = v;
            } else {
                out();
            }
        });
        t.input(s);
        return {
            onFulfill: function (func) {
                t.onOutput(func);
            },
            fulfill: function () {
                if (status === 'unresolved') {
                    status = 'fulfilled';
                    s.invoke.apply(global, arguments);
                }
            },
            smash: function (reason) {
                status = 'smashed';
                _.each(smashCallbacks, function (callback) {
                    callback(reason);
                });
            },
            onSmash: function (func) {
                smashCallbacks.push(func);
            },
            status: function () {
                return status;
            },
            value: function () {
                return value;
            }
        };
    };

    stream.promise.not = function not(p) {
        var q = stream.promise();
        p.onFulfill(function () {
            q.smash();
        });
        p.onSmash(function () {
            q.fulfill(null);
        });
        return q;
    };

    stream.isPromise = function isPromise(x) {
        return !!(x && x.fulfill && x.onFulfill && x.smash && x.onSmash && x.status && x.value);
    };

    stream.adapter = function adapter(x) {
        var o = stream();
        if (stream.isPromise(x)) {
            // delay invoke so consumer can wire up output
            if (x.status() === 'fulfilled') {
                global.setTimeout(function () {
                    o.invoke(x.value());
                }, 0);
            } else {
                x.onFulfill(function (item) {
                    o.invoke(item);
                    return item;
                });
            }
            return o;
        } else if (stream.isStream(x)) {
            return x;
        } else {
            o.invoke(x);
            return o;
        }
    };

    stream.join = function join() {
        var responses = [],
            responseCount = 0,
            q;
        responses.length = arguments.length;
        q = stream(function (output) {
            var items = _.argumentsToArray(arguments);
            items.shift();
            responseCount = 0;
            _.each(items, function (item, idx) {
                if (!_.isUndefined(item)) {
                    responses[idx] = item;
                }
            });
            responseCount = _.reduce(responses, function foundItemCount(memo, item) {
                return memo + (_.isUndefined(item) ? 0 : 1);
            }, 0);
            if (responseCount === responses.length) {
                output.apply(global, responses);
            }
        }).input.apply(global, _.map(
            _.argumentsToArray(arguments),
            function (item) {
                if (stream.isStream(item) || stream.isPromise(item)) {
                    return stream.adapter(item);
                }
            }
        ));
        _.each(_.argumentsToArray(arguments), function (item, idx) {
            if (!(stream.isStream(item) || stream.isPromise(item))) {
                responses[idx] = item;
                responseCount += 1;
            }
        });
        // delay invoke so consumer can wire up output
        if (responseCount === responses.length && responseCount !== 0) {
            global.setTimeout(function () {
                q.invoke.apply(global, responses);
            }, 0);
        }
        return q;
    };

    stream.func = function func(fn) {
        return function input() {
            var join = stream.join.apply(global, arguments),
                returnVal = stream();
            join.onOutput(function () {
                var result = fn.apply(global, arguments);
                if (_.isUndefined(result)) {
                    returnVal.invoke();
                } else if (stream.isStream(result) || stream.isPromise(result)) {
                    returnVal.input(stream.adapter(result));
                } else {
                    returnVal.invoke(result);
                }
            });
            return returnVal;
        };
    };

    stream.multi = function multi() {
        var dispatchFunc,
            norm,
            streams = {},
            s,
            o = stream(),
            chain;
        s = stream(function () {
            var dispatchVal,
                args = _.argumentsToArray(arguments);
            args.shift();
            dispatchVal = dispatchFunc && dispatchFunc.apply(global, args);
            if (streams[dispatchVal]) {
                o.input(streams[dispatchVal]);
                streams[dispatchVal].invoke.apply(global, args);
            } else if (norm) {
                o.input(norm);
                norm.invoke.apply(global, args);
            } else {
                o.invoke.apply(global, args);
            }
        });
        chain = {
            invoke: function () {
                s.invoke.apply(global, arguments);
                return chain;
            },
            input: function () {
                s.input.apply(global, arguments);
                return chain;
            },
            dispatch: function (func) {
                dispatchFunc = func;
                return chain;
            },
            onDispatch: function (func, id) {
                if (id && func) {
                    streams[id] = stream(func);
                } else if (func) {
                    norm = stream(func);
                }
                return chain;
            },
            onOutput: function (func) {
                o.onOutput(func);
                return chain;
            }
        };
        return chain;
    };

    stream.timePattern = function timePattern() {
        var p,
            seen = '',
            matchRegex = new RegExp(),
            matchFunc,
            chain;
        p = stream(function (output) {
            var args = _.argumentsToArray(arguments);
            args.shift();
            seen = _.reduce(args, function (memo, item, idx) {
                    // convert param index to lowercase letters. disregard > 26 for now.
                return memo + (_.isUndefined(item) ? '' : String.fromCharCode(idx + 97));
            }, seen);
            if (matchRegex.test(seen) && _.isFunction(matchFunc)) {
                matchFunc(output);
            }
        });
        chain = {
            invoke: function () {
                p.invoke.apply(global, arguments);
                return chain;
            },
            input: function () {
                p.input.apply(global, arguments);
                return chain;
            },
            spot: function (r, f) {
                matchRegex = new RegExp(r);
                matchFunc = f;
                return chain;
            },
            onOutput: function (func) {
                p.onOutput(func);
                return chain;
            },
            clear: function () {
                seen = '';
                return chain;
            }
        };
        return chain;
    };

    stream.lazy = function lazy(func) {
        var inputs = [],
            outFuncs = [],
            collectorStream = stream(),
            attempt,
            chain;
        collectorStream.onOutput(function () {
            inputs.push(_.argumentsToArray(arguments));
        });
        attempt = function () {
            var s;
            global.setTimeout(function () {
                if (inputs.length > 0 && outFuncs.length > 0) {
                    s = stream(func);
                    _.each(outFuncs, function (func) {
                        s.onOutput(func);
                    });
                    _.each(inputs, function (input) {
                        s.invoke.apply(global, input);
                    });
                    inputs = [];
                }
            }, 0);
        };
        chain = {
            invoke: function () {
                // ensure inputs are not streams
                inputs.push(_.argumentsToArray(arguments));
                attempt();
                return chain;
            },
            input: function () {
                collectorStream.input.apply(global, _.argumentsToArray(arguments));
                return chain;
            },
            onOutput: function (func) {
                outFuncs = _.reject(outFuncs, function (x) {
                    return x === func;
                });
                outFuncs.push(func);
                attempt();
                return chain;
            },
            offOutput: function (func) {
                outFuncs = _.reject(outFuncs, function (x) {
                    return x === func;
                });
                attempt();
                return chain;
            }
        };
        return chain;
    };

    old = global.stream;
    stream.noConflict = function noConflict() {
        global.stream = old;
        return stream;
    };
    global.stream = stream;

    _ = {
        breaker: {},
        ctor: function ctor() {},
        arrayProto: Array.prototype,
        objProto: Object.prototype,
        functionProto: Function.prototype,
        isArray: Array.isArray || function isArray(obj) {
            return _.objProto.toString.call(obj) === '[object Array]';
        },
        isFunction: function isFunction(obj) {
            return _.objProto.toString.call(obj) === '[object Function]';
        },
        isUndefined: function isUndefined(obj) {
            return obj === void 0;
        },
        argumentsToArray: function argumentsToArray(args) {
            return _.arrayProto.slice.call(args);
        },
        applyArgsToFn: function applyArgsToFn(fn, args) {
            try {
                fn.apply(global, args);
            } catch (e) {
                if (console && console.exception) {
                    console.exception(e);
                }
            }
        },
        bind: function bind(func, context) {
            var bound, args;
            if (func.bind === _.functionProto.bind && _.functionProto.bind) {
                return _.functionProto.apply(func, _.arrayProto.slice.call(arguments, 1));
            }
            if (!_.isFunction(func)) {
                throw new TypeError();
            }
            args = _.arrayProto.slice.call(arguments, 2);
            bound = function () {
                if (!(this instanceof bound)) {
                    return func.apply(context, args.concat(_.arrayProto.slice.call(arguments)));
                }
                _.ctor.prototype = func.prototype;
                var self = new _.ctor(),
                    result = func.apply(self, args.concat(_.arrayProto.slice.call(arguments)));
                if (_.isObject(result)) {
                    return result;
                }
                return self;
            };
            return bound;
        },
        each: function each(obj, iterator, context) {
            var i, l, key;
            if (obj === null) {
                return;
            }
            if (_.arrayProto.forEach && obj.forEach === _.arrayProto.forEach) {
                obj.forEach(iterator, context);
            } else if (obj.length === +obj.length) {
                for (i = 0, l = obj.length; i < l; i += 1) {
                    if (obj.hasOwnProperty(i) && iterator.call(context, obj[i], i, obj) === _.breaker) {
                        return;
                    }
                }
            } else {
                for (key in obj) {
                    if (obj.hasOwnProperty(key)) {
                        if (iterator.call(context, obj[key], key, obj) === _.breaker) {
                            return;
                        }
                    }
                }
            }
        },
        map: function map(obj, iterator, context) {
            var results = [];
            if (obj === null) {
                return results;
            }
            if (_.arrayProto.map && obj.map === _.arrayProto.map) {
                return obj.map(iterator, context);
            }
            _.each(obj, function (value, index, list) {
                results[results.length] = iterator.call(context, value, index, list);
            });
            if (obj.length === +obj.length) {
                results.length = obj.length;
            }
            return results;
        },
        reduce: function reduce(obj, iterator, memo, context) {
            var initial = arguments.length > 2;
            if (obj === null) {
                obj = [];
            }
            if (_.arrayProto.reduce && obj.reduce === _.arrayProto.reduce) {
                if (context) {
                    iterator = _.bind(iterator, context);
                }
                return initial ? obj.reduce(iterator, memo) : obj.reduce(iterator);
            }
            _.each(obj, function (value, index, list) {
                if (!initial) {
                    memo = value;
                    initial = true;
                } else {
                    memo = iterator.call(context, memo, value, index, list);
                }
            });
            if (!initial) {
                throw new TypeError('Reduce of empty array with no initial value');
            }
            return memo;
        },
        reject: function reject(obj, iterator, context) {
            var results = [];
            if (obj === null) {
                return results;
            }
            _.each(obj, function exclude(value, index, list) {
                if (!iterator.call(context, value, index, list)) {
                    results[results.length] = value;
                }
            });
            return results;
        }
    };
}(this));
