
/************************************************************************
 *                                parseHTML                                 *
 ****************************************************************************/
var rtagName = /<([\w:]+)/,
//取得其tagName
    rxhtml = /<(?!area|br|col|embed|hr|img|input|link|meta|param)(([\w:]+)[^>]*)\/>/ig,
    scriptTypes = oneObject("text/javascript", "text/ecmascript", "application/ecmascript", "application/javascript", "text/vbscript"),
//需要处理套嵌关系的标签
    rnest = /<(?:tb|td|tf|th|tr|col|opt|leg|cap|area)/
//parseHTML的辅助变量
var tagHooks = new function() {
    var object = {
        option: DOC.createElement("select"),
        thead: DOC.createElement("table"),
        td: DOC.createElement("tr"),
        area: DOC.createElement("map"),
        tr: DOC.createElement("tbody"),
        col: DOC.createElement("colgroup"),
        legend: DOC.createElement("fieldset"),
        "*": DOC.createElement("div")
    }
    object.optgroup = object.option
    object.tbody = object.tfoot = object.colgroup = object.caption = object.thead
    object.th = object.td
    return object
}

avalon.clearHTML = function(node) {
    node.textContent = "" //它能在IE10+,firefox, chrome中迅速清空元素节点，文档碎片的孩子
    return node
}
var script = DOC.createElement("script")
avalon.parseHTML = function(html) {
    if (typeof html !== "string") {
        html = html + ""
    }
    html = html.replace(rxhtml, "<$1></$2>").trim()
    if (deleteRange.createContextualFragment && !rnest.test(html) && !/<script/.test(html)) {
        var range = DOC.createRange()
        range.selectNodeContents(root)
        return range.createContextualFragment(html)
    }
    var fragment = documentFragment.cloneNode(false)
    var tag = (rtagName.exec(html) || ["", ""])[1].toLowerCase()
    if (!(tag in tagHooks)) {
        tag = "*"
    }
    var parent = tagHooks[tag]
    parent.innerHTML = html
    var els = parent.getElementsByTagName("script"),
        firstChild, neo
    if (els.length) { //使用innerHTML生成的script节点不会发出请求与执行text属性
        for (var i = 0, el; el = els[i++]; ) {
            if (!el.type || scriptTypes[el.type]) { //如果script节点的MIME能让其执行脚本
                neo = script.cloneNode(false) //FF不能省略参数
                for (var j = 0, attr; attr = el.attributes[j++]; ) {
                    neo[attr.name] = attr.value //复制其属性
                }
                neo.text = el.text //必须指定,因为无法在attributes中遍历出来
                el.parentNode.replaceChild(neo, el) //替换节点
            }
        }
    }
    while (firstChild = parent.firstChild) { // 将wrapper上的节点转移到文档碎片上！
        fragment.appendChild(firstChild)
    }
    return fragment
}
avalon.innerHTML = function(node, html) {
    if (rnest.test(html)) {
        var a = this.parseHTML(html)
        this.clearHTML(node).appendChild(a)
    } else {
        node.innerHTML = html
    }
}
