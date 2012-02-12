(function (global, undefined) {
    if (!global.setTimeout) return

    function Stream(userSuppliedStreamFn) {
        function defaultStreamFn(output) {
            var inputs = _.argumentsToArray(arguments)
            inputs.shift()
            if(inputs.length === 0) global.setTimeout(function () { output() }, 0)
            _.each(inputs, function invokeOutput(input) {
                if (!_.isUndefined(input)) {
                    global.setTimeout(function delayedInvokeOutput() { output(input) }, 0) }})}

        var chain = {}

        ;(function () {
            var outputFns = []
            function outputAllFns() {
                var outputs = _.argumentsToArray(arguments)
                _.each(outputFns, function applyFunction(f) {
                    _.applyArgsToFn(f, outputs) })}
            var streamFn = _.isFunction(userSuppliedStreamFn)? userSuppliedStreamFn: defaultStreamFn;
            chain.invoke = function invoke() {
                var outputs = _.argumentsToArray(arguments)
                outputs.unshift(outputAllFns)
                _.applyArgsToFn(streamFn, outputs)
                return chain }
            chain.onOutput = function onOutput(f) {
                var outIdx = 0
                if (!_.isFunction(f)) throw new Error('onOutput expecting callback function')
                outputFns.push(f)
                return chain }
            chain.offOutput = function offOutput(f) {
                var outIdx = 0
                if (!_.isFunction(f)) throw new Error('offOutput expecting callback function')
                outputFns = _.reject(outputFns, function isSameAsReferenceInScope(x) { return x === f })
                return chain }
            }())

        ;(function () {
            var callbacks    = []
            var inputStreams = []
            function wait(streams, idx) {
                var unbindStreams = inputStreams[idx]
                function invokeWithOneArg(x) {
                    var outputs = new Array(idx + 1)
                    outputs[idx] = x
                    chain.invoke.apply(global, _.isUndefined(x)? []: outputs) }
                if (unbindStreams) {
                    _.each(unbindStreams, function unbindInputs(s) { s.offOutput(callbacks[idx]) })
                    ;delete callbacks[idx]
                    ;delete inputStreams[idx] }
                _.each(streams, function registerOnOutput(stream) { stream.onOutput(invokeWithOneArg) })
                callbacks[idx]    = invokeWithOneArg
                inputStreams[idx] = streams }
            chain.input = function input() {
                var inIdx = 0
                _.each(arguments, function bindInputs(inputs, inIdx) {
                    if (Stream.isStream(inputs)) inputs = [inputs]
                    if (_.isArray(inputs)) {
                        inputs = _.reject(inputs, function isNotStream(obj) { return !Stream.isStream(obj) })
                        wait(inputs, inIdx) }})
                    return chain }}())
        return chain }

    Stream.isStream = function (x) {
        return !!(x && x.invoke && x.onOutput && x.offOutput && x.input) }

    var old = global.Stream
    Stream.noConflict = function noConflict() {
        global.Stream = old
        return this }

    var _ = {
        breaker: {}
        ,arrayProto: Array.prototype
        ,objProto: Object.prototype
        ,isArray:           Array.isArray || function isArray(obj) {
            return _.objProto.toString.call(obj) == '[object Array]' }
        ,isFunction:        function isFunction(obj) {
            return _.objProto.toString.call(obj) == '[object Function]' }
        ,isUndefined:       function isUndefined(obj) {
            return obj === void 0 }
        ,argumentsToArray:  function argumentsToArray(args) {
            return _.arrayProto.slice.call(args) }
        ,applyArgsToFn:     function applyArgsToFn(fn, args) {
            try {
                fn.apply(global, args) }
            catch (e) {
                if (console && console.exception) console.exception(e) }}
        ,each:              function each(obj, iterator, context) {
            if (obj == null) return
            if (_.arrayProto.forEach && obj.forEach === _.arrayProto.forEach) {
                obj.forEach(iterator, context) }
            else if (obj.length === +obj.length) {
                for (var i = 0, l = obj.length; i < l; i++) {
                    if (i in obj && iterator.call(context, obj[i], i, obj) === _.breaker) return }}
            else {
                for (var key in obj) {
                    if (obj.hasOwnProperty(key)) {
                        if (iterator.call(context, obj[key], key, obj) === _.breaker) return }}}}
        ,reject:            function reject(obj, iterator, context) {
            var results = []
            if (obj == null) return results
            _.each(obj, function exclude(value, index, list) {
                if (!iterator.call(context, value, index, list)) results[results.length] = value })
                return results }}

    global.Stream = Stream }(this))
