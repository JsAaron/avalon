/*********************************************************************
 *                           Observable                                 *
 **********************************************************************/
var Observable = {
    $watch: function(type, callback) {
        if (typeof callback === "function") {
            var callbacks = this.$events[type]
            if (callbacks) {
                callbacks.push(callback)
            } else {
                this.$events[type] = [callback]
            }
        } else { //重新开始监听此VM的第一重简单属性的变动
            this.$events = this.$watch.backup
        }
        return this
    },
    $unwatch: function(type, callback) {
        var n = arguments.length
        if (n === 0) { //让此VM的所有$watch回调无效化
            this.$watch.backup = this.$events
            this.$events = {}
        } else if (n === 1) {
            this.$events[type] = []
        } else {
            var callbacks = this.$events[type] || []
            var i = callbacks.length
            while (~--i < 0) {
                if (callbacks[i] === callback) {
                    return callbacks.splice(i, 1)
                }
            }
        }
        return this
    },
    $fire: function(type) {
        var callbacks = this.$events[type] || [] //防止影响原数组
        var all = this.$events.$all || []
        var args = aslice.call(arguments, 1)
        for (var i = 0, callback; callback = callbacks[i++]; ) {
            callback.apply(this, args)
        }
        for (var i = 0, callback; callback = all[i++]; ) {
            callback.apply(this, arguments)
        }
    }
}
