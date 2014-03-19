

avalon.define("box", function(vm) {
    vm.w = 100;
//        vm.h = 100;
    vm.click = function() {
        vm.w = parseFloat(vm.w) + 10;
    }
})
