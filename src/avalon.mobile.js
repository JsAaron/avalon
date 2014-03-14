//==================================================
// avalon.mobile 1.2.3 2014.3.4，mobile 注意： 只能用于IE10及高版本的标准浏览器
//==================================================
    /*********************************************************************
     *                      AMD Loader                                   *
     **********************************************************************/

    var innerRequire
    var modules = avalon.modules = {
        "ready!": {
            exports: avalon
        },
        "avalon": {
            exports: avalon,
            state: 2
        }
    }

    new function() {
        var loadings = [] //正在加载中的模块列表
        var factorys = [] //储存需要绑定ID与factory对应关系的模块（标准浏览器下，先parse的script节点会先onload）
        var basepath

        function cleanUrl(url) {
            return (url || "").replace(/[?#].*/, "")
        }
        plugins.js = function(url, shim) {
            var id = cleanUrl(url)
            if (!modules[id]) { //如果之前没有加载过
                modules[id] = {
                    id: id,
                    parent: parent,
                    exports: {}
                }
                if (shim) { //shim机制
                    innerRequire(shim.deps || "", function() {
                        loadJS(url, id, function() {
                            modules[id].state = 2
                            if (shim.exports)
                                modules[id].exports = typeof shim.exports === "function" ?
                                        shim.exports() : window[shim.exports]
                            innerRequire.checkDeps()
                        })
                    })
                } else {
                    loadJS(url, id)
                }
            }
            return id
        }
        plugins.css = function(url) {
            var id = url.replace(/(#.+|\W)/g, "") ////用于处理掉href中的hash与所有特殊符号
            if (!DOC.getElementById(id)) {
                var node = DOC.createElement("link")
                node.rel = "stylesheet"
                node.href = url
                node.id = id
                head.insertBefore(node, head.firstChild)
            }
        }
        plugins.css.ext = ".css"
        plugins.js.ext = ".js"
        var cur = getCurrentScript(true)
        if (!cur) { //处理window safari的Error没有stack的问题
            cur = avalon.slice(document.scripts).pop().src
        }
        var url = cleanUrl(cur)
        basepath = kernel.base = url.slice(0, url.lastIndexOf("/") + 1)

        function getCurrentScript(base) {
            // 参考 https://github.com/samyk/jiagra/blob/master/jiagra.js
            var stack
            try {
                a.b.c() //强制报错,以便捕获e.stack
            } catch (e) { //safari的错误对象只有line,sourceId,sourceURL
                stack = e.stack
            }
            if (stack) {
                /**e.stack最后一行在所有支持的浏览器大致如下:
                 *chrome23:
                 * at http://113.93.50.63/data.js:4:1
                 *firefox17:
                 *@http://113.93.50.63/query.js:4
                 *opera12:http://www.oldapps.com/opera.php?system=Windows_XP
                 *@http://113.93.50.63/data.js:4
                 *IE10:
                 *  at Global code (http://113.93.50.63/data.js:4:1)
                 *  //firefox4+ 可以用document.currentScript
                 */
                stack = stack.split(/[@ ]/g).pop() //取得最后一行,最后一个空格或@之后的部分
                stack = stack[0] === "(" ? stack.slice(1, -1) : stack.replace(/\s/, "") //去掉换行符
                return stack.replace(/(:\d+)?:\d+$/i, "") //去掉行号与或许存在的出错字符起始位置
            }
            var nodes = (base ? DOC : head).getElementsByTagName("script") //只在head标签中寻找
            for (var i = nodes.length, node; node = nodes[--i]; ) {
                if ((base || node.className === subscribers) && node.readyState === "interactive") {
                    return node.className = node.src
                }
            }
        }

        function checkCycle(deps, nick) {
            //检测是否存在循环依赖
            for (var id in deps) {
                if (deps[id] === "司徒正美" && modules[id].state !== 2 && (id === nick || checkCycle(modules[id].deps, nick))) {
                    return true
                }
            }
        }

        function checkDeps() {
            //检测此JS模块的依赖是否都已安装完毕,是则安装自身
            loop: for (var i = loadings.length, id; id = loadings[--i]; ) {
                var obj = modules[id],
                        deps = obj.deps
                for (var key in deps) {
                    if (ohasOwn.call(deps, key) && modules[key].state !== 2) {
                        continue loop
                    }
                }
                //如果deps是空对象或者其依赖的模块的状态都是2
                if (obj.state !== 2) {
                    loadings.splice(i, 1) //必须先移除再安装，防止在IE下DOM树建完后手动刷新页面，会多次执行它
                    fireFactory(obj.id, obj.args, obj.factory)
                    checkDeps() //如果成功,则再执行一次,以防有些模块就差本模块没有安装好
                }
            }
        }


        function checkFail(node, onError) {
            var id = cleanUrl(node.src) //检测是否死链
            node.onload = node.onerror = null
            if (onError) {
                setTimeout(function() {
                    head.removeChild(node)
                })
                log("加载 " + id + " 失败" + onError + " " + (!modules[id].state))
            } else {
                return true
            }
        }
        var rdeuce = /\/\w+\/\.\./

        function loadResources(url, parent, ret, shim) {
            //1. 特别处理mass|ready标识符
            if (url === "ready!" || (modules[url] && modules[url].state === 2)) {
                return url
            }
            //2. 转化为完整路径
            if (typeof kernel.shim[url] === "object") {
                shim = kernel.shim[url]
            }
            if (kernel.paths[url]) { //别名机制
                url = kernel.paths[url]
            }
            //3.  处理text!  css! 等资源
            var plugin
            url = url.replace(/^\w+!/, function(a) {
                plugin = a.slice(0, -1)
                return ""
            })

            plugin = plugin || "js"
            plugin = plugins[plugin] || noop
            //4. 补全路径
            if (/^(\w+)(\d)?:.*/.test(url)) {
                ret = url
            } else {
                parent = parent.substr(0, parent.lastIndexOf('/'))
                var tmp = url.charAt(0)
                if (tmp !== "." && tmp !== "/") { //相对于根路径
                    ret = basepath + url
                } else if (url.slice(0, 2) === "./") { //相对于兄弟路径
                    ret = parent + url.slice(1)
                } else if (url.slice(0, 2) === "..") { //相对于父路径
                    ret = parent + "/" + url
                    while (rdeuce.test(ret)) {
                        ret = ret.replace(rdeuce, "")
                    }
                } else if (tmp === "/") {
                    ret = parent + url //相对于兄弟路径
                } else {
                    avalon.error("不符合模块标识规则: " + url)
                }
            }
            //5. 补全扩展名
            url = cleanUrl(ret)
            var ext = plugin.ext
            if (ext) {
                if (url.slice(0 - ext.length) !== ext) {
                    ret += ext
                }
            }
            //6. 缓存处理
            if (kernel.nocache) {
                ret += (ret.indexOf("?") === -1 ? "?" : "&") + Date.now()
            }
            return plugin(ret, shim)
        }

        function loadJS(url, id, callback) {
            //通过script节点加载目标模块
            var node = DOC.createElement("script")
            node.className = subscribers //让getCurrentScript只处理类名为subscribers的script节点
            node.onload = function() {
                var factory = factorys.pop()
                factory && factory.delay(id)
                if (callback) {
                    callback()
                }
                log("已成功加载 " + url)
            }

            node.onerror = function() {
                checkFail(node, true)
            }
            node.src = url //插入到head的第一个节点前，防止IE6下head标签没闭合前使用appendChild抛错
            head.appendChild(node) //chrome下第二个参数不能为null
            log("正准备加载 " + url) //更重要的是IE6下可以收窄getCurrentScript的寻找范围
        }

        innerRequire = avalon.require = function(list, factory, parent) {
            // 用于检测它的依赖是否都为2
            var deps = {},
                    // 用于保存依赖模块的返回值
                    args = [],
                    // 需要安装的模块数
                    dn = 0,
                    // 已安装完的模块数
                    cn = 0,
                    id = parent || "callback" + setTimeout("1")
            parent = parent || basepath
            String(list).replace(rword, function(el) {
                var url = loadResources(el, parent)
                if (url) {
                    dn++

                    if (modules[url] && modules[url].state === 2) {
                        cn++
                    }
                    if (!deps[url]) {
                        args.push(url)
                        deps[url] = "司徒正美" //去重
                    }
                }
            })
            modules[id] = {//创建一个对象,记录模块的加载情况与其他信息
                id: id,
                factory: factory,
                deps: deps,
                args: args,
                state: 1
            }
            if (dn === cn) { //如果需要安装的等于已安装好的
                fireFactory(id, args, factory) //安装到框架中
            } else {
                //放到检测列队中,等待checkDeps处理
                loadings.unshift(id)
            }
            checkDeps()
        }

        /**
         * 定义模块
         * @param {String} id ? 模块ID
         * @param {Array} deps ? 依赖列表
         * @param {Function} factory 模块工厂
         * @api public
         */
        innerRequire.define = function(id, deps, factory) { //模块名,依赖列表,模块本身
            var args = avalon.slice(arguments)

            if (typeof id === "string") {
                var _id = args.shift()
            }
            if (typeof args[0] === "boolean") { //用于文件合并, 在标准浏览器中跳过补丁模块
                if (args[0]) {
                    return
                }
                args.shift()
            }
            if (typeof args[0] === "function") {
                args.unshift([])
            } //上线合并后能直接得到模块ID,否则寻找当前正在解析中的script节点的src作为模块ID
            //现在除了safari外，我们都能直接通过getCurrentScript一步到位得到当前执行的script节点，
            //safari可通过onload+delay闭包组合解决
            var name = modules[_id] && modules[_id].state >= 1 ? _id : cleanUrl(getCurrentScript())
            if (!modules[name] && _id) {
                modules[name] = {
                    id: name,
                    factory: factory,
                    state: 1
                }
            }
            factory = args[1]
            factory.id = _id //用于调试
            factory.delay = function(d) {
                args.push(d)
                var isCycle = true
                try {
                    isCycle = checkCycle(modules[d].deps, d)
                } catch (e) {
                }
                if (isCycle) {
                    avalon.error(d + "模块与之前的某些模块存在循环依赖")
                }
                delete factory.delay //释放内存
                innerRequire.apply(null, args) //0,1,2 --> 1,2,0
            }

            if (name) {
                factory.delay(name, args)
            } else { //先进先出
                factorys.push(factory)
            }
        }
        innerRequire.define.amd = modules

        function fireFactory(id, deps, factory) {
            for (var i = 0, array = [], d; d = deps[i++]; ) {
                array.push(modules[d].exports)
            }
            var module = Object(modules[id]),
                    ret = factory.apply(window, array)
            module.state = 2
            if (ret !== void 0) {
                modules[id].exports = ret
            }
            return ret
        }
        innerRequire.config = kernel
        innerRequire.checkDeps = checkDeps
    }
    /*********************************************************************
     *                           Touch  Event                           *
     **********************************************************************/

    if ("ontouchstart" in window) {
        void

                function() {
                    var touchProxy = {}, touchTimeout, tapTimeout, swipeTimeout, holdTimeout,
                            now, firstTouch, _isPointerType, delta, deltaX = 0,
                            deltaY = 0,
                            touchNames = []

                    function swipeDirection(x1, x2, y1, y2) {
                        return Math.abs(x1 - x2) >=
                                Math.abs(y1 - y2) ? (x1 - x2 > 0 ? "left" : "right") : (y1 - y2 > 0 ? "up" : "down")
                    }

                    function longTap() {
                        if (touchProxy.last) {
                            touchProxy.fire("hold")
                            touchProxy = {}
                        }
                    }

                    function cancelHold() {
                        clearTimeout(holdTimeout)
                    }

                    function cancelAll() {
                        clearTimeout(touchTimeout)
                        clearTimeout(tapTimeout)
                        clearTimeout(swipeTimeout)
                        clearTimeout(holdTimeout)
                        touchProxy = {}
                    }

                    if (window.navigator.pointerEnabled) { //IE11 与 W3C
                        touchNames = ["pointerdown", "pointermove", "pointerup", "pointercancel"]
                    } else if (window.navigator.msPointerEnabled) { //IE9-10
                        touchNames = ["MSPointerDown", "MSPointerMove", "MSPointerUp", "MSPointerCancel"]
                    } else {
                        touchNames = ["touchstart", "touchmove", "touchend", "touchcancel"]
                    }

                    function isPrimaryTouch(event) { //是否纯净的触摸事件，非mousemove等模拟的事件，也不是手势事件
                        return (event.pointerType == "touch" ||
                                event.pointerType == event.MSPOINTER_TYPE_TOUCH) && event.isPrimary
                    }

                    function isPointerEventType(e, type) { //是否最新发布的PointerEvent
                        return (e.type == "pointer" + type ||
                                e.type.toLowerCase() == "mspointer" + type)
                    }

                    DOC.addEventListener(touchNames[0], function(e) {
                        if ((_isPointerType = isPointerEventType(e, "down")) && !isPrimaryTouch(e))
                            return
                        firstTouch = _isPointerType ? e : e.touches[0]
                        if (e.touches && e.touches.length === 1 && touchProxy.x2) {
                            touchProxy.x2 = touchProxy.y2 = void 0
                        }
                        now = Date.now()
                        delta = now - (touchProxy.last || now)
                        var el = firstTouch.target
                        touchProxy.el = "tagName" in el ? el : el.parentNode
                        clearTimeout(touchTimeout)
                        touchProxy.x1 = firstTouch.pageX
                        touchProxy.y1 = firstTouch.pageY
                        touchProxy.fire = function(name) {
                            avalon.fire(this.el, name)
                        }
                        if (delta > 0 && delta <= 250) { //双击
                            touchProxy.isDoubleTap = true
                        }
                        touchProxy.last = now
                        holdTimeout = setTimeout(longTap, 750)
                    })
                    DOC.addEventListener(touchNames[1], function(e) {
                        if ((_isPointerType = isPointerEventType(e, "move")) && !isPrimaryTouch(e))
                            return
                        firstTouch = _isPointerType ? e : e.touches[0]
                        cancelHold()
                        touchProxy.x2 = firstTouch.pageX
                        touchProxy.y2 = firstTouch.pageY
                        deltaX += Math.abs(touchProxy.x1 - touchProxy.x2)
                        deltaY += Math.abs(touchProxy.y1 - touchProxy.y2)
                    })

                    DOC.addEventListener(touchNames[2], function(e) {
                        if ((_isPointerType = isPointerEventType(e, "up")) && !isPrimaryTouch(e))
                            return
                        cancelHold()
                        // swipe
                        if ((touchProxy.x2 && Math.abs(touchProxy.x1 - touchProxy.x2) > 30) ||
                                (touchProxy.y2 && Math.abs(touchProxy.y1 - touchProxy.y2) > 30)) {
                            //如果是滑动，根据最初与最后的位置判定其滑动方向
                            swipeTimeout = setTimeout(function() {
                                touchProxy.fire("swipe")
                                touchProxy.fire("swipe" + (swipeDirection(touchProxy.x1, touchProxy.x2, touchProxy.y1, touchProxy.y2)))
                                touchProxy = {}
                            }, 0)
                            // normal tap 
                        } else if ("last" in touchProxy) {
                            if (deltaX < 30 && deltaY < 30) { //如果移动的距离太小
                                tapTimeout = setTimeout(function() {
                                    touchProxy.fire("tap")
                                    if (touchProxy.isDoubleTap) {
                                        touchProxy.fire('doubletap')
                                        touchProxy = {}
                                    } else {
                                        touchTimeout = setTimeout(function() {
                                            touchProxy.fire('singletap')
                                            touchProxy = {}
                                        }, 250)
                                    }
                                }, 0)
                            } else {
                                touchProxy = {}
                            }
                        }
                        deltaX = deltaY = 0
                    })

                    DOC.addEventListener(touchNames[3], cancelAll)
                }()
        //http://quojs.tapquo.com/ http://code.baidu.com/
        //'swipe', 'swipeleft', 'swiperight', 'swipeup', 'swipedown',  'doubletap', 'tap', 'singletap', 'hold'
    }
    /*********************************************************************
     *                    DOMReady                                         *
     **********************************************************************/

    function fireReady() {
        modules["ready!"].state = 2
        innerRequire.checkDeps()
        fireReady = noop //隋性函数，防止IE9二次调用_checkDeps
    }

    if (DOC.readyState === "complete") {
        setTimeout(fireReady) //如果在domReady之外加载
    } else {
        DOC.addEventListener("DOMContentLoaded", fireReady)
        window.addEventListener("load", fireReady)
    }
    avalon.ready = function(fn) {
        innerRequire("ready!", fn)
    }
    avalon.config({
        loader: true
    })
    var msSelector = "[ms-controller],[ms-important],[ms-widget]"
    avalon.ready(function() {
        var elems = DOC.querySelectorAll(msSelector),
                nodes = []
        for (var i = 0, elem; elem = elems[i++]; ) {
            if (!elem.__root__) {
                var array = elem.querySelectorAll(msSelector)
                for (var j = 0, el; el = array[j++]; ) {
                    el.__root__ = true
                }
                nodes.push(elem)
            }
        }
        for (var i = 0, elem; elem = nodes[i++]; ) {
            avalon.scan(elem)
        }
    })

