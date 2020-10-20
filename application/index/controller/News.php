<?php
namespace app\index\controller;
use \think\Controller;
/**
 * 前台新闻控制器
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

    $news_tb = db('news')->where(['pid'=>$id])->select();

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
