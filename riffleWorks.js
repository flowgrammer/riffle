var r = require('./riffle.js');

r1 = r(function (out, a) {
   console.log(a);
   out();
});

r1.invoke('test');
