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

/*  $kk=['source','title','content','author','addtime','updtime','pid','clicks','status'];
    $cc=array_combine($kk,$every_db);
    $k=array_merge($cc,["r_id"=>"666"]); 
   dump($k);
}*/


dump($b);
$qq=array_column($b, 'title');
dump($qq);

$qq['title']=$qq['id'];
unset($qq['id']);
dump($qq);



$result=array_diff_assoc($b,$qq);


dump($result);

foreach ($b as $a){

   // array_shift($a);
   unset($a['title']);
    $c=array_merge($a,['source'=>'相因网']);



/*$c = ['source'=>'相因网'];
array_splice($a,0,1,$c);
$kk = ['source','title','content','author','addtime','updtime','pid','clicks','status'];
$zz = array_combine($kk,$a);*/




dump($c);



 echo "<pre>";
 print_r($_FILES);
 echo $_SERVER['DOCUMENT_ROOT']."<br />";//获取文件服务器的根目录。
 echo dirname(__FILE__)."<br />";//获取当前文件的目录;
 echo __FILE__."<br/>";//获取当前文件的目录和文件名。
 echo basename(__FILE__);//获取当前文件的目录和文件名。
 echo "</pre>";


 
}



/*$res = db('caiji')->insert($dd);*/

}



}