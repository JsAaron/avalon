

var a = avalon.define("box", function(vm) {
    vm.w = 100;
    vm.y = 'hahahh'
    vm.z = '啊是大师傅'
//        vm.h = 100;
    vm.click = function() {
        vm.w = parseFloat(vm.w) + 10;
    }
})

//
//setTimeout(function(){
//    console.log(a)
//},1000)