/*********************************************************************
 *                          编译模块                                   *
 **********************************************************************/
var keywords =
    // 关键字
    "break,case,catch,continue,debugger,default,delete,do,else,false" + ",finally,for,function,if,in,instanceof,new,null,return,switch,this" + ",throw,true,try,typeof,var,void,while,with"

        // 保留字
        + ",abstract,boolean,byte,char,class,const,double,enum,export,extends" + ",final,float,goto,implements,import,int,interface,long,native" + ",package,private,protected,public,short,static,super,synchronized" + ",throws,transient,volatile"

        // ECMA 5 - use strict
        + ",arguments,let,yield"

        + ",undefined"

var rrexpstr = /\/\*(?:.|\n)*?\*\/|\/\/[^\n]*\n|\/\/[^\n]*$|'[^']*'|"[^"]*"|[\s\t\n]*\.[\s\t\n]*[$\w\.]+/g
var rsplit = /[^\w$]+/g
var rkeywords = new RegExp(["\\b" + keywords.replace(/,/g, '\\b|\\b') + "\\b"].join('|'), 'g')
var rnumber = /\b\d[^,]*/g
var rcomma = /^,+|,+$/g
var getVariables = function(code) {
    code = code
        .replace(rrexpstr, "")
        .replace(rsplit, ",")
        .replace(rkeywords, "")
        .replace(rnumber, "")
        .replace(rcomma, "")

    return code ? code.split(/,+/) : []
}

//添加赋值语句
function addAssign(vars, scope, name, duplex) {
    var ret = [],
        prefix = " = " + name + "."
    for (var i = vars.length, prop; prop = vars[--i]; ) {
        if (scope.hasOwnProperty(prop)) {
            ret.push(prop + prefix + prop)
            if (duplex === "duplex") {
                vars.get = name + "." + prop
            }
            vars.splice(i, 1)
        }
    }
    return ret
}

function uniqArray(arr, vm) {
    var length = arr.length
    if (length <= 1) {
        return arr
    } else if (length === 2) {
        return arr[0] !== arr[1] ? arr : [arr[0]]
    }
    var uniq = {}
    return arr.filter(function(el) {
        var key = vm ? el && el.$id : el
        if (!uniq[key]) {
            uniq[key] = 1
            return true
        }
        return false
    })
}

//缓存求值函数，以便多次利用
function createCache(maxLength) {
    var keys = []
    function cache(key, value) {
        if (keys.push(key) > maxLength) {
            delete cache[keys.shift()]
        }
        return cache[key] = value;
    }
    return cache;
}

var cacheExpr = createCache(256)

//根据一段文本与一堆VM，转换为对应的求值函数及匹配的VM(解释器模式)
var rduplex = /\w\[.*\]|\w\.\w/


function parseExpr(code, scopes, data, four) {
    var exprId = scopes.map(function(el) {
        return el.$id
    }) + code + data.filters + (four || "")

    var vars = getVariables(code),
        assigns = [],
        names = [],
        args = [],
        prefix = ""
    //args 是一个对象数组， names 是将要生成的求值函数的参数
    vars = uniqArray(vars), scopes = uniqArray(scopes, 1)
    for (var i = 0, sn = scopes.length; i < sn; i++) {
        if (vars.length) {
            var name = "vm" + expose + "_" + i
            names.push(name)
            args.push(scopes[i])
            assigns.push.apply(assigns, addAssign(vars, scopes[i], name, four))
        }
    }
    //---------------args----------------
    if (data.filters) {
        args.push(avalon.filters)
    }
    data.args = args
    //---------------cache----------------
    var fn = cacheExpr[exprId]
    if (fn) {
        data.evaluator = fn
        return
    }
    var prefix = assigns.join(", ")
    if (prefix) {
        prefix = "var " + prefix
    }
    //----------------duplex----------------
    if (four === "duplex") {
        var _body = "'use strict';\nreturn function(vvv){\n\t" +
            prefix +
            ";\n\tif(!arguments.length){\n\t\treturn " +
            code +
            "\n\t}\n\t" + (!rduplex.test(code) ? vars.get : code) +
            "= vvv;\n} "
        try {
            fn = Function.apply(Function, names.concat(_body))
            data.evaluator = cacheExpr(exprId, fn)
        } catch (e) {
        }
        return
    }

    //------------------on----------------
    if (data.type === "on") {
        if (code.indexOf(".bind(") === -1) {
            code = code.replace("(", ".call(this,")
        } else {
            code = code.replace(".bind(", ".call(")
        }
        if (four === "$event") {
            names.push(four)
        }
    }

    //---------------filter----------------
    if (data.filters) {
        code = "\nvar ret" + expose + " = " + code
        var textBuffer = [],
            fargs
        textBuffer.push(code, "\r\n")
        for (var i = 0, fname; fname = data.filters[i++]; ) {
            var start = fname.indexOf("(")
            if (start !== -1) {
                fargs = fname.slice(start + 1, fname.lastIndexOf(")")).trim()
                fargs = "," + fargs
                fname = fname.slice(0, start).trim()
            } else {
                fargs = ""
            }
            textBuffer.push(" if(filters", expose, ".", fname, "){\n\ttry{\nret", expose,
                " = filters", expose, ".", fname, "(ret", expose, fargs, ")\n\t}catch(e){} \n}\n")
        }
        code = textBuffer.join("")
        code += "\nreturn ret" + expose
        names.push("filters" + expose)
    } else {
        code = "\nreturn " + code + ";" //IE全家 Function("return ")出错，需要Function("return ;")
    }

    if (data.type === "on") {
        var lastIndex = code.lastIndexOf("\nreturn")
        var header = code.slice(0, lastIndex)
        var footer = code.slice(lastIndex)
        code = header + "\nif(avalon.openComputedCollect) return ;" + footer
    }

    //---------------other----------------
    try {
        fn = Function.apply(Function, names.concat("'use strict';\n" + prefix + code))
        if (data.type !== "on") {
            fn.apply(fn, args)
        }
        data.evaluator = cacheExpr(exprId, fn)
    } catch (e) {
    } finally {
        textBuffer = names = null //释放内存
    }
}

//parseExpr的智能引用代理
function parseExprProxy(code, scopes, data, tokens) {
    if (Array.isArray(tokens)) {
        var array = tokens.map(function(token) {
            var tmpl = {}
            return token.expr ? parseExpr(token.value, scopes, tmpl) || tmpl : token.value
        })
        data.evaluator = function() {
            var ret = ""
            for (var i = 0, el; el = array[i++]; ) {
                ret += typeof el === "string" ? el : el.evaluator.apply(0, el.args)
            }
            return ret
        }
        data.args = []
    } else {
        parseExpr(code, scopes, data, tokens)
    }
    if (data.evaluator) {
        data.handler = bindingExecutors[data.handlerName || data.type]
        data.evaluator.toString = function() {
            return data.type + " binding to eval(" + code + ")"
        }
        //方便调试
        //这里非常重要,我们通过判定视图刷新函数的element是否在DOM树决定
        //将它移出订阅者列表
        registerSubscriber(data)
    }
}
avalon.parseExprProxy = parseExprProxy
