var NodePoss = [];
let scrolls = true;
var leftsss;
$(function () {
    $('html ,body').animate({
        scrollTop: 0
    }, 0);
    // console.log("回到顶部了")
    $(".action_share,.action_qrcode").hover(function () {
        $(this).addClass("open");
    }, function () {
        $(this).removeClass("open");
    });
    //视频内容
    $(".sp-left .Topic-tabs li").click(function () {
        $(".sp-left .Topic-tabs a").removeClass("is-active");
        $(this).find("a").addClass("is-active");
        $(".sp-left .sp-content").hide();
        $(".sp-left .sp-content").eq($(this).index()).show();
    });
    $(".video-pl").click(function () {
        $(".sp-left .Topic-tabs li").eq(0).trigger("click");
    });
    $(".video-data .nrjj").click(function () {
        $(".sp-left .Topic-tabs li").eq(1).trigger("click");
    });
    //视频列表
    let mainlength = $(".gj-left .TopicIndex-content").eq(0).find(".TopicIndex-contentMain").length
    if (mainlength == 1) {
        Nodes();
    }
    $(".gj-left .Topic-tabs li").click(function () {
        $(".gj-left .Topic-tabs a").removeClass("is-active");
        $(this).find("a").addClass("is-active");
        $(".gj-left .TopicIndex-content").hide();
        $(".gj-left .TopicIndex-content").eq($(this).index()).show();
        if ($(this).index() > 2) {
            $(".gj-left .TopicIndex-content").eq($(this).index()).css('display', 'flex');
        }
        // TopicIndex-contentMain
        let mainlength = $(".gj-left .TopicIndex-content").eq($(this).index()).find(".TopicIndex-contentMain").length
        if (mainlength == 1) {

            Nodes();
        }
    });
    $(".info-more").click(function () {
        if ($(this).prev().hasClass("heiOf")) {
            $(this).prev().removeClass("heiOf");
            $(this).find("span").text("收起全部");
        } else {
            $(this).prev().addClass("heiOf");
            $(this).find("span").text("展开全部");
        }
    });
    $(".Sticky").attr("style", "width:180px;");
    leftsss = $(".TopicIndex-contentSide").offset().left
});
var scroH;
$(window).resize(function () { //当浏览器大小变化时
    // leftsss= $(".TopicIndex-contentSide").offset().left-180

    if (scroH > $(".gj-left").offset().top + 51) { //距离顶部大于100px时
        if (scroH > $(".gj-left").offset().top + $(".gj-left").height() - 546) {
            $(".Sticky").removeClass("is-fixed").addClass("is-absolute").attr("style", "width:180px;right: 0;");
        } else {
            //  	$(".Sticky").attr("style","position: sticky;top:0;");
            $(".Sticky").removeClass("is-absolute").addClass("is-fixed").attr("style", "width:180px;top:0");
        }
    } else {
        $(".Sticky").removeClass("is-fixed").removeClass("is-absolute").attr("style", "width:180px;");
    }

});
$(document).scroll(function () {
    scroH = $(document).scrollTop(); //滚动高度

    if (scroH > $(".gj-left").offset().top + 51) { //距离顶部大于100px
        if (scroH > $(".gj-left").offset().top + $(".gj-left").height() - 546) {
            $(".Sticky").removeClass("is-fixed").addClass("is-absolute").attr("style", "width:180px;right: 0;");
        } else {
            //  	$(".Sticky").attr("style","position: sticky;top:0;");
            $(".Sticky").removeClass("is-absolute").addClass("is-fixed").attr("style", "width:180px;top:0;");
        }
    } else {
        $(".Sticky").removeClass("is-fixed").attr("style", "width:180px;");
    }

});



function Nodes() {
    $(".TopicIndex-contentMain").children().each(function (index, element) {
        NodePoss.push($(element).offset().top)
    });
    console.log(NodePoss)
    $(".TopicIndexCatalog-item").click(function () {
        scrolls = false
        let index = $(this).index()
        console.log(index)
        $(".TopicIndexCatalog-item").eq(index).addClass("current").siblings().removeClass("current")
        console.log(NodePoss[index])
        $("html,body").animate({
            scrollTop: NodePoss[index] - 76
        }, 300, function () {
            scrolls = true
        });
    })
    var winPoss = $(document).scrollTop(); //屏幕位置
    for (let i in NodePoss) {
        if (winPoss >= NodePoss[i] - 77) {
            $(".TopicIndexCatalog-item").eq(i).addClass("current").siblings().removeClass("current")
        }
    }
    $(window).scroll(function (event) {
        if (scrolls) {
            var winPoss = $(document).scrollTop(); //屏幕位置
            for (let i in NodePoss) {
                if (winPoss >= NodePoss[i] - 77) {
                    $(".TopicIndexCatalog-item").eq(i).addClass("current").siblings().removeClass("current")
                }
            }
        }
    });


}