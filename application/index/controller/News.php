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

    public function newslist_1()
    {

        $news_fenlei = db('newsfenlei')->select();
        $array = array();
        foreach ($news_fenlei as $key => $value) {
            if($value['pid']==0){
               // 假如pid=0，也就是是一级分类，现在$value就两条数据

                $children = getChildren($news_fenlei,$value['id']);
               // 现在从foreach之前的所有数组中，找到这两条数组中获取id主键的所有儿子类，
              
                array_unshift($children, $value);
                //将父类添加到子类的前面，组成一个新的数组。现在这两条$value前面是自己，后面是子类；


                $ids = array_column($children, 'id');//额外组成一个id的单列数组ids
         
                $news = db('news')->where('pid','in',$ids)->select();//获取所有父类是在ids组中的数组

                $array[$key] = $children[0];
                $array[$key]['children'] = $news;
            }
        }





      
        return view();

    }


}
