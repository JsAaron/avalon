
/*********************************************************************
 *                           modelFactory                              *
 **********************************************************************/
var VMODELS = avalon.vmodels = {}
avalon.define = function(name, factory) {
    if (typeof name !== "string") {
        avalon.error("必须指定ID")
    }
    if (typeof factory !== "function") {
        avalon.error("factory必须是函数")
    }
    var scope = {
        $watch: noop
    }
    factory(scope) //得到所有定义
    var model = modelFactory(scope) //偷天换日，将scope换为model
    stopRepeatAssign = true
    factory(model)
    stopRepeatAssign = false
    model.$id = name
    return VMODELS[name] = model
}

function modelFactory(scope, model) {
    if (Array.isArray(scope)) {
        var arr = scope.concat()//原数组的作为新生成的监控数组的$model而存在
        scope.length = 0
        var collection = Collection(scope)
        collection.push.apply(collection, arr)
        return collection
    }
    if (typeof scope.nodeType === "number") {
        return scope
    }
    var vmodel = {} //要返回的对象
    model = model || {} //放置$model上的属性
    var accessingProperties = {} //监控属性
    var normalProperties = {} //普通属性
    var computedProperties = [] //计算属性
    var watchProperties = arguments[2] || {} //强制要监听的属性
    var skipArray = scope.$skipArray //要忽略监控的属性
    for (var i = 0, name; name = skipProperties[i++]; ) {
        delete scope[name]
        normalProperties[name] = true
    }
    if (Array.isArray(skipArray)) {
        for (var i = 0, name; name = skipArray[i++]; ) {
            normalProperties[name] = true
        }
    }
    for (var i in scope) {
        loopModel(i, scope[i], model, normalProperties, accessingProperties, computedProperties, watchProperties)
    }
    vmodel = Object.defineProperties(vmodel, descriptorFactory(accessingProperties)) //生成一个空的ViewModel
    for (var name in normalProperties) {
        vmodel[name] = normalProperties[name]
    }
    watchProperties.vmodel = vmodel
    vmodel.$model = model
    vmodel.$events = {}
    vmodel.$id = generateID()
    vmodel.$accessors = accessingProperties
    vmodel[subscribers] = []
    for (var i in Observable) {
        vmodel[i] = Observable[i]
    }
    Object.defineProperty(vmodel, "hasOwnProperty", {
        value: function(name) {
            return name in vmodel.$model
        },
        writable: false,
        enumerable: false,
        configurable: true
    })
    for (var i = 0, fn; fn = computedProperties[i++]; ) { //最后强逼计算属性 计算自己的值
        Registry[expose] = fn
        fn()
        collectSubscribers(fn)
        delete Registry[expose]
    }
    return vmodel
}
var skipProperties = String("$id,$watch,$unwatch,$fire,$events,$model,$skipArray,$accessors," + subscribers).match(rword)

function isEqual(x, y) {
    if (x === y) {
        return x instanceof Date ? x - 0 === y - 0 : !0
    }
    return x !== x && y !== y
}

function safeFire(a, b, c, d) {
    if (a.$events) {
        Observable.$fire.call(a, b, c, d)
    }
}

function descriptorFactory(obj) {
    var descriptors = {}
    for (var i in obj) {
        descriptors[i] = {
            get: obj[i],
            set: obj[i],
            enumerable: true,
            configurable: true
        }
    }
    return descriptors
}

function loopModel(name, val, model, normalProperties, accessingProperties, computedProperties, watchProperties) {
    model[name] = val
    if (normalProperties[name] || (val && val.nodeType)) { //如果是指明不用监控的系统属性或元素节点，或放到 $skipArray里面
        return normalProperties[name] = val
    }
    if (name.charAt(0) === "$" && !watchProperties[name]) { //如果是$开头，并且不在watchMore里面的
        return normalProperties[name] = val
    }
    var valueType = getType(val)
    if (valueType === "function") { //如果是函数，也不用监控
        return normalProperties[name] = val
    }
    var accessor, oldArgs
    if (valueType === "object" && typeof val.get === "function" && Object.keys(val).length <= 2) {
        var setter = val.set,
            getter = val.get
        accessor = function(newValue) { //创建计算属性，因变量，基本上由其他监控属性触发其改变
            var vmodel = watchProperties.vmodel
            var value = model[name],
                preValue = value
            if (arguments.length) {
                if (stopRepeatAssign) {
                    return //阻止重复赋值
                }
                if (typeof setter === "function") {
                    var backup = vmodel.$events[name]
                    vmodel.$events[name] = [] //清空回调，防止内部冒泡而触发多次$fire
                    setter.call(vmodel, newValue)
                    vmodel.$events[name] = backup
                }
                if (!isEqual(oldArgs, newValue)) { //只检测用户的传参是否与上次是否一致
                    oldArgs = newValue
                    newValue = model[name] = getter.call(vmodel)
                    withProxyCount && updateWithProxy(vmodel.$id, name, newValue)
                    notifySubscribers(accessor) //通知顶层改变
                    safeFire(vmodel, name, newValue, preValue)
                }
            } else {
                if (avalon.openComputedCollect) { // 收集视图刷新函数
                    collectSubscribers(accessor)
                }
                newValue = model[name] = getter.call(vmodel)
                if (!isEqual(value, newValue)) {
                    oldArgs = void 0
                    safeFire(vmodel, name, newValue, preValue)
                }
                return newValue
            }
        }
        accessor[subscribers] = [] //订阅者数组
        computedProperties.push(accessor)
    } else {
        accessor = function(newValue) { //创建监控属性或数组，自变量，由用户触发其改变
            var vmodel = watchProperties.vmodel
            var preValue = model[name],
                simpleType
            if (arguments.length) {
                if (stopRepeatAssign) {
                    return //阻止重复赋值
                }
                if (!isEqual(preValue, newValue)) {
                    if (rchecktype.test(valueType)) {
                        var value = accessor.$vmodel = updateVModel(accessor.$vmodel, newValue, valueType)
                        var fn = rebindings[value.$id]
                        fn && fn()
                        withProxyCount && updateWithProxy(vmodel.$id, name, value)
                        safeFire(vmodel, name, value.$model, preValue)
                        accessor[subscribers] = value[subscribers]
                        model[name] = value.$model
                    } else { //如果是其他数据类型
                        model[name] = newValue //更新$model中的值
                        simpleType = true
                        withProxyCount && updateWithProxy(vmodel.$id, name, newValue)
                    }
                    notifySubscribers(accessor) //通知顶层改变
                    if (simpleType) {
                        safeFire(vmodel, name, newValue, preValue)
                    }
                }
            } else {
                collectSubscribers(accessor) //收集视图函数
                return accessor.$vmodel || preValue
            }
        }
        accessor[subscribers] = [] //订阅者数组
        if (rchecktype.test(valueType)) {
            var complexValue = val.$model ? val : modelFactory(val, val)
            accessor.$vmodel = complexValue
            accessor[subscribers] = complexValue[subscribers]
            model[name] = complexValue.$model
        } else {
            model[name] = val
        }
    }
    accessingProperties[name] = accessor
}
//with绑定生成的代理对象储存池
var withProxyPool = {}
var withProxyCount = 0
var rebindings = {}

function updateWithProxy($id, name, val) {
    var pool = withProxyPool[$id]
    if (pool && pool[name]) {
        pool[name].$val = val
    }
}

function updateVModel(a, b, valueType) {
    //a为原来的VM， b为新数组或新对象
    if (valueType === "array") {
        if (!Array.isArray(b)) {
            return a //fix https://github.com/RubyLouvre/avalon/issues/261
        }
        var bb = b.concat()
        a.clear()
        a.push.apply(a, bb)
        return a
    } else {
        var iterators = a[subscribers]
        if (withProxyPool[a.$id]) {
            withProxyCount--
            delete withProxyPool[a.$id]
        }
        iterators.forEach(function(data) {
            data.rollback && data.rollback()
        })
        var ret = modelFactory(b)
        rebindings[ret.$id] = function(data) {
            while (data = iterators.shift()) {
                (function(el) {
                    if (el.type) {
                        avalon.nextTick(function() {
                            bindingHandlers[el.type](el, el.vmodels)
                        })
                    }
                })(data)
            }
            delete rebindings[ret.$id]
        }
        return ret
    }
}
