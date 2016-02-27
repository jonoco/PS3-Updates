'use strict';

(function(){
	var idInput = document.querySelector('#id-search'); // Game id search input
	var hint = document.querySelector('.hint');					// input tip

	idInput.addEventListener('focus', function() {
		hint.classList.remove('hide');
	});

	idInput.addEventListener('blur', function () {
		hint.classList.add('hide');
	});

}());