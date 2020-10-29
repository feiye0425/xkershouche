<?php
namespace app\index\controller;
use \think\Controller;
/**
 * 前台文章控制器
 */
class News extends Controller
{
    public function newsdetails($id='')
    {
/*      $news_tb = db('news')->where('id=6')->find();*/
/*      $news_tb = db('news')->where(['id'=>6])->find();*/
/*      $news_tb = db('news')->where('pid=6 AND title=123')->select();*/
/*      $news_tb = db('news')->where(['pid'=>'6','title'=>'123'])->select();*/
/*      dump($news_tb);*/

    $news_tb = db('news')->where(['pid'=>6])->select();

/*dump ($news_tb );*/
    $b =$news_tb[1];

/*合并数组*/
   /* $w=["r_id"=>"555"];
    $k=array_merge($b,["r_id"=>"666"]); 
    dump ($k);*/

/*替换数组元素,。。。。注意，修改后的键名会改变*/
/*    $t=["title"=>"555"];
    array_splice($b,1,1,$t);
    dump ($b);*/

/*使用splice追加到最后一个元素,。。。。注意，修改后的键名会改变*/
/*    $t=["title"=>"99999"];
    array_splice($b,9,0,$t);
    dump ($b);*/

/* 使用array_combine()还原键名   */
/*  $kk=['id','title','content','author','addtime','updtime','pid','clicks','status','r_id'];
    $cc=array_combine($kk, $b);
    dump ($cc);*/
/*
获取数组单列*/
array_column($a, 'last_name');



$b=$news_tb;
$count=count($news_tb);

foreach ($b as $every_db) {

    $t=["source"=>"相因网"];
   /*  删掉源id，并且在最后添加来源*/
    array_splice($every_db,0,1,$t);

   /* 还原键名*/
    $kk=['source','title','content','author','addtime','updtime','pid','clicks','status'];
    $cc=array_combine($kk,$every_db);
    $k=array_merge($cc,["r_id"=>"666"]); 
   dump($k);

};

   $news_tb3 = db('caiji')->insert($k);
 


   
 















       $news_find = db('news')->find(['pid'=>$id]);
        if (empty($news_find)) {
            $this->error("该文章不存在或已删除！",'index/index/index');
        }





        $pid = $news_find['pid'];


   

        $newscate_model = model('\app\admin\model\Newsfenlei');

        $newscate_parents = $newscate_model->newsCategetParents($pid);
         

        $this->assign("newsparents",$newscate_parents);

        $this->assign('news',$news_find);


        db('news')->where('id',$id)->setInc('clicks');
        return view('news');
       
    }
}
