
/*********************************************************************
 *绑定模块（实现“操作数据即操作DOM”的关键，将DOM操作放逐出前端开发人员的视野，让它交由框架自行处理，开发人员专致于业务本身） *                                 *
 **********************************************************************/
var cacheDisplay = oneObject("a,abbr,b,span,strong,em,font,i,kbd", "inline")
avalon.mix(cacheDisplay, oneObject("div,h1,h2,h3,h4,h5,h6,section,p", "block"))

function parseDisplay(nodeName, val) {
    //用于取得此类标签的默认display值
    nodeName = nodeName.toLowerCase()
    if (!cacheDisplay[nodeName]) {
        var node = DOC.createElement(nodeName)
        root.appendChild(node)
        val = window.getComputedStyle(node, null).display
        root.removeChild(node)
        cacheDisplay[nodeName] = val
    }
    return cacheDisplay[nodeName]
}
avalon.parseDisplay = parseDisplay
var supportDisplay = (function(td) {
    return window.getComputedStyle ?
        window.getComputedStyle(td, null).display == "table-cell" : true
})(DOC.createElement("td"))
var rdash = /\(([^)]*)\)/
head.insertAdjacentHTML("afterBegin", '<style id="avalonStyle">.avalonHide{ display: none!important }</style>')
var getBindingCallback = function(elem, name, vmodels) {
    var callback = elem.getAttribute(name)
    if (callback) {
        for (var i = 0, vm; vm = vmodels[i++]; ) {
            if (vm.hasOwnProperty(callback) && typeof vm[callback] === "function") {
                return vm[callback]
            }
        }
    }
}
var includeContents = {}
var ifSanctuary = DOC.createElement("div")
//这里的函数每当VM发生改变后，都会被执行（操作方为notifySubscribers）
var bindingExecutors = avalon.bindingExecutors = {
    "attr": function(val, elem, data) {
        var method = data.type,
            attrName = data.param

        function scanTemplate(text) {
            if (loaded) {
                text = loaded.apply(elem, [text].concat(vmodels))
            }
            avalon.innerHTML(elem, text)
            scanNodes(elem, vmodels)
            rendered && checkScan(elem, function() {
                rendered.call(elem)
            })
        }

        if (method === "css") {
            avalon(elem).css(attrName, val)
        } else if (method === "attr") {
            // ms-attr-class="xxx" vm.xxx="aaa bbb ccc"将元素的className设置为aaa bbb ccc
            // ms-attr-class="xxx" vm.xxx=false  清空元素的所有类名
            // ms-attr-name="yyy"  vm.yyy="ooo" 为元素设置name属性
            var toRemove = (val === false) || (val === null) || (val === void 0)
            if (toRemove) {
                elem.removeAttribute(attrName)
            } else {
                elem.setAttribute(attrName, val)
            }
        } else if (method === "include" && val) {
            var vmodels = data.vmodels
            var rendered = getBindingCallback(elem, "data-include-rendered", vmodels)
            var loaded = getBindingCallback(elem, "data-include-loaded", vmodels)


            if (data.param === "src") {
                if (includeContents[val]) {
                    scanTemplate(includeContents[val])
                } else {
                    var xhr = new window.XMLHttpRequest
                    xhr.onload = function() {
                        var s = xhr.status
                        if (s >= 200 && s < 300 || s === 304) {
                            scanTemplate(includeContents[val] = xhr.responseText)
                        }
                    }
                    xhr.open("GET", val, true)
                    xhr.withCredentials = true
                    xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest")
                    xhr.send(null)
                }
            } else {
                //IE系列与够新的标准浏览器支持通过ID取得元素（firefox14+）
                //http://tjvantoll.com/2012/07/19/dom-element-references-as-global-variables/
                var el = val && val.nodeType == 1 ? val : DOC.getElementById(val)
                avalon.nextTick(function() {
                    scanTemplate(el.innerText || el.innerHTML)
                })
            }
        } else {
            elem[method] = val
        }
    },
    "class": function(val, elem, data) {
        var $elem = avalon(elem),
            method = data.type
        if (method === "class" && data.param) { //如果是旧风格
            $elem.toggleClass(data.param, !!val)
        } else {
            var toggle = data._evaluator ? !!data._evaluator.apply(elem, data._args) : true
            var className = data._class || val
            switch (method) {
                case "class":
                    if (toggle && data.oldClass) {
                        $elem.removeClass(data.oldClass)
                    }
                    $elem.toggleClass(className, toggle)
                    data.oldClass = className
                    break;
                case "hover":
                case "active":
                    if (!data.init) {
                        if (method === "hover") { //在移出移入时切换类名
                            var event1 = "mouseenter",
                                event2 = "mouseleave"
                        } else { //在聚焦失焦中切换类名
                            elem.tabIndex = elem.tabIndex || -1
                            event1 = "mousedown", event2 = "mouseup"
                            $elem.bind("mouseleave", function() {
                                toggle && $elem.removeClass(className)
                            })
                        }
                        $elem.bind(event1, function() {
                            toggle && $elem.addClass(className)
                        })
                        $elem.bind(event2, function() {
                            toggle && $elem.removeClass(className)
                        })
                        data.init = 1
                    }
                    break;
            }
        }
    },
    "data": function(val, elem, data) {
        var key = "data-" + data.param
        if (val && typeof val === "object") {
            elem[key] = val
        } else {
            elem.setAttribute(key, String(val))
        }
    },
    "checked": function(val, elem, data) {
        var name = data.type;
        if (name === "enabled") {
            elem.disabled = !val
        } else {
            var propName = name === "readonly" ? "readOnly" : name
            elem[propName] = !!val
        }
    },
    "each": function(method, pos, el) {
        var data = this
        var group = data.group
        var pp = data.startRepeat && data.startRepeat.parentNode
        if (pp) {//fix  #300 #307
            data.parent = pp
        }
        var parent = data.parent
        var proxies = data.proxies
        if (method == "del" || method == "move") {
            var locatedNode = getLocatedNode(parent, data, pos)
        }
        switch (method) {
            case "add":
                //在pos位置后添加el数组（pos为数字，el为数组）
                var arr = el
                var last = data.getter().length - 1
                var transation = documentFragment.cloneNode(false)
                var spans = []
                for (var i = 0, n = arr.length; i < n; i++) {
                    var ii = i + pos
                    var proxy = createEachProxy(ii, arr[i], data, last)
                    proxies.splice(ii, 0, proxy)
                    shimController(data, transation, spans, proxy)
                }
                locatedNode = getLocatedNode(parent, data, pos)
                parent.insertBefore(transation, locatedNode)
                for (var i = 0, el; el = spans[i++]; ) {
                    scanTag(el, data.vmodels)
                }
                spans = null
                break
            case "del"://将pos后的el个元素删掉(pos, el都是数字)
                proxies.splice(pos, el)
                removeFromSanctuary(removeView(locatedNode, group, el))
                break
            case "index"://将proxies中的第pos个起的所有元素重新索引（pos为数字，el用作循环变量）
                var last = proxies.length - 1
                for (; el = proxies[pos]; pos++) {
                    el.$index = pos
                    el.$first = pos === 0
                    el.$last = pos === last
                }
                break
            case "clear":
                var deleteFragment = documentFragment.cloneNode(false)
                if (data.startRepeat) {
                    while (true) {
                        var node = data.startRepeat.nextSibling
                        if (node && node !== data.endRepeat) {
                            deleteFragment.appendChild(node)
                        } else {
                            break
                        }
                    }
                } else {
                    while (parent.firstChild) {
                        deleteFragment.appendChild(parent.firstChild)
                    }
                }
                removeFromSanctuary(deleteFragment)
                if (proxies)
                    proxies.length = 0
                break
            case "move"://将proxies中的第pos个元素移动el位置上(pos, el都是数字)
                var t = proxies.splice(pos, 1)[0]
                if (t) {
                    proxies.splice(el, 0, t)
                    var moveNode = removeView(locatedNode, group)
                    locatedNode = getLocatedNode(parent, data, el)
                    parent.insertBefore(moveNode, locatedNode)
                }
                break
            case "set"://将proxies中的第pos个元素的VM设置为el（pos为数字，el任意）
                var proxy = proxies[pos]
                if (proxy) {
                    proxy[proxy.$itemName] = el
                }
                break
            case "append"://将pos的键值对从el中取出（pos为一个普通对象，el为预先生成好的代理VM对象池）
                var pool = el
                var transation = documentFragment.cloneNode(false)
                var callback = getBindingCallback(data.callbackElement, "data-with-sorted", data.vmodels)
                var keys = []
                var spans = []
                for (var key in pos) { //得到所有键名
                    if (pos.hasOwnProperty(key)) {
                        keys.push(key)
                    }
                }
                if (callback) { //如果有回调，则让它们排序
                    var keys2 = callback.call(parent, keys)
                    if (keys2 && Array.isArray(keys2) && keys2.length) {
                        keys = keys2
                    }
                }
                for (var i = 0, key; key = keys[i++]; ) {
                    shimController(data, transation, spans, pool[key])
                }
                parent.insertBefore(transation, data.endRepeat || null)
                for (var i = 0, el; el = spans[i++]; ) {
                    scanTag(el, data.vmodels)
                }
                spans = null
                break
        }
        iteratorCallback.call(data, arguments)
    },
    "html": function(val, elem, data) {
        val = val == null ? "" : val
        if (!elem) {
            elem = data.element = data.node.parentNode
        }
        if (data.replaceNodes) {
            var fragment, nodes
            if (val.nodeType === 11) {
                fragment = val
            } else if (val.nodeType === 1 || val.item) {
                nodes = val.nodeType === 1 ? val.childNodes : val.item ? val : []
                fragment = documentFragment.cloneNode(true)
                while (nodes[0]) {
                    fragment.appendChild(nodes[0])
                }
            } else {
                fragment = avalon.parseHTML(val)
            }
            var replaceNodes = avalon.slice(fragment.childNodes)
            elem.insertBefore(fragment, data.replaceNodes[0] || null)
            for (var i = 0, node; node = data.replaceNodes[i++]; ) {
                elem.removeChild(node)
            }
            data.replaceNodes = replaceNodes
        } else {
            avalon.innerHTML(elem, val)
        }
        avalon.nextTick(function() {
            scanNodes(elem, data.vmodels)
        })
    },
    "if": function(val, elem, data) {
        var placehoder = data.placehoder
        if (val) { //插回DOM树
            if (!data.msInDocument) {
                data.msInDocument = true
                try {
                    placehoder.parentNode.replaceChild(elem, placehoder)
                } catch (e) {
                    avalon.log("ms-if errer" + e.message)
                }
            }
        } else { //移出DOM树，放进ifSanctuary DIV中，并用注释节点占据原位置
            if (data.msInDocument) {
                data.msInDocument = false
                elem.parentNode.replaceChild(placehoder, elem)
                placehoder.elem = elem
                ifSanctuary.appendChild(elem)
            }
        }
    },
    "on": function(val, elem, data) {
        var fn = data.evaluator
        var args = data.args
        var vmodels = data.vmodels
        if (!data.hasArgs) {
            callback = function(e) {
                return fn.apply(0, args).call(this, e)
            }
        } else {
            callback = function(e) {
                return fn.apply(this, args.concat(e))
            }
        }
        elem.$vmodel = vmodels[0]
        elem.$vmodels = vmodels
        if (typeof data.specialBind === "function") {
            data.specialBind(elem, callback)
        } else {
            var removeFn = avalon.bind(elem, data.param, callback)
        }
        data.rollback = function() {
            if (typeof data.specialUnbind === "function") {
                data.specialUnbind()
            } else {
                avalon.unbind(elem, data.param, removeFn)
            }
        }
        data.evaluator = data.handler = noop
    },
    "text": function(val, elem, data) {
        val = val == null ? "" : val //不在页面上显示undefined null
        if (data.nodeType === 3) { //绑定在文本节点上
            data.node.data = val
        } else { //绑定在特性节点上
            if (!elem) {
                elem = data.element = data.node.parentNode
            }
            elem.textContent = val
        }
    },
    "visible": function(val, elem, data) {
        elem.style.display = val ? data.display : "none"
    },
    "widget": noop
}
//这里的函数只会在第一次被扫描后被执行一次，并放进行对应VM属性的subscribers数组内（操作方为registerSubscriber）
var bindingHandlers = avalon.bindingHandlers = {
    //这是一个字符串属性绑定的范本, 方便你在title, alt,  src, href, include, css添加插值表达式
    //<a ms-href="{{url.hostname}}/{{url.pathname}}.html">
    "attr": function(data, vmodels) {
        var text = data.value.trim(),
            simple = true
        if (text.indexOf(openTag) > -1 && text.indexOf(closeTag) > 2) {
            simple = false
            if (rexpr.test(text) && RegExp.rightContext === "" && RegExp.leftContext === "") {
                simple = true
                text = RegExp.$1
            }
        }
        data.handlerName = "attr" //handleName用于处理多种绑定共用同一种bindingExecutor的情况
        parseExprProxy(text, vmodels, data, (simple ? null : scanExpr(data.value)))
    },
    //根据VM的属性值或表达式的值切换类名，ms-class="xxx yyy zzz:flag"
    //http://www.cnblogs.com/rubylouvre/archive/2012/12/17/2818540.html
    "class": function(data, vmodels) {
        var oldStyle = data.param,
            text = data.value,
            rightExpr
        data.handlerName = "class"
        if (!oldStyle || isFinite(oldStyle)) {
            data.param = "" //去掉数字
            var noExpr = text.replace(rexprg, function(a) {
                return Math.pow(10, a.length - 1) //将插值表达式插入10的N-1次方来占位
            })
            var colonIndex = noExpr.indexOf(":") //取得第一个冒号的位置
            if (colonIndex === -1) { // 比如 ms-class="aaa bbb ccc" 的情况
                var className = text
            } else { // 比如 ms-class-1="ui-state-active:checked" 的情况
                className = text.slice(0, colonIndex)
                rightExpr = text.slice(colonIndex + 1)
                parseExpr(rightExpr, vmodels, data) //决定是添加还是删除
                if (!data.evaluator) {
                    log("'" + (rightExpr || "").trim() + "' 不存在于VM中")
                    return false
                } else {
                    data._evaluator = data.evaluator
                    data._args = data.args
                }
            }
            var hasExpr = rexpr.test(className) //比如ms-class="width{{w}}"的情况
            if (!hasExpr) {
                data._class = className
            }
            parseExprProxy("", vmodels, data, (hasExpr ? scanExpr(className) : null))
        } else if (data.type === "class") {
            parseExprProxy(text, vmodels, data)
        }
    },
    "checked": function(data, vmodels) {
        data.handlerName = "checked"
        parseExprProxy(data.value, vmodels, data)
    },
    "duplex": function(data, vmodels) {
        var elem = data.element,
            tagName = elem.tagName
        if (typeof modelBinding[tagName] === "function") {
            data.changed = getBindingCallback(elem, "data-duplex-changed", vmodels)
            //由于情况特殊，不再经过parseExprProxy
            parseExpr(data.value, vmodels, data, "duplex")
            if (data.evaluator && data.args) {
                var form = elem.form
                if (form && form.msValidate) {
                    form.msValidate(elem)
                }
                modelBinding[elem.tagName](elem, data.evaluator.apply(null, data.args), data)
            }
        }
    },
    "each": function(data, vmodels) {
        var type = data.type,
            elem = data.element,
            list
        parseExpr(data.value, vmodels, data)
        data.getter = function() {
            return this.evaluator.apply(0, this.args || [])
        }
        data.handler = bindingExecutors.each
        data.callbackName = "data-" + (type || "each") + "-rendered"
        data.callbackElement = data.parent = elem
        var freturn = true
        try {
            list = data.getter()
            if (rchecktype.test(getType(list))) {
                freturn = false
            }
        } catch (e) {
        }
        var check0 = "$key",
            check1 = "$val"
        if (Array.isArray(list)) {
            check0 = "$first"
            check1 = "$last"
        }
        for (var i = 0, p; p = vmodels[i++]; ) {
            if (p.hasOwnProperty(check0) && p.hasOwnProperty(check1)) {
                data.$outer = p
                break
            }
        }
        data.$outer = data.$outer || {}
        var template = documentFragment.cloneNode(false)
        if (type === "repeat") {
            var startRepeat = DOC.createComment("ms-repeat-start")
            var endRepeat = DOC.createComment("ms-repeat-end")
            data.element = data.parent = elem.parentNode
            data.startRepeat = startRepeat
            data.endRepeat = endRepeat
            elem.removeAttribute(data.name)
            data.parent.replaceChild(endRepeat, elem)
            data.parent.insertBefore(startRepeat, endRepeat)
            template.appendChild(elem)
        } else {
            while (elem.firstChild) {
                template.appendChild(elem.firstChild)
            }
        }
        data.template = template
        if (freturn) {
            return
        }
        list[subscribers] && list[subscribers].push(data)
        if (!Array.isArray(list) && type !== "each") {
            var pool = withProxyPool[list.$id]
            if (!pool) {
                withProxyCount++
                pool = withProxyPool[list.$id] = {}
                for (var key in list) {
                    if (list.hasOwnProperty(key)) {
                        (function(k, v) {
                            pool[k] = createWithProxy(k, v, data.$outer)
                            pool[k].$watch("$val", function(val) {
                                list[k] = val//#303
                            })
                        })(key, list[key])
                    }
                }
            }
            data.rollback = function() {
                bindingExecutors.each.call(data, "clear")
                var endRepeat = data.endRepeat
                var parent = data.parent
                parent.insertBefore(data.template, endRepeat || null)
                if (endRepeat) {
                    parent.removeChild(endRepeat)
                    parent.removeChild(this.startRepeat)
                    data.element = data.callbackElement
                }
            }
            data.handler("append", list, pool)
        } else {
            data.proxies = []
            data.handler("add", 0, list)
        }
    },
    "html": function(data, vmodels) {
        parseExprProxy(data.value, vmodels, data)
    },
    "if": function(data, vmodels) {
        var elem = data.element
        elem.removeAttribute(data.name)
        if (!data.placehoder) {
            data.msInDocument = data.placehoder = DOC.createComment("ms-if")
        }
        data.vmodels = vmodels
        scanAttr(elem, vmodels)
        parseExprProxy(data.value, vmodels, data)
    },
    "on": function(data, vmodels) {
        var value = data.value,
            four = "$event"
        if (value.indexOf("(") > 0 && value.indexOf(")") > -1) {
            var matched = (value.match(rdash) || ["", ""])[1].trim()
            if (matched === "" || matched === "$event") { // aaa() aaa($event)当成aaa处理
                four = void 0
                value = value.replace(rdash, "")
            }
        } else {
            four = void 0
        }
        data.type = "on"
        data.hasArgs = four
        data.handlerName = "on"
        parseExprProxy(value, vmodels, data, four)
    },
    "visible": function(data, vmodels) {
        var elem = data.element
        if (!supportDisplay && !root.contains(elem)) { //fuck firfox 全家！
            var display = parseDisplay(elem.tagName)
        }
        display = display || avalon(elem).css("display")
        data.display = display === "none" ? parseDisplay(elem.tagName) : display
        parseExprProxy(data.value, vmodels, data)
    },
    "widget": function(data, vmodels) {
        var args = data.value.match(rword),
            element = data.element,
            widget = args[0],
            vmOptions = {}
        if (args[1] === "$") {
            args[1] = void 0
        }
        if (!args[1]) {
            args[1] = widget + setTimeout("1")
        }
        data.value = args.join(",")
        var constructor = avalon.ui[widget]
        if (typeof constructor === "function") { //ms-widget="tabs,tabsAAA,optname"
            vmodels = element.vmodels || vmodels
            for (var i = 0, v; v = vmodels[i++]; ) {
                if (VMODELS[v.$id]) { //取得离它最近由用户定义的VM
                    var nearestVM = v
                    break
                }
            }
            var optName = args[2] || widget //尝试获得配置项的名字，没有则取widget的名字
            if (nearestVM && typeof nearestVM[optName] === "object") {
                vmOptions = nearestVM[optName]
                vmOptions = vmOptions.$model || vmOptions
                var id = vmOptions[widget + "Id"]
                if (typeof id === "string") {
                    args[1] = id
                }
            }
            var widgetData = avalon.getWidgetData(element, args[0]) //抽取data-tooltip-text、data-tooltip-attr属性，组成一个配置对象
            data[widget + "Id"] = args[1]
            data[widget + "Options"] = avalon.mix({}, constructor.defaults, vmOptions, widgetData)
            element.removeAttribute("ms-widget")
            var widgetVM = constructor(element, data, vmodels)
            data.evaluator = noop
            var callback = getBindingCallback(element, "data-widget-defined", vmodels)
            if (callback) {
                callback.call(element, widgetVM)
            }
        } else if (vmodels.length) {//如果该组件还没有加载，那么保存当前的vmodels
            element.vmodels = vmodels
        }
        return true
    }

}

//============================   class preperty binding  =======================
"hover,active".replace(rword, function(method) {
    bindingHandlers[method] = bindingHandlers["class"]
})
"with,repeat".replace(rword, function(name) {
    bindingHandlers[name] = bindingHandlers.each
})
//============================= boolean preperty binding =======================
"disabled,enabled,readonly,selected".replace(rword, function(name) {
    bindingHandlers[name] = bindingHandlers.checked
})
bindingHandlers.data = bindingHandlers.text = bindingHandlers.html
//============================= string preperty binding =======================
//与href绑定器 用法差不多的其他字符串属性的绑定器
//建议不要直接在src属性上修改，这样会发出无效的请求，请使用ms-src
"title,alt,src,value,css,include,href".replace(rword, function(name) {
    bindingHandlers[name] = bindingHandlers.attr
})
//============================= model binding =======================
//将模型中的字段与input, textarea的value值关联在一起
var modelBinding = bindingHandlers.duplex
//如果一个input标签添加了model绑定。那么它对应的字段将与元素的value连结在一起
//字段变，value就变；value变，字段也跟着变。默认是绑定input事件，
modelBinding.INPUT = function(element, evaluator, data) {
    var fixType = data.param
    var type = element.type,
        $elem = avalon(element)
    if (type === "checkbox" && fixType === "radio") {
        type = "radio"
    }
    var valueAccessor = data.changed ? function() {
        return data.changed.call(element, element.value)
    } : function() {
        return element.value
    }
    //当value变化时改变model的值
    var updateVModel = function() {
        element.oldValue = element.vlaue
        if ($elem.data("duplex-observe") !== false) {
            evaluator(valueAccessor())
        }
    }

    //当model变化时,它就会改变value的值
    data.handler = function() {
        var curValue = evaluator()
        if (curValue !== element.value) {
            element.value = curValue
        }
    }
    if (type === "radio") {
        data.handler = function() {
            //IE6是通过defaultChecked来实现打勾效果
            element.defaultChecked = (element.checked = /bool|text/.test(fixType) ? evaluator() + "" === element.value : !!evaluator())
        }
        updateVModel = function() {
            if ($elem.data("duplex-observe") !== false) {
                var value = element.value
                if (fixType === "text") {
                    evaluator(value)
                } else if (fixType === "bool") {
                    evaluator(value === "true")
                } else {
                    var val = !element.defaultChecked
                    evaluator(val)
                    element.checked = val
                }
            }
        }
        element.addEventListener("click", updateVModel)
        data.rollback = function() {
            element.removeEventListener("click", updateVModel)
        }
    } else if (type === "checkbox") {
        updateVModel = function() {
            if ($elem.data("duplex-observe") !== false) {
                var method = element.checked ? "ensure" : "remove"
                var array = evaluator()
                if (Array.isArray(array)) {
                    avalon.Array[method](array, element.value)
                } else {
                    avalon.error("ms-duplex位于checkbox时要求对应一个数组")
                }
            }
        }
        data.handler = function() {
            var array = [].concat(evaluator()) //强制转换为数组
            element.checked = array.indexOf(element.value) >= 0
        }
        element.addEventListener("click", updateVModel)
        data.rollback = function() {
            element.removeEventListener("click", updateVModel)
        }
    } else {
        var event = element.attributes["data-duplex-event"] || element.attributes["data-event"] || {}
        event = event.value
        var eventType = event === "change" ? event : "input"
        element.addEventListener(eventType, updateVModel)
        data.rollback = function() {
            element.removeEventListener(eventType, updateVModel)
        }
    }
    element.oldValue = element.value
    launch(element)
    registerSubscriber(data)
}
var TimerID, ribbon = [], launch = noop
function ticker() {
    for (var n = ribbon.length - 1; n >= 0; n--) {
        var el = ribbon[n]
        if (avalon.contains(root, el)) {
            if (el.oldValue !== el.value) {
                avalon.fire(el, "input")
            }
        } else {
            ribbon.splice(n, 1)
        }
    }
    if (!ribbon.length) {
        clearInterval(TimerID)
    }
}
function launchImpl(el) {
    if (ribbon.push(el) === 1) {
        TimerID = setInterval(ticker, 30)
    }
}
//http://msdn.microsoft.com/en-us/library/dd229916(VS.85).aspx
//https://docs.google.com/document/d/1jwA8mtClwxI-QJuHT7872Z0pxpZz8PBkf2bGAbsUtqs/edit?pli=1
function newSetter(newValue) {
    oldSetter.call(this, newValue)
    if (newValue !== this.oldValue) {
        avalon.fire(this, "input")
    }
}
try {
    var inputProto = HTMLInputElement.prototype, oldSetter
    oldSetter = Object.getOwnPropertyDescriptor(inputProto, "value").set//屏蔽chrome, safari,opera
    Object.defineProperty(inputProto, "value", {
        set: newSetter
    })
} catch (e) {
    launch = launchImpl
}
modelBinding.SELECT = function(element, evaluator, data, oldValue) {
    var $elem = avalon(element)
    function updateVModel() {
        if ($elem.data("duplex-observe") !== false) {
            var curValue = $elem.val() //字符串或字符串数组
            if (curValue + "" !== oldValue) {
                evaluator(curValue)
                oldValue = curValue + ""
            }
        }
    }
    data.handler = function() {
        var curValue = evaluator()
        curValue = curValue && curValue.$model || curValue
        curValue = Array.isArray(curValue) ? curValue.map(String) : curValue + ""
        if (curValue + "" !== oldValue) {
            $elem.val(curValue)
            oldValue = curValue + ""
        }
    }
    element.addEventListener("change", updateVModel)
    data.rollback = function() {
        element.removeEventListener("click", updateVModel)
    }
    var innerHTML = NaN
    var id = setInterval(function() {
        var currHTML = element.innerHTML
        if (currHTML === innerHTML) {
            clearInterval(id)
            //先等到select里的option元素被扫描后，才根据model设置selected属性
            registerSubscriber(data)
        } else {
            innerHTML = currHTML
        }
    }, 20)
}
modelBinding.TEXTAREA = modelBinding.INPUT
//========================= event binding ====================
var eventName = {
    AnimationEvent: 'animationend',
    WebKitAnimationEvent: 'webkitAnimationEnd'
}
for (var name in eventName) {
    if (/object|function/.test(typeof window[name])) {
        eventMap.animationend = eventName[name]
        break
    }
}

"dblclick,mouseout,click,mouseover,mouseenter,mouseleave,mousemove,mousedown,mouseup,keypress,keydown,keyup,blur,focus,change,animationend".
    replace(rword, function(name) {
        bindingHandlers[name] = (function(dataParam) {
            return function(data) {
                data.param = dataParam
                bindingHandlers.on.apply(0, arguments)
            }
        })(name)
    })
if (!("onmouseenter" in root)) { //chrome 30  终于支持mouseenter
    var oldBind = avalon.bind
    var events = {
        mouseenter: "mouseover",
        mouseleave: "mouseout"
    }
    avalon.bind = function(elem, type, fn) {
        if (events[type]) {
            return oldBind(elem, events[type], function(e) {
                var t = e.relatedTarget
                if (!t || (t !== elem && !(elem.compareDocumentPosition(t) & 16))) {
                    delete e.type
                    e.type = type
                    return fn.call(elem, e)
                }
            })
        } else {
            return oldBind(elem, type, fn)
        }
    }
}
/*********************************************************************
 *          监控数组（与ms-each, ms-repeat配合使用）                     *
 **********************************************************************/
function Collection(model) {
    var array = []
    array.$id = generateID()
    array[subscribers] = []
    array.$model = model
    array.$events = {}
    array._ = modelFactory({
        length: model.length
    })
    array._.$watch("length", function(a, b) {
        array.$fire("length", a, b)
    })
    for (var i in Observable) {
        array[i] = Observable[i]
    }
    avalon.mix(array, CollectionPrototype)
    return array
}


var _splice = ap.splice
var CollectionPrototype = {
    _splice: _splice,
    _add: function(arr, pos) {
        var oldLength = this.length
        pos = typeof pos === "number" ? pos : oldLength
        var added = []
        for (var i = 0, n = arr.length; i < n; i++) {
            added[i] = convert(arr[i])
        }
        _splice.apply(this, [pos, 0].concat(added))
        notifySubscribers(this, "add", pos, added)
        if (!this._stopFireLength) {
            return this._.length = this.length
        }
    },
    _del: function(pos, n) {
        var ret = this._splice(pos, n)
        if (ret.length) {
            notifySubscribers(this, "del", pos, n)
            if (!this._stopFireLength) {
                this._.length = this.length
            }
        }
        return ret
    },
    push: function() {
        ap.push.apply(this.$model, arguments)
        var n = this._add(arguments)
        notifySubscribers(this, "index", n > 2 ? n - 2 : 0)
        return n
    },
    unshift: function() {
        ap.unshift.apply(this.$model, arguments)
        var ret = this._add(arguments, 0) //返回长度
        notifySubscribers(this, "index", arguments.length)
        return ret
    },
    shift: function() {
        var el = this.$model.shift()
        this._del(0, 1)
        notifySubscribers(this, "index", 0)
        return el //返回被移除的元素
    },
    pop: function() {
        var el = this.$model.pop()
        this._del(this.length - 1, 1)
        return el //返回被移除的元素
    },
    splice: function(a, b) {
        // 必须存在第一个参数，需要大于-1, 为添加或删除元素的基点
        a = resetNumber(a, this.length)
        var removed = _splice.apply(this.$model, arguments),
            ret = []
        this._stopFireLength = true //确保在这个方法中 , $watch("length",fn)只触发一次
        if (removed.length) {
            ret = this._del(a, removed.length)
            if (arguments.length <= 2) { //如果没有执行添加操作，需要手动resetIndex
                notifySubscribers(this, "index", 0)
            }
        }
        if (arguments.length > 2) {
            this._add(aslice.call(arguments, 2), a)
        }
        this._stopFireLength = false
        this._.length = this.length
        return ret //返回被移除的元素
    },
    contains: function(el) { //判定是否包含
        return this.indexOf(el) !== -1
    },
    size: function() { //取得数组长度，这个函数可以同步视图，length不能
        return this._.length
    },
    remove: function(el) { //移除第一个等于给定值的元素
        var index = this.indexOf(el)
        if (index >= 0) {
            return this.removeAt(index)
        }
    },
    removeAt: function(index) { //移除指定索引上的元素
        this.splice(index, 1)
    },
    clear: function() {
        this.$model.length = this.length = this._.length = 0 //清空数组
        notifySubscribers(this, "clear", 0)
        return this
    },
    removeAll: function(all) { //移除N个元素
        if (Array.isArray(all)) {
            all.forEach(function(el) {
                this.remove(el)
            }, this)
        } else if (typeof all === "function") {
            for (var i = this.length - 1; i >= 0; i--) {
                var el = this[i]
                if (all(el, i)) {
                    this.splice(i, 1)
                }
            }
        } else {
            this.clear()
        }
    },
    ensure: function(el) {
        if (!this.contains(el)) { //只有不存在才push
            this.push(el)
        }
        return this
    },
    set: function(index, val) {
        if (index >= 0 && index < this.length) {
            var valueType = getType(val)
            if (val && val.$model) {
                val = val.$model
            }
            var target = this[index]
            if (valueType === "object") {
                for (var i in val) {
                    if (target.hasOwnProperty(i)) {
                        target[i] = val[i]
                    }
                }
            } else if (valueType === "array") {
                target.clear().push.apply(target, val)
            } else if (target !== val) {
                this[index] = val
                notifySubscribers(this, "set", index, val)
            }
        }
        return this
    }
}
"sort,reverse".replace(rword, function(method) {
    CollectionPrototype[method] = function() {
        var aaa = this.$model,
            bbb = aaa.slice(0),
            sorted = false
        ap[method].apply(aaa, arguments) //先移动model
        for (var i = 0, n = bbb.length; i < n; i++) {
            var a = aaa[i],
                b = bbb[i]
            if (!isEqual(a, b)) {
                sorted = true
                var index = getIndex(a, bbb, i)
                var remove = this._splice(index, 1)[0]
                var remove2 = bbb.splice(index, 1)[0]
                this._splice(i, 0, remove)
                bbb.splice(i, 0, remove2)
                notifySubscribers(this, "move", index, i)
            }
        }
        bbb = void 0
        if (sorted) {
            notifySubscribers(this, "index", 0)
        }
        return this
    }
})
function convert(val) {
    var type = getType(val)
    if (rchecktype.test(type)) {
        val = val.$id ? val : modelFactory(val, val)
    }
    return val
}
//取得el在array的位置

function getIndex(a, array, start) {
    for (var i = start, n = array.length; i < n; i++) {
        if (isEqual(a, array[i])) {
            return i
        }
    }
    return -1
}


//============ each/repeat/with binding 用到的辅助函数与对象 ======================
//得到某一元素节点或文档碎片对象下的所有注释节点
var queryComments = function(parent) {
    var tw = DOC.createTreeWalker(parent, NodeFilter.SHOW_COMMENT, null, null),
        comment, ret = []
    while (comment = tw.nextNode()) {
        ret.push(comment)
    }
    return ret
}
var deleteRange = DOC.createRange()

//将通过ms-if移出DOM树放进ifSanctuary的元素节点移出来，以便垃圾回收
function removeFromSanctuary(parent) {
    var comments = queryComments(parent)
    for (var i = 0, comment; comment = comments[i++]; ) {
        if (comment.nodeValue == "ms-if") {
            var msIfEl = comment.elem
            if (msIfEl.parentNode) {
                msIfEl.parentNode.removeChild(msIfEl)
            }
        }
    }
    parent.textContent = ""
}

function iteratorCallback(args) {
    var callback = getBindingCallback(this.callbackElement, this.callbackName, this.vmodels)
    if (callback) {
        var parent = this.parent
        checkScan(parent, function() {
            callback.apply(parent, args)
        })
    }
}
//为ms-each, ms-with, ms-repeat要循环的元素外包一个msloop临时节点，ms-controller的值为代理VM的$id
function shimController(data, transation, spans, proxy) {
    var tview = data.template.cloneNode(true)
    avalon.vmodels[proxy.$id] = proxy
    var span = DOC.createElement("msloop")
    span.style.display = "none"
    span.setAttribute("ms-controller", proxy.$id)
    span["msLoopData"] = data
    span.appendChild(tview)
    spans.push(span)
    transation.appendChild(span)
}
// 取得用于定位的节点。在绑定了ms-each, ms-with属性的元素里，它的整个innerHTML都会视为一个子模板先行移出DOM树，
// 然后如果它的元素有多少个（ms-each）或键值对有多少双（ms-with），就将它复制多少份(多少为N)，再经过扫描后，重新插入该元素中。
// 这时该元素的孩子将分为N等分，每等份的第一个节点就是这个用于定位的节点，
// 方便我们根据它算出整个等分的节点们，然后整体移除或移动它们。

function getLocatedNode(parent, data, pos) {
    if (data.startRepeat) {
        var ret = data.startRepeat,
            end = data.endRepeat
        pos += 1
        for (var i = 0; i < pos; i++) {
            ret = ret.nextSibling
            if (ret == end)
                return end
        }
        return ret
    } else {
        return parent.childNodes[data.group * pos] || null
    }
}

function removeView(node, group, n) {
    var length = group * (n || 1)
    var view = documentFragment.cloneNode(false)
    while (--length >= 0) {
        var nextSibling = node.nextSibling
        view.appendChild(node)
        node = nextSibling
        if (!node) {
            break
        }
    }
    return view
}
// 为ms-each, ms-repeat创建一个代理对象，通过它们能使用一些额外的属性与功能（$index,$first,$last,$remove,$key,$val,$outer）
var watchEachOne = oneObject("$index,$first,$last")

function createWithProxy(key, val, $outer) {
    return modelFactory({
        $key: key,
        $outer: $outer,
        $val: val
    }, 0, {
        $val: 1,
        $key: 1
    })
}

function createEachProxy(index, item, data, last) {
    var param = data.param || "el"
    var source = {
        $index: index,
        $itemName: param,
        $outer: data.$outer,
        $first: index === 0,
        $last: index === last
    }
    source[param] = item
    source.$remove = function() {
        return data.getter().removeAt(proxy.$index)
    }
    var proxy = modelFactory(source, 0, watchEachOne)
    return proxy
}
/*********************************************************************
 *                  文本绑定里默认可用的过滤器                        *
 **********************************************************************/
var filters = avalon.filters = {
    uppercase: function(str) {
        return str.toUpperCase()
    },
    lowercase: function(str) {
        return str.toLowerCase()
    },
    truncate: function(target, length, truncation) {
        //length，新字符串长度，truncation，新字符串的结尾的字段,返回新字符串
        length = length || 30
        truncation = truncation === void(0) ? "..." : truncation
        return target.length > length ? target.slice(0, length - truncation.length) + truncation : String(target)
    },
    camelize: camelize,
    escape: function(html) {
        //将字符串经过 html 转义得到适合在页面中显示的内容, 例如替换 < 为 &lt
        return String(html)
            .replace(/&(?!\w+;)/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
    },
    currency: function(number, symbol) {
        symbol = symbol || "￥"
        return symbol + avalon.filters.number(number)
    },
    number: function(number, decimals, dec_point, thousands_sep) {
        //与PHP的number_format完全兼容
        //number    必需，要格式化的数字
        //decimals  可选，规定多少个小数位。
        //dec_point 可选，规定用作小数点的字符串（默认为 . ）。
        //thousands_sep 可选，规定用作千位分隔符的字符串（默认为 , ），如果设置了该参数，那么所有其他参数都是必需的。
        // http://kevin.vanzonneveld.net
        number = (number + "").replace(/[^0-9+\-Ee.]/g, "")
        var n = !isFinite(+number) ? 0 : +number,
            prec = !isFinite(+decimals) ? 0 : Math.abs(decimals),
            sep = thousands_sep || ",",
            dec = dec_point || ".",
            s = "",
            toFixedFix = function(n, prec) {
                var k = Math.pow(10, prec)
                return "" + Math.round(n * k) / k
            }
        // Fix for IE parseFloat(0.55).toFixed(0) = 0
        s = (prec ? toFixedFix(n, prec) : "" + Math.round(n)).split('.')
        if (s[0].length > 3) {
            s[0] = s[0].replace(/\B(?=(?:\d{3})+(?!\d))/g, sep)
        }
        if ((s[1] || "").length < prec) {
            s[1] = s[1] || ""
            s[1] += new Array(prec - s[1].length + 1).join("0")
        }
        return s.join(dec)
    }
}
/*
 'yyyy': 4 digit representation of year (e.g. AD 1 => 0001, AD 2010 => 2010)
 'yy': 2 digit representation of year, padded (00-99). (e.g. AD 2001 => 01, AD 2010 => 10)
 'y': 1 digit representation of year, e.g. (AD 1 => 1, AD 199 => 199)
 'MMMM': Month in year (January-December)
 'MMM': Month in year (Jan-Dec)
 'MM': Month in year, padded (01-12)
 'M': Month in year (1-12)
 'dd': Day in month, padded (01-31)
 'd': Day in month (1-31)
 'EEEE': Day in Week,(Sunday-Saturday)
 'EEE': Day in Week, (Sun-Sat)
 'HH': Hour in day, padded (00-23)
 'H': Hour in day (0-23)
 'hh': Hour in am/pm, padded (01-12)
 'h': Hour in am/pm, (1-12)
 'mm': Minute in hour, padded (00-59)
 'm': Minute in hour (0-59)
 'ss': Second in minute, padded (00-59)
 's': Second in minute (0-59)
 'a': am/pm marker
 'Z': 4 digit (+sign) representation of the timezone offset (-1200-+1200)
 format string can also be one of the following predefined localizable formats:

 'medium': equivalent to 'MMM d, y h:mm:ss a' for en_US locale (e.g. Sep 3, 2010 12:05:08 pm)
 'short': equivalent to 'M/d/yy h:mm a' for en_US locale (e.g. 9/3/10 12:05 pm)
 'fullDate': equivalent to 'EEEE, MMMM d,y' for en_US locale (e.g. Friday, September 3, 2010)
 'longDate': equivalent to 'MMMM d, y' for en_US locale (e.g. September 3, 2010
 'mediumDate': equivalent to 'MMM d, y' for en_US locale (e.g. Sep 3, 2010)
 'shortDate': equivalent to 'M/d/yy' for en_US locale (e.g. 9/3/10)
 'mediumTime': equivalent to 'h:mm:ss a' for en_US locale (e.g. 12:05:08 pm)
 'shortTime': equivalent to 'h:mm a' for en_US locale (e.g. 12:05 pm)
 */
new function() {
    function toInt(str) {
        return parseInt(str, 10)
    }

    function padNumber(num, digits, trim) {
        var neg = ""
        if (num < 0) {
            neg = "-"
            num = -num
        }
        num = "" + num
        while (num.length < digits)
            num = "0" + num
        if (trim)
            num = num.substr(num.length - digits)
        return neg + num
    }

    function dateGetter(name, size, offset, trim) {
        return function(date) {
            var value = date["get" + name]()
            if (offset > 0 || value > -offset)
                value += offset
            if (value === 0 && offset === -12) {
                value = 12
            }
            return padNumber(value, size, trim)
        }
    }

    function dateStrGetter(name, shortForm) {
        return function(date, formats) {
            var value = date["get" + name]()
            var get = (shortForm ? ("SHORT" + name) : name).toUpperCase()
            return formats[get][value]
        }
    }

    function timeZoneGetter(date) {
        var zone = -1 * date.getTimezoneOffset()
        var paddedZone = (zone >= 0) ? "+" : ""
        paddedZone += padNumber(Math[zone > 0 ? "floor" : "ceil"](zone / 60), 2) + padNumber(Math.abs(zone % 60), 2)
        return paddedZone
    }
    //取得上午下午

    function ampmGetter(date, formats) {
        return date.getHours() < 12 ? formats.AMPMS[0] : formats.AMPMS[1]
    }
    var DATE_FORMATS = {
        yyyy: dateGetter("FullYear", 4),
        yy: dateGetter("FullYear", 2, 0, true),
        y: dateGetter("FullYear", 1),
        MMMM: dateStrGetter("Month"),
        MMM: dateStrGetter("Month", true),
        MM: dateGetter("Month", 2, 1),
        M: dateGetter("Month", 1, 1),
        dd: dateGetter("Date", 2),
        d: dateGetter("Date", 1),
        HH: dateGetter("Hours", 2),
        H: dateGetter("Hours", 1),
        hh: dateGetter("Hours", 2, -12),
        h: dateGetter("Hours", 1, -12),
        mm: dateGetter("Minutes", 2),
        m: dateGetter("Minutes", 1),
        ss: dateGetter("Seconds", 2),
        s: dateGetter("Seconds", 1),
        sss: dateGetter("Milliseconds", 3),
        EEEE: dateStrGetter("Day"),
        EEE: dateStrGetter("Day", true),
        a: ampmGetter,
        Z: timeZoneGetter
    }
    var DATE_FORMATS_SPLIT = /((?:[^yMdHhmsaZE']+)|(?:'(?:[^']|'')*')|(?:E+|y+|M+|d+|H+|h+|m+|s+|a|Z))(.*)/,
        NUMBER_STRING = /^\d+$/
    var R_ISO8601_STR = /^(\d{4})-?(\d\d)-?(\d\d)(?:T(\d\d)(?::?(\d\d)(?::?(\d\d)(?:\.(\d+))?)?)?(Z|([+-])(\d\d):?(\d\d))?)?$/
    // 1        2       3         4          5          6          7          8  9     10      11

    function jsonStringToDate(string) {
        var match
        if (match = string.match(R_ISO8601_STR)) {
            var date = new Date(0),
                tzHour = 0,
                tzMin = 0,
                dateSetter = match[8] ? date.setUTCFullYear : date.setFullYear,
                timeSetter = match[8] ? date.setUTCHours : date.setHours
            if (match[9]) {
                tzHour = toInt(match[9] + match[10])
                tzMin = toInt(match[9] + match[11])
            }
            dateSetter.call(date, toInt(match[1]), toInt(match[2]) - 1, toInt(match[3]))
            var h = toInt(match[4] || 0) - tzHour
            var m = toInt(match[5] || 0) - tzMin
            var s = toInt(match[6] || 0)
            var ms = Math.round(parseFloat('0.' + (match[7] || 0)) * 1000)
            timeSetter.call(date, h, m, s, ms)
            return date
        }
        return string
    }
    var rfixFFDate = /^(\d+)-(\d+)-(\d{4})$/
    var rfixIEDate = /^(\d+)\s+(\d+),(\d{4})$/
    filters.date = function(date, format) {
        var locate = filters.date.locate,
            text = "",
            parts = [],
            fn, match
        format = format || "mediumDate"
        format = locate[format] || format
        if (typeof date === "string") {
            if (NUMBER_STRING.test(date)) {
                date = toInt(date)
            } else {
                var trimDate = date.trim()
                if (trimDate.match(rfixFFDate) || trimDate.match(rfixIEDate)) {
                    date = RegExp.$3 + "/" + RegExp.$1 + "/" + RegExp.$2
                }
                date = jsonStringToDate(date)
            }
            date = new Date(date)
        }
        if (typeof date === "number") {
            date = new Date(date)
        }
        if (getType(date) !== "date") {
            return
        }
        while (format) {
            match = DATE_FORMATS_SPLIT.exec(format)
            if (match) {
                parts = parts.concat(match.slice(1))
                format = parts.pop()
            } else {
                parts.push(format)
                format = null
            }
        }
        parts.forEach(function(value) {
            fn = DATE_FORMATS[value]
            text += fn ? fn(date, locate) : value.replace(/(^'|'$)/g, "").replace(/''/g, "'")
        })
        return text
    }
    var locate = {
        AMPMS: {
            0: "上午",
            1: "下午"
        },
        DAY: {
            0: "星期日",
            1: "星期一",
            2: "星期二",
            3: "星期三",
            4: "星期四",
            5: "星期五",
            6: "星期六"
        },
        MONTH: {
            0: "1月",
            1: "2月",
            2: "3月",
            3: "4月",
            4: "5月",
            5: "6月",
            6: "7月",
            7: "8月",
            8: "9月",
            9: "10月",
            10: "11月",
            11: "12月"
        },
        SHORTDAY: {
            "0": "周日",
            "1": "周一",
            "2": "周二",
            "3": "周三",
            "4": "周四",
            "5": "周五",
            "6": "周六"
        },
        fullDate: "y年M月d日EEEE",
        longDate: "y年M月d日",
        medium: "yyyy-M-d ah:mm:ss",
        mediumDate: "yyyy-M-d",
        mediumTime: "ah:mm:ss",
        "short": "yy-M-d ah:mm",
        shortDate: "yy-M-d",
        shortTime: "ah:mm"
    }
    locate.SHORTMONTH = locate.MONTH
    filters.date.locate = locate
}

