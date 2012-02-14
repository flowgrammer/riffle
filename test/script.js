!function (win,doc,timeout) {
    var script = doc.getElementsByTagName('script')[0],
        re = /in/,
        old = win.$script,
        $script = function (path,callback) {
            if (!callback.call) { return; }
            timeout(function(){
                var el = doc.createElement('script');
                el.onload = el.onreadystatechange = function() {
                    if (el.readyState && !(!re.test(el.readyState))) {
                        return;
                    }
                    el.onload = el.onreadystatechange = null;
                    callback();
                };
                el.async = 1;
                el.src = path;
                script.parentNode.insertBefore(el, script);
            }, 0);
            return $script;
        };
    $script.noConflict = function(){
        win.$script = old;
        return this;
    };
    (typeof module !== 'undefined' && module.exports) ? (module.exports = $script) : (win.$script = $script);
}(this, document, setTimeout);