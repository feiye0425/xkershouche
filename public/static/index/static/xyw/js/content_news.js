// JavaScript Document
$(function(){
	tableHover(".service-nav>li",".service-list","nav")
	$(".content-Relevant-Doctor-list ul").css({"width":$(".content-Relevant-Doctor-list li").length*99});
	var DoctorNum = 0;
	$(".Doctor-botton a.Prev").click(function(){
		DoctorNum++;
		if(DoctorNum >=  $(".content-Relevant-Doctor-list li").length-3){
			DoctorNum = $(".content-Relevant-Doctor-list li").length-3;
		}
		$(".content-Relevant-Doctor-list ul").animate({"left":-DoctorNum*99})
	});
	$(".Doctor-botton a.next").click(function(){
		DoctorNum--
		if(DoctorNum<=0){
			DoctorNum=0;
		}
		$(".content-Relevant-Doctor-list ul").animate({"left":-DoctorNum*99})
	});
	$(".special-float-top").click(function(){
		$('body,html').animate({scrollTop:0},500);
	});
	
	//相因医疗右侧
	$("#city-list").hover(function(){
		$("#city-list>li").length/5*42
		$(this).animate({"height":$("#city-list>li").length/5*42});
	},function(){
		$(this).animate({"height":155});	
	});
	
	//百科-知识-右侧效果
	var guideTop = $(".fr-top-guide").offset().top;
	$(window).scroll(function(){
		if($(window).scrollTop()>397){
			$(".fr-top-Catalog").addClass("JS-fixed");
		}else{
			$(".fr-top-Catalog").removeClass("JS-fixed");
		}
		
		if($(window).scrollTop()>=guideTop){
			$(".fr-top-guide").addClass("JS-fixed");
		}else{
			$(".fr-top-guide").removeClass("JS-fixed");
		}
	});
	
	$(".comment").click(function(){
		$('body,html').animate({scrollTop:$("#message").offset().top},500);
	});
});