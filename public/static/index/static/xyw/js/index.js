var topSet;

$(function(){

	//头部切换

	tableClick(".J-tab-header>li",".tab-panel>div","icheruby-tabs-active");

	tableHover(".continents>li",".ui-switchable-content>ul","ui-switchable-active");



	//流程

	tablePrevNext(0,".inner>li",".btnL",".btnR");

	var topSetNum = 0;

	topSet = setInterval(setFun,3000);

	$(".notice-list-content>ul>li").hover(function(){

		clearInterval(topSet);

	},function(){

		topSet = setInterval(setFun,3000);

	});

	function setFun(){

		topSetNum++

		if(topSetNum>=$(".notice-list-content>ul>li").length){

			topSetNum=0;

		}

		if(topSetNum==0){

			$(".notice-list-content>ul").css({"top":-topSetNum*28+"px"});

		}else{

			$(".notice-list-content>ul").animate({"top":-topSetNum*28+"px"});

		}

		

	}

	var mapNum = 0;

	setInterval(function(){

		mapNum++

		if(mapNum > 3){

			mapNum=0

		}

		if(mapNum == 0){

			$(".map_bg").attr("class", "map_bg show_us");

		}else if(mapNum == 1){

			$(".map_bg").attr("class", "map_bg show_eu");

		}else if(mapNum == 2){

			$(".map_bg").attr("class", "map_bg show_au");	

		}else if(mapNum == 3){

			$(".map_bg").attr("class", "map_bg show_asia");

		}

		

	},3000);

	

	//不孕不育

	tableHover(".inoculation-nav>li",".inoculation-list","con")

	tableHover(".inoculation-nav>li",".inoculation-more>a","con")

	

	//分享

	tablePrevNext(0,".review-list-container>div",".ui-switchable-prev-btn",".ui-switchable-next-btn",".ui-switchable-trigger-nav","ui-switchable-active");

	

	//热点

	$(".slide-wrap").hover(function(){

		$(this).find(">a.prev").animate({left:'0'},200);

		$(this).find(">a.next").animate({right:'-2px'},200);

	},function(){

		$(this).find(">a.prev").animate({left:'-40px'},200);

		$(this).find(">a.next").animate({right:'-42px'},200);

	});

	tablePrevNext(1,".contentWrap1>ul>li",".slide-wrap1>a.prev1",".slide-wrap1>a.next1",".circle-wrap1","current");



	//右侧滑动

	

	var top1 = $("#scrollTop1").offset().top

	var top2 = $("#scrollTop2").offset().top

	var top3 = $("#scrollTop3").offset().top

	var top4 = $("#scrollTop4").offset().top

	var top5 = $("#scrollTop5").offset().top

	var top6 = $("#scrollTop6").offset().top

	

	$("#j_goTop").click(function(){

		$('body,html').animate({scrollTop: 0}, 500); 	

	});

	$(".vertical-nav>li").click(function(){

		$(".vertical-nav>li").removeClass("nav").eq($(this).index()).addClass("nav");

		var top = $("#scrollTop"+($(this).index()+1)).offset().top;

		$('body,html').animate({scrollTop: top}, 500); 

	});

	$(window).scroll(function () {

		if ($(window).scrollTop() >= 198) {

			$("#g-floatbar").addClass("floatbar-fixed");

		}else{

			$("#g-floatbar").removeClass("floatbar-fixed");

		}

		if($(window).scrollTop() < top1){

			$(".vertical-nav>li").removeClass("nav");

		}else if($(window).scrollTop() >= top1 && $(window).scrollTop() < top2){

			$(".vertical-nav>li").removeClass("nav").eq(0).addClass("nav");

		}else if($(window).scrollTop() >= top2 && $(window).scrollTop() < top3){

			$(".vertical-nav>li").removeClass("nav").eq(1).addClass("nav");

		}else if($(window).scrollTop() >= top3 && $(window).scrollTop() < top4){

			$(".vertical-nav>li").removeClass("nav").eq(2).addClass("nav");

		}else if($(window).scrollTop() >= top4 && $(window).scrollTop() < top5){

			$(".vertical-nav>li").removeClass("nav").eq(3).addClass("nav");

		}else if($(window).scrollTop() >= top5 && $(window).scrollTop() < top6){

			$(".vertical-nav>li").removeClass("nav").eq(4).addClass("nav");

		}else if($(window).scrollTop() >= top6){

			$(".vertical-nav>li").removeClass("nav").eq(5).addClass("nav");

		}

		

	});

});

