$(function(){
	$(".tag-more").click(function(){
		$(this).parents(".yy-container-body").find(".section-content").css("height","auto");	
	});
	$(".show-all").click(function(){
		$(this).parent().find("ul").removeClass("heiOh");
	});
	$('#yy-tab-nav-cn ul li').mouseover(function() {
		var i = $(this).index(); //当前元素位置
		var url = $(this).data('moreurl'); //
		//console.log(url)
		$('#yy-down-cn').data('url', url);
		$('#yy-down-cn').data('index', i);
		$(this).addClass('cur').siblings().removeClass('cur');
		$('#yy-container-cn .yy-tab-con').eq(i).show().siblings().hide();
	});
	$(".group .more").click(function(){
		if(!$(this).hasClass("spread")){
			$(this).addClass("spread");
			$(this).prev().css("height","auto");
		}else{
			$(this).removeClass("spread");	
			$(this).prev().css("height","240px");
		}
	});
	
});