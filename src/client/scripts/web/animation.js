/*global TimelineMax*/

var banner_01 = $('#banner_01'),
	animBanner01,
	timerId,
	selectButton = function(id) {
		$('[data-banner]').removeClass('active');
		$('[data-banner="' + id + '"]').addClass('active');
	},
	banner_01start = function() {
		selectButton('01');
		banner_01.show();
		animBanner01.restart();
	},
	initBanner01 = function() {
		var anim_01_drop_browser 		= $('.drop-browser');
		var anim_01_drag_drop 		= $('.drag-drop');
		var anim_01_drop_file 		= $('.drag-file');

		var anim_01_form_page_wrap 		= $('.form-page-wrap');
		var anim_01_content_fill 			= $('.content-fill');
		var anim_01_search_rotate 		= $('.search-rotate');
		var anim_01_search_text 			= $('.search-text');
		var anim_01_Fgreen_shape1 		= $('.form-green-shape1');
		var anim_01_Fgreen_shape2 		= $('.form-green-shape2');
		var anim_01_Fgreen_shape3 		= $('.form-green-shape3');
		var anim_01_Fgreen_shape4 		= $('.form-green-shape4');
		var anim_01_Fgreen_shape5 		= $('.form-green-shape5');
		var anim_01_Fgreen_shape6 		= $('.form-green-shape6');
		var anim_01_Fgreen_shape7 		= $('.form-green-shape7');
		var anim_01_Fgreen_shape8 		= $('.form-green-shape8');
		var anim_01_Fgreen_shape9 		= $('.form-green-shape9');
		var anim_01_Fgreen_shape10 		= $('.form-green-shape10');
		var anim_01_Fgreen_shape11 		= $('.form-green-shape11');
		var anim_01_Fgreen_square 		= $('.form-green-square');
		var anim_01_form_page 		= $('.form-page');

		var textAnim_01 = $('.from-green-text1').blast({ delimiter: "word" });
		var textAnim_02 = $('.from-green-text2').blast({ delimiter: "word" });
		var textAnim_03 = $('.from-green-text3').blast({ delimiter: "word" });
		var textAnim_04 = $('.from-green-text4').blast({ delimiter: "word" });
		var textAnim_05 = $('.from-green-text5').blast({ delimiter: "word" });
		var textAnim_06 = $('.from-green-text6').blast({ delimiter: "word" });
		var textAnim_07 = $('.from-green-text7').blast({ delimiter: "word" });
		var textAnim_08 = $('.from-green-text8').blast({ delimiter: "word" });
		var textAnim_09 = $('.from-green-text9').blast({ delimiter: "word" });
		var textAnim_10 = $('.from-green-text10').blast({ delimiter: "word" });
		var textAnim_11 = $('.from-green-text11').blast({ delimiter: "word" });
		var textAnim_12 = $('.from-green-text12');

		animBanner01 = new TimelineMax({
			paused: true,
			onComplete: function() {
				clearTimeout(timerId);
				timerId = setTimeout(banner_01start, 2000);
			}
		});

		animBanner01.from(anim_01_drop_file, 1.8, {right:"-70px", delay: 0.4})
		.to(anim_01_drop_browser, 0.8, {opacity:0,autoAlpha:0})
		.to(anim_01_form_page_wrap, 0.5, {autoAlpha:1})
		.to(anim_01_content_fill, 0.4, {autoAlpha:1},"fillLable")
		.to(anim_01_search_rotate, 0.4, {autoAlpha:1},"fillLable")
		.to(anim_01_search_text, 0.4, {autoAlpha:1},"fillLable")
		.to(anim_01_search_rotate, 2, {autoAlpha:0},"label1")
		.to(anim_01_search_text, 2, {autoAlpha:0},"label1")
		.to(anim_01_form_page, 2, {autoAlpha:1},"label1")
		.to(anim_01_Fgreen_shape1, 0.9, {autoAlpha:1, opacity:1},"label1+=0.7")
		.to(anim_01_Fgreen_shape2, 0.9, {autoAlpha:1,opacity:1},"label1+=0.8")
		.to(anim_01_Fgreen_shape3, 0.9, {autoAlpha:1,opacity:1},"label1+=0.9")
		.to(anim_01_Fgreen_shape4, 0.9, {autoAlpha:1,opacity:1},"label1+=1")
		.to(anim_01_Fgreen_shape5, 0.9, {autoAlpha:1,opacity:1},"label1+=1.1")
		.to(anim_01_Fgreen_shape6, 0.9, {autoAlpha:1,opacity:1},"label1+=1.2")
		.to(anim_01_Fgreen_shape7, 0.9, {autoAlpha:1,opacity:1},"label1+=1.3")
		.to(anim_01_Fgreen_shape8, 0.9, {autoAlpha:1,opacity:1},"label1+=1.4")
		.to(anim_01_Fgreen_shape9, 0.9, {autoAlpha:1,opacity:1},"label1+=1.5")
		.to(anim_01_Fgreen_shape10, 0.9,{autoAlpha:1,opacity:1},"label1+=1.6")
		.to(anim_01_Fgreen_shape11, 0.9,{autoAlpha:1,opacity:1},"label1+=1.7")
		.to(anim_01_Fgreen_square, 0.9,{autoAlpha:1,opacity:1},"label1+=1.8")
		.staggerFrom(textAnim_01, 0.4, {scale:0, autoAlpha:0}, 0.1, "label1+=4.5")
		.staggerFrom(textAnim_02, 0.4, {scale:0, autoAlpha:0}, 0.1, "label1+=4.6")
		.staggerFrom(textAnim_03, 0.4, {scale:0, autoAlpha:0}, 0.1, "label1+=4.7")
		.staggerFrom(textAnim_04, 0.4, {scale:0, autoAlpha:0}, 0.1, "label1+=4.8")
		.staggerFrom(textAnim_05, 0.4, {scale:0, autoAlpha:0}, 0.1, "label1+=4.9")
		.staggerFrom(textAnim_06, 0.4, {scale:0, autoAlpha:0}, 0.1, "label1+=5")
		.staggerFrom(textAnim_07, 0.4, {scale:0, autoAlpha:0}, 0.1, "label1+=5.1")
		.staggerFrom(textAnim_08, 0.4, {scale:0, autoAlpha:0}, 0.1, "label1+=5.2")
		.staggerFrom(textAnim_09, 0.4, {scale:0, autoAlpha:0}, 0.1, "label1+=5.3")
		.staggerFrom(textAnim_10, 0.4, {scale:0, autoAlpha:0}, 0.1, "label1+=5.4")
		.staggerFrom(textAnim_11, 0.4, {scale:0, autoAlpha:0}, 0.1, "label1+=5.5")
		.staggerFrom(textAnim_12, 0.4, {scale:0, autoAlpha:0}, 0.1, "label1+=5.6");
	};

initBanner01();

$(document).ready(function () {
	setTimeout(function() {
		animBanner01.play();
	}, 1000);
});
