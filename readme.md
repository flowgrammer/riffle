# riffle.js

**riffle.js** is a stream library for managing asynchronous flow control. The library consists of a standalone *stream* module found in **riffle.js**. The *stream* module is the basic building block for asynchronous flow control. Networks of connected *stream* objects can be used to write programs that have many desirable properties.

The library focuses on:

 - Modularity (decoupled in time, memory, and source code)
 - Parallelizability (good for divide and conquer algorithms)
 - Composability (if they were any more composable, they'd be legos)
 - Familiar abstractions (assembly line, flow)
 - Facilitates diagramming (structured analysis) and reasoning
 - Data-crunching, business logic, workflow, transformation problems

Additionally, **riffleLib.js** contains a small collection of example modules for dealing with async complexity and leveraging async opportunities. To play with the code in a console, visit the [test suite](http://flowgrammer.github.com/Riffle/test/test.html).

The code is [MIT Licensed](/flowgrammer/Riffle/blob/master/LICENSE), which is as free as I can make it without paying you to take it. Contributions are welcome!

## Examples

I'm going to walk you through some examples of how the stream module is used. Note: In both the examples and the tests, I use setTimeout to generate the browser events. In practice, events may also originate from keyboard and mouse events, network responses, DOMReady, event libraries, and more.

To use *stream* constructor, include the **riffle.js** file in your HTML source.

```html
<script src="/stream.js" />
<script>
var s1 = stream();
</script>
```

The constructor accepts a single callback function as an argument.

```javascript
var s1 = stream(function () {
    // do something
  });
```

The stream may perform a computation, such as processing an AJAX response. Instead of returning, the stream may call an output function. Assuming inData is a string, this stream will output the reverse of it.

```javascript
var s1 = stream(function (outputFn, inData) {
    var reversed = inData.split('').reverse().join('');
    outputFn(reversed);
  });
```

To see the outputs of the stream, register a callback to the onOutput method. To invoke the stream, use the invoke method. Notice that the stream is fully chainable. Both onOutput and invoke are optional, and can be called any number of times.

```javascript
var s1 = stream(function (outputFn, inData) {
    var reversed = inData.split('').reverse().join('');
    outputFn(reversed);
  })
  .onOutput(function (outData) {
    console.log(outData);
  })
  .invoke("Hello wolf");
```

Much of the power of programming with streams comes with chaining them together. Pass one or multiple streams to the input method to setup chaining. This example pipes the output of the string reversing stream to one that outputs the first four characters.

```javascript
var s1 = stream(function (outputFn, inData) {
    var reversed = inData.split('').reverse().join('');
    outputFn(reversed);
  })
  .invoke("Hello wolf");
  // Notice there is no onOutput handler attached

var s2 = stream(function (outputFn, inData) {
    var firstFour = inData.substring(0, 3);
    outputFn(firstFour);
  })
  .input(s1)
  .onOutput(function (outData) {
    console.log(outData);
  });
```

Douglas Crockford's module pattern can wrap streams, allowing them to privately accumulate state.

```javascript
function streamModule(a, b) {
  var _a;
  var _b;
  return stream(function (output, a, b) {
    _a = a || _a;
    _b = b || _b;
    console.log(_a + _b);
  })
  .input(a, b);
}

var a = stream();
var b = stream();
streamModule(a, b);
a.invoke(3);
b.invoke(4);
```

With a little finesse, streams can be used to make async wrappers around functions that are not normally asynchronous. Here's an example from **riffleLib.js**. Take a look at the tests for more examples.

```javascript
var nums = stream();

var asyncParseInt = stream.func(parseInt);
asyncParseInt(nums, 10)
  .onOutput(function (x) {
     console.log(x === 50);
  });

setTimeout(function () { nums.invoke("50"); }, 50);
setTimeout(function () { nums.invoke("050.000"); }, 50);
```

**riffle.js** is currently browser-only, it cannot yet be added to Node via NPM.

## API Reference

### stream

```
stream(callback)
```

Constructs a stream with the specified *stream callback*. If *stream callback* is supplied, it fires each time inputs arrive at the stream. If *stream callback* is not specified, the stream outputs all *inputData*.

Constructed streams are returned with the following methods:

 - *onOutput*
 - *input*
 - *invoke*
 - *noConflict*

### stream callback

```javascript
function (outputFunction[, inputData...])
```

*Stream callback* fires each time inputs arrive at the stream.

*outputFunction* is a continuation function used to forward data downstream for further processing. It is safe to invoke *outputFunction* with any number of arguments; their types do not matter. From the *stream callback*, *outputFunction* may be invoked any number of times, or not at all. There are two possible destinations for the arguments supplied to *outputFunction*. First, they are applied to all *onOutput callbacks* supplied to the *onOutput* method. Second, they are forwarded to any streams in which the current stream is an input. Arguments are guaranteed to be asynchronously forwarded on subsequent runs of the JS event loop, not the current one.

Note: a potential pitfall is that argument references are passed directly, they are not deep-copied. Streams must either defensively copy the data, or manage the mutability in other ways. J. Paul Morrison, flow-based-programming author and evangelist, recommends that to maintain consistency streams may accept many source inputs, but should avoid multiple outputs.

Exceptions thrown are caught by the stream, insulating environments from damage. Thrown exceptions have the effect of ending the *stream callback's* execution only.

The *stream callback* may return to end its execution, but values passed to return are lost.

### stream.onOutput

```
stream.onOutput(callback[, isAdded])
```

Registers an *onOutput callback* to handle output from the stream. If *onOutput callback* is supplied, it fires each time *outputFunction* is called. Note that *onOutput callback* is invoked in a future iteration of the JavaScript event loop.

Optionally, an *onOutput callback* may be removed from the stream by passing the function to remove and false as a second parameter.

The *onOutput* method returns the stream for chaining.

### stream.onOutput callback

```
function ([outputData...])
```

*onOutput callback* fires each time *outputFunction* is called from *stream callback*.

Exceptions thrown are caught by the stream, insulating environments from damage. Thrown exceptions have the effect of ending the *onOutput callback's* execution only.

The *onOutput callback* may return to end its execution, but values passed to return are lost.

### stream.input

```
stream.input([stream or array of streams...])
```

Register upstream streams to receive input from. The order of passed streams matches the order of *inputData* received in *stream callback*. Optionally, an array of streams may be passed, in which case the streams in the array will be received in *stream callback* as the same parameter when they output data.

Subsequent calls to *input* will replace any streams currently being followed with the new set of passed streams.

The *input* method returns the stream for chaining.

### stream.invoke

```
stream.invoke([value...])
```

Invoke a stream on a future iteration of the JavaScript event loop with the supplied *values*. The order of supplied *values* matches the order of *inputData* received in *stream callback*. Invoking a stream does not interfere with any followed streams attached via *input*.

The *invoke* method returns the stream for chaining.

### stream.noConflict

```
var MY_NAMESPACE.MyStream = stream.noConflict()
```

When **riffle.js** is loaded in a page, it creates a variable named *stream* in the global scope. If it is possible there is already another variable named *stream*, **noConflict** may be called to revert the global scope to its prior state.

The *noConflict* method returns the stream for chaining, or binding to a variable or object property.