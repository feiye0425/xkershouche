<?php
namespace app\admin\controller;
use \think\Controller;
/**
 *后台采集控制器
 */
class Caiji extends Common
{
    public function caiji()
    {
/*      $news_tb = db('news')->where('id=6')->find();*/
/*      $news_tb = db('news')->where(['id'=>6])->find();*/
/*      $news_tb = db('news')->where('pid=6 AND title=123')->select();*/
/*      $news_tb = db('news')->where(['pid'=>'6','title'=>'123'])->select();*/
/*      dump($news_tb);*/

    $news_tb = db('news')->where(['pid'=>6])->select();
    $b =$news_tb;

$b=$news_tb;
$count=count($news_tb);

/*foreach ($b as $every_db) {
    $news_tb = db('news')->where(['pid'=>6])->select();
    $t=["source"=>"相因网"];
   /*  删掉源id，并且在最后添加来源*/
  /*  array_splice($every_db,0,1,$t);*/

   /* 还原键名*/

/*    $kk=['source','title','content','author','addtime','updtime','pid','clicks','status'];
    $cc=array_combine($kk,$every_db);
    $k=array_merge($cc,["r_id"=>"666"]); 
   dump($k);
}*/

foreach ($b as $a){
    unset($a['id']);
   /* $b=array_merge($b,['source'=>'laiyinwang']);*/


$cc = array_merge($a,['source'=>'laiyin']);
dump("---------------");
dump($cc);
}





/*$res = db('caiji')->insert($dd);*/

}



}