// JavaScript Document

//判断访问终端

var browser = {
    versions: function () {
        var u = navigator.userAgent, app = navigator.appVersion;
        return {
            trident: u.indexOf('Trident') > -1,
            presto: u.indexOf('Presto') > -1,
            webKit: u.indexOf('AppleWebKit') > -1,
            gecko: u.indexOf('Gecko') > -1 && u.indexOf('KHTML') == -1,
            mobile: !!u.match(/AppleWebKit.*Mobile.*/) || !!u.match(/AppleWebKit/) && u.indexOf('QIHU') && u.indexOf('Chrome') < 0,
            ios: !!u.match(/\(i[^;]+;( U;)? CPU.+Mac OS X/),
            android: u.indexOf('Android') > -1 || u.indexOf('Linux') > -1,
            iPhone: u.indexOf('iPhone') > -1 || u.indexOf('Mac') > -1,
            iPad: u.indexOf('iPad') > -1,
            webApp: u.indexOf('Safari') == -1,
            ua: u
        };
    } (),
    language: (navigator.browserLanguage || navigator.language).toLowerCase()
}

if (browser.versions.mobile && !browser.versions.iPad) {
    var url1 = window.location.href;
    this.location = url1.replace("www.", "m.");
}

$(function(){

	$(window).scroll(function(){

		if($(window).scrollTop()>500){

			$("#J_gotoTop").show()

		}else{

			$("#J_gotoTop").hide()

		}

	});

	$("#J_gotoTop").click(function(){

		$('body,html').animate({scrollTop:0},500);

	});

	$(".right-help-entry").hover(function(){

		$(".right-help-entry").css("width","370px");

		$('.right-panel').show();

		$(".panel-close").click(function(){

			$(".right-help-entry").css("width","auto");

			$('.right-panel').hide();

		});

	},function(){

		$(".right-help-entry").css("width","auto");

		$('.right-panel').hide();

	});

});
function oPen(){
	window.open("http://q.url.cn/abU1c8?_type=wpa&qidian=true");	
}
function tableClick(tit,tab,Class,is){

	$(tit).click(function(){

		$(tit).removeClass(Class);

		$(this).addClass(Class);

		$(tab).hide().eq($(this).index()).show();

		if(is){

			var i = $(this).index();

			tablePrevNext(1,".contentWrap"+(i+1)+">ul>li",".slide-wrap"+(i+1)+">a.prev"+(i+1),".slide-wrap"+(i+1)+">a.next"+(i+1),".circle-wrap"+(i+1),"current");



		}

	});	

}

function tableHover(tit,tab,Class){

	$(tit).hover(function(){

		$(tit).removeClass(Class);

		$(this).addClass(Class);

		$(tab).hide().eq($(this).index()).show();

	});	

}



function tablePrevNext(isSlide,tit,btnL,btnR,titList,Class){

	var i = 0;

	var length = $(tit).length;

	if(isSlide == 1){

		var width = $(tit).eq(0).width();

		$(tit).parent().css("width",length*width);

	}

	$(btnL).click(function(){

		i--;

		if(i<=0){

			i=0

		}

		if(isSlide == 1){

			$(tit).parent().animate({left:-i*width},300);

		}else{

			$(tit).hide().eq(i).show();	

		}

		

		if(titList){

			$(titList).find(">li").removeClass(Class);

			$(titList).find(">li:eq("+i+")").addClass(Class);

		}

	});	

	$(btnR).click(function(){

		i++;

		if(i >= length-1){

			i=length-1;

		}

		if(isSlide == 1){

			$(tit).parent().animate({left:-i*width},300);

		}else{

			$(tit).hide().eq(i).show();	

		}

		if(titList){

			$(titList).find(">li").removeClass(Class);

			$(titList).find(">li:eq("+i+")").addClass(Class);

		}

	});	

	if(titList){

		$(titList).find(">li").hover(function(){

			i = $(this).index();

			$(titList).find(">li").removeClass(Class);

			$(this).addClass(Class);

			if(isSlide == 1){

				$(tit).parent().animate({left:-i*width},300);

			}else{

				$(tit).hide().eq(i).show();	

			}

		})

	}

}


//姐妹帮-讨论群

function addGrounp(_this){
	if(browser.versions.mobile || browser.versions.android || browser.versions.ios || browser.versions.wp){
		$(".hp_institute_detail_alertA .alert_group_btns #copy,.hp_institute_detail_alertA .alert_group_btns a").hide();
		var clipboard = new ClipboardJS("#copyA");
		clipboard.on("success", function(){
			$(".hp_institute_detail_alertA .hp_alert_content_menu").hide();
			$(".hp_institute_detail_alertA .hp_alert_content_photo").show();
			$(".hp_institute_detail_alertA .hp_alert_content_photo p").click(function(){
				$(".hp_institute_detail_alertA").hide();	
			})
		});
	}else{
		$(".hp_institute_detail_alertA .alert_group_btns #copyA").hide();
		var clipboard = new ClipboardJS("#copy");
		clipboard.on("success", function(){
			$(".hp_institute_detail_alertA .hp_alert_content_menu").hide();
			$(".hp_institute_detail_alertA .hp_alert_content_photo").show();
			$(".hp_institute_detail_alertA .hp_alert_content_photo p").click(function(){
				$(".hp_institute_detail_alertA").hide();	
			})
		});
	};
	
	
	$(".hp_institute_detail_alertA").show();
	$(".hp_institute_detail_alertA .close_hp_alert").click(function(){
		$(".hp_institute_detail_alertA").hide();
	});
}


/*window._bd_share_config={"common":{"bdSnsKey":{},"bdText":"","bdMini":"1","bdMiniList":false,"bdPic":"","bdStyle":"","bdSize":"16"},"share":{}};



with(document)0[(getElementsByTagName('head')[0]||body).appendChild(createElement('script')).src='http://bdimg.share.baidu.com/static/api/js/share.js?v=89860593.js?cdnversion='+~(-new Date()/36e5)];
*/

//百度统计
var _hmt = _hmt || [];
(function() {
  var hm = document.createElement("script");
  hm.src = "https://hm.baidu.com/hm.js?668fe5dd78e1e6952d26234d75930a65";
  var s = document.getElementsByTagName("script")[0]; 
  s.parentNode.insertBefore(hm, s);
})();