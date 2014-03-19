
/*********************************************************************
 *                         依赖收集与触发                             *
 **********************************************************************/

function registerSubscriber(data) {
    Registry[expose] = data //暴光此函数,方便collectSubscribers收集
    avalon.openComputedCollect = true
    var fn = data.evaluator
    if (fn) { //如果是求值函数
        if (data.type === "duplex") {
            data.handler()
        } else {
            data.handler(fn.apply(0, data.args), data.element, data)
        }
    } else { //如果是计算属性的accessor
        data()
    }
    avalon.openComputedCollect = false
    delete Registry[expose]
}

function collectSubscribers(accessor) { //收集依赖于这个访问器的订阅者
    if (Registry[expose]) {
        var list = accessor[subscribers]
        list && avalon.Array.ensure(list, Registry[expose]) //只有数组不存在此元素才push进去
    }
}

function notifySubscribers(accessor) { //通知依赖于这个访问器的订阅者更新自身
    var list = accessor[subscribers]
    if (list && list.length) {
        var args = aslice.call(arguments, 1)
        for (var i = list.length, fn; fn = list[--i]; ) {
            var el = fn.element
            if (el && !ifSanctuary.contains(el) && (!root.contains(el))) {
                list.splice(i, 1)
                log("remove " + fn.name)
            } else if (typeof fn === "function") {
                fn.apply(0, args) //强制重新计算自身
            } else if (fn.getter) {
                fn.handler.apply(fn, args) //强制重新计算自身
            } else {
                fn.handler(fn.evaluator.apply(0, fn.args || []), el, fn)
            }
        }
    }
}


/*********************************************************************
 *                            扫描系统                                *
 **********************************************************************/
avalon.scan = function(elem, vmodel) {
    elem = elem || root
    var vmodels = vmodel ? [].concat(vmodel) : []
    scanTag(elem, vmodels)
}

//http://www.w3.org/TR/html5/syntax.html#void-elements
var stopScan = oneObject("area,base,basefont,br,col,command,embed,hr,img,input,link,meta,param,source,track,wbr,noscript,noscript,script,style,textarea".toUpperCase())

//确保元素的内容被完全扫描渲染完毕才调用回调
function checkScan(elem, callback) {
    var innerHTML = NaN,
        id = setInterval(function() {
            var currHTML = elem.innerHTML
            if (currHTML === innerHTML) {
                clearInterval(id)
                callback()
            } else {
                innerHTML = currHTML
            }
        }, 15)
}


function scanTag(elem, vmodels, node) {
    //扫描顺序  ms-skip(0) --> ms-important(1) --> ms-controller(2) --> ms-if(10) --> ms-repeat(100)
    //--> ms-if-loop(110) --> ms-attr(970) ...--> ms-each(1400)-->ms-with(1500)--〉ms-duplex(2000)垫后
    var a = elem.getAttribute(prefix + "skip")
    var b = elem.getAttributeNode(prefix + "important")
    var c = elem.getAttributeNode(prefix + "controller")
    if (typeof a === "string") {
        return
    } else if (node = b || c) {
        var newVmodel = VMODELS[node.value]
        if (!newVmodel) {
            return
        }
        if (elem.msLoopData) {
            delete VMODELS[node.value]
        }
        //ms-important不包含父VM，ms-controller相反
        vmodels = node === b ? [newVmodel] : [newVmodel].concat(vmodels)
        elem.removeAttribute(node.name) //removeAttributeNode不会刷新[ms-controller]样式规则
        elem.classList.remove(node.name)
    }
    scanAttr(elem, vmodels) //扫描特性节点
}

function scanNodes(parent, vmodels) {
    var node = parent.firstChild
    while (node) {
        var nextNode = node.nextSibling
        if (node.nodeType === 1) {
            scanTag(node, vmodels) //扫描元素节点
        } else if (node.nodeType === 3 && rexpr.test(node.data)) {
            scanText(node, vmodels) //扫描文本节点
        }
        node = nextNode
    }
}

function scanText(textNode, vmodels) {
    var bindings = [],
        tokens = scanExpr(textNode.data)
    if (tokens.length) {
        for (var i = 0, token; token = tokens[i++]; ) {
            var node = DOC.createTextNode(token.value) //将文本转换为文本节点，并替换原来的文本节点
            if (token.expr) {
                var filters = token.filters
                var binding = {
                    type: "text",
                    node: node,
                    nodeType: 3,
                    value: token.value,
                    filters: filters
                }
                if (filters && filters.indexOf("html") !== -1) {
                    avalon.Array.remove(filters, "html")
                    binding.type = "html"
                    binding.replaceNodes = [node]
                    if (!filters.length) {
                        delete bindings.filters
                    }
                }
                bindings.push(binding) //收集带有插值表达式的文本
            }
            documentFragment.appendChild(node)
        }
        textNode.parentNode.replaceChild(documentFragment, textNode)
        executeBindings(bindings, vmodels)
    }
}

var rmsAttr = /ms-(\w+)-?(.*)/
var priorityMap = {
    "if": 10,
    "repeat": 100,
    "each": 1400,
    "with": 1500,
    "duplex": 2000
}


function scanAttr(elem, vmodels) {
    var attributes = elem.attributes
    var bindings = [], msData = {},
        match
    for (var i = 0, attr; attr = attributes[i++]; ) {
        if (attr.specified) { //特性
            if (match = attr.name.match(rmsAttr)) {
                //如果是以指定前缀命名的
                var type = match[1]
                msData[attr.name] = attr.value
                if (typeof bindingHandlers[type] === "function") {//必须有对应的处理器
                    var param = match[2] || ""
                    var binding = {
                        type: type,
                        param: param,
                        element: elem,
                        name: match[0],
                        value: attr.value,
                        //权重
                        priority: type in priorityMap ? priorityMap[type] : type.charCodeAt(0) * 10 + (Number(param) || 0)
                    }
                    if (type === "if" && param === "loop") {
                        binding.priority += 100
                    }
                    if (type === "widget") {
                        bindings.push(binding)
                        elem.msData = elem.msData || msData
                    } else if (vmodels.length) {
                        bindings.push(binding)
                    }
                }
            }
        }
    }
    if (msData["ms-checked"] && msData["ms-duplex"]) {
        avalon.log("warning!一个元素上不能同时定义ms-checked与ms-duplex")
    }
    //权重排序
    bindings.sort(function(a, b) {
        return a.priority - b.priority
    })
    var firstBinding = bindings[0] || {}
    switch (firstBinding.type) {
        case "if":
        case "repeat":
            executeBindings([firstBinding], vmodels)
            break
        default:
            executeBindings(bindings, vmodels)
            if (!stopScan[elem.tagName] && rbind.test(elem.innerHTML)) {
                scanNodes(elem, vmodels) //扫描子孙元素
            }
            break;
    }
    var data = elem.msLoopData
    if (data) {
        delete elem.msLoopData
        if (typeof data.group !== "number") {
            data.group = elem.childNodes.length
        }
        var p = elem.parentNode
        while (elem.firstChild) {
            p.insertBefore(elem.firstChild, elem)
        }
        p.removeChild(elem)
    }
}

function executeBindings(bindings, vmodels) {
    for (var i = 0, data; data = bindings[i++]; ) {
        data.vmodels = vmodels
        bindingHandlers[data.type](data, vmodels)
        if (data.evaluator && data.name) { //移除数据绑定，防止被二次解析
            //chrome使用removeAttributeNode移除不存在的特性节点时会报错 https://github.com/RubyLouvre/avalon/issues/99
            data.element.removeAttribute(data.name)
        }
    }
    bindings.length = 0
}

var rfilters = /\|\s*(\w+)\s*(\([^)]*\))?/g,
    r11a = /\|\|/g,
    r11b = /U2hvcnRDaXJjdWl0/g

function scanExpr(str) {
    var tokens = [],
        value, start = 0,
        stop

    do {
        stop = str.indexOf(openTag, start)
        if (stop === -1) {
            break
        }
        value = str.slice(start, stop)
        if (value) { // {{ 左边的文本
            tokens.push({
                value: value,
                expr: false
            })
        }
        start = stop + openTag.length
        stop = str.indexOf(closeTag, start)
        if (stop === -1) {
            break
        }
        value = str.slice(start, stop)
        if (value) { //处理{{ }}插值表达式
            var leach = []
            if (value.indexOf("|") > 0) { // 抽取过滤器 先替换掉所有短路与
                value = value.replace(r11a, "U2hvcnRDaXJjdWl0") //btoa("ShortCircuit")
                value = value.replace(rfilters, function(c, d, e) {
                    leach.push(d + (e || ""))
                    return ""
                })
                value = value.replace(r11b, "||") //还原短路与
            }
            tokens.push({
                value: value,
                expr: true,
                filters: leach.length ? leach : void 0
            })
        }
        start = stop + closeTag.length
    } while (1)
    value = str.slice(start)
    if (value) { //}} 右边的文本
        tokens.push({
            value: value,
            expr: false
        })
    }

    return tokens
}
   