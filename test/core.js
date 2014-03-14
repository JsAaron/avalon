var DOC = document;
var Registry = {} //将函数曝光到此对象上，方便访问器收集依赖
var expose = Date.now()
var subscribers = "$" + expose
var window = this || (0, eval)('this')
var otherRequire = window.require
var otherDefine = window.define
var stopRepeatAssign = false
var rword = /[^, ]+/g //切割字符串为一个个小块，以空格或豆号分开它们，结合replace实现字符串的forEach
var class2type = {}
var oproto = Object.prototype
var ohasOwn = oproto.hasOwnProperty
var prefix = "ms-"
var root = DOC.documentElement
var serialize = oproto.toString
var ap = Array.prototype
var aslice = ap.slice
var head = DOC.head //HEAD元素
var documentFragment = DOC.createDocumentFragment()
"Boolean Number String Function Array Date RegExp Object Error".replace(rword, function(name) {
    class2type["[object " + name + "]"] = name.toLowerCase()
})
var rchecktype = /^(?:object|array)$/
var rwindow = /^\[object (Window|DOMWindow|global)\]$/

function noop() {
}

function log(a) {
    window.console && console.log(a)
}
/*********************************************************************
 *                 命名空间与工具函数                                 *
 **********************************************************************/
window.avalon = function(el) { //创建jQuery式的无new 实例化结构
    return new avalon.init(el)
}
avalon.init = function(el) {
    this[0] = this.element = el
}
avalon.fn = avalon.prototype = avalon.init.prototype
//率先添加三个判定类型的方法

function getType(obj) { //取得类型
    if (obj == null) {
        return String(obj)
    }
    // 早期的webkit内核浏览器实现了已废弃的ecma262v4标准，可以将正则字面量当作函数使用，因此typeof在判定正则时会返回function
    return typeof obj === "object" || typeof obj === "function" ?
        class2type[serialize.call(obj)] || "object" :
        typeof obj
}
avalon.type = getType
avalon.isWindow = function(obj) {
    return rwindow.test(serialize.call(obj))
}

//判定是否是一个朴素的javascript对象（Object），不是DOM对象，不是BOM对象，不是自定义类的实例
avalon.isPlainObject = function(obj) {
    return !!obj && typeof obj === "object" && Object.getPrototypeOf(obj) === oproto
}

avalon.mix = avalon.fn.mix = function() {
    var options, name, src, copy, copyIsArray, clone,
        target = arguments[0] || {},
        i = 1,
        length = arguments.length,
        deep = false

    // 如果第一个参数为布尔,判定是否深拷贝
    if (typeof target === "boolean") {
        deep = target
        target = arguments[1] || {}
        i++
    }

    //确保接受方为一个复杂的数据类型
    if (typeof target !== "object" && getType(target) !== "function") {
        target = {}
    }

    //如果只有一个参数，那么新成员添加于mix所在的对象上
    if (i === length) {
        target = this
        i--
    }

    for (; i < length; i++) {
        //只处理非空参数
        if ((options = arguments[i]) != null) {
            for (name in options) {
                src = target[name]
                copy = options[name]

                // 防止环引用
                if (target === copy) {
                    continue
                }
                if (deep && copy && (avalon.isPlainObject(copy) || (copyIsArray = Array.isArray(copy)))) {
                    if (copyIsArray) {
                        copyIsArray = false
                        clone = src && Array.isArray(src) ? src : []

                    } else {
                        clone = src && avalon.isPlainObject(src) ? src : {}
                    }

                    target[name] = avalon.mix(deep, clone, copy)
                } else if (copy !== void 0) {
                    target[name] = copy
                }
            }
        }
    }
    return target
}
var eventMap = avalon.eventMap = {}

function resetNumber(a, n, end) { //用于模拟slice, splice的效果
    if ((a === +a) && !(a % 1)) { //如果是整数
        if (a < 0) { //范围调整为 [-a, a]
            a = a * -1 >= n ? 0 : a + n
        } else {
            a = a > n ? n : a
        }
    } else {
        a = end ? n : 0
    }
    return a
}

function oneObject(array, val) {
    if (typeof array === "string") {
        array = array.match(rword) || []
    }
    var result = {},
        value = val !== void 0 ? val : 1
    for (var i = 0, n = array.length; i < n; i++) {
        result[array[i]] = value
    }
    return result
}
avalon.mix({
    rword: rword,
    subscribers: subscribers,
    ui: {},
    models: {},
    log: log,
    noop: noop,
    error: function(str, e) { //如果不用Error对象封装一下，str在控制台下可能会乱码
        throw new (e || Error)(str)
    },
    oneObject: oneObject,
    /* avalon.range(10)
     => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
     avalon.range(1, 11)
     => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
     avalon.range(0, 30, 5)
     => [0, 5, 10, 15, 20, 25]
     avalon.range(0, -10, -1)
     => [0, -1, -2, -3, -4, -5, -6, -7, -8, -9]
     avalon.range(0)
     => []*/
    range: function(start, end, step) { // 用于生成整数数组
        step || (step = 1)
        if (end == null) {
            end = start || 0
            start = 0
        }
        var index = -1,
            length = Math.max(0, Math.ceil((end - start) / step)),
            result = Array(length)
        while (++index < length) {
            result[index] = start
            start += step
        }
        return result
    },
    slice: function(nodes, start, end) {
        return aslice.call(nodes, start, end)
    },
    contains: function(a, b) {
        return a.contains(b)
    },
    bind: function(el, type, fn, phase) {
        el.addEventListener(eventMap[type] || type, fn, !!phase)
        return fn
    },
    unbind: function(el, type, fn, phase) {
        el.removeEventListener(eventMap[type] || type, fn || noop, !!phase)
    },
    fire: function(el, name) {
        var event = DOC.createEvent("Event")
        event.initEvent(name, true, true)
        el.dispatchEvent(event)
    },
    css: function(node, name, value) {
        if (node instanceof avalon) {
            node = node[0]
        }
        var prop = /[_-]/.test(name) ? camelize(name) : name
        name = avalon.cssName(prop) || prop
        if (value === void 0 || typeof value === "boolean") { //获取样式
            var fn = cssHooks[prop + ":get"] || cssHooks["@:get"]
            var val = fn(node, name)
            return value === true ? parseFloat(val) || 0 : val
        } else if (value === "") { //请除样式
            node.style[name] = ""
        } else { //设置样式
            if (value == null || value !== value) {
                return
            }
            if (isFinite(value) && !avalon.cssNumber[prop]) {
                value += "px"
            }
            fn = cssHooks[prop + ":set"] || cssHooks["@:set"]
            fn(node, name, value)
        }
    },
    each: function(obj, fn) {
        if (obj) { //排除null, undefined
            var i = 0
            if (isArrayLike(obj)) {
                for (var n = obj.length; i < n; i++) {
                    fn(i, obj[i])
                }
            } else {
                for (i in obj) {
                    if (obj.hasOwnProperty(i)) {
                        fn(i, obj[i])
                    }
                }
            }
        }
    },
    getWidgetData: function(elem, prefix) {
        var raw = avalon(elem).data()
        var result = {}
        for (var i in raw) {
            if (i.indexOf(prefix) === 0) {
                result[i.replace(prefix, "").replace(/\w/, function(a) {
                    return a.toLowerCase()
                })] = raw[i]
            }
        }
        return result
    },
    getVModel: function(prop, vmodels) {//得到当前属性prop所在的VM
        for (var i = 0, el; el = vmodels[i++]; ) {
            if (el.hasOwnProperty(prop)) {
                return el
            }
        }
    },
    Array: {
        ensure: function(target, item) {
            //只有当前数组不存在此元素时只添加它
            if (target.indexOf(item) === -1) {
                target.push(item)
            }
            return target
        },
        removeAt: function(target, index) {
            //移除数组中指定位置的元素，返回布尔表示成功与否。
            return !!target.splice(index, 1).length
        },
        remove: function(target, item) {
            //移除数组中第一个匹配传参的那个元素，返回布尔表示成功与否。
            var index = target.indexOf(item)
            if (~index)
                return avalon.Array.removeAt(target, index)
            return false
        }
    }
})

function generateID() {
    //生成UUID http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript
    return "avalon" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

//只让节点集合，纯数组，arguments与拥有非负整数的length属性的纯JS对象通过

function isArrayLike(obj) {
    if (obj && typeof obj === "object") {
        var n = obj.length,
            str = serialize.call(obj)
        if (/Array|NodeList|Arguments|CSSRuleList/.test(str)) {
            return true
        } else if (str === "[object Object]" && (+n === n && !(n % 1) && n >= 0)) {
            return true //由于ecma262v5能修改对象属性的enumerable，因此不能用propertyIsEnumerable来判定了
        }
    }
    return false
}
//视浏览器情况采用最快的异步回调
avalon.nextTick = window.setImmediate ? setImmediate.bind(window) : function(callback) {
    setTimeout(callback, 0)
}
if (!root.contains) { //safari5+是把contains方法放在Element.prototype上而不是Node.prototype
    Node.prototype.contains = function(arg) {
        return !!(this.compareDocumentPosition(arg) & 16)
    }
}
