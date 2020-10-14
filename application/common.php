<?php
// +----------------------------------------------------------------------
// | ThinkPHP [ WE CAN DO IT JUST THINK ]
// +----------------------------------------------------------------------
// | Copyright (c) 2006-2016 http://thinkphp.cn All rights reserved.
// +----------------------------------------------------------------------
// | Licensed ( http://www.apache.org/licenses/LICENSE-2.0 )
// +----------------------------------------------------------------------
// | Author: 流年 <liu21st@gmail.com>
// +----------------------------------------------------------------------

// 应用公共文件
/*由父类得到全部子类，得到一个多维数组*/
function getChildren($list,$pid=0)
{
    $arr = array();
    foreach ($list as $key => $value) {
        if ($value['pid'] == $pid) {
            $value['children'] = getChildren($list,$value['id']);
            $arr[] = $value;
        }
    }
    return $arr;
}
/*由父类得到全部子类，得到一个二维数组*/
function getChildren2($list,$pid=0)
{
    static $arr = array();
    foreach ($list as $key => $value) {
        if ($value['pid']==$pid) {
            $arr[] = $value;
            getChildren2($list,$value['id']);
        }
    }

    return $arr;
}

/*无线级分类由子类得到全部父类*/
function getParents($list,$pid)
{
    static $arr = array();
    foreach ($list as $key => $value) {
        if ($value['id']==$pid) {
            array_unshift($arr,$value);
            getParents($list,$value['pid']);
        }
    }
    return $arr;
}
function explode2($str)
{
    return explode('|',$str);
}

function getfiles($dir)
{
    $files = array();
    if ($handdle = opendir($dir)) {
        while (($file = readdir($handdle))!==false) {
            if($file !='.'&&$file != '..'){
                if (is_dir($dir.'/'.$file)) {
                    $files[$file] = getfiles($dir.'/'.$file);
                } else {
                    $files[] = $file;
                }
            }
        }
    }
    closedir($handdle);
    return $files;
}

function getfiles2($dir)
{
    static $files = array();
    if ($handdle = opendir($dir)) {
        while (($file = readdir($handdle))!==false) {
            if($file !='.'&&$file != '..'){
                if (is_dir($dir.'/'.$file)) {
                    getfiles2($dir.'/'.$file);
                } else {
                    $files[] = $dir.'/'.$file;
                }
            }
        }
    }
    closedir($handdle);
    return $files;
}

function msubstr($str, $start=0, $length, $charset="utf-8", $suffix=false){

 if(function_exists("mb_substr")){

  if($suffix)

   return mb_substr($str, $start, $length, $charset)."...";

  else

   return mb_substr($str, $start, $length, $charset);

 }elseif(function_exists('iconv_substr')) {

  if($suffix)

   return iconv_substr($str,$start,$length,$charset)."...";

  else

   return iconv_substr($str,$start,$length,$charset);

 }

 $re['utf-8'] = "/[x01-x7f]|[xc2-xdf][x80-xbf]|[xe0-xef][x80-xbf]{2}|[xf0-xff][x80-xbf]{3}/";

 $re['gb2312'] = "/[x01-x7f]|[xb0-xf7][xa0-xfe]/";

 $re['gbk'] = "/[x01-x7f]|[x81-xfe][x40-xfe]/";

 $re['big5'] = "/[x01-x7f]|[x81-xfe]([x40-x7e]|xa1-xfe])/";

 preg_match_all($re[$charset], $str, $match);

 $slice = join("",array_slice($match[0], $start, $length));

 if($suffix) return $slice."…";

 return $slice;

}

function getArea($province_id='',$city_id='',$county_id='')
{
    $fileName = '../public/static/index/static/area.json';
    $string = file_get_contents($fileName);
    $data = json_decode($string,true);
    $arr = array();
    foreach ($data as $key => $value) {
        if ($value['code']==$province_id) {
            $arr['province_name'] = $value['name'];
            foreach ($value['children'] as $key1 => $value1) {
                if ($value1['code']==$city_id) {
                    $arr['city_name'] = $value1['name'];
                    foreach ($value1['children'] as $key2 => $value2) {
                        if ($value2['code']==$county_id) {
                            $arr['county_name'] = $value2['name'];
                        }
                    }
                }
            }
        }
    }
    return $arr;
}

function assessmentPrice($carmodel,$year,$month,$kilometre)
{
    $current_year = date("Y",time());
    $current_month = date('m',time());
    $newprice = db('cars')->where('carmodel',$carmodel)->avg('new_price');
    if (empty($newprice)) {
        return 0;
    }
    $mk = $kilometre>($current_year-$year)*6?($current_year-$year)*6:$kilometre;
    $gl = $mk>30?0.15:($mk/360);
    $month_all = ($current_year-$year)*12+($current_month-$month);
    $cx = $month_all>180?0.15:($month_all/180);
    $radio = ((1-$gl)+(1-$cx))/2;
    $assessment_price = ceil($newprice*$radio);
    return $assessment_price;

}


/**
 * $msg 待提示的消息
 * $url 待跳转的链接
 * $icon 这里主要有两个，5和6，代表两种表情（哭和笑）
 * $time 弹出维持时间（单位秒）
 */
function alert_success($msg='',$url='',$time=3){ 


       
  $str='<script type="text/javascript" src="__ADMIN__/js/plugins/pace/jquery19.min.js"></script> <script type="text/javascript" src="__ADMIN__/js/layer/modules/layer.js"></script>';//加载jquery和layer
  $str.='<script>
    $(function(){
      layer.msg("'.$msg.'",{icon:"6",time:'.($time*1000).'});
      setTimeout(function(){
          self.location.href="'.$url.'" rel="external nofollow" rel="external nofollow"
      },2000)
    });
  </script>';//主要方法
  return $str;
}
 
/**
 * $msg 待提示的消息
 * $icon 这里主要有两个，5和6，代表两种表情（哭和笑）
 * $time 弹出维持时间（单位秒）
 */
function alert_error($msg='',$time=3){ 
  $str='<script type="text/javascript" src="__ADMIN__/js/plugins/pace/jquery19.min.js"></script> <script type="text/javascript" src="__ADMIN__/js/layer/modules/layer.js"></script>';//加载jquery和layer
  $str.='<script>
    $(function(){
      layer.msg("'.$msg.'",{icon:"5",time:'.($time*1000).'});
      setTimeout(function(){
          window.history.go(-1);
      },2000)
    });
  </script>';//主要方法
  return $str;
}

